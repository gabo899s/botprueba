const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('OAuth Discord conserva foto y sesión tras reinicio, renueva tokens y revoca logout y roles',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'discord-login-'));require('./helpers/application-sandbox').copyApplication(root,directory);let child,base;
 const bootstrap=`let offset=0,revoked=false,renewals=0;const actualNow=Date.now;Date.now=()=>actualNow()+offset;process.on('message',m=>{offset+=m.advance||0;if(m.revoke)revoked=true;process.send({renewals})});global.fetch=async(url,options={})=>({ok:true,status:200,json:async()=>{if(url.endsWith('/oauth2/token')){if(options.body.get('grant_type')==='refresh_token'){renewals++;return{access_token:'fixture-renewed-access',refresh_token:'fixture-renewed-refresh',expires_in:3600}}return{access_token:'fixture-initial-access',refresh_token:'fixture-initial-refresh',expires_in:1200}}if(url.endsWith('/users/@me'))return{id:'111111111111111111',username:'MiDiscord',global_name:'Mi Perfil',avatar:'a_fixture'};return{roles:revoked?[]:['333333333333333333']}}});const app=require('./server');const server=app.listen(0,'127.0.0.1',()=>console.log('PORT='+server.address().port));`;
 async function start(){
  child=spawn(process.execPath,['-e',bootstrap],{cwd:directory,env:{...process.env,NODE_PATH:path.join(root,'node_modules'),MAESRP_DATA_DIR:path.join(directory,'bot/data'),BASE_URL:'http://localhost:3000',JWT_SECRET:'fixture-persistent-cookie-signing-key',DISCORD_CLIENT_ID:'fixture-app',DISCORD_CLIENT_SECRET:'fixture-secret',DISCORD_GUILD_ID:'222222222222222222',ADMIN_GUILD_ID:'222222222222222222',ADMIN_ROLE_IDS:'333333333333333333',POLICE_ROLE_IDS:'444444444444444444',DISCORD_TOKEN:''},stdio:['ignore','pipe','pipe','ipc']});
  let output='';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Preview timeout')),10000);child.stdout.on('data',b=>{output+=b;const match=output.match(/PORT=(\d+)/);if(match){base='http://localhost:'+match[1];clearTimeout(timeout);resolve();}});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Server exit '+code));});});
 }
 async function stop(){const c=child;if(!c)return;await new Promise(resolve=>{c.once('exit',resolve);c.kill();});child=null;}
 const request=(route,session,method='GET')=>fetch(base+route,{method,headers:{'X-Local-Request':'1',...(session?{Cookie:session}:{})},redirect:'manual'});
 const cookie=(response,name)=>response.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0];
 const ipc=m=>new Promise(resolve=>{child.once('message',resolve);child.send(m);});
 try{
  await start();assert.equal((await request('/api/local/login',null,'POST')).status,410);
  const begin=await request('/auth/discord'),authUrl=new URL(begin.headers.get('location'));assert.equal(authUrl.searchParams.get('scope'),'identify guilds.members.read');assert.equal(authUrl.searchParams.get('redirect_uri'),'http://localhost:3000/auth/discord/callback');
  const callback=await request('/auth/discord/callback?code=fixture&state='+authUrl.searchParams.get('state'),cookie(begin,'oauth_state')),session=cookie(callback,'session');assert.ok(session);assert.match(callback.headers.getSetCookie().find(c=>c.startsWith('session=')),/Max-Age=2592000/);
  for(let reload=0;reload<2;reload++){const me=await(await request('/api/auth/me',session)).json();assert.equal(me.user.discordUsername,'MiDiscord');assert.equal(me.user.discordAvatar,'https://cdn.discordapp.com/avatars/111111111111111111/a_fixture.gif');assert.equal(me.user.hasPoliceAccess,false);assert.equal(me.user.isAdmin,true);assert.ok(!JSON.stringify(me).includes('fixture-initial-access'));}
  await stop();await start();assert.equal((await request('/api/auth/me',session)).status,200);
  await ipc({advance:21*60000});assert.equal((await request('/api/auth/me',session)).status,200);assert.equal((await ipc({})).renewals,1);
  await ipc({advance:31000,revoke:true});assert.equal((await request('/api/admin/staff',session)).status,403);
  assert.equal((await request('/api/auth/logout',session,'POST')).status,200);assert.equal((await request('/api/auth/me',session)).status,401);
  await stop();await start();assert.equal((await request('/api/auth/me',session)).status,401);
 }finally{await stop();fs.rmSync(directory,{recursive:true,force:true});}
});
