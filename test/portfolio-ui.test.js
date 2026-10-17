const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
function page(file,script){const d=new JSDOM(fs.readFileSync(path.join(root,'public',file),'utf8'),{url:'http://localhost:3000/',runScripts:'outside-only'});d.window.matchMedia=()=>({matches:true});d.window.HTMLElement.prototype.scrollIntoView=function(){};d.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};d.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new d.window.Event('close'));};return d;}
function loadCitizen(w){for(const script of w.document.querySelectorAll('script[src]'))w.eval(fs.readFileSync(path.join(root,'public',script.getAttribute('src')),'utf8'));}
test('portfolio mantiene contenido adjunto y enlaza el producto a la demo de Maes RP',()=>{
 const d=page('index.html');const doc=d.window.document;
 assert.match(doc.body.textContent.replace(/\s+/g,' '),/Soluciones Infinitas/);assert.match(doc.body.textContent,/Trayectoria Profesional/);
 const menu=doc.querySelector('.products-menu');assert.match(menu.textContent,/Productos digitales/);assert.equal(menu.querySelector('a').getAttribute('href'),'/maes-rp');assert.equal(menu.querySelectorAll('a').length,1);
 assert.equal(doc.querySelectorAll('[onclick],[onerror],[style],script:not([src])').length,0);
 for(const node of doc.querySelectorAll('link[rel="stylesheet"],script[src]'))assert.ok(fs.existsSync(path.join(root,'public',(node.getAttribute('href')||node.getAttribute('src')).split('?')[0])));
 d.window.close();
});
test('nuevo asistente conserva descripciones y notas, escapa HTML y prepara el resumen sin enviarlo',async()=>{
 const d=page('index.html'),w=d.window,doc=w.document;let copied='';Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});
 w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));
 doc.querySelector('[data-service-start="web"]').click();doc.querySelector('#wizard-btn-next').click();assert.ok(!doc.querySelector('#wizard-feedback').classList.contains('hidden'));
 const description=doc.querySelector('#input-project-description'),unsafe='</textarea><img src=x onerror=alert(1)>';
 description.value=unsafe;description.dispatchEvent(new w.Event('input'));doc.querySelector('#wizard-btn-next').click();
 const notes=doc.querySelector('#input-extra-details');notes.value='Conservar estas notas';notes.dispatchEvent(new w.Event('input'));doc.querySelector('#wizard-btn-next').click();
 assert.equal(doc.querySelector('#summary-dl-list img'),null);assert.ok(doc.querySelector('#summary-dl-list').textContent.includes(unsafe));
 doc.querySelector('#wizard-btn-prev').click();assert.equal(notes.value,'Conservar estas notas');doc.querySelector('#wizard-btn-prev').click();assert.equal(description.value,unsafe);
 doc.querySelector('#wizard-btn-next').click();doc.querySelector('#wizard-btn-next').click();doc.querySelector('#btn-copy-summary').click();await new Promise(resolve=>setImmediate(resolve));
 assert.ok(copied.includes(unsafe));assert.ok(copied.includes('Conservar estas notas'));assert.equal(doc.querySelector('#wizard-btn-discord-final').getAttribute('href'),'https://discord.gg/mv2tVKKmqV');d.window.close();
});
test('visitante explora perfil de ejemplo y módulos pendientes con estado explícito',async()=>{
 const d=page('citizen.html');const w=d.window;let requests=0;w.fetch=async()=>{requests++;return{ok:false,status:401,json:async()=>({message:'Inicia sesión'})};};loadCitizen(w);await new Promise(resolve=>setImmediate(resolve));
 const doc=w.document;assert.equal(doc.querySelectorAll('.tile').length,14);assert.equal(doc.querySelector('#demoNotice').hidden,false);assert.match(doc.querySelector('#profile').textContent,/Ciudadano de ejemplo/);
 doc.querySelector('.tile[data-module=store]').click();assert.equal(doc.querySelector('[data-view="module"]').hidden,false);assert.match(doc.querySelector('#moduleDetails').textContent,/Próximamente/);assert.equal(requests,1);
 doc.querySelector('.tile[data-panel="identity"]').click();assert.equal(doc.querySelector('[data-view="identity"]').hidden,false);d.window.close();
});
test('perfil autenticado conserva multas, PDF y solicitud real de validación',async()=>{
 const d=page('citizen.html');const w=d.window;let submitted=false;
 w.fetch=async(url,options)=>({ok:true,status:200,json:async()=>url==='/api/auth/me'?{user:{id:'123',nombreCompleto:'Ana',mode:'discord'}}:url==='/api/profile'?{citizen:{nombre:'Ana',apellidos:'Prueba',numeroCedula:'RP-1',multas:[{id:'m1',estado:'REGISTRADA',articulos:'Art. 1',monto:100,pdfUrl:'/pdfs/m1.pdf'}]}}:url==='/api/profile/sanctions'?{sanctions:[]}:url==='/api/tickets?scope=mine'?{items:[]}:url==='/api/profile/corrections'?{items:[]}:url==='/api/profile/modules'?{modules:[]}:url==='/api/profile/support'?{available:false,message:'Sin bot'}:url==='/api/profile/notifications'?{items:[],unread:0}:(submitted=true,{success:true})});
 loadCitizen(w);await new Promise(resolve=>setImmediate(resolve));assert.ok(w.document.querySelector('#records a[href="/pdfs/m1.pdf"]'));assert.equal(w.document.querySelector('#demoNotice').hidden,true);
 [...w.document.querySelectorAll('#records button')].find(b=>b.textContent==='Solicitar validación de pago').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(submitted,true);d.window.close();
});

test('navbar móvil conserva enlaces, alterna el menú y restaura foco con Escape',()=>{
 const d=page('index.html'),w=d.window;w.matchMedia=()=>({matches:true});w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));
 const button=w.document.querySelector('#mobile-menu-toggle'),panel=w.document.querySelector('#mobile-menu-panel');
 assert.equal(button.getAttribute('aria-expanded'),'false');button.click();assert.ok(!panel.classList.contains('hidden'));assert.equal(button.getAttribute('aria-expanded'),'true');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(w.document.activeElement,button);
 button.click();panel.querySelector('.mobile-nav-link').click();assert.equal(button.getAttribute('aria-expanded'),'false');assert.ok(panel.querySelector('a[href="/maes-rp"]'));w.close();
});
