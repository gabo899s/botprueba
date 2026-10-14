const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      domain.ownOr(c, user, "police");
      const r = domain.citizen(user);
      if (!r) throw Error("Cédula no encontrada.");
      const file = await operations.identityPdf(r);
      return respond(
        i,
        "Identidad",
        `${r.nombre} ${r.apellidos}\nCédula: ${r.numeroCedula}\nRoblox: ${r.roblox?.username || "sin vincular"}`,
        [new AttachmentBuilder(path.join(root, "public/pdfs", file))],
      );
    }
};

module.exports.metadata = {
  "name": "info-cedula",
  "scope": "public",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": false,
        "type": 6
      }
    ],
    "name": "info-cedula",
    "description": "Consulta una cédula registrada",
    "dm_permission": false,
    "type": 1
  }
};
