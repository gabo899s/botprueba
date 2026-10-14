module.exports = async ({ c, user, str, respond, i }) => {
 const removed = require('../../character').resetCharacter(c, user, str('motivo'));
 return respond(i, 'CK completado', Object.entries(removed).map(([name, total]) => `${name}: ${total}`).join('\n') + '\nBaneos y sanciones conservados.');
};

module.exports.metadata = {
  "name": "ck",
  "scope": "admin",
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
      }
    ],
    "name": "ck",
    "description": "Elimina los registros del personaje, conservando su moderación",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
