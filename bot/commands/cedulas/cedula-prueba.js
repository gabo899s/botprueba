module.exports = context => (require("./ver-cedula"))(context);

module.exports.metadata = {
  "name": "cedula-prueba",
  "scope": "admin",
  "schema": {
    "options": [],
    "name": "cedula-prueba",
    "description": "Genera una vista previa PDF de tu identidad registrada",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1
  }
};
