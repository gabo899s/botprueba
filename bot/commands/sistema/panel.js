const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Plataforma local",
        baseUrl +
          "\nEsta dirección solo funciona en el equipo que ejecuta el proyecto.",
      );
};

module.exports.metadata = {
  "name": "panel",
  "scope": "public",
  "schema": {
    "options": [],
    "name": "panel",
    "description": "Enlace al panel local Maes RP",
    "dm_permission": false,
    "type": 1
  }
};
