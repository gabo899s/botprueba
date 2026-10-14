const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const role = i.options.getRole("rol");
      if (role.permissions.has(PermissionFlagsBits.Administrator))
        throw Error("No se asignan roles Administrator desde este comando.");
      await (await member(user, i.guild)).roles.add(role);
      return respond(i, "Rol asignado", role.name);
    }
};

module.exports.metadata = {
  "name": "asignar-roles",
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
        "name": "rol",
        "description": "rol",
        "required": true,
        "type": 8
      }
    ],
    "name": "asignar-roles",
    "description": "Asigna un rol autorizado a un miembro",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
