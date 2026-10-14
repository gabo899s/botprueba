const $ = (s) => document.querySelector(s);
let config;
const labels = {
  staffRoleIds: "Roles de staff",
  moderatorRoleIds: "Roles de moderador",
  adminRoleIds: "Roles de administración",
  policeRoleIds: "Roles policiales",
  verifiedRoleId: "Rol de whitelist aprobada",
  pendingRoleId: "Rol pendiente de whitelist",
  voiceRequired: "Exigir presencia en canal de voz",
  minimumShiftMinutes: "Duración mínima válida de un turno (minutos)",
  sanctionCooldownSeconds: "Espera entre sanciones (segundos)",
  licensePassingPercent: "Porcentaje mínimo para licencia",
  whitelistPassingPercent: "Porcentaje mínimo para whitelist",
  ticketInactivityHours: "Horas antes de archivar un ticket inactivo",
  ticketHighVolume: "Modo de soporte con alto volumen",
  nicknamePrefix: "Prefijo de apodo de whitelist",
  serverCode: "Código del servidor ER:LC",
  serverState: "Estado local del servidor",
  automaticFineCollection:
    "Cobro automático de moneda ficticia para multas vencidas",
};
function notice(text) {
  $("#notice").textContent = text;
  $("#notice").hidden = false;
}
function field(parent, key, value, label) {
  const wrap = document.createElement("label");
  wrap.textContent = label || key;
  const input = document.createElement("input");
  input.name = key;
  if (typeof value === "boolean") {
    input.type = "checkbox";
    input.checked = value;
  } else {
    input.value = Array.isArray(value) ? value.join(",") : (value ?? "");
    if (typeof value === "number") {
      input.type = "number";
      input.step = "any";
      input.min = "0";
    }
  }
  input.dataset.kind = Array.isArray(value) ? "array" : typeof value;
  wrap.append(input);
  parent.append(wrap);
}
(async () => {
  try {
    const r = await fetch("/api/bot/settings");
    const d = await r.json();
    if (!r.ok) throw Error(d.message);
    config = d.settings;
    const fields = $("#fields");
    for (const [k, v] of Object.entries(config)) {
      if (k === "hierarchy") {
        const label = document.createElement("label");
        label.textContent =
          "Jerarquía: una línea por cargo, nombre | ID del rol";
        const area = document.createElement("textarea");
        area.name = "hierarchy";
        area.value = v.map((h) => h.name + " | " + h.roleId).join("\n");
        label.append(area);
        fields.append(label);
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        const h = document.createElement("h2");
        h.textContent =
          {
            channels: "Canales y categoría de tickets",
            licenseRoles: "Roles de licencias",
            sanctionRoles: "Roles por nivel de sanción",
            banRoles: "Roles por nivel de ban",
          }[k] || k;
        fields.append(h);
        for (const [sub, value] of Object.entries(v))
          field(fields, k + "." + sub, value, sub);
      } else field(fields, k, v, labels[k]);
    }
  } catch (e) {
    notice(e.message);
    $("#configForm").hidden = true;
  }
})();
$("#configForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.target.querySelector("button");
  button.disabled = true;
  try {
    const output = structuredClone(config);
    for (const input of e.target.querySelectorAll("input")) {
      let value =
        input.type === "checkbox"
          ? input.checked
          : input.dataset.kind === "number"
            ? Number(input.value)
            : input.dataset.kind === "array"
              ? input.value
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean)
              : input.value.trim();
      const parts = input.name.split(".");
      if (parts.length === 2) output[parts[0]][parts[1]] = value;
      else output[parts[0]] = value;
    }
    output.hierarchy = e.target.elements.hierarchy.value
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, roleId] = line.split("|").map((v) => v.trim());
        return { name, roleId };
      });
    const r = await fetch("/api/bot/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Local-Request": "1" },
      body: JSON.stringify(output),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.message);
    notice(
      "Configuración guardada. Los comandos usan estos valores sin reiniciar.",
    );
    config = output;
  } catch (err) {
    notice(err.message);
  } finally {
    button.disabled = false;
  }
});
