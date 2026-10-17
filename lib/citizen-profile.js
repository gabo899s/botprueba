const crypto = require('node:crypto');
const defaultStore = require('./store');
const FIELDS = Object.freeze({ nombre: 80, apellidos: 100, fechaNacimiento: 10, nacionalidad: 50, sexo: 20, estatura: 20, provincia: 50, grupoSanguineo: 3 });
const fail = (message, status = 400) => Object.assign(Error(message), { status });
function clean(value, max, label, optional = false) {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw fail(`${label}: valor inválido.`);
  return value.trim();
}
function snapshot(c) {
  return JSON.stringify([c.discordId, c.numeroCedula, c.createdAt || '', ...Object.keys(FIELDS).map(key => c[key] || '')]);
}
function validateChanges(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Object.keys(input).length || Object.keys(input).some(key => !Object.hasOwn(FIELDS, key))) throw fail('Selecciona únicamente los datos de tu personaje que quieres corregir.');
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const v = clean(value, FIELDS[key], key);
    if (key === 'fechaNacimiento') {
      const d = new Date(v + 'T00:00:00Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v || v < '1900-01-01' || d.getTime() > Date.now()) throw fail('La fecha de nacimiento del personaje no es válida.');
    }
    if (key === 'grupoSanguineo' && !/^(A|B|AB|O)[+-]$/.test(v)) throw fail('Grupo sanguíneo inválido.');
    if (key === 'estatura' && !/^\d{2,3}(?:[.,]\d)?(?:\s?cm)?$/i.test(v)) throw fail('Escribe la estatura del personaje en centímetros.');
    if (key === 'estatura' && (Number(v.replace(/\s?cm/i, '').replace(',', '.')) < 50 || Number(v.replace(/\s?cm/i, '').replace(',', '.')) > 250)) throw fail('La estatura debe estar entre 50 y 250 cm.');
    out[key] = v;
  }
  return out;
}
function mountCitizenProfile(app, { auth, wrap, sessions, remote, renewDiscordToken, publicUser, assertSession, store = defaultStore }) {
  const refreshTimes = new Map();
  function user(req) {
    const id = req.user?.discordId;
    if (!id || req.user.mode !== 'discord') throw fail('Inicia sesión con Discord.', 401);
    return id;
  }
  function current(req) {
    const session = sessions.get(req.sid);
    if (!session || session.expires <= Date.now() || session.user !== req.user) throw fail('La sesión se cerró. Vuelve a iniciar sesión.', 401);
    return session;
  }
  function ownCitizen(id) { return Object.values(store.read('cedulas')).find(c => c?.discordId === id) || null; }
  function admin(req, res, next) { if (req.user?.isAdmin) next(); else next(fail('Solo administración puede revisar estas solicitudes.', 403)); }
  const visible = row => {
    const { baseline, ...item } = row;
    return item;
  };
  app.post('/api/profile/discord/refresh', auth, wrap(async (req, res) => {
    const id = user(req), session = current(req), now = Date.now();
    if (refreshTimes.size > 5000) for (const [key, at] of refreshTimes) if (now - at >= 30000) refreshTimes.delete(key);
    if (now - (refreshTimes.get(id) || 0) < 30000) { res.set('Retry-After', '30'); throw fail('Espera 30 segundos antes de actualizar Discord de nuevo.', 429); }
    if (!session.oauth?.accessToken) throw fail('Vuelve a iniciar sesión para actualizar tu cuenta.', 401);
    refreshTimes.set(id, now);
    let profile;
    try {
      await renewDiscordToken(session);
      if (assertSession) assertSession(req);
      if (current(req) !== session) throw fail('La sesión se cerró.', 401);
      profile = await remote('https://discord.com/api/v10/users/@me', { headers: { Authorization: 'Bearer ' + session.oauth.accessToken } });
    } catch (error) { throw fail(error.status === 401 ? 'Vuelve a iniciar sesión con Discord.' : 'Discord no pudo actualizar tu perfil. Inténtalo más tarde.', error.status === 401 ? 401 : 503); }
    if (assertSession) assertSession(req);
    if (current(req) !== session) throw fail('La sesión se cerró.', 401);
    if (profile?.id !== id || !/^\d{17,20}$/.test(profile.id)) throw fail('Discord no pudo confirmar tu identidad.', 403);
    const username = clean(profile.username, 64, 'Nombre de Discord');
    const display = clean(profile.global_name || username, 100, 'Nombre de Discord');
    const avatar = profile.avatar;
    if (avatar !== null && avatar !== undefined && !/^(?:a_)?[a-f0-9]{16,64}$/.test(avatar)) throw fail('Discord devolvió una imagen inválida.', 502);
    const previous = session.user;
    session.user = { ...previous, discordUsername: username, discordAvatar: avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}` : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(id) >> 22n) % 6n)}.png`, nombreCompleto: display };
    try { sessions.save(req.sid); } catch (error) { session.user = previous; throw error; }
    req.user = session.user;
    res.json({ success: true, user: publicUser(session.user), message: 'Tu perfil de Discord se actualizó.' });
  }));
  app.get('/api/profile/corrections', auth, wrap(async (req, res) => {
    const id = user(req);
    res.json({ success: true, items: store.read('profileCorrections').filter(row => row.userId === id).slice().reverse().map(visible) });
  }));
  app.post('/api/profile/corrections', auth, wrap(async (req, res) => {
    const id = user(req), changes = validateChanges(req.body.changes), reason = clean(req.body.reason, 1000, 'Motivo');
    if (reason.length < 10) throw fail('Explica el cambio con al menos 10 caracteres.');
    const row = store.transaction(() => {
      const citizen = ownCitizen(id);
      if (!citizen) throw fail('Primero registra tu personaje mediante el bot o el staff.', 409);
      const actual = Object.fromEntries(Object.entries(changes).filter(([key, value]) => value !== (citizen[key] || '')));
      if (!Object.keys(actual).length) throw fail('No hay cambios respecto a tu personaje actual.');
      const rows = store.read('profileCorrections');
      if (rows.some(row => row.userId === id && row.status === 'pending')) throw fail('Ya tienes una solicitud pendiente de revisión.', 409);
      const last = rows.filter(row => row.userId === id).at(-1);
      if (last && Date.now() - new Date(last.createdAt).getTime() < 60000) throw fail('Espera un minuto antes de enviar otra solicitud.', 429);
      if (rows.length >= 20000) throw fail('El archivo de solicitudes está lleno. Contacta con administración.', 503);
      const item = { id: crypto.randomUUID(), userId: id, citizenNumber: citizen.numeroCedula, changes: actual, previous: Object.fromEntries(Object.keys(actual).map(key => [key, citizen[key] || ''])), reason, baseline: snapshot(citizen), status: 'pending', createdAt: new Date().toISOString() };
      rows.push(item); store.write('profileCorrections', rows);
      store.audit(id, 'profile.correction.request', { id: item.id, fields: Object.keys(actual) });
      return item;
    });
    res.status(201).json({ success: true, item: visible(row), message: 'Solicitud enviada. Tus datos cambiarán únicamente cuando administración la apruebe.' });
  }));
  app.get('/api/staff/profile-corrections', auth, admin, wrap(async (req, res) => {
    res.json({ success: true, items: store.read('profileCorrections').slice().reverse().map(visible) });
  }));
  app.post('/api/staff/profile-corrections/:id/decision', auth, admin, wrap(async (req, res) => {
    const reviewer = user(req), { approve } = req.body;
    if (typeof approve !== 'boolean') throw fail('Decisión inválida.');
    const note = clean(req.body.note, 1000, 'Observación', approve);
    const item = store.transaction(() => {
      const rows = store.read('profileCorrections'), row = rows.find(item => item.id === req.params.id);
      if (!row) throw fail('Solicitud no encontrada.', 404);
      if (row.userId === reviewer) throw fail('Otro administrador debe revisar tu solicitud.', 403);
      if (row.status !== 'pending') throw fail('Esta solicitud ya fue revisada.', 409);
      if (approve) {
        const all = store.read('cedulas');
        const entries = Object.entries(all).filter(([, c]) => c?.discordId === row.userId);
        if (entries.length !== 1 || snapshot(entries[0][1]) !== row.baseline) throw fail('El personaje cambió desde la solicitud. Recházala y solicita una nueva.', 409);
        const changes = validateChanges(row.changes), [key, citizen] = entries[0];
        all[key] = { ...citizen, ...changes }; store.write('cedulas', all);
      }
      Object.assign(row, { status: approve ? 'approved' : 'rejected', reviewerId: reviewer, reviewedAt: new Date().toISOString(), note });
      store.write('profileCorrections', rows);
      store.audit(reviewer, 'profile.correction.' + row.status, { id: row.id, userId: row.userId, fields: Object.keys(row.changes) });
      return row;
    });
    res.json({ success: true, item: visible(item) });
  }));
}
module.exports = { mountCitizenProfile, validateChanges };
