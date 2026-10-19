/* Citizen assets are read from their canonical owner; renewal is a reviewed request. */
'use strict';
const crypto = require('node:crypto');
const fail = (message, status = 400) => Object.assign(Error(message), { status });
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function licenseId(license) { return String(license.id || 'license-' + hash([license.tipo || '', license.createdAt || license.fechaExpedicion || '']).slice(0, 24)); }
function explicitExpiry(license) { return license.expiresAt || license.fechaVencimiento || license.vence || null; }
function mountCitizenAssets(app, { auth, wrap, assertSession, store = require('./store') }) {
  const owner = req => { const id = req.user?.discordId; if (req.user?.mode !== 'discord' || !/^\d{17,20}$/.test(id || '')) throw fail('Inicia sesión con Discord.', 401); return id; };
  const guard = req => { owner(req); if (assertSession) assertSession(req); };
  const admin = (req, res, next) => req.user?.isAdmin ? next() : next(fail('Solo administración puede revisar renovaciones.', 403));
  const citizenFor = id => Object.values(store.read('cedulas') || {}).filter(c => c?.discordId === id);
  function assets(id) {
    const citizens = citizenFor(id);
    if (citizens.length !== 1) throw fail('Registra un único personaje antes de consultar sus bienes.', 409);
    return { citizen: citizens[0], vehicles: store.read('vehiculos')?.[id] || [], licenses: store.read('licencias')?.[id] || [] };
  }
  const visible = ({ baseline, ...row }) => row;
  app.get('/api/profile/assets', auth, wrap((req, res) => {
    guard(req); const id = owner(req), { vehicles, licenses } = assets(id);
    const safe = (record, names) => Object.fromEntries(names.filter(k => record[k] !== undefined).map(k => [k, record[k]]));
    res.json({ success: true, vehicles: vehicles.map(v => safe(v, ['id', 'placa', 'modelo', 'marca', 'color', 'estado', 'createdAt'])), licenses: licenses.map(l => ({ ...safe(l, ['tipo', 'estado', 'createdAt', 'fechaExpedicion', 'expiresAt', 'fechaVencimiento', 'vence']), id: licenseId(l) })), renewals: (store.read('assetRenewals') || []).filter(r => r.userId === id).slice(-100).reverse().map(visible) });
  }));
  app.post('/api/profile/licenses/:id/renewal', auth, wrap((req, res) => {
    guard(req); const id = owner(req), reason = req.body?.reason;
    if (typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 1000 || /[\u0000-\u001f\u007f]/u.test(reason)) throw fail('Explica tu solicitud con entre 10 y 1000 caracteres.');
    const row = store.transaction(() => {
      const { citizen, licenses } = assets(id), matches = licenses.filter(l => licenseId(l) === req.params.id);
      if (matches.length !== 1) throw fail('Licencia no encontrada o referencia ambigua.', 404);
      const license = matches[0], rows = store.read('assetRenewals') || [];
      if (rows.some(r => r.userId === id && r.licenseId === req.params.id && r.status === 'pending')) throw fail('Esta licencia ya tiene una renovación pendiente.', 409);
      if (rows.filter(r => r.userId === id && Date.parse(r.createdAt) > Date.now() - 86400000).length >= 5) throw fail('Has alcanzado el límite diario de solicitudes.', 429);
      if (rows.length >= 20000) throw fail('No se pueden recibir nuevas solicitudes. Contacta con administración.', 503);
      const row = { id: crypto.randomUUID(), userId: id, citizenNumber: citizen.numeroCedula, licenseId: licenseId(license), licenseType: String(license.tipo || ''), previousExpiry: explicitExpiry(license), reason: reason.trim(), baseline: hash(license), status: 'pending', createdAt: new Date().toISOString() };
      rows.push(row); store.write('assetRenewals', rows); store.audit(id, 'license.renewal.request', { id: row.id, licenseId: row.licenseId }); return row;
    });
    res.status(201).json({ success: true, item: visible(row), message: 'Solicitud enviada. La licencia no cambia hasta que administración apruebe la renovación.' });
  }));
  app.get('/api/staff/license-renewals', auth, admin, wrap((req, res) => { guard(req); res.json({ success: true, items: (store.read('assetRenewals') || []).slice().reverse().map(visible) }); }));
  app.post('/api/staff/license-renewals/:id/decision', auth, admin, wrap((req, res) => {
    guard(req); const reviewer = owner(req), { approve, note, expiresAt } = req.body || {};
    if (typeof approve !== 'boolean' || typeof note !== 'string' || note.trim().length < 5 || note.trim().length > 1000 || /[\u0000-\u001f\u007f]/u.test(note)) throw fail('Indica la decisión y una observación entre 5 y 1000 caracteres.');
    let expiry;
    if (approve) {
      if (typeof expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) throw fail('Indica la nueva fecha de vencimiento.');
      expiry = new Date(expiresAt + 'T23:59:59.999Z');
      if (!Number.isFinite(expiry.valueOf()) || expiry.toISOString().slice(0, 10) !== expiresAt || expiry.valueOf() <= Date.now() || expiry.valueOf() > Date.now() + 10 * 366 * 86400000) throw fail('La vigencia debe ser una fecha futura de hasta diez años.');
    }
    const item = store.transaction(() => {
      const rows = store.read('assetRenewals') || [], row = rows.find(r => r.id === req.params.id);
      if (!row) throw fail('Solicitud no encontrada.', 404);
      if (row.userId === reviewer) throw fail('Otro administrador debe revisar tu renovación.', 403);
      if (row.status !== 'pending') throw fail('La solicitud ya fue revisada.', 409);
      if (approve) {
        const { citizen, licenses } = assets(row.userId), matches = licenses.filter(l => licenseId(l) === row.licenseId);
        if (citizen.numeroCedula !== row.citizenNumber || matches.length !== 1 || hash(matches[0]) !== row.baseline) throw fail('El personaje o la licencia cambió. Rechaza esta solicitud y pide una nueva.', 409);
        const oldExpiry = explicitExpiry(matches[0]);
        if (oldExpiry && Number.isFinite(Date.parse(oldExpiry)) && expiry.valueOf() <= Date.parse(oldExpiry)) throw fail('La nueva fecha debe ampliar la vigencia actual.');
        matches[0].renewalHistory = [...(matches[0].renewalHistory || []), { requestId: row.id, previousExpiry: oldExpiry, expiresAt: expiry.toISOString(), reviewedAt: new Date().toISOString(), reviewerId: reviewer }];
        matches[0].expiresAt = expiry.toISOString(); matches[0].estado = 'Activa';
        const all = store.read('licencias'); all[row.userId] = licenses; store.write('licencias', all);
      }
      Object.assign(row, { status: approve ? 'approved' : 'rejected', note: note.trim(), reviewerId: reviewer, reviewedAt: new Date().toISOString(), ...(approve ? { expiresAt: expiry.toISOString() } : {}) });
      store.write('assetRenewals', rows); store.audit(reviewer, 'license.renewal.' + row.status, { id: row.id, userId: row.userId }); return row;
    });
    res.json({ success: true, item: visible(item) });
  }));
}
module.exports = { mountCitizenAssets, licenseId, explicitExpiry };
