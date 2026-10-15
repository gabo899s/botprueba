const dialog = document.querySelector('#wizard-dialog');
const body = document.querySelector('#wizard-step-content');
const title = document.querySelector('#wizard-title');
const next = document.querySelector('#btn-next');
const back = document.querySelector('#btn-back');
const categories = {
  Personalizado: ['Comandos Personalizados', 'Integración API', 'Base de Datos', 'Logs Avanzados'],
  Rol: ['Sistema de aperturas', 'Sistema policial (Multas/Arrestos)', 'Sistema de Economía', 'Sistema de Sanciones', 'Cédulas y Licencias'],
  Economia: ['Sistema de Collect', 'Role-Income', 'Sistema de Banco', 'Comandos de Casino'],
  Multifuncional: ['Tickets', 'Moderación (Warns/Bans)', 'Antiraid Base', 'Encuestas', 'Sorteos'],
  Antiraid: ['Baneo de bots no verificados', 'Sistema de autoroles', 'Vigilancia 24/7', 'Castigos Personalizados'],
};
const labels = { Personalizado:'Bot Personalizado', Rol:'Servidor de Rol (GTA/ER:LC)', Economia:'Bot de Economía', Multifuncional:'Multifuncional', Antiraid:'AntiRaid Pro' };
let step = 0, order = {}, returnFocus;
function element(tag, text, cls) { const n = document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; }
function openWizard(type) {
  returnFocus = document.activeElement;
  order = { type, category: '', features: [], notes: '' };
  step = 0; render(); dialog.showModal();
}
function render() {
  body.replaceChildren();
  const bot = order.type === 'bots';
  const notesStep = bot ? 2 : 0, confirmStep = bot ? 3 : 1;
  next.hidden = bot && step === 0;
  back.hidden = bot && step === 0;
  next.textContent = step === confirmStep ? 'Ir a Discord' : step === notesStep ? 'Finalizar' : 'Siguiente';
  document.querySelector('#wizard-progress-bar').style.width = `${((step+1)/(bot?4:2))*100}%`;
  if(bot && step===0) {
    title.textContent='Categoría del Bot';
    const grid=element('div',undefined,'wizard-grid');
    for(const [key,label] of Object.entries(labels)) {
      const button=element('button',label,'select-card');button.type='button';
      button.addEventListener('click',()=>{if(order.category!==key)order.features=[];order.category=key;step=1;render();});grid.append(button);
    }
    body.append(grid);
  } else if(bot && step===1) {
    title.textContent='Funciones Deseadas';
    const list=element('div',undefined,'clean-list');
    for(const feature of categories[order.category]) {
      const label=element('label',undefined,'clean-check-item'), input=element('input');input.type='checkbox';input.checked=order.features.includes(feature);
      input.addEventListener('change',()=>{order.features=input.checked?[...order.features,feature]:order.features.filter(f=>f!==feature);});
      label.append(input,element('span',feature));list.append(label);
    }
    body.append(list);
  } else if(step===notesStep) {
    title.textContent='Detalles Adicionales';
    const label=element('label','Describe tu idea o requerimientos especiales:');label.htmlFor='order-notes';
    const notes=element('textarea',undefined,'styled-textarea');notes.id='order-notes';notes.placeholder='Escribe aquí tus ideas, dudas o detalles específicos…';notes.value=order.notes;notes.maxLength=5000;
    notes.addEventListener('input',()=>{order.notes=notes.value;});body.append(label,notes);
  } else {
    title.textContent='Tu solicitud está preparada';
    const name=order.type==='bots'?labels[order.category]:order.type==='web'?'Página Web Profesional':'Sistema Personalizado';
    body.append(element('h4',name),element('div',[...order.features,order.notes].filter(Boolean).join('\n')||'Sin detalles adicionales.','confirm-details'),element('p','Continúa en Discord para compartir tu solicitud con el desarrollador.'));
  }
}
next.addEventListener('click',()=>{if(step===(order.type==='bots'?3:1))window.open('https://discord.gg/mv2tVKKmqV','_blank','noopener,noreferrer');else{step++;render();}});
back.addEventListener('click',()=>{if(step===0)dialog.close();else{step--;render();}});
document.querySelector('[data-wizard-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>returnFocus?.focus());
for(const button of document.querySelectorAll('[data-service]'))button.addEventListener('click',()=>openWizard(button.dataset.service));
const menu=document.querySelector('.products-menu');
document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.open=false;});
document.addEventListener('keydown',e=>{if(e.key==='Escape')menu.open=false;});
function count(section) {
 for(const counter of section.querySelectorAll('.counter')){
  if(counter.dataset.counted)return;counter.dataset.counted='true';
  const target=Number(counter.dataset.target);const start=performance.now();
  function update(now){const progress=Math.min(1,(now-start)/2500);counter.textContent=Math.round(target*progress);if(progress<1)requestAnimationFrame(update);}
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)counter.textContent=target;else requestAnimationFrame(update);
 }
}
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){count(entry.target);observer.unobserve(entry.target);}},{threshold:.1});document.querySelectorAll('.stats-grid').forEach(n=>observer.observe(n));}
else document.querySelectorAll('.counter').forEach(n=>{n.textContent=n.dataset.target;});

// Entrada y mesh determinista: las fases permanecen constantes, el reloj es continuo.
(() => {
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !window.requestAnimationFrame;
 const body=document.body,overlay=document.querySelector('.intro-screen'),word=document.querySelector('.intro-word'),target=document.querySelector('.gradient-text'),aura=document.querySelector('.ambient-aura'),violet=document.querySelector('.violet-field'),trajectory=document.querySelector('.trajectory');
 const blobs=[{x:38,y:40,c:'28,91,230',a:.65,p:.7},{x:64,y:49,c:'59,195,244',a:.55,p:2.1},{x:44,y:65,c:'31,173,157',a:.5,p:4.2},{x:70,y:30,c:'60,135,235',a:.4,p:5.3}];
 const violetBlobs=[{x:56.18,y:53.14,c:'20,11,46',r:76.1,p:.37},{x:40.93,y:70.24,c:'20,11,46',r:70.85,p:1.19},{x:58,y:14.42,c:'109,74,255',r:51.6,p:2.73},{x:65,y:81.01,c:'60,2,164',r:53.35,p:3.41},{x:16.23,y:47.68,c:'109,74,255',r:49.85,p:4.62},{x:94,y:31.96,c:'196,160,255',r:46.35,p:5.8}];
 function mesh(t){const ph=t*.65,amt=1.2;aura.style.backgroundImage=blobs.map(b=>{const x=b.x+(Math.sin(ph*.55+b.p)-Math.sin(b.p))*14*amt,y=b.y+(Math.sin(ph*.43+b.p+1.7)-Math.sin(b.p+1.7))*14*amt;return `radial-gradient(ellipse at ${x}% ${y}%,rgba(${b.c},${b.a}) 0%,rgba(${b.c},0) 48%)`;}).join(',');
  const vph=t*.20;violet.style.backgroundImage=violetBlobs.map(b=>{const x=b.x+(Math.sin(vph*.55+b.p)-Math.sin(b.p))*14*.25,y=b.y+(Math.sin(vph*.43+b.p+1.7)-Math.sin(b.p+1.7))*14*.25;return `radial-gradient(circle at ${x}% ${y}%,rgba(${b.c},1) 0%,rgba(${b.c},.844) ${b.r*.25}%,rgba(${b.c},.5) ${b.r*.5}%,rgba(${b.c},.156) ${b.r*.75}%,rgba(${b.c},0) ${b.r}%)`;}).join(',');
 }
 let desiredMix=0,mix=0;
 function scrollMix(){const h=window.innerHeight||800;desiredMix=Math.max(0,Math.min(1,(h*.65-trajectory.getBoundingClientRect().top)/(h*.5)));if(reduced)applyMix(desiredMix);}
 function applyMix(value){body.style.setProperty('--violet-mix',String(value));body.style.setProperty('--transition-bloom',String(Math.sin(value*Math.PI)*.22));}
 window.addEventListener('scroll',scrollMix,{passive:true});window.addEventListener('resize',scrollMix);scrollMix();mesh(0);
 if(reduced){body.classList.add('aura-loaded','aura-settled','intro-done');return;}
 body.classList.add('intro-active');overlay.hidden=false;
 const protectedNodes=[...document.querySelectorAll('body > :not(.intro-screen):not(.ambient-aura):not(.violet-field):not(script)')];
 protectedNodes.forEach(node=>{node.inert=true;});
 let frame,started,lastTime,hiddenAt,flight=false,done=false;
 function finish(){if(done)return;done=true;overlay.hidden=true;body.classList.remove('intro-active');body.classList.add('intro-done','intro-reveal','aura-loaded');protectedNodes.forEach(node=>{node.inert=false;});}
 function tick(now){if(started===undefined)started=now;const t=(now-started)/1000,dt=lastTime===undefined?0:Math.min(.1,(now-lastTime)/1000);lastTime=now;
  mix+=(desiredMix-mix)*(1-Math.exp(-dt/0.25));if(Math.abs(desiredMix-mix)<.0001)mix=desiredMix;applyMix(mix);mesh(Math.max(0,t-2.5));
  if(t>=.22)body.classList.add('intro-white-glow');
  if(t>=.95)body.classList.add('intro-colored');
  if(t>=1.85)body.classList.add('intro-dim');
  if(t>=2.45)body.classList.add('aura-loaded');
  if(t>=2.65&&!flight){flight=true;body.classList.add('intro-flight','intro-reveal');word.textContent='Infinitas';const r=target.getBoundingClientRect(),w=word.getBoundingClientRect();word.animate?.([{transform:'translate(0,0) scale(1)'},{transform:`translate(${r.left+r.width/2-(w.left+w.width/2)}px,${r.top+r.height/2-(w.top+w.height/2)}px) scale(${parseFloat(getComputedStyle(target).fontSize)/parseFloat(getComputedStyle(word).fontSize)})`}],{duration:950,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'});}
  if(t>=3.65)finish();
  frame=requestAnimationFrame(tick);
 }
 // Ocultar la pestaña termina la entrada y libera los controles.
 function visibility(){if(document.hidden){hiddenAt=performance.now();finish();cancelAnimationFrame(frame);}else{if(started!==undefined&&hiddenAt!==undefined)started+=performance.now()-hiddenAt;lastTime=undefined;frame=requestAnimationFrame(tick);}}
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);finish();},{once:true});
 frame=requestAnimationFrame(tick);
})();

// La navegación móvil comparte los mismos enlaces y conserva el foco al cerrar.
(() => {
 const navbar=document.querySelector('.navbar'),toggle=document.querySelector('.nav-toggle');
 if(!toggle)return;
 function closeMenu(restoreFocus=false){navbar.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menú');toggle.firstElementChild.textContent='☰';if(restoreFocus)toggle.focus();}
 toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';navbar.classList.toggle('menu-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');toggle.firstElementChild.textContent=open?'×':'☰';});
 navbar.querySelectorAll('.nav-links a').forEach(link=>link.addEventListener('click',()=>closeMenu()));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')closeMenu(true);});
 document.addEventListener('click',event=>{if(!navbar.contains(event.target))closeMenu();});
})();
