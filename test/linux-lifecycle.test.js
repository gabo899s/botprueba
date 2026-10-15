const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('inicio en segundo plano es único, libera locks y se detiene sin perder datos',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'botprueba-linux-'));
 require('./helpers/application-sandbox').copyApplication(root,dir);
 fs.cpSync(path.join(root,'scripts'),path.join(dir,'scripts'),{recursive:true});
 for(const name of ['iniciar-linux.sh','detener-linux.sh','package.json','server.js'])fs.copyFileSync(path.join(root,name),path.join(dir,name));
 fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 fs.writeFileSync(path.join(dir,'.env'),`PORT=${port}\nJWT_SECRET=fixture-key-not-a-real-secret\nLOCAL_PASSWORD_HASH=fixture-hash\nDISCORD_TOKEN=\n`);
 // Fuerza la ventana real entre crear el proceso y ejecutar Node (equipos lentos).
 const bin=path.join(dir,'.runtime/test-bin');fs.mkdirSync(bin,{recursive:true});
 const nohup=spawnSync('bash',['-c','command -v nohup'],{encoding:'utf8'}).stdout.trim();
 fs.writeFileSync(path.join(bin,'nohup'),'#!/usr/bin/env bash\nsleep 0.4\nexec "$LIFECYCLE_REAL_NOHUP" "$@"\n',{mode:0o755});
 const env={...process.env,LIFECYCLE_REAL_NOHUP:nohup,PATH:bin+':'+process.env.PATH};delete env.MAESRP_DATA_DIR;delete env.DISCORD_TOKEN;delete env.PORT;delete env.BASE_URL;
 function run(args){const r=spawnSync('bash',args,{cwd:dir,env,encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return r.stdout;}
 try{
  assert.match(run(['-c','mkdir -p .runtime; exec 9>.runtime/update.lock; flock -n 9; bash iniciar-linux.sh']),/Iniciado/);
  const pid=fs.readFileSync(path.join(dir,'.runtime/app.pid'),'utf8');
  assert.match(run(['iniciar-linux.sh']),/Ya está iniciado/);assert.equal(fs.readFileSync(path.join(dir,'.runtime/app.pid'),'utf8'),pid);
  run(['-c','flock -n .runtime/update.lock -c true']);
  const response=await fetch(`http://127.0.0.1:${port}/health`);assert.equal(response.status,200);
  run(['detener-linux.sh']);assert.equal(fs.existsSync(path.join(dir,'.runtime/app.pid')),false);assert.ok(fs.existsSync(path.join(dir,'.env')));assert.ok(fs.existsSync(path.join(dir,'bot/data/maesrp.sqlite')));
 }finally{spawnSync('bash',['detener-linux.sh'],{cwd:dir,env,timeout:10000});fs.rmSync(dir,{recursive:true,force:true});}
});
