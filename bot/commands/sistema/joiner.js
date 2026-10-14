const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
if (str("modo") === "voz") {
  await require("../../voice-welcome").speak(i, client);
  return respond(i, "Bienvenida reproducida", "Welcome to the channel");
}
await i.channel.send(v2Payload({
        content:
          "Código del servidor Maes RP: **" +
          safe(settings.get().serverCode, 60) +
          "**",
        allowedMentions: { parse: [] },
        tts: false,
      }));
      return respond(i, "Código publicado", "Mensaje enviado.");
};

module.exports.metadata = {
  "name": "joiner",
  "scope": "staff",
  "schema": {
    "options": [{"type":3,"name":"modo","description":"Código del servidor o bienvenida por voz","required":false,"choices":[{"name":"Código","value":"codigo"},{"name":"Voz","value":"voz"}]}],
    "name": "joiner",
    "description": "Publica el código de acceso al servidor",
    "dm_permission": false,
    "type": 1
  }
};
