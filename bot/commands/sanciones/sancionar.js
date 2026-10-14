const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const r = domain.sanction(
        c,
        user,
        str("motivo"),
        i.commandName === "advertir" ? "advertencia" : "sancion",
        str("descripcion") || "",
      );
      await log(i.guild, "Moderación", `Moderador: <@${c.id}>\nUsuario: <@${user}>\nMotivo: ${r.motivo}\nDescripción: ${r.descripcion}\nRegistro: ${r.id}`);
      const role = settings.get().sanctionRoles[r.nivel];
      let roleStatus = "";
      if (role && r.tipo === "sancion") {
        try {
          await (await member(user, i.guild)).roles.add(role);
        } catch {
          roleStatus = " No se pudo aplicar el rol.";
        }
      }
      const { container } = require("../../presentation");
      return i.editReply({
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
        components: [container("<a:load:1462615690321330400> Sanción Aplicada Correctamente",
          `El moderador <@${c.id}> ha aplicado una sancion al usuario <@${user}> con el siguiente contexto:
[separador]
${r.motivo} || ${r.descripcion || "Sin descripción adicional"}
[separador]
<:error:1458531196551303294> Si considera **injusta** esta sancion, puede apelarla mediante el sistema de tickets.
[separador]
Registro: ${r.id} · ${r.castigo}${roleStatus}`, { accent: 0xff3333 })],
      });
    }
};

module.exports.metadata = {
  "name": "sancionar",
  "scope": "moderator",
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
        "name": "motivo",
        "description": "motivo",
        "required": true,
        "max_length": 1000
      },
      {
        "type": 3,
        "name": "descripcion",
        "description": "descripcion",
        "required": false,
        "max_length": 1000
      }
    ],
    "name": "sancionar",
    "description": "Registra una sanción o advertencia de rol",
    "dm_permission": false,
    "type": 1
  }
};
