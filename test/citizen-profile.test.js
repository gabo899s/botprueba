const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { mountCitizenProfile, validateChanges } = require('../lib/citizen-profile');
const owner = '123456789012345678', admin = '223456789012345678', outsider = '323456789012345678';
async function fixture(t, options = {}) {
  const app = express(); app.use(express.json());
  let data = { cedulas: { 'RP-123': { discordId: owner, numeroCedula: 'RP-123', nombre: 'Ana', apellidos: 'Sol', fechaNacimiento: '2000-01-01', roblox: { userId: '12' } } }, profileCorrections: [], audit: [] };
  const store = { read: name => structuredClone(data[name]), write: (name, value) => { data[name] = structuredClone(value); }, transaction(fn) { const before = structuredClone(data); try { return fn(); } catch (error) { data = before; throw error; } }, audit(actor, action, details) { if (options.failAudit) throw Error('audit-failed'); data.audit.push({ actor, action, details }); } };
  const sessions = new Map(); sessions.save = id => { assert.ok(sessions.has(id)); };
  for (const id of [owner, admin, outsider]) sessions.set(id, { user: { discordId: id, id, mode: 'discord', isAdmin: id === admin, roles: ['keep-role'] }, expires: Date.now() + 60000, oauth: { accessToken: 'mock-access' } });
  const auth = (req, res, next) => { req.sid = req.get('Test-Actor') || owner; req.user = sessions.get(req.sid)?.user; if (!req.user) return res.status(401).json({ message: 'Inicia sesión.' }); next(); };
  mountCitizenProfile(app, { auth, store, sessions, wrap: fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next), publicUser: u => ({ ...u }), assertSession: req => { if (!sessions.has(req.sid)) throw Object.assign(Error('Cerrada.'), { status: 401 }); }, renewDiscordToken: async () => {}, remote: options.remote || (async () => ({ id: owner, username: 'ana', global_name: 'Ana Discord', avatar: 'a_0123456789abcdef0123456789abcdef' })) });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  async function request(route, body, actor = owner) { const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { method: body ? 'POST' : 'GET', headers: { 'Test-Actor': actor, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, data: await response.json() }; }
  return { store, sessions, request };
}
const correction = () => ({ changes: { nombre: 'Ana María' }, reason: 'Corrección del nombre de mi personaje.' });
test('correcciones limitan campos y validan fechas y estaturas sin aceptar permisos o propietarios', () => {
  for (const changes of [{ discordId: outsider }, { isAdmin: true }, { nombre: 'A', roblox: {} }, { fechaNacimiento: '2000-02-31' }, { fechaNacimiento: '2100-01-01' }, { estatura: '400 cm' }, { grupoSanguineo: 'C+' }, { nombre: 'A\nB' }, []]) assert.throws(() => validateChanges(changes));
  assert.deepEqual(validateChanges({ nombre: ' Ana ', fechaNacimiento: '2000-02-29', estatura: '185 cm', grupoSanguineo: 'AB+' }), { nombre: 'Ana', fechaNacimiento: '2000-02-29', estatura: '185 cm', grupoSanguineo: 'AB+' });
});
test('corrección conserva el perfil hasta aprobación y solo su dueño consulta la solicitud', async t => {
  const { request, store } = await fixture(t), result = await request('/api/profile/corrections', correction());
  assert.equal(result.status, 201); assert.equal(store.read('cedulas')['RP-123'].nombre, 'Ana'); assert.equal(result.data.item.baseline, undefined);
  assert.equal((await request('/api/profile/corrections', correction())).status, 409);
  assert.equal((await request('/api/profile/corrections', undefined, outsider)).data.items.length, 0);
  assert.equal((await request('/api/staff/profile-corrections', undefined, owner)).status, 403);
  const decision = await request(`/api/staff/profile-corrections/${result.data.item.id}/decision`, { approve: true, note: 'Datos corregidos.' }, admin);
  assert.equal(decision.status, 200); assert.equal(store.read('cedulas')['RP-123'].nombre, 'Ana María');
  assert.equal(store.read('cedulas')['RP-123'].roblox.userId, '12'); assert.equal(store.read('audit').length, 2);
  assert.equal((await request(`/api/staff/profile-corrections/${result.data.item.id}/decision`, { approve: true }, admin)).status, 409);
});
test('no admite autorevisión, cambios obsoletos ni reutilización de la cédula', async t => {
  const { request, store, sessions } = await fixture(t), { data } = await request('/api/profile/corrections', correction());
  sessions.get(owner).user.isAdmin = true;
  assert.equal((await request(`/api/staff/profile-corrections/${data.item.id}/decision`, { approve: true }, owner)).status, 403);
  const citizens = store.read('cedulas'); citizens['RP-123'].discordId = outsider; store.write('cedulas', citizens);
  assert.equal((await request(`/api/staff/profile-corrections/${data.item.id}/decision`, { approve: true }, admin)).status, 409);
  assert.equal(store.read('cedulas')['RP-123'].nombre, 'Ana');
  citizens['RP-123'].discordId = owner; citizens['RP-123'].provincia = 'Nueva provincia'; store.write('cedulas', citizens);
  assert.equal((await request(`/api/staff/profile-corrections/${data.item.id}/decision`, { approve: true }, admin)).status, 409);
  assert.equal((await request(`/api/staff/profile-corrections/${data.item.id}/decision`, { approve: false }, admin)).status, 400);
  assert.equal((await request(`/api/staff/profile-corrections/${data.item.id}/decision`, { approve: false, note: 'Tu personaje cambió. Envía una nueva solicitud.' }, admin)).status, 200);
});
test('la auditoría y la modificación de personaje se revierten juntas ante un error', async t => {
  const options = {}, { request, store } = await fixture(t, options), { data } = await request('/api/profile/corrections', correction()); options.failAudit = true;
  assert.equal((await request(`/api/staff/profile-corrections/${data.item.id}/decision`, { approve: true }, admin)).status, 500);
  assert.equal(store.read('cedulas')['RP-123'].nombre, 'Ana'); assert.equal(store.read('profileCorrections')[0].status, 'pending');
});
test('Discord actualiza exclusivamente identidad e imagen verificadas por el proveedor con cooldown', async t => {
  const { request, sessions } = await fixture(t);
  const result = await request('/api/profile/discord/refresh', { discordAvatar: 'https://evil.example/avatar', isAdmin: true });
  assert.equal(result.status, 200); assert.equal(result.data.user.discordUsername, 'ana'); assert.equal(result.data.user.isAdmin, false); assert.deepEqual(result.data.user.roles, ['keep-role']);
  assert.equal(result.data.user.discordAvatar, `https://cdn.discordapp.com/avatars/${owner}/a_0123456789abcdef0123456789abcdef.gif`);
  assert.equal(sessions.get(owner).user.nombreCompleto, 'Ana Discord'); assert.equal((await request('/api/profile/discord/refresh', {})).status, 429);
});
test('Discord no acepta un propietario diferente ni una sesión cerrada durante la consulta', async t => {
  const first = await fixture(t, { remote: async () => ({ id: outsider, username: 'Otro' }) });
  assert.equal((await first.request('/api/profile/discord/refresh', {})).status, 403); assert.equal(first.sessions.get(owner).user.discordUsername, undefined);
  let end;
  const second = await fixture(t, { remote: () => new Promise(resolve => { end = resolve; }) });
  const pending = second.request('/api/profile/discord/refresh', {});
  while (!end) await new Promise(resolve => setImmediate(resolve));
  second.sessions.delete(owner); end({ id: owner, username: 'Ana', avatar: null });
  assert.equal((await pending).status, 401); assert.equal(second.sessions.has(owner), false);
});
test('Discord elimina detalles internos del error y evita cambios parciales', async t => {
  const { request, sessions } = await fixture(t, { remote: async () => { throw Error('mock-secret-provider-internal'); } });
  const result = await request('/api/profile/discord/refresh', {});
  assert.equal(result.status, 503); assert.ok(!result.data.message.includes('mock-secret')); assert.equal(sessions.get(owner).user.discordUsername, undefined);
});
test('formulario ciudadano genera cambios seleccionados y no interpreta el motivo como HTML', async () => {
  const dom = new JSDOM('<section id="profileCorrections"></section><button id="discordRefresh"></button><a id="robloxRefresh"></a>', { runScripts: 'outside-only', url: 'http://localhost' });
  const { window } = dom; let sent;
  window.CitizenApp = { api: async (url, body) => { if (body) { sent = body; return { message: 'Enviada' }; } return { items: [{ status: 'rejected', createdAt: '2026-01-01', changes: { nombre: 'Otro' }, previous: { nombre: 'Ana' }, reason: '<img src=x onerror=alert(1)>', note: 'No aprobado' }] }; }, notice() {}, refresh: async () => {} };
  window.eval(fs.readFileSync(path.join(__dirname, '../public/js/citizen-profile.js'), 'utf8'));
  window.document.dispatchEvent(new window.CustomEvent('citizen:updated', { detail: { me: { discordId: owner }, citizen: { numeroCedula: 'RP-123', nombre: 'Ana' }, demo: false } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(window.document.querySelector('#correctionHistory img'), null);
  const checkbox = window.document.querySelector('input[type=checkbox]'); checkbox.checked = true; checkbox.dispatchEvent(new window.Event('change'));
  window.document.querySelector('#correction-nombre').value = 'Ana María'; window.document.querySelector('#correction-reason').value = 'Corregir el nombre del personaje.';
  window.document.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true })); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), { changes: { nombre: 'Ana María' }, reason: 'Corregir el nombre del personaje.' }); dom.window.close();
});
const profileScript = () => fs.readFileSync(path.join(__dirname, '../public/js/citizen-profile.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
test('revisión administrativa se hace visible conservando encabezado y se oculta al perder permisos', async () => {
  const dom = new JSDOM('<button id="logout"></button><section id="profileCorrectionReviews" hidden><h2>Correcciones de personajes</h2></section>', { runScripts: 'outside-only', url: 'http://localhost' });
  const { window } = dom; let allowed = true;
  window.fetch = async url => ({ ok: true, status: 200, json: async () => url === '/api/staff/me' ? { user: { id: admin, isAdmin: allowed } } : { items: [{ id: 'review-test', userId: owner, citizenNumber: 'RP-123', status: 'pending', createdAt: '2026-01-01', changes: { nombre: 'Otra' }, previous: { nombre: 'Ana' }, reason: 'Cambiar el nombre del personaje.' }] } });
  window.eval(profileScript()); await flush(); await flush();
  const reviews = window.document.querySelector('#profileCorrectionReviews');
  assert.equal(reviews.hidden, false); assert.equal(reviews.querySelector('h2').textContent, 'Correcciones de personajes'); assert.ok(reviews.querySelector('form'));
  allowed = false; window.document.dispatchEvent(new window.Event('staff:updated')); await flush();
  assert.equal(reviews.hidden, true); assert.equal(reviews.querySelector('form'), null); dom.window.close();
});
test('respuesta administrativa que termina después de salir no vuelve a mostrar datos', async () => {
  const dom = new JSDOM('<button id="logout"></button><section id="profileCorrectionReviews" hidden></section>', { runScripts: 'outside-only', url: 'http://localhost' });
  const { window } = dom; let finish;
  window.fetch = async url => url === '/api/staff/me' ? { ok: true, json: async () => ({ user: { id: admin, isAdmin: true } }) } : new Promise(resolve => { finish = () => resolve({ ok: true, json: async () => ({ items: [{ status: 'pending', userId: owner, reason: 'No debe mostrarse.' }] }) }); });
  window.eval(profileScript()); await flush(); assert.equal(typeof finish, 'function');
  window.document.querySelector('#logout').click(); finish(); await flush(); await flush();
  assert.equal(window.document.querySelector('#profileCorrectionReviews').hidden, true); assert.ok(!window.document.body.textContent.includes('No debe mostrarse.')); dom.window.close();
});
test('vinculación Roblox deshabilitada sin configuración y formulario actualiza valores sin pisar borradores', async () => {
  const dom = new JSDOM('<section id="profileCorrections"></section><button id="discordRefresh"></button><a id="robloxRefresh"></a><p id="robloxHelp"></p>', { runScripts: 'outside-only', url: 'http://localhost' });
  const { window } = dom; let notices = [];
  window.CitizenApp = { api: async url => url === '/api/config' ? { robloxOAuth: false } : { items: [] }, notice: message => notices.push(message) };
  window.eval(profileScript());
  const update = nombre => window.document.dispatchEvent(new window.CustomEvent('citizen:updated', { detail: { me: { discordId: owner }, citizen: { numeroCedula: 'RP-123', nombre }, demo: false } }));
  update('Ana'); await flush();
  const roblox = window.document.querySelector('#robloxRefresh'); assert.equal(roblox.getAttribute('aria-disabled'), 'true'); assert.match(window.document.querySelector('#robloxHelp').textContent, /no está configurada/);
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true }); assert.equal(roblox.dispatchEvent(click), false); assert.match(notices[0], /no está configurada/);
  update('Ana María'); await flush(); assert.equal(window.document.querySelector('#correction-nombre').value, 'Ana María');
  const input = window.document.querySelector('#correction-nombre'); input.value = 'Mi borrador'; input.dispatchEvent(new window.Event('input', { bubbles: true }));
  update('Otro nombre aprobado'); await flush(); assert.equal(window.document.querySelector('#correction-nombre').value, 'Mi borrador'); dom.window.close();
});
test('errores de sesión ocultan revisiones que ya se habían mostrado', async () => {
  const dom = new JSDOM('<section id="profileCorrectionReviews" hidden></section>', { runScripts: 'outside-only', url: 'http://localhost' });
  const { window } = dom; let authorized = true;
  window.fetch = async url => ({ ok: authorized, status: authorized ? 200 : 401, json: async () => authorized ? url === '/api/staff/me' ? { user: { id: admin, isAdmin: true } } : { items: [] } : { message: 'Inicia sesión.' } });
  window.eval(profileScript()); await flush(); await flush();
  const reviews = window.document.querySelector('#profileCorrectionReviews'); assert.equal(reviews.hidden, false);
  authorized = false; window.document.dispatchEvent(new window.Event('staff:updated')); await flush(); assert.equal(reviews.hidden, true); dom.window.close();
});
