const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return examMessage(
        i,
        "license",
        domain.startExam(c, "license", str("tipo")),
      );
};

module.exports.metadata = {
  "name": "solicitar-licencia",
  "scope": "public",
  "schema": {
    "options": [
      {
        "type": 3,
        "choices": [
          {
            "name": "A1",
            "value": "A1"
          },
          {
            "name": "A2",
            "value": "A2"
          },
          {
            "name": "A3",
            "value": "A3"
          },
          {
            "name": "B1",
            "value": "B1"
          },
          {
            "name": "B2",
            "value": "B2"
          },
          {
            "name": "B3",
            "value": "B3"
          },
          {
            "name": "C1",
            "value": "C1"
          },
          {
            "name": "C2",
            "value": "C2"
          },
          {
            "name": "C3",
            "value": "C3"
          },
          {
            "name": "D1",
            "value": "D1"
          },
          {
            "name": "D2",
            "value": "D2"
          },
          {
            "name": "D3",
            "value": "D3"
          }
        ],
        "name": "tipo",
        "description": "tipo",
        "required": true,
        "max_length": 1000
      }
    ],
    "name": "solicitar-licencia",
    "description": "Realiza el examen de una licencia",
    "dm_permission": false,
    "type": 1
  }
};
