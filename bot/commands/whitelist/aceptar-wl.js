const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const approve =
        i.commandName === "aceptar-wl" ||
        (i.commandName === "revisar-2fase" && str("estado") === "aceptar");
      const r = await whitelistApply(i, user, approve, str("roblox"));
      return respond(i, "Whitelist", r.status);
    }
};

module.exports.metadata = {
  "name": "aceptar-wl",
  "scope": "staff",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": true,
        "type": 6
      },
      {
        "type": 3,
        "name": "roblox",
        "description": "roblox",
        "required": true,
        "max_length": 40
      }
    ],
    "name": "aceptar-wl",
    "description": "Acepta whitelist y aplica roles configurados",
    "dm_permission": false,
    "type": 1
  }
};
