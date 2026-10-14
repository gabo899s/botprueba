const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
domain.removeVehicle(c, user, str("placa"));
      return respond(i, "Vehículo eliminado", "Registro actualizado.");
};

module.exports.metadata = {
  "name": "eliminar-vehiculo",
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
        "name": "placa",
        "description": "placa",
        "required": true,
        "max_length": 50
      }
    ],
    "name": "eliminar-vehiculo",
    "description": "Elimina un vehículo del registro",
    "dm_permission": false,
    "type": 1
  }
};
