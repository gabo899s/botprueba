module.exports = async ({ i, respond }) => respond(i, 'Diagnóstico Components V2', `Discord.js: ${require('discord.js').version}\nContenedor, texto y separadores disponibles.\nEste mensaje utiliza Components V2.`);

module.exports.metadata = {
  "name": "v2-components",
  "scope": "admin",
  "schema": {
    "options": [],
    "name": "v2-components",
    "description": "Diagnóstico de Components V2 y versión de Discord",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
