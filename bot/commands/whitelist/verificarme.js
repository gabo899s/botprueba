const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return examMessage(i, "whitelist", domain.startExam(c, "whitelist"));
};

module.exports.metadata = {
  "name": "verificarme",
  "scope": "public",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "usuario_roblox",
        "description": "usuario_roblox",
        "required": false,
        "max_length": 40
      }
    ],
    "name": "verificarme",
    "description": "Realiza el examen de whitelist Maes RP",
    "dm_permission": false,
    "type": 1
  }
};
