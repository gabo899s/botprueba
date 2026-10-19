const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { dataDir } = require('./config');
const { privateDirectory, privateFile } = require('./private-files');
const { recordBelongsTo } = require('./record-access');
const store = require('./store');
const RETENTION = 90 * 86400000, MAX_EVENTS = 500;
let markers;
function database() {
  if (markers) return markers;
  privateDirectory(dataDir);
  const file = path.join(dataDir, 'citizen-notifications.sqlite');
  privateFile(file);
  markers = new DatabaseSync(file); privateFile(file);
  markers.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS read_markers(user_id TEXT NOT NULL,event_id TEXT NOT NULL,read_at INTEGER NOT NULL,PRIMARY KEY(user_id,event_id)); CREATE INDEX IF NOT EXISTS notification_retention ON read_markers(read_at)');
  return markers;
}
function prune(now = Date.now()) {
  const db = database();
  db.prepare('DELETE FROM read_markers WHERE read_at < ?').run(now - RETENTION);
  db.exec('DELETE FROM read_markers WHERE rowid IN (SELECT rowid FROM read_markers ORDER BY read_at DESC LIMIT -1 OFFSET 100000)');
}
function userId(user) { return String(user?.discordId || user?.id || ''); }
function readState(user) {
  const id = userId(user); if (!id) return [];
  prune();
  return database().prepare('SELECT event_id AS id,read_at AS readAt FROM read_markers WHERE user_id=? ORDER BY read_at DESC LIMIT 500').all(id);
}
function ownEvents(user, now = Date.now()) {
  const id = userId(user); if (!id) return [];
  const events = [], cutoff = now - RETENTION;
  const citizens = Object.values(store.read('cedulas') || {}).filter(c => String(c.discordId) === id);
  const documents = new Set(citizens.map(c => c.numeroCedula));
  function add(kind, entity, at, title, text, panel, target = { type: kind, id: String(entity) }) {
    const timestamp = typeof at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(at) ? Date.parse(at) : NaN;
    if (!entity || !Number.isFinite(timestamp) || timestamp < cutoff || timestamp > now) return;
    const eventId = crypto.createHash('sha256').update(JSON.stringify([id,kind,String(entity),at])).digest('hex');
    events.push({ id: eventId, kind, at: new Date(timestamp).toISOString(), title, text, panel, target });
  }
  for (const [name, label] of [['multas','Multa'], ['arrestos','Arresto']]) {
    for (const record of store.read(name) || []) {
      if (!recordBelongsTo(record,id,documents)) continue;
      add(name,record.id,record.createdAt,`${label} registrada`, 'Tienes un nuevo registro en tu expediente.', 'fines');
      if (name === 'multas' && record.estado === 'PAGADA' && record.payment?.at)
        add('payment',record.id,record.payment.at,'Pago de multa confirmado','El pago fue confirmado. Consulta el detalle en tu expediente.','fines');
    }
  }
  for (const sanction of store.read('sanciones')?.[id]?.sanctions || []) {
    if (['aceptada','rechazada'].includes(sanction.appeal?.status))
      add('appeal',sanction.appeal.id || sanction.id,sanction.appeal.decidedAt,'Apelación resuelta',`Tu apelación fue ${sanction.appeal.status}.`,'fines', { type: 'sanction', id: String(sanction.id) });
  }
  for (const ticket of Object.values(store.read('tickets')?.items || {})) {
    if (String(ticket.userId) !== id) continue;
    add('ticket.created',ticket.id,ticket.createdAt,'Ticket abierto','Tu solicitud de soporte está registrada.','support');
    if (ticket.claimedBy) add('ticket.claimed',ticket.id,ticket.claimedAt,'Ticket asignado','Un miembro del equipo está atendiendo tu ticket.','support');
    if (ticket.status === 'cerrado') add('ticket.closed',ticket.id,ticket.closedAt,'Ticket cerrado','Tu ticket de soporte fue cerrado. Puedes consultar su historial.','support');
    if (ticket.lastReplyBy && String(ticket.lastReplyBy) !== id)
      add('ticket.reply',ticket.id,ticket.lastReplyAt,'Nueva respuesta de soporte','Hay una respuesta nueva en tu ticket.','support');
  }
  for (const [index, license] of (store.read('licencias')?.[id] || []).entries()) {
    const expiry = license.expiresAt || license.fechaVencimiento || license.vence;
    if (typeof expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(expiry)) continue;
    const timestamp = Date.parse(expiry);
    if (!Number.isFinite(timestamp) || timestamp - now > 7 * 86400000 || String(license.estado).toLowerCase() === 'inactiva') continue;
    add('license.expiry',license.id || `${license.tipo}:${index}`,new Date(timestamp - 7 * 86400000).toISOString(), timestamp <= now ? 'Licencia vencida' : 'Licencia próxima a vencer',`Revisa el vencimiento de tu licencia ${String(license.tipo || '').slice(0,30)}.`,'personal', { type: 'license', id: require('./citizen-assets').licenseId(license) });
  }
  let corrections = [];
  try { corrections = store.read('profileCorrections'); } catch { /* Older data schema has no requests. */ }
  for (const correction of corrections || []) {
    if (String(correction.userId) !== id || !['approved','rejected'].includes(correction.status)) continue;
    add('profile.correction',correction.id,correction.reviewedAt,'Corrección de perfil resuelta',`Tu solicitud fue ${correction.status === 'approved' ? 'aprobada' : 'rechazada'}.`,'personal');
  }
  let renewals = [];
  try { renewals = store.read('assetRenewals') || []; } catch { /* Upgrade with no asset requests yet. */ }
  for (const row of renewals) if (String(row.userId) === id && ['approved','rejected'].includes(row.status))
    add('license.renewal', row.id, row.reviewedAt, 'Renovación de licencia resuelta', `Tu solicitud fue ${row.status === 'approved' ? 'aprobada' : 'rechazada'}.`, 'personal', { type: 'license', id: row.licenseId });
  return events.sort((a,b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id)).slice(0,MAX_EVENTS);
}
function list(user) {
  const events = ownEvents(user), read = new Set(readState(user).map(m => m.id));
  return { success: true, items: events.slice(0,100).map(event => ({...event, read: read.has(event.id)})), unread: events.filter(event => !read.has(event.id)).length };
}
function markRead(user, body) {
  if (!body || (!Array.isArray(body.ids) && body.all !== true) || (body.ids && (body.ids.length > 100 || body.ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)))))
    throw Object.assign(Error('Selecciona notificaciones válidas.'),{status:400});
  const id = userId(user), events = ownEvents(user);
  const wanted = body.all === true ? events.map(e => e.id) : body.ids;
  const owned = new Set(events.map(e => e.id));
  if (wanted.some(event => !owned.has(event))) throw Object.assign(Error('Notificación no encontrada.'),{status:404});
  prune(); const db = database();
  db.exec('BEGIN IMMEDIATE');
  try {
    const insert = db.prepare('INSERT OR REPLACE INTO read_markers(user_id,event_id,read_at) VALUES(?,?,?)');
    for (const event of wanted) insert.run(id,event,Date.now());
    db.prepare('DELETE FROM read_markers WHERE user_id=? AND event_id NOT IN (SELECT event_id FROM read_markers WHERE user_id=? ORDER BY read_at DESC LIMIT 500)').run(id,id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return list(user);
}
function mountCitizenNotifications(app, {auth,wrap}) {
  app.get('/api/profile/notifications',auth,wrap((req,res) => res.json(list(req.user))));
  app.post('/api/profile/notifications/read',auth,wrap((req,res) => res.json(markRead(req.user,req.body))));
}
module.exports = {mountCitizenNotifications,ownEvents,notificationReadState:readState,list,markRead};
