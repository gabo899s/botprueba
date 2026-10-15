const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
function page(reduced){const d=new JSDOM(fs.readFileSync(path.join(root,'public/index.html'),'utf8'),{url:'http://localhost:3000',runScripts:'outside-only'}),w=d.window;w.matchMedia=()=>({matches:reduced});w.document.querySelector('.trajectory').getBoundingClientRect=()=>({top:1000});return d;}
test('movimiento reducido omite entrada y deja contenido y aura estática disponibles',()=>{
 const d=page(true),w=d.window;w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));
 assert.equal(w.document.querySelector('.intro-screen').hidden,true);assert.ok(w.document.body.classList.contains('aura-settled'));assert.equal(w.document.querySelector('.products-menu a').getAttribute('href'),'/maes-rp');assert.ok(!w.document.querySelector('.navbar').inert);w.close();
});
test('entrada pasa de blanco a color, desplaza palabra y libera controles; mesh permanece animado',()=>{
 const d=page(false),w=d.window;let callback;w.requestAnimationFrame=fn=>{callback=fn;return 1;};w.cancelAnimationFrame=()=>{};
 w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));const body=w.document.body,overlay=w.document.querySelector('.intro-screen');
 assert.equal(w.document.querySelector('.intro-word').textContent,'Infinitas');assert.equal(overlay.hidden,false);assert.ok(w.document.querySelector('.navbar').inert);callback(0);const initial=w.document.querySelector('.ambient-aura').style.backgroundImage;
 assert.ok(!body.classList.contains('intro-colored'));callback(1000);assert.ok(body.classList.contains('intro-colored'));callback(2000);assert.ok(body.classList.contains('intro-dim'));callback(2800);assert.ok(body.classList.contains('intro-flight'));assert.equal(w.document.querySelector('.intro-word').textContent,'Infinitas');
 callback(3800);assert.equal(overlay.hidden,true);assert.ok(!w.document.querySelector('.navbar').inert);assert.ok(body.classList.contains('intro-done'));callback(14000);assert.ok(!body.classList.contains('aura-settled'));assert.notEqual(initial,w.document.querySelector('.ambient-aura').style.backgroundImage);w.close();
});

test('violeta aparece únicamente al bajar a Trayectoria y desaparece al regresar arriba',()=>{
 const d=page(true),w=d.window;w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));
 assert.equal(w.document.body.style.getPropertyValue('--violet-mix'),'0');
 w.document.querySelector('.trajectory').getBoundingClientRect=()=>({top:0});w.dispatchEvent(new w.Event('scroll'));assert.equal(w.document.body.style.getPropertyValue('--violet-mix'),'1');
 assert.match(w.document.querySelector('.violet-field').style.backgroundImage,/109,\s*74,\s*255/);
 w.document.querySelector('.trajectory').getBoundingClientRect=()=>({top:1000});w.dispatchEvent(new w.Event('scroll'));assert.equal(w.document.body.style.getPropertyValue('--violet-mix'),'0');w.close();
});
