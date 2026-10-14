const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const db = store.read("infostaff");
      let count = 0;
      for (const [uid, r] of Object.entries(db)) {
        const m = await i.guild.members.fetch(uid).catch(() => null);
        if (m) {
          r.discordUsername = m.user.username;
          r.nombre = m.displayName;
          count++;
        }
      }
      store.write("infostaff", db);
      return respond(
        i,
        "Staff actualizado",
        `${count} miembros sincronizados.`,
      );
    }
};

module.exports.metadata = {
  "name": "actualizar-info",
  "scope": "admin",
  "schema": {
    "options": [],
    "name": "actualizar-info",
    "description": "Sincroniza nombres del registro de staff",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
