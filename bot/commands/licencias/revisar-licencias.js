const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
await syncLicenseRoles(i.guild);
      return respond(
        i,
        "Licencias sincronizadas",
        "Se conservaron las licencias manuales y de examen.",
      );
};

module.exports.metadata = {
  "name": "revisar-licencias",
  "scope": "staff",
  "schema": {
    "options": [],
    "name": "revisar-licencias",
    "description": "Sincroniza licencias con roles configurados",
    "dm_permission": false,
    "type": 1
  }
};
