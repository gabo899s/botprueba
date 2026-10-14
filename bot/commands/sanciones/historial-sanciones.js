const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(i, "Historial", rows(domain.sanctions(user)));
};

module.exports.metadata = {
  "name": "historial-sanciones",
  "scope": "moderator",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": true,
        "type": 6
      }
    ],
    "name": "historial-sanciones",
    "description": "Consulta el historial de moderación",
    "dm_permission": false,
    "type": 1
  }
};
