const $ = (s) => document.querySelector(s);
let me = null,
  current = null;
const element = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
function notice(text, error = false) {
  $("#notice").textContent = text;
  $("#notice").hidden = false;
  $("#notice").className = "notice" + (error ? " error" : "");
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
function send(url, body, method = "POST") {
  return api(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function action(parent, label, callback) {
  const b = element("button", label, "secondary");
  b.type = "button";
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await callback();
      await refresh();
    } catch (e) {
      notice(e.message, true);
    } finally {
      b.disabled = false;
    }
  });
  parent.append(b);
}
function time(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return (
    Math.floor(seconds / 3600) +
    " h " +
    Math.floor((seconds % 3600) / 60) +
    " min " +
    (seconds % 60) +
    " s"
  );
}
function timer() {
  if (!current) {
    $("#timer").textContent = "Sin turno activo";
    return;
  }
  $("#timer").textContent = time(
    current.activeMs +
      (current.state === "active" ? Math.max(0, Date.now() - current.last) : 0),
  );
  $("#shiftState").textContent =
    current.state === "active" ? "Turno activo" : "En descanso";
}
setInterval(timer, 1000);
async function refresh() {
  const d = await api("/api/staff/me");
  me = d.user;
  $("#who").textContent = me.nombreCompleto;
  current = d.shift.current;
  timer();
  $("#shiftHistory").replaceChildren();
  for (const s of d.shift.history.slice().reverse().slice(0, 20))
    $("#shiftHistory").append(
      element(
        "p",
        new Date(s.start).toLocaleString() +
          " · " +
          time(s.activeMs) +
          " · " +
          (s.valid ? "Contabilizado" : "No alcanza duración mínima"),
        "muted",
      ),
    );
  const loa = await api("/api/staff/loa");
  $("#loaHistory").replaceChildren();
  for (const l of loa.items) {
    const row = element("div", undefined, "record");
    row.append(
      element("strong", l.status),
      element("p", l.reason),
      element(
        "p",
        new Date(l.start).toLocaleString() +
          " → " +
          new Date(l.end).toLocaleString(),
      ),
    );
    if (me.isAdmin && l.status === "pendiente") {
      action(row, "Aprobar", () =>
        send("/api/staff/loa/" + l.id + "/decision", { approve: true }),
      );
      action(row, "Rechazar", () =>
        send("/api/staff/loa/" + l.id + "/decision", { approve: false }),
      );
    }
    $("#loaHistory").append(row);
  }
  const recent = await api("/api/staff/recent");
  $("#logs").replaceChildren();
  for (const r of recent.sanctions) {
    const row = element("div", undefined, "record");
    row.append(
      element("strong", r.usuarioId + " · " + r.estado),
      element("p", r.motivo),
      element("small", r.fecha),
    );
    if (me.isAdmin) {
      if (r.pendingApproval && !r.externallyApplied && r.estado === "activa")
        action(row, "Aprobar y aplicar castigo ER:LC", () =>
          send(
            "/api/staff/sanctions/" +
              r.usuarioId +
              "/" +
              r.id +
              "/approve-punishment",
            {},
          ),
        );
      action(row, "Editar motivo", async () => {
        const motivo = prompt("Nuevo motivo", r.motivo);
        if (motivo !== null)
          await send(
            "/api/staff/sanctions/" + r.usuarioId + "/" + r.id,
            { motivo },
            "PUT",
          );
      });
      action(row, "Revocar", () =>
        send("/api/staff/sanctions/" + r.usuarioId + "/" + r.id, {}, "DELETE"),
      );
      if (r.appeal?.status === "pendiente") {
        row.append(element("p", "Apelación: " + r.appeal.reason));
        action(row, "Aceptar apelación", () =>
          send(
            "/api/staff/sanctions/" + r.usuarioId + "/" + r.id + "/decision",
            { accept: true },
          ),
        );
        action(row, "Rechazar apelación", () =>
          send(
            "/api/staff/sanctions/" + r.usuarioId + "/" + r.id + "/decision",
            { accept: false },
          ),
        );
      }
    }
    $("#logs").append(row);
  }
  for (const r of recent.bans) {
    const row = element("div", undefined, "record");
    row.append(
      element("strong", "Ban · " + r.roblox + " · " + r.status),
      element("p", r.motivo),
    );
    if (r.error) row.append(element("p", r.error));
    if (r.status === "aplicado" || r.status === "no-confirmado")
      action(row, "Retirar ban en ER:LC", () =>
        send("/api/staff/desbanear", { roblox: r.roblox }),
      );
    $("#logs").append(row);
  }
  $("#ranking").replaceChildren(element("h3", "Ranking de horas registradas"));
  for (const r of recent.ranking)
    $("#ranking").append(
      element("p", r.userId + " · " + r.horas.toFixed(2) + " horas"),
    );
  const tickets = await api("/api/tickets");
  $("#tickets").replaceChildren();
  for (const t of tickets.items) {
    const row = element("div", undefined, "record");
    row.append(element("p", t.topic + " · " + t.status));
    if (t.transcriptFile) {
      const a = element("a", "Descargar transcripción");
      a.href = "/api/tickets/" + t.id + "/transcript";
      row.append(a);
    }
    $("#tickets").append(row);
  }
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
bind("#loaForm", async (f) => {
  const d = Object.fromEntries(new FormData(f));
  await send("/api/staff/loa/solicitar", {
    ...d,
    start: new Date(d.start).toISOString(),
    end: new Date(d.end).toISOString(),
  });
  f.reset();
  await refresh();
  notice("Solicitud guardada. Pendiente de aprobación.");
});
for (const b of document.querySelectorAll("[data-shift]"))
  b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await send("/api/staff/shift/toggle", { action: b.dataset.shift });
      await refresh();
    } catch (e) {
      notice(e.message, true);
    } finally {
      b.disabled = false;
    }
  });
bind("#search", async (f) => {
  const q = f.elements.query.value;
  const d = await api("/api/staff/search/discord?q=" + encodeURIComponent(q));
  $("#results").replaceChildren();
  for (const c of d.results) {
    const row = element("div", undefined, "record");
    row.append(
      element("p", c.nombre + " " + c.apellidos + " · " + c.numeroCedula),
    );
    action(row, "Seleccionar", async () => {
      $("#moderation").elements.userId.value = c.discordId || "";
      $("#moderation").elements.roblox.value = c.roblox?.username || "";
      notice("Jugador seleccionado.");
    });
    $("#results").append(row);
  }
  if (!d.results.length) $("#results").append(element("p", "Sin registros."));
});
$("#robloxSearch").addEventListener("click", async () => {
  try {
    const d = await api(
      "/api/staff/search/roblox?q=" +
        encodeURIComponent($("#search").elements.query.value),
    );
    $("#results").replaceChildren();
    for (const r of d.results)
      $("#results").append(
        element(
          "p",
          r.name +
            " · Roblox ID " +
            r.id +
            " · " +
            (r.citizen
              ? "Discord: " + r.citizen.discordId
              : "Sin cuenta Discord vinculada; no se puede sancionar un Discord a partir del nombre Roblox."),
        ),
      );
  } catch (e) {
    notice(e.message, true);
  }
});
bind("#moderation", async (f) => {
  const d = Object.fromEntries(new FormData(f));
  const r = await send(
    d.tipo === "ban" ? "/api/staff/banear" : "/api/staff/sancionar",
    d,
  );
  await refresh();
  notice(
    d.tipo === "ban"
      ? "Resultado del ban: " +
          r.data.status +
          (r.data.error ? " · " + r.data.error : "")
      : "Registro guardado.",
    r.data.status === "no-confirmado",
  );
});
$("#refresh").addEventListener("click", () =>
  refresh().catch((e) => notice(e.message, true)),
);
$("#logout").addEventListener("click", async () => {
  try {
    await send("/api/staff/auth/logout", {});
    location.href = "/";
  } catch (e) {
    notice(e.message, true);
  }
});
refresh()
  .then(() => {
    $("#workspace").hidden = false;
  })
  .catch((e) => {
    $("#access").hidden = false;
    notice(e.message, true);
  });
