const{test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),{spawnSync}=require('node:child_process');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'maes-audit-'));process.env.MAESRP_DATA_DIR=temporary;
const config=require('../lib/config');config.root=temporary;
const store=require('../lib/store');store.init();after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
test('settings está disponible, configured exige secreto de sesión sin contraseña local y update no crea globales',()=>{
 assert.equal(typeof require('../bot/settings').get,'function');const old={JWT_SECRET:process.env.JWT_SECRET,LOCAL_PASSWORD_HASH:process.env.LOCAL_PASSWORD_HASH};
 try{for(const [jwt,password,expected]of [['','',false],['present','',true],['','present',false],['present','present',true]]){process.env.JWT_SECRET=jwt;process.env.LOCAL_PASSWORD_HASH=password;assert.equal(config.configured(),expected);}}
 finally{for(const [key,v]of Object.entries(old)){if(v===undefined)delete process.env[key];else process.env[key]=v;}}
 assert.equal(Object.hasOwn(globalThis,'result'),false);assert.equal(store.update('settings',v=>{v.fixture=true;return 42;}),42);assert.equal(store.read('settings').fixture,true);assert.equal(Object.hasOwn(globalThis,'result'),false);
});
test('arranque independiente captura rechazos, limpia recursos y comunica fallo de conexión',async()=>{
 const code=fs.readFileSync(path.join(__dirname,'../bot/index.js'),'utf8');
 for(const stopFails of [false,true]){let stopped=0;const exported={},processFixture={env:{DISCORD_TOKEN:'fixture'},on:()=>{}},errors=[];
 const runtime={start:async()=>{throw Error('fixture failure');},stop:async()=>{stopped++;if(stopFails)throw Error('cleanup failure');}};
 const requireFixture=()=>runtime;requireFixture.main=exported;
 vm.runInNewContext(code,{require:requireFixture,module:exported,process:processFixture,console:{error:(...x)=>errors.push(x.join(' '))}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(stopped,1);assert.equal(processFixture.exitCode,1);assert.match(errors[0],/Error al iniciar el bot/);
 }
});
test('host público configurado se admite y hosts ajenos se siguen rechazando',()=>{
 const code='const c=require("./lib/config");console.log(JSON.stringify({public:c.allowedHosts.has("panel.example.test"),local:c.allowedHosts.has("localhost"),foreign:c.allowedHosts.has("evil.example.test"),bind:c.listenHost}))';
 const r=spawnSync(process.execPath,['-e',code],{cwd:path.resolve(__dirname,'..'),env:{...process.env,BASE_URL:'https://panel.example.test',LISTEN_HOST:'0.0.0.0'},encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{public:true,local:true,foreign:false,bind:'0.0.0.0'});
});
test('admin/staff rechazan usuario ausente y admin tolera una colección nula',async()=>{
 const app=require('express')();const auth=(req,res,next)=>{if(req.headers['x-test-admin'])req.user={id:'fixture',isAdmin:true};next();};const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
 require('../lib/admin').mountAdmin(app,{auth,wrap,text:v=>String(v||'')});require('../lib/staff').mountStaff(app,{auth,wrap});app.use((error,req,res,next)=>res.status(error.status||500).json({message:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(base+'/api/admin/staff')).status,401);assert.equal((await fetch(base+'/api/staff/me')).status,401);store.write('infostaff',null);
 const options={headers:{'x-test-admin':'1'}};assert.equal((await fetch(base+'/api/admin/staff/123',options)).status,404);assert.deepEqual((await(await fetch(base+'/api/admin/staff',options)).json()).staff,[]);assert.equal((await fetch(base+'/api/admin/summary',options)).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('servidor HTTP permite BASE_URL y localhost, pero rechaza otro Host',()=>{
 const code=`const http=require('node:http');require('./lib/config').root=process.env.MAESRP_DATA_DIR;const app=require('./server');const server=app.listen(0,'127.0.0.1',async()=>{try{const codes=[];for(const host of ['panel.example.test','localhost','evil.example.test'])codes.push(await new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:server.address().port,path:'/health',headers:{Host:host}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject);}));console.log(JSON.stringify(codes));}finally{server.close();}});`;
 const r=spawnSync(process.execPath,['-e',code],{cwd:path.resolve(__dirname,'..'),env:{...process.env,MAESRP_DATA_DIR:temporary,BASE_URL:'https://panel.example.test'},encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout.trim().split('\n').pop()),[200,200,403]);
});
