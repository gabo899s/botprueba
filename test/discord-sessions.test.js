const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const{WebSessions,SESSION_MS}=require('../lib/web-sessions');
test('sesión Discord cifrada sobrevive reinicios, conserva caducidad y elimina permisos cacheados',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'discord-session-')),secret='fixture-signing-key-for-persistence-tests';let sessions;
 try{
  sessions=new WebSessions({directory,secret});const expires=Date.now()+SESSION_MS;
  sessions.set('fixture-session',{user:{mode:'discord',id:'123',discordId:'123',discordUsername:'MiPerfil'},oauth:{accessToken:'private-access-token',refreshToken:'private-refresh-token',guildId:'fixture-guild'},expires,permissionsChecked:Date.now()});sessions.close();
  const file=path.join(directory,'web-sessions.sqlite');assert.equal(fs.statSync(file).mode&0o777,0o600);const bytes=fs.readFileSync(file);assert.ok(!bytes.includes('private-access-token'));assert.ok(!bytes.includes('private-refresh-token'));assert.ok(!bytes.includes('MiPerfil'));
  sessions=new WebSessions({directory,secret});assert.equal(sessions.get('fixture-session').user.discordUsername,'MiPerfil');assert.equal(sessions.get('fixture-session').expires,expires);assert.equal(sessions.get('fixture-session').permissionsChecked,0);
  sessions.delete('fixture-session');sessions.close();sessions=new WebSessions({directory,secret});assert.equal(sessions.has('fixture-session'),false);
 }finally{sessions?.close();fs.rmSync(directory,{recursive:true,force:true});}
});
test('sesiones expiradas y cambio de clave invalidan el acceso persistido',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'discord-expiry-'));let sessions;
 try{sessions=new WebSessions({directory,secret:'fixture-old-key'});for(const [id,expires]of[['expired',Date.now()-1],['valid',Date.now()+SESSION_MS]])sessions.set(id,{user:{mode:'discord',id:'123'},oauth:{accessToken:'secret'},expires});sessions.close();sessions=new WebSessions({directory,secret:'fixture-new-key'});assert.equal(sessions.size,0);}finally{sessions?.close();fs.rmSync(directory,{recursive:true,force:true});}
});
