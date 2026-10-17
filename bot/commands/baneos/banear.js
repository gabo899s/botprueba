const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const { duration } = require("../../roblox");
      const r = await operations.ban(
        c,
        user,
        str("usuario_roblox"),
        str("motivo"),
        str("tiempo") ? duration(str("tiempo")) : number("dias"),
        prc,
      );
      if (r.status === "aplicado") await require("../../ban-membership").sync(i.guild, user, settings.get()).catch(error => { r.discordError = error.message; });
      return respond(
        i,
        "Resultado del ban",
        r.id + " · " + r.status + (r.error ? "\n" + r.error : "") + (r.discordError ? "\nRoles/apodo pendientes: " + r.discordError : ""),
      );
    }
};

module.exports.metadata = {
  "name": "banear",
  "scope": "moderator",
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
        "name": "usuario_roblox",
        "description": "usuario_roblox",
        "required": true,
        "max_length": 40
      },
      {
        "type": 3,
        "name": "motivo",
        "description": "motivo",
        "required": true,
        "max_length": 1000
      },
      {
        "max_value": 3650,
        "min_value": 0,
        "type": 10,
        "name": "dias",
        "description": "dias",
        "required": false
      },
      {
        "type": 3,
        "name": "tiempo",
        "description": "tiempo",
        "required": false,
        "max_length": 60
      }
    ],
    "name": "banear",
    "description": "Solicita un ban de ER:LC y guarda su resultado",
    "dm_permission": false,
    "type": 1
  }
};
