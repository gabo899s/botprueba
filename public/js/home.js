const $ = (s) => document.querySelector(s);
let currentUser = null,
  configuration = {};
function node(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
function showToast(message, type = "info") {
  const n = node("div", message, "toast " + type);
  $("#toast-container").append(n);
  setTimeout(() => n.remove(), 6000);
}
async function api(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { "X-Local-Request": "1", ...options.headers },
  });
  const data = await r.json();
  if (!r.ok) {
    const e = Error(data.message || "No se pudo completar la solicitud.");
    e.status = r.status;
    throw e;
  }
  return data;
}
function avatar(user) {
  return user.discordAvatar || "/images/logo.png";
}
function setImage(img, url) {
  if (img) {
    img.src = url || "/images/logo.png";
    img.addEventListener(
      "error",
      () => {
        if (!img.src.endsWith("/images/logo.png")) img.src = "/images/logo.png";
      },
      { once: true },
    );
  }
}
function renderGuest() {
  currentUser = null;
  const area = $("#user-area");
  area.replaceChildren();
  const b = node("button", "ENTRAR CON DISCORD", "local-login-button");
  b.type = "button";
  b.dataset.action = "login";
  area.append(b);
  $("#hero-content").replaceChildren(
    $("#guest-hero-template").content.cloneNode(true),
  );
}
function renderUser() {
  const u = currentUser,
    area = $("#user-area");
  area.replaceChildren();
  const trigger = node("button", undefined, "profile-trigger");
  trigger.id = "profile-trigger";
  trigger.type = "button";
  trigger.dataset.action = "profile";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", "profileDropdown");
  const image = node("img", undefined, "profile-trigger-avatar");
  image.alt = "Avatar";
  setImage(image, avatar(u));
  const info = node("div", undefined, "profile-trigger-info");
  info.append(
    node(
      "div",
      u.discordUsername || u.nombreCompleto,
      "profile-trigger-username",
    ),
    node("div", u.trabajo, "profile-trigger-role"),
  );
  trigger.append(image, info, node("span", "⌄", "profile-trigger-arrow"));
  area.append(trigger);
  const dropdown = $("#profile-dropdown-template")
    .content.cloneNode(true)
    .querySelector(".profile-dropdown");
  dropdown.id = "profileDropdown";
  setImage(dropdown.querySelector("#dropdown-avatar"), avatar(u));
  dropdown.querySelector("#dropdown-username").textContent = u.nombreCompleto;
  dropdown.querySelector("#dropdown-userid").textContent = u.discordId
    ? "ID: " + u.discordId
    : "Cuenta de Discord";
  const connections = dropdown.querySelector("#connections-list");
  if (u.roblox?.username) {
    const item = $("#roblox-connection-template").content.cloneNode(true);
    setImage(item.querySelector("img"), u.roblox.avatarUrl);
    item.querySelector(".connection-username").textContent = u.roblox.username;
    connections.append(item);
  } else if (configuration.robloxOAuth && u.discordId)
    connections.append($("#connect-roblox-template").content.cloneNode(true));
  else
    connections.append(
      node("p", "Roblox no vinculado. Es opcional.", "text-gray-400 text-sm"),
    );
  area.append(dropdown);
  const hero = $("#user-hero-template").content.cloneNode(true);
  setImage(hero.querySelector("#hero-avatar"), avatar(u));
  hero.querySelector("#hero-name").textContent = u.nombreCompleto;
  hero.querySelector("#hero-role").textContent = u.trabajo;
  {
    const full = node(
      "a",
      "EXPEDIENTE COMPLETO",
      "btn-premium btn-discord px-8 py-5 rounded-xl font-bold text-xs",
    );
    full.href = "/ciudadano";
    hero.querySelector(".flex.flex-wrap").append(full);
  }
  if (u.hasStaffAccess) {
    const staff = node(
      "a",
      "CENTRO DE STAFF",
      "btn-premium btn-discord px-8 py-5 rounded-xl font-bold text-xs",
    );
    staff.href = "/staff";
    hero.querySelector(".flex.flex-wrap").append(staff);
  }
  if (u.isAdmin) {
    const admin = node(
      "a",
      "ADMINISTRACIÓN",
      "btn-premium btn-discord px-8 py-5 rounded-xl font-bold text-xs",
    );
    admin.href = "/admin";
    hero.querySelector(".flex.flex-wrap").append(admin);
  }
  if (u.hasPoliceAccess) {
    const panel = node(
      "a",
      "PLATAFORMA POLICIAL",
      "btn-premium btn-discord px-8 py-5 rounded-xl font-bold text-xs",
    );
    panel.href = "/v2/police";
    hero.querySelector(".flex.flex-wrap").append(panel);
  }
  $("#hero-content").replaceChildren(hero);
}
async function checkAuth() {
  try {
    const d = await api("/api/auth/me");
    currentUser = d.user;
    renderUser();
  } catch (e) {
    if (e.status === 401) renderGuest();
    else showToast(e.message, "error");
  }
}
function openLogin() {
  const d = $("#loginDialog");
  $("#loginError").hidden = true;
  $("#discordLogin").hidden = !configuration.discordOAuth;
  if(!configuration.discordOAuth){$("#loginError").textContent="El acceso con Discord está pendiente de configuración.";$("#loginError").hidden=false;}
  d.showModal();
}
function closeProfile() {
  const d = $("#profileDropdown"),
    t = $("#profile-trigger");
  d?.classList.remove("show");
  t?.classList.remove("active");
  t?.setAttribute("aria-expanded", "false");
}
async function citizen() {
  if (!currentUser) return openLogin();
  const d = $("#citizenDialog"),
    content = $("#citizenProfile");
  content.replaceChildren(node("p", "Cargando…"));
  d.showModal();
  try {
    const { citizen: c } = await api("/api/profile");
    content.replaceChildren();
    if (!c) {
      content.append(
        node(
          "p",
          "Tu personaje aún no está registrado. Pide al administrador que registre tu cédula con tu ID de Discord.",
        ),
      );
      if (currentUser.hasPoliceAccess) {
        const a = node("a", "Abrir plataforma policial", "connect-btn mt-4");
        a.href = "/v2/police";
        content.append(a);
      }
      return;
    }
    content.append(
      node("h3", (c.nombre + " " + c.apellidos).trim(), "font-bold text-xl"),
      node("p", "Cédula: " + c.numeroCedula, "text-gray-400"),
      node("p", "Roblox: " + (c.roblox?.username || "sin vincular"), "mt-4"),
    );
    for (const [label, values] of [
      ["Vehículos", c.vehiculos.map((v) => v.placa + " · " + v.modelo)],
      ["Licencias", c.licencias.map((l) => l.tipo + " · " + l.estado)],
    ]) {
      content.append(node("h3", label, "font-bold mt-6"));
      content.append(
        node("p", values.join(", ") || "Sin registros.", "text-gray-400"),
      );
    }
    content.append(node("h3", "Multas y arrestos", "font-bold mt-6"));
    for (const r of [...c.multas, ...c.arrestos]) {
      const row = node("div", undefined, "profile-entry");
      row.append(
        node(
          "p",
          r.fecha +
            " · " +
            (r.monto !== undefined
              ? "Multa $" + r.monto.toFixed(2)
              : "Arresto " + r.tiempo + " años"),
        ),
        node("p", r.articulos),
      );
      for (const [url, label] of [
        [r.pdfUrl, "Abrir PDF"],
        [r.imagenUrl, "Ver evidencia"],
      ])
        if (url) {
          const a = node("a", label);
          a.href = url;
          a.target = "_blank";
          a.rel = "noopener";
          row.append(a);
        }
      content.append(row);
    }
    if (!c.multas.length && !c.arrestos.length)
      content.append(node("p", "Sin registros.", "text-gray-400"));
  } catch (e) {
    content.replaceChildren(node("p", e.message));
  }
}
const actions = {
  login: openLogin,
  closeLogin: () => $("#loginDialog").close(),
  closeCitizen: () => $("#citizenDialog").close(),
  profile: () => {
    const d = $("#profileDropdown"),
      t = $("#profile-trigger");
    const open = d.classList.toggle("show");
    t.classList.toggle("active", open);
    t.setAttribute("aria-expanded", String(open));
  },
  police: () => {
    if (!currentUser) return openLogin();
    if (!currentUser.hasPoliceAccess)
      return showToast(
        "Tu cuenta no tiene un rol policial autorizado.",
        "error",
      );
    location.href = "/v2/police";
  },
  citizen,
  logout: async () => {
    try {
      await api("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      renderGuest();
      showToast("Sesión cerrada.", "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  },
  refreshProfile: async () => {
    await checkAuth();
    showToast("Información actualizada desde el servidor.", "success");
  },
  connectRoblox: () => {
    if (!currentUser) return openLogin();
    if (!currentUser.discordId)
      return showToast(
        "Inicia sesión con Discord para vincular Roblox.",
        "info",
      );
    if (!configuration.robloxOAuth)
      return showToast("Roblox aún no está configurado.", "info");
    location.href = "/auth/roblox";
  },
  closeRobloxModal: () => $("#roblox-modal").classList.remove("show"),
  unconfiguredSocial: () =>
    showToast("Este enlace social aún no está configurado.", "info"),
  copy: async () => {
    const input = $("#serverCode");
    try {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(input.value);
      else {
        input.select();
        if (!document.execCommand("copy")) throw Error();
      }
      showToast("Código copiado: " + input.value, "success");
    } catch {
      input.focus();
      input.select();
      showToast("Selecciona el código y pulsa Ctrl+C.", "info");
    }
  },
};
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-action]");
  if (target) {
    e.preventDefault();
    actions[target.dataset.action]?.();
  }
  if (!e.target.closest("#user-area")) closeProfile();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeProfile();
});
(async () => {
  try {
    configuration = await api("/api/config");
  } catch (e) {
    showToast(e.message, "error");
  }
  await checkAuth();
  const q = new URLSearchParams(location.search);
  if (q.get("error")) showToast(q.get("error"), "error");
  else if (q.get("message")) showToast(q.get("message"), "success");
  if (q.size) history.replaceState({}, "", location.pathname);
})();
