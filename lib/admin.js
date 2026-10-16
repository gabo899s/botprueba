const path = require("node:path");
const crypto = require("node:crypto");
const { root, baseUrl } = require("./config");
const store = require("./store");
function mountAdmin(
  app,
  {
    auth,
    issue,
    publicUser,
    beginOAuth,
    takeState,
    remote,
    wrap,
    text,
    sessions,
  },
) {
  function staffRecords() { return store.read("infostaff") || {}; }
  function allowed(req, res, next) {
    if (!req.user) return res.status(401).json({success:false,message:"Inicia sesión."});
    if (req.user.mode === "local" || req.user.isAdmin) return next();
    return res
      .status(403)
      .json({
        success: false,
        message:
          "Necesitas acceso administrativo. Un rol policial no concede acceso a staff.",
      });
  }
  function detail(id) {
    const staff = staffRecords()[id];
    if (!staff) return null;
    const sanctions = store.read("sanciones") || {};
    const made = Object.values(sanctions)
      .flatMap((v) =>
        Array.isArray(v?.sanctions)
          ? v.sanctions.filter((s) => s.moderadorId === id)
          : [],
      )
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return {
      ...staff,
      discordId: id,
      sancionesHechas: made,
      actividad: store.read("horasactividad")?.[id] || null,
      calificaciones: store.read("calificaciones_staff")?.[id] || null,
      tickets: store.read("tickets")?.stats?.[id] || null,
    };
  }
  function validId(value) {
    return typeof value === "string" && /^\d{17,20}$/.test(value);
  }
  function fields(b) {
    const r = {
      discordId: text(b.discordId, 20),
      nombre: text(b.nombre, 100),
      discordUsername: text(b.discordUsername, 60),
      placa: text(b.placa, 30),
      rango: text(b.rango, 60),
      estado: text(b.estado, 20) || "Activo",
    };
    if (!validId(r.discordId) || !r.nombre) {
      const e = Error("Nombre e ID Discord de 17 a 20 dígitos requeridos.");
      e.status = 400;
      throw e;
    }
    if (!["Activo", "Inactivo"].includes(r.estado)) {
      const e = Error("Estado inválido.");
      e.status = 400;
      throw e;
    }
    return r;
  }
  app.get(["/admin", "/admin.html"], (req, res) =>
    res.sendFile(path.join(root, "public/admin.html")),
  );
  app.get("/admin/auth/discord", (req, res) => {
    if (
      !process.env.DISCORD_CLIENT_ID ||
      !process.env.DISCORD_CLIENT_SECRET ||
      !process.env.ADMIN_GUILD_ID ||
      !process.env.ADMIN_ROLE_IDS
    )
      return res.redirect(
        "/admin?error=" +
          encodeURIComponent(
            "Configura el servidor y roles administrativos con configurar-linux.sh.",
          ),
      );
    const state = beginOAuth(req, res, "admin");
    const q = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: baseUrl + "/admin/auth/discord/callback",
      response_type: "code",
      scope: "identify guilds.members.read",
      state,
    });
    res.redirect("https://discord.com/oauth2/authorize?" + q);
  });
  app.get("/admin/auth/discord/callback", async (req, res) => {
    try {
      takeState(req, res, "admin");
      if (!req.query.code || req.query.error) throw Error("Acceso cancelado.");
      const t = await remote("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code: req.query.code,
          redirect_uri: baseUrl + "/admin/auth/discord/callback",
        }),
      });
      const headers = { Authorization: "Bearer " + t.access_token };
      const u = await remote("https://discord.com/api/v10/users/@me", {
        headers,
      });
      const m = await remote(
        `https://discord.com/api/v10/users/@me/guilds/${process.env.ADMIN_GUILD_ID}/member`,
        { headers },
      );
      const roles = (process.env.ADMIN_ROLE_IDS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!roles.length || !roles.some((r) => (m.roles || []).includes(r)))
        throw Error("Tu cuenta no tiene un rol administrativo autorizado.");
      issue(res, {
        id: u.id,
        discordId: u.id,
        discordUsername: u.username,
        nombreCompleto: u.global_name || u.username,
        discordAvatar: u.avatar
          ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`
          : null,
        mode: "discord",
        isAdmin: true,
        hasPoliceAccess: false,
        roles: m.roles || [],
      }, {accessToken:t.access_token,guildId:process.env.ADMIN_GUILD_ID,adminPortal:true});
      res.redirect("/admin");
    } catch (e) {
      res.redirect("/admin?error=" + encodeURIComponent(e.message));
    }
  });
  app.get("/api/admin/auth/me", auth, allowed, (req, res) =>
    res.json({ success: true, user: publicUser(req.user) }),
  );
  app.post("/api/admin/auth/logout", auth, allowed, (req, res) => {
    sessions.delete(req.sid);
    res.clearCookie("session", { path: "/" });
    res.json({ success: true });
  });
  app.get("/api/admin/staff", auth, allowed, (req, res) =>
    res.json({ success: true, staff: Object.values(staffRecords()) }),
  );
  app.get("/api/admin/summary", auth, allowed, (req, res) => {
    const staff = Object.values(staffRecords());
    const hours = store.read("horasactividad") || {};
    const total = staff.reduce(
      (sum, s) => sum + (Number(hours[s.discordId]?.horas) || 0),
      0,
    );
    res.json({
      success: true,
      total: staff.length,
      activos: staff.filter((s) => s.estado === "Activo").length,
      horas: total,
    });
  });
  app.get("/api/admin/search", auth, allowed, (req, res) => {
    const q = text(req.query.q, 100).toLowerCase();
    if (!q)
      return res
        .status(400)
        .json({
          success: false,
          message: "Escribe un nombre, placa o ID Discord.",
        });
    const all = Object.values(staffRecords());
    const matches = all.filter((s) =>
      [s.discordId, s.nombre, s.discordUsername, s.placa].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(q),
      ),
    );
    res.json({
      success: true,
      results: matches,
      data: matches.length === 1 ? detail(matches[0].discordId) : null,
    });
  });
  app.get("/api/admin/staff/:discordId", auth, allowed, (req, res) => {
    const result = detail(req.params.discordId);
    if (!result)
      return res
        .status(404)
        .json({ success: false, message: "Miembro del staff no encontrado." });
    res.json({ success: true, data: result });
  });
  app.post(
    "/api/admin/staff",
    auth,
    allowed,
    wrap(async (req, res) => {
      const s = fields(req.body),
        db = staffRecords();
      if (db[s.discordId])
        return res
          .status(409)
          .json({ success: false, message: "Ya existe ese ID Discord." });
      s.createdAt = new Date().toISOString();
      db[s.discordId] = s;
      store.write("infostaff", db);
      res.json({ success: true, data: s });
    }),
  );
  app.put(
    "/api/admin/staff/:discordId",
    auth,
    allowed,
    wrap(async (req, res) => {
      const db = staffRecords();
      if (!db[req.params.discordId])
        return res
          .status(404)
          .json({ success: false, message: "Staff no encontrado." });
      const s = fields({ ...req.body, discordId: req.params.discordId });
      db[s.discordId] = {
        ...db[s.discordId],
        ...s,
        updatedAt: new Date().toISOString(),
      };
      store.write("infostaff", db);
      res.json({ success: true, data: db[s.discordId] });
    }),
  );
  app.post(
    "/api/admin/staff/:discordId/metrics",
    auth,
    allowed,
    wrap(async (req, res) => {
      const id = req.params.discordId;
      if (!staffRecords()[id])
        return res
          .status(404)
          .json({ success: false, message: "Staff no encontrado." });
      const b = req.body,
        fecha = new Date().toISOString(),
        by = req.user.discordId || req.user.id;
      function number(value, max, integer = false) {
        const n = Number(value);
        if (
          value === "" ||
          value === undefined ||
          value === null ||
          !Number.isFinite(n) ||
          n < 0 ||
          n > max ||
          (integer && !Number.isInteger(n))
        ) {
          const e = Error("Valor numérico inválido.");
          e.status = 400;
          throw e;
        }
        return n;
      }
      if (b.tipo === "actividad") {
        const db = store.read("horasactividad");
        db[id] = {
          horas: number(b.horas, 1000000),
          actualizado: fecha,
          registradoPor: by,
        };
        store.write("horasactividad", db);
      } else if (b.tipo === "calificacion") {
        const nota = number(b.nota, 5);
        if (nota < 1) {
          const e = Error("La nota debe estar entre 1 y 5.");
          e.status = 400;
          throw e;
        }
        const db = store.read("calificaciones_staff");
        if (db[id] && !Array.isArray(db[id]))
          return res
            .status(409)
            .json({
              success: false,
              message:
                "El formato importado de calificaciones necesita conversión antes de añadir notas.",
            });
        db[id] = db[id] || [];
        db[id].push({
          id: crypto.randomUUID(),
          nota,
          comentario: text(b.comentario, 1000),
          evaluador: by,
          fecha,
        });
        store.write("calificaciones_staff", db);
      } else if (b.tipo === "tickets") {
        const atendidos = number(b.atendidos, 10000000, true),
          cerrados = number(b.cerrados, 10000000, true);
        if (cerrados > atendidos) {
          const e = Error(
            "Los tickets cerrados no pueden superar los atendidos.",
          );
          e.status = 400;
          throw e;
        }
        const db = store.read("tickets");
        db.stats = db.stats || {};
        db.stats[id] = {
          atendidos,
          cerrados,
          actualizado: fecha,
          registradoPor: by,
        };
        store.write("tickets", db);
      } else if (b.tipo === "sancion") {
        const target = text(b.usuarioId, 20),
          motivo = text(b.motivo, 1000),
          tipo = text(b.sancion, 80);
        if (!validId(target) || !motivo || !tipo) {
          const e = Error("Usuario sancionado, tipo y motivo requeridos.");
          e.status = 400;
          throw e;
        }
        const db = store.read("sanciones");
        db[target] = db[target] || { sanctions: [] };
        db[target].sanctions = db[target].sanctions || [];
        db[target].sanctions.push({
          id: crypto.randomUUID(),
          usuarioId: target,
          moderadorId: id,
          tipo,
          motivo,
          fecha,
          registradoPor: by,
        });
        store.write("sanciones", db);
      } else
        return res
          .status(400)
          .json({ success: false, message: "Tipo de registro inválido." });
      res.json({ success: true, data: detail(id) });
    }),
  );
}
module.exports = { mountAdmin };
