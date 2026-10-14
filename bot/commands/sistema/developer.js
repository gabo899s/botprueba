module.exports = async ({i,c,domain,store,str,respond}) => {
 domain.requireScope(c,'admin');
 if (i.guild.ownerId !== c.id) throw Error('Este comando requiere al dueño del servidor.');
 const saved = store.read('actions').find(a => a.kind === 'delete-channels' && a.guildId === i.guildId && a.actor === c.id && a.status === 'preview' && a.expires > Date.now());
 if (!str('confirmacion')) {
  const channels = [...(await i.guild.channels.fetch()).values()].filter(Boolean);
  const plan = {id:require('node:crypto').randomUUID(),kind:'delete-channels',guildId:i.guildId,actor:c.id,status:'preview',expires:Date.now()+300000,channels:channels.map(ch=>({id:ch.id,name:ch.name}))};
  store.update('actions',all=>all.push(plan));
  return respond(i,'Vista previa de eliminación',plan.channels.map(ch=>`${ch.name}: ${ch.id}`).join('\n') + `\nPara ejecutar este plan escribe ELIMINAR ${plan.id}. Caduca en 5 minutos.`);
 }
 if (!saved || str('confirmacion') !== 'ELIMINAR '+saved.id) throw Error('Confirmación inválida o vista previa caducada.');
 store.update('actions',all=>{all.find(a=>a.id===saved.id).status='executing';});
 let deleted=0,failed=0;
 for (const entry of saved.channels) {
  try { const channel=await i.guild.channels.fetch(entry.id); if(channel){await channel.delete('Plan '+saved.id+' solicitado por dueño '+c.id);deleted++;} }
  catch {failed++;}
 }
 store.update('actions',all=>{const a=all.find(a=>a.id===saved.id);a.status='completed';a.deleted=deleted;a.failed=failed;});
 store.audit(c.id,'developer.delete-channels',{id:saved.id,deleted,failed});
 return respond(i,'Eliminación terminada',`Eliminados: ${deleted}\nFallidos: ${failed}`);
};
module.exports.metadata = {
  "name": "developer",
  "scope": "admin",
  "schema": {
    "name": "developer",
    "description": "Vista previa y eliminación explícita de canales",
    "options": [
      {
        "type": 1,
        "name": "eliminar-canales",
        "description": "eliminar-canales",
        "options": [
          {
            "type": 3,
            "name": "confirmacion",
            "description": "confirmacion",
            "required": false,
            "max_length": 80
          }
        ]
      }
    ],
    "dm_permission": false,
    "type": 1,
    "default_member_permissions": "8"
  }
};
