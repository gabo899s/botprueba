module.exports = async ({ i,c,str,domain,store,respond }) => {
 domain.requireScope(c,'admin');
 const key=str('clave');
 if(!/^(pie|titulo:.{1,150}|cuerpo:.{1,150})$/.test(key))throw Error('Usa pie, titulo:Título actual o cuerpo:Título actual. En el cuerpo puedes usar {contenido}.');
 store.update('textTemplates',db=>{db[key]=str('texto');});
 return respond(i,'Texto personalizado',key);
};
module.exports.metadata = {
  "name": "configurar-texto",
  "scope": "admin",
  "schema": {
    "name": "configurar-texto",
    "description": "Personaliza un título, cuerpo o pie del bot",
    "default_member_permissions": "8",
    "dm_permission": false,
    "type": 1,
    "options": [
      {
        "type": 3,
        "name": "clave",
        "description": "pie, titulo:Título o cuerpo:Título",
        "required": true,
        "max_length": 160
      },
      {
        "type": 3,
        "name": "texto",
        "description": "Nuevo texto; {contenido} conserva los datos dinámicos",
        "required": true,
        "max_length": 3500
      }
    ]
  }
};
