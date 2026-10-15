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

// Tras la carga, el movimiento desacelera y conserva su posición: no hay salto visual.
(() => {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const layers = [...document.querySelectorAll('.aura-layer')];
  let settleTimer;
  function settle() {
    const animations = layers.flatMap(layer => layer.getAnimations?.() || []);
    if (!animations.length) { document.body.classList.add('aura-settled'); return; }
    const started = performance.now();
    function slowDown(now) {
      const progress = Math.min(1, (now - started) / 1800);
      for (const animation of animations) animation.updatePlaybackRate?.((1-progress)**2);
      if (progress < 1) requestAnimationFrame(slowDown);
      else { for (const animation of animations) animation.pause(); document.body.classList.add('aura-settled'); }
    }
    requestAnimationFrame(slowDown);
  }
  function loaded() { document.body.classList.add('aura-loaded'); settleTimer = setTimeout(settle, Math.max(0, 10500 - performance.now())); }
  if (reducedMotion?.matches) document.body.classList.add('aura-settled');
  else if (document.readyState === 'complete') loaded();
  else window.addEventListener('load', loaded, { once: true });
  window.addEventListener('pagehide', () => clearTimeout(settleTimer), { once: true });
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
