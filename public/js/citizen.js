const $ = (s) => document.querySelector(s);
const el = (tag, text) => {
  const n = document.createElement(tag);
  n.textContent = text;
  return n;
};
let me;
async function api(url, body) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Local-Request": "1",
          },
          body: JSON.stringify(body),
        }
      : {},
  );
  const d = await r.json();
  if (!r.ok) { const error = Error(d.message || "Solicitud fallida."); error.status = r.status; throw error; }
  return d;
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
 const image=$(id); image.src=source || "/images/avatar.svg";
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
 $("#profile").replaceChildren();$("#identityFields").replaceChildren();$("#vehiclesLicenses").replaceChildren();
 const summary=el("div", "");summary.className="person-summary";
 const photo=el("img");photo.src=c?.roblox?.avatarUrl || me?.discordAvatar || "/images/avatar.svg";photo.alt="";photo.addEventListener("error",()=>{photo.src="/images/avatar.svg";},{once:true});
 const heading=el("div");heading.append(el("strong",name),el("small",c?.numeroCedula || "Sin cédula registrada"));summary.append(photo,heading);$("#profile").append(summary);
 const fields=[["Nacimiento",c?.fechaNacimiento],["Nacionalidad",c?.nacionalidad],["Sexo",c?.sexo],["Estatura",c?.estatura],["Provincia",c?.provincia],["Grupo sanguíneo",c?.grupoSanguineo]];
 for(const [label,value] of fields){detail($("#profile"),label,value);detail($("#identityFields"),label,value);}
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
 document.querySelectorAll('.tile[data-panel]').forEach(n=>{const active=n.dataset.panel===name;n.classList.toggle('active',active);if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');});
}
document.querySelectorAll('[data-panel]').forEach(n=>n.addEventListener('click',()=>selectPanel(n.dataset.panel)));
async function refresh() {
  try { me = (await api("/api/auth/me")).user; }
  catch(error) {
    me=null;renderProfile(null,true);
    for(const id of ["#records","#sanctions","#tickets"]){$(id).replaceChildren();empty($(id),"No hay registros para mostrar en esta vista de ejemplo.");}
    if(error.status!==401)notice("No se pudo consultar la sesión. Puedes recorrer la vista de ejemplo.");
    return;
  }
  $("#sessionLink").textContent=me.nombreCompleto || "Mi cuenta";
  const { citizen: c } = await api("/api/profile");
  renderProfile(c);
  $("#records").replaceChildren();
  if(c) for (const r of [...(c.multas||[]), ...(c.arrestos||[])]) {
    const row = el("div", "");row.className = "record";
    row.append(el("strong", r.estado + " · " + r.articulos));
    link(row, r.pdfUrl, "Abrir PDF");
    if (r.imagenUrl) link(row, r.imagenUrl, "Ver evidencia");
    if (r.monto !== undefined && r.estado !== "PAGADA" && !r.paymentRequested)
      button(row, "Solicitar validación de pago", async () => {
        await api("/api/profile/payments", { id: r.id });
        notice("Solicitud de pago enviada. Aún no se marcó como pagada.");
      });
    $("#records").append(row);
  }
  if(!$("#records").children.length)empty($("#records"),"No tienes multas ni arrestos registrados.");
  const s = await api("/api/profile/sanctions");
  $("#sanctions").replaceChildren();
  for (const r of s.sanctions) {
    const row = el("div", "");
    row.className = "record";
    row.append(el("p", r.motivo + " · " + r.estado));
    if (r.appeal) row.append(el("p", "Apelación: " + r.appeal.status));
    else
      button(row, "Apelar", async () => {
        const reason = prompt("Motivo de la apelación");
        if (reason)
          await api(
            "/api/staff/sanctions/" +
              (me.discordId || me.id) +
              "/" +
              r.id +
              "/appeal",
            { reason },
          );
      });
    $("#sanctions").append(row);
  }
  if(!$("#sanctions").children.length)empty($("#sanctions"),"No tienes sanciones registradas.");
  const tickets = await api("/api/tickets");
  $("#tickets").replaceChildren();
  for (const t of tickets.items) {
    const row = el("div", t.topic + " · " + t.status);
    row.className = "record";
    if (t.transcriptFile)
      link(
        row,
        "/api/tickets/" + t.id + "/transcript",
        "Descargar transcripción",
      );
    $("#tickets").append(row);
  }
  if(!$("#tickets").children.length)empty($("#tickets"),"No tienes tickets registrados.");
}
refresh().catch((e) => notice(e.message));
