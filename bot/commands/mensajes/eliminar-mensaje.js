const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
domain.removeMessage(c, str("nombre"));
      return respond(i, "Mensaje eliminado", str("nombre"));
};

module.exports.metadata = {
  "name": "eliminar-mensaje",
  "scope": "admin",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "nombre",
        "description": "nombre",
        "required": true,
        "max_length": 60
      }
    ],
    "name": "eliminar-mensaje",
    "description": "Elimina un mensaje guardado",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
