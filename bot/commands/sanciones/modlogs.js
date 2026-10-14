const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(i, "Historial", rows(Object.values(store.read("sanciones")).flatMap(value => value.sanctions || []).concat(Object.values(store.read("advertencias")).flatMap(value => value.warnings || [])).filter(record => record.moderadorId === user)));
};

module.exports.metadata = {
  "name": "modlogs",
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
    "name": "modlogs",
    "description": "Consulta el historial de moderación",
    "dm_permission": false,
    "type": 1
  }
};
