const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
domain.ownOr(c, user, "police");
      return respond(i, "Vehículos", rows(store.read("vehiculos")[user] || []));
};

module.exports.metadata = {
  "name": "vehiculos",
  "scope": "public",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": false,
        "type": 6
      }
    ],
    "name": "vehiculos",
    "description": "Consulta vehículos registrados",
    "dm_permission": false,
    "type": 1
  }
};
