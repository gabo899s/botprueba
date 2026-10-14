module.exports = context => (require('../../nicknames').reset)(context);

module.exports.metadata = {
  "name": "reset-nicknames",
  "scope": "admin",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": false,
        "type": 6
      }
    ],
    "name": "reset-nicknames",
    "description": "Restablece un apodo o procesa todos con progreso",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
