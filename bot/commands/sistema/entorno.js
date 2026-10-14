const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
await prc.command(":h " + str("mensaje"));
      return respond(i, "Aviso enviado", "ER:LC confirmó la acción.");
};

module.exports.metadata = {
  "name": "entorno",
  "scope": "moderator",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "mensaje",
        "description": "mensaje",
        "required": true,
        "max_length": 500
      }
    ],
    "name": "entorno",
    "description": "Envía un aviso de entorno al juego",
    "dm_permission": false,
    "type": 1
  }
};
