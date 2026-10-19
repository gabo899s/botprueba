'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const { mountCitizenAssets, licenseId } = require('../lib/citizen-assets');
const owner = '111111111111111111', reviewer = '222222222222222222', stranger = '333333333333333333';
const settle = () => new Promise(resolve => setImmediate(resolve));
async function assetsFixture(t) {
  let data = { cedulas: { one: { discordId: owner, numeroCedula: 'RP-100' } }, vehiculos: { [owner]: [{ placa: 'MAES1', modelo: 'Sedán', privateNote: 'Do not disclose' }], [stranger]: [{ placa: 'PRIVATE' }] }, licencias: { [owner]: [{ tipo: 'B1', estado: 'Activa' }, { id: 'A1', tipo: 'A1', estado: 'Activa', expiresAt: '2026-01-01T00:00:00Z' }], [stranger]: [{ tipo: 'PRIVATE' }] }, assetRenewals: [] };
  const audit = [];
  const store = { read: key => structuredClone(data[key]), write: (key, value) => { data[key] = structuredClone(value); }, audit: (...args) => audit.push(args), transaction: fn => { const snapshot = structuredClone(data); try { return fn(); } catch (error) { data = snapshot; throw error; } } };
  const app = express(); app.use(express.json());
  let session = true;
  mountCitizenAssets(app, { store, auth: (req, res, next) => { if (!req.headers.authorization) return res.sendStatus(401); req.user = { discordId: req.headers.authorization, mode: 'discord', isAdmin: req.headers.authorization === reviewer }; next(); }, wrap: fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next), assertSession: () => { if (!session) throw Object.assign(Error('Finalizada'), { status: 401 }); } });
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => server.close());
  const api = async (url, user = owner, body) => { const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { headers: { authorization: user, 'Content-Type': 'application/json' }, method: body ? 'POST' : 'GET', ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() }; };
  return { api, store, audit, get data() { return data; }, closeSession: () => { session = false; } };
}
test('bienes solo pertenecen al ciudadano canónico y no inventan vigencia ni exponen notas', async t => {
  const f = await assetsFixture(t), result = await f.api('/api/profile/assets');
  assert.equal(result.status, 200); assert.equal(result.body.vehicles.length, 1); assert.equal(result.body.vehicles[0].placa, 'MAES1');
  assert.equal(JSON.stringify(result.body).includes('PRIVATE'), false); assert.equal('privateNote' in result.body.vehicles[0], false); assert.equal('expiresAt' in result.body.licenses[0], false);
  assert.equal(result.body.licenses[0].id, licenseId(f.data.licencias[owner][0]));
  assert.equal((await f.api('/api/profile/assets', stranger)).status, 409);
  f.closeSession(); assert.equal((await f.api('/api/profile/assets')).status, 401);
});
test('renovación es revisada, evita duplicados y conserva vigencia original hasta aprobar', async t => {
  const f = await assetsFixture(t), id = licenseId(f.data.licencias[owner][0]), reason = 'Necesito renovar mi licencia del personaje.';
  const created = await f.api(`/api/profile/licenses/${id}/renewal`, owner, { reason });
  assert.equal(created.status, 201); assert.equal(created.body.item.status, 'pending'); assert.equal('baseline' in created.body.item, false); assert.equal(f.data.licencias[owner][0].expiresAt, undefined);
  assert.equal((await f.api(`/api/profile/licenses/${id}/renewal`, owner, { reason })).status, 409);
  const decision = `/api/staff/license-renewals/${created.body.item.id}/decision`;
  assert.equal((await f.api(decision, owner, { approve: true, expiresAt: '2028-05-01', note: 'Todo correcto.' })).status, 403);
  assert.equal((await f.api(decision, reviewer, { approve: true, note: 'Todo correcto.' })).status, 400);
  const approved = await f.api(decision, reviewer, { approve: true, expiresAt: '2028-05-01', note: 'Requisitos comprobados.' });
  assert.equal(approved.status, 200); assert.equal(f.data.licencias[owner][0].expiresAt, '2028-05-01T23:59:59.999Z'); assert.equal(f.data.licencias[owner][0].renewalHistory.length, 1);
  assert.equal((await f.api(decision, reviewer, { approve: true, expiresAt: '2028-05-01', note: 'Todo correcto.' })).status, 409);
  assert.ok(f.audit.some(item => item[1] === 'license.renewal.approved'));
});
test('renovación rechaza referencias ajenas, fechas imposibles y modificaciones obsoletas', async t => {
  const f = await assetsFixture(t), id = licenseId(f.data.licencias[owner][0]);
  assert.equal((await f.api('/api/profile/licenses/other/renewal', owner, { reason: 'Quiero renovar la licencia.' })).status, 404);
  const created = await f.api(`/api/profile/licenses/${id}/renewal`, owner, { reason: 'Quiero renovar la licencia.' }), url = `/api/staff/license-renewals/${created.body.item.id}/decision`;
  assert.equal((await f.api(url, reviewer, { approve: true, expiresAt: '2028-02-31', note: 'Todo correcto.' })).status, 400);
  const all = f.store.read('licencias'); all[owner][0].estado = 'Suspendida'; f.store.write('licencias', all);
  assert.equal((await f.api(url, reviewer, { approve: true, expiresAt: '2028-05-01', note: 'Todo correcto.' })).status, 409);
  assert.equal((await f.api(url, reviewer, { approve: false, note: 'Debe corregir el registro.' })).status, 200); assert.equal(f.data.licencias[owner][0].estado, 'Suspendida');
});
test('tarjetas de bienes filtran matrículas, muestran vigencia explícita y escapan texto', async () => {
  const dom = new JSDOM('<div id="vehiclesLicenses"></div><section id="citizenAssets"></section>', { url: 'http://localhost', runScripts: 'outside-only' }), w = dom.window;
  w.CitizenApp = { api: async () => ({ vehicles: [{ placa: 'MAES1', modelo: '<img src=x>' }, { placa: 'MAES2', modelo: 'Camión' }], licenses: [{ id: 'b1', tipo: 'B1', estado: 'Activa' }], renewals: [] }), notice: () => {} };
  w.eval(fs.readFileSync(require.resolve('../public/js/citizen-assets.js'), 'utf8'));
  w.document.dispatchEvent(new w.CustomEvent('citizen:updated', { detail: { me: { discordId: owner }, citizen: { numeroCedula: 'RP100' } } })); await settle();
  assert.equal(w.document.querySelectorAll('.asset-vehicle').length, 2); assert.equal(w.document.querySelector('img'), null); assert.match(w.document.querySelector('.asset-license').textContent, /sin vigencia registrada/);
  const search = w.document.querySelector('input'); search.value = 'MAES2'; search.dispatchEvent(new w.Event('input')); assert.equal(w.document.querySelectorAll('.asset-vehicle').length, 1);
  w.document.dispatchEvent(new w.CustomEvent('citizen:navigate', { detail: { target: { type: 'license', id: 'b1' } } })); assert.ok(w.document.querySelector('.asset-license').classList.contains('citizen-target'));
  w.document.dispatchEvent(new w.CustomEvent('citizen:updated', { detail: { demo: true } })); assert.equal(w.document.querySelector('.asset-license'), null); w.close();
});
test('avisos de registros abren la pestaña y entidad exactas, descartando filtros anteriores', () => {
  const dom = new JSDOM('<div id="records"></div><div id="sanctions"></div>', { url: 'http://localhost', runScripts: 'outside-only' }), w = dom.window;
  w.CitizenApp = { me: { discordId: owner }, el: (tag, text) => { const n = w.document.createElement(tag); if (text) n.textContent = text; return n; }, link: () => {}, notice: () => {}, api: async () => ({}), refresh: async () => {} };
  w.eval(fs.readFileSync(require.resolve('../public/js/citizen-records.js'), 'utf8'));
  w.document.dispatchEvent(new w.CustomEvent('citizen:updated', { detail: { me: w.CitizenApp.me, citizen: { multas: [{ id: 'm1' }], arrestos: [{ id: 'a1', tiempo: 2 }] }, sanctions: [{ id: 's1', estado: 'revocada' }] } }));
  w.document.dispatchEvent(new w.CustomEvent('citizen:navigate', { detail: { target: { type: 'arrestos', id: 'a1' } } }));
  assert.equal(w.document.querySelector('[data-record-kind="arrestos"]').getAttribute('aria-pressed'), 'true'); assert.equal(w.document.querySelector('.citizen-target').dataset.entityId, 'a1');
  w.document.dispatchEvent(new w.CustomEvent('citizen:navigate', { detail: { target: { type: 'sanction', id: 's1' } } })); assert.ok(w.document.querySelector('.citizen-sanction').classList.contains('citizen-target')); w.close();
});
test('soporte conserva borrador al refrescar y no genera otro envío tras resultado incierto', async () => {
  const dom = new JSDOM('<div id="ticketSupport"></div><div id="tickets"></div>', { url: 'http://localhost', runScripts: 'outside-only' }), w = dom.window;
  let sends = 0;
  w.CitizenApp = { notice: () => {}, refresh: async () => {}, api: async (url, body) => { if (url === '/api/profile/support') return { available: true }; if (body) { sends++; throw Object.assign(Error('No confirmado'), { status: 503 }); } return { items: [], nextBefore: null }; } };
  w.eval(fs.readFileSync(require.resolve('../public/js/citizen-support.js'), 'utf8'));
  const detail = { me: { discordId: owner }, tickets: [{ id: 'ticket', topic: 'Ayuda', status: 'abierto' }] }, update = () => w.document.dispatchEvent(new w.CustomEvent('citizen:updated', { detail }));
  update(); await settle(); w.document.querySelector('#tickets button').click(); await settle();
  let input = w.document.querySelector('textarea'); input.value = 'Texto privado conservado'; input.dispatchEvent(new w.Event('input'));
  update(); await settle(); input = w.document.querySelector('textarea'); assert.equal(input.value, 'Texto privado conservado');
  input.form.dispatchEvent(new w.Event('submit', { cancelable: true })); await settle(); assert.equal(sends, 1);
  update(); await settle(); input = w.document.querySelector('textarea'); assert.equal(input.value, 'Texto privado conservado'); assert.equal(input.disabled, true);
  input.form.dispatchEvent(new w.Event('submit', { cancelable: true })); await settle(); assert.equal(sends, 1); w.close();
});
test('paginación soporte valida cursor y no expone eventos de bots internos', async () => {
  const { createSupportService } = require('../lib/citizen-support'), { Collection, ChannelType } = require('discord.js');
  process.env.DISCORD_GUILD_ID = '777777777777777777'; let params;
  const ids = Array.from({ length: 50 }, (_, i) => String(100000000000000000n + BigInt(i))), channel = { type: ChannelType.GuildText, guildId: process.env.DISCORD_GUILD_ID, permissionsFor: () => ({ has: () => true }), messages: { fetch: async options => { params = options; return new Collection(ids.map((id, i) => [id, { id, author: { bot: i !== 2, id: reviewer, username: 'Staff' }, createdTimestamp: i * 1000, content: 'Respuesta' }])); } } };
  const guild = { id: process.env.DISCORD_GUILD_ID, members: { fetch: async () => ({}) }, channels: { fetch: async () => channel } };
  const service = createSupportService({ store: { read: () => ({ items: { one: { userId: owner, channelId: 'channel' } } }) }, runtime: () => ({ client: { isReady: () => true, guilds: { fetch: async () => guild } } }), settings: {} });
  await assert.rejects(service.messages({ discordId: owner }, 'one', () => {}, { before: '../bad' }), { status: 400 });
  const result = await service.messages({ discordId: owner }, 'one', () => {}, { before: '200000000000000000' });
  assert.equal(result.length, 1); assert.equal(result.nextBefore, ids[0]); assert.equal(params.before, '200000000000000000');
});
