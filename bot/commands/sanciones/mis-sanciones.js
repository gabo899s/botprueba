const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(i, "Mis sanciones", rows(domain.sanctions(c.id)));
};

module.exports.metadata = {
  "name": "mis-sanciones",
  "scope": "public",
  "schema": {
    "options": [],
    "name": "mis-sanciones",
    "description": "Consulta tus sanciones",
    "dm_permission": false,
    "type": 1
  }
};
