const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Staff",
        rows(
          Object.values(store.read("infostaff")).map(
            (r) =>
              `${r.nombre} · ${r.placa || "sin placa"} · ${r.rango || "sin cargo"}`,
          ),
        ),
      );
};

module.exports.metadata = {
  "name": "ver-placas",
  "scope": "staff",
  "schema": {
    "options": [],
    "name": "ver-placas",
    "description": "Consulta identificadores del staff",
    "dm_permission": false,
    "type": 1
  }
};
