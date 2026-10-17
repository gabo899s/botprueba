const $ = (s) => document.querySelector(s);
const el = (tag, text) => {
  const n = document.createElement(tag);
  n.textContent = text;
  return n;
};
let me, citizen = null;
let state = { me:null,citizen:null,demo:true,sanctions:[],tickets:[] }, refreshTask, authRevision=0;
async function api(url, body, options = {}) {
  const method = options.method || (body !== undefined ? "POST" : "GET");
  const response = await fetch(url, { ...options, method,
    headers: { ...(body !== undefined ? { "Content-Type":"application/json" } : {}), ...(!["GET","HEAD"].includes(method.toUpperCase()) ? { "X-Local-Request":"1" } : {}), ...options.headers },
    ...(body !== undefined ? { body:JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) { const error=Error(data.message || "Solicitud fallida."); error.status=response.status; throw error; }
  return data;
}
function notice(text) {
  $("#notice").textContent = text;
  $("#notice").hidden = false;
}
function button(parent, label, handler) {
  const b = el("button", label);
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await handler();
      await refresh();
    } catch (e) {
      notice(e.message);
    } finally {
      b.disabled = false;
    }
  });
  parent.append(b);
}
function link(parent, url, text) {
  const a = el("a", text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  parent.append(a);
}
function picture(id, source) {
 const image=$(id); if(!image)return; image.src=source || "/images/avatar.svg";
 image.addEventListener("error",()=>{image.src="/images/avatar.svg";},{once:true});
}
function detail(parent,label,value) {
 const row=el("div", "");row.className="detail-line";row.append(el("span",label),el("strong",value || "—"));parent.append(row);
}
function empty(parent,text) { const n=el("p",text);n.className="empty-state";parent.append(n); }
function renderProfile(c, demo=false) {
 const name=c ? [c.nombre,c.apellidos].filter(Boolean).join(" ") : demo ? "Ciudadano de ejemplo" : me?.nombreCompleto || "Sin personaje registrado";
 $("#heroName").textContent=name;
 $("#heroHandle").textContent=c?.roblox?.username ? "@"+c.roblox.username : demo ? "Explora el sistema ciudadano de Maes RP" : "Tu vida en la ciudad, en un solo lugar.";
 $("#demoNotice").hidden=!demo;
 $("#profileMode").textContent=demo ? "Vista de ejemplo" : "Ciudadano";
 $("#sessionAvatar").hidden=demo; picture("#sessionAvatar",me?.discordAvatar); $("#citizenLogout").hidden=demo;
 $("#sessionLink").textContent=demo ? "Entrar con Discord ↗" : me?.discordUsername || "Mi cuenta";
 $("#sessionLink").href=demo ? "/auth/discord?returnTo=citizen" : "#personalPanel";
 $("#profile").replaceChildren();$("#identityFields").replaceChildren();$("#vehiclesLicenses").replaceChildren();
 const summary=el("div", "");summary.className="person-summary";
 const photo=el("img");photo.src=c?.roblox?.avatarUrl || me?.discordAvatar || "/images/avatar.svg";photo.alt="";photo.addEventListener("error",()=>{photo.src="/images/avatar.svg";},{once:true});
 const heading=el("div");heading.append(el("strong",name),el("small",c?.numeroCedula || "Sin cédula registrada"));summary.append(photo,heading);$("#profile").append(summary);
 const fields=[["Nacimiento",c?.fechaNacimiento],["Nacionalidad",c?.nacionalidad],["Sexo",c?.sexo],["Estatura",c?.estatura],["Provincia",c?.provincia],["Grupo sanguíneo",c?.grupoSanguineo]];
 for(const [label,value] of fields){detail($("#profile"),label,value);detail($("#identityFields"),label,value);}
 const identityImage=$("#identityImage");
 $("#identityImageView").hidden=!c || demo;
 $("#identityFallback").hidden=!!c && !demo;
 if(c && !demo){
   const url="/api/profile/identity.png?v="+encodeURIComponent(c.identityImageRevision || c.numeroCedula);
   if(identityImage.getAttribute("src")!==url){
     $("#identityImageStatus").textContent="Preparando imagen de tu cédula…";
     identityImage.hidden=false;
     identityImage.onload=()=>{if(identityImage.getAttribute("src")!==url)return;$("#identityFallback").hidden=true;$("#identityImageStatus").textContent="Documento de ficción · Sin validez legal";};
     identityImage.onerror=()=>{if(identityImage.getAttribute("src")!==url)return;identityImage.onload=null;identityImage.onerror=null;identityImage.removeAttribute("src");identityImage.hidden=true;$("#identityImageStatus").textContent="No se pudo cargar la imagen. Intenta actualizar el panel.";$("#identityFallback").hidden=false;};
     identityImage.src=url;
     $("#identityDownload").href=url;
   }
 }else{identityImage.onload=null;identityImage.onerror=null;identityImage.removeAttribute("src");$("#identityImageStatus").textContent="";}
 $("#idName").textContent=name;$("#idNumber").textContent=c?.numeroCedula || "—";
 const avatar=c?.roblox?.avatarUrl || me?.discordAvatar;
 for(const id of ["#heroAvatar","#idAvatar"])picture(id,avatar);
 picture("#discordAvatar",me?.discordAvatar);picture("#robloxAvatar",c?.roblox?.avatarUrl);
 $("#discordName").textContent=me?.discordUsername || me?.nombreCompleto || "Sin vincular";$("#discordId").textContent=me?.discordId || me?.id || "—";$("#discordStatus").textContent=me?.mode==='discord' || me?.discordId ? "Conectado" : "Sin conexión";
 $("#robloxName").textContent=c?.roblox?.username || "Sin vincular";$("#robloxStatus").textContent=c?.roblox?.username ? "Conectado" : "Sin conexión";
 if(c){$("#vehiclesLicenses").append(el("p","Vehículos: "+((c.vehiculos||[]).map(v=>v.placa+" · "+v.modelo).join(", ")||"sin registros")),el("p","Licencias: "+((c.licencias||[]).map(l=>l.tipo+" · "+l.estado).join(", ")||"sin registros")));}
 else empty($("#vehiclesLicenses"),demo?"Aquí verás los vehículos y licencias de tu personaje.":"No hay un personaje asociado a esta sesión. Registra tu cédula con el bot o pide al administrador que asocie tu ID Discord.");
}
function selectPanel(name) {
 const panel=document.querySelector('[data-view="'+name+'"]');if(!panel)return;
 document.querySelectorAll('[data-view]').forEach(n=>{n.hidden=n!==panel;});
 document.querySelectorAll('.tile').forEach(n=>{const active=n.dataset.panel===name;n.classList.toggle('active',active);if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
}
document.querySelectorAll('[data-panel]').forEach(n=>n.addEventListener('click',()=>selectPanel(n.dataset.panel)));
function publish(next) {
  state=next;
  document.dispatchEvent(new CustomEvent("citizen:updated",{detail:state,bubbles:true}));
}
function clearSession() {
  authRevision++;me=null;citizen=null;renderProfile(null,true);publish({me,citizen,demo:true,sanctions:[],tickets:[]});
}
async function load() {
  const revision=authRevision;
  $("#notice").hidden=true;
  const previousId=me?.discordId||me?.id;
  try { const result=await api("/api/auth/me");if(revision!==authRevision)return;me=result.user; }
  catch(error) {
    if(revision!==authRevision)return;clearSession();
    if(error.status!==401)notice("No se pudo consultar la sesión. Puedes recorrer la vista de ejemplo.");
    return;
  }
  if(previousId && previousId!==(me.discordId||me.id)){citizen=null;renderProfile(null);publish({me,citizen,demo:false,sanctions:[],tickets:[]});}
  try { const result=await api("/api/profile");if(revision!==authRevision)return;citizen=result.citizen; }
  catch(error){if(revision!==authRevision)return;if(error.status===401){clearSession();return;}citizen=null;renderProfile(null);publish({me,citizen,demo:false,sanctions:[],tickets:[],sanctionsError:error.message,ticketsError:error.message});throw error;}
  renderProfile(citizen);
  const results=await Promise.allSettled([api("/api/profile/sanctions"),api("/api/tickets?scope=mine")]);
  if(revision!==authRevision)return;
  if(results.some(r=>r.status==='rejected'&&r.reason.status===401)){clearSession();return;}
  const sanctions=results[0].status==='fulfilled'?results[0].value.sanctions||[]:[];
  const tickets=results[1].status==='fulfilled'?results[1].value.items||[]:[];
  publish({me,citizen,demo:false,sanctions,tickets,
    sanctionsError:results[0].status==='rejected'?results[0].reason.message:null,
    ticketsError:results[1].status==='rejected'?results[1].reason.message:null});
  if(results.some(r=>r.status==='rejected'))notice("Algunos registros no se pudieron cargar. Actualiza el panel para volver a intentarlo.");
}
function refresh() {
  if(!refreshTask)refreshTask=load().catch(error=>{notice(error.message);throw error;}).finally(()=>{refreshTask=null;});
  return refreshTask;
}
window.CitizenApp={api,notice,el,link,refresh,selectPanel,get me(){return me;},get citizen(){return citizen;},get state(){return state;}};
$("#citizenLogout").addEventListener('click',async event=>{
 const control=event.currentTarget;control.disabled=true;
 try{await api('/api/auth/logout',{});clearSession();}catch(error){notice(error.message);}finally{control.disabled=false;}
});
$("#refreshCitizen").addEventListener('click',async event=>{
 const control=event.currentTarget;control.disabled=true;control.textContent='Actualizando…';
 try{await refresh();}catch{}finally{control.disabled=false;control.textContent='Actualizar panel';}
});
function boot(){
 const query=new URLSearchParams(location.search),message=query.get('error')||query.get('message');
 refresh().then(()=>{if(message)notice(message);}).catch(()=>{});
 if(message)history.replaceState(null,'',location.pathname);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
