const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
await operations.approvePunishment(c, user, str("id_sancion"), prc);
      return respond(
        i,
        "Castigo confirmado",
        "Aprobación y resultado registrados.",
      );
};

module.exports.metadata = {
  "name": "aprobar-castigo",
  "scope": "admin",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": true,
        "type": 6
      },
      {
        "type": 3,
        "name": "id_sancion",
        "description": "id_sancion",
        "required": true,
        "max_length": 80
      }
    ],
    "name": "aprobar-castigo",
    "description": "Aplica un castigo pendiente al juego con aprobación",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
