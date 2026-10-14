const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      if (process.env.UNBELIEVABOT_TOKEN) {
        await economy.pay(c, str("id_multa"));
        return respond(
          i,
          "Pago confirmado",
          "La multa fue pagada con moneda ficticia de UnbelievaBoat.",
        );
      }
      const r = operations.requestPayment(c, str("id_multa"));
      return respond(
        i,
        "Solicitud de pago",
        `Multa ${r.id}. Pendiente de validación del staff. No se ha cobrado dinero ni marcado como pagada.`,
      );
    }
};

module.exports.metadata = {
  "name": "pagar-multa",
  "scope": "public",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "id_multa",
        "description": "id_multa",
        "required": true,
        "max_length": 80
      }
    ],
    "name": "pagar-multa",
    "description": "Solicita el pago de una multa",
    "dm_permission": false,
    "type": 1
  }
};
