const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Estado de Maes RP",
        `Bot conectado.\nComandos: ${commands.length}\nAPI ER:LC: ${process.env.PRC_SERVER_KEY ? "configurada" : "pendiente"}\nNotificaciones: ${JSON.stringify(store.stats())}`,
      );
};

module.exports.metadata = {
  "name": "estado",
  "scope": "public",
  "schema": {
    "options": [],
    "name": "estado",
    "description": "Estado del bot, API y notificaciones",
    "dm_permission": false,
    "type": 1
  }
};
