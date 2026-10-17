const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
async function fixture(baseURL,run){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'transport-policy-'));require('./helpers/application-sandbox').copyApplication(root,directory);let child;
 const bootstrap=`global.fetch=async(url,options={})=>({ok:true,status:200,json:async()=>url.endsWith('/oauth2/token')?{access_token:'fixture-token'}:url.endsWith('/users/@me')?{id:'111111111111111111',username:'Fixture'}:{roles:[]}});require('./server').listen(0,'127.0.0.1',function(){console.log('PORT='+this.address().port)});`;
 try{
  child=spawn(process.execPath,['-e',bootstrap],{cwd:directory,env:{...process.env,NODE_PATH:path.join(root,'node_modules'),MAESRP_DATA_DIR:path.join(directory,'bot/data'),BASE_URL:baseURL,JWT_SECRET:'isolated-transport-fixture-signing-key',DISCORD_CLIENT_ID:'fixture',DISCORD_CLIENT_SECRET:'fixture',DISCORD_GUILD_ID:'222222222222222222',DISCORD_TOKEN:''},stdio:['ignore','pipe','pipe']});
  let output='';const base=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Fixture did not start')),10000);child.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/PORT=(\d+)/);if(m){clearTimeout(timeout);resolve('http://localhost:'+m[1]);}});child.once('exit',code=>{clearTimeout(timeout);reject(Error('Fixture exit '+code));});});await run(base);
 }finally{if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});fs.rmSync(directory,{recursive:true,force:true});}
}
test('HTTP remoto conserva la página pública pero no crea cookies OAuth ni admite datos autenticados',async()=>{
 await fixture('http://panel.example:3000',async base=>{
  assert.equal((await fetch(base+'/')).status,200);
  for(const route of ['/auth/discord','/api/auth/me']){const response=await fetch(base+route,{redirect:'manual'});assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);}
 });
});
test('HTTPS normalizado activa Secure y HSTS y conserva el callback canónico',async()=>{
 await fixture('HTTPS://PANEL.EXAMPLE:443/',async base=>{
  const begin=await fetch(base+'/auth/discord',{redirect:'manual'}),url=new URL(begin.headers.get('location'));
  assert.equal(url.searchParams.get('redirect_uri'),'https://panel.example/auth/discord/callback');assert.match(begin.headers.get('strict-transport-security'),/max-age=/);assert.match(begin.headers.get('set-cookie'),/Secure/);
  const response=await fetch(base+'/auth/discord/callback?code=fixture&state='+url.searchParams.get('state'),{headers:{Cookie:begin.headers.getSetCookie()[0].split(';')[0]},redirect:'manual'});
  assert.match(response.headers.getSetCookie().find(c=>c.startsWith('session=')),/Secure/);
 });
});
