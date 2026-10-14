const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const p = domain.createPoll(
        c,
        integer("min-votos"),
        integer("min-mods"),
        str("hora"),
      );
      const ch = settings.get().channels.openings
        ? await i.guild.channels.fetch(settings.get().channels.openings)
        : i.channel;
      if (!ch?.isTextBased()) throw Error("Canal de apertura inválido.");
      const sent = await ch.send(require("../../poll-message").payload(p));
      store.update("polls", db => { db[p.id].channelId = ch.id; db[p.id].messageId = sent.id; db[p.id].guildId = i.guildId; });
      return respond(i, "Encuesta publicada", p.id);
    }
};

module.exports.metadata = {
  "name": "encuesta-apertura",
  "scope": "staff",
  "schema": {
    "options": [
      {
        "max_value": 100000,
        "min_value": 1,
        "type": 4,
        "name": "min-votos",
        "description": "min-votos",
        "required": true
      },
      {
        "max_value": 1000,
        "min_value": 0,
        "type": 4,
        "name": "min-mods",
        "description": "min-mods",
        "required": true
      },
      {
        "type": 3,
        "name": "hora",
        "description": "hora",
        "required": false,
        "max_length": 50
      }
    ],
    "name": "encuesta-apertura",
    "description": "Publica una encuesta persistente de apertura",
    "dm_permission": false,
    "type": 1
  }
};
