const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const r = await operations.record(c, "multa", user, {
        articulos: str("articulos"),
        monto: number("monto"),
        placa: str("placa"),
      });
      return respond(i, "Multa registrada", `${r.id}\n$${r.monto}`, [
        new AttachmentBuilder(path.join(root, "public/pdfs", r.pdfFileName)),
      ]);
    }
};

module.exports.metadata = {
  "name": "multar",
  "scope": "police",
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
        "name": "articulos",
        "description": "articulos",
        "required": true,
        "max_length": 1500
      },
      {
        "max_value": 100000000,
        "min_value": 0.01,
        "type": 10,
        "name": "monto",
        "description": "monto",
        "required": false
      },
      {
        "type": 3,
        "name": "placa",
        "description": "placa",
        "required": false,
        "max_length": 20
      }
    ],
    "name": "multar",
    "description": "Registra una multa y genera PDF",
    "dm_permission": false,
    "type": 1
  }
};
