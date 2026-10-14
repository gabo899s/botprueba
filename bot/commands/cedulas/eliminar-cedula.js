const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const r = domain.removeCitizen(c, user);
      return respond(i, "Registro revocado", r.numeroCedula);
    }
};

module.exports.metadata = {
  "name": "eliminar-cedula",
  "scope": "admin",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": true,
        "type": 6
      }
    ],
    "name": "eliminar-cedula",
    "description": "Revoca un registro de identidad",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
