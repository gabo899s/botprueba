'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const base = path.join(__dirname, '../public');
const tick = () => new Promise(resolve => setImmediate(resolve));
const owner = '111111111111111111';
async function fixture(t, options = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(base, 'citizen.html'), 'utf8'), { url: 'http://localhost/ciudadano', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, errors = [], calls = [];
  w.addEventListener('error', e => errors.push(e.error || e.message));
  w.matchMedia = () => ({ matches: false }); w.HTMLElement.prototype.scrollIntoView = function () {};
  let logged = true;
  const me = { id: owner, discordId: owner, discordUsername: 'Prueba Maes', nombreCompleto: 'Ciudadano Ejemplo', mode: 'discord' };
  const citizen = { numeroCedula: 'RP100', discordId: owner, nombre: 'Ejemplo', apellidos: 'Ciudadano', vehiculos: [{ placa: 'MAES1', modelo: 'Sedán' }], licencias: [{ id: 'B1', tipo: 'B1', estado: 'Activa' }], multas: [{ id: 'm1', articulos: 'Ejemplo multa', monto: 100, estado: 'REGISTRADA' }], arrestos: [{ id: 'a1', articulos: 'Ejemplo arresto', estado: 'REGISTRADO', tiempo: 2 }] };
  function bodyFor(url) {
    if (url === '/api/auth/me') return { user: me };
    if (url === '/api/profile') return { citizen };
    if (url === '/api/profile/sanctions') return { sanctions: [] };
    if (url === '/api/tickets?scope=mine') return { items: [{ id: 'ticket1', topic: 'Consulta ficticia', status: 'abierto' }] };
    if (url === '/api/profile/modules') return { modules: [{ id: 'transactions', status: 'available' }, { id: 'assets', status: 'available' }] };
    if (url === '/api/profile/corrections') return { items: [] };
    if (url === '/api/config') return { robloxOAuth: false };
    if (url === '/api/profile/assets') return { vehicles: citizen.vehiculos, licenses: citizen.licencias, renewals: [] };
    if (url === '/api/profile/support') return { available: true, message: 'Conectado' };
    if (url === '/api/profile/sessions') return { items: [{ id: 'current', current: true, browser: 'Navegador de ejemplo', expiresAt: '2028-01-01T00:00:00Z' }] };
    if (url === '/api/profile/notifications') return { unread: 0, items: [{ id: 'record-event', title: 'Arresto registrado', at: new Date().toISOString(), panel: 'fines', target: { type: 'arrestos', id: 'a1' }, text: 'Consulta tu registro.', read: true }] };
    if (url === '/api/profile/economy') return { available: false, currency: 'Dinero de rol', message: 'Proveedor sin configurar', balanceNotice: '', historyNotice: '', operations: Object.fromEntries(['deposit','withdraw','transfer'].map(k => [k, { reason: 'Pendiente' }])), fines: [], history: [] };
    if (url === '/api/tickets/ticket1/messages') return { items: [{ id: 'msg1', author: 'Staff', content: 'Mensaje ficticio', createdAt: new Date().toISOString() }], nextBefore: null };
    if (url === '/api/auth/logout') { logged = false; return { success: true }; }
    throw Error('Ruta sin fixture: ' + url);
  }
  w.fetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    if (!logged && url !== '/api/auth/logout') return { ok: false, status: 401, json: async () => ({ message: 'Inicia sesión' }) };
    if (options.intercept) { const result = options.intercept(url, opts); if (result) return result; }
    return { ok: true, status: 200, json: async () => bodyFor(url) };
  };
  for (const script of w.document.querySelectorAll('script[src]')) {
    const source = script.getAttribute('src');
    if (source.startsWith('/js/citizen')) w.eval(fs.readFileSync(path.join(base, source), 'utf8'));
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  for (let i = 0; i < 5; i++) await tick();
  return { w, calls, errors, me, citizen, $: selector => w.document.querySelector(selector), logout: async () => { w.document.querySelector('#citizenLogout').click(); for (let i = 0; i < 3; i++) await tick(); } };
}
test('scripts ciudadanos integrados muestran bienes, sesiones y economía; Patrimonio y Transacciones abren vistas reales', async t => {
  const f = await fixture(t);
  assert.deepEqual(f.errors, []); assert.equal(f.w.CitizenApp.me.discordId, owner);
  assert.match(f.$('#citizenAssets').textContent, /MAES1/); assert.match(f.$('#citizenAccount').textContent, /Navegador de ejemplo/); assert.match(f.$('#citizenEconomy').textContent, /Proveedor sin configurar/);
  assert.equal(f.$('#vehiclesLicenses').hidden, true);
  f.$('[data-module="transactions"]').click(); assert.equal(f.$('[data-view="economy"]').hidden, false);
  f.$('[data-module="assets"]').click(); assert.equal(f.$('[data-view="personal"]').hidden, false);
  assert.equal(f.$('[data-module="assets"] .module-status'), null); assert.equal(f.$('[data-module="transactions"] .module-status'), null);
  await f.logout(); assert.equal(f.w.CitizenApp.me, null); assert.equal(f.$('.asset-vehicle'), null); assert.equal(f.$('#citizenAccount').hidden, true);
  assert.equal(f.w.document.body.textContent.includes('Navegador de ejemplo'), false); assert.equal(f.w.document.body.textContent.includes('Mensaje ficticio'), false);
});
test('aviso integrado selecciona arrestos y referencia exacta; soporte conserva borrador al actualizar todo el panel', async t => {
  const f = await fixture(t);
  f.$('#notifications button:nth-child(1)');
  [...f.w.document.querySelectorAll('#notifications button')].find(b => b.textContent === 'Ver detalle').click(); await tick();
  assert.equal(f.$('[data-view="fines"]').hidden, false); assert.equal(f.$('[data-record-kind="arrestos"]').getAttribute('aria-pressed'), 'true'); assert.equal(f.$('.citizen-record.citizen-target').dataset.entityId, 'a1');
  f.w.CitizenApp.selectPanel('support'); f.$('#tickets button').click(); await tick();
  let input = f.$('#tickets textarea'); input.value = 'Borrador conservado al actualizar'; input.dispatchEvent(new f.w.Event('input'));
  await f.w.CitizenApp.refresh(); for (let i = 0; i < 3; i++) await tick();
  assert.equal(f.$('#tickets textarea').value, 'Borrador conservado al actualizar'); assert.match(f.$('.support-conversation').textContent, /Mensaje ficticio/);
  await f.logout(); assert.equal(f.$('#tickets textarea'), null); assert.equal(f.w.document.body.textContent.includes('Borrador conservado'), false); assert.deepEqual(f.errors, []);
});
test('logout integrado descarta respuestas tardías de bienes, economía y sesiones', async t => {
  const pending = new Map();
  const f = await fixture(t, { intercept: url => {
    if (!['/api/profile/assets','/api/profile/economy','/api/profile/sessions'].includes(url)) return null;
    return new Promise(resolve => { pending.set(url, resolve); });
  } });
  assert.equal(pending.size, 3); await f.logout();
  pending.get('/api/profile/assets')({ ok: true, status: 200, json: async () => ({ vehicles: [{ placa: 'SECRET-OLD' }], licenses: [], renewals: [] }) });
  pending.get('/api/profile/sessions')({ ok: true, status: 200, json: async () => ({ items: [{ browser: 'SECRET-OLD' }] }) });
  pending.get('/api/profile/economy')({ ok: true, status: 200, json: async () => ({ available: true, balance: { cash: 99999, bank: 99999 }, message: 'SECRET-OLD', fines: [], history: [] }) });
  for (let i = 0; i < 4; i++) await tick();
  assert.equal(f.w.document.body.textContent.includes('SECRET-OLD'), false); assert.equal(f.$('#citizenAccount').hidden, true); assert.equal(f.$('.asset-vehicle'), null); assert.deepEqual(f.errors, []);
});
