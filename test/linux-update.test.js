const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('actualización fast-forward conserva datos y credenciales con remoto local y npm simulado',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'botprueba-update-')),source=path.join(temp,'source'),remote=path.join(temp,'remote.git'),target=path.join(temp,'installed');
 function git(dir,...args){const r=spawnSync('git',args,{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
 try{
  fs.mkdirSync(source);git(temp,'init','--bare',remote);git(source,'init','-b','main');git(source,'config','user.name','Fixture');git(source,'config','user.email','fixture@example.test');
  fs.mkdirSync(path.join(source,'scripts'));for(const name of ['actualizar-linux.sh','.gitignore'])fs.copyFileSync(path.join(root,name),path.join(source,name));fs.copyFileSync(path.join(root,'scripts/linux-lib.sh'),path.join(source,'scripts/linux-lib.sh'));
  fs.writeFileSync(path.join(source,'package.json'),JSON.stringify({name:'fixture',version:'1.0.0'}));fs.writeFileSync(path.join(source,'index.html'),'old');
  git(source,'add','.');git(source,'commit','-m','initial');git(source,'remote','add','origin',remote);git(source,'push','origin','main');git(temp,'clone','--branch','main',remote,target);
  const url='https://github.com/gabo899s/botprueba.git';git(target,'remote','set-url','origin',url);git(target,'config',`url.file://${remote}.insteadOf`,url);
  for(const dir of ['bot/data','public/pdfs','public/uploads','.runtime/test-bin'])fs.mkdirSync(path.join(target,dir),{recursive:true});
  fs.writeFileSync(path.join(target,'.env'),'LOCAL_TEST=preserved');fs.writeFileSync(path.join(target,'bot/config.json'),'{}');fs.writeFileSync(path.join(target,'bot/data/marker.json'),'keep-data');
  const npm=path.join(target,'.runtime/test-bin/npm');fs.writeFileSync(npm,'#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> .runtime/npm-called\n');fs.chmodSync(npm,0o755);
  fs.writeFileSync(path.join(source,'index.html'),'new');git(source,'add','index.html');git(source,'commit','-m','update');git(source,'push','origin','main');
  const result=spawnSync('bash',['actualizar-linux.sh'],{cwd:target,env:{...process.env,PATH:path.dirname(npm)+':'+process.env.PATH},encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.equal(fs.readFileSync(path.join(target,'index.html'),'utf8'),'new');assert.equal(fs.readFileSync(path.join(target,'.env'),'utf8'),'LOCAL_TEST=preserved');assert.equal(fs.readFileSync(path.join(target,'bot/data/marker.json'),'utf8'),'keep-data');
  assert.ok(fs.readdirSync(path.join(target,'.runtime')).some(n=>n.startsWith('respaldo-')));assert.match(fs.readFileSync(path.join(target,'.runtime/npm-called'),'utf8'),/ci --no-fund\ntest/);
  assert.equal(fs.readFileSync(path.join(target,'.runtime/installed-revision'),'utf8').trim(),git(source,'rev-parse','HEAD'));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
