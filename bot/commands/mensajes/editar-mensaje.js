module.exports = context => require("../../message-drafts").begin(context, true);
module.exports.metadata = {
  "name": "editar-mensaje",
  "scope": "admin",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "nombre",
        "description": "nombre",
        "required": false,
        "max_length": 60
      },
      {
        "type": 3,
        "name": "contenido",
        "description": "contenido",
        "required": false,
        "max_length": 4000
      },
      {
        "type": 3,
        "name": "color",
        "description": "color",
        "required": false,
        "max_length": 6
      }
    ],
    "name": "editar-mensaje",
    "description": "Actualiza un mensaje guardado",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
