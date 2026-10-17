const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const root=path.resolve(__dirname,'..'),directory=fs.mkdtempSync(path.join(os.tmpdir(),'maes-roblox-oauth-'));
let child,base,logs='',owner,other;const ids={owner:'111111111111111111',other:'222222222222222222'};
const exchange=[];
function request(url,session,extra={}){return fetch(base+url,{redirect:'manual',...extra,headers:{...(session?{Cookie:session}:{}),...extra.headers}});}
function cookie(response,name){return response.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0];}
async function login(who){const start=await request('/auth/discord'),state=new URL(start.headers.get('location')).searchParams.get('state');const end=await request('/auth/discord/callback?state='+state+'&code='+who,cookie(start,'oauth_state'));assert.equal(end.status,302);return cookie(end,'session');}
function ipc(value){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.off('message',listener);reject(Error(logs));},8000);const listener=m=>{if(m.ack){clearTimeout(timeout);child.off('message',listener);resolve();}};child.on('message',listener);child.send(value);});}
async function flow(session=owner){const start=await request('/auth/roblox?returnTo=citizen',session),url=new URL(start.headers.get('location'));assert.equal(url.origin,'https://apis.roblox.com');return{url,callback:'/auth/roblox/callback?state='+url.searchParams.get('state')+'&code=fixture-code',cookies:session+'; '+cookie(start,'oauth_state')};}
before(async()=>{
 require('./helpers/application-sandbox').copyApplication(root,directory);
 const bootstrap=`const ids=${JSON.stringify(ids)},crypto=require('node:crypto');let hold=false,release;
 const store=require('./lib/store');store.init();const original={numeroCedula:'RP-A',discordId:ids.owner,nombre:'Ana',apellidos:'Ejemplo',createdAt:'2026-10-17T00:00:00Z'};store.write('cedulas',{'RP-A':original,'RP-B':{...original,numeroCedula:'RP-B',discordId:ids.other,nombre:'Otra'}});
 global.fetch=async(url,options={})=>{let result;
 if(url==='https://apis.roblox.com/oauth/v1/token'){const b=options.body;process.send({exchange:{challenge:crypto.createHash('sha256').update(b.get('code_verifier')).digest('base64url'),hasSecret:!!b.get('client_secret'),redirect:b.get('redirect_uri')}});result={access_token:'fixture-rbx-access'};}
 else if(url==='https://apis.roblox.com/oauth/v1/userinfo')result={sub:'98765',preferred_username:'Pandasgordo',name:'Pandas',picture:'https://tr.rbxcdn.com/Avatar/full-body.png'};
 else if(url.startsWith('https://thumbnails.roblox.com/')){if(hold){process.send({headshotStarted:true});await new Promise(resolve=>release=resolve);}result={data:[{targetId:98765,state:'Completed',imageUrl:'https://tr.rbxcdn.com/AvatarHeadshot/head.png'}]};}
 else if(url.endsWith('/oauth2/token'))result={access_token:options.body.get('code')};
 else if(url.endsWith('/users/@me'))result={id:ids[options.headers.Authorization.slice(7)],username:options.headers.Authorization.slice(7)};
 else result={roles:[]};return{ok:true,status:200,json:async()=>result};};
 process.on('message',m=>{if(m.reset){store.write('cedulas',{'RP-A':original,'RP-B':{...original,numeroCedula:'RP-B',discordId:ids.other,nombre:'Otra'}});hold=false;}if(m.change){store.update('cedulas',db=>{db['RP-A'].nombre='Cambio durante OAuth';});}if(m.duplicate){store.update('cedulas',db=>{db['RP-B'].roblox={userId:'98765',username:'Pandasgordo'};});}if(m.hold)hold=true;if(m.release){hold=false;release();}process.send({ack:true});});
 const server=require('./server').listen(0,'127.0.0.1',()=>console.log('RBLX_PORT='+server.address().port));`;
 child=spawn(process.execPath,['-e',bootstrap],{cwd:directory,env:{...process.env,NODE_PATH:path.join(root,'node_modules'),MAESRP_DATA_DIR:path.join(directory,'bot/data'),JWT_SECRET:'only-fixture-roblox-session-secret-48-characters',BASE_URL:'http://localhost:3000',DISCORD_TOKEN:'',DISCORD_CLIENT_ID:'fixture',DISCORD_CLIENT_SECRET:'fixture',DISCORD_GUILD_ID:'fixture',ADMIN_ROLE_IDS:'fixture-admin',ROBLOX_CLIENT_ID:'1234567890',ROBLOX_CLIENT_SECRET:'fixture_rbx_secret',COOKIE_API_KEY:''},stdio:['ignore','pipe','pipe','ipc']});
 child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);child.on('message',m=>{if(m.exchange)exchange.push(m.exchange);});
 for(let n=0;n<150;n++){const match=logs.match(/RBLX_PORT=(\d+)/);if(match){base='http://localhost:'+match[1];owner=await login('owner');other=await login('other');return;}await new Promise(r=>setTimeout(r,30));}throw Error(logs);
});
after(async()=>{if(child&&!child.killed){const stop=once(child,'exit');child.kill();await stop;}fs.rmSync(directory,{recursive:true,force:true});});
test('OAuth Roblox usa PKCE, scopes mínimos, regreso ciudadano y miniatura de cabeza persistente',async()=>{
 const f=await flow();assert.equal(f.url.searchParams.get('scope'),'openid profile');assert.equal(f.url.searchParams.get('code_challenge_method'),'S256');assert.match(f.url.searchParams.get('code_challenge'),/^[A-Za-z0-9_-]{43}$/);assert.equal(f.url.searchParams.has('client_secret'),false);
 const end=await request(f.callback,f.cookies);assert.match(end.headers.get('location'),/^\/ciudadano\?message=/);
 assert.equal(exchange.at(-1).challenge,f.url.searchParams.get('code_challenge'));assert.equal(exchange.at(-1).hasSecret,true);assert.equal(exchange.at(-1).redirect,'http://localhost:3000/auth/roblox/callback');
 const {citizen}=await(await request('/api/profile',owner)).json();assert.equal(citizen.roblox.userId,'98765');assert.equal(citizen.roblox.avatarType,'headshot');assert.equal(citizen.roblox.avatarUrl,'https://tr.rbxcdn.com/AvatarHeadshot/head.png');assert.equal(citizen.roblox.accessToken,undefined);
 const count=exchange.length;assert.match((await request(f.callback,f.cookies)).headers.get('location'),/error=/);assert.equal(exchange.length,count);
});
test('otra sesión y una cuenta Roblox ya vinculada no pueden sustituir al titular',async()=>{
 await ipc({reset:true});const f=await flow(),count=exchange.length;const swapped=await request(f.callback,other+'; '+f.cookies.split('; ')[1]);assert.match(swapped.headers.get('location'),/error=/);assert.equal(exchange.length,count);
 await ipc({duplicate:true});const g=await flow();assert.match((await request(g.callback,g.cookies)).headers.get('location'),/error=/);const {citizen}=await(await request('/api/profile',owner)).json();assert.equal(citizen.roblox,undefined);
});
test('un cambio de cédula durante autorización no se sobrescribe con una vinculación antigua',async()=>{
 await ipc({reset:true});const f=await flow();await ipc({change:true});assert.match((await request(f.callback,f.cookies)).headers.get('location'),/error=/);const {citizen}=await(await request('/api/profile',owner)).json();assert.equal(citizen.nombre,'Cambio durante OAuth');assert.equal(citizen.roblox,undefined);
});
test('logout durante consulta de miniatura invalida la vinculación antes de guardar',async()=>{
 await ipc({reset:true});const f=await flow();await ipc({hold:true});
 const started=new Promise(resolve=>{const listener=m=>{if(m.headshotStarted){child.off('message',listener);resolve();}};child.on('message',listener);});const pending=request(f.callback,f.cookies);await started;
 assert.equal((await request('/api/auth/logout',owner,{method:'POST',headers:{'X-Local-Request':'1'}})).status,200);await ipc({release:true});assert.match((await pending).headers.get('location'),/error=/);
 owner=await login('owner');const {citizen}=await(await request('/api/profile',owner)).json();assert.equal(citizen.roblox,undefined);
});
