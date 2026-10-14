const $ = (s) => document.querySelector(s);
let person = null,
  user = null,
  timer,
  seq = 0;
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function toast(text, url) {
  const n = el("div", text, "toast");
  if (url) {
    const a = el("a", "Abrir PDF");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    n.append(a);
  }
  $("#toast-container").append(n);
  setTimeout(() => n.remove(), 8000);
}
async function api(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { "X-Local-Request": "1", ...options.headers },
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.message || "Solicitud fallida.");
  return data;
}
function image(img, url) {
  img.src = url || "/images/logo.png";
  img.addEventListener(
    "error",
    () => {
      img.src = "/images/logo.png";
    },
    { once: true },
  );
}
function records(target, values) {
  target.replaceChildren();
  if (!values.length) {
    target.append(el("p", "Sin registros."));
    return;
  }
  for (const r of values) {
    const row = el("div", undefined, "recovery-record");
    row.append(
      el(
        "strong",
        r.estado +
          " · " +
          (r.monto !== undefined
            ? "$" + r.monto.toFixed(2)
            : r.tiempo + " años"),
      ),
      el("p", r.articulos),
      el("p", r.fecha + " · Oficial: " + r.oficialNombre),
    );
    for (const [url, label] of [
      [r.pdfUrl, "Abrir PDF"],
      [r.imagenUrl, "Evidencia"],
    ])
      if (url) {
        const a = el("a", label);
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        row.append(a);
      }
    if (r.monto !== undefined && r.paymentRequested && r.estado !== "PAGADA") {
      const b = el("button", "Validar pago manual");
      b.addEventListener("click", async () => {
        const reference = prompt("Referencia o comprobante de moneda ficticia");
        if (!reference) return;
        try {
          await api("/api/police/payments/" + r.id + "/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference }),
          });
          await search(person.numeroCedula);
          toast("Pago validado por tu sesión.");
        } catch (e) {
          toast(e.message);
        }
      });
      row.append(b);
    }
    target.append(row);
  }
}
async function search(query) {
  const { data: c } = await api("/api/search?q=" + encodeURIComponent(query));
  person = c;
  $("#dashboard-empty").classList.add("hidden-view");
  $("#citizen-content").classList.remove("hidden-view");
  $("#search-dropdown").classList.remove("active");
  $("#cit-name").textContent = c.nombre + " " + c.apellidos;
  $("#cit-id").textContent = c.numeroCedula;
  image($("#cit-avatar"), c.roblox?.avatarUrl);
  $("#cit-details").replaceChildren();
  for (const [label, value] of Object.entries({
    Discord: c.discordId || "sin vincular",
    Roblox: c.roblox?.username || "sin vincular",
    Provincia: c.provincia || "N/A",
    Nacionalidad: c.nacionalidad || "N/A",
  }))
    $("#cit-details").append(el("p", label + ": " + value));
  $("#cit-licencias").replaceChildren();
  for (const l of c.licencias)
    $("#cit-licencias").append(el("p", l.tipo + " · " + l.estado));
  $("#cit-vehicles").replaceChildren();
  for (const v of c.vehiculos)
    $("#cit-vehicles").append(el("p", v.placa + " · " + v.modelo));
  records($("#cit-multas"), c.multas);
  records($("#cit-arrestos"), c.arrestos);
}
$("#search-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") search(e.target.value).catch((e) => toast(e.message));
});
$("#search-input").addEventListener("input", () => {
  clearTimeout(timer);
  const serial = ++seq;
  timer = setTimeout(async () => {
    try {
      const d = await api(
        "/api/search/suggestions?q=" +
          encodeURIComponent($("#search-input").value),
      );
      if (serial !== seq) return;
      const target = $("#search-dropdown");
      target.replaceChildren();
      for (const c of d.suggestions) {
        const b = el(
          "button",
          c.nombre + " " + c.apellidos + " · " + c.numeroCedula,
          "search-result",
        );
        b.addEventListener("click", () =>
          search(c.numeroCedula).catch((e) => toast(e.message)),
        );
        target.append(b);
      }
      target.classList.toggle("active", !!d.suggestions.length);
    } catch (e) {
      toast(e.message);
    }
  }, 250);
});
function modal(type, open) {
  if (open && !person) return toast("Selecciona un ciudadano.");
  $("#modal-" + type).classList.toggle("hidden-view", !open);
}
async function submit(type, button) {
  if (!person) return;
  button.disabled = true;
  try {
    const values = {
      documento: person.numeroCedula,
      articulos: $("#" + type + "-articulos").value,
    };
    let body,
      headers = {
        "X-Request-ID": button.dataset.requestId || crypto.randomUUID(),
      };
    button.dataset.requestId = headers["X-Request-ID"];
    if (type === "multa") {
      values.valor = $("#multa-valor").value;
      values.placa = $("#multa-placa").value;
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(values);
    } else {
      values.tiempo = $("#arresto-tiempo").value;
      body = new FormData();
      for (const [k, v] of Object.entries(values)) body.set(k, v);
      const f = $("#arresto-foto").files[0];
      if (f) {
        if (f.size > 5 * 1024 * 1024) throw Error("Máximo 5 MB.");
        body.set("foto", f);
      }
    }
    const d = await api("/api/" + type, { method: "POST", headers, body });
    delete button.dataset.requestId;
    modal(type, false);
    await search(person.numeroCedula);
    toast("Registro guardado. Notificación en cola.", d.record.pdfUrl);
  } catch (e) {
    toast(e.message);
  } finally {
    button.disabled = false;
  }
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const action = b.dataset.action;
  if (action.startsWith("open-")) modal(action.slice(5), true);
  else if (action.startsWith("close-")) modal(action.slice(6), false);
  else if (action.startsWith("submit-")) await submit(action.slice(7), b);
  else if (action === "logout") {
    try {
      await api("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      location.href = "/";
    } catch (e) {
      toast(e.message);
    }
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    modal("multa", false);
    modal("arresto", false);
  }
});
$("#arresto-foto").addEventListener("change", () => {
  $("#arresto-filename").textContent =
    $("#arresto-foto").files[0]?.name || "Subir evidencia visual";
});
(async () => {
  try {
    const d = await api("/api/auth/me");
    user = d.user;
    if (!user.hasPoliceAccess)
      throw Error("Tu cuenta no tiene un rol policial autorizado.");
    $("#access").hidden = true;
    $("#view-dashboard").classList.remove("hidden-view");
    $("#user-name").textContent = user.nombreCompleto;
    $("#user-role").textContent = user.trabajo;
    image($("#user-avatar"), user.discordAvatar);
  } catch (e) {
    toast(e.message);
  }
})();
