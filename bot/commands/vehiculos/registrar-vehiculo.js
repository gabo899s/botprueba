const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const r = domain.registerVehicle(c, {
        placa: str("placa"),
        modelo: str("modelo"),
        marca: str("marca"),
        año: integer("año"),
        color: str("color"),
      });
      return respond(i, "Vehículo registrado", r.placa + " · " + r.modelo);
    }
};

module.exports.metadata = {
  "name": "registrar-vehiculo",
  "scope": "public",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "placa",
        "description": "placa",
        "required": true,
        "max_length": 20
      },
      {
        "type": 3,
        "name": "modelo",
        "description": "modelo",
        "required": true,
        "max_length": 80
      },
      {
        "type": 3,
        "name": "marca",
        "description": "marca",
        "required": false,
        "max_length": 60
      },
      {
        "max_value": 2100,
        "min_value": 1900,
        "type": 4,
        "name": "año",
        "description": "año",
        "required": false
      },
      {
        "type": 3,
        "name": "color",
        "description": "color",
        "required": false,
        "max_length": 40
      }
    ],
    "name": "registrar-vehiculo",
    "description": "Inscribe un vehículo de tu personaje",
    "dm_permission": false,
    "type": 1
  }
};
