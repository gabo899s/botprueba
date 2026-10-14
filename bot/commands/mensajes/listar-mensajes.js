const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Mensajes",
        rows(Object.values(store.read("messages")).map((r) => r.id)),
      );
};

module.exports.metadata = {
  "name": "listar-mensajes",
  "scope": "admin",
  "schema": {
    "options": [],
    "name": "listar-mensajes",
    "description": "Lista los mensajes guardados",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
