module.exports = context => (require("./estado-sv"))(context);

module.exports.metadata = {
  "name": "estado-server",
  "scope": "staff",
  "schema": {
    "options": [
      {
        "type": 3,
        "choices": [
          {
            "name": "abierto",
            "value": "abierto"
          },
          {
            "name": "cerrado",
            "value": "cerrado"
          }
        ],
        "name": "estado",
        "description": "estado",
        "required": true,
        "max_length": 1000
      }
    ],
    "name": "estado-server",
    "description": "Actualiza el estado de la apertura",
    "dm_permission": false,
    "type": 1
  }
};
