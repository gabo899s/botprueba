const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
test('aura decorativa respeta movimiento reducido y mantiene disponible el menú de productos',()=>{
 const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');const d=new JSDOM(html,{url:'http://localhost:3000',runScripts:'outside-only'}),w=d.window;
 w.matchMedia=()=>({matches:true});w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));
 assert.equal(w.document.querySelector('.ambient-aura').getAttribute('aria-hidden'),'true');
 assert.equal(w.document.querySelectorAll('.aura-layer').length,3);assert.ok(w.document.body.classList.contains('aura-settled'));assert.equal(w.document.querySelector('.products-menu a').getAttribute('href'),'/maes-rp');d.window.close();
});
test('aura se detiene tras cargar sin eliminar sus capas ni recrear la página',()=>{
 const d=new JSDOM(fs.readFileSync(path.join(root,'public/index.html'),'utf8'),{url:'http://localhost:3000',runScripts:'outside-only'}),w=d.window;
 const pending=[];let paused=0;w.matchMedia=()=>({matches:false});w.setTimeout=fn=>{pending.push(fn);return pending.length;};w.requestAnimationFrame=fn=>{fn(w.performance.now()+5000);return 1;};
 for(const layer of w.document.querySelectorAll('.aura-layer'))layer.getAnimations=()=>[{updatePlaybackRate:()=>{},pause:()=>{paused++;}}];
 w.eval(fs.readFileSync(path.join(root,'public/js/portfolio.js'),'utf8'));w.dispatchEvent(new w.Event('load'));pending.shift()();
 assert.equal(paused,3);assert.ok(w.document.body.classList.contains('aura-settled'));assert.equal(w.document.querySelectorAll('.aura-layer').length,3);d.window.close();
});
