const path = require("node:path"),
  fs = require("node:fs");
const { root } = require("./config"),
  store = require("./store"),
  domain = require("../bot/domain"),
  settings = require("../bot/settings"),
  operations = require("../bot/operations");
function mountStaff(app, { auth, logoutAuth = auth, wrap, sessions }) {
  function actor(req) {
    const u = req.user;
    if (!u || !(u.discordId || u.id)) throw domain.error("Inicia sesión.", 401);
    return {
      id: u.discordId || u.id,
      name: u.nombreCompleto,
      local: false,
      admin:
        u.isAdmin ||
        settings.allowed({ roles: u.roles }, "admin"),
      staff: u.isAdmin || settings.allowed({ roles: u.roles }, "staff"),
      moderator: u.isAdmin || settings.allowed({ roles: u.roles }, "moderator"),
      police: u.hasPoliceAccess,
    };
  }
  function staff(req, res, next) {
    try {
      domain.requireScope(actor(req), "staff");
      next();
    } catch (e) {
      next(e);
    }
  }
  function admin(req, res, next) {
    try {
      domain.requireScope(actor(req), "admin");
      next();
    } catch (e) {
      next(e);
    }
  }
  // Administrative access does not grant a police role in the web portal.
  // Domain helpers also serve bot commands, where administrators may override
  // scopes; enforce the web portal's distinct police permission before them.
  function police(req, res, next) {
    if (req.user?.hasPoliceAccess) return next();
    res.status(403).json({
      success: false,
      message: "Tu cuenta no tiene un rol policial autorizado.",
    });
  }
  function runtime() {
    return require("../bot/runtime");
  }
  app.get(["/config", "/config.html"], (req, res) =>
    res.sendFile(path.join(root, "public/config.html")),
  );
  app.get(["/staff", "/staff.html"], (req, res) =>
    res.sendFile(path.join(root, "public/staff.html")),
  );
  app.get(["/ciudadano", "/citizen.html"], (req, res) =>
    res.sendFile(path.join(root, "public/citizen.html")),
  );
  app.get("/staff/auth/discord", (req, res) =>
    res.redirect("/auth/discord?returnTo=staff"),
  );
  app.get("/api/staff/me", auth, staff, (req, res) => {
    const a = actor(req);
    res.json({
      success: true,
      user: { ...req.user, id: a.id, isAdmin: !!(a.local || a.admin) },
      shift: domain.shiftInfo(a),
      loa: store.read("loa").filter((l) => l.userId === a.id),
      sanctions: domain.sanctions(a.id),
    });
  });
  app.post("/api/staff/auth/logout", logoutAuth, (req, res) => {
    sessions.delete(req.sid);
    res.clearCookie("session", { path: "/" });
    res.json({ success: true });
  });
  app.get(
    "/api/staff/shift/:id",
    auth,
    staff,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: domain.shiftInfo(actor(req), req.params.id),
      }),
    ),
  );
  app.post(
    "/api/staff/shift/toggle",
    auth,
    staff,
    wrap(async (req, res) => {
      const a = actor(req),
        rt = runtime(),
        member = rt.client?.guilds.cache
          .get(process.env.DISCORD_GUILD_ID)
          ?.members.cache.get(a.id);
      a.voiceOk =
        !!member?.voice?.channelId &&
        (!settings.get().channels.voiceActivity ||
          member.voice.channelId === settings.get().channels.voiceActivity);
      res.json({ success: true, data: domain.shift(a, req.body.action) });
    }),
  );
  app.get("/api/staff/loa", auth, staff, (req, res) => {
    const a = actor(req);
    res.json({
      success: true,
      items: store
        .read("loa")
        .filter((l) => a.local || a.admin || l.userId === a.id),
    });
  });
  app.post(
    "/api/staff/loa/solicitar",
    auth,
    staff,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: domain.requestLoa(
          actor(req),
          req.body.reason,
          req.body.start,
          req.body.end,
        ),
      }),
    ),
  );
  app.post(
    "/api/staff/loa/:id/decision",
    auth,
    admin,
    wrap(async (req, res) => {
      if (typeof req.body.approve !== "boolean")
        throw domain.error("Decisión inválida.");
      res.json({
        success: true,
        data: domain.decideLoa(actor(req), req.params.id, req.body.approve),
      });
    }),
  );
  app.get("/api/staff/search/discord", auth, staff, (req, res) => {
    const q = domain.text(req.query.q, 100).toLowerCase();
    const people = Object.values(store.read("cedulas"))
      .filter((c) =>
        [c.discordId, c.nombre, c.apellidos, c.numeroCedula].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(q),
        ),
      )
      .slice(0, 20);
    res.json({ success: true, results: people });
  });
  app.get(
    "/api/staff/search/roblox",
    auth,
    staff,
    wrap(async (req, res) => {
      const q = domain.text(req.query.q, 40);
      if (!/^[A-Za-z0-9_]{3,20}$/.test(q))
        throw domain.error("Escribe un nombre Roblox exacto.");
      const response = await fetch(
        "https://users.roblox.com/v1/usernames/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usernames: [q], excludeBannedUsers: false }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        throw domain.error("Roblox no pudo completar la búsqueda.", 502);
      const body = await response.json();
      const results = (body.data || []).map((u) => ({
        ...u,
        citizen:
          Object.values(store.read("cedulas")).find(
            (c) => String(c.roblox?.userId) === String(u.id),
          ) || null,
      }));
      res.json({ success: true, results });
    }),
  );
  app.get("/api/staff/user/sanciones/:id", auth, staff, (req, res) =>
    res.json({
      success: true,
      sanctions: domain.sanctions(req.params.id),
      bans: store.read("bans").filter((b) => b.userId === req.params.id),
    }),
  );
  app.post(
    "/api/staff/sancionar",
    auth,
    staff,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: domain.sanction(
          actor(req),
          req.body.userId,
          req.body.motivo,
          req.body.tipo === "advertencia" ? "advertencia" : "sancion",
        ),
      }),
    ),
  );
  app.post(
    "/api/staff/sanctions/:user/:id/approve-punishment",
    auth,
    admin,
    wrap(async (req, res) =>
      res.json(
        await operations.approvePunishment(
          actor(req),
          req.params.user,
          req.params.id,
          runtime().prc,
        ),
      ),
    ),
  );
  app.put(
    "/api/staff/sanctions/:user/:id",
    auth,
    admin,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: domain.editSanction(
          actor(req),
          req.params.user,
          req.params.id,
          req.body.motivo,
        ),
      }),
    ),
  );
  app.delete(
    "/api/staff/sanctions/:user/:id",
    auth,
    admin,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: domain.editSanction(
          actor(req),
          req.params.user,
          req.params.id,
          "",
          true,
        ),
      }),
    ),
  );
  app.post(
    "/api/staff/sanctions/:user/:id/appeal",
    auth,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: domain.appeal(
          actor(req),
          req.params.user,
          req.params.id,
          req.body.reason,
        ),
      }),
    ),
  );
  app.post(
    "/api/staff/sanctions/:user/:id/decision",
    auth,
    admin,
    wrap(async (req, res) => {
      if (typeof req.body.accept !== "boolean")
        throw domain.error("Decisión inválida.");
      res.json({
        success: true,
        data: domain.decideAppeal(
          actor(req),
          req.params.user,
          req.params.id,
          req.body.accept,
        ),
      });
    }),
  );
  app.post(
    "/api/staff/banear",
    auth,
    staff,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: await operations.ban(
          actor(req),
          req.body.userId,
          req.body.roblox,
          req.body.motivo,
          req.body.dias,
          runtime().prc,
        ),
      }),
    ),
  );
  app.post(
    "/api/staff/desbanear",
    auth,
    staff,
    wrap(async (req, res) =>
      res.json(
        await operations.unban(actor(req), req.body.roblox, runtime().prc),
      ),
    ),
  );
  app.get("/api/staff/recent", auth, staff, (req, res) =>
    res.json({
      success: true,
      sanctions: Object.values(store.read("sanciones"))
        .flatMap((v) => v.sanctions || [])
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 100),
      bans: store.read("bans").slice().reverse().slice(0, 100),
      ranking: domain.ranking(),
    }),
  );
  app.get("/api/profile/sanctions", auth, (req, res) =>
    res.json({
      success: true,
      sanctions: domain.sanctions(actor(req).id),
      bans: store.read("bans").filter((b) => b.userId === actor(req).id),
    }),
  );
  app.post(
    "/api/profile/payments",
    auth,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: operations.requestPayment(actor(req), req.body.id),
      }),
    ),
  );
  app.post(
    "/api/police/payments/:id/confirm",
    auth,
    police,
    wrap(async (req, res) =>
      res.json({
        success: true,
        data: operations.confirmPayment(
          actor(req),
          req.params.id,
          req.body.reference,
        ),
      }),
    ),
  );
  app.get("/api/bot/settings", auth, admin, (req, res) =>
    res.json({ success: true, settings: settings.get() }),
  );
  app.put(
    "/api/bot/settings",
    auth,
    admin,
    wrap(async (req, res) => {
      let validated;
      try {
        validated = settings.validate(req.body);
      } catch (e) {
        e.status = 400;
        throw e;
      }
      store.write("settings", validated);
      store.audit(actor(req).id, "settings.update");
      res.json({ success: true });
    }),
  );
  app.get(
    "/api/erlc/status",
    auth,
    staff,
    wrap(async (req, res) =>
      res.json({ success: true, data: await runtime().prc.status() }),
    ),
  );
  app.get("/api/tickets", auth, (req, res) => {
    const a = actor(req);
    res.json({
      success: true,
      items: Object.values(store.read("tickets").items || {}).filter(
        (t) => a.local || a.admin || a.staff || t.userId === a.id,
      ),
    });
  });
  app.get(
    "/api/tickets/:id/transcript",
    auth,
    wrap(async (req, res) => {
      const t = store.read("tickets").items?.[req.params.id],
        a = actor(req);
      if (!t) throw domain.error("Ticket no encontrado.", 404);
      if (t.userId !== a.id) domain.requireScope(a, "staff");
      if (
        !t.transcriptFile ||
        path.basename(t.transcriptFile) !== t.transcriptFile
      )
        throw domain.error("No hay transcripción.", 404);
      res.download(
        path.join(root, "public/uploads", t.transcriptFile),
        t.transcriptFile,
      );
    }),
  );
}
module.exports = { mountStaff };
