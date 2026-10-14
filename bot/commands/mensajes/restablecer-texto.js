module.exports = async ({ i,c,str,domain,store,respond }) => {
 domain.requireScope(c,'admin');store.update('textTemplates',db=>delete db[str('clave')]);return respond(i,'Texto restablecido',str('clave'));
};
module.exports.metadata = {
  "name": "restablecer-texto",
  "scope": "admin",
  "schema": {
    "name": "restablecer-texto",
    "description": "Restaura un texto predeterminado del bot",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1,
    "options": [
      {
        "type": 3,
        "name": "clave",
        "description": "Clave configurada",
        "required": true,
        "max_length": 160
      }
    ]
  }
};
