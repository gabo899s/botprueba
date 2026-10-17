const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const compression = require("compression");
const { root, port, baseUrl, configured, listenHost, allowedHosts, dataDir, secureAuthentication } = require("./lib/config");
const store = require("./lib/store");
const { recordMatchesCitizen, recordBelongsTo } = require("./lib/record-access");
const { identityFilename } = require("./lib/identity-document");
const { mountAdmin } = require("./lib/admin");
const { mountStaff } = require("./lib/staff");
const botSettings = require("./bot/settings");
const { generate } = require("./lib/pdf");
const { limiter, jobGate } = require("./lib/security");
store.init();
const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use((req, res, next) => {
  const hostname = req.hostname;
  if (!allowedHosts.has(hostname?.toLowerCase()))
    return res
      .status(403)
      .json({ success: false, message: "Host no permitido." });
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  if(baseUrl.startsWith('https://'))res.setHeader('Strict-Transport-Security','max-age=31536000');
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https://cdn.discordapp.com https://tr.rbxcdn.com https://anep.cr https://www.nacion.com https://cruzroja.or.cr https://encrypted-tbn0.gstatic.com https://api.dicebear.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
  );
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    if (req.headers.origin && req.headers.origin !== baseUrl)
      return res
        .status(403)
        .json({
          success: false,
          message: "Origen no permitido. Abre " + baseUrl,
        });
    if (req.headers["sec-fetch-site"] === "cross-site")
      return res
        .status(403)
        .json({
          success: false,
          message: "Solicitud de otro sitio rechazada.",
        });
    if (req.headers["x-local-request"] !== "1")
      return res
        .status(403)
        .json({ success: false, message: "Cabecera de solicitud requerida." });
  }
  next();
});
// Los límites se aplican antes de interpretar cuerpos y hacer criptografía.
const loginLimit=limiter({limit:30,windowMs:15*60000});
const oauthLimit=limiter({limit:30,windowMs:60000});
const apiLimit=limiter({limit:300,windowMs:60000});
app.use((req,res,next)=>{
  const key=req.ip;
  const accepted=req.path==='/api/local/login'?loginLimit(key):
    ['/auth/discord','/admin/auth/discord','/auth/roblox'].includes(req.path)?oauthLimit(key):
    req.path.startsWith('/api/')?apiLimit(key):true;
  if(!accepted)return res.status(429).set('Retry-After','60').json({success:false,message:'Demasiadas solicitudes. Espera antes de reintentar.'});
  next();
});
app.use(express.json({ limit: "128kb" }));
app.use(cookieParser());
const { WebSessions, SESSION_MS } = require('./lib/web-sessions');
const sessions = new WebSessions({ directory:dataDir, secret:process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex') }),
  oauth = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) if (v.expires < now) sessions.delete(k);
  for (const [k, v] of oauth) if (v.expires < now) oauth.delete(k);
}, 60000).unref();
function issue(res, user, oauthContext = null) {
  // Rotación de la sesión del navegador: la cookie anterior deja de ser válida.
  try { const prior=jwt.verify(res.req.cookies.session||'',process.env.JWT_SECRET);sessions.delete(prior.sid); } catch {}
  for(const [id,s]of sessions)if(s.expires<=Date.now())sessions.delete(id);
  if(sessions.size>=5000)throw Object.assign(Error('El servidor está ocupado. Inténtalo más tarde.'),{status:503});
  const sid = crypto.randomUUID();
  sessions.set(sid, { user, expires: Date.now() + SESSION_MS, oauth:oauthContext, permissionsChecked:Date.now() });
  res.cookie(
    "session",
    jwt.sign({ sid }, process.env.JWT_SECRET, { expiresIn: "30d" }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: baseUrl.startsWith("https://"),
      maxAge: SESSION_MS,
      path: "/",
    },
  );
}
function discordAdmin(roles,guildId) {
  const configuredGuild=process.env.ADMIN_GUILD_ID || process.env.DISCORD_GUILD_ID;
  return botSettings.allowed({roles},'admin') || (guildId===configuredGuild && (process.env.ADMIN_ROLE_IDS||'').split(',').map(v=>v.trim()).filter(Boolean).some(id=>roles.includes(id)));
}
async function renewDiscordToken(session) {
  if(!session.oauth.tokenExpires || session.oauth.tokenExpires>Date.now()+60000)return;
  if(!session.oauth.refreshToken)throw Object.assign(Error('Inicia sesión de nuevo.'),{status:401});
  try {
    const token=await remote('https://discord.com/api/v10/oauth2/token',{method:'POST',body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:session.oauth.refreshToken})});
    if(!token.access_token)throw Object.assign(Error('Invalid refresh'),{status:401});
    session.oauth.accessToken=token.access_token;session.oauth.refreshToken=token.refresh_token||session.oauth.refreshToken;
    session.oauth.tokenExpires=Date.now()+(Number(token.expires_in)||604800)*1000;
    // Persist rotated refresh tokens even if the following role request fails.
    for(const [id,value] of sessions)if(value===session){sessions.save(id);break;}
  } catch(error) {throw Object.assign(Error('No se pudo renovar la sesión de Discord.'),{status:[400,401,403].includes(error.status)?401:503});}
}
async function refreshPermissions(session,force){
  if(!session.oauth||(!force&&Date.now()-session.permissionsChecked<30000))return;
  if(!session.refreshing)session.refreshing=(async()=>{
    let member;
    await renewDiscordToken(session);
    try{member=await remote(`https://discord.com/api/v10/users/@me/guilds/${session.oauth.guildId}/member`,{headers:{Authorization:'Bearer '+session.oauth.accessToken}});}
    catch(error){if([401,403,404].includes(error.status))throw Object.assign(Error('Inicia sesión de nuevo.'),{status:401});throw Object.assign(Error('No se pudieron verificar tus permisos. Inténtalo de nuevo.'),{status:503});}
    const roles=Array.isArray(member.roles)?member.roles:[];
    const adminPortal=session.oauth.adminPortal;
    session.user.roles=roles;
    session.user.isAdmin=adminPortal?(process.env.ADMIN_ROLE_IDS||'').split(',').map(v=>v.trim()).filter(Boolean).some(id=>roles.includes(id)):discordAdmin(roles,session.oauth.guildId);
    session.user.hasPoliceAccess=!adminPortal&&[...(process.env.POLICE_ROLE_IDS||'').split(',').map(v=>v.trim()).filter(Boolean),...botSettings.get().policeRoleIds].some(id=>roles.includes(id));
    session.permissionsChecked=Date.now();
  })().finally(()=>{session.refreshing=null;});
  await session.refreshing;
}
async function auth(req, res, next, { refresh = true } = {}) {
  if (!secureAuthentication) return res.status(503).json({success:false,message:"Configura HTTPS para iniciar sesión fuera de localhost."});
  try {
    const { sid } = jwt.verify(
      req.cookies.session || "",
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] },
    );
    const s = sessions.get(sid);
    if (!s || s.expires < Date.now() || s.user.mode !== "discord") { sessions.delete(sid); throw Error(); }
    if (refresh) {
      try { await refreshPermissions(s,!['GET','HEAD'].includes(req.method)); }
      catch(error){if(error.status===401)sessions.delete(sid);throw error;}
      if (sessions.get(sid) !== s || s.expires <= Date.now()) throw Error('Sesión cerrada.');
      sessions.save(sid);
    }
    req.user = s.user;
    req.sid = sid;
    res.setHeader("Cache-Control", "private, no-store");
    next();
  } catch (error) {
    return res
      .status(error.status===503?503:401)
      .json({ success: false, message: error.status===503?error.message:"Inicia sesión para continuar." });
  }
}
function assertSession(req) {
  const session=sessions.get(req.sid);
  if(!session || session.expires<=Date.now() || session.user!==req.user || session.user.mode!=='discord')
    throw Object.assign(Error('La sesión se cerró. Inicia sesión de nuevo.'),{status:401});
  return session;
}
function logoutAuth(req, res, next) { return auth(req, res, next, { refresh: false }); }
function police(req, res, next) {
  if (req.user.hasPoliceAccess) return next();
  res
    .status(403)
    .json({
      success: false,
      message: "Tu cuenta no tiene un rol policial autorizado.",
    });
}
function admin(req, res, next) {
  if (req.user.isAdmin) return next();
  res
    .status(403)
    .json({
      success: false,
      message: "Necesitas un rol administrativo de Discord para editar ciudadanos.",
    });
}
function text(v, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function citizenInput(body) {
  const c = {
    numeroCedula: text(body.numeroCedula, 40),
    nombre: text(body.nombre, 80),
    apellidos: text(body.apellidos, 100),
    discordId: text(body.discordId, 20),
    roblox: body.robloxUsername
      ? { username: text(body.robloxUsername, 40) }
      : null,
  };
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(c.numeroCedula) || ["__proto__", "prototype", "constructor"].includes(c.numeroCedula) || !c.nombre)
    throw Error("Cédula de 2 a 40 letras/números y nombre son obligatorios.");
  if (c.discordId && !/^\d{17,20}$/.test(c.discordId))
    throw Error("ID de Discord inválido.");
  return c;
}
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
mountAdmin(app, {
  auth,
  issue,
  publicUser,
  logoutAuth,
  beginOAuth,
  takeState,
  remote,
  wrap,
  text,
  sessions,
});
mountStaff(app, { auth, logoutAuth, wrap, sessions });
require('./lib/citizen-profile').mountCitizenProfile(app,{auth,wrap,sessions,remote,renewDiscordToken,publicUser,assertSession});
require('./lib/citizen-notifications').mountCitizenNotifications(app,{auth,wrap});
require('./lib/citizen-support').mountCitizenSupport(app,{auth,wrap,assertSession});
require('./lib/citizen-modules').mountCitizenModules(app,{auth});
require("./lib/privacy").mountPrivacy(app,{auth,wrap});
app.get(["/legal","/privacidad","/terminos","/cookies","/derechos"],(req,res)=>res.sendFile(path.join(root,"public/legal.html")));
app.get("/health", (req, res) => res.json({ status: "healthy", local: true }));
app.get("/api/config", (req, res) =>
  res.json({
    success: true,
    discordOAuth: !!(
      process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      process.env.DISCORD_GUILD_ID
    ),
    robloxOAuth: !!(
      process.env.ROBLOX_CLIENT_ID && process.env.ROBLOX_CLIENT_SECRET
    ),
    adminOAuth: !!(
      process.env.DISCORD_CLIENT_ID &&
      process.env.DISCORD_CLIENT_SECRET &&
      (process.env.ADMIN_GUILD_ID || process.env.DISCORD_GUILD_ID) &&
      process.env.ADMIN_ROLE_IDS
    ),
  }),
);
app.post("/api/local/login", (req,res) => res.status(410).json({success:false,message:"El acceso con usuario y contraseña se eliminó. Inicia sesión con Discord."}));
function publicUser(u) {
  const c = u.discordId
    ? Object.values(store.read("cedulas")).find(
        (c) => c.discordId === u.discordId,
      )
    : null;
  return {
    ...u,
    nombreCompleto: c
      ? (c.nombre + " " + c.apellidos).trim()
      : u.nombreCompleto,
    trabajo: u.isAdmin ? "Administración" : u.hasPoliceAccess ? "Personal policial" : "Ciudadano",
    roblox: c?.roblox || null,
    robloxLinked: !!c?.roblox?.userId,
    isAdmin: !!u.isAdmin,
    hasStaffAccess:
      !!u.isAdmin ||
      botSettings.allowed({ roles: u.roles }, "staff"),
  };
}
app.get("/api/auth/me", auth, (req, res) =>
  res.json({ success: true, user: publicUser(req.user) }),
);
app.get("/api/profile", auth, (req, res) => {
  const c = req.user.discordId
    ? Object.values(store.read("cedulas")).find(
        (c) => c.discordId === req.user.discordId,
      )
    : null;
  res.json({ success: true, citizen: c ? enriched(c) : null });
});
app.post("/api/auth/logout", logoutAuth, (req, res) => {
  sessions.delete(req.sid);
  res.clearCookie("session", { path: "/" });
  res.json({ success: true });
});
function beginOAuth(req, res, provider, user = null) {
  if (!secureAuthentication) throw Object.assign(Error("Configura HTTPS para iniciar sesión fuera de localhost."),{status:503});
  for(const [id,flow]of oauth)if(flow.expires<=Date.now())oauth.delete(id);
  if(oauth.size>=2000)throw Object.assign(Error('Demasiadas sesiones de acceso pendientes.'),{status:429});
  const state = crypto.randomBytes(32).toString("hex");
  oauth.set(state, {
    provider,
    user,
    sid: req.sid,
    expires: Date.now() + 10 * 60000,
  });
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: baseUrl.startsWith('https://'),
    sameSite: "lax",
    maxAge: 10 * 60000,
    path: "/",
  });
  return state;
}
function takeState(req, res, provider) {
  const state = req.query.state;
  const s = oauth.get(state);
  res.clearCookie("oauth_state", { path: "/" });
  if (
    typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) ||
    !s ||
    s.expires < Date.now() ||
    s.provider !== provider ||
    state !== req.cookies.oauth_state
  )
    throw Error("Sesión OAuth inválida o expirada.");
  oauth.delete(state);
  return s;
}
async function remote(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw Object.assign(Error("El proveedor rechazó la solicitud (" + r.status + ")."),{status:r.status});
  return r.json();
}
app.get("/auth/discord", (req, res) => {
  if (
    !process.env.DISCORD_CLIENT_ID ||
    !process.env.DISCORD_CLIENT_SECRET ||
    !process.env.DISCORD_GUILD_ID
  )
    return res.redirect(
      "/maes-rp?error=" + encodeURIComponent("Configura Discord con npm run setup."),
    );
  const state = beginOAuth(req, res, "discord", {
    returnTo: req.query.returnTo === "staff" ? "/staff" : req.query.returnTo === "citizen" ? "/ciudadano" : "/maes-rp",
  });
  const q = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: baseUrl + "/auth/discord/callback",
    response_type: "code",
    scope: "identify guilds.members.read",
    state,
  });
  res.redirect("https://discord.com/oauth2/authorize?" + q);
});
app.get("/auth/discord/callback", async (req, res) => {
  try {
    const flow = takeState(req, res, "discord");
    if (!req.query.code || req.query.error)
      throw Error("Inicio de sesión cancelado.");
    const t = await remote("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: baseUrl + "/auth/discord/callback",
      }),
    });
    const headers = { Authorization: "Bearer " + t.access_token };
    const u = await remote("https://discord.com/api/v10/users/@me", {
      headers,
    });
    const m = await remote(
      `https://discord.com/api/v10/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
      { headers },
    );
    const allowed = [
      ...(process.env.POLICE_ROLE_IDS || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      ...botSettings.get().policeRoleIds,
    ];
    const c = Object.values(store.read("cedulas")).find(
      (c) => c.discordId === u.id,
    );
    issue(res, {
      id: u.id,
      discordId: u.id,
      nombreCompleto: c
        ? c.nombre + " " + c.apellidos
        : u.global_name || u.username,
      discordUsername: u.username,
      discordAvatar: u.avatar
        ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith("a_")?"gif":"png"}`
        : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id)>>22n)%6n)}.png`,
      mode: "discord",
      isAdmin: discordAdmin(m.roles || [], process.env.DISCORD_GUILD_ID),
      roles: m.roles || [],
      hasPoliceAccess: allowed.some((x) => (m.roles || []).includes(x)),
    }, {accessToken:t.access_token,refreshToken:t.refresh_token,tokenExpires:Date.now()+(Number(t.expires_in)||604800)*1000,guildId:process.env.DISCORD_GUILD_ID,adminPortal:false});
    res.redirect(flow.user?.returnTo || "/maes-rp");
  } catch (e) {
    res.redirect("/maes-rp?error=" + encodeURIComponent(e.message));
  }
});
app.get("/auth/roblox", auth, (req, res) => {
  const returnTo=req.query.returnTo==="citizen"?"/ciudadano":"/v2/police";
  if (!process.env.ROBLOX_CLIENT_ID || !process.env.ROBLOX_CLIENT_SECRET)
    return res.redirect(
      returnTo+"?error=" +
        encodeURIComponent("Configura Roblox con npm run setup."),
    );
  if (!req.user.discordId)
    return res.redirect(
      returnTo+"?error=" +
        encodeURIComponent("Inicia sesión con Discord para vincular Roblox."),
    );
  const state = beginOAuth(req, res, "roblox", {discordId:req.user.discordId,returnTo});
  const q = new URLSearchParams({
    client_id: process.env.ROBLOX_CLIENT_ID,
    redirect_uri: baseUrl + "/auth/roblox/callback",
    response_type: "code",
    scope: "openid profile",
    state,
  });
  res.redirect("https://apis.roblox.com/oauth/v1/authorize?" + q);
});
app.get("/auth/roblox/callback", auth, async (req, res) => {
  let returnTo="/v2/police";
  try {
    const s = takeState(req, res, "roblox");
    returnTo=s.user?.returnTo==="/ciudadano"?"/ciudadano":"/v2/police";
    if (s.sid !== req.sid || s.user?.discordId !== req.user.discordId || !sessions.has(s.sid)) throw Error("La vinculación debe completarse en la misma sesión que la inició.");
    if (!req.query.code || req.query.error)
      throw Error("Vinculación cancelada.");
    const t = await remote("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: req.query.code,
        redirect_uri: baseUrl + "/auth/roblox/callback",
      }),
    });
    const u = await remote("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: "Bearer " + t.access_token },
    });
    assertSession(req);
    const robloxId=String(u.sub||''),username=u.preferred_username||u.name;
    if(!/^[1-9]\d{0,19}$/.test(robloxId)||typeof username!=='string'||!/^[A-Za-z0-9_]{3,20}$/.test(username))throw Error('Roblox devolvió un perfil inválido.');
    let avatarUrl;
    try {const image=new URL(u.picture);if(image.protocol==='https:'&&image.hostname==='tr.rbxcdn.com'&&!image.username&&!image.password)avatarUrl=image.href;}catch{}
    const db = store.read("cedulas");
    const entry = Object.values(db).find(
      (c) => c.discordId === s.user.discordId,
    );
    if (!entry)
      throw Error(
        "El administrador debe registrar primero tu ciudadano e ID de Discord.",
      );
    if (
      Object.values(db).some(
        (c) => c !== entry && String(c.roblox?.userId) === String(u.sub),
      )
    )
      throw Error("Esa cuenta Roblox ya está vinculada.");
    entry.roblox = {
      userId: robloxId,
      username,
      displayName: typeof u.name==="string"?u.name.slice(0,50):username,
      ...(avatarUrl?{avatarUrl}:{}),
      linkedAt: new Date().toISOString(),
    };
    store.write("cedulas", db);
    store.audit(req.user.discordId,"profile.roblox.link",{userId:robloxId});
    res.redirect(returnTo+"?message=Cuenta%20Roblox%20vinculada");
  } catch (e) {
    res.redirect(returnTo+"?error=" + encodeURIComponent(e.message));
  }
});
function enriched(c) {
  const key = c.discordId || c.numeroCedula;
  return {
    ...c,
    vehiculos: store.read("vehiculos")[key] || [],
    licencias: store.read("licencias")[key] || [],
    multas: store.read("multas").filter((r) => recordMatchesCitizen(r, c)),
    arrestos: store
      .read("arrestos")
      .filter((r) => recordMatchesCitizen(r, c)),
  };
}
app.get("/api/citizens", auth, police, (req, res) =>
  res.json({ success: true, citizens: Object.values(store.read("cedulas")) }),
);
app.post("/api/citizens", auth, admin, (req, res, next) => {
  try {
    const c = citizenInput(req.body),
      db = store.read("cedulas");
    if (Object.hasOwn(db,c.numeroCedula))
      return res
        .status(409)
        .json({ success: false, message: "Ya existe esa cédula." });
    if (
      c.discordId &&
      Object.values(db).some((v) => v.discordId === c.discordId)
    )
      return res
        .status(409)
        .json({
          success: false,
          message: "Ese ID de Discord ya está registrado.",
        });
    db[c.numeroCedula] = c;
    store.write("cedulas", db);
    res.json({ success: true, citizen: c });
  } catch (e) {
    e.status = 400;
    next(e);
  }
});
app.put("/api/citizens/:cedula", auth, admin, (req, res, next) => {
  try {
    const db = store.read("cedulas");
    const c = Object.hasOwn(db,req.params.cedula) ? db[req.params.cedula] : null;
    if (!c)
      return res
        .status(404)
        .json({ success: false, message: "Ciudadano no encontrado." });
    const edited = citizenInput({ ...req.body, numeroCedula: c.numeroCedula });
    if (
      edited.discordId &&
      Object.values(db).some((v) => v !== c && v.discordId === edited.discordId)
    )
      return res
        .status(409)
        .json({
          success: false,
          message: "Ese ID de Discord ya está registrado.",
        });
    db[c.numeroCedula] = { ...c, ...edited };
    store.write("cedulas", db);
    res.json({ success: true });
  } catch (e) {
    e.status = 400;
    next(e);
  }
});
app.post("/api/citizens/:cedula/assets", auth, admin, (req, res) => {
  const citizens=store.read("cedulas");
  const c = Object.hasOwn(citizens,req.params.cedula) ? citizens[req.params.cedula] : null;
  if (!c)
    return res
      .status(404)
      .json({ success: false, message: "Ciudadano no encontrado." });
  const key = c.discordId || c.numeroCedula;
  if (req.body.tipo === "vehiculo") {
    const placa = text(req.body.placa, 20),
      modelo = text(req.body.modelo, 80);
    if (!placa || !modelo)
      return res
        .status(400)
        .json({ success: false, message: "Placa y modelo requeridos." });
    const db = store.read("vehiculos");
    db[key] = db[key] || [];
    if (db[key].some((v) => v.placa === placa))
      return res
        .status(409)
        .json({ success: false, message: "Placa ya registrada." });
    db[key].push({ placa, modelo });
    store.write("vehiculos", db);
  } else if (req.body.tipo === "licencia") {
    const tipo = text(req.body.licencia, 20);
    if (!tipo)
      return res
        .status(400)
        .json({ success: false, message: "Tipo de licencia requerido." });
    const db = store.read("licencias");
    db[key] = db[key] || [];
    if (!db[key].some((l) => l.tipo === tipo))
      db[key].push({ tipo, estado: "Activa" });
    store.write("licencias", db);
  } else
    return res.status(400).json({ success: false, message: "Tipo inválido." });
  res.json({ success: true });
});
app.get("/api/search/suggestions", auth, police, (req, res) => {
  const q = text(req.query.q, 100).toLowerCase();
  res.json({
    success: true,
    suggestions:
      q.length < 2
        ? []
        : Object.values(store.read("cedulas"))
            .filter((c) =>
              [
                c.numeroCedula,
                c.nombre,
                c.apellidos,
                c.discordId,
                c.roblox?.username,
              ].some((v) =>
                String(v || "")
                  .toLowerCase()
                  .includes(q),
              ),
            )
            .slice(0, 8),
  });
});
app.get("/api/search", auth, police, (req, res) => {
  const q = text(req.query.q, 100).toLowerCase();
  if (!q)
    return res
      .status(400)
      .json({ success: false, message: "Escribe un término de búsqueda." });
  const vehicles = store.read("vehiculos");
  const c = Object.values(store.read("cedulas")).find(
    (c) =>
      [
        c.numeroCedula,
        c.discordId,
        c.roblox?.username,
        (c.nombre + " " + c.apellidos).trim(),
      ].some((v) => String(v || "").toLowerCase() === q) ||
      (vehicles[c.discordId || c.numeroCedula] || []).some(
        (v) => v.placa.toLowerCase() === q,
      ),
  );
  if (!c)
    return res
      .status(404)
      .json({ success: false, message: "Ciudadano no encontrado." });
  res.json({ success: true, data: enriched(c) });
});
const documentGate = jobGate();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (["image/png", "image/jpeg"].includes(file.mimetype))
      return cb(null, true);
    const e = Error("Solo se admite evidencia PNG o JPEG.");
    e.status = 400;
    cb(e);
  },
});
const idempotency = new Map();
setInterval(() => {
  for (const [k, v] of idempotency)
    if (v.at < Date.now() - 86400000) idempotency.delete(k);
}, 60000).unref();
async function register(req, res, type) {
  const requestId = req.headers["x-request-id"];
  if (!requestId || !/^[\w-]{10,80}$/.test(requestId))
    return res
      .status(400)
      .json({
        success: false,
        message: "Identificador de solicitud requerido.",
      });
  const key = type + ":" + req.user.id + ":" + requestId;
  const saved = store
    .read(type === "multa" ? "multas" : "arrestos")
    .find(
      (r) =>
        r.requestId === requestId &&
        r.oficialId === (req.user.discordId || req.user.id),
    );
  if (saved) return res.json({ success: true, record: saved });
  if (idempotency.has(key)) {
    const prior = idempotency.get(key);
    if (prior.record) return res.json({ success: true, record: prior.record });
    return res
      .status(409)
      .json({
        success: false,
        message: "La solicitud aún se está procesando.",
      });
  }
  const documento = text(req.body.documento, 40),
    articulos = text(req.body.articulos, 1500);
  const citizens=store.read("cedulas");
  const c = Object.hasOwn(citizens,documento) ? citizens[documento] : null;
  if (!c || !articulos)
    return res
      .status(400)
      .json({
        success: false,
        message: "Selecciona un ciudadano registrado y escribe los artículos.",
      });
  const raw = type === "multa" ? req.body.valor : req.body.tiempo;
  const n = Number(raw);
  if (
    raw === undefined ||
    raw === "" ||
    !Number.isFinite(n) ||
    n <= 0 ||
    n > 100000000 ||
    (type === "arresto" && !Number.isInteger(n))
  )
    return res
      .status(400)
      .json({
        success: false,
        message:
          type === "multa"
            ? "Monto positivo válido requerido."
            : "Sentencia entera positiva requerida.",
      });
  idempotency.set(key, { at: Date.now() });
  const r = {
    id: type + "_" + crypto.randomUUID(),
    requestId,
    documento,
    ciudadano: (c.nombre + " " + c.apellidos).trim(),
    userId: c.discordId || null,
    oficialId: req.user.discordId || req.user.id,
    oficialNombre: req.user.nombreCompleto,
    articulos,
    fecha: new Date().toLocaleString("es-CR", {
      timeZone: "America/Costa_Rica",
    }),
    createdAt: new Date().toISOString(),
    estado: type === "multa" ? "REGISTRADA" : "REGISTRADO",
    ...(type === "multa"
      ? { monto: Math.round(n * 100) / 100, placa: text(req.body.placa, 20) }
      : { tiempo: n }),
  };
  try {
    if (req.file) {
      const b = req.file.buffer;
      const png =
        b.length > 8 &&
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpg = b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
      if (!png && !jpg) {
        const e = Error("La evidencia debe ser un PNG o JPEG real.");
        e.status = 400;
        throw e;
      }
      r.imagenFileName = r.id + (png ? ".png" : ".jpg");
      fs.writeFileSync(path.join(root, "public/uploads", r.imagenFileName), b, {
        mode: 0o600,
      });
      r.imagenUrl = "/uploads/" + r.imagenFileName;
    }
    const file = await generate(type, r);
    r.pdfFileName = file;
    r.pdfUrl = "/pdfs/" + file;
    const name = type === "multa" ? "multas" : "arrestos";
    const records = store.read(name);
    records.push(r);
    store.write(name, records);
    try {
      store.queue(type, r);
      r.notificationPending = true;
    } catch (e) {
      r.notificationPending = false;
      r.notificationError =
        "Registro guardado; no se pudo crear la notificación. Revisa permisos y usa Reintentar.";
      console.error(r.notificationError);
    }
    idempotency.set(key, { at: Date.now(), record: r });
    res.json({ success: true, record: r });
  } catch (e) {
    idempotency.delete(key);
    if (r.imagenFileName)
      fs.rmSync(path.join(root, "public/uploads", r.imagenFileName), {
        force: true,
      });
    fs.rmSync(path.join(root, "public/pdfs", r.id + ".pdf"), { force: true });
    throw e;
  }
}
app.post(
  "/api/multa",
  auth,
  police,
  documentGate,
  wrap((req, res) => req.runDocumentJob(() => register(req, res, "multa"))),
);
app.post(
  "/api/arresto",
  auth,
  police,
  documentGate,
  upload.single("foto"),
  wrap((req, res) => req.runDocumentJob(() => register(req, res, "arresto"))),
);
app.get("/api/records", auth, police, (req, res) =>
  res.json({
    success: true,
    multas: store.read("multas").slice().reverse(),
    arrestos: store.read("arrestos").slice().reverse(),
  }),
);
app.get("/api/bot/status", auth, police, (req, res) => {
  let bot = null;
  const f = path.join(root, "bot/data/status.json");
  if (fs.existsSync(f)) {
    try {
      bot = JSON.parse(fs.readFileSync(f, "utf8"));
      if (Date.now() - bot.timestamp > 45000) bot = { ...bot, online: false };
    } catch {}
  }
  res.json({
    success: true,
    configured: !!process.env.DISCORD_TOKEN,
    channels: {
      multa: !!process.env.MULTA_CHANNEL_ID,
      arresto: !!process.env.ARRESTO_CHANNEL_ID,
    },
    bot,
    queue: store.stats(),
  });
});
app.post("/api/notifications/retry", auth, admin, (req, res) => {
  let count = 0;
  for (const name of fs
    .readdirSync(path.join(root, "bot/data/errors"))
    .filter((n) => n.endsWith(".json"))) {
    const f = path.join(root, "bot/data/errors", name);
    const n = JSON.parse(fs.readFileSync(f, "utf8"));
    store.atomic(path.join(root, "bot/data/notifications", name), {
      ...n,
      attempts: 0,
      nextAttempt: 0,
    });
    fs.unlinkSync(f);
    count++;
  }
  // Recuperar registros cuya notificación no llegó a escribirse.
  for (const type of ["multa", "arresto"])
    for (const r of store.read(type === "multa" ? "multas" : "arrestos"))
      if (
        !["notifications", "processed", "errors"].some((d) =>
          fs.existsSync(path.join(root, "bot/data", d, r.id + ".json")),
        )
      ) {
        store.queue(type, r);
        count++;
      }
  res.json({ success: true, count });
});
function fileAccess(directory) {
  return (req, res, next) => {
    // Autorizar el mismo nombre que express.static decodifica al servir el archivo.
    // Se rechazan subdirectorios y dobles escapes para evitar aliases de rutas.
    let filename;
    try {
      const pathname = decodeURIComponent(req.path);
      filename = pathname.slice(1);
      const pattern = directory === "pdfs"
        ? /^[A-Za-z0-9_-]+\.pdf$/
        : /^[A-Za-z0-9_-]+\.(?:png|jpg|jpeg|html)$/;
      if (pathname !== "/" + filename || !pattern.test(filename)) throw Error();
    } catch {
      return res.status(400).json({success:false,message:"Ruta de archivo inválida."});
    }
    const tickets = Object.values(store.read("tickets").items || {});
    const ticket = directory === "uploads" && tickets.find(t => t.transcriptFile === filename);
    if (ticket) {
      if (req.user.isAdmin || botSettings.allowed({roles:req.user.roles}, "staff") || ticket.userId === req.user.discordId) return next();
      return res.status(403).json({success:false,message:"No tienes acceso a esta conversación."});
    }
    const citizens = Object.values(store.read("cedulas"));
    const citizen = citizens.find(c => c?.discordId && c.discordId === req.user.discordId);
    const identity = directory === "pdfs" && citizens.find(c => { try { return filename === identityFilename(c); } catch { return false; } });
    const field = directory === "pdfs" ? "pdfFileName" : "imagenFileName";
    const records = [...store.read("multas"), ...store.read("arrestos")].filter(r => r[field] === filename);
    const mine = (identity && identity === citizen) || records.some(r =>
      recordBelongsTo(r,req.user.discordId,new Set(citizen ? [citizen.numeroCedula] : [])));
    // Un archivo huérfano, una transcripción sin ticket o un archivo de otra
    // categoría no heredan el acceso policial general a documentos registrados.
    if (mine || req.user.hasPoliceAccess && (identity || records.length)) return next();
    return res.status(403).json({success:false,message:"No tienes acceso a este archivo."});
  };
}
for (const d of ["pdfs", "uploads"])
  app.use(
    "/" + d,
    auth,
    fileAccess(d),
    express.static(path.join(root, "public", d), {
      dotfiles: "deny",
      maxAge: 0,
      setHeaders: (res) => res.setHeader("Cache-Control", "private, no-store"),
    }),
  );
app.get("/police-tools", (req, res) =>
  res.sendFile(path.join(root, "public/police-tools.html")),
);
app.get(["/v2/police", "/v2/police/dashboard", "/police.html"], (req, res) =>
  res.sendFile(path.join(root, "public/police.html")),
);
app.get(["/v1/login", "/v1/dashboard"], (req, res) =>
  res.redirect("/v2/police"),
);
for (const d of ["css", "js", "images", "fonts", "webfonts"])
  app.use("/" + d, express.static(path.join(root, "public", d)));
app.get(["/maes-rp", "/maes-rp/", "/maes-rp.html"], (req, res) =>
  res.sendFile(path.join(root, "public/maes-rp.html")),
);
app.get(["/", "/index.html"], (req, res) =>
  res.sendFile(path.join(root, "public/index.html")),
);
app.use((req, res) => {
  if (req.path.startsWith("/api/"))
    return res
      .status(404)
      .json({ success: false, message: "Ruta no encontrada." });
  res.status(404).sendFile(path.join(root, "public/404.html"));
});
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  if (res.headersSent) return next(err);
  const status = err instanceof multer.MulterError ? 400 : err.status || 500;
  if (req.path.startsWith("/api/"))
    return res
      .status(status)
      .json({
        success: false,
        message:
          status === 500 ? "Error interno. Revisa la terminal." : err.message,
      });
  res.status(status).sendFile(path.join(root, "public/500.html"));
});
function startServer() {
  if (!configured()) {
    console.error("Primero ejecuta npm run setup");
    process.exit(1);
  }
  const server = app.listen(port, listenHost, () =>
    console.log(`Web lista: ${baseUrl}`),
  );
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  server.on("error", (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? `Puerto ${port} ocupado. Cambia el puerto con npm run setup.`
        : e.message,
    );
    process.exit(1);
  });
  return server;
}
app.startServer = startServer;
if (require.main === module) startServer();
module.exports = app;
