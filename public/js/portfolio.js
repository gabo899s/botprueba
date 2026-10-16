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

// One elapsed clock drives the intro and the reflections; no scroll background swap.
(() => {
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !window.requestAnimationFrame;
 const body=document.body,overlay=document.querySelector('.intro-screen'),word=document.querySelector('.intro-word'),target=document.querySelector('.hero .metal-word');
 const faces=[
  {at:0,family:'Noto Serif',style:'normal'},
  {at:1.7,family:'Open Sans',style:'normal'},
  {at:2.95,family:'AbrilFatface',style:'normal'},
  {at:3.95,family:'SpaceMono',style:'normal'},
  {at:4.75,family:'Lobster',style:'normal'},
  {at:5.4,family:'Space Grotesk',style:'normal'},
  {at:5.93,family:'CinzelDecorative',style:'normal'},
  {at:6.36,family:'ArchivoBlack',style:'normal'},
  {at:6.71,family:'Pacifico',style:'normal'},
  {at:6.99,family:'Anton',style:'normal'},
  {at:7.215,family:'FrederickatheGreat',style:'normal'},
  {at:7.395,family:'Righteous',style:'normal'},
  {at:7.54,family:'Aladin',style:'normal'},
  {at:7.655,family:'Monoton',style:'normal'},
  {at:7.745,family:'Bangers',style:'normal'},
  {at:7.82,family:'VT323',style:'normal'},
  {at:7.88,family:'PressStart2P',style:'normal'},
  {at:7.93,family:'BebasNeue',style:'normal'},
  {at:7.975,family:'Syncopate',style:'normal'},
  {at:8.015,family:'Poppins',style:'normal'},
  {at:8.05,family:'Averia Serif Libre',style:'italic'},
 ];
 const metalAt=faces.at(-1).at+.35, revealAt=metalAt+.35, flightAt=revealAt+.2, finishAt=flightAt+1.05;
 let mainMetal,introMetal,frame,started,lastFace=-1,flight=false,done=false,visible=true,disposed=false,typefaceAnimation;
 const hero=document.querySelector('.hero'),aura=document.querySelector('.ambient-aura');
 function fitAura(){aura.style.height=`${hero.offsetTop+hero.offsetHeight}px`;}
 fitAura();window.addEventListener('resize',fitAura);
 const protectedNodes=[...document.querySelectorAll('body > :not(.intro-screen):not(.ambient-aura):not(script)')];
 function finish(){
  if(done)return;done=true;overlay.hidden=true;introMetal?.destroy();introMetal=null;
  body.classList.remove('intro-active');body.classList.add('intro-done','intro-reveal','aura-loaded');
  protectedNodes.forEach(node=>{node.inert=false;});
 }
 function chooseFace(index){
  if(index===lastFace)return;lastFace=index;const face=faces[index];body.dataset.introTypeface=face.family;
  word.style.fontFamily=`"${face.family}", sans-serif`;word.style.fontStyle=face.style;
  // Preserve the perceived letter height, then constrain long/wide faces on mobile.
  const base=Math.min(100,Math.max(54,window.innerWidth*.08));word.style.fontSize=`${base}px`;
  if(document.fonts && window.MetalText){
   const probe=document.createElement('canvas').getContext('2d');if(!probe)return;probe.font=`${face.style} 400 ${base}px "${face.family}"`;
   const m=probe.measureText('Infinitas'),height=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;
   const size=Math.min(base*(base*.76/Math.max(1,height)),base*((window.innerWidth*.86)/Math.max(1,m.width)));
   word.style.fontSize=`${size}px`;
  }
  typefaceAnimation?.cancel();
  if(index>0)typefaceAnimation=word.animate?.([{opacity:.82},{opacity:1}],{duration:Math.min(150,((faces[index+1]?.at??(face.at+.3))-face.at)*650),easing:'ease-out'});
 }
 function tick(now){
  if(started===undefined)started=now;const t=(now-started)/1000;
  if(!done){
   let index=0;for(let i=1;i<faces.length;i++)if(t>=faces[i].at)index=i;chooseFace(index);
   if(t>=metalAt&&!introMetal){body.classList.add('intro-colored');word.classList.add('metal-word');introMetal=window.MetalText?.mount(word);}
   if(t>=revealAt)body.classList.add('aura-loaded');
   if(t>=flightAt&&!flight){
    flight=true;body.classList.add('intro-flight','intro-reveal');const r=target.getBoundingClientRect(),w=word.getBoundingClientRect();
    word.animate?.([{transform:'translate(0,0) scale(1)'},{transform:`translate(${r.left+r.width/2-(w.left+w.width/2)}px,${r.top+r.height/2-(w.top+w.height/2)}px) scale(${parseFloat(getComputedStyle(target).fontSize)/parseFloat(getComputedStyle(word).fontSize)})`}],{duration:1000,easing:'cubic-bezier(.22,.75,.2,1)',fill:'forwards'});
   }
   if(t>=finishAt)finish();
  }
  introMetal?.render(t);if(visible)mainMetal?.render(t);
  frame=requestAnimationFrame(tick);
 }
 if(reduced){finish();body.classList.add('aura-settled');}else{body.classList.add('intro-active');overlay.hidden=false;protectedNodes.forEach(node=>{node.inert=true;});chooseFace(0);}
 // Wait for local fonts so no fallback face flashes during the sequence.
 const fonts=document.fonts?Promise.all(faces.map(f=>document.fonts.load(`${f.style} 400 80px "${f.family}"`))):null;
 function start(){
  if(disposed)return;
  if(!done){lastFace=-1;chooseFace(0);}
  fitAura();mainMetal=window.MetalText?.mount(target);
  if(reduced){mainMetal?.render(1.2);return;}
  if(!document.hidden)frame=requestAnimationFrame(tick);
 }
 if(fonts)fonts.then(start,start);else start();
 const observer=window.IntersectionObserver?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}):null;observer?.observe(target);
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){finish();cancelAnimationFrame(frame);}else if(!reduced)frame=requestAnimationFrame(tick);
 });
 window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);finish();mainMetal?.destroy();observer?.disconnect();window.removeEventListener('resize',fitAura);},{once:true});
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
