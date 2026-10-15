const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'maes-pdf-'));
require('../lib/config').root=temporary;
const{generate,identityPdf}=require('../lib/pdf');
after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
const base={id:'test_fine',ciudadano:'Ana María Méndez',documento:'RP-102',fecha:'14/10/2026, 19:30',createdAt:'2026-10-15T01:30:00Z',oficialNombre:'Oficial Sánchez',oficialId:'123456789012345678',userId:'987654321098765432',articulos:'Art. 1: Descripción de la infracción.',monto:1250.25,placa:'RP-001',estado:'REGISTRADA'};
function read(file){return fs.readFileSync(path.join(temporary,'public/pdfs',file));}
function pages(buffer){return (buffer.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;}
test('multa A4 incorpora tipografía embebida, páginas válidas y permisos privados',async()=>{
 const file=await generate('multa',base),buffer=read(file);assert.equal(file,'test_fine.pdf');assert.equal(buffer.subarray(0,5).toString(),'%PDF-');assert.equal(pages(buffer),1);assert.match(buffer.toString('latin1'),/\/FontFile2/);assert.equal(fs.statSync(path.join(temporary,'public/pdfs',file)).mode&0o777,0o600);
});
test('artículos extensos se paginan y arresto conserva la evidencia en un anexo',async()=>{
 const long=await generate('multa',{...base,id:'test_long',articulos:('Artículo de ejemplo con texto extenso para comprobar el expediente.\n').repeat(100)});assert.ok(pages(read(long))>=3);
 fs.mkdirSync(path.join(temporary,'public/uploads'),{recursive:true});fs.copyFileSync(path.join(__dirname,'../public/images/logo.png'),path.join(temporary,'public/uploads/evidence.png'));
 const arrest=await generate('arresto',{...base,id:'test_arrest',tiempo:12,estado:'REGISTRADO',imagenFileName:'evidence.png'});assert.equal(pages(read(arrest)),2);assert.match(read(arrest).toString('latin1'),/\/Subtype \/Image/);
});
test('cédula conserva formato de tarjeta y errores no dejan PDFs parciales ni sobrescriben uno anterior',async()=>{
 const file=await identityPdf({numeroCedula:'RP-102',nombre:'Ana María',apellidos:'Méndez',discordId:base.userId,provincia:'San José',nacionalidad:'Costarricense',fechaNacimiento:'2000-01-01'});assert.equal(pages(read(file)),1);assert.match(read(file).toString('latin1'),/\/MediaBox \[0 0 600 340\]/);
 const before=read('test_fine.pdf');fs.writeFileSync(path.join(temporary,'public/uploads/broken.png'),'not an image');
 await assert.rejects(generate('multa',{...base,imagenFileName:'broken.png'}),{status:400});assert.deepEqual(read('test_fine.pdf'),before);
 await assert.rejects(identityPdf({numeroCedula:'../outside'}),{status:400});assert.ok(!fs.readdirSync(path.join(temporary,'public/pdfs')).some(name=>name.endsWith('.tmp')));
});
test('actualización de PDFs guarda copia previa, conserva datos y se ejecuta una sola vez',async()=>{
 const snapshot={multas:[{...base,id:'test_fine'}],arrestos:[],cedulas:{}};const before=read('test_fine.pdf');
 const {refresh}=require('../scripts/refresh-pdfs');const store={read:key=>structuredClone(snapshot[key])};
 const result=await refresh({project:temporary,store});assert.equal(result.updated,1);assert.equal(result.failed,0);assert.deepEqual(fs.readFileSync(path.join(result.backup,'test_fine.pdf')),before);assert.deepEqual(snapshot.multas[0],base);
 const repeat=await refresh({project:temporary,store});assert.equal(repeat.alreadyCurrent,true);assert.equal(repeat.updated,0);
});
