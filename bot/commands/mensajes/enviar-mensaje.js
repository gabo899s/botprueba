const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const message = store.read("messages")[str("nombre")];
      if (!message) throw Error("Mensaje no encontrado.");
      const ch = i.options.getChannel("canal");
      if (!ch.isTextBased() || ch.guildId !== i.guildId)
        throw Error("Canal inválido.");
      await ch.send(v2Payload({
        components: [buildMessage(message)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
      }));
      return respond(i, "Mensaje publicado", message.id);
    }
};

module.exports.metadata = {
  "name": "enviar-mensaje",
  "scope": "admin",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "nombre",
        "description": "nombre",
        "required": true,
        "max_length": 60,
        "autocomplete": true
      },
      {
        "name": "canal",
        "description": "canal",
        "required": true,
        "type": 7
      }
    ],
    "name": "enviar-mensaje",
    "description": "Publica un mensaje guardado en un canal",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
