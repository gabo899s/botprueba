const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
if (str("confirmacion") !== "REVOCAR " + user)
        throw Error(
          "Para confirmar escribe REVOCAR seguido del ID del usuario.",
        );
      for (const r of domain.sanctions(user))
        domain.editSanction(c, user, r.id, "", true);
      return respond(
        i,
        "Historial revocado",
        "Se conserva el registro de auditoría.",
      );
};

module.exports.metadata = {
  "name": "vaciar-historial",
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
        "name": "confirmacion",
        "description": "confirmacion",
        "required": true,
        "max_length": 30
      }
    ],
    "name": "vaciar-historial",
    "description": "Revoca sanciones de un usuario con confirmación",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
