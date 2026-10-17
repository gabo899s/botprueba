const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
function page(reduced){const d=new JSDOM(fs.readFileSync(path.join(root,'public/index.html'),'utf8'),{url:'http://localhost:3000',runScripts:'outside-only',pretendToBeVisual:true});d.window.matchMedia=()=>({matches:reduced});d.window.scrollTo=()=>{};d.window.HTMLElement.prototype.scrollIntoView=function(){};return d;}
function run(w){w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));}
test('movimiento reducido omite la cortina y libera controles, manteniendo el hero adjunto',()=>{
 const d=page(true),w=d.window;run(w);assert.ok(w.document.body.classList.contains('portfolio-revealed'));assert.equal(w.document.querySelector('#intro-stage').style.display,'none');assert.equal(w.document.querySelectorAll('[inert]').length,0);assert.equal(w.document.querySelector('#hero-infinitas-slot').textContent,'Infinitas');assert.ok(w.document.querySelector('.products-menu a[href="/maes-rp"]'));d.window.close();
});
test('entrada adjunta conserva 21 fuentes únicas, metal, vuelo y desbloqueo final',()=>{
 const d=page(false),w=d.window;let callback,now=0;w.Date.now=()=>now;w.requestAnimationFrame=fn=>{callback=fn;return 1;};w.cancelAnimationFrame=()=>{};run(w);
 const word=w.document.querySelector('#intro-word'),faces=[word.style.fontFamily];assert.ok(w.document.querySelector('main').hasAttribute('inert'));
 now=1600;callback();assert.equal(word.style.fontFamily,faces[0]);
 let time=1700;for(const interval of [620,530,450,380,320,268,222,182,148,120,96,78,64,54,48,45,42,40,38,36]){
  now=time;callback();faces.push(word.style.fontFamily);assert.equal(word.textContent,'Infinitas');time+=interval;
 }
 assert.equal(new Set(faces).size,21);now=5600;callback();assert.ok(word.classList.contains('infinitas-metallic'));
 now=7600;callback();assert.ok(w.document.body.classList.contains('portfolio-revealed'));
 now=10000;callback();assert.equal(w.document.querySelector('#intro-stage').style.display,'none');assert.equal(w.document.querySelectorAll('[inert]').length,0);assert.ok(w.document.querySelector('#hero-infinitas-slot').classList.contains('slot-visible'));d.window.close();
});
test('ocultar la pestaña durante la entrada libera el contenido y cancela el ciclo',()=>{
 const d=page(false),w=d.window;let cancelled=0;w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>cancelled++;run(w);Object.defineProperty(w.document,'hidden',{value:true,configurable:true});w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(w.document.querySelectorAll('[inert]').length,0);assert.equal(w.document.querySelector('#intro-stage').style.display,'none');assert.equal(cancelled,1);d.window.close();
});
test('aura pertenece al hero, trayectoria no usa tarjeta y no existe transición violeta',()=>{
 const d=page(true),w=d.window;run(w);assert.ok(w.document.querySelector('#inicio #hero-aura'));assert.equal(w.document.querySelector('.violet-field,.intro-edge'),null);assert.equal(w.document.querySelector('#experiencia .minimal-card'),null);const before=w.document.body.style.cssText;w.dispatchEvent(new w.Event('scroll'));assert.equal(w.document.body.style.cssText,before);d.window.close();
});
