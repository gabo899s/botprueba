const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const source=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'maes-card-access-'));
const ids={owner:'111111111111111111',other:'222222222222222222'};
let child,base,logs='';
function message(value,expected){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.off('message',listener);reject(Error('Sin respuesta IPC '+logs));},10000);const listener=m=>{if(m[expected]){clearTimeout(timeout);child.off('message',listener);resolve(m);}};child.on('message',listener);child.send(value);});}
async function login(who){const begin=await fetch(base+'/auth/discord',{redirect:'manual'}),state=new URL(begin.headers.get('location')).searchParams.get('state');const cookie=begin.headers.getSetCookie().find(c=>c.startsWith('oauth_state=')).split(';')[0];const end=await fetch(base+'/auth/discord/callback?state='+state+'&code='+who,{redirect:'manual',headers:{Cookie:cookie}});assert.equal(end.status,302);return end.headers.getSetCookie().find(c=>c.startsWith('session=')).split(';')[0];}
const request=(session,url='/api/profile/identity.png',options={})=>fetch(base+url,{...options,headers:{...(session?{Cookie:session}:{}),...options.headers}});
before(async()=>{
 require('./helpers/application-sandbox').copyApplication(source,directory);
 const bootstrap=`const ids=${JSON.stringify(ids)};
 global.fetch=async(url,options={})=>({ok:true,status:200,json:async()=>url.endsWith('/oauth2/token')?{access_token:options.body.get('code')}:url.endsWith('/users/@me')?{id:ids[options.headers.Authorization.slice(7)],username:options.headers.Authorization.slice(7)}:{roles:[]}});
 const store=require('./lib/store');store.init();const card={numeroCedula:'RP-ONE',discordId:ids.owner,nombre:'Privado',apellidos:'Ejemplo',createdAt:'2026-10-17T00:00:00Z'};store.write('cedulas',{'RP-ONE':card});
 const images=require('./lib/identity-image'),real=images.identityImage;let hold=false,release;
 images.identityImage=async c=>{if(hold){process.send({imageStarted:true});await new Promise(resolve=>release=resolve);}return real(c);};
 process.on('message',m=>{if(m.hold){hold=true;process.send({holding:true});}if(m.reassign){store.write('cedulas',{'RP-ONE':{...card,discordId:ids.other}});process.send({reassigned:true});}if(m.reset){store.write('cedulas',{'RP-ONE':card});hold=false;process.send({reset:true});}if(m.release){hold=false;release();}});
 const server=require('./server').listen(0,'127.0.0.1',()=>console.log('CARD_PORT='+server.address().port));`;
 child=spawn(process.execPath,['-e',bootstrap],{cwd:directory,env:{...process.env,NODE_PATH:path.join(source,'node_modules'),MAESRP_DATA_DIR:path.join(directory,'bot/data'),JWT_SECRET:'only-for-test-fixture-card-access-48-characters',BASE_URL:'http://localhost:3000',DISCORD_TOKEN:'',DISCORD_CLIENT_ID:'fixture',DISCORD_CLIENT_SECRET:'fixture',DISCORD_GUILD_ID:'fixture',ADMIN_ROLE_IDS:'fixture-admin'},stdio:['ignore','pipe','pipe','ipc']});
 child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 for(let i=0;i<150;i++){const match=logs.match(/CARD_PORT=(\d+)/);if(match){base='http://localhost:'+match[1];return;}await new Promise(resolve=>setTimeout(resolve,40));}throw Error(logs);
});
after(async()=>{if(child&&!child.killed){const closed=once(child,'exit');child.kill();await closed;}fs.rmSync(directory,{recursive:true,force:true});});
test('imagen privada requiere sesión y solo devuelve el personaje de esa cuenta, ignorando IDs ajenos',async()=>{
 assert.equal((await request()).status,401);
 const owner=await login('owner'),other=await login('other');
 assert.equal((await request(other,'/api/profile/identity.png?userId='+ids.owner)).status,404);
 const response=await request(owner,'/api/profile/identity.png?userId='+ids.other);
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');assert.equal(response.headers.get('cache-control'),'private, no-store');
 const png=Buffer.from(await response.arrayBuffer());assert.equal(png.subarray(1,4).toString(),'PNG');
 assert.ok(!fs.readdirSync(path.join(directory,'public/pdfs')).some(f=>f.endsWith('.png')));
 const profile=await (await request(owner,'/api/profile')).json();assert.match(profile.citizen.identityImageRevision,/^[a-f0-9]{64}$/);
});
test('reasignar cédula durante generación impide entregar la imagen al dueño anterior',async()=>{
 const owner=await login('owner');await message({hold:true},'holding');
 const pending=request(owner);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('No image start')),10000);child.once('message',m=>{clearTimeout(timer);m.imageStarted?resolve():reject(Error(JSON.stringify(m)));});});
 await message({reassign:true},'reassigned');child.send({release:true});
 const response=await pending;assert.equal(response.status,409);assert.notEqual(response.headers.get('content-type'),'image/png');await message({reset:true},'reset');
});
test('cerrar sesión durante generación impide entregar datos después del logout',async()=>{
 const owner=await login('owner');await message({hold:true},'holding');
 const started=once(child,'message');const pending=request(owner);assert.equal((await started)[0].imageStarted,true);
 const logout=await request(owner,'/api/auth/logout',{method:'POST',headers:{'X-Local-Request':'1'}});assert.equal(logout.status,200);child.send({release:true});assert.equal((await pending).status,401);
});
