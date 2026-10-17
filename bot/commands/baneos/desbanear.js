const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
const result = await operations.unban(c, str("usuario_roblox"), prc);
      for (const uid of result.userIds) await require("../../ban-membership").sync(i.guild, uid, settings.get());
      return respond(i, "Ban retirado", "ER:LC confirmó la acción.");
};

module.exports.metadata = {
  "name": "desbanear",
  "scope": "moderator",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "usuario_roblox",
        "description": "usuario_roblox",
        "required": true,
        "max_length": 40
      },
      {
        "type": 3,
        "name": "motivo",
        "description": "motivo",
        "required": false,
        "max_length": 1000
      }
    ],
    "name": "desbanear",
    "description": "Retira un ban de ER:LC confirmado",
    "dm_permission": false,
    "type": 1
  }
};
