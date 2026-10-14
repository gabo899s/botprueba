const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const action = {
        "activar-shift": "start",
        "apagar-shift": "stop",
        "pausar-shift": "pause",
        "reanudar-shift": "resume",
      }[i.commandName];
      const r = domain.shift(c, action);
      await log(i.guild, "Turno " + action, `<@${c.id}> · ${r.current ? "Turno " + r.current.state : "Turno finalizado"}`);
      await require("../../activity-panel").publish(client, true).catch(error => console.error("Panel de actividad:", error.message));
      return respond(
        i,
        "Turno actualizado",
        r.current ? ({ active: "Turno activo.", paused: "Turno pausado." }[r.current.state] || r.current.state) : "Turno finalizado.",
      );
    }
};

module.exports.metadata = {
  "name": "pausar-shift",
  "scope": "staff",
  "schema": {
    "options": [],
    "name": "pausar-shift",
    "description": "Pausa tu turno",
    "dm_permission": false,
    "type": 1
  }
};
