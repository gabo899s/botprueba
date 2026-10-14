module.exports = context => (require('../../nicknames').reset)(context);

module.exports.metadata = {
  "name": "reset-nicks",
  "scope": "admin",
  "schema": {
    "options": [],
    "name": "reset-nicks",
    "description": "Restablece apodos de todos los miembros gestionables",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
