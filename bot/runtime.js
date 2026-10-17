const { v2Payload } = require("./presentation");
const fs = require("node:fs"),
  path = require("node:path");
const crypto = require("node:crypto");
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
} = require("discord.js");
const { root, dataDir, baseUrl } = require("../lib/config"),
  store = require("../lib/store"),
  domain = require("./domain"),
  settings = require("./settings"),
  operations = require("./operations"),
  { PRCClient } = require("./prc"),
  { commands } = require("./commands");
const { buildMessage } = require("./message-builder");
const economy = require("./economy");
const { ticketJob, transcriptJob, busy } = require("../lib/bot-resource-limits");
const prc = new PRCClient();
let client = null,
  queueBusy = false;
let maintenanceTimer = null;
function configuredGuild(guildId) {
  return [process.env.DISCORD_GUILD_ID, process.env.ADMIN_GUILD_ID].filter(Boolean).includes(guildId);
}
async function handleMessage(message) {
  if (message.author.bot || !configuredGuild(message.guildId)) return;
  try {
    if (await require("./message-drafts").receive(message)) return;
    const ticket = Object.values(store.read("tickets").items || {}).find(t => t.channelId === message.channelId && t.status === "abierto");
    // Un mensaje ordinario no debe iniciar una transacción ni reescribir todos
    // los tickets. La actividad se agrupa para resistir ráfagas en un ticket.
    if (!ticket) return;
    const staffReply = message.author.id !== ticket.userId && message.member &&
      ["staff", "moderator", "admin"].some(scope => settings.allowed(message.member, scope));
    const owner = message.guild?.members?.cache?.get(ticket.userId);
    const ownerCanRead = owner && message.channel?.permissionsFor?.(owner)?.has(PermissionFlagsBits.ViewChannel);
    const at = Date.now();
    const activityDue = at - Date.parse(ticket.lastActiveAt) >= 15000;
    const replyDue = staffReply && ownerCanRead &&
      (!ticket.lastReplyRecordedAt || at - Date.parse(ticket.lastReplyRecordedAt) >= 15000);
    if (!activityDue && !replyDue) return;
    store.update("tickets", db => {
      const current = db.items?.[ticket.id];
      if (current?.status !== "abierto" || current.channelId !== message.channelId) return;
      current.lastActiveAt = new Date().toISOString();
      if (replyDue) {
        current.lastReplyRecordedAt = new Date(at).toISOString();
        current.lastReplyAt = message.createdAt?.toISOString() || new Date().toISOString();
        current.lastReplyBy = message.author.id;
        current.lastReplySource = "discord";
      }
    });
  } catch (error) {
    console.error("Mensaje del bot:", error.message);
    await message.channel.send(v2Payload({ embeds: [embed("No se pudo completar la acción", safe(error.message))] })).catch(() => {});
  }
}
function ctx(i) {
  const m = i.member;
  return {
    id: i.user.id,
    name: i.user.globalName || i.user.username,
    admin: settings.allowed(m, "admin"),
    staff: settings.allowed(m, "staff"),
    moderator: settings.allowed(m, "moderator"),
    police: settings.allowed(m, "police"),
    voiceOk: settings.voiceExempt(m) || (!!settings.get().channels.voiceActivity && m?.voice?.channelId === settings.get().channels.voiceActivity),
  };
}
function safe(value, max = 3800) {
  return String(value ?? "Sin registros")
    .replace(/@/g, "＠")
    .slice(0, max);
}
function embed(title, body) {
  return { title: title.slice(0, 256), description: safe(body), error: title === "No se pudo completar la acción" };
}

function rows(values) {
  return values.length
    ? values
        .slice(0, 20)
        .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
        .join("\n")
    : "Sin registros.";
}
async function respond(i, title, body, files = []) {
  const payload = {
    embeds: [embed(title, body)],
    files,
    allowedMentions: { parse: [] },
  };
  if (i.deferred || i.replied) return i.editReply(v2Payload(payload));
  return i.reply(v2Payload({ ...payload, flags: 64 }));
}
async function member(user, guild) {
  return guild.members.fetch(user);
}
async function log(guild, title, body) {
  const cid = settings.get().channels.logs;
  if (!cid) return;
  try {
    const ch = await guild.channels.fetch(cid);
    if (ch?.isTextBased())
      await ch.send(v2Payload({
        embeds: [embed(title, body)],
        allowedMentions: { parse: [] },
      }));
  } catch (e) {
    console.error("No se pudo enviar el log:", e.message);
  }
}
async function examMessage(i, type, exam) {
  if (exam.completed) {
    const extra =
      type === "license"
        ? (exam.passed ? " La licencia quedó registrada." : " La licencia no se ha concedido.")
        : " Whitelist: " +
          (exam.passed ? "pendiente de segunda fase" : "examen no aprobado");
    await i.update(v2Payload({
      embeds: [
        embed(
          "Examen terminado",
          `${exam.score}/${exam.total}. ${exam.passed ? "Aprobado." : "No aprobado."}${extra}`,
        ),
      ],
      components: [],
    }));
    if (exam.passed && type === "license") {
      const role = settings.get().licenseRoles[exam.licenseType];
      if (role) {
        try {
          await i.member.roles.add(role);
        } catch {
          await i.followUp(v2Payload({
            content:
              "Examen aprobado; no se pudo aplicar el rol. Revisa la jerarquía del bot.",
            flags: 64,
          }));
        }
      }
    }
    return;
  }
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`exam:${type}:${exam.id}:${exam.index}`)
    .setPlaceholder("Selecciona una respuesta")
    .addOptions(
      exam.options.map((v, index) => ({
        label: `${index + 1}. ${v}`.slice(0, 100),
        value: String(index),
      })),
    );
  const payload = {
    embeds: [embed(`Pregunta ${exam.index + 1}/${exam.total}`,
      exam.question + "\n\n" + exam.options.map((option, index) => `${index + 1}. ${option}`).join("\n"))],
    components: [new ActionRowBuilder().addComponents(menu)],
  };
  if (i.isStringSelectMenu?.()) return i.update(v2Payload(payload));
  return i.editReply(v2Payload(payload));
}
let ticketCreationPending = 0;
async function createTicket(i, options = {}) {
  const assertSession = options.assertSession || (() => {});
  assertSession();
  const c = ctx(i),
    cfg = settings.get();
  return ticketJob(i.guildId + ":" + c.id, async () => {
    const openTickets = Object.values(store.read("tickets").items || {}).filter(t => t.status === "abierto");
    if (openTickets.length + ticketCreationPending >= 100) throw busy("El soporte tiene demasiados tickets abiertos. Inténtalo más tarde.");
    const channelCount = [...(i.guild.channels.cache?.values() || [])].filter(channel => !channel.isThread?.()).length;
    if (channelCount >= 450) throw busy("El soporte está cerca del límite de canales. El staff debe archivar canales antiguos antes de abrir más tickets.");
    const existing = Object.values(store.read("tickets").items || {}).find(
      (t) => t.userId === c.id && t.status === "abierto",
    );
    if (existing) throw domain.error("Ya tienes un ticket abierto.");
    const staffRoles = [
      ...cfg.staffRoleIds,
      ...cfg.moderatorRoleIds,
      ...cfg.adminRoleIds,
    ];
    if (!staffRoles.length)
      throw domain.error("Configura al menos un rol de staff para los tickets.");
    const botId = client?.user?.id || i.client?.user?.id;
    if (!botId) throw Error("El bot todavía no está disponible.");
    assertSession();
    ticketCreationPending++;
    try {
      const channel = await i.guild.channels.create({
        name: "ticket-" + i.user.username.replace(/[^a-z0-9-]/gi, "").slice(0, 40),
        type: ChannelType.GuildText,
        rateLimitPerUser: cfg.ticketHighVolume ? 60 : 0,
        parent: cfg.channels.ticketCategory || undefined,
        permissionOverwrites: [
          { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: i.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: botId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          ...staffRoles.map((id) => ({
            id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          })),
        ],
      });
      let ticket;
      try {
        assertSession();
        ticket = domain.ticketCreate(
          c,
          i.options?.getString?.("asunto") || "Soporte",
          channel.id,
        );
        if (options.requestId) {
          store.update("tickets", db => {
            db.items[ticket.id].webRequestId = options.requestId;
            db.items[ticket.id].guildId = i.guildId;
          });
          ticket.webRequestId = options.requestId;
          ticket.guildId = i.guildId;
        }
      } catch (e) {
        await channel.delete("No se pudo crear registro de ticket").catch(() => {});
        throw e;
      }
      assertSession();
      await channel.send(v2Payload({
        content: `Soporte de <@${i.user.id}>`,
        allowedMentions: { users: [i.user.id] },
        embeds: [embed("Ticket de soporte", ticket.topic)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("ticket:claim:" + ticket.id)
              .setLabel("Reclamar")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("ticket:close:" + ticket.id)
              .setLabel("Cerrar y guardar")
              .setStyle(ButtonStyle.Danger),
          ),
        ],
      }));
      return ticket;
    } finally { ticketCreationPending--; }
  });
}
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
async function transcript(channel, ticket, options = {}) {
  if (!/^[\w-]+$/.test(ticket.id)) throw Error("Identificador de ticket inválido.");
  return transcriptJob(ticket.id, async () => {
    const maxMessages = options.maxMessages ?? 100000;
    const maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
    const maxMs = options.maxMs ?? 120000;
    const started = Date.now();
    const dir = path.join(root, "public/uploads");
    const temporary = await fs.promises.mkdtemp(path.join(dir, ".ticket-"));
    await fs.promises.chmod(temporary, 0o700);
    let before, total = 0, bytes = 0, pages = 0;
    const filename = "ticket_" + ticket.id + ".html";
    const output = path.join(temporary, "transcript.html");
    try {
      for (;;) {
        if (Date.now() - started > maxMs) throw busy("La transcripción superó el tiempo permitido. El ticket permanece abierto.");
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (!batch.size) break;
        total += batch.size;
        if (total > maxMessages) throw busy("La conversación es demasiado extensa para archivarla automáticamente. El ticket permanece abierto.");
        const html = [...batch.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp).map(m =>
          "<article><strong>" + escape(m.author.tag) + "</strong> " + escape(m.createdAt.toISOString()) +
          "<p>" + escape(m.content || "") + "</p><p>" + escape(require("./transcript-content").messageText(m)) +
          "</p><p>" + escape([...m.attachments.values()].map(a => a.url).join("\n")) + "</p></article>"
        ).join("");
        bytes += Buffer.byteLength(html);
        if (bytes > maxBytes) throw busy("La transcripción supera el tamaño permitido. El ticket permanece abierto.");
        await fs.promises.writeFile(path.join(temporary, String(pages++)), html, { mode: 0o600 });
        const next = batch.last().id;
        if (next === before) throw Error("No se pudo avanzar en la transcripción del ticket.");
        before = next;
        if (batch.size < 100) break;
      }
      const file = await fs.promises.open(output, "wx", 0o600);
      try {
        await file.writeFile('<!DOCTYPE html><html lang="es"><meta charset="utf-8"><title>Ticket Maes RP</title><h1>Ticket ' + escape(ticket.id) + "</h1>");
        for (let page = pages - 1; page >= 0; page--) await file.writeFile(await fs.promises.readFile(path.join(temporary, String(page))));
        await file.writeFile("</html>");
      } finally { await file.close(); }
      await fs.promises.rename(output, path.join(dir, filename));
      return filename;
    } finally { await fs.promises.rm(temporary, { recursive: true, force: true }); }
  });
}
async function whitelistApply(i, user, approve, roblox) {
  const c = ctx(i);
  domain.requireScope(c, "staff");
  const target = await member(user, i.guild),
    cfg = settings.get();
  if (approve) {
    const roles = [...new Set([cfg.verifiedRoleId, ...(cfg.acceptedRoleIds || [])].filter(Boolean))];
    if (roles.length) await target.roles.add(roles);
    if (cfg.pendingRoleId && target.roles.cache.has(cfg.pendingRoleId)) await target.roles.remove(cfg.pendingRoleId);
    if (roblox) await target.setNickname((cfg.nicknamePrefix + roblox).slice(0, 32));
  }
  const cooldownText = !approve ? i.options.getString("cooldown") : null;
  const cooldownDays = cooldownText ? require("./roblox").duration(cooldownText) : 2 / 24;
  if (cooldownText && !cooldownDays) throw Error("La espera de whitelist debe tener una duración positiva.");
  const r = domain.reviewWhitelist(c, user, approve, roblox);
  if (!approve) store.update("whitelist", db => { db[user].cooldownUntil = new Date(Date.now() + cooldownDays * 86400000).toISOString(); });
  await log(i.guild, "Whitelist " + r.status, user);
  if (cfg.channels.whitelist) {
    const channel = await i.guild.channels.fetch(cfg.channels.whitelist);
    if (!channel?.isTextBased()) throw Error("Canal de whitelist inválido.");
    const image = path.join(root, "public/images", approve ? "wlaceptada.png" : "wlrechazada.png");
    const files = fs.existsSync(image) ? [new AttachmentBuilder(image)] : [];
    const text = approve
      ? `🎉 ¡Felicidades! <@${user}>\n\nTu solicitud ha sido aceptada.\nYa formas parte de la **whitelist de Maes Roleplay.**\nEstás autorizado para ingresar al servidor y comenzar tu experiencia de rol.\n[separador]\n📝 **Recuerda seguir todas las normas y mantener un rol serio y respetuoso.\n¡Te esperamos en la ciudad!** 🏙️`
      : `<@${user}> Lamentablemente, tu solicitud ha sido denegada.\n[separador]\n🔁 Puedes volver a intentarlo en ${cooldownText || "2 horas"}.\n-# Estudiar conceptos Roleplay\n${i.options.getString("motivo") || "Te recomendamos leer bien las normas del servidor y mejorar tus respuestas para la próxima vez."}\n[separador]\n**Gracias por tu interés en Maes Roleplay. 🌴**`;
    await channel.send(v2Payload({ embeds: [{ title: approve ? "✅ Whitelist Aceptada – Maes Roleplay 🇨🇷" : "❌ Whitelist Denegada – Maes Roleplay 🇨🇷", description: text }], files, allowedMentions: { parse: [], users: [user] } }));
  }
  return r;
}
const autocompleteLimit = require("../lib/security").limiter({limit:30,windowMs:60000});
const autocompletePending = new Map();
async function autocomplete(i) {
  const focused=i.options.getFocused(true);
  if(i.commandName==="registrar-cedula" && focused?.name==="roblox"){
    if(!autocompleteLimit(i.user.id))return i.respond([]);
    const previous=autocompletePending.get(i.user.id);if(previous)clearTimeout(previous.timer);
    if(previous)previous.resolve(false);
    const ready=await new Promise(resolve=>{const timer=setTimeout(()=>{autocompletePending.delete(i.user.id);resolve(true);},100);autocompletePending.set(i.user.id,{timer,resolve});});
    if(!ready)return i.respond([]);
    const users=await require("../lib/roblox-public").searchUsers(focused.value);
    return i.respond(users.map(user=>({name:(user.username+" · "+user.displayName+" · "+user.id).slice(0,100),value:user.username})));
  }
  if(i.commandName==="enviar-mensaje" && focused?.name==="nombre"){
    domain.requireScope(ctx(i),"admin");
    return i.respond(require("./message-drafts").choices(String(focused.value)));
  }
  return i.respond([]);
}
async function dispatch(i) {
  const c = ctx(i),
    command = commands.find((c) => c.name === i.commandName);
  if (!command) throw Error("Comando desconocido.");
  if (command.guildScope === "admin" && i.guildId !== process.env.ADMIN_GUILD_ID) throw Error("Este comando solo funciona en el servidor administrativo configurado.");
  if (command.scope !== "public") domain.requireScope(c, command.scope);
  const user = i.options.getUser("usuario")?.id || i.user.id;
  const str = (name) => i.options.getString(name),
    number = (name) => i.options.getNumber(name),
    integer = (name) => i.options.getInteger(name);
  await i.deferReply({ flags: 64 });
  const handler = require('./handlers')[i.commandName];
  if (!handler) throw Error('Comando sin implementación.');
  const actorOperations = { ...operations, identityDocuments: record => operations.identityDocuments(record, c.id), identityPdf: record => operations.identityPdf(record, c.id) };
  return handler({ i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations: actorOperations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client });
}
async function component(i) {
  const c = ctx(i),
    parts = i.customId.split(":");
  if (parts[0] === "ranking") {
    domain.requireScope(c, "staff");
    return i.update(require("./ranking-pages").payload(parts[1]));
  }
  if (parts[0] === "shift") {
    domain.requireScope(c, "staff");
    if (!["start", "stop"].includes(parts[1])) throw Error("Acción de turno inválida.");
    await i.deferReply({ flags: 64 });
    const r = domain.shift(c, parts[1]);
    await log(i.guild, "Turno " + parts[1], `<@${c.id}> · ${r.current ? "Turno iniciado" : "Turno finalizado"}`);
    await require("./activity-panel").publish(client, true);
    return respond(i, "Turno actualizado", r.current ? "Turno activo." : "Turno finalizado.");
  }
  if (parts[0] === "nicknames") {
    domain.requireScope(c, "admin");
    if (parts[1] !== "stop" || parts[2] !== i.guildId) throw Error("Operación inválida.");
    require("./nicknames").cancel(parts[2], c.id);
    return i.reply(v2Payload({ content: "Se ha solicitado detener el restablecimiento.", flags: 64 }));
  }
  if (parts[0] === "server") {
    domain.requireScope(c, "staff");
    if (!["abierto", "cerrado"].includes(parts[1])) throw Error("Estado inválido.");
    await i.deferReply({ flags: 64 });
    return require("./handlers")["estado-sv"]({ i, c, store, domain, respond, str: () => parts[1] });
  }
  if (parts[0] === "exam") {
    return examMessage(
      i,
      parts[1],
      domain.answerExam(c, parts[1], parts[2], parts[3], i.values[0]),
    );
  }
  if (parts[0] === "poll") {
    const previous = store.read("polls")[parts[1]];
    if (!previous || (previous.guildId && previous.guildId !== i.guildId)) throw Error("Encuesta no encontrada.");
    if (parts[2] === "voters") return i.reply(v2Payload({ embeds: [embed("Votantes de apertura", require("./poll-message").voters(previous))], flags: 64 }));
    await i.deferReply({ flags: 64 });
    const p = domain.vote(c, parts[1], parts[2]);
    await i.message.edit(require("./poll-message").payload(p));
    return respond(i, p.votes[c.id] ? "Voto guardado" : "Voto retirado", "Total de participantes: " + Object.keys(p.votes).length);
  }
  if (parts[0] === "ticket") {
    if (parts[1] === "new") {
      await i.deferReply({ flags: 64 });
      const t = await createTicket(i);
      return i.editReply(v2Payload({
        content: "Ticket abierto: <#" + t.channelId + ">",
        embeds: [],
      }));
    }
    if (parts[1] === "claim") {
      const t = domain.ticketClaim(c, parts[2]);
      return i.reply(v2Payload({
        content: "Ticket reclamado por " + safe(i.user.username),
        flags: 64,
      }));
    }
    if (parts[1] === "close") {
      const t = store.read("tickets").items?.[parts[2]];
      if (!t) throw Error("Ticket no encontrado.");
      if (t.userId !== c.id) domain.requireScope(c, "staff");
      if (t.status !== "abierto") throw Error("Ticket ya cerrado.");
      if (t.channelId !== i.channelId) throw Error("Este botón no pertenece al canal del ticket.");
      await i.deferReply({ flags: 64 });
      const filename = await transcript(i.channel, t);
      domain.ticketClose(c, t.id, filename);
      await i.channel.permissionOverwrites.edit(t.userId, {
        SendMessages: false,
      });
      await i.channel.send(v2Payload({
        embeds: [
          embed("Ticket cerrado", "El autor puede evaluar la atención."),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            ...[1, 2, 3, 4, 5].map((n) =>
              new ButtonBuilder()
                .setCustomId(`ticket:rate:${t.id}:${n}`)
                .setLabel(String(n) + " ★")
                .setStyle(ButtonStyle.Secondary),
            ),
          ),
        ],
      }));
      return respond(i, "Ticket cerrado", "Transcripción guardada.", [
        new AttachmentBuilder(path.join(root, "public/uploads", filename)),
      ]);
    }
    if (parts[1] === "rate") {
      domain.ticketRate(c, parts[2], parts[3]);
      return i.reply(v2Payload({ content: "Evaluación guardada.", flags: 64 }));
    }
  }
  throw Error("Componente no reconocido.");
}
async function hierarchy(guild) {
  return require("./hierarchy").publish(guild, true);
}

async function syncLicenseRoles(guild) {
  const map = settings.get().licenseRoles;
  const members = await guild.members.fetch();
  const current = store.read("licencias");
  for (const uid of new Set([...members.keys(), ...Object.keys(current)])) {
    const m = members.get(uid);
    const synced = Object.entries(map).filter(([, role]) => role).map(([tipo, role]) => ({ tipo, estado: m?.roles.cache.has(role) ? "Activa" : "Inactiva", origen: "discord" }));
    const previous = current[uid] || [];
    const relevant = synced.filter(l => l.estado === "Activa" || previous.some(old => old.origen === "discord" && old.tipo === l.tipo));
    if (previous.length || relevant.length) current[uid] = [...previous.filter(l => l.origen !== "discord"), ...relevant];
  }
  store.write("licencias", current);
}

async function notificationQueue() {
  if (queueBusy || !client?.isReady()) return;
  queueBusy = true;
  try {
    for (const name of fs
      .readdirSync(path.join(dataDir, "notifications"))
      .filter((f) => f.endsWith(".json"))) {
      const file = path.join(dataDir, "notifications", name);
      let n;
      try {
        n = JSON.parse(fs.readFileSync(file, "utf8"));
        if (n.nextAttempt > Date.now()) continue;
        const cid =
          n.type === "multa"
            ? process.env.MULTA_CHANNEL_ID
            : n.type === "arresto"
              ? process.env.ARRESTO_CHANNEL_ID
              : null;
        if (!cid || !process.env.DISCORD_GUILD_ID) continue;
        const ch = await client.channels.fetch(cid);
        if (!ch?.isTextBased() || ch.guildId !== process.env.DISCORD_GUILD_ID)
          throw Error("Canal de notificación inválido.");
        if (!n.messageId) {
          const r = n.data;
          if (path.basename(r.pdfFileName) !== r.pdfFileName)
            throw Error("PDF inválido.");
          const files = [
            new AttachmentBuilder(
              path.join(root, "public/pdfs", r.pdfFileName),
            ),
          ];
          if (r.imagenFileName) {
            if (path.basename(r.imagenFileName) !== r.imagenFileName)
              throw Error("Evidencia inválida.");
            files.push(
              new AttachmentBuilder(
                path.join(root, "public/uploads", r.imagenFileName),
              ),
            );
          }
          const sent = await ch.send(v2Payload({
            embeds: [
              embed(
                n.type === "multa"
                  ? "Registro de multa"
                  : "Registro de arresto",
                `${r.ciudadano}\nCédula: ${r.documento}\nFecha: ${r.fecha}\n${r.articulos}\nOficial: ${r.oficialNombre}\n${n.type === "multa" ? "Monto: $" + r.monto : "Sentencia: " + r.tiempo + " años"}`,
              ),
            ],
            files,
            allowedMentions: { parse: [] },
            nonce: BigInt(
              "0x" +
                crypto
                  .createHash("sha256")
                  .update(r.id)
                  .digest("hex")
                  .slice(0, 16),
            ).toString(),
            enforceNonce: true,
          }));
          n.messageId = sent.id;
          store.atomic(file, n);
        }
        fs.renameSync(file, path.join(dataDir, "processed", name));
      } catch (e) {
        if (!n) {
          fs.renameSync(file, path.join(dataDir, "errors", name));
          continue;
        }
        n.attempts = (n.attempts || 0) + 1;
        n.lastError = e.message;
        n.nextAttempt = Date.now() + Math.min(300000, 15000 * 2 ** n.attempts);
        store.atomic(file, n);
        if (n.attempts >= 5)
          fs.renameSync(file, path.join(dataDir, "errors", name));
        console.error("Notificación pendiente:", e.message);
      }
    }
  } finally {
    queueBusy = false;
  }
}
function status() {
  store.atomic(path.join(dataDir, "status.json"), {
    online: !!client?.isReady(),
    tag: client?.user?.tag || null,
    timestamp: Date.now(),
    commands: commands.length,
  });
}
const banRoleVersions = new Map();
async function syncBanRoles() {
  if (!client?.isReady()) return;
  const cfg = settings.get(),
    configured = Object.values(cfg.banRoles).filter(Boolean);
  if (!configured.length) return;
  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
  if (!guild) return;
  const bans = store.read("bans");
  for (const uid of new Set(bans.map((r) => r.userId))) {
    const count = bans.filter(
      (r) => r.userId === uid && r.status === "aplicado",
    ).length;
    const role = count ? cfg.banRoles[Math.min(count, 3)] : null;
    const key = JSON.stringify([configured, role]);
    if (banRoleVersions.get(uid) === key) {
      await require("./ban-membership").sync(guild, uid, cfg).catch(error => console.error("Roles de ban:", error.message));
      continue;
    }
    const m = await guild.members.fetch(uid).catch(() => null);
    if (!m) continue;
    try {
      const remove = configured.filter(
        (r) => r !== role && m.roles.cache.has(r),
      );
      if (remove.length) await m.roles.remove(remove);
      if (role && !m.roles.cache.has(role)) await m.roles.add(role);
      banRoleVersions.set(uid, key);
      await require("./ban-membership").sync(guild, uid, cfg);
    } catch (e) {
      console.error("No se pudieron sincronizar roles de ban:", e.message);
    }
  }
}
let maintenanceBusy = false;
async function maintenance() {
  if (maintenanceBusy) return;
  maintenanceBusy = true;
  try {
    await notificationQueue();
    const hierarchyGuild = client?.guilds.cache.get(process.env.ADMIN_GUILD_ID || process.env.DISCORD_GUILD_ID);
    if (hierarchyGuild) await require("./hierarchy").publish(hierarchyGuild).catch(error => console.error("Jerarquía:", error.message));
    await require("./activity-panel").publish(client).catch(error => console.error("Actividad:", error.message));
    for (const [userId, s] of Object.entries(store.read("shifts"))) {
      if (s.current?.state === "active" && settings.get().voiceRequired && client?.isReady()) {
        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        const member = guild?.members.cache.get(userId) || await guild?.members.fetch(userId).catch(() => null);
        const valid = member && (settings.voiceExempt(member) || (!!settings.get().channels.voiceActivity && member.voice.channelId === settings.get().channels.voiceActivity));
        if (!valid) domain.shift({ id: userId, local: true }, "pause");
      }
      if (s.current && Date.now() - s.current.start >= settings.get().maximumShiftHours * 3600000) {
        domain.shift({ id: userId, local: true }, "stop");
        const guild = client?.guilds.cache.get(process.env.DISCORD_GUILD_ID);
        if (guild) await log(guild, "Turno finalizado automáticamente", userId + " · duración máxima alcanzada");
      }
    }
    if (
      settings.get().automaticFineCollection &&
      process.env.UNBELIEVABOT_TOKEN
    )
      for (const fine of store.read("multas"))
        if (
          fine.estado !== "PAGADA" &&
          fine.vence &&
          Date.parse(fine.vence) < Date.now()
        ) {
          try {
            await economy.pay({ id: fine.userId }, fine.id);
          } catch (e) {
            console.error("Cobro pendiente:", e.message);
          }
        }
    if (client?.isReady())
      for (const ticket of Object.values(store.read("tickets").items || {}))
        if (
          ticket.status === "abierto" &&
          Date.now() - Date.parse(ticket.lastActiveAt) >
            settings.get().ticketInactivityHours * 3600000
        ) {
          try {
            const ch = await client.channels.fetch(ticket.channelId);
            if (!ch?.isTextBased()) continue;
            const file = await transcript(ch, ticket);
            domain.ticketClose({ id: "system", local: true }, ticket.id, file);
            await ch.permissionOverwrites.edit(ticket.userId, {
              SendMessages: false,
            });
            await ch.send(
              v2Payload("Ticket cerrado por inactividad. Transcripción guardada."),
            );
          } catch (e) {
            console.error("No se pudo archivar el ticket:", e.message);
          }
        }
    for (const r of store.read("bans"))
      if (
        r.status === "aplicado" &&
        r.expiresAt &&
        Date.parse(r.expiresAt) < Date.now()
      ) {
        try {
          await operations.unban({ id: "system", local: true }, r.roblox, prc);
        } catch (e) {
          console.error("Ban expirado pendiente de retirar:", e.message);
        }
      }
    await syncBanRoles();
  } finally {
    maintenanceBusy = false;
  }
}
async function start() {
  if (client) return;
  store.init();
  if (!process.env.DISCORD_TOKEN) {
    console.log("Bot sin token: web disponible y notificaciones pendientes.");
    return;
  }
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });
  client.once("clientReady", async () => {
    console.log("Bot conectado:", client.user.tag);
    try {
      const rest = new REST({ version: "10" }).setToken(
        process.env.DISCORD_TOKEN,
      );
      for (const gid of new Set(
        [process.env.DISCORD_GUILD_ID, process.env.ADMIN_GUILD_ID].filter(
          Boolean,
        ),
      ))
        await rest.put(Routes.applicationGuildCommands(client.user.id, gid), {
          body: commands.filter(c => c.guildScope !== "admin" || gid === process.env.ADMIN_GUILD_ID).map((c) => c.data.toJSON()),
        });
      console.log(commands.length + " comandos registrados.");
    } catch (e) {
      console.error("Registro de comandos:", e.message);
    }
    status();
    maintenance().catch(error => console.error("Mantenimiento inicial:", error.message));
  });
  client.on("interactionCreate", async (i) => {
    if (!configuredGuild(i.guildId)) return;
    try {
      if (i.isAutocomplete()) {
        await autocomplete(i);
      }
      else if (i.isChatInputCommand()) await dispatch(i);
      else if (i.isButton() || i.isStringSelectMenu()) await component(i);
    } catch (e) {
      if (i.isAutocomplete?.()) { await i.respond([]).catch(() => {}); return; }
      const payload = { embeds: [embed("No se pudo completar la acción", safe(e.message))], flags: 64 };
      if (i.deferred && !i.replied)
        await i
          .editReply(v2Payload(payload))
          .catch(() => {});
      else if (i.replied) await i.followUp(v2Payload(payload)).catch(() => {});
      else await i.reply(v2Payload(payload)).catch(() => {});
    }
  });
  client.on("voiceStateUpdate", (oldState, newState) => {
    if (!configuredGuild(newState.guild?.id)) return;
    if (!settings.get().voiceRequired) return;
    const s = store.read("shifts")[newState.id];
    if (!s?.current) return;
    const valid = settings.voiceExempt(newState.member) ||
      !!newState.channelId &&
      (!!settings.get().channels.voiceActivity &&
        newState.channelId === settings.get().channels.voiceActivity);
    if (!valid && s.current.state === "active")
      try {
        domain.shift({ id: newState.id, local: true }, "pause");
      } catch {}
  });
  client.on("messageCreate", handleMessage);
  client.on("error", (e) => console.error("Discord:", e.message));
  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch {
    console.error(
      "No se pudo iniciar el bot. Revisa el token y los intents. La web sigue disponible.",
    );
    client.destroy();
    client = null;
    status();
    return;
  }
  maintenanceTimer = setInterval(() => {
    Promise.resolve().then(() => { status(); return maintenance(); })
      .catch((e) => console.error("Mantenimiento:", e.message));
  }, 15000);
  maintenanceTimer.unref();
}
async function stop() {
  clearInterval(maintenanceTimer);
  maintenanceTimer = null;
  require("./voice-welcome").stop();
  client?.destroy();
  client = null;
  status();
}
module.exports = {
  start,
  stop,
  dispatch,
  autocomplete,
  createTicket,
  handleMessage,
  examMessage,
  component,
  ctx,
  prc,
  get client() {
    return client;
  },
  commands,
  notificationQueue,
  syncLicenseRoles,
  transcript,
};
