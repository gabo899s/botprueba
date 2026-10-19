const { createHash } = require('node:crypto');
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { gate } = require('./bot-resource-limits');
const error = (message, status = 400) => Object.assign(Error(message), { status });
const requestKey = value => {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{12,80}$/.test(value)) throw error('Identificador de solicitud inválido.');
  return value;
};
function text(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value))
    throw error(`${label} debe contener entre 1 y ${max} caracteres.`);
  return value.trim();
}
function createSupportService(options = {}) {
  const store = options.store || require('./store');
  const runtime = options.runtime || (() => require('../bot/runtime'));
  const config = options.settings || require('../bot/settings');
  const pending = new Map();
  const sendGate = gate({ limit: 10, windowMs: 60000, concurrency: 4 });
  const readGate = gate({ limit: 30, windowMs: 60000, concurrency: 8 });
  const check = fn => { if (fn) fn(); };
  const userId = user => {
    const id = user?.discordId || user?.id;
    if (!/^\d{17,20}$/.test(id || '')) throw error('Inicia sesión con Discord.', 401);
    return id;
  };
  function owned(user, id) {
    if (!/^[\w-]{1,80}$/.test(id || '')) throw error('Ticket no encontrado.', 404);
    const ticket = store.read('tickets').items?.[id];
    if (!ticket || ticket.userId !== userId(user)) throw error('Ticket no encontrado.', 404);
    return ticket;
  }
  function ready() {
    const rt = runtime();
    if (!rt.client?.isReady?.() || !process.env.DISCORD_GUILD_ID)
      throw error('El bot de soporte no está conectado. Inténtalo cuando esté disponible.', 503);
    return rt;
  }
  function availability() {
    try {
      ready();
      const cfg = config.get();
      const enabled = [...cfg.staffRoleIds, ...cfg.moderatorRoleIds, ...cfg.adminRoleIds].length > 0;
      return { available: enabled, message: enabled ? 'Soporte conectado con Discord.' : 'El administrador debe configurar los roles de soporte.' };
    } catch (e) { return { available: false, message: e.message }; }
  }
  async function memberContext(user, assertSession) {
    const rt = ready(), id = userId(user), gid = process.env.DISCORD_GUILD_ID;
    const guild = await rt.client.guilds.fetch(gid);
    check(assertSession);
    let member;
    try { member = await guild.members.fetch(id); }
    catch (e) { if (e.code === 10007) throw error('Debes pertenecer al servidor de Discord para usar el soporte.', 403); throw e; }
    check(assertSession);
    return { rt, guild, member, id };
  }
  async function ticketContext(user, ticketId, assertSession, sending = false) {
    let ticket = owned(user, ticketId);
    const context = await memberContext(user, assertSession);
    ticket = owned(user, ticketId);
    if (ticket.guildId && ticket.guildId !== context.guild.id) throw error('Ticket no disponible en este servidor.', 403);
    const channel = await context.guild.channels.fetch(ticket.channelId);
    check(assertSession);
    ticket = owned(user, ticketId);
    const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
    if (sending) needed.push(PermissionFlagsBits.SendMessages);
    if (!channel || channel.type !== ChannelType.GuildText || channel.guildId !== context.guild.id || !channel.permissionsFor(context.member)?.has(needed))
      throw error('No tienes acceso a la conversación de este ticket.', 403);
    if (sending && ticket.status !== 'abierto') throw error('El ticket está cerrado.', 409);
    return { ...context, ticket, channel };
  }
  function once(key, fn) {
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 16) throw error('Hay demasiadas operaciones de soporte. Inténtalo más tarde.', 429);
    const promise = Promise.resolve().then(fn).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  async function create(user, body, assertSession) {
    const id = userId(user), topic = text(body?.topic, 150, 'El asunto'), requestId = requestKey(body?.requestId);
    const find = () => Object.values(store.read('tickets').items || {}).find(t => t.userId === id && t.webRequestId === requestId);
    check(assertSession);
    const existing = find();
    if (existing) { if (existing.topic !== topic) throw error('Esta solicitud ya se usó con otro asunto.', 409); return existing; }
    const ticket = await once(`create:${id}:${requestId}`, async () => {
      const context = await memberContext(user, assertSession);
      const existing = find(); if (existing) return existing;
      check(assertSession);
      return context.rt.createTicket({
        guildId: context.guild.id, guild: context.guild, member: context.member,
        user: context.member.user, client: context.rt.client,
        options: { getString: () => topic },
      }, { assertSession, requestId });
    });
    check(assertSession);
    if (ticket.topic !== topic) throw error('Esta solicitud ya se usó con otro asunto.', 409);
    return ticket;
  }
  async function messages(user, ticketId, assertSession, options = {}) {
    const before = options.before;
    if (before !== undefined && (typeof before !== 'string' || !/^\d{17,20}$/.test(before))) throw error('Cursor de conversación inválido.');
    const id = userId(user);
    return readGate(id, async () => {
      const { channel } = await ticketContext(user, ticketId, assertSession);
      const fetched = await channel.messages.fetch({ limit: 50, ...(before ? { before } : {}) });
      check(assertSession);
      const ticket = owned(user, ticketId);
      // Only the owner-visible text channel is exposed: no staff threads,
      // embeds, internal notes or arbitrary attachments are serialized.
      const ownMessageIds = new Set(Object.values(ticket.webMessages || {}).map(m => m.messageId));
      const values = [...fetched.values()];
      const result = values.filter(m => !m.system && (!m.author.bot || ownMessageIds.has(m.id)))
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp).map(m => ({
          id: m.id, content: String(m.content || '').slice(0, 2000),
          author: ownMessageIds.has(m.id) ? 'Tú · panel ciudadano' : (m.author.globalName || m.author.username || 'Usuario'),
          own: ownMessageIds.has(m.id) || m.author.id === id,
          createdAt: new Date(m.createdTimestamp).toISOString(),
        }));
      // Cursor is derived from the fetched page, including hidden system entries,
      // so filtering cannot strand older public conversation messages.
      const ids = values.map(m => m.id).filter(id => /^\d{17,20}$/.test(id));
      const nextBefore = values.length === 50 && ids.length ? ids.reduce((a, b) => BigInt(a) < BigInt(b) ? a : b) : null;
      Object.defineProperty(result, 'nextBefore', { value: nextBefore });
      return result;
    });
  }
  async function send(user, ticketId, body, assertSession) {
    const id = userId(user), content = text(body?.content, 1600, 'El mensaje'), requestId = requestKey(body?.requestId);
    const fingerprint = createHash('sha256').update(content).digest('hex');
    const receipt = () => owned(user, ticketId).webMessages?.[requestId];
    check(assertSession);
    let existing = receipt();
    if (existing) { if (existing.fingerprint !== fingerprint) throw error('Esta solicitud ya se usó con otro mensaje.', 409); if (!existing.messageId) throw error('El envío anterior no pudo confirmarse. Revisa el ticket en Discord antes de enviar otra vez.', 409); return existing; }
    const result = await once(`send:${id}:${ticketId}:${requestId}`, () => sendGate(id, async () => {
      const { channel, ticket } = await ticketContext(user, ticketId, assertSession, true);
      existing = receipt(); if (existing) { if (!existing.messageId) throw error('El envío anterior no pudo confirmarse. Revisa el ticket en Discord antes de enviar otra vez.', 409); return existing; }
      if (Object.keys(ticket.webMessages || {}).length >= 1000) throw error('Este ticket alcanzó el límite de mensajes web. Continúa en Discord.', 429);
      check(assertSession);
      // Persist an intent before the network call. An uncertain response must
      // be reviewed in Discord instead of automatically replayed after nonce expiry.
      store.update('tickets', db => {
        const current = db.items?.[ticketId];
        if (!current || current.userId !== id || current.status !== 'abierto') throw error('Ticket cerrado o inexistente.', 409);
        current.webMessages ||= {};
        current.webMessages[requestId] = { fingerprint, status: 'pending', createdAt: new Date().toISOString() };
      });
      let message;
      try { message = await channel.send({
        content: `Respuesta del ciudadano desde el panel (${id}):\n\n${content.replace(/@/g, '＠')}`,
        allowedMentions: { parse: [], repliedUser: false },
        nonce: createHash('sha256').update(`${id}:${ticketId}:${requestId}`).digest('hex').slice(0, 24),
        enforceNonce: true,
      }); } catch {
        throw error('No se pudo confirmar el envío. Revisa el ticket en Discord antes de enviar otra vez.', 503);
      }
      // Record a completed external write even if logout happened in flight:
      // replaying the request must never send the same message a second time.
      const result = { messageId: message.id, fingerprint, status: 'sent', createdAt: new Date().toISOString() };
      store.update('tickets', db => {
        const current = db.items?.[ticketId];
        if (!current || current.userId !== id) return;
        current.webMessages ||= {};
        current.webMessages[requestId] = result;
        current.lastActiveAt = result.createdAt;
        current.lastCitizenMessageAt = result.createdAt;
      });
      return result;
    }));
    check(assertSession);
    if (result.fingerprint !== fingerprint) throw error('Esta solicitud ya se usó con otro mensaje.', 409);
    return result;
  }
  return { availability, create, messages, send };
}
function mountCitizenSupport(app, { auth, wrap, assertSession, service = createSupportService() }) {
  const guard = req => () => assertSession(req);
  app.get('/api/profile/support', auth, (req, res) => res.json({ success: true, ...service.availability() }));
  app.post('/api/tickets', auth, wrap(async (req, res) => {
    const ticket = await service.create(req.user, req.body, guard(req));
    res.json({ success: true, ticket: { id: ticket.id, topic: ticket.topic, status: ticket.status, createdAt: ticket.createdAt } });
  }));
  app.get('/api/tickets/:id/messages', auth, wrap(async (req, res) => {
    const items = await service.messages(req.user, req.params.id, guard(req), { before: req.query.before });
    res.json({ success: true, items, nextBefore: items.nextBefore || null });
  }));
  app.post('/api/tickets/:id/messages', auth, wrap(async (req, res) => {
    const result = await service.send(req.user, req.params.id, req.body, guard(req));
    res.json({ success: true, messageId: result.messageId });
  }));
}
module.exports = { mountCitizenSupport, createSupportService };
