module.exports = async context => {
 const sub = context.i.options.getSubcommand();
 const routes = {sancionar:'sancionar',ver:'historial-sanciones',apelar:'apelar-sancion',vaciar:'vaciar-historial'};
 const str = name => sub === 'apelar' && name === 'motivo' ? context.str('motivo_apelacion') : context.str(name);
 return require('./'+routes[sub])({...context,str});
};
module.exports.metadata = {
  "name": "sanciones",
  "scope": "moderator",
  "schema": {
    "name": "sanciones",
    "description": "Gestión de sanciones de Maes RP",
    "options": [
      {
        "type": 1,
        "name": "sancionar",
        "description": "sancionar",
        "options": [
          {
            "type": 6,
            "name": "usuario",
            "description": "usuario",
            "required": true
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
        ]
      },
      {
        "type": 1,
        "name": "ver",
        "description": "ver",
        "options": [
          {
            "type": 6,
            "name": "usuario",
            "description": "usuario",
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "apelar",
        "description": "apelar",
        "options": [
          {
            "type": 6,
            "name": "usuario",
            "description": "usuario",
            "required": true
          },
          {
            "type": 3,
            "name": "motivo_apelacion",
            "description": "motivo_apelacion",
            "required": true,
            "max_length": 1000
          }
        ]
      },
      {
        "type": 1,
        "name": "vaciar",
        "description": "vaciar",
        "options": [
          {
            "type": 6,
            "name": "usuario",
            "description": "usuario",
            "required": true
          },
          {
            "type": 3,
            "name": "confirmacion",
            "description": "confirmacion",
            "required": true,
            "max_length": 40
          }
        ]
      }
    ],
    "dm_permission": false,
    "type": 1
  }
};
