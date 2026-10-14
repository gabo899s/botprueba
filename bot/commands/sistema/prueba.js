const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Prueba completada",
        "Discord y el cargador responden.",
      );
};

module.exports.metadata = {
  "name": "prueba",
  "scope": "admin",
  "schema": {
    "options": [],
    "name": "prueba",
    "description": "Comprueba la respuesta del bot",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
