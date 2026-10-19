'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { pay } = require('../bot/economy');
const { mountCitizenEconomy } = require('../lib/citizen-economy');
const owner = '111111111111111111', other = '222222222222222222', admin = '333333333333333333';
function memory() {
  let state = { cedulas: { [owner]: { discordId: owner, numeroCedula: 'ONE' }, [other]: { discordId: other, numeroCedula: 'TWO' } }, multas: [{ id: 'fine-one', userId: owner, numeroCedula: 'ONE', monto: 100, estado: 'REGISTRADA' }, { id: 'fine-two', userId: owner, numeroCedula: 'ONE', monto: 20, estado: 'REGISTRADA' }, { id: 'private-fine', userId: other, numeroCedula: 'TWO', monto: 30, estado: 'REGISTRADA' }], audit: [] };
  const store = { read: name => structuredClone(state[name]), write: (name, value) => { state[name] = structuredClone(value); }, transaction(fn) { const before = structuredClone(state); try { return fn(); } catch(e) { state = before; throw e; } }, update(name, fn) { return store.transaction(() => { const value = store.read(name), result = fn(value); store.write(name, value); return result; }); }, audit(actor, action, data) { state.audit.push({ actor, action, data }); } }; return store;
}
const good = async (url, options) => ({ ok: true, status: 200, json: async () => ({ cash: 500, bank: 200 }) });
async function fixture(options = {}) {
  const store = options.store || memory(), app = express(); let valid = true;
  app.use(express.json());
  const auth = (req, res, next) => { const id = req.headers['x-user']; if (!id) return res.status(401).json({ message: 'Sesión requerida' }); req.user = { discordId: id, mode: 'discord', isAdmin: id === admin, hasPoliceAccess: req.headers['x-police'] === '1' }; next(); };
  mountCitizenEconomy(app, { auth, store, token: options.token ?? 'fixture', guild: 'fixture', fetchImpl: options.fetchImpl || good, assertSession() { if (!valid) throw Object.assign(Error('Cerrada'), { status: 401 }); }, wrap: fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next) });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const call = async (url, body, id = owner, headers = {}) => { const response = await fetch('http://127.0.0.1:' + server.address().port + url, { headers: { ...(id ? { 'X-User': id } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) }); return { status: response.status, headers: response.headers, body: await response.json() }; };
  return { store, call, invalidate() { valid = false; }, close: () => new Promise(resolve => server.close(resolve)) };
}
test('economía consulta únicamente saldo real propio y nunca inventa movimientos o saldo sin proveedor', async () => {
  const f = await fixture(); try {
    assert.equal((await f.call('/api/profile/economy', null, null)).status, 401);
    const r = await f.call('/api/profile/economy'); assert.equal(r.status, 200); assert.deepEqual(r.body.balance.cash, 500); assert.equal(r.body.history.length, 0); assert.equal(r.body.fines.length, 2); assert.equal(r.body.operations.transfer.enabled, false); assert.match(r.headers.get('cache-control'), /no-store/); assert.ok(!JSON.stringify(r.body).includes('private-fine'));
  } finally { await f.close(); }
  const absent = await fixture({ token: '' }); try { const r = await absent.call('/api/profile/economy'); assert.equal(r.body.available, false); assert.equal(r.body.balance, undefined); } finally { await absent.close(); }
});
test('pago deriva importe del expediente y repetir requestId no duplica el débito; comprobante es privado', async () => {
  let debits = 0, patch; const f = await fixture({ fetchImpl: async (url, options) => { if (options.method === 'PATCH') { debits++; patch = JSON.parse(options.body); } return good(); } });
  try {
    const body = { fineId: 'fine-one', requestId: 'same-reference-1234567890', amount: 1 };
    const r = await f.call('/api/profile/economy/payments', body); assert.equal(r.status, 200); assert.equal(patch.cash, -100); assert.match(patch.reason, /MAES-/); assert.equal(debits, 1);
    assert.equal((await f.call('/api/profile/economy/payments', body)).status, 200); assert.equal(debits, 1);
    const receipt = '/api/profile/economy/receipts/' + r.body.item.id; assert.equal((await f.call(receipt)).status, 200); assert.equal((await f.call(receipt, null, other)).status, 404);
    assert.equal((await f.call('/api/profile/economy/payments', { fineId: 'private-fine', requestId: 'foreign-fine-request12345' })).status, 404);
    assert.equal(f.store.read('multas')[0].estado, 'PAGADA');
  } finally { await f.close(); }
});
test('cobro incierto bloquea otra multa del mismo titular y solo supervisor doble puede resolver con evidencia', async () => {
  let debits = 0; const f = await fixture({ fetchImpl: async (url, options) => { if (options.method === 'PATCH') { debits++; throw Error('Timeout'); } return good(); } });
  try {
    const body = { fineId: 'fine-one', requestId: 'uncertain-request-123456789' }; assert.equal((await f.call('/api/profile/economy/payments', body)).status, 409); assert.equal(debits, 1);
    assert.equal((await f.call('/api/profile/economy/payments', { fineId: 'fine-two', requestId: 'another-request-12345678' })).status, 409); assert.equal(debits, 1);
    const row = f.store.read('multas')[0]; assert.equal(row.paymentAttempt.status, 'no-confirmado');
    assert.equal((await f.call('/api/staff/economy/reviews', null, admin)).status, 403);
    const review = { expectedAttemptId: row.paymentAttempt.id, charged: true, reference: 'provider-proof-123', note: 'Se verificó en el registro original del proveedor la salida de 100.' };
    assert.equal((await f.call('/api/staff/economy/reviews/fine-one', review, admin, { 'X-Police': '1' })).status, 200); assert.equal(debits, 1); assert.equal(f.store.read('multas')[0].estado, 'PAGADA');
    assert.equal((await f.call('/api/staff/economy/reviews/fine-one', review, admin, { 'X-Police': '1' })).status, 409);
  } finally { await f.close(); }
});
test('sesión cerrada durante consulta no permite debitar ni exponer saldo; cerrada tras débito conserva pago real', async () => {
  const store = memory(); let valid = true, debits = 0;
  await assert.rejects(pay({ id: owner }, 'fine-one', { store, token: 'fixture', guild: 'fixture', requestId: 'revoked-before-debit-1234', assertSession() { if (!valid) throw Object.assign(Error('Cerrada'), { status: 401 }); }, fetchImpl: async () => { valid = false; return good(); } }), { status: 401 });
  assert.equal(store.read('multas')[0].paymentAttempt.status, 'rechazado'); valid = true;
  await assert.rejects(pay({ id: owner }, 'fine-one', { store, token: 'fixture', guild: 'fixture', requestId: 'revoked-after-debit-12345', assertSession() { if (!valid) throw Object.assign(Error('Cerrada'), { status: 401 }); }, fetchImpl: async (url, options) => { if (options.method === 'PATCH') { debits++; valid = false; } return good(); } }), { status: 401 });
  assert.equal(debits, 1); assert.equal(store.read('multas')[0].paymentAttempt.status, 'confirmado'); assert.equal(store.read('multas')[0].estado, 'PAGADA');
  let f; f = await fixture({ fetchImpl: async () => { f.invalidate(); return good(); } }); try { const r = await f.call('/api/profile/economy'); assert.equal(r.status, 401); assert.equal(r.body.balance, undefined); } finally { await f.close(); }
});
test('simultáneos de la misma cuenta no cargan dos veces y ni multas canceladas ni saldo insuficiente se cobran', async () => {
  const store = memory(); let unblock, calls = 0; const gate = new Promise(resolve => { unblock = resolve; }); const fetchImpl = async (url, options) => { calls++; if (!options.method) await gate; return good(); };
  const one = pay({ id: owner }, 'fine-one', { store, token: 'fixture', guild: 'fixture', fetchImpl, requestId: 'concurrent-first-12345678' });
  await assert.rejects(pay({ id: owner }, 'fine-two', { store, token: 'fixture', guild: 'fixture', fetchImpl, requestId: 'concurrent-next-123456789' }), { status: 409 }); unblock(); await one; assert.equal(calls, 2);
  store.update('multas', rows => rows[1].estado = 'ANULADA'); await assert.rejects(pay({ id: owner }, 'fine-two', { store, token: 'fixture', guild: 'fixture', fetchImpl }), { status: 409 }); assert.equal(calls, 2);
  const insufficient = memory(); await assert.rejects(pay({ id: owner }, 'fine-one', { store: insufficient, token: 'fixture', guild: 'fixture', fetchImpl: async () => ({ ok: true, json: async () => ({ cash: 0 }) }) }), /insuficiente/); assert.equal(insufficient.read('multas')[0].paymentAttempt.status, 'rechazado');
});
test('la cédula canónica cambiada no puede mostrar ni resolver operaciones del personaje anterior', async () => {
  const f = await fixture({ fetchImpl: async (url, opts) => { if (opts.method === 'PATCH') throw Error('timeout'); return good(); } });
  try {
    await f.call('/api/profile/economy/payments', { fineId: 'fine-one', requestId: 'old-character-proof-123456' });
    const attempt = f.store.read('multas')[0].paymentAttempt;
    f.store.update('cedulas', rows => { rows[owner].numeroCedula = 'NEW'; });
    assert.equal((await f.call('/api/profile/economy/receipts/' + attempt.id)).status, 404);
    const result = await f.call('/api/profile/economy'); assert.equal(result.body.fines.length, 0); assert.equal(result.body.history.length, 0);
    const review = { expectedAttemptId: attempt.id, charged: true, reference: 'provider-proof-123', note: 'Evidencia revisada con el proveedor de economía.' };
    assert.equal((await f.call('/api/staff/economy/reviews/fine-one', review, admin, { 'X-Police': '1' })).status, 409);
  } finally { await f.close(); }
});
test('saldo inválido nunca aparece como cero y el límite local evita consultas abusivas', async () => {
  let calls = 0; const f = await fixture({ fetchImpl: async () => { calls++; return { ok: true, json: async () => null }; } });
  try {
    const result = await f.call('/api/profile/economy'); assert.equal(result.status, 200); assert.equal(result.body.available, false); assert.equal(result.body.balance, undefined);
    for (let i = 0; i < 19; i++) await f.call('/api/profile/economy');
    assert.equal((await f.call('/api/profile/economy')).status, 429); assert.equal(calls, 20);
  } finally { await f.close(); }
});
test('el cobro compartido bot/automático rechaza personaje anterior antes del intento y revalida tras consultar saldo', async () => {
  const changed = memory(); changed.update('cedulas', rows => { rows[owner].numeroCedula = 'NEW'; }); let calls = 0;
  await assert.rejects(pay({ id: owner }, 'fine-one', { store: changed, token: 'fixture', guild: 'fixture', fetchImpl: async () => { calls++; return good(); } }), { status: 409 });
  assert.equal(calls, 0); assert.equal(changed.read('multas')[0].paymentAttempt, undefined);
  const race = memory(); let debits = 0;
  await assert.rejects(pay({ id: owner }, 'fine-one', { store: race, token: 'fixture', guild: 'fixture', fetchImpl: async (url, options) => {
    if (options.method === 'PATCH') debits++; else race.update('cedulas', rows => { rows[owner].numeroCedula = 'NEW'; }); return good();
  } }), { status: 409 });
  assert.equal(debits, 0); assert.equal(race.read('multas')[0].paymentAttempt.status, 'rechazado'); assert.equal(race.read('multas')[0].estado, 'REGISTRADA');
  const documentField = memory(); documentField.update('multas', rows => { rows[0].documento = 'OLD'; delete rows[0].numeroCedula; });
  await assert.rejects(pay({ id: owner }, 'fine-one', { store: documentField, token: 'fixture', guild: 'fixture', fetchImpl: good }), { status: 409 });
  const legacy = memory(); legacy.update('multas', rows => { delete rows[0].numeroCedula; }); legacy.update('cedulas', rows => { delete rows[owner]; });
  assert.equal((await pay({ id: owner }, 'fine-one', { store: legacy, token: 'fixture', guild: 'fixture', fetchImpl: good })).success, true);
});
