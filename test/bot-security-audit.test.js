const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'maes-bot-audit-'));
process.env.MAESRP_DATA_DIR = path.join(temporary, 'bot/data');
process.env.DISCORD_TOKEN = '';
process.env.DISCORD_GUILD_ID = '777777777777777777';
process.env.ADMIN_GUILD_ID = '888888888888888888';
require('../lib/config').root = temporary;
const store = require('../lib/store'); store.init();
const runtime = require('../bot/runtime'), domain = require('../bot/domain');
const operations = require('../bot/operations'), pdf = require('../lib/pdf');
const { gate } = require('../lib/bot-resource-limits');
const { Collection } = require('discord.js');
const citizen = '111111111111111111', admin = { id: '222222222222222222', admin: true };
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('PDF públicos rechazan duplicados concurrentes y limitan el trabajo global', async () => {
  const original = pdf.identityPdf; let active = 0, peak = 0, release;
  const waiting = new Promise(resolve => { release = resolve; });
  pdf.identityPdf = async () => { active++; peak = Math.max(peak, active); await waiting; active--; return 'fixture.pdf'; };
  try {
    const first = operations.identityPdf({ discordId: citizen });
    await assert.rejects(operations.identityPdf({ discordId: citizen }), { status: 429 });
    const second = operations.identityPdf({ discordId: admin.id });
    await assert.rejects(operations.identityPdf({ discordId: '333333333333333333' }), { status: 429 });
    assert.equal(peak, 2); release(); await Promise.all([first, second]);
    assert.equal(await operations.identityPdf({ discordId: citizen }), 'fixture.pdf');
  } finally { release(); pdf.identityPdf = original; }
});

test('cuotas por usuario expiran y los errores liberan concurrencia', async () => {
  let now = 0;
  const run = gate({ limit: 2, windowMs: 1000, concurrency: 1, maxKeys: 2, now: () => now });
  await assert.rejects(run('a', async () => { throw Error('fallo simulado'); }), /simulado/);
  assert.equal(await run('a', async () => 1), 1);
  await assert.rejects(run('a', async () => 2), { status: 429 });
  assert.equal(await run('b', async () => 3), 3);
  await assert.rejects(run('c', async () => 4), { status: 429 });
  now = 1001;
  assert.equal(await run('c', async () => 5), 5);
});

function ticketInteraction(id) {
  return { guildId: process.env.DISCORD_GUILD_ID, user: { id, username: 'Fixture' }, member: { roles: [] },
    client: { user: { id: '999999999999999999' } }, options: { getString: () => 'Solicitud de prueba' },
    guild: { id: process.env.DISCORD_GUILD_ID, channels: { create: async () => {
      ticketInteraction.created++; return { id: 'channel-' + ticketInteraction.created, send: async () => {}, delete: async () => {} };
    } } } };
}
ticketInteraction.created = 0;
test('cerrar un ticket no permite crear canales en bucle ni saltarse el cupo', async () => {
  store.write('settings', { staffRoleIds: ['555555555555555555'] });
  store.write('tickets', { stats: {}, items: {} });
  const request = ticketInteraction('444444444444444444');
  const opened = await runtime.createTicket(request);
  domain.ticketClose({ id: request.user.id }, opened.id);
  await assert.rejects(runtime.createTicket(request), { status: 429 });
  assert.equal(ticketInteraction.created, 1);
  store.write('tickets', { stats: {}, items: Object.fromEntries(Array.from({ length: 100 }, (_, index) => [String(index), { id: String(index), userId: String(index), status: 'abierto' }])) });
  await assert.rejects(runtime.createTicket(ticketInteraction('666666666666666666')), { status: 429 });
  assert.equal(ticketInteraction.created, 1);
});

test('mensajes de otros servidores y mensajes fuera de tickets no escriben SQLite', async () => {
  store.write('tickets', { stats: {}, items: { active: { id: 'active', channelId: 'ticket-channel', status: 'abierto', lastActiveAt: new Date(0).toISOString() } } });
  const original = store.update; let writes = 0;
  store.update = (...args) => { writes++; return original(...args); };
  try {
    const message = { guildId: 'unauthorized', author: { id: citizen, bot: false }, channelId: 'ticket-channel', channel: { send: async () => {} } };
    await runtime.handleMessage(message);
    await runtime.handleMessage({ ...message, guildId: process.env.DISCORD_GUILD_ID, channelId: 'ordinary-channel' });
    assert.equal(writes, 0);
    const valid = { ...message, guildId: process.env.DISCORD_GUILD_ID };
    await runtime.handleMessage(valid); await runtime.handleMessage(valid);
    assert.equal(writes, 1);
    assert.ok(Date.parse(store.read('tickets').items.active.lastActiveAt) > 0);
  } finally { store.update = original; }
});

function messages(first, count, content = 'fixture') {
  const batch = new Collection();
  for (let index = first; index > first - count; index--) {
    batch.set(String(index), { id: String(index), createdTimestamp: index, createdAt: new Date(index), author: { tag: 'Fixture' }, content: `${content}-${index}`, attachments: new Map() });
  }
  return batch;
}
test('transcripción por páginas conserva orden, escapa HTML y limpia temporales', async () => {
  let calls = 0;
  const channel = { messages: { fetch: async () => (++calls === 1 ? messages(149, 100) : messages(49, 50, '<script>fixture</script>')) } };
  const filename = await runtime.transcript(channel, { id: 'ordered-transcript' });
  const html = fs.readFileSync(path.join(temporary, 'public/uploads', filename), 'utf8');
  assert.equal(calls, 2);
  assert.ok(html.indexOf('fixture&lt;/script&gt;-0') < html.indexOf('fixture-149'));
  assert.doesNotMatch(html, /<script>/);
  assert.equal(fs.statSync(path.join(temporary, 'public/uploads', filename)).mode & 0o777, 0o600);
  assert.ok(!fs.readdirSync(path.join(temporary, 'public/uploads')).some(name => name.startsWith('.ticket-')));
});

test('historial excesivo se rechaza sin publicar un archivo truncado ni cerrar el ticket', async () => {
  const ticket = domain.ticketCreate({ id: '123456789012345678' }, 'Prueba', 'bounded-channel');
  const channel = { messages: { fetch: async () => messages(99, 100, 'x'.repeat(100)) } };
  await assert.rejects(runtime.transcript(channel, ticket, { maxBytes: 100 }), { status: 429 });
  assert.equal(store.read('tickets').items[ticket.id].status, 'abierto');
  assert.equal(fs.existsSync(path.join(temporary, 'public/uploads', 'ticket_' + ticket.id + '.html')), false);
  assert.ok(!fs.readdirSync(path.join(temporary, 'public/uploads')).some(name => name.startsWith('.ticket-')));
  await assert.rejects(runtime.transcript(channel, { id: '../escape' }), /inválido/);
});

test('CK elimina la cédula por su clave real y conserva trazas de moderación y otros usuarios', () => {
  const other = '987654321098765432';
  store.write('cedulas', {});
  domain.registerCitizen({ id: citizen }, { numeroCedula: 'RP-TEST', nombre: 'Persona', apellidos: 'Uno' });
  domain.registerCitizen({ id: other }, { numeroCedula: 'RP-OTHER', nombre: 'Persona', apellidos: 'Dos' });
  store.write('bans', [{ userId: citizen, id: 'keep' }]);
  store.write('sanciones', { [citizen]: { sanctions: [{ id: 'keep' }] } });
  store.write('multas', [{ documento: 'RP-TEST' }, { userId: other, documento: 'RP-OTHER' }]);
  const result = require('../bot/character').resetCharacter(admin, citizen, 'Nuevo personaje');
  assert.equal(result.cedulas, 1); assert.equal(domain.citizen(citizen), null); assert.ok(domain.citizen(other));
  assert.equal(store.read('multas').length, 1); assert.equal(store.read('bans')[0].id, 'keep');
  assert.equal(store.read('sanciones')[citizen].sanctions[0].id, 'keep');
});

test('ER:LC rechaza selectores masivos y comandos no autorizados antes de consultar APIs', async () => {
  const command = require('../bot/commands/sistema/erlc');
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => { calls++; throw Error('No debe consultar Roblox'); };
  const run = (selector, target, sub = 'command', actor = { id: citizen, moderator: true }) => command({
    i: { options: { getSubcommand: () => sub } }, c: actor, domain,
    str: name => ({ selector, usuario1: target })[name],
    prc: { command: async () => { calls++; }, status: async () => { calls++; } }, store, respond: async () => {},
  });
  try {
    for (const target of ['all', 'others', 'random', 'me', 'ALL', 'Jugador,Otro'])
      await assert.rejects(run('kick', target), /individual/);
    await assert.rejects(run('execute', 'Player'), /no autorizado/);
    await assert.rejects(run('kick', 'Player', 'unknown'), /inválida/);
    for (const selector of ['ban', 'unban', 'kill']) await assert.rejects(run(selector, 'Player'), { status: 403 });
    assert.equal(calls, 0);
  } finally { global.fetch = originalFetch; }
});

test('ER:LC resuelve usuarios a IDs concretos antes de ejecutar una acción simulada', async () => {
  const command = require('../bot/commands/sistema/erlc');
  const originalFetch = global.fetch; const sent = [];
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://users.roblox.com/v1/usernames/users');
    const name = JSON.parse(options.body).usernames[0];
    return { ok: true, json: async () => ({ data: [{ id: name === 'JugadorUno' ? 12345 : 67890, name }] }) };
  };
  try {
    await command({ i: { options: { getSubcommand: () => 'command' } }, c: admin, domain,
      str: name => ({ selector: 'kick', usuario1: 'JugadorUno', usuario2: 'JugadorDos' })[name],
      prc: { command: async text => { sent.push(text); } }, store, respond: async () => {} });
    assert.deepEqual(sent, [':kick 12345,67890']);
  } finally { global.fetch = originalFetch; }
});

test('reservas de tickets impiden sobrepasar el cupo con peticiones simultáneas', async () => {
  store.write('tickets', { stats: {}, items: Object.fromEntries(Array.from({ length: 99 }, (_, index) => [String(index), { id: String(index), userId: String(index), status: 'abierto' }])) });
  const first = ticketInteraction('121212121212121212');
  let release;
  const waiting = new Promise(resolve => { release = resolve; });
  first.guild.channels.create = async () => {
    await waiting; return { id: 'reserved-channel', send: async () => {}, delete: async () => {} };
  };
  const pending = runtime.createTicket(first);
  try {
    await assert.rejects(runtime.createTicket(ticketInteraction('131313131313131313')), { status: 429 });
  } finally { release(); }
  await pending;
  assert.equal(Object.values(store.read('tickets').items).filter(ticket => ticket.status === 'abierto').length, 100);
});

test('canales de tickets antiguos no pueden agotar todo el cupo del servidor', async () => {
  store.write('tickets', { stats: {}, items: {} });
  const request = ticketInteraction('141414141414141414');
  request.guild.channels.cache = new Map(Array.from({ length: 450 }, (_, index) => [String(index), {}]));
  const previous = ticketInteraction.created;
  await assert.rejects(runtime.createTicket(request), /archivar canales antiguos/);
  assert.equal(ticketInteraction.created, previous);
});

test('cerrar tickets exige el canal original y evita volver a transcribir un ticket cerrado', async () => {
  const ticket = domain.ticketCreate({ id: '151515151515151515' }, 'Prueba', 'correct-channel');
  const request = { customId: 'ticket:close:' + ticket.id, user: { id: ticket.userId }, member: { roles: [] }, channelId: 'other-channel' };
  await assert.rejects(runtime.component(request), /no pertenece al canal/);
  assert.equal(store.read('tickets').items[ticket.id].status, 'abierto');
  domain.ticketClose({ id: ticket.userId }, ticket.id);
  await assert.rejects(runtime.component({ ...request, channelId: 'correct-channel' }), /ya cerrado/);
});

test('ban, unban y aprobación de castigo rechazan selectores masivos sin acciones externas', async () => {
  const originalFetch = global.fetch; let calls = 0;
  global.fetch = async () => { calls++; throw Error('No debe consultar Roblox'); };
  const prc = { command: async () => { calls++; } };
  try {
    for (const selector of ['all', 'others', 'random', 'me']) {
      await assert.rejects(operations.ban(admin, citizen, selector, 'Prueba', 1, prc), /selectores masivos/);
      await assert.rejects(operations.unban(admin, selector, prc), /selectores masivos/);
      store.write('cedulas', { 'RP-MASS': { numeroCedula: 'RP-MASS', discordId: citizen, roblox: { username: selector } } });
      for (const level of [2, 3]) {
        store.write('sanciones', { [citizen]: { sanctions: [{ id: 'pending', estado: 'activa', pendingApproval: true, nivel: level, motivo: 'Prueba' }] } });
        await assert.rejects(operations.approvePunishment(admin, citizen, 'pending', prc), /selectores masivos/);
      }
    }
    assert.equal(calls, 0);
    assert.equal(store.read('sanciones')[citizen].sanctions[0].pendingApproval, true);
  } finally { global.fetch = originalFetch; }
});

test('acciones individuales guardan IDs canónicos y mantienen compatibilidad con nombres antiguos', async () => {
  store.write('bans', []);
  const originalFetch = global.fetch, sent = [];
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://users.roblox.com/v1/usernames/users');
    const name = JSON.parse(options.body).usernames[0];
    return { ok: true, json: async () => ({ data: [{ id: 54321, name: name === 'jugadorantiguo' ? 'JugadorAntiguo' : 'JugadorActual' }] }) };
  };
  const prc = { command: async text => { sent.push(text); } };
  try {
    const created = await operations.ban(admin, citizen, 'JugadorActual', 'Prueba', 1, prc);
    assert.equal(created.roblox, '54321'); assert.equal(created.robloxUserId, '54321'); assert.equal(created.robloxUsername, 'JugadorActual');
    await operations.unban(admin, '54321', prc);
    store.write('bans', [{ id: 'legacy', userId: citizen, roblox: 'jugadorantiguo', status: 'aplicado' }]);
    const result = await operations.unban(admin, 'jugadorantiguo', prc);
    assert.deepEqual(result.userIds, [citizen]); assert.equal(store.read('bans')[0].status, 'retirado');
    assert.equal(store.read('bans')[0].robloxUserId, '54321');
    store.write('cedulas', { 'RP-CANON': { numeroCedula: 'RP-CANON', discordId: citizen, roblox: { username: 'JugadorActual' } } });
    store.write('sanciones', { [citizen]: { sanctions: [{ id: 'kick', estado: 'activa', pendingApproval: true, nivel: 2 }] } });
    await operations.approvePunishment(admin, citizen, 'kick', prc);
    assert.deepEqual(sent, [':ban 54321', ':unban 54321', ':unban 54321', ':kick 54321']);
  } finally { global.fetch = originalFetch; }
});

test('CK respeta el propietario explícito aunque otro personaje reutilice su número de cédula', () => {
  const other = '161616161616161616';
  store.write('cedulas', { 'RP-RECYCLED': { numeroCedula: 'RP-RECYCLED', discordId: citizen } });
  store.write('multas', [
    { id: 'current', userId: citizen, documento: 'RP-RECYCLED' },
    { id: 'legacy-unowned', documento: 'RP-RECYCLED' },
    { id: 'other-owned', userId: other, documento: 'RP-RECYCLED' },
    { id: 'other-priority', userId: other, discordId: citizen, documento: 'RP-RECYCLED' },
    { id: 'other-legacy', discordId: other, documento: 'RP-RECYCLED' },
  ]);
  require('../bot/character').resetCharacter(admin, citizen, 'Nuevo personaje');
  assert.deepEqual(store.read('multas').map(record => record.id), ['other-owned', 'other-priority', 'other-legacy']);
});

test('cola ER:LC acota trabajos pendientes, conserva orden y libera el cupo al terminar', async () => {
  const { PRCClient } = require('../bot/prc');
  let release, calls = 0, active = 0, peak = 0; const paths = [];
  const waiting = new Promise(resolve => { release = resolve; });
  const prc = new PRCClient({ serverKey: 'fixture-only', delay: 0, maxPending: 2, fetchImpl: async url => {
    calls++; active++; peak = Math.max(peak, active); paths.push(url);
    if (calls === 1) await waiting;
    active--; return { ok: true, json: async () => ({ success: true }) };
  } });
  const first = prc.status(), second = prc.players();
  try {
    await assert.rejects(prc.command(':h No debe enviarse'), { status: 429 });
    assert.equal(prc.pending, 2); assert.equal(calls, 1);
  } finally { release(); }
  await Promise.all([first, second]);
  assert.equal(peak, 1); assert.equal(prc.pending, 0); assert.equal(calls, 2);
  assert.deepEqual(paths.map(url => new URL(url).pathname), ['/v1/server', '/v1/server/players']);
  await prc.status(); assert.equal(calls, 3);
});

test('error o falta de clave ER:LC libera reservas sin reintentar la acción', async () => {
  const { PRCClient } = require('../bot/prc'); let calls = 0;
  const prc = new PRCClient({ serverKey: 'fixture-only', delay: 0, maxPending: 2, fetchImpl: async () => {
    calls++; if (calls === 1) throw Error('fallo simulado');
    return { ok: true, json: async () => ({ success: true }) };
  } });
  const failed = prc.command(':h Fixture'), queued = prc.status();
  await assert.rejects(failed, /No se reintentó/); await queued;
  assert.equal(calls, 2); assert.equal(prc.pending, 0);
  await prc.status(); assert.equal(calls, 3);
  const empty = new PRCClient({ serverKey: '', delay: 0, maxPending: 1, fetchImpl: async () => { throw Error('No debe llamarse'); } });
  await assert.rejects(empty.status(), /Configura/); assert.equal(empty.pending, 0);
  await assert.rejects(empty.status(), /Configura/); assert.equal(empty.pending, 0);
});
