const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
function page(reduced){const d=new JSDOM(fs.readFileSync(path.join(root,'public/index.html'),'utf8'),{url:'http://localhost:3000',runScripts:'outside-only',pretendToBeVisual:true});d.window.matchMedia=()=>({matches:reduced});return d;}
function run(w){w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));}
test('movimiento reducido omite entrada y conserva navegación y texto accesible',()=>{
 const d=page(true),w=d.window;run(w);
 assert.equal(w.document.querySelector('.intro-screen').hidden,true);assert.ok(w.document.body.classList.contains('aura-settled'));assert.equal(w.document.querySelector('.products-menu a').getAttribute('href'),'/maes-rp');assert.ok(!w.document.querySelector('.navbar').inert);assert.equal(w.document.querySelector('.hero .metal-word').textContent,'Infinitas');w.close();
});
test('entrada mantiene Infinitas, espera, acelera caras únicas, revela metal y libera controles',()=>{
 const d=page(false),w=d.window;let callback;w.requestAnimationFrame=fn=>{callback=fn;return 1;};w.cancelAnimationFrame=()=>{};run(w);
 const body=w.document.body,overlay=w.document.querySelector('.intro-screen');
 assert.equal(overlay.hidden,false);assert.ok(w.document.querySelector('.navbar').inert);
 callback(0);const initial=body.dataset.introTypeface;callback(1200);assert.equal(body.dataset.introTypeface,initial);assert.ok(!body.classList.contains('intro-colored'));
 const faces=[initial];for(const ms of [1450,2200,2700,3000,3250]){callback(ms);faces.push(body.dataset.introTypeface);assert.equal(w.document.querySelector('.intro-word').textContent,'Infinitas');}
 assert.equal(new Set(faces).size,6);callback(3700);assert.ok(body.classList.contains('intro-colored'));callback(4200);assert.ok(body.classList.contains('intro-flight'));
 callback(5200);assert.equal(overlay.hidden,true);assert.ok(!w.document.querySelector('.navbar').inert);assert.ok(body.classList.contains('intro-done'));w.close();
});
test('ocultar pestaña durante entrada desbloquea la interfaz',()=>{
 const d=page(false),w=d.window;w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};run(w);
 Object.defineProperty(w.document,'hidden',{value:true,configurable:true});w.document.dispatchEvent(new w.Event('visibilitychange'));
 assert.equal(w.document.querySelector('.intro-screen').hidden,true);assert.ok(!w.document.querySelector('.navbar').inert);w.close();
});
test('trayectoria no usa tarjeta; scroll conserva fondo negro sin capa violeta ni bordes luminosos',()=>{
 const d=page(true),w=d.window;run(w);assert.equal(w.document.querySelector('.violet-field'),null);assert.equal(w.document.querySelector('.intro-edge'),null);
 assert.equal(w.document.querySelector('#experiencia').classList.contains('hero-form-card'),false);
 const before=w.document.body.style.cssText;w.dispatchEvent(new w.Event('scroll'));assert.equal(w.document.body.style.cssText,before);w.close();
});
