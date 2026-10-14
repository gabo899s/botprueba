module.exports = async context => {
 const {i,c,str,integer,store,operations,economy,respond} = context;
 const sub = i.options.getSubcommand();
 if (sub === 'crear') { context.domain.requireScope(c,'police'); return require('./multar')({...context,number: name => integer(name)}); }
 if (sub === 'ver') return require('./ver-multas')(context);
 const all = store.read('multas').filter(f => f.userId === c.id && f.estado !== 'PAGADA');
 const selected = str('id_multa') ? all.filter(f => f.id === str('id_multa')) : all;
 if (!selected.length) throw Error('No hay multas pendientes seleccionadas.');
 const results = [];
 for (const fine of selected) {
  try { if (process.env.UNBELIEVABOT_TOKEN) { await economy.pay(c,fine.id); results.push(`${fine.id}: pagada`); }
        else { operations.requestPayment(c,fine.id); results.push(`${fine.id}: pendiente de validación`); } }
  catch(error) { results.push(`${fine.id}: ${error.message}`); }
 }
 return respond(i,'Resultado de pagos',results.join('\n'));
};
module.exports.metadata = {
  "name": "multas",
  "scope": "public",
  "schema": {
    "name": "multas",
    "description": "Gestión de multas de Maes RP",
    "options": [
      {
        "type": 1,
        "name": "crear",
        "description": "crear",
        "options": [
          {
            "type": 6,
            "name": "usuario",
            "description": "usuario",
            "required": true
          },
          {
            "type": 4,
            "name": "monto",
            "description": "monto",
            "required": true,
            "min_value": 1,
            "max_value": 100000000
          },
          {
            "type": 3,
            "name": "articulos",
            "description": "articulos",
            "required": true,
            "max_length": 1000
          }
        ]
      },
      {
        "type": 1,
        "name": "pagar",
        "description": "pagar",
        "options": [
          {
            "type": 3,
            "name": "id_multa",
            "description": "id_multa",
            "required": false,
            "max_length": 80
          }
        ]
      },
      {
        "type": 1,
        "name": "ver",
        "description": "ver",
        "options": []
      }
    ],
    "dm_permission": false,
    "type": 1
  }
};
