const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const sub = i.options.getSubcommand();
      if (["estado", "diagnostico"].includes(sub))
        return respond(i, "ER:LC", JSON.stringify(await prc.status()));
      if (sub === "jugadores")
        return respond(i, "Jugadores", rows(await prc.players()));
      if (sub === "vehiculos")
        return respond(i, "Vehículos", rows(await prc.vehicles()));
      if (sub === "cola") return respond(i, "Cola", rows(await prc.queue()));
      if (sub === "baneos")
        return respond(i, "Bans de ER:LC", JSON.stringify(await prc.bans()));
      const selector = str("selector"),
        target = [str("usuario1"), str("usuario2")].filter(Boolean).join(","),
        message = str("complemento1") || "";
      if (["ban", "unban", "kill"].includes(selector))
        domain.requireScope(c, "admin");
      if (
        !["h", "m"].includes(selector) &&
        !target.split(",").every(value => /^(?:[A-Za-z0-9_]{3,20}|\d{1,20})$/.test(value))
      )
        throw Error("Escribe un usuario Roblox válido.");
      if (["h", "m", "pm"].includes(selector) && !message)
        throw Error("Mensaje requerido.");
      await prc.command(
        ":" +
          selector +
          (["h", "m"].includes(selector)
            ? " " + message
            : " " + target + (selector === "pm" ? " " + message : selector === "ban" && str("complemento2") ? " " + str("complemento2") : "")),
      );
      store.audit(c.id, "erlc.command", { selector, target });
      return respond(i, "Comando ER:LC confirmado", selector);
    }
};

module.exports.metadata = {
  "name": "erlc",
  "scope": "moderator",
  "schema": {
    "options": [
      {
        "type": 1,
        "name": "estado",
        "description": "Consultar estado de ER:LC",
        "options": []
      },
      {
        "type": 1,
        "name": "jugadores",
        "description": "Consultar jugadores de ER:LC",
        "options": []
      },
      {
        "type": 1,
        "name": "vehiculos",
        "description": "Consultar vehiculos de ER:LC",
        "options": []
      },
      {
        "type": 1,
        "name": "cola",
        "description": "Consultar cola de ER:LC",
        "options": []
      },
      {
        "type": 1,
        "name": "baneos",
        "description": "Consultar baneos de ER:LC",
        "options": []
      },
      {
        "type": 1,
        "name": "diagnostico",
        "description": "Consultar diagnostico de ER:LC",
        "options": []
      },
      {
        "type": 1,
        "name": "command",
        "description": "Ejecuta un comando ER:LC autorizado",
        "options": [
          {
            "type": 3,
            "choices": [
              {
                "name": "pm",
                "value": "pm"
              },
              {
                "name": "h",
                "value": "h"
              },
              {
                "name": "m",
                "value": "m"
              },
              {
                "name": "kick",
                "value": "kick"
              },
              {
                "name": "ban",
                "value": "ban"
              },
              {
                "name": "unban",
                "value": "unban"
              },
              {
                "name": "refresh",
                "value": "refresh"
              },
              {
                "name": "kill",
                "value": "kill"
              }
            ],
            "name": "selector",
            "description": "Comando",
            "required": true
          },
          {
            "type": 3,
            "name": "usuario1",
            "description": "Usuario Roblox",
            "required": false,
            "max_length": 40
          },
          {
            "type": 3,
            "name": "complemento1",
            "description": "Mensaje o motivo",
            "required": false,
            "max_length": 500
          },
          {
            "type": 3,
            "name": "usuario2",
            "description": "Segundo usuario Roblox opcional",
            "required": false,
            "max_length": 40
          },
          {
            "type": 3,
            "name": "complemento2",
            "description": "Razón del castigo",
            "required": false,
            "max_length": 500
          }
        ]
      }
    ],
    "name": "erlc",
    "description": "Controla tu servidor ER:LC",
    "dm_permission": false,
    "type": 1
  }
};
