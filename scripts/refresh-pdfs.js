// Recompone únicamente documentos existentes y respaldados; no modifica registros.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {root}=require('../lib/config');
const {generate,identityPdf}=require('../lib/pdf');
const DESIGN='formal-2026-10-v1';
async function refresh({store=require('../lib/store'),project=root}={}){
 const marker=path.join(project,'.runtime/pdf-design-version');
 if(fs.existsSync(marker)&&fs.readFileSync(marker,'utf8').trim()===DESIGN)return{updated:0,failed:0,alreadyCurrent:true};
 store.init?.();
 const directory=path.join(project,'public/pdfs'),jobs=[];
 for(const [type,key]of [['multa','multas'],['arresto','arrestos']])for(const record of store.read(key)){
  const filename=record.id+'.pdf';
  if(/^[\w-]+\.pdf$/.test(filename)&&fs.existsSync(path.join(directory,filename)))jobs.push({filename,render:()=>generate(type,record)});
 }
 for(const c of Object.values(store.read('cedulas'))){const filename='cedula_'+c.numeroCedula+'.pdf';if(/^[\w-]+\.pdf$/.test(filename)&&fs.existsSync(path.join(directory,filename)))jobs.push({filename,render:()=>identityPdf(c)});}
 let updated=0,failed=0,backup;
 for(const job of jobs){try{
  if(!backup){backup=path.join(project,'.runtime','pdf-backup-'+Date.now()+'-'+crypto.randomUUID());fs.mkdirSync(backup,{recursive:true,mode:0o700});}
  fs.copyFileSync(path.join(directory,job.filename),path.join(backup,job.filename));fs.chmodSync(path.join(backup,job.filename),0o600);
  await job.render();updated++;
 }catch(error){failed++;console.error('PDF conservado sin cambios: '+job.filename+' · '+error.message);}}
 if(!failed){fs.mkdirSync(path.dirname(marker),{recursive:true});fs.writeFileSync(marker,DESIGN+'\n',{mode:0o600});}
 return{updated,failed,backup};
}
if(require.main===module)refresh().then(result=>{console.log(`Diseño PDF: ${result.updated} actualizados; ${result.failed} conservados por incidencias.`);if(result.backup)console.log('Respaldo de documentos: '+result.backup);}).catch(error=>{console.error('No se pudieron actualizar los PDF existentes: '+error.message);process.exitCode=1;});
module.exports={refresh};
