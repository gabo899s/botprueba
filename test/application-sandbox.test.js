const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const{copyApplication}=require('./helpers/application-sandbox');
test('sandbox excluye datos, documentos y secretos de una instalación con historial',()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'maes-sandbox-')),source=path.join(temporary,'installed'),target=path.join(temporary,'test');
 const existing=['bot/data/maesrp.sqlite','bot/data/multas.json','bot/data/notifications/old.json','bot/config.json','public/pdfs/old.pdf','public/uploads/evidence.png'];
 const code=['server.js','lib/pdf.js','lib/pdf-fonts/example.ttf','bot/operations.js','public/index.html'];
 try{for(const file of [...existing,...code]){const f=path.join(source,file);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,existing.includes(file)?'private-existing-content':'test-code');}
  copyApplication(source,target);
  for(const file of existing){assert.equal(fs.existsSync(path.join(target,file)),false,file+' no debe copiarse');assert.equal(fs.readFileSync(path.join(source,file),'utf8'),'private-existing-content');}
  for(const file of code)assert.equal(fs.readFileSync(path.join(target,file),'utf8'),'test-code');
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
