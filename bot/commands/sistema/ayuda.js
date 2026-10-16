const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Comandos Maes RP",
        commands.map((v) => "/" + v.name).join(" · ") + "\nPrivacidad, cookies y condiciones: " + baseUrl + "/legal",
      );
};

module.exports.metadata = {
  "name": "ayuda",
  "scope": "public",
  "schema": {
    "options": [],
    "name": "ayuda",
    "description": "Lista de comandos de Maes RP",
    "dm_permission": false,
    "type": 1
  }
};
