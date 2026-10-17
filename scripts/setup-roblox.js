const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {privateFile}=require('../lib/private-files');
function saveRobloxConfig(filename,values){
 if(!/^\d{1,30}$/.test(values.ROBLOX_CLIENT_ID||''))throw Error('ID de cliente Roblox inválido.');
 if(!/^[A-Za-z0-9._~-]{8,512}$/.test(values.ROBLOX_CLIENT_SECRET||''))throw Error('Secreto Roblox inválido.');
 if(values.COOKIE_API_KEY&&!/^[A-Za-z0-9._~-]{8,512}$/.test(values.COOKIE_API_KEY))throw Error('Clave Cookie API inválida.');
 if(!privateFile(filename))throw Error('Configura primero la aplicación con configurar-linux.sh.');
 let content=fs.readFileSync(filename,'utf8');
 for(const key of ['ROBLOX_CLIENT_ID','ROBLOX_CLIENT_SECRET','COOKIE_API_KEY']){
  const line=key+'='+JSON.stringify(values[key]||'');const matcher=new RegExp('^(?:export\\s+)?'+key+'\\s*=.*$','gm');
  if(matcher.test(content))content=content.replace(matcher,()=>line);else content+=(content.endsWith('\n')?'':'\n')+line+'\n';
 }
 const temporary=filename+'.'+crypto.randomUUID()+'.tmp';
 try{fs.writeFileSync(temporary,content,{mode:0o600,flag:'wx'});fs.renameSync(temporary,filename);}finally{fs.rmSync(temporary,{force:true});}
}
async function main(){
 if(!process.stdin.isTTY)throw Error('Abre una terminal interactiva para introducir las claves de forma privada.');
 const {root,baseUrl}=require('../lib/config'),filename=path.join(root,'.env');
 if(!privateFile(filename))throw Error('Configura primero la aplicación con configurar-linux.sh.');
 const current=require('dotenv').parse(fs.readFileSync(filename));
 const rl=require('node:readline').createInterface({input:process.stdin,output:process.stdout});
 let hidden=false;const original=rl._writeToOutput.bind(rl);rl._writeToOutput=text=>{if(!hidden)original(text);};
 const ask=(label,key,secret=false)=>new Promise((resolve,reject)=>{
  const close=()=>reject(Error('Configuración cancelada: no se guardaron cambios.'));rl.once('close',close);
  const suffix=current[key]?(secret?' [Enter conserva el valor]':' ['+current[key]+']'):'';
  hidden=false;rl.question(label+suffix+': ',value=>{rl.off('close',close);hidden=false;if(secret)process.stdout.write('\n');const answer=value.trim();resolve(answer==='-'?'':answer||current[key]||'');});hidden=secret;
 });
 try{
  console.log('Configurar Roblox · Las claves se guardan solo en .env.\nCookie API es opcional. Enter conserva valores; - borra el valor.');
  const values={ROBLOX_CLIENT_ID:await ask('Client ID Roblox','ROBLOX_CLIENT_ID'),ROBLOX_CLIENT_SECRET:await ask('Client Secret Roblox nuevo','ROBLOX_CLIENT_SECRET',true),COOKIE_API_KEY:await ask('Clave Cookie API nueva (opcional)','COOKIE_API_KEY',true)};
  saveRobloxConfig(filename,values);
  console.log('Configuración guardada. Callback Roblox: '+baseUrl+'/auth/roblox/callback\nInicia la aplicación y entra en Panel ciudadano → Perfil → Vincular cuenta de Roblox.');
 }finally{hidden=false;rl.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={saveRobloxConfig};
