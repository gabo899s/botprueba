const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Estadísticas reales",
        `Sanciones: ${Object.values(store.read("sanciones")).reduce((n, v) => n + (v.sanctions || []).length, 0)}`,
      );
};

module.exports.metadata = {
  "name": "estadisticas-sanciones",
  "scope": "staff",
  "schema": {
    "options": [],
    "name": "estadisticas-sanciones",
    "description": "Resumen de sanciones registradas",
    "dm_permission": false,
    "type": 1
  }
};
