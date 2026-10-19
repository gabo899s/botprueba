'use strict';
const economy = require('../bot/economy');
const crypto = require('node:crypto');
const fail = (message, status = 400) => Object.assign(Error(message), { status });
const disabled = Object.freeze({ deposit: { enabled: false, reason: 'El proveedor no ofrece una transacción condicional confirmada para mover efectivo y banco sin riesgo de duplicados.' }, withdraw: { enabled: false, reason: 'El retiro queda pendiente de una integración con conciliación y garantía de atomicidad.' }, transfer: { enabled: false, reason: 'Una transferencia requiere debitar y acreditar dos cuentas de forma atómica; esta integración no lo garantiza.' } });
const visible = attempt => Object.fromEntries(['id', 'reference', 'fineId', 'amount', 'status', 'source', 'at', 'finishedAt', 'reviewedAt', 'reviewReference', 'reviewNote', 'resolution'].filter(key => attempt[key] !== undefined).map(key => [key, attempt[key]]));
function mountCitizenEconomy(app, { auth, wrap, assertSession = () => {}, store = require('./store'), fetchImpl = global.fetch, token, guild, pay = economy.pay }) {
  const queries = new Map();
  function queryBudget(id) { const now = Date.now(); if (queries.size > 5000) for (const [key, value] of queries) if (now - value.start > 30000) queries.delete(key); const entry = queries.get(id); if (entry && now - entry.start < 30000) { if (++entry.count > 20) throw fail('Espera unos segundos antes de volver a consultar tu saldo.', 429); } else { if (queries.size >= 10000) throw fail('Las consultas de economía están ocupadas. Inténtalo más tarde.', 503); queries.set(id, { start: now, count: 1 }); } }
  const configuration = () => ({ token: token ?? process.env.UNBELIEVABOT_TOKEN, guild: guild ?? process.env.DISCORD_GUILD_ID });
  const owner = req => { const id = req.user?.discordId; if (req.user?.mode !== 'discord' || !/^\d{17,20}$/.test(id || '')) throw fail('Inicia sesión con Discord.', 401); return id; };
  const guard = req => { owner(req); assertSession(req); };
  const supervisor = (req, res, next) => req.user?.isAdmin && req.user?.hasPoliceAccess ? next() : next(fail('La revisión requiere administración y acceso policial.', 403));
  function citizen(id) { const rows = Object.values(store.read('cedulas') || {}).filter(c => c?.discordId === id); if (rows.length !== 1) throw fail('Registra un único personaje antes de consultar la economía.', 409); return rows[0]; }
  function owned(id) { const c = citizen(id); return store.read('multas').filter(f => f.userId === id && (!(f.documento || f.numeroCedula) || (f.documento || f.numeroCedula) === c.numeroCedula)); }
  const attempts = rows => rows.flatMap(f => (f.paymentHistory?.length ? f.paymentHistory : f.paymentAttempt ? [{ ...f.paymentAttempt, id: f.paymentAttempt.id || 'legacy-' + crypto.createHash('sha256').update(f.id).digest('hex').slice(0, 24), fineId: f.id, amount: f.monto }] : []).map(a => ({ ...a, fineId: f.id }))).sort((a,b) => String(b.at).localeCompare(String(a.at)));
  const validFine = fine => !fine.payment && !['PAGADA', 'ANULADA', 'ANULADO', 'CANCELADA', 'CANCELADO', 'RECTIFICADA', 'RECTIFICADO'].includes(String(fine.estado).toUpperCase()) && economy.money(fine.monto) && fine.monto > 0;
  app.get('/api/profile/economy', auth, wrap(async (req, res) => {
    guard(req); const id = owner(req), rows = owned(id), characterNumber = citizen(id).numeroCedula, config = configuration(); queryBudget(id);
    res.set('Cache-Control', 'private, no-store');
    const base = { success: true, currency: 'Dinero ficticio del rol', operations: disabled, history: attempts(rows).slice(0, 200).map(visible), fines: rows.filter(validFine).map(f => ({ id: f.id, amount: f.monto, status: f.estado, pending: economy.pending(f.paymentAttempt) })), provider: 'UnbelievaBoat', historyNotice: 'Solo se muestran pagos de multas registrados por Maes RP. No es el historial completo del proveedor.', balanceNotice: 'El saldo es una consulta puntual; puede cambiar en Discord o en otras aplicaciones.' };
    if (!config.token || !config.guild) return res.json({ ...base, available: false, message: 'La economía del servidor aún no está configurada. No se ha consultado ni creado un saldo.' });
    let body;
    try {
      const response = await fetchImpl(`https://unbelievaboat.com/api/v1/guilds/${encodeURIComponent(config.guild)}/users/${encodeURIComponent(id)}`, { headers: { Authorization: config.token }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('provider'); body = await response.json();
    } catch { guard(req); return res.json({ ...base, available: false, message: 'El proveedor no respondió. Tus saldos anteriores no se muestran como actuales.' }); }
    guard(req);
    if (citizen(id).numeroCedula !== characterNumber) throw fail('El personaje cambió durante la consulta. Actualiza el panel.', 409);
    if (!economy.money(body?.cash) || !economy.money(body?.bank)) return res.json({ ...base, available: false, message: 'El proveedor devolvió un saldo inválido. No se ha estimado ningún importe.' });
    res.json({ ...base, available: true, balance: { cash: body.cash, bank: body.bank, at: new Date().toISOString() }, message: 'Saldo consultado directamente al proveedor del servidor.' });
  }));
  app.post('/api/profile/economy/payments', auth, wrap(async (req, res) => {
    guard(req); const id = owner(req), { fineId, requestId } = req.body || {};
    if (typeof fineId !== 'string' || fineId.length > 100 || typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) throw fail('Indica la multa y una referencia de solicitud válida.');
    if (!owned(id).some(f => f.id === fineId)) throw fail('Multa no encontrada.', 404);
    const assertCurrent = () => { guard(req); if (!owned(id).some(f => f.id === fineId)) throw fail('El personaje cambió. Actualiza el panel.', 409); };
    let result;
    try { result = await pay({ id }, fineId, { ...configuration(), store, fetchImpl, source: 'web', requestId, assertSession: assertCurrent }); }
    catch (error) { guard(req); throw error; }
    guard(req); res.set('Cache-Control', 'private, no-store');
    res.status(result.success ? 200 : 409).json({ success: result.success, replay: !!result.replay, item: visible(result.attempt), message: result.success ? 'Pago confirmado por el proveedor. Conserva tu comprobante.' : 'Este intento ya se procesó. Consulta su estado; no repitas un cobro incierto.' });
  }));
  app.get('/api/profile/economy/receipts/:id', auth, wrap((req, res) => {
    guard(req); const item = attempts(owned(owner(req))).find(a => a.id === req.params.id && a.status === 'confirmado');
    if (!item) throw fail('Comprobante no encontrado.', 404);
    res.set('Cache-Control', 'private, no-store'); res.json({ success: true, document: 'Comprobante de pago Maes RP · Documento de ficción, sin validez legal', provider: 'UnbelievaBoat', referenceNotice: 'La referencia Maes identifica la solicitud enviada al proveedor; no es un identificador de transacción emitido por el proveedor.', item: visible(item) });
  }));
  app.get('/api/staff/economy/reviews', auth, supervisor, wrap((req, res) => {
    guard(req); res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, items: store.read('multas').filter(f => economy.pending(f.paymentAttempt)).map(f => ({ fineId: f.id, userId: f.userId, citizenNumber: f.documento || f.numeroCedula, attempt: visible({ ...f.paymentAttempt, fineId: f.id, amount: f.paymentAttempt.amount ?? f.monto }) })) });
  }));
  app.post('/api/staff/economy/reviews/:id', auth, supervisor, wrap((req, res) => {
    guard(req); const reviewer = owner(req), { charged, reference, note, expectedAttemptId } = req.body || {};
    if (typeof charged !== 'boolean' || typeof reference !== 'string' || reference.trim().length < 5 || reference.length > 200 || typeof note !== 'string' || note.trim().length < 15 || note.length > 1500 || /[\u0000-\u001f\u007f]/u.test(reference + note)) throw fail('Indica el resultado verificado, una referencia del proveedor y la evidencia revisada.');
    const result = store.update('multas', rows => {
      const fine = rows.find(f => f.id === req.params.id);
      if (!fine || !economy.pending(fine.paymentAttempt)) throw fail('La operación no está pendiente de revisión.', 409);
      const attempt = fine.paymentAttempt;
      if (fine.userId === reviewer) throw fail('Otro supervisor debe revisar tu operación.', 403);
      if (!expectedAttemptId || expectedAttemptId !== attempt.id) throw fail('La operación cambió o es heredada. Revisa el registro original con el personal técnico.', 409);
      const c = citizen(fine.userId);
      if ((fine.documento || fine.numeroCedula) && (fine.documento || fine.numeroCedula) !== c.numeroCedula || attempt.userId && attempt.userId !== fine.userId) throw fail('El titular del registro cambió. Se requiere revisión del archivo original.', 409);
      if (attempt.status === 'en-proceso' && (!Number.isFinite(Date.parse(attempt.at)) || Date.now() - Date.parse(attempt.at) < 120000)) throw fail('El cobro puede seguir en curso. Espera al menos dos minutos y revisa al proveedor.', 409);
      if (fine.payment || fine.estado === 'PAGADA' || attempt.amount !== fine.monto || !validFine(fine)) throw fail('La multa cambió. Revisa el archivo original.', 409);
      Object.assign(attempt, { status: charged ? 'confirmado' : 'rechazado', resolution: charged ? 'cobro-verificado' : 'sin-cobro-verificado', reviewedAt: new Date().toISOString(), reviewerId: reviewer, reviewReference: reference.trim(), reviewNote: note.trim() });
      if (charged) { fine.estado = 'PAGADA'; fine.payment = { via: 'UnbelievaBoat · revisión manual', at: attempt.reviewedAt, reference: reference.trim(), requestReference: attempt.reference, approvedBy: reviewer, amount: attempt.amount }; if (fine.paymentRequested) fine.paymentRequested.status = 'confirmado'; }
      const index = (fine.paymentHistory || []).findIndex(a => a.id === attempt.id);
      if (index < 0) (fine.paymentHistory ||= []).push(structuredClone(attempt)); else fine.paymentHistory[index] = structuredClone(attempt);
      store.audit(reviewer, 'economy.payment.review', { fineId: fine.id, reference: attempt.reference, providerReference: reference.trim(), charged }); return visible(attempt);
    });
    res.json({ success: true, item: result, message: 'Revisión registrada. Esta acción no envía un nuevo cobro al proveedor.' });
  }));
}
module.exports = { mountCitizenEconomy, disabled, visible };
