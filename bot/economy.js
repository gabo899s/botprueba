'use strict';
const crypto = require('node:crypto');
const defaultStore = require('../lib/store');
const domain = require('./domain');
const pending = attempt => ['en-proceso', 'no-confirmado'].includes(attempt?.status);
const inactive = fine => ['PAGADA', 'ANULADA', 'ANULADO', 'CANCELADA', 'CANCELADO', 'RECTIFICADA', 'RECTIFICADO'].includes(String(fine.estado).toUpperCase()) || !!fine.payment;
function money(value) { return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER; }
function citizenNumber(fine) { return fine.documento || fine.numeroCedula || null; }
function assertFineCitizen(store, fine, id) {
  const numbers = [fine.documento, fine.numeroCedula].filter(value => value !== undefined && value !== null && value !== '');
  // Older fines have no character number and retain explicit Discord ownership.
  if (!numbers.length) return;
  const citizens = Object.values(store.read('cedulas') || {}).filter(c => c?.discordId === id);
  if (citizens.length !== 1 || !citizens[0].numeroCedula || numbers.some(number => String(number) !== String(citizens[0].numeroCedula)))
    throw domain.error('La multa pertenece a otro personaje o su identidad cambió. Solicita revisión del archivo original.', 409);
}
function history(fine, attempt) {
  fine.paymentHistory ||= [];
  const index = fine.paymentHistory.findIndex(row => row.id === attempt.id);
  if (index < 0) fine.paymentHistory.push(structuredClone(attempt)); else fine.paymentHistory[index] = structuredClone(attempt);
}
/* PATCH is the provider's balance increment, not an atomic multi-account transfer.
 * Persist BEFORE sending it. A timeout/5xx/429 may have charged: never retry it. */
async function pay(ctx, fineId, options = {}) {
  const { fetchImpl = global.fetch, token = process.env.UNBELIEVABOT_TOKEN, guild = process.env.DISCORD_GUILD_ID, store = defaultStore, assertSession = () => {}, requestId = crypto.randomUUID(), source = 'discord' } = options;
  if (!token || !guild) throw domain.error('Economía no configurada. Solicita validación manual.', 503);
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) throw domain.error('Referencia de solicitud inválida.');
  assertSession();
  const fine = store.update('multas', rows => {
    const r = rows.find(row => row.id === fineId);
    if (!r || r.userId !== ctx.id) throw domain.error('Multa no encontrada.', 404);
    assertFineCitizen(store, r, ctx.id);
    const prior = rows.flatMap(row => (row.paymentHistory || []).map(attempt => ({ fine: row, attempt }))).find(row => row.fine.userId === ctx.id && row.attempt.requestId === requestId);
    if (prior) {
      if (prior.fine.id !== fineId) throw domain.error('Esta referencia pertenece a otra multa.', 409);
      return { replay: structuredClone(prior.attempt), id: r.id };
    }
    if (inactive(r)) throw domain.error('La multa ya está pagada o no está vigente.', 409);
    if (rows.some(row => row.userId === ctx.id && pending(row.paymentAttempt))) throw domain.error('Hay un pago en proceso o sin confirmar. Solicita revisión; no lo repitas.', 409);
    if (!money(r.monto) || r.monto <= 0) throw domain.error('El importe registrado no es válido.', 409);
    if ((r.paymentHistory || []).length >= 50) throw domain.error('Esta multa requiere revisión del personal antes de otro intento.', 409);
    r.paymentAttempt = { id: crypto.randomUUID(), requestId, reference: 'MAES-' + crypto.randomUUID(), fineId, userId: ctx.id, amount: r.monto, source, at: new Date().toISOString(), status: 'en-proceso', phase: 'consulta' };
    history(r, r.paymentAttempt);
    store.audit(ctx.id, 'economy.payment.intent', { fineId, reference: r.paymentAttempt.reference, amount: r.monto, source });
    return structuredClone(r);
  });
  if (fine.replay) return { success: fine.replay.status === 'confirmado', replay: true, attempt: fine.replay };
  const url = `https://unbelievaboat.com/api/v1/guilds/${encodeURIComponent(guild)}/users/${encodeURIComponent(ctx.id)}`;
  const headers = { Authorization: token, 'Content-Type': 'application/json' };
  let debiting = false;
  const mutate = fn => store.update('multas', rows => {
    const r = rows.find(row => row.id === fineId);
    if (!r || r.userId !== ctx.id || r.paymentAttempt?.id !== fine.paymentAttempt.id) throw domain.error('La operación cambió. Se requiere revisión administrativa.', 409);
    fn(r); history(r, r.paymentAttempt); return structuredClone(r.paymentAttempt);
  });
  try {
    const balance = await fetchImpl(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!balance.ok) throw domain.error('No se pudo consultar tu saldo de rol.', 503);
    const body = await balance.json();
    assertSession();
    if (!money(body?.cash) || body.cash < fine.monto) throw domain.error('Saldo de efectivo insuficiente o inválido.');
    mutate(r => {
      if (inactive(r) || r.monto !== fine.monto || citizenNumber(r) !== citizenNumber(fine)) throw domain.error('La multa cambió antes del cobro. Actualiza el panel.', 409);
      assertFineCitizen(store, r, ctx.id);
      r.paymentAttempt.phase = 'cobro'; r.paymentAttempt.cashBefore = body.cash;
    });
    debiting = true;
    const response = await fetchImpl(url, { method: 'PATCH', headers, body: JSON.stringify({ cash: -fine.monto, reason: `Pago de multa Maes RP ${fine.id} · ${fine.paymentAttempt.reference}` }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      if (response.status >= 400 && response.status < 500 && ![408, 409, 425, 429].includes(response.status)) debiting = false;
      throw domain.error('El proveedor no confirmó el cobro.', 503);
    }
    // Persist a confirmed provider response even when the browser session closed.
    const attempt = mutate(r => {
      r.estado = 'PAGADA'; r.paymentAttempt.status = 'confirmado'; r.paymentAttempt.finishedAt = new Date().toISOString();
      r.payment = { via: 'UnbelievaBoat', at: r.paymentAttempt.finishedAt, reference: r.paymentAttempt.reference, amount: fine.monto };
      if (r.paymentRequested) { r.paymentRequested.status = 'confirmado'; r.paymentRequested.confirmedAt = r.payment.at; }
      store.audit(ctx.id, 'economy.payment.confirmed', { fineId, reference: r.paymentAttempt.reference, amount: fine.monto });
    });
    assertSession();
    return { success: true, attempt };
  } catch (error) {
    // A successful debit was already durably committed. Logout must not turn it uncertain.
    const current = store.read('multas').find(r => r.id === fineId);
    if (current?.userId === ctx.id && current.paymentAttempt?.id === fine.paymentAttempt.id && current.paymentAttempt.status === 'confirmado') throw error;
    mutate(r => {
      r.paymentAttempt.status = debiting ? 'no-confirmado' : 'rechazado'; r.paymentAttempt.finishedAt = new Date().toISOString();
      store.audit(ctx.id, 'economy.payment.' + r.paymentAttempt.status, { fineId, reference: r.paymentAttempt.reference });
    });
    if (error.status === 401) throw error;
    throw domain.error(debiting ? 'No se pudo confirmar el cobro. No lo repitas: el personal debe revisar la operación.' : error.message, debiting ? 409 : error.status || 503);
  }
}
module.exports = { pay, pending, money };
