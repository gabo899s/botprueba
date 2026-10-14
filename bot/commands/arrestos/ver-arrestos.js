const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
domain.ownOr(c, user, "police");
      return respond(
        i,
        "Registros",
        rows(
          store
            .read(i.commandName === "ver-multas" ? "multas" : "arrestos")
            .filter((r) => r.userId === user)
            .map((r) => `${r.id} · ${r.estado} · ${r.articulos}`),
        ),
      );
};

module.exports.metadata = {
  "name": "ver-arrestos",
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
    "name": "ver-arrestos",
    "description": "Consulta arrestos de tu personaje",
    "dm_permission": false,
    "type": 1
  }
};
