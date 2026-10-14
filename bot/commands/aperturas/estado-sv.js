const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const status = str("estado");
      for (const p of Object.values(store.read("polls")).filter(
        (p) => p.status === "abierta",
      ))
        domain.closePoll(c, p.id, status);
      store.update("settings", (s) => (s.serverState = status));
      if (status === "cerrado") {
        for (const [uid, s] of Object.entries(store.read("shifts")))
          if (s.current) domain.shift({ id: uid, local: true }, "stop");
      }
      return respond(
        i,
        "Servidor " + status,
        "Estado local actualizado. Esto no enciende ni apaga el servidor Roblox.",
      );
    }
};

module.exports.metadata = {
  "name": "estado-sv",
  "scope": "staff",
  "schema": {
    "options": [
      {
        "type": 3,
        "choices": [
          {
            "name": "abierto",
            "value": "abierto"
          },
          {
            "name": "cerrado",
            "value": "cerrado"
          }
        ],
        "name": "estado",
        "description": "estado",
        "required": true,
        "max_length": 1000
      }
    ],
    "name": "estado-sv",
    "description": "Actualiza el estado de la apertura",
    "dm_permission": false,
    "type": 1
  }
};
