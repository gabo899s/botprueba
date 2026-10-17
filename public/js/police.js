const $ = (s) => document.querySelector(s);
let citizens = [],
  editing = null,
  searchTimer;
let suggestionSeq = 0;
function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function notice(text, error = false) {
  $("#notice").replaceChildren();
  $("#notice").textContent = text;
  $("#notice").hidden = false;
  $("#notice").className = "notice" + (error ? " error" : "");
}
async function api(url, options = {}) {
  options.headers = { "X-Local-Request": "1", ...options.headers };
  const r = await fetch(url, options);
  const data = await r.json();
  if (r.status === 401) {
    location.href = "/";
    throw Error("Sesión expirada.");
  }
  if (!r.ok) throw Error(data.message || "Solicitud fallida.");
  return data;
}
function jsonPost(url, data, method = "POST") {
  return api(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
function tab(name) {
  document
    .querySelectorAll("[data-view]")
    .forEach((v) => (v.hidden = v.dataset.view !== name));
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
}
function link(url, label) {
  const a = el("a", label);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}
function record(r) {
  const d = el("div", undefined, "record");
  d.append(
    el(
      "strong",
      r.ciudadano +
        " · " +
        (r.monto !== undefined
          ? "Multa $" + r.monto.toFixed(2)
          : "Arresto " + r.tiempo + " años"),
    ),
    el("p", r.articulos),
    el("p", r.fecha + " · Oficial: " + r.oficialNombre, "muted"),
    link(r.pdfUrl, "Abrir PDF"),
  );
  if (r.imagenUrl) d.append(link(r.imagenUrl, "Ver evidencia"));
  return d;
}
async function refresh() {
  const [c, r] = await Promise.all([api("/api/citizens"), api("/api/records")]);
  citizens = c.citizens;
  $("#citizenCount").textContent = citizens.length;
  $("#fineCount").textContent = r.multas.length;
  $("#arrestCount").textContent = r.arrestos.length;
  document.querySelectorAll(".citizenSelect").forEach((s) => {
    const selected = s.value;
    s.replaceChildren(new Option("Selecciona un ciudadano", ""));
    citizens.forEach((c) =>
      s.add(
        new Option(
          c.nombre + " " + c.apellidos + " · " + c.numeroCedula,
          c.numeroCedula,
        ),
      ),
    );
    s.value = selected;
  });
  $("#citizenList").replaceChildren();
  for (const c of citizens) {
    const row = el("div", undefined, "record");
    row.append(el("p", c.nombre + " " + c.apellidos + " · " + c.numeroCedula));
    const edit = el("button", "Editar", "secondary");
    edit.type = "button";
    edit.addEventListener("click", () => {
      editing = c.numeroCedula;
      const f = $("#citizenForm");
      for (const [k, v] of Object.entries({
        ...c,
        robloxUsername: c.roblox?.username || "",
      }))
        if (f.elements[k]) f.elements[k].value = v || "";
      f.elements.numeroCedula.readOnly = true;
      $("#citizenTitle").textContent = "Editar ciudadano";
      $("#cancelEdit").hidden = false;
      tab("citizens");
    });
    row.append(edit);
    $("#citizenList").append(row);
  }
  if (!citizens.length)
    $("#citizenList").append(
      el("p", "Aún no hay ciudadanos. Registra el primero.", "empty"),
    );
  $("#history").replaceChildren();
  [...r.multas, ...r.arrestos]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((v) => $("#history").append(record(v)));
  if (!r.multas.length && !r.arrestos.length)
    $("#history").append(el("p", "Aún no hay registros.", "empty"));
}
async function bot() {
  const b = await api("/api/bot/status");
  $("#botStatus").replaceChildren(
    el(
      "p",
      b.bot?.online
        ? "Conectado: " + b.bot.tag
        : b.configured
          ? "Bot desconectado. Revisa la terminal."
          : "Bot sin configurar.",
    ),
    el(
      "p",
      `Pendientes: ${b.queue.notifications} · Procesadas: ${b.queue.processed} · Errores: ${b.queue.errors}`,
    ),
    el(
      "p",
      `Canal de multas: ${b.channels.multa ? "configurado" : "pendiente"} · Canal de arrestos: ${b.channels.arresto ? "configurado" : "pendiente"}`,
    ),
  );
}
function bind(form, handler) {
  $(form).addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = e.target.querySelector("button");
    b.disabled = true;
    try {
      await handler(e.target);
    } catch (err) {
      notice(err.message, true);
    } finally {
      b.disabled = false;
    }
  });
}
bind("#searchForm", async (f) => {
  const { data: c } = await api(
    "/api/search?q=" + encodeURIComponent($("#query").value),
  );
  const target = $("#citizenResult");
  target.replaceChildren(
    el("h3", c.nombre + " " + c.apellidos),
    el(
      "p",
      `Cédula: ${c.numeroCedula} · Discord: ${c.discordId || "sin vincular"} · Roblox: ${c.roblox?.username || "sin vincular"}`,
    ),
    el(
      "p",
      "Vehículos: " +
        (c.vehiculos.map((v) => v.placa + " (" + v.modelo + ")").join(", ") ||
          "sin registros"),
    ),
    el(
      "p",
      "Licencias: " +
        (c.licencias.map((v) => v.tipo + " — " + v.estado).join(", ") ||
          "sin registros"),
    ),
  );
  [...c.multas, ...c.arrestos].forEach((r) => target.append(record(r)));
});
$("#query").addEventListener("input", () => {
  clearTimeout(searchTimer);
  const seq = ++suggestionSeq;
  searchTimer = setTimeout(async () => {
    try {
      const s = await api(
        "/api/search/suggestions?q=" + encodeURIComponent($("#query").value),
      );
      if (seq !== suggestionSeq) return;
      $("#suggestions").replaceChildren();
      s.suggestions.forEach((c) => {
        const b = el(
          "button",
          c.nombre + " " + c.apellidos + " · " + c.numeroCedula,
          "secondary",
        );
        b.type = "button";
        b.addEventListener("click", () => {
          $("#query").value = c.numeroCedula;
          $("#suggestions").replaceChildren();
          $("#searchForm").requestSubmit();
        });
        $("#suggestions").append(b);
      });
    } catch (e) {
      notice(e.message, true);
    }
  }, 250);
});
for (const [selector, url, multipart] of [
  ["#fineForm", "/api/multa", false],
  ["#arrestForm", "/api/arresto", true],
])
  bind(selector, async (f) => {
    const fd = new FormData(f);
    if (multipart && fd.get("foto")?.size > 5 * 1024 * 1024)
      throw Error("La imagen supera 5 MB.");
    const requestId = f.dataset.requestId || crypto.randomUUID();
    f.dataset.requestId = requestId;
    let data;
    try {
      data = await api(url, {
        method: "POST",
        headers: {
          "X-Request-ID": requestId,
          ...(!multipart ? { "Content-Type": "application/json" } : {}),
        },
        body: multipart ? fd : JSON.stringify(Object.fromEntries(fd)),
      });
    } catch (e) {
      throw e;
    }
    delete f.dataset.requestId;
    f.reset();
    notice(
      data.record.notificationError ||
        "Registro guardado. La notificación queda en la cola de Discord.",
    );
    $("#notice").append(
      document.createTextNode(" "),
      link(data.record.pdfUrl, "Abrir PDF"),
    );
    await refresh();
  });
$("#fineForm").addEventListener(
  "input",
  () => delete $("#fineForm").dataset.requestId,
);
$("#arrestForm").addEventListener(
  "input",
  () => delete $("#arrestForm").dataset.requestId,
);
bind("#citizenForm", async (f) => {
  await jsonPost(
    editing ? "/api/citizens/" + encodeURIComponent(editing) : "/api/citizens",
    Object.fromEntries(new FormData(f)),
    editing ? "PUT" : "POST",
  );
  resetEdit();
  notice("Ciudadano guardado.");
  await refresh();
});
function resetEdit() {
  editing = null;
  $("#citizenForm").reset();
  $("#citizenForm").elements.numeroCedula.readOnly = false;
  $("#citizenTitle").textContent = "Registrar ciudadano";
  $("#cancelEdit").hidden = true;
}
$("#cancelEdit").addEventListener("click", resetEdit);
bind("#assetForm", async (f) => {
  const d = Object.fromEntries(new FormData(f));
  await jsonPost(
    "/api/citizens/" + encodeURIComponent(d.cedula) + "/assets",
    d,
  );
  notice("Registro agregado.");
  f.reset();
  $("#assetType").dispatchEvent(new Event("change"));
});
$("#assetType").addEventListener("change", () => {
  const vehicle = $("#assetType").value === "vehiculo";
  $("#vehicleFields").hidden = !vehicle;
  $("#licenseField").hidden = vehicle;
});
document.querySelectorAll("[data-tab]").forEach((b) =>
  b.addEventListener("click", () => {
    tab(b.dataset.tab);
    if (b.dataset.tab === "bot") bot().catch((e) => notice(e.message, true));
  }),
);
$("#logout").addEventListener("click", async () => {
  try {
    await jsonPost("/api/auth/logout", {});
    location.href = "/";
  } catch (e) {
    notice(e.message, true);
  }
});
$("#refreshBot").addEventListener("click", () =>
  bot().catch((e) => notice(e.message, true)),
);
$("#retry").addEventListener("click", async () => {
  try {
    const r = await jsonPost("/api/notifications/retry", {});
    notice(r.count + " notificaciones preparadas para reintentar.");
    await bot();
  } catch (e) {
    notice(e.message, true);
  }
});
(async () => {
  try {
    const { user } = await api("/api/auth/me");
    $("#who").textContent = user.nombreCompleto;
    $("#adminLink").hidden = !user.isAdmin;
    const config = await api("/api/config");
    $("#robloxLink").hidden = !config.robloxOAuth || !user.discordId;
    $("#citizenTab").hidden = !user.isAdmin;
    $("#retry").hidden = !user.isAdmin;
    if (!user.hasPoliceAccess) {
      $("#restricted").hidden = false;
      return;
    }
    $("#workspace").hidden = false;
    await refresh();
    await bot();
    const q = new URLSearchParams(location.search);
    if (q.get("error")) notice(q.get("error"), true);
    else if (q.get("message")) notice(q.get("message"));
  } catch (e) {
    notice(e.message, true);
  }
})();
