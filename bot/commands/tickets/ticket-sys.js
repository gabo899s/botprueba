const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const sub = i.options.getSubcommand();
      if (sub === "enviar-panel") {
        const ch = i.options.getChannel("canal");
        if (!ch.isTextBased()) throw Error("Canal inválido.");
        await ch.send(v2Payload({
          embeds: [
            embed(
              "Soporte Maes RP",
              "Abre un ticket para recibir ayuda del staff.",
            ),
          ],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("ticket:new")
                .setLabel("Abrir ticket")
                .setStyle(ButtonStyle.Primary),
            ),
          ],
        }));
      } else
        store.update("settings", (s) => {
          if (sub === "inactividad") s.ticketInactivityHours = number("horas");
          else s.ticketHighVolume = i.options.getBoolean("activo");
        });
      return respond(i, "Soporte actualizado", "Configuración guardada.");
    }
};

module.exports.metadata = {
  "name": "ticket-sys",
  "scope": "admin",
  "schema": {
    "options": [
      {
        "type": 1,
        "name": "enviar-panel",
        "description": "Publica el panel",
        "options": [
          {
            "name": "canal",
            "description": "Canal de soporte",
            "required": true,
            "type": 7
          }
        ]
      },
      {
        "type": 1,
        "name": "inactividad",
        "description": "Configura horas de inactividad",
        "options": [
          {
            "max_value": 10000,
            "min_value": 1,
            "type": 10,
            "name": "horas",
            "description": "Horas",
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "alto-volumen",
        "description": "Modo de alto volumen",
        "options": [
          {
            "name": "activo",
            "description": "Activar",
            "required": true,
            "type": 5
          }
        ]
      }
    ],
    "name": "ticket-sys",
    "description": "Sistema persistente de soporte",
    "dm_permission": false,
    "type": 1
  }
};
