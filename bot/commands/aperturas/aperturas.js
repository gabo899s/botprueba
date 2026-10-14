module.exports = async context => {
 const {i, c, str, integer, domain, store, respond} = context;
 const sub = i.options.getSubcommand();
 if (sub === 'server') return require('./estado-sv')({ ...context, str: name => name === 'estado' ? (str('estado') === 'ON' ? 'abierto' : 'cerrado') : str(name) });
 if (sub === 'encuesta') return require('./encuesta-apertura')({ ...context, integer: name => name === 'min-votos' ? integer('minimo_civiles') : name === 'min-mods' ? 0 : integer(name) });
 const polls = Object.values(store.read('polls')).filter(p => p.status === 'abierta');
 return respond(i, 'Votantes de apertura', polls.map(p => `Encuesta ${p.id}\n` + Object.entries(p.votes).map(([id,vote]) => `<@${id}>: ${vote}`).join('\n')).join('\n\n') || 'Sin encuestas abiertas.');
};
module.exports.metadata = {
  "name": "aperturas",
  "scope": "staff",
  "schema": {
    "name": "aperturas",
    "description": "Gestiona aperturas, encuestas y votantes",
    "options": [
      {
        "type": 1,
        "name": "server",
        "description": "server",
        "options": [
          {
            "type": 3,
            "name": "estado",
            "description": "estado",
            "required": true,
            "choices": [
              {
                "name": "Abierto",
                "value": "ON"
              },
              {
                "name": "Cerrado",
                "value": "OFF"
              }
            ]
          }
        ]
      },
      {
        "type": 1,
        "name": "encuesta",
        "description": "encuesta",
        "options": [
          {
            "type": 4,
            "name": "minimo_civiles",
            "description": "minimo_civiles",
            "required": true,
            "min_value": 1,
            "max_value": 100000
          },
          {
            "type": 3,
            "name": "hora",
            "description": "hora",
            "required": true,
            "max_length": 50
          }
        ]
      },
      {
        "type": 1,
        "name": "lista-votantes",
        "description": "lista-votantes",
        "options": []
      }
    ],
    "dm_permission": false,
    "type": 1
  }
};
