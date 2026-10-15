const fs=require('node:fs'),path=require('node:path');
// Un sandbox contiene código y recursos estáticos, nunca registros ni credenciales.
function copyApplication(source,destination){
 const excluded=['bot/data','bot/config.json','public/pdfs','public/uploads'];
 const filter=file=>{const relative=path.relative(source,file).split(path.sep).join('/');return !excluded.some(p=>relative===p||relative.startsWith(p+'/'));};
 for(const name of ['server.js','lib','public','bot'])fs.cpSync(path.join(source,name),path.join(destination,name),{recursive:true,filter});
}
module.exports={copyApplication};
