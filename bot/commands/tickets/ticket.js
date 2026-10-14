const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const t = await createTicket(i);
      return respond(i, "Ticket abierto", "Canal: <#" + t.channelId + ">");
    }
};

module.exports.metadata = {
  "name": "ticket",
  "scope": "public",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "asunto",
        "description": "asunto",
        "required": true,
        "max_length": 150
      }
    ],
    "name": "ticket",
    "description": "Abre un ticket de soporte",
    "dm_permission": false,
    "type": 1
  }
};
