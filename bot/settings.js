const fs = require("node:fs"),
  path = require("node:path");
const { root } = require("../lib/config");
const store = require("../lib/store");
const defaults = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.example.json"), "utf8"),
);
function get() {
  const local = path.join(root, "bot/config.json");
  let value = fs.existsSync(local)
    ? JSON.parse(fs.readFileSync(local, "utf8"))
    : {};
  value = { ...value, ...store.read("settings") };
  const envLicenses = {};
  try {
    for (const [role, type] of Object.entries(
      JSON.parse(process.env.LICENSE_ROLE_MAP || "{}"),
    ))
      if (/^\d{17,20}$/.test(role) && type in defaults.licenseRoles)
        envLicenses[type] = role;
  } catch {
    throw Error("LICENSE_ROLE_MAP no contiene un JSON válido.");
  }
  return {
    ...defaults,
    ...value,
    channels: { ...defaults.channels, ...value.channels },
    licenseRoles: Object.fromEntries(
      Object.keys(defaults.licenseRoles).map((type) => [
        type,
        value.licenseRoles?.[type] || envLicenses[type] || "",
      ]),
    ),
    sanctionRoles: { ...defaults.sanctionRoles, ...value.sanctionRoles },
    banRoles: { ...defaults.banRoles, ...value.banRoles },
  };
}
function roles(value) {
  if (
    !Array.isArray(value) ||
    value.some((v) => typeof v !== "string" || !/^\d{17,20}$/.test(v))
  )
    throw Error("Los roles deben ser listas de IDs Discord.");
}
function validate(v) {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("Configuración JSON inválida.");
  for (const k of [
    "acceptedRoleIds",
    "voiceExemptRoleIds",
    "staffRoleIds",
    "moderatorRoleIds",
    "adminRoleIds",
    "policeRoleIds",
  ])
    roles(v[k] || []);
  for (const k of ["licenseRoles", "sanctionRoles", "banRoles", "channels"])
    for (const id of Object.values(v[k] || {}))
      if (id !== "" && (typeof id !== "string" || !/^\d{17,20}$/.test(id)))
        throw Error("ID inválido en " + k);
  for (const k of ["verifiedRoleId", "pendingRoleId"])
    if (v[k] && !/^\d{17,20}$/.test(v[k])) throw Error("ID inválido.");
  for (const k of ["licensePassingPercent", "whitelistPassingPercent"])
    if (!Number.isFinite(v[k]) || v[k] < 1 || v[k] > 100)
      throw Error("Porcentaje inválido.");
  for (const k of [
    "minimumShiftMinutes",
    "sanctionCooldownSeconds",
    "ticketInactivityHours",
  ])
    if (!Number.isFinite(v[k]) || v[k] < 0 || v[k] > 10000)
      throw Error("Valor inválido en " + k);
  if (
    v.automaticFineCollection !== undefined &&
    typeof v.automaticFineCollection !== "boolean"
  )
    throw Error("Configuración de cobro inválida.");
  if (
    typeof v.voiceRequired !== "boolean" ||
    typeof v.ticketHighVolume !== "boolean"
  )
    throw Error("Configuración booleana inválida.");
  if (
    !Array.isArray(v.hierarchy) ||
    v.hierarchy.some(
      (h) => !h || typeof h.name !== "string" || !/^\d{17,20}$/.test(h.roleId),
    )
  )
    throw Error("Jerarquía inválida.");
  if (typeof v.serverCode !== "string" || v.serverCode.length > 60)
    throw Error("Código de juego inválido.");
  if (v.maximumShiftHours !== undefined && (!Number.isFinite(v.maximumShiftHours) || v.maximumShiftHours < 0.1 || v.maximumShiftHours > 24)) throw Error("Duración máxima de turno inválida.");
  if (v.activityPanelEnabled !== undefined && typeof v.activityPanelEnabled !== "boolean") throw Error("Configuración del panel de actividad inválida.");
  return v;
}
function voiceExempt(member) {
  const rs = roleSet(member);
  return (get().voiceExemptRoleIds || []).some(id => rs.has(id));
}
function roleSet(member) {
  const cached = member?.roles?.cache;
  if (cached?.keys) return new Set(cached.keys());
  const values = member?.roles;
  return new Set(Array.isArray(values) ? values.map((role) => typeof role === "string" ? role : role?.id).filter(Boolean) : []);
}
function allowed(member, kind) {
  const config = get();
  if (member?.permissions?.has?.(8n)) return true;
  const rs = roleSet(member);
  const env =
    kind === "admin"
      ? process.env.ADMIN_ROLE_IDS
      : kind === "police"
        ? process.env.POLICE_ROLE_IDS
        : "";
  const keys =
    kind === "admin"
      ? ["adminRoleIds"]
      : kind === "police"
        ? ["adminRoleIds", "policeRoleIds"]
        : kind === "moderator"
          ? ["adminRoleIds", "moderatorRoleIds"]
          : ["adminRoleIds", "moderatorRoleIds", "staffRoleIds"];
  return [
    ...keys.flatMap((k) => config[k]),
    ...(env || "").split(",").filter(Boolean),
  ].some((r) => rs.has(r));
}
module.exports = { get, validate, allowed, defaults, voiceExempt };
