const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { mountCitizenAccount } = require('../lib/citizen-account');
const owner = '123456789012345678', outsider = '223456789012345678';
const tag = (sid, userId = owner) => crypto.createHash('sha256').update('account-session:' + userId + ':' + sid).digest('hex');
async function fixture(t, options = {}) {
  const app = express(); app.use(express.json());
  let data = {
    cedulas: {
      'RP-OWN': { numeroCedula: 'RP-OWN', discordId: owner, nombre: 'Ana', apellidos: 'Ejemplo', roblox: { userId: '77', username: 'AnaEjemplo', avatarUrl: 'https://example.test/headshot.png', verified: true }, createdAt: '2026-01-01' },
      'RP-OTHER': { numeroCedula: 'RP-OTHER', discordId: outsider, nombre: 'Otro', roblox: { userId: '88' } },
    },
    multas: [{ id: 'm1', userId: owner, documento: 'RP-OWN', estado: 'REGISTRADA' }],
    arrestos: [{ id: 'a1', userId: owner, documento: 'RP-OWN' }],
    vehiculos: { [owner]: [{ placa: 'ABC123' }] }, licencias: { [owner]: [{ tipo: 'B1' }] }, audit: [],
  };
  const store = {
    read: name => structuredClone(data[name]),
    write: (name, value) => { data[name] = structuredClone(value); },
    transaction(fn) { const before = structuredClone(data); try { return fn(); } catch (error) { data = before; throw error; } },
    audit(actor, action, details) { if (options.failAudit) throw Error('simulated-audit-failure'); data.audit.push({ actor, action, details }); },
  };
  const sessions = new Map();
  const session = (id, browser, expires = Date.now() + 3600000) => ({ user: { id, discordId: id, mode: 'discord', email: 'private@example.test' }, expires, oauth: { accessToken: 'private-access-token', refreshToken: 'private-refresh-token' }, meta: { browser, createdAt: '2026-10-17T00:00:00Z', lastSeenAt: '2026-10-18T00:00:00Z', internal: 'private-meta' } });
  sessions.set('private-current-session', session(owner, 'Firefox'));
  sessions.set('private-second-session', session(owner, 'Chromium'));
  sessions.set('private-other-session', session(outsider, 'Safari'));
  sessions.set('private-expired-session', session(owner, 'Navegador expirado', Date.now() - 1));
  const auth = (req, res, next) => {
    req.sid = req.get('Test-Session') || 'private-current-session';
    req.user = sessions.get(req.sid)?.user;
    if (!req.user) return res.status(401).json({ message: 'Inicia sesión.' });
    next();
  };
  const assertSession = req => {
    const s = sessions.get(req.sid);
    if (!s || s.expires <= Date.now() || s.user !== req.user)
      throw Object.assign(Error('Sesión cerrada o caducada.'), { status: 401 });
  };
  mountCitizenAccount(app, { auth, assertSession, sessions, store, wrap: fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next) });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (method, route, body, sid = 'private-current-session') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
      method, headers: { 'Test-Session': sid, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  return { request, sessions, store };
}
test('sesiones muestra únicamente las vigentes propias, actual primero y sin credenciales ni SID', async t => {
  const { request } = await fixture(t);
  const { status, data } = await request('GET', '/api/profile/sessions');
  assert.equal(status, 200); assert.equal(data.items.length, 2);
  assert.equal(data.items[0].current, true); assert.equal(data.items[0].browser, 'Firefox');
  assert.equal(data.items[1].id, tag('private-second-session'));
  for (const item of data.items) {
    assert.match(item.id, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(item).sort(), ['id', 'current', 'browser', 'createdAt', 'lastSeenAt', 'expiresAt'].sort());
  }
  const serialized = JSON.stringify(data);
  for (const secret of ['private-current-session', 'private-second-session', 'private-access-token', 'private-refresh-token', 'private@example.test', 'private-meta', outsider, 'Safari', 'Navegador expirado'])
    assert.equal(serialized.includes(secret), false, secret);
});
test('revocar identifica otra sesión propia y rechaza actual, ajena, caducada o token inválido', async t => {
  const { request, sessions, store } = await fixture(t);
  const route = id => '/api/profile/sessions/' + id;
  assert.equal((await request('DELETE', route(tag('private-current-session')))).status, 400);
  assert.equal((await request('DELETE', route(tag('private-other-session', outsider)))).status, 404);
  assert.equal((await request('DELETE', route(tag('private-other-session', owner)))).status, 404);
  assert.equal((await request('DELETE', route(tag('private-expired-session')))).status, 404);
  assert.equal((await request('DELETE', route('not-a-valid-token'))).status, 404);
  assert.equal((await request('DELETE', route(tag('private-second-session')))).status, 200);
  assert.equal(sessions.has('private-second-session'), false);
  assert.equal(sessions.has('private-current-session'), true);
  assert.equal(sessions.has('private-other-session'), true);
  assert.equal((await request('DELETE', route(tag('private-second-session')))).status, 404);
  assert.deepEqual(store.read('audit'), [{ actor: owner, action: 'account.session.revoke', details: {} }]);
});
test('cerrar otras sesiones preserva la actual y las de terceros y audita el número real', async t => {
  const { request, sessions, store } = await fixture(t);
  const result = await request('POST', '/api/profile/sessions/revoke-others', {});
  assert.equal(result.status, 200); assert.equal(result.data.count, 1);
  assert.equal(sessions.has('private-current-session'), true);
  assert.equal(sessions.has('private-other-session'), true);
  assert.equal(sessions.has('private-second-session'), false);
  assert.deepEqual(store.read('audit'), [{ actor: owner, action: 'account.sessions.revoke-others', details: { count: 1 } }]);
  assert.equal((await request('POST', '/api/profile/sessions/revoke-others', {})).data.count, 0);
});
test('sesiones anónimas y expiradas no pueden listar, revocar ni desvincular', async t => {
  const { request, sessions } = await fixture(t);
  for (const sid of ['session-missing', 'private-expired-session']) {
    assert.equal((await request('GET', '/api/profile/sessions', undefined, sid)).status, 401);
    assert.equal((await request('POST', '/api/profile/sessions/revoke-others', {}, sid)).status, 401);
    assert.equal((await request('DELETE', '/api/profile/sessions/' + tag('private-second-session'), undefined, sid)).status, 401);
    assert.equal((await request('POST', '/api/profile/roblox/unlink', { confirm: true }, sid)).status, 401);
  }
  assert.equal(sessions.has('private-second-session'), true);
});
test('desvincular exige confirmación booleana y solo modifica Roblox del personaje titular', async t => {
  const { request, store, sessions } = await fixture(t);
  const original = store.read('cedulas'), history = Object.fromEntries(['multas', 'arrestos', 'vehiculos', 'licencias'].map(name => [name, store.read(name)]));
  for (const body of [{}, { confirm: false }, { confirm: 'true' }, { confirm: 1 }])
    assert.equal((await request('POST', '/api/profile/roblox/unlink', body)).status, 400);
  assert.deepEqual(store.read('cedulas'), original);
  const result = await request('POST', '/api/profile/roblox/unlink', { confirm: true, discordId: outsider, userId: outsider, numeroCedula: 'RP-OTHER' });
  assert.equal(result.status, 200);
  assert.deepEqual(store.read('cedulas')['RP-OWN'], { ...original['RP-OWN'], roblox: null });
  assert.deepEqual(store.read('cedulas')['RP-OTHER'], original['RP-OTHER']);
  for (const [name, records] of Object.entries(history)) assert.deepEqual(store.read(name), records);
  assert.deepEqual(store.read('audit'), [{ actor: owner, action: 'profile.roblox.unlink', details: { userId: '77' } }]);
  assert.equal(sessions.size, 4);
  assert.equal((await request('POST', '/api/profile/roblox/unlink', { confirm: true })).status, 409);
  assert.equal(store.read('audit').length, 1);
});
test('desvincular rechaza personaje ausente o ambiguo y no usa el número enviado por el cliente', async t => {
  const { request, store } = await fixture(t);
  const citizens = store.read('cedulas');
  citizens['RP-COPY'] = { ...citizens['RP-OWN'], numeroCedula: 'RP-COPY' }; store.write('cedulas', citizens);
  assert.equal((await request('POST', '/api/profile/roblox/unlink', { confirm: true })).status, 409);
  assert.ok(store.read('cedulas')['RP-OWN'].roblox);
  delete citizens['RP-COPY']; delete citizens['RP-OWN']; store.write('cedulas', citizens);
  assert.equal((await request('POST', '/api/profile/roblox/unlink', { confirm: true, numeroCedula: 'RP-OTHER' })).status, 409);
  assert.ok(store.read('cedulas')['RP-OTHER'].roblox);
  assert.equal(store.read('audit').length, 0);
});
test('fallo de auditoría revierte la desvinculación y conserva íntegro el expediente', async t => {
  const options = { failAudit: true }, { request, store } = await fixture(t, options);
  const before = store.read('cedulas');
  assert.equal((await request('POST', '/api/profile/roblox/unlink', { confirm: true })).status, 500);
  assert.deepEqual(store.read('cedulas'), before);
  assert.equal(store.read('audit').length, 0);
  options.failAudit = false;
  assert.equal((await request('POST', '/api/profile/roblox/unlink', { confirm: true })).status, 200);
});
