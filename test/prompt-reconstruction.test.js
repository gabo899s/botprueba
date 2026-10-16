const {test,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),path=require('node:path'),os=require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'maesrp-prompts-'));
process.env.MAESRP_DATA_DIR=temp;
require('../lib/config').root = temp;
const store=require('../lib/store');store.init();
const {v2Payload,container}=require('../bot/presentation');
const {MessageFlags,ActionRowBuilder,ButtonBuilder,ButtonStyle,AttachmentBuilder}=require('discord.js');
const {commands,handlers}=require('../bot/commands');
const {resolveUser,duration}=require('../bot/roblox');
const {resetCharacter}=require('../bot/character');
const {syncLicenseRoles,dispatch}=require('../bot/runtime');
const {messageText}=require('../bot/transcript-content');
const admin={id:'111111111111111111',local:true};
const target='222222222222222222', other='333333333333333333';
after(()=>fs.rmSync(temp,{recursive:true,force:true}));
const texts=payload=>messageText({components:payload.components.map(c=>c.toJSON()),embeds:[]});

test('cada comando dispone de esquema propio y ejecución, incluidos comandos recuperados',()=>{
 assert.equal(commands.length,79);assert.equal(Object.keys(handlers).length,79);
 for(const c of commands){assert.equal(c.data.toJSON().name,c.name);assert.equal(typeof handlers[c.name],'function');assert.equal(handlers[c.name].metadata.name,c.name);}
 for(const name of ['ck','developer','server','reset-nicks','aperturas','multas','sanciones'])assert.ok(handlers[name]);
});
test('Components V2 elimina content y embeds de las respuestas privadas',()=>{
 const p=v2Payload({content:'Texto original',embeds:[{title:'Título',description:'Datos originales'}],flags:64});
 assert.equal(p.content,undefined);assert.equal(p.embeds,undefined);assert.equal(p.flags,64|MessageFlags.IsComponentsV2);
 assert.match(texts(p),/Texto original/);assert.match(texts(p),/Datos originales/);
});
test('botones quedan incrustados y adjuntos PDF visibles en el contenedor',()=>{
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('test').setLabel('Abrir').setStyle(ButtonStyle.Primary));
 const p=v2Payload({embeds:[{title:'Documento',description:'Datos'}],components:[row],files:[new AttachmentBuilder(Buffer.from('test'),{name:'prueba.pdf'})]});
 const content=p.components[0].toJSON().components;
 assert.ok(content.some(c=>c.type===1&&c.components[0].custom_id==='test'));
 assert.ok(content.some(c=>c.type===13&&c.file.url==='attachment://prueba.pdf'));
});
test('errores usan emoji recuperado y separadores sin barra de color',()=>{
 const box=container('Faltan datos','Debes mencionar a un usuario.',{error:true}).toJSON();
 assert.match(box.components[0].content,/1448152756757201050/);assert.equal(box.accent_color,undefined);assert.ok(box.components.some(c=>c.type===14));
});
test('mensajes V2 personalizados existentes conservan su contenedor y flags',()=>{
 const box=container('Personalizado','Texto');const p=v2Payload({components:[box],flags:MessageFlags.IsComponentsV2});assert.equal(p.components[0],box);
});
test('transcripción conserva texto de componentes, botones y documentos',()=>{
 const p=v2Payload({content:'Conversación',files:[new AttachmentBuilder(Buffer.from('pdf'),{name:'registro.pdf'})]});
 const text=texts(p);assert.match(text,/Conversación/);assert.match(text,/registro.pdf/);
});
test('duraciones distinguen minutos de meses y admiten segundos y semanas',()=>{
 assert.equal(duration('45m'),45/1440);assert.equal(duration('1M'),30);assert.equal(duration('1 s'),1/86400);assert.equal(duration('60 segundos'),60/86400);assert.equal(duration('1w'),7);assert.equal(duration('permanente'),0);
 for(const value of ['0s','-1d','hola','999999M'])assert.throws(()=>duration(value));
});
test('Roblox consulta nombre y devuelve el ID para usuarios fuera del juego',async()=>{
 let request;
 const user=await resolveUser('JugadorPrueba',async(url,options)=>{request=JSON.parse(options.body);return{ok:true,json:async()=>({data:[{id:12345,name:'JugadorPrueba'}]})};});
 assert.equal(user.id,'12345');assert.deepEqual(request.usernames,['JugadorPrueba']);
});
test('Roblox rechaza nombres inexistentes y no ejecuta acciones de ER:LC',async()=>{
 await assert.rejects(resolveUser('NoExiste',async()=>({ok:true,json:async()=>({data:[]})})),/no existe/);
});
test('CK elimina solo el personaje seleccionado y preserva moderación y otros usuarios',()=>{
 store.write('cedulas',{[target]:{numeroCedula:'C1'},[other]:{numeroCedula:'C2'}});
 for(const name of ['users','licencias','vehiculos'])store.write(name,{[target]:[{test:true}],[other]:[{test:true}]});
 for(const name of ['multas','arrestos'])store.write(name,[{userId:target},{userId:other}]);
 store.write('bans',[{userId:target}]);store.write('sanciones',{[target]:{sanctions:[{id:'keep'}]}});
 assert.throws(()=>resetCharacter({id:other},target,'CK'));
 resetCharacter(admin,target,'Nuevo personaje');
 for(const name of ['cedulas','users','licencias','vehiculos']){assert.equal(store.read(name)[target],undefined);assert.ok(store.read(name)[other]);}
 assert.equal(store.read('bans').length,1);assert.equal(store.read('sanciones')[target].sanctions[0].id,'keep');
});
test('sincronización registra miembros sin cédula y conserva licencias manuales e inactivas',async()=>{
 const role='444444444444444444';store.write('settings',{licenseRoles:{A1:role}});
 store.write('licencias',{[target]:[{tipo:'B1',estado:'Activa',origen:'examen'}]});
 const members=new Map([[target,{roles:{cache:new Map([[role,true]])}}],[other,{roles:{cache:new Map()}}]]);
 await syncLicenseRoles({members:{fetch:async()=>members}});
 assert.ok(store.read('licencias')[target].some(l=>l.tipo==='A1'&&l.estado==='Activa'));
 members.get(target).roles.cache.clear();await syncLicenseRoles({members:{fetch:async()=>members}});
 assert.ok(store.read('licencias')[target].some(l=>l.tipo==='A1'&&l.estado==='Inactiva'));
 assert.ok(store.read('licencias')[target].some(l=>l.tipo==='B1'&&l.origen==='examen'));
});
test('dispatch ejecuta comando separado y conserva respuesta privada en V2',async()=>{
 let payload;
 await dispatch({commandName:'estado',user:{id:other,username:'Prueba'},member:{roles:[]},options:{getUser:()=>null,getString:()=>null,getNumber:()=>null,getInteger:()=>null},deferReply:async()=>{},editReply:async p=>{payload=p;},deferred:true});
 assert.ok(payload.flags&MessageFlags.IsComponentsV2);assert.match(texts(payload),/Comandos: 79/);
});
test('evaluación de 10 estrellas verifica rol staff y muestra porcentaje real',async()=>{
 const rating=require('../bot/commands/staff/calificar-staff');let payload;
 const context={i:{guild:{},editReply:async p=>{payload=p;}},c:{id:other},user:target,number:()=>10,str:()=> 'Buena atención',domain:require('../bot/domain'),member:async()=>({roles:[]}),settings:{allowed:()=>true},store};
 await rating(context);assert.match(texts(payload),/100.0%/);assert.match(texts(payload),/10\/10/);
 await assert.rejects(rating({...context,settings:{allowed:()=>false}}),/Solo miembros del staff/);
});
test('restablecimiento masivo no intenta cambiar apodos de bots',async()=>{
 let changed=0;
 const reset=require('../bot/nicknames').reset;
 const i={guildId:'g',options:{getUser:()=>null},guild:{members:{fetch:async()=>new Map([['member',{user:{bot:false},nickname:'Viejo',setNickname:async()=>{changed++;}}],['bot',{user:{bot:true},nickname:'Bot',setNickname:async()=>{throw Error('No');}}]])}},editReply:async()=>{}};
 await reset({i,c:admin,domain:require('../bot/domain')});assert.equal(changed,1);
});

test('votar de nuevo retira el voto y conserva categorías civil, staff y después',()=>{
 store.write('polls',{});const d=require('../bot/domain');const p=d.createPoll(admin,2,1,'20:00');
 d.vote({id:target},p.id,'si');d.vote({id:target},p.id,'si');assert.equal(Object.keys(store.read('polls')[p.id].votes).length,0);
 d.vote({id:target},p.id,'later');assert.equal(store.read('polls')[p.id].votes[target],'later');
 const message=require('../bot/poll-message').payload(store.read('polls')[p.id]);assert.match(texts(message),/Se unen después: 1/);
 assert.equal(message.components[0].toJSON().components.find(c=>c.type===1).components.length,5);
});
test('constructor sin color no añade acento y conserva separadores',()=>{
 const built=require('../bot/message-builder').buildMessage({content:'Uno[separador]Dos',color:null}).toJSON();assert.equal(built.accent_color,undefined);assert.equal(built.components.filter(c=>c.type===14).length,1);
});
test('creación conversacional guarda el contenido y el nombre y elimina mensajes de entrada',async()=>{
 const drafts=require('../bot/message-drafts');let feedback=[];let deleted=0;
 const i={guildId:'g',channelId:'ch'};
 await drafts.begin({i,c:admin,str:()=>null,respond:async(...args)=>{feedback.push(args[1]);}});
 const settings=require('../bot/settings');store.write('settings',{adminRoleIds:[target]});
 const make=content=>({guildId:'g',channelId:'ch',author:{id:admin.id},member:{roles:[target]},content,attachments:new Map(),delete:async()=>{deleted++;},channel:{send:async p=>{feedback.push(texts(p));}}});
 await drafts.receive(make('Texto [separador] segundo párrafo'));await drafts.receive(make('Normas Maes'));
 assert.equal(store.read('messages')['Normas Maes'].content,'Texto [separador] segundo párrafo');assert.equal(deleted,2);assert.equal(store.read('messageDrafts')['g:'+admin.id],undefined);
 assert.ok(drafts.choices('Normas').some(choice=>choice.value==='Normas Maes'));
});
test('personalización de cuerpo conserva los datos dinámicos solicitados',()=>{
 store.write('textTemplates',{'cuerpo:Prueba':'Mensaje personalizado: {contenido}'});
 const value=container('Prueba','Dato real');assert.match(texts({components:[value]}),/Mensaje personalizado: Dato real/);store.write('textTemplates',{});
});
test('jerarquía únicamente se registra en el servidor administrativo',()=>{
 assert.equal(commands.find(c=>c.name==='actualizar-jerarquia').guildScope,'admin');
});
test('bienvenida de voz valida el canal antes de conectarse',async()=>{
 await assert.rejects(require('../bot/voice-welcome').speak({member:{}},{}),/canal de voz/);
});

test('copia de licencias JSON se actualiza tras commit y no tras rollback',()=>{
 store.write('licencias',{[target]:[{tipo:'A1',estado:'Activa'}]});
 const before=fs.readFileSync(path.join(temp,'licencias.json'),'utf8');
 assert.throws(()=>store.transaction(()=>{store.write('licencias',{});throw Error('Cancelar');}));
 assert.equal(fs.readFileSync(path.join(temp,'licencias.json'),'utf8'),before);
});
test('instantánea de ban restaura solo roles retirados por el bot',async()=>{
 const {Collection}=require('discord.js');const role='777777777777777777',banRole='888888888888888888';let nick='CIV | Test';
 const roles=new Collection([[role,{id:role,managed:false,editable:true}]]);
 const m={nickname:nick,roles:{cache:roles,remove:async ids=>ids.forEach(id=>roles.delete(id)),add:async ids=>{for(const id of Array.isArray(ids)?ids:[ids])roles.set(id,{id,managed:false,editable:true});}},setNickname:async value=>{nick=value;}};
 const guild={id:'g',roles:{cache:new Map([[role,{}],[banRole,{}]])},members:{fetch:async()=>m}};
 store.write('bans',[{id:'test-ban',userId:target,roblox:'12345',robloxUsername:'Test',status:'aplicado'}]);
 const sync=require('../bot/ban-membership').sync;
 await sync(guild,target,{banRoles:{1:banRole}});assert.equal(roles.has(role),false);assert.equal(nick,'BAN | Test');
 store.update('bans',all=>{all[0].status='retirado';});await sync(guild,target,{banRoles:{1:banRole}});
 assert.ok(roles.has(role));assert.equal(nick,'CIV | Test');
});

test('detener voz sin conexiones previas no provoca errores',()=>{
 assert.doesNotThrow(()=>require('../bot/voice-welcome').stop());
});

test('opciones Discord únicas y ordenadas por obligatoriedad en cada nivel',()=>{
 function check(options){
  const names=new Set();let optional=false;
  for(const option of options||[]){assert.ok(!names.has(option.name),'Opción duplicada: '+option.name);names.add(option.name);
   if(![1,2].includes(option.type)){if(!option.required)optional=true;else assert.equal(optional,false,'Opción requerida después de una opcional: '+option.name);}
   check(option.options);
  }
 }
 for(const command of commands)check(command.data.toJSON().options);
});
