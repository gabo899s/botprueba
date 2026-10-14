const store=require('../lib/store'),domain=require('./domain'),settings=require('./settings');
const {v2Payload}=require('./presentation');
async function begin({i,c,str,respond},edit=false) {
 domain.requireScope(c,'admin');
 const name=str('nombre'),content=str('contenido'),color=str('color') || null;
 if(name&&content){const r=domain.createMessage(c,name,content,color);return respond(i,'Mensaje guardado',r.id);}
 if(edit&&!name)throw Error('Selecciona el nombre del mensaje que quieres editar.');
 const key=i.guildId+':'+c.id;
 store.update('messageDrafts',db=>{db[key]={owner:c.id,guildId:i.guildId,channelId:i.channelId,name:name||null,color,stage:content?'name':'content',content:content||null,expires:Date.now()+600000};});
 return respond(i,content?'Esperando nombre':'Esperando Mensaje',content?'Escribe el nombre para guardar este mensaje.':'Envía el contenido en este canal. Puedes incluir [separador] y enlaces de imágenes de Discord. Tienes 10 minutos.');
}
async function receive(message) {
 const key=message.guildId+':'+message.author.id;
 const draft=store.read('messageDrafts')[key];
 if(!draft||draft.channelId!==message.channelId)return false;
 if(draft.expires<Date.now()){store.update('messageDrafts',db=>delete db[key]);await message.channel.send(v2Payload({content:'La creación del mensaje ha caducado.',allowedMentions:{parse:[]}}));return true;}
 if(!settings.allowed(message.member,'admin'))throw Error('Ya no tienes permisos para configurar mensajes.');
 let waiting=false;
 const raw=[message.content,...[...message.attachments.values()].map(file=>file.url)].filter(Boolean).join('\n');
 if(draft.stage==='content'){
  if(!raw.trim()||raw.length>4000)throw Error('El contenido debe tener entre 1 y 4000 caracteres.');
  require('./message-builder').buildMessage({content:raw,color:draft.color}).toJSON();
  draft.content=raw;
  if(draft.name){domain.createMessage({id:message.author.id,admin:true},draft.name,raw,draft.color);store.update('messageDrafts',db=>delete db[key]);}
  else{waiting=true;draft.stage='name';store.update('messageDrafts',db=>{db[key]=draft;});}
 }else{domain.createMessage({id:message.author.id,admin:true},raw.trim(),draft.content,draft.color);store.update('messageDrafts',db=>delete db[key]);}
 let deleted=true;try{await message.delete();}catch{deleted=false;}

 await message.channel.send(v2Payload({content:waiting?'Esperando nombre. Escribe cómo quieres llamar al mensaje.':'Mensaje guardado correctamente.'+(deleted?'':' No pude borrar tu mensaje: revisa los permisos del bot.'),allowedMentions:{parse:[]}}));
 return true;
}
function choices(query){return Object.keys(store.read('messages')).filter(name=>name.toLowerCase().includes(query.toLowerCase())).slice(0,25).map(name=>({name,value:name}));}
module.exports={begin,receive,choices};
