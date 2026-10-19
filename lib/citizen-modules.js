const DEFINITIONS = Object.freeze([
  { id: "store", title: "Tienda", description: "La tienda ciudadana estará disponible cuando se habiliten el catálogo y las compras del servidor." },
  { id: "assets", title: "Patrimonio", description: "Consulta tus vehículos y licencias actuales, filtra sus estados y solicita la revisión de una renovación." },
  { id: "housing", title: "Casa", description: "El catálogo de viviendas y la gestión de propiedades todavía no están habilitados." },
  { id: "transactions", title: "Transacciones", description: "Consulta el saldo del proveedor configurado, paga multas del rol y descarga comprobantes. Los cobros inciertos requieren revisión." },
  { id: "trades", title: "Tradeos", description: "Los intercambios entre ciudadanos todavía no están disponibles en la web." },
  { id: "ck", title: "CK", description: "Las solicitudes de CK se tramitan con el staff. Esta sección no elimina personajes ni modifica su expediente." },
  { id: "dot", title: "DOT", roleVariable: "DOT_ROLE_IDS", description: "Tu rol permite ver esta sección. El panel del departamento DOT está en preparación." },
  { id: "fire", title: "Fire Dept.", roleVariable: "FIRE_ROLE_IDS", description: "Tu rol permite ver esta sección. El panel de bomberos está en preparación." },
  { id: "gangs", title: "Bandas", roleVariable: "GANG_ROLE_IDS", description: "Tu rol permite ver esta sección. El panel de bandas está en preparación." },
]);

function citizenModules(user, env = process.env) {
  const roles = new Set(Array.isArray(user?.roles) ? user.roles.filter((role) => typeof role === "string") : []);
  return DEFINITIONS.filter((module) => {
    if (!module.roleVariable) return true;
    const configured = String(env[module.roleVariable] || "").split(",").map((id) => id.trim()).filter((id) => /^\d{17,20}$/.test(id));
    return configured.some((id) => roles.has(id));
  }).map(({ id, title, description, roleVariable }) => ({ id, title, description, status: ["assets","transactions"].includes(id) ? "available" : "pending", restricted: !!roleVariable }));
}

function mountCitizenModules(app, { auth }) {
  app.get("/api/profile/modules", auth, (req, res) => {
    // Authorization always comes from the server-verified Discord membership.
    // Department roles deliberately have no administrator override.
    if (!req.user) return res.status(401).json({ success: false, message: "Inicia sesión con Discord." });
    res.set("Cache-Control", "no-store");
    res.json({ success: true, modules: citizenModules(req.user) });
  });
}

module.exports = { citizenModules, mountCitizenModules };
