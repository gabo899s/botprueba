const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ChannelType } = require('discord.js');
const { createSupportService, mountCitizenSupport } = require('../lib/citizen-support');
const express = require('express');
const owner = '111111111111111111', other = '222222222222222222', guildId = '777777777777777777';
process.env.DISCORD_GUILD_ID = guildId;
function fixture() {
  let state = { items: {} }, created = 0, sent = 0, allowed = true, online = true;
  const channel = { id: 'channel', type: ChannelType.GuildText, guildId,
    permissionsFor: () => ({ has: () => allowed }),
    messages: { fetch: async () => new Collection() },
    send: async value => { sent++; channel.lastSend = value; return { id: 'message-' + sent }; },
  };
  const member = { user: { id: owner, username: 'Ciudadano' } };
  const guild = { id: guildId, members: { fetch: async () => member }, channels: { fetch: async () => channel } };
  const store = { read: () => structuredClone(state), update: (_, fn) => fn(state) };
  const runtime = { client: { isReady: () => online, guilds: { fetch: async () => guild } },
    createTicket: async (i, options) => {
      created++; options.assertSession?.();
      const ticket = { id: 'ticket-' + created, userId: i.user.id, topic: i.options.getString('asunto'), channelId: channel.id, guildId, status: 'abierto', webRequestId: options.requestId };
      state.items[ticket.id] = ticket; return structuredClone(ticket);
    },
  };
  const service = createSupportService({ store, runtime: () => runtime, settings: { get: () => ({ staffRoleIds: [other], moderatorRoleIds: [], adminRoleIds: [] }) } });
  return { service, store, channel, runtime, guild, member, get state() { return state; }, get created() { return created; }, get sent() { return sent; },
    set online(value) { online = value; }, set allowed(value) { allowed = value; },
    open() { state.items.existing = { id: 'existing', userId: owner, channelId: channel.id, guildId, topic: 'Ayuda', status: 'abierto' }; },
  };
}
const user = { discordId: owner };
const guard = () => {};
test('crear ticket web es idempotente ante reintentos y peticiones concurrentes', async () => {
  const f = fixture(), body = { topic: 'Ayuda con mi personaje', requestId: 'request-create-123456' };
  const tickets = await Promise.all([f.service.create(user, body, guard), f.service.create(user, body, guard)]);
  assert.equal(f.created, 1); assert.equal(tickets[0].id, tickets[1].id);
  assert.equal((await f.service.create(user, body, guard)).id, tickets[0].id); assert.equal(f.created, 1);
  await assert.rejects(f.service.create(user, { ...body, topic: 'Otro asunto' }, guard), { status: 409 });
});
test('sin conexión Discord no se crea soporte ficticio y valida asunto y requestId', async () => {
  const f = fixture(); f.online = false;
  assert.equal(f.service.availability().available, false);
  await assert.rejects(f.service.create(user, { topic: 'Ayuda', requestId: 'request-create-123456' }, guard), { status: 503 });
  assert.equal(f.created, 0); assert.deepEqual(f.state.items, {});
  for (const body of [{ topic: ' ', requestId: 'request-create-123456' }, { topic: 'x'.repeat(151), requestId: 'request-create-123456' }, { topic: 'Ayuda', requestId: '../bad' }])
    await assert.rejects(f.service.create(user, body, guard), { status: 400 });
});
test('conversaciones y respuestas son exclusivas del propietario incluso para administradores', async () => {
  const f = fixture(); f.open();
  for (const visitor of [{ discordId: other }, { discordId: other, isAdmin: true }]) {
    await assert.rejects(f.service.messages(visitor, 'existing', guard), { status: 404 });
    await assert.rejects(f.service.send(visitor, 'existing', { content: 'Hola', requestId: 'request-message-123456' }, guard), { status: 404 });
  }
  f.allowed = false;
  await assert.rejects(f.service.messages(user, 'existing', guard), { status: 403 });
  assert.equal(f.sent, 0);
});
test('revalida sesión después de las esperas y antes de crear o enviar en Discord', async () => {
  const f = fixture(); f.open(); let valid = true;
  const assertSession = () => { if (!valid) throw Object.assign(Error('Sesión finalizada'), { status: 401 }); };
  f.guild.members.fetch = async () => { valid = false; return f.member; };
  await assert.rejects(f.service.create(user, { topic: 'Ayuda', requestId: 'request-create-123456' }, assertSession), { status: 401 });
  assert.equal(f.created, 0); valid = true;
  await assert.rejects(f.service.send(user, 'existing', { content: 'Hola', requestId: 'request-message-123456' }, assertSession), { status: 401 });
  assert.equal(f.sent, 0);
});
test('respuestas web no permiten menciones, son idempotentes y no duplican mensajes concurrentes', async () => {
  const f = fixture(); f.open(); const body = { content: '@everyone <@222222222222222222> ayuda', requestId: 'request-message-123456' };
  const receipts = await Promise.all([f.service.send(user, 'existing', body, guard), f.service.send(user, 'existing', body, guard)]);
  assert.equal(f.sent, 1); assert.equal(receipts[0].messageId, receipts[1].messageId);
  await f.service.send(user, 'existing', body, guard); assert.equal(f.sent, 1);
  assert.deepEqual(f.channel.lastSend.allowedMentions, { parse: [], repliedUser: false }); assert.equal(f.channel.lastSend.content.includes('@'), false);
  assert.equal(f.channel.lastSend.enforceNonce, true);
  assert.ok(f.state.items.existing.lastCitizenMessageAt);
  await assert.rejects(f.service.send(user, 'existing', { ...body, content: 'Cambio' }, guard), { status: 409 });
});
test('conversación no expone embeds internos, mensajes del sistema ni de bots ajenos', async () => {
  const f = fixture(); f.open();
  f.channel.messages.fetch = async () => new Collection([
    ['staff', { id: 'staff', content: 'Respuesta pública', embeds: [{ description: 'No serializar' }], author: { id: other, username: 'Staff', bot: false }, createdTimestamp: 1000 }],
    ['internal', { id: 'internal', content: 'Mensaje de aplicación', author: { id: other, bot: true }, createdTimestamp: 2000 }],
    ['system', { id: 'system', system: true, content: 'Sistema', author: { id: owner, bot: false }, createdTimestamp: 3000 }],
  ]);
  const rows = await f.service.messages(user, 'existing', guard);
  assert.equal(rows.length, 1); assert.equal(rows[0].content, 'Respuesta pública'); assert.equal('embeds' in rows[0], false);
  f.channel.type = ChannelType.PrivateThread;
  await assert.rejects(f.service.messages(user, 'existing', guard), { status: 403 });
});
test('tickets cerrados, servidor incorrecto y miembros ausentes no permiten escribir', async () => {
  const f = fixture(); f.open(); const body = { content: 'Hola', requestId: 'request-message-123456' };
  f.state.items.existing.status = 'cerrado'; await assert.rejects(f.service.send(user, 'existing', body, guard), { status: 409 });
  f.state.items.existing.status = 'abierto'; f.state.items.existing.guildId = '999999999999999999';
  await assert.rejects(f.service.messages(user, 'existing', guard), { status: 403 });
  f.state.items.existing.guildId = guildId; f.guild.members.fetch = async () => { throw Object.assign(Error('Unknown member'), { code: 10007 }); };
  await assert.rejects(f.service.send(user, 'existing', body, guard), { status: 403 }); assert.equal(f.sent, 0);
});
test('rutas de soporte autentican y revalidan sesión usando el proveedor simulado', async t => {
  const f = fixture(); const app = express(); app.use(express.json());
  let guards = 0;
  mountCitizenSupport(app, {
    service: f.service, auth: (req, res, next) => { if (req.headers.authorization !== 'fixture') return res.sendStatus(401); req.user = user; next(); },
    wrap: fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next), assertSession: () => { guards++; },
  });
  app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => server.close());
  const url = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(url + '/api/profile/support')).status, 401);
  const created = await fetch(url + '/api/tickets', { method: 'POST', headers: { authorization: 'fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: 'Soporte', requestId: 'request-route-123456' }) });
  assert.equal(created.status, 200); const data = await created.json(); assert.equal(data.ticket.topic, 'Soporte'); assert.equal('userId' in data.ticket, false); assert.ok(guards >= 3);
});

test('un envío Discord sin respuesta confirmada no se repite tras reiniciar el servicio', async () => {
  const f = fixture(); f.open(); let external = 0;
  f.channel.send = async () => { external++; throw Error('Timeout después de enviar'); };
  const body = { content: 'Mi mensaje', requestId: 'request-uncertain-123456' };
  await assert.rejects(f.service.send(user, 'existing', body, guard), { status: 503 });
  const restarted = createSupportService({ store: f.store, runtime: () => f.runtime, settings: { get: () => ({ staffRoleIds: [], moderatorRoleIds: [], adminRoleIds: [] }) } });
  await assert.rejects(restarted.send(user, 'existing', body, guard), { status: 409 });
  assert.equal(external, 1); assert.equal(f.state.items.existing.webMessages[body.requestId].status, 'pending');
});

test('UI de soporte conserva texto seguro, permite responder y comunica desconexión real', async () => {
  const fs = require('node:fs'), { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="ticketSupport"></div><div id="tickets"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const { window } = dom, calls = [];
  window.CitizenApp = { notice: () => {}, refresh: async () => {}, api: async (url, body) => {
    calls.push({ url, body });
    if (url === '/api/profile/support') return { available: false, message: 'El bot no está conectado.' };
    if (!body) return { items: [{ id: 'message', author: '<img src=x>', content: '<script>bad()</script>', createdAt: new Date().toISOString() }] };
    return { success: true };
  } };
  window.eval(fs.readFileSync(require.resolve('../public/js/citizen-support.js'), 'utf8'));
  window.document.dispatchEvent(new window.CustomEvent('citizen:updated', { detail: { me: user, tickets: [{ id: 'existing', topic: '<script>topic()</script>', status: 'abierto', createdAt: new Date().toISOString() }] } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(window.document.querySelectorAll('script,img').length, 0);
  assert.match(window.document.querySelector('#ticketSupport').textContent, /Ya tienes un ticket abierto/);
  window.document.querySelector('#tickets button').click(); await new Promise(resolve => setImmediate(resolve));
  const conversation = window.document.querySelector('.support-conversation');
  assert.match(conversation.textContent, /<script>bad\(\)<\/script>/); assert.equal(conversation.querySelectorAll('script,img').length, 0);
  const input = window.document.querySelector('textarea'); input.value = 'Mensaje desde web';
  input.form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); await new Promise(resolve => setImmediate(resolve));
  assert.ok(calls.some(call => call.url === '/api/tickets/existing/messages' && call.body?.content === 'Mensaje desde web'));
  window.document.dispatchEvent(new window.CustomEvent('citizen:updated', { detail: { me: user, tickets: [] } })); await new Promise(resolve => setImmediate(resolve));
  assert.match(window.document.querySelector('#ticketSupport').textContent, /El bot no está conectado/);
  assert.equal(window.document.querySelector('#ticketSupport button').disabled, true);
  window.close();
});

test('respuestas staff se notifican sin perder debounce y sesión caducada limpia canales recién creados', async t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'citizen-support-runtime-'));
  process.env.MAESRP_DATA_DIR = path.join(temporary, 'bot/data');
  require('../lib/config').root = temporary;
  const store = require('../lib/store'); store.init();
  const runtime = require('../bot/runtime');
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  store.write('settings', { staffRoleIds: [other] });
  store.write('tickets', { items: { active: { id: 'active', userId: owner, channelId: 'ticket-channel', status: 'abierto', lastActiveAt: new Date().toISOString() } } });
  const original = store.update; let writes = 0;
  store.update = (...args) => { writes++; return original(...args); };
  try {
    const message = { guildId, author: { id: other, bot: false }, member: { roles: [other] }, channelId: 'ticket-channel', createdAt: new Date(),
      guild: { members: { cache: new Map([[owner, { id: owner }]]) } }, channel: { permissionsFor: () => ({ has: () => true }), send: async () => {} } };
    for (let i = 0; i < 30; i++) await runtime.handleMessage(message);
    assert.equal(writes, 1); const saved = store.read('tickets').items.active;
    assert.equal(saved.lastReplyBy, other); assert.equal(saved.lastReplySource, 'discord'); assert.ok(saved.lastReplyAt);
    store.write('tickets', { items: {} });
    let valid = true, deleted = false, sent = false;
    const interaction = { guildId, user: { id: '333333333333333333', username: 'Fixture' }, member: { roles: [] }, client: { user: { id: other } },
      guild: { id: guildId, channels: { create: async () => { valid = false; return { id: 'new-channel', delete: async () => { deleted = true; }, send: async () => { sent = true; } }; } } },
    };
    await assert.rejects(runtime.createTicket(interaction, { requestId: 'request-runtime-123456', assertSession: () => { if (!valid) throw Object.assign(Error('Sesión finalizada'), { status: 401 }); } }), { status: 401 });
    assert.equal(deleted, true); assert.equal(sent, false); assert.deepEqual(store.read('tickets').items, {});
  } finally { store.update = original; }
});

test('UI de soporte elimina borradores e identificadores al cambiar de cuenta e ignora callbacks antiguos', async () => {
  const fs = require('node:fs'), { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="ticketSupport"></div><div id="tickets"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const { window } = dom;
  const pendingAvailability = [], pendingCreates = [], calls = [], notices = []; let refreshes = 0;
  window.CitizenApp = { notice: text => notices.push(text), refresh: async () => { refreshes++; }, api: (url, body) => {
    calls.push({ url, body });
    if (url === '/api/profile/support') return new Promise((resolve, reject) => pendingAvailability.push({ resolve, reject }));
    if (url === '/api/tickets') return new Promise((resolve, reject) => pendingCreates.push({ resolve, reject }));
    return Promise.resolve({ items: [] });
  } };
  window.eval(fs.readFileSync(require.resolve('../public/js/citizen-support.js'), 'utf8'));
  const publish = (me, demo = false) => window.document.dispatchEvent(new window.CustomEvent('citizen:updated', { detail: { me, demo, tickets: [] } }));
  const settle = () => new Promise(resolve => setImmediate(resolve));
  publish(user); pendingAvailability.shift().resolve({ available: true, message: 'Conectado' }); await settle();
  const oldInput = window.document.querySelector('input'); oldInput.value = 'Asunto privado de la primera cuenta'; oldInput.dispatchEvent(new window.Event('input'));
  oldInput.form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const firstCreateId = calls.find(call => call.url === '/api/tickets').body.requestId;
  publish({ discordId: other });
  assert.equal(window.document.querySelector('input').value, '');
  assert.equal(window.document.body.textContent.includes('Asunto privado'), false);
  pendingAvailability.shift().reject(Error('Fallo de conexión de la segunda cuenta')); await settle();
  assert.equal(window.document.querySelector('input').value, '');
  assert.match(window.document.body.textContent, /Fallo de conexión/);
  pendingCreates.shift().resolve({ success: true }); await settle();
  assert.equal(notices.length, 0); assert.equal(refreshes, 0);
  publish({ discordId: other }); pendingAvailability.shift().resolve({ available: true, message: 'Conectado' }); await settle();
  const secondInput = window.document.querySelector('input'); secondInput.value = 'Nuevo asunto';
  secondInput.form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  const secondCreateId = calls.filter(call => call.url === '/api/tickets')[1].body.requestId;
  assert.notEqual(secondCreateId, firstCreateId);
  publish(null, true); pendingCreates.shift().reject(Error('Error antiguo privado')); await settle();
  assert.equal(window.document.querySelector('input'), null); assert.equal(window.document.body.textContent.includes('Error antiguo'), false);
  assert.equal(notices.length, 0); assert.equal(refreshes, 0);
  publish(user); pendingAvailability.shift().resolve({ available: false, message: 'Desconectado' }); await settle();
  assert.equal(window.document.querySelector('input').value, '');
  window.close();
});

test('respuesta pendiente de conversación no abre mensajes ni acciones de una sesión anterior', async () => {
  const fs = require('node:fs'), { JSDOM } = require('jsdom');
  const dom = new JSDOM('<div id="ticketSupport"></div><div id="tickets"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const { window } = dom; let resolveSend, messageReads = 0;
  window.CitizenApp = { notice: () => {}, refresh: async () => {}, api: (url, body) => {
    if (url === '/api/profile/support') return Promise.resolve({ available: true, message: 'Conectado' });
    if (body) return new Promise(resolve => { resolveSend = resolve; });
    messageReads++; return Promise.resolve({ items: [{ id: 'private', content: 'Contenido de la cuenta anterior', author: 'Cuenta anterior', createdAt: new Date().toISOString() }] });
  } };
  window.eval(fs.readFileSync(require.resolve('../public/js/citizen-support.js'), 'utf8'));
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const publish = (me, tickets) => window.document.dispatchEvent(new window.CustomEvent('citizen:updated', { detail: { me, tickets } }));
  publish(user, [{ id: 'existing', topic: 'Consulta privada', status: 'abierto' }]); await settle();
  const oldOpen = window.document.querySelector('#tickets button'); oldOpen.click(); await settle();
  const input = window.document.querySelector('textarea'); input.value = 'Mensaje pendiente'; input.form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(messageReads, 1);
  publish({ discordId: other }, []); await settle();
  resolveSend({ success: true }); await settle(); oldOpen.click(); await settle();
  assert.equal(messageReads, 1); assert.equal(window.document.querySelector('textarea'), null);
  assert.equal(window.document.body.textContent.includes('cuenta anterior'), false);
  window.close();
});
