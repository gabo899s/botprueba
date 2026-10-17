const $ = (s) => document.querySelector(s);
let staff = [],
  selected = null,
  editing = null;
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function notice(message, error = false) {
  $("#notice").textContent = message;
  $("#notice").className = "notice" + (error ? " error" : "");
  $("#notice").hidden = false;
}
async function api(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { "X-Local-Request": "1", ...options.headers },
  });
  const d = await r.json();
  if (!r.ok) {
    const e = Error(d.message || "Solicitud fallida.");
    e.status = r.status;
    throw e;
  }
  return d;
}
function send(url, data, method = "POST") {
  return api(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
function tab(name) {
  document
    .querySelectorAll("[data-view]")
    .forEach((n) => (n.hidden = n.dataset.view !== name));
  document
    .querySelectorAll("[data-tab]")
    .forEach((n) => n.classList.toggle("active", n.dataset.tab === name));
  $("#metricsPanel").hidden = name !== "consult" || !selected;
}
function list(values) {
  const target = $("#staffList");
  target.replaceChildren();
  for (const s of values) {
    const b = el(
      "button",
      s.nombre + " · " + (s.placa || s.discordId) + " · " + s.estado,
      "staff-result",
    );
    b.type = "button";
    b.addEventListener("click", () =>
      load(s.discordId).catch((e) => notice(e.message, true)),
    );
    target.append(b);
  }
  if (!values.length)
    target.append(
      el("p", "No hay resultados. Registra un miembro para empezar.", "empty"),
    );
}
async function refresh() {
  const [d, m] = await Promise.all([
    api("/api/admin/staff"),
    api("/api/admin/summary"),
  ]);
  staff = d.staff;
  list(staff);
  $("#totalStaff").textContent = m.total;
  $("#activeStaff").textContent = m.activos;
  $("#hoursStaff").textContent = m.horas.toFixed(2);
}
function scalarRows(target, value) {
  if (value === null || value === undefined) {
    target.append(el("p", "Sin registros.", "muted"));
    return;
  }
  if (typeof value !== "object") {
    target.append(el("p", String(value)));
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    if (v === null || typeof v === "object") continue;
    const row = el("p", k + ": " + String(v), "muted");
    target.append(row);
  }
}
async function load(id) {
  const { data: s } = await api("/api/admin/staff/" + encodeURIComponent(id));
  selected = s;
  const target = $("#staffDetail");
  target.replaceChildren(
    el("h3", s.nombre),
    el(
      "p",
      `Discord: ${s.discordId} · ${s.discordUsername || "sin nombre de usuario"}`,
    ),
    el(
      "p",
      `Placa: ${s.placa || "N/A"} · Cargo: ${s.rango || "N/A"} · ${s.estado}`,
    ),
  );
  const edit = el("button", "Editar staff", "secondary");
  edit.type = "button";
  edit.addEventListener("click", () => {
    editing = s.discordId;
    const f = $("#staffForm");
    for (const [k, v] of Object.entries(s))
      if (f.elements[k]) f.elements[k].value = v || "";
    f.elements.discordId.readOnly = true;
    $("#formTitle").textContent = "Editar staff";
    $("#cancelEdit").hidden = false;
    tab("register");
  });
  target.append(edit);
  target.append(el("h3", "Actividad", "spaced"));
  scalarRows(target, s.actividad);
  target.append(el("h3", "Tickets", "spaced"));
  scalarRows(target, s.tickets);
  target.append(el("h3", "Evaluaciones", "spaced"));
  if (Array.isArray(s.calificaciones) && s.calificaciones.length) {
    for (const r of s.calificaciones) {
      const row = el("div", undefined, "detail-row");
      row.append(
        el("strong", "Nota: " + r.nota + "/5"),
        el("p", r.comentario || "Sin comentario"),
        el("small", r.fecha || ""),
      );
      target.append(row);
    }
  } else scalarRows(target, s.calificaciones);
  target.append(el("h3", "Sanciones aplicadas", "spaced"));
  if (!s.sancionesHechas.length)
    target.append(el("p", "Sin registros.", "muted"));
  for (const r of s.sancionesHechas) {
    const row = el("div", undefined, "detail-row");
    row.append(
      el("strong", r.tipo || r.type || "Sanción"),
      el("p", r.motivo || r.reason || ""),
      el(
        "small",
        "Usuario: " +
          (r.usuarioId || r.userId || "N/A") +
          " · " +
          (r.fecha || ""),
      ),
    );
    target.append(row);
  }
  $("#metricsTitle").textContent = "Registrar información · " + s.nombre;
  $("#activityForm").elements.horas.value = s.actividad?.horas ?? "";
  $("#ticketForm").elements.atendidos.value = s.tickets?.atendidos ?? "";
  $("#ticketForm").elements.cerrados.value = s.tickets?.cerrados ?? "";
  $("#metricsPanel").hidden = false;
  tab("consult");
}
function bind(selector, handler) {
  $(selector).addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = e.target.querySelector("button");
    b.disabled = true;
    try {
      await handler(e.target);
    } catch (err) {
      notice(err.message, true);
      if (err.status === 401) {
        $("#workspace").hidden = true;
        $("#loginSection").hidden = false;
      }
    } finally {
      b.disabled = false;
    }
  });
}
bind("#staffForm", async (f) => {
  const d = Object.fromEntries(new FormData(f));
  await send(
    editing
      ? "/api/admin/staff/" + encodeURIComponent(editing)
      : "/api/admin/staff",
    d,
    editing ? "PUT" : "POST",
  );
  resetEdit();
  await refresh();
  await load(d.discordId);
  notice("Staff guardado.");
});
bind("#searchForm", async () => {
  const d = await api(
    "/api/admin/search?q=" + encodeURIComponent($("#query").value),
  );
  list(d.results);
  if (d.results.length === 1) await load(d.results[0].discordId);
});
for (const [form, tipo] of [
  ["#activityForm", "actividad"],
  ["#ticketForm", "tickets"],
  ["#ratingForm", "calificacion"],
  ["#sanctionForm", "sancion"],
])
  bind(form, async (f) => {
    if (!selected) throw Error("Selecciona un miembro del staff.");
    const id = selected.discordId;
    await send("/api/admin/staff/" + encodeURIComponent(id) + "/metrics", {
      ...Object.fromEntries(new FormData(f)),
      tipo,
    });
    f.reset();
    await refresh();
    await load(id);
    notice("Información guardada.");
  });
function resetEdit() {
  editing = null;
  $("#staffForm").reset();
  $("#staffForm").elements.discordId.readOnly = false;
  $("#formTitle").textContent = "Registrar staff";
  $("#cancelEdit").hidden = true;
}
$("#cancelEdit").addEventListener("click", resetEdit);
$("#showAll").addEventListener("click", () => list(staff));
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => b.addEventListener("click", () => tab(b.dataset.tab)));
async function logout() {
  try {
    await send("/api/auth/logout", {});
    location.href = "/admin";
  } catch (e) {
    notice(e.message, true);
  }
}
$("#logout").addEventListener("click", logout);
$("#switchLocal").addEventListener("click", logout);
async function initialize() {
  let config = {};
  try {
    config = await api("/api/config");
  } catch {}
  $("#adminDiscord").hidden = !config.adminOAuth;
  $("#adminDiscordHint").hidden = !!config.adminOAuth;
  $("#switchAdmin").hidden = !config.adminOAuth;
  try {
    const { user } = await api("/api/admin/auth/me");
    $("#who").textContent = user.nombreCompleto;
    $("#loginSection").hidden = true;
    $("#denied").hidden = true;
    $("#workspace").hidden = false;
    $("#logout").hidden = false;
    await refresh();
  } catch (e) {
    $("#workspace").hidden = true;
    if (e.status === 401) $("#loginSection").hidden = false;
    else if (e.status === 403) {
      $("#denied").hidden = false;
      $("#logout").hidden = false;
    } else notice(e.message, true);
  }
}
initialize()
  .then(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("error")) notice(q.get("error"), true);
  })
  .catch((e) => notice(e.message, true));
