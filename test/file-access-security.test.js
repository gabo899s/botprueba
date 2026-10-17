const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const source=path.resolve(__dirname,'..');
const ids={owner:'111111111111111111',other:'222222222222222222',police:'333333333333333333',staff:'444444444444444444'};
const identityFile=require('../lib/identity-document').identityFilename({numeroCedula:'C1',discordId:ids.owner,nombre:'Fixture',apellidos:'Owner'});
let directory,child,base,logs='';
const started=[];
function waitStarted(count){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{clearInterval(poll);reject(Error('No se inició el documento: '+logs));},5000);const poll=setInterval(()=>{if(started.length>=count){clearTimeout(timeout);clearInterval(poll);resolve();}},10);});}
async function request(route,{session,method='GET',body,requestId}={}){
 return fetch(base+route,{method,redirect:'manual',headers:{...(session?{Cookie:session}:{}),...(body?{'Content-Type':'application/json','X-Local-Request':'1','X-Request-Id':requestId}: {})},body:body?JSON.stringify(body):undefined});
}
async function login(user){
 const begin=await request('/auth/discord'),state=new URL(begin.headers.get('location')).searchParams.get('state');
 const stateCookie=begin.headers.getSetCookie().find(c=>c.startsWith('oauth_state=')).split(';')[0];
 const callback=await fetch(base+'/auth/discord/callback?state='+state+'&code='+user,{redirect:'manual',headers:{Cookie:stateCookie}});
 assert.equal(callback.status,302);
 return callback.headers.getSetCookie().find(c=>c.startsWith('session=')).split(';')[0];
}
before(async()=>{
 directory=fs.mkdtempSync(path.join(os.tmpdir(),'maesrp-file-security-'));
 require('./helpers/application-sandbox').copyApplication(source,directory);
 const bootstrap=`
 const fs=require('node:fs');const ids=${JSON.stringify(ids)};
 global.fetch=async(url,options={})=>({ok:true,status:200,json:async()=>url.endsWith('/oauth2/token')?{access_token:options.body.get('code')}:url.endsWith('/users/@me')?{id:ids[options.headers.Authorization.slice(7)],username:options.headers.Authorization.slice(7)}:{roles:options.headers.Authorization==='Bearer police'?['fixture-police']:options.headers.Authorization==='Bearer staff'?['fixture-staff']:[]}});
 const store=require('./lib/store');store.init();
 store.write('cedulas',{C1:{numeroCedula:'C1',discordId:ids.owner,nombre:'Fixture',apellidos:'Owner'},C2:{numeroCedula:'C2',discordId:ids.other,nombre:'Fixture',apellidos:'Other'}});
 store.write('multas',[{id:'fine_owner',userId:ids.owner,documento:'C1',pdfFileName:'fine_owner.pdf'},{id:'fine_reassigned',userId:ids.owner,documento:'C2',pdfFileName:'fine_reassigned.pdf'}]);
 store.write('arrestos',[{id:'arrest_owner',userId:ids.owner,documento:'C1',pdfFileName:'arrest_owner.pdf',imagenFileName:'evidence_owner.png'},{id:'arrest_reassigned',userId:ids.owner,documento:'C2',pdfFileName:'arrest_reassigned.pdf',imagenFileName:'evidence_reassigned.png'}]);
 store.write('tickets',{items:{private:{id:'private',userId:ids.owner,transcriptFile:'ticket_private.html'}}});
 for(const name of ['fine_owner.pdf','arrest_owner.pdf','fine_reassigned.pdf','arrest_reassigned.pdf','cedula_C1.pdf',${JSON.stringify(identityFile)},'orphan.pdf'])fs.writeFileSync('public/pdfs/'+name,'%PDF-fixture');
 for(const name of ['ticket_private.html','ticket_orphan.html','evidence_owner.png','evidence_reassigned.png','orphan.png'])fs.writeFileSync('public/uploads/'+name,'private fixture '+name);
 const settings=require('./bot/settings');settings.get=()=>({policeRoleIds:[]});settings.allowed=(member,scope)=>scope==='staff'&&member.roles.includes('fixture-staff');
 const pending=[];require('./lib/pdf').generate=async(type,record)=>{process.send({documentStarted:record.id});await new Promise(resolve=>pending.push(resolve));return record.id+'.pdf';};
 process.on('message',message=>{if(message.releaseDocuments){for(const resolve of pending.splice(0))resolve();}});
 const app=require('./server');const server=app.listen(0,'127.0.0.1',()=>console.log('FILE_PORT='+server.address().port));`;
 child=spawn(process.execPath,['-e',bootstrap],{cwd:directory,env:{...process.env,NODE_PATH:path.join(source,'node_modules'),MAESRP_DATA_DIR:path.join(directory,'bot/data'),JWT_SECRET:'fixture-48-character-secret-for-file-access-tests-only',BASE_URL:'http://localhost:3000',DISCORD_TOKEN:'',DISCORD_CLIENT_ID:'fixture',DISCORD_CLIENT_SECRET:'fixture',DISCORD_GUILD_ID:'fixture',ADMIN_ROLE_IDS:'fixture-admin',POLICE_ROLE_IDS:'fixture-police'},stdio:['ignore','pipe','pipe','ipc']});
 child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data);child.on('message',message=>{if(message.documentStarted)started.push(message.documentStarted);});
 for(let i=0;i<100;i++){const match=logs.match(/FILE_PORT=(\d+)/);if(match){base='http://localhost:'+match[1];return;}await new Promise(resolve=>setTimeout(resolve,30));}
 throw Error('No se inició la aplicación: '+logs);
});
after(async()=>{if(child&&child.exitCode===null){child.kill();await once(child,'exit');}if(directory)fs.rmSync(directory,{recursive:true,force:true});});
test('transcripciones ajenas siguen protegidas con caracteres codificados y aliases de directorio',async()=>{
 const police=await login('police');
 for(const route of ['/api/tickets/private/transcript','/uploads/ticket_private.html','/uploads/%74icket_private.html','/uploads/ticket_%70rivate.html','/UPLOADS/%74icket_private.html','/uploads/%74icket_private%2ehtml']){
  assert.equal((await request(route,{session:police})).status,403,route);
 }
 const owner=await login('owner'),staff=await login('staff');
 for(const session of [owner,staff])for(const route of ['/uploads/ticket_private.html','/uploads/%74icket_private.html','/api/tickets/private/transcript']){
  const response=await request(route,{session});assert.equal(response.status,200,route);assert.match(await response.text(),/private fixture/);
 }
});
test('documentos y evidencias conservan acceso propio y policial, sin exponer archivos huérfanos',async()=>{
 const owner=await login('owner'),other=await login('other'),police=await login('police');
 for(const route of ['/pdfs/fine_owner.pdf','/pdfs/%66ine_owner.pdf','/pdfs/'+identityFile,'/uploads/evidence_owner.png']){
  assert.equal((await request(route)).status,401,route);
  assert.equal((await request(route,{session:other})).status,403,route);
  assert.equal((await request(route,{session:owner})).status,200,route);
  assert.equal((await request(route,{session:police})).status,200,route);
 }
 for(const route of ['/pdfs/orphan.pdf','/pdfs/cedula_C1.pdf','/uploads/orphan.png','/uploads/ticket_orphan.html'])assert.equal((await request(route,{session:police})).status,403,route);
});
test('reasignar una cédula no transfiere acceso a multas, arrestos ni evidencias del titular anterior',async()=>{
 const owner=await login('owner'),other=await login('other');
 for(const route of ['/pdfs/fine_reassigned.pdf','/pdfs/arrest_reassigned.pdf','/uploads/evidence_reassigned.png']){
  assert.equal((await request(route,{session:other})).status,403,route);
  assert.equal((await request(route,{session:owner})).status,200,route);
 }
});
test('rutas dobles, separadores codificados, Unicode y traversal no sirven archivos privados',async()=>{
 const police=await login('police');
 for(const route of ['/uploads/%2574icket_private.html','/uploads/%2fticket_private.html','/uploads//ticket_private.html','/uploads/%2e%2e%2fuploads%2fticket_private.html','/uploads/%5cticket_private.html','/uploads/ticket_private.html%00','/uploads/%ef%bc%8fticket_private.html','/uploads/%','/pdfs/%2e%2e%2f.env']){
  const response=await request(route,{session:police});assert.notEqual(response.status,200,route);assert.doesNotMatch(await response.text(),/private fixture/);
 }
});
test('multas y arrestos comparten el límite concurrente antes de generar documentos',async()=>{
 const police=await login('police');
 const first=request('/api/multa',{session:police,method:'POST',body:{documento:'C1',articulos:'Fixture',valor:50},requestId:'fixture-fine-first'});
 await waitStarted(1);
 const second=request('/api/multa',{session:police,method:'POST',body:{documento:'C1',articulos:'Fixture',valor:60},requestId:'fixture-fine-second'});
 await waitStarted(2);
 try{
  assert.equal((await request('/api/multa',{session:police,method:'POST',body:{documento:'C1',articulos:'Fixture',valor:70},requestId:'fixture-fine-third'})).status,429);
  assert.equal((await request('/api/arresto',{session:police,method:'POST',body:{documento:'C1',articulos:'Fixture',tiempo:1},requestId:'fixture-arrest-third'})).status,429);
 }finally{child.send({releaseDocuments:true});}
 assert.equal((await first).status,200);assert.equal((await second).status,200);
});
test('solo se generan documentos para cédulas propias del registro, sin claves heredadas del prototipo',async()=>{
 const police=await login('police');
 for(const documento of ['constructor','__proto__','toString']){
  const response=await request('/api/multa',{session:police,method:'POST',body:{documento,articulos:'Fixture',valor:30},requestId:'fixture-reserved-'+documento});assert.equal(response.status,400);
 }
});
