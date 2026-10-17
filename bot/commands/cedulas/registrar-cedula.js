const { v2Payload } = require("./../../presentation");
module.exports = async function execute(context) {
const { i, c, user, str, number, integer, fs, path, crypto, root, dataDir, baseUrl, store, domain, settings, operations, prc, commands, economy, respond, rows, safe, embed, member, log, examMessage, createTicket, whitelistApply, syncLicenseRoles, hierarchy, buildMessage, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits, client } = context;
{
      const values = Object.fromEntries(
        [
          "nombre",
          "apellidos",
          "roblox",
          "estatura",
          "nacionalidad",
          "provincia",
          "fecha",
          "sexo",
        ].map((k) => [k, str(k)]),
      );
      values.grupoSanguineo = str("grupo-sanguineo");
      values.lugarNacimiento = str("lugar-nacimiento");
      const r = domain.registerCitizen(c, values);
      const { image, file } = await operations.identityDocuments(r);
      return respond(i, "Cédula registrada", r.numeroCedula, [
        new AttachmentBuilder(image, { name: "cedula-personaje.png" }),
        new AttachmentBuilder(path.join(root, "public/pdfs", file)),
      ]);
    }
};

module.exports.metadata = {
  "name": "registrar-cedula",
  "scope": "public",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "nombre",
        "description": "nombre",
        "required": true,
        "max_length": 80
      },
      {
        "type": 3,
        "name": "apellidos",
        "description": "apellidos",
        "required": true,
        "max_length": 100
      },
      {
        "type": 3,
        "name": "grupo-sanguineo",
        "description": "Grupo sanguíneo del personaje (opcional)",
        "required": false,
        "max_length": 8
      },
      {
        "type": 3,
        "name": "lugar-nacimiento",
        "description": "Lugar de nacimiento del personaje (opcional)",
        "required": false,
        "max_length": 80
      },
      {
        "type": 3,
        "name": "roblox",
        "description": "Busca y selecciona tu usuario de Roblox",
        "autocomplete": true,
        "required": false,
        "max_length": 40
      },
      {
        "type": 3,
        "name": "estatura",
        "description": "estatura",
        "required": false,
        "max_length": 20
      },
      {
        "type": 3,
        "name": "nacionalidad",
        "description": "nacionalidad",
        "required": false,
        "max_length": 50
      },
      {
        "type": 3,
        "name": "provincia",
        "description": "provincia",
        "required": false,
        "max_length": 50
      },
      {
        "type": 3,
        "name": "fecha",
        "description": "fecha",
        "required": false,
        "max_length": 30
      },
      {
        "type": 3,
        "name": "sexo",
        "description": "sexo",
        "required": false,
        "max_length": 20
      }
    ],
    "name": "registrar-cedula",
    "description": "Registra la identidad de tu personaje",
    "dm_permission": false,
    "type": 1
  }
};
