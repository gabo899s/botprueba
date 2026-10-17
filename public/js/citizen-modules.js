(() => {
  "use strict";
  const app = window.CitizenApp;
  if (!app) return;
  const definitions = {
    store: ["Tienda", "La tienda ciudadana estará disponible cuando se habiliten el catálogo y las compras del servidor."],
    assets: ["Patrimonio", "El inventario detallado de patrimonio está en preparación. Puedes consultar tus vehículos y licencias actuales en Mi perfil."],
    housing: ["Casa", "El catálogo de viviendas y la gestión de propiedades todavía no están habilitados."],
    transactions: ["Transacciones", "El saldo, el historial y las operaciones bancarias se habilitarán al conectar la economía del servidor. Aquí no se realizan movimientos de dinero."],
    trades: ["Tradeos", "Los intercambios entre ciudadanos todavía no están disponibles en la web."],
    ck: ["CK", "Las solicitudes de CK se tramitan con el staff. Esta sección no elimina personajes ni modifica su expediente."],
    dot: ["DOT", "Tu rol permite ver esta sección. El panel del departamento DOT está en preparación."],
    fire: ["Fire Dept.", "Tu rol permite ver esta sección. El panel de bomberos está en preparación."],
    gangs: ["Bandas", "Tu rol permite ver esta sección. El panel de bandas está en preparación."],
  };
  const restricted = new Set(["dot", "fire", "gangs"]);
  const allowed = new Set();
  let generation = 0, selected = null;
  const controls = () => document.querySelectorAll("[data-module]");

  function reset() {
    allowed.clear();
    Object.keys(definitions).filter((id) => !restricted.has(id)).forEach((id) => allowed.add(id));
    renderControls();
    if (selected && restricted.has(selected)) {
      selected = null;
      const details = document.querySelector("#moduleDetails");
      details?.replaceChildren();
      app.selectPanel("personal");
    }
  }
  function renderControls() {
    controls().forEach((control) => {
      const id = control.dataset.module;
      control.hidden = !allowed.has(id);
      control.removeAttribute("aria-disabled");
      control.disabled = !allowed.has(id);
      control.classList.remove("locked");
      control.querySelectorAll(".lock-icon").forEach((icon) => icon.remove());
      // Repeated account refreshes must not accumulate status badges.
      control.querySelectorAll(".module-status").forEach((badge) => badge.remove());
      if (control.classList.contains("tile") && definitions[id]) {
        const badge = document.createElement("small");
        badge.className = "module-status";
        badge.textContent = "Próximamente";
        control.append(badge);
      }
    });
  }
  function show(id) {
    if (!allowed.has(id) || !Object.hasOwn(definitions, id)) return;
    const details = document.querySelector("#moduleDetails");
    if (!details) return;
    selected = id;
    const title = document.createElement("h2"), status = document.createElement("span"), description = document.createElement("p");
    title.textContent = definitions[id][0];
    status.className = "status-chip";
    status.textContent = "Próximamente";
    description.textContent = definitions[id][1];
    details.replaceChildren(title, status, description);
    app.selectPanel("module");
    document.querySelectorAll(".tile").forEach((tile) => {
      const active = tile.dataset.module === id;
      tile.classList.toggle("active", active);
      if (active) tile.setAttribute("aria-current", "page");
      else tile.removeAttribute("aria-current");
    });
  }
  controls().forEach((control) => control.addEventListener("click", () => show(control.dataset.module)));
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-panel]")) {
      selected = null;
      controls().forEach((control) => { control.classList.remove("active"); control.removeAttribute("aria-current"); });
    }
  });
  async function update(event) {
    const request = ++generation;
    reset();
    const state = event?.detail || { me: app.me };
    if (!state.me || state.demo) return;
    try {
      const result = await app.api("/api/profile/modules");
      if (request !== generation || !app.me || (app.me.discordId || app.me.id) !== (state.me.discordId || state.me.id)) return;
      if (!Array.isArray(result.modules)) throw Error("Respuesta de permisos inválida.");
      result.modules.forEach((module) => {
        if (Object.hasOwn(definitions, module.id) && restricted.has(module.id) && module.status === "pending") allowed.add(module.id);
      });
      renderControls();
    } catch (error) {
      if (request !== generation) return;
      // Fail closed: never preserve the previous account's department access.
      reset();
      if (error.status !== 401) app.notice("No se pudieron comprobar los permisos de los departamentos. Intenta actualizar el panel.");
    }
  }
  document.addEventListener("citizen:updated", update);
  reset();
  if (app.me) update();
})();
