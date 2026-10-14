const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Evaluaciones",
        rows(store.read("calificaciones_staff")[user] || []),
      );
};

module.exports.metadata = {
  "name": "ver-calificaciones",
  "scope": "staff",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": false,
        "type": 6
      }
    ],
    "name": "ver-calificaciones",
    "description": "Consulta evaluaciones del staff",
    "dm_permission": false,
    "type": 1
  }
};
