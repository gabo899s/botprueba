const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
return respond(
        i,
        "Multas pendientes",
        rows(
          store
            .read("multas")
            .filter((r) => r.estado !== "PAGADA")
            .map(
              (r) =>
                r.id +
                " · $" +
                r.monto +
                " · " +
                (r.paymentRequested ? "pago solicitado" : "pendiente"),
            ),
        ),
      );
};

module.exports.metadata = {
  "name": "revisar-multas",
  "scope": "police",
  "schema": {
    "options": [],
    "name": "revisar-multas",
    "description": "Consulta multas pendientes y vencimientos",
    "dm_permission": false,
    "type": 1
  }
};
