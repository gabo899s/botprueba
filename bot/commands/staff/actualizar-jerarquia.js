const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      await hierarchy(i.guild);
      return respond(
        i,
        "Jerarquía publicada",
        "Roles configurados consultados.",
      );
    }
};

module.exports.metadata = {
  "name": "actualizar-jerarquia",
  "scope": "admin",
  "guildScope": "admin",
  "schema": {
    "options": [],
    "name": "actualizar-jerarquia",
    "description": "Publica la jerarquía configurada",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
