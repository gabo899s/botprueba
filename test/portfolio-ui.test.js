const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
function page(file,script){const d=new JSDOM(fs.readFileSync(path.join(root,'public',file),'utf8'),{url:'http://localhost:3000/',runScripts:'outside-only'});d.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};d.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new d.window.Event('close'));};return d;}
test('portfolio mantiene contenido adjunto y enlaza el producto a la demo de Maes RP',()=>{
 const d=page('index.html');const doc=d.window.document;
 assert.match(doc.body.textContent,/Soluciones Infinitas/);assert.match(doc.body.textContent,/Trayectoria Profesional/);
 const menu=doc.querySelector('.products-menu');assert.match(menu.textContent,/Productos digitales/);assert.equal(menu.querySelector('a').getAttribute('href'),'/maes-rp');assert.equal(menu.querySelectorAll('a').length,1);
 assert.equal(doc.querySelectorAll('[onclick],[onerror],script:not([src])').length,0);
 for(const node of doc.querySelectorAll('link[rel="stylesheet"],script[src]'))assert.ok(fs.existsSync(path.join(root,'public',node.getAttribute('href')||node.getAttribute('src'))));
 d.window.close();
});
test('asistente conserva notas como texto y vuelve al paso correcto después de confirmar',()=>{
 const d=page('index.html');const w=d.window;let opens=0;w.open=()=>{opens++;};w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));
 const doc=w.document;doc.querySelector('[data-service="web"]').click();const notes=doc.querySelector('#order-notes');notes.value='</textarea><img src=x onerror=alert(1)>';notes.dispatchEvent(new w.Event('input'));doc.querySelector('#btn-next').click();assert.equal(doc.querySelector('.confirm-details img'),null);
 doc.querySelector('#btn-back').click();assert.equal(doc.querySelector('#order-notes').value,notes.value);doc.querySelector('#btn-next').click();assert.equal(opens,0);doc.querySelector('#btn-next').click();assert.equal(opens,1);d.window.close();
});
test('visitante explora perfil de ejemplo y botones sin función no cambian la vista',async()=>{
 const d=page('citizen.html');const w=d.window;let requests=0;w.fetch=async()=>{requests++;return{ok:false,status:401,json:async()=>({message:'Inicia sesión'})};};w.eval(fs.readFileSync(path.join(root,'public/js/citizen.js'),'utf8'));await new Promise(resolve=>setImmediate(resolve));
 const doc=w.document;assert.equal(doc.querySelectorAll('.tile').length,12);assert.equal(doc.querySelector('#demoNotice').hidden,false);assert.match(doc.querySelector('#profile').textContent,/Ciudadano de ejemplo/);
 doc.querySelector('.tile[aria-disabled]').click();assert.equal(doc.querySelector('[data-view="personal"]').hidden,false);assert.equal(requests,1);
 doc.querySelector('.tile[data-panel="identity"]').click();assert.equal(doc.querySelector('[data-view="identity"]').hidden,false);d.window.close();
});
test('perfil autenticado conserva multas, PDF y solicitud real de validación',async()=>{
 const d=page('citizen.html');const w=d.window;let submitted=false;
 w.fetch=async(url,options)=>({ok:true,status:200,json:async()=>url==='/api/auth/me'?{user:{id:'123',nombreCompleto:'Ana',mode:'discord'}}:url==='/api/profile'?{citizen:{nombre:'Ana',apellidos:'Prueba',numeroCedula:'RP-1',multas:[{id:'m1',estado:'REGISTRADA',articulos:'Art. 1',monto:100,pdfUrl:'/pdfs/m1.pdf'}]}}:url==='/api/profile/sanctions'?{sanctions:[]}:url==='/api/tickets'?{items:[]}:(submitted=true,{success:true})});
 w.eval(fs.readFileSync(path.join(root,'public/js/citizen.js'),'utf8'));await new Promise(resolve=>setImmediate(resolve));assert.ok(w.document.querySelector('#records a[href="/pdfs/m1.pdf"]'));assert.equal(w.document.querySelector('#demoNotice').hidden,true);
 w.document.querySelector('#records button').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(submitted,true);d.window.close();
});
