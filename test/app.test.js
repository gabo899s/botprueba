const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { scryptSync } = require("node:crypto");
const source = path.resolve(__dirname, "..");
let dir,
  child,
  url,
  cookie,
  logs = "";
async function request(
  route,
  { method = "GET", body, headers = {}, session = true } = {},
) {
  const response = await fetch(url + route, {
    method,
    headers: {
      "X-Local-Request": "1",
      ...(session && cookie ? { Cookie: cookie } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...headers,
    },
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
    redirect: "manual",
  });
  return response;
}
async function data(r) {
  return r.json();
}
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "maesrp-test-"));
  for (const f of ["server.js", "lib", "public", "bot"])
    fs.cpSync(path.join(source, f), path.join(dir, f), { recursive: true });
  const port = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
  url = "http://localhost:" + port;
  const salt = "test-salt",
    hash = scryptSync("prueba-local-123", salt, 64).toString("hex");
  const bootstrap =
    "global.fetch=async(url,options={})=>({ok:true,status:200,json:async()=>url.endsWith('/oauth2/token')?{access_token:options.body.get('code')==='admin-test-code'?'test-admin-access':'test-access'}:url.endsWith('/users/@me')?{id:'123456789012345678',username:'test-citizen',global_name:'Ciudadano'}:{roles:url.includes('/guilds/test-admin-guild/member')&&options.headers.Authorization==='Bearer test-admin-access'?['test-admin-role']:[]}});const app=require('./server');app.listen(Number(process.env.PORT),'127.0.0.1',()=>console.log('Web lista'));";
  child = spawn(process.execPath, ["-e", bootstrap], {
    cwd: dir,
    env: {
      ...process.env,
      NODE_PATH: path.join(source, "node_modules"),
      PORT: String(port),
      BASE_URL: url,
      LOCAL_ADMIN: "admin",
      LOCAL_PASSWORD_HASH: salt + ":" + hash,
      JWT_SECRET: "test-secret-with-48-randomish-characters-123456789",
      DISCORD_TOKEN: "",
      DISCORD_CLIENT_ID: "test-app",
      DISCORD_CLIENT_SECRET: "test-secret",
      DISCORD_GUILD_ID: "test-guild",
      ADMIN_GUILD_ID: "test-admin-guild",
      ADMIN_ROLE_IDS: "test-admin-role",
      POLICE_ROLE_IDS: "",
      MULTA_CHANNEL_ID: "",
      ARRESTO_CHANNEL_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (b) => (logs += b));
  child.stderr.on("data", (b) => (logs += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await request("/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error("Servidor no inició: " + logs);
});
after(async () => {
  if (child) {
    child.kill();
    await new Promise((r) => child.once("exit", r));
  }
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});
test("rutas públicas, 404 y protección de consultas", async () => {
  assert.equal((await request("/")).status, 200);
  assert.equal((await request("/css/styles.css")).status, 200);
  assert.equal((await request("/no-existe")).status, 404);
  assert.equal((await request("/health")).status, 200);
  assert.equal(
    (await request("/api/search?q=123", { session: false })).status,
    401,
  );
  assert.equal(
    (await request("/pdfs/prueba.pdf", { session: false })).status,
    401,
  );
  assert.equal((await request("/.env")).status, 404);
});
test("login rechaza contraseña y origen incorrectos, crea sesión HttpOnly", async () => {
  assert.equal(
    (
      await request("/api/local/login", {
        method: "POST",
        body: { username: "admin", password: "mala" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request("/api/local/login", {
        method: "POST",
        body: { username: "admin", password: "prueba-local-123" },
        headers: { Origin: "https://otro.example" },
      })
    ).status,
    403,
  );
  const r = await request("/api/local/login", {
    method: "POST",
    body: { username: "admin", password: "prueba-local-123" },
  });
  assert.equal(r.status, 200);
  const set = r.headers.get("set-cookie");
  assert.match(set, /HttpOnly/i);
  cookie = set.split(";")[0];
  assert.equal((await request("/api/auth/me")).status, 200);
});
test("ciudadanos, vehículos, licencias y búsqueda", async () => {
  assert.equal(
    (
      await request("/api/citizens", {
        method: "POST",
        body: {
          numeroCedula: "RP-001",
          nombre: "Ana",
          apellidos: "Prueba",
          discordId: "",
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/citizens", {
        method: "POST",
        body: { numeroCedula: "RP-001", nombre: "Otro" },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/citizens/RP-001/assets", {
        method: "POST",
        body: { tipo: "vehiculo", placa: "ABC123", modelo: "Sedán" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/citizens/RP-001/assets", {
        method: "POST",
        body: { tipo: "licencia", licencia: "B1" },
      })
    ).status,
    200,
  );
  const s = await data(await request("/api/search?q=ABC123"));
  assert.equal(s.data.nombre, "Ana");
  assert.equal(s.data.vehiculos.length, 1);
  assert.equal(s.data.licencias.length, 1);
  assert.equal(
    (await data(await request("/api/search/suggestions?q=An"))).suggestions
      .length,
    1,
  );
});
test("multas validan, ignoran identidad falsa, generan PDF y evitan duplicados", async () => {
  assert.equal(
    (
      await request("/api/multa", {
        method: "POST",
        headers: { "X-Request-ID": "invalid-value-001" },
        body: { documento: "RP-001", articulos: "Artículo 1", valor: -1 },
      })
    ).status,
    400,
  );
  const opts = {
    method: "POST",
    headers: { "X-Request-ID": "fine-request-001" },
    body: {
      documento: "RP-001",
      articulos: "Artículo 1",
      valor: 150.5,
      oficialNombre: "Falso",
      oficialDiscordId: "falso",
    },
  };
  const r = await data(await request("/api/multa", opts));
  assert.equal(r.record.oficialNombre, "admin");
  const pdf = await request(r.record.pdfUrl);
  assert.equal(pdf.status, 200);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 4)
      .toString(),
    "%PDF",
  );
  const duplicate = await data(await request("/api/multa", opts));
  assert.equal(duplicate.record.id, r.record.id);
  const records = await data(await request("/api/records"));
  assert.equal(records.multas.length, 1);
  const status = await data(await request("/api/bot/status"));
  assert.equal(status.queue.notifications, 1);
});
test("arresto incorpora PNG, protege evidencia y rechaza imagen falsa", async () => {
  const fd = new FormData();
  fd.set("documento", "RP-001");
  fd.set("tiempo", "2");
  fd.set("articulos", "Artículo de prueba");
  const png = fs.readFileSync(path.join(source, "public/images/logo.png"));
  fd.set("foto", new Blob([png], { type: "image/png" }), "evidencia.png");
  const resp = await request("/api/arresto", {
    method: "POST",
    body: fd,
    headers: { "X-Request-ID": "arrest-request-001" },
  });
  const d = await data(resp);
  assert.equal(resp.status, 200, JSON.stringify(d) + " " + logs);
  assert.equal((await request(d.record.imagenUrl)).status, 200);
  assert.equal(
    (await request(d.record.imagenUrl, { session: false })).status,
    401,
  );
  const pdf = Buffer.from(await (await request(d.record.pdfUrl)).arrayBuffer());
  assert.ok(pdf.includes(Buffer.from("/Subtype /Image")));
  const fake = new FormData();
  fake.set("documento", "RP-001");
  fake.set("tiempo", "2");
  fake.set("articulos", "Artículo");
  fake.set(
    "foto",
    new Blob(["no es imagen"], { type: "image/png" }),
    "mala.png",
  );
  assert.equal(
    (
      await request("/api/arresto", {
        method: "POST",
        body: fake,
        headers: { "X-Request-ID": "bad-image-request" },
      })
    ).status,
    400,
  );
});
test("OAuth inválido, recuperación de cola y logout revoca sesión", async () => {
  assert.equal(
    (await request("/auth/discord/callback?code=falso&state=falso")).status,
    302,
  );
  const s = await data(await request("/api/bot/status"));
  assert.equal(s.queue.notifications, 2);
  assert.equal(
    (await request("/api/notifications/retry", { method: "POST", body: {} }))
      .status,
    200,
  );
  assert.equal(
    (await request("/api/auth/logout", { method: "POST", body: {} })).status,
    200,
  );
  assert.equal((await request("/api/auth/me")).status, 401);
});

test("sesión Discord simulada: ciudadano consulta solo su perfil y sus documentos", async () => {
  const admin = await request("/api/local/login", {
    method: "POST",
    body: { username: "admin", password: "prueba-local-123" },
  });
  cookie = admin.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (
      await request("/api/citizens/RP-001", {
        method: "PUT",
        body: {
          nombre: "Ana",
          apellidos: "Prueba",
          discordId: "123456789012345678",
        },
      })
    ).status,
    200,
  );
  await request("/api/citizens", {
    method: "POST",
    body: { numeroCedula: "RP-002", nombre: "Otro", apellidos: "Ciudadano" },
  });
  const other = await data(
    await request("/api/multa", {
      method: "POST",
      headers: { "X-Request-ID": "other-citizen-001" },
      body: { documento: "RP-002", articulos: "Artículo", valor: 10 },
    }),
  );
  const own = (await data(await request("/api/records"))).multas.find(
    (r) => r.documento === "RP-001",
  );
  const start = await request("/auth/discord", { session: false });
  const state = new URL(start.headers.get("location")).searchParams.get(
    "state",
  );
  const oauthCookie = start.headers.get("set-cookie").split(";")[0];
  const callback = await request(
    "/auth/discord/callback?code=test-code&state=" + state,
    { session: false, headers: { Cookie: oauthCookie } },
  );
  assert.equal(callback.status, 302);
  cookie = callback.headers
    .get("set-cookie")
    .split(/,(?=\s*session=)/)
    .find((c) => c.trim().startsWith("session="))
    .trim()
    .split(";")[0];
  const me = await data(await request("/api/auth/me"));
  assert.equal(me.user.hasPoliceAccess, false);
  assert.equal(me.user.nombreCompleto, "Ana Prueba");
  assert.equal((await request("/api/search?q=RP-002")).status, 403);
  assert.equal((await request("/api/citizens")).status, 403);
  const profile = await data(await request("/api/profile"));
  assert.equal(profile.citizen.numeroCedula, "RP-001");
  assert.ok(profile.citizen.multas.every((r) => r.documento === "RP-001"));
  assert.equal((await request(own.pdfUrl)).status, 200);
  assert.equal((await request(other.record.pdfUrl)).status, 403);
});

test("admin: permisos, registro de staff, búsqueda y métricas", async () => {
  assert.equal((await request("/admin")).status, 200);
  assert.equal(
    (await request("/api/admin/staff", { session: false })).status,
    401,
  );
  assert.equal((await request("/api/admin/staff")).status, 403);
  const a = await request("/api/local/login", {
    method: "POST",
    body: { username: "admin", password: "prueba-local-123" },
  });
  cookie = a.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/admin/auth/me")).status, 200);
  const id = "987654321098765432";
  assert.equal(
    (
      await request("/api/admin/staff", {
        method: "POST",
        body: {
          discordId: id,
          nombre: "Staff prueba",
          placa: "STAFF-001",
          rango: "Moderador",
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/admin/staff", {
        method: "POST",
        body: { discordId: id, nombre: "Duplicado" },
      })
    ).status,
    409,
  );
  for (const body of [
    { tipo: "actividad", horas: 8.5 },
    { tipo: "tickets", atendidos: 10, cerrados: 8 },
    { tipo: "calificacion", nota: 4.5, comentario: "Buen trabajo" },
    {
      tipo: "sancion",
      usuarioId: "111111111111111111",
      sancion: "Advertencia",
      motivo: "Prueba",
    },
  ])
    assert.equal(
      (
        await request("/api/admin/staff/" + id + "/metrics", {
          method: "POST",
          body,
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await request("/api/admin/staff/" + id + "/metrics", {
        method: "POST",
        body: { tipo: "tickets", atendidos: 1, cerrados: 2 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/admin/staff/" + id + "/metrics", {
        method: "POST",
        body: { tipo: "calificacion", nota: 6 },
      })
    ).status,
    400,
  );
  const d = await data(await request("/api/admin/search?q=STAFF-001"));
  assert.equal(d.data.discordId, id);
  assert.equal(d.data.actividad.horas, 8.5);
  assert.equal(d.data.tickets.cerrados, 8);
  assert.equal(d.data.calificaciones[0].nota, 4.5);
  assert.equal(d.data.sancionesHechas.length, 1);
  assert.equal((await data(await request("/api/admin/summary"))).horas, 8.5);
});
test("OAuth administrativo simulado valida roles y no concede permisos policiales", async () => {
  const deniedStart = await request("/admin/auth/discord", { session: false });
  const deniedState = new URL(
    deniedStart.headers.get("location"),
  ).searchParams.get("state");
  const deniedCookie = deniedStart.headers.get("set-cookie").split(";")[0];
  const denied = await request(
    "/admin/auth/discord/callback?code=normal-code&state=" + deniedState,
    { session: false, headers: { Cookie: deniedCookie } },
  );
  assert.ok(denied.headers.get("location").includes("/admin?error="));
  const start = await request("/admin/auth/discord", { session: false });
  const state = new URL(start.headers.get("location")).searchParams.get(
    "state",
  );
  const oauthCookie = start.headers.get("set-cookie").split(";")[0];
  const callback = await request(
    "/admin/auth/discord/callback?code=admin-test-code&state=" + state,
    { session: false, headers: { Cookie: oauthCookie } },
  );
  assert.equal(callback.headers.get("location"), "/admin");
  cookie = callback.headers
    .get("set-cookie")
    .split(/,(?=\s*session=)/)
    .find((c) => c.trim().startsWith("session="))
    .trim()
    .split(";")[0];
  const me = await data(await request("/api/admin/auth/me"));
  assert.equal(me.user.isAdmin, true);
  assert.equal(me.user.hasPoliceAccess, false);
  assert.equal((await request("/api/admin/staff")).status, 200);
  assert.equal((await request("/api/records")).status, 403);
  assert.equal(
    (await request("/api/admin/auth/logout", { method: "POST", body: {} }))
      .status,
    200,
  );
  assert.equal((await request("/api/admin/auth/me")).status, 401);
});

test("staff y configuración usan sesión real, rechazan anónimo y guardan turnos/LOA", async () => {
  assert.equal((await request("/staff")).status, 200);
  assert.equal((await request("/ciudadano")).status, 200);
  assert.equal((await request("/config")).status, 200);
  assert.equal(
    (await request("/api/staff/me", { session: false })).status,
    401,
  );
  assert.equal(
    (await request("/api/bot/settings", { session: false })).status,
    401,
  );
  const login = await request("/api/local/login", {
    method: "POST",
    body: { username: "admin", password: "prueba-local-123" },
  });
  cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/staff/me")).status, 200);
  let cfg = (await data(await request("/api/bot/settings"))).settings;
  cfg.minimumShiftMinutes = 0;
  cfg.sanctionCooldownSeconds = 0;
  assert.equal(
    (await request("/api/bot/settings", { method: "PUT", body: cfg })).status,
    200,
  );
  const start = await data(
    await request("/api/staff/shift/toggle", {
      method: "POST",
      body: { action: "start", staffId: "suplantado" },
    }),
  );
  assert.equal(start.data.userId, "local:admin");
  assert.equal(start.data.current.state, "active");
  assert.equal(
    (
      await request("/api/staff/shift/toggle", {
        method: "POST",
        body: { action: "pause" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/staff/shift/toggle", {
        method: "POST",
        body: { action: "stop" },
      })
    ).status,
    200,
  );
  const future = Date.now() + 86400000;
  const loa = await data(
    await request("/api/staff/loa/solicitar", {
      method: "POST",
      body: {
        reason: "Ausencia",
        start: new Date(future).toISOString(),
        end: new Date(future + 86400000).toISOString(),
      },
    }),
  );
  assert.equal(loa.data.userId, "local:admin");
  assert.equal(
    (
      await request("/api/staff/loa/" + loa.data.id + "/decision", {
        method: "POST",
        body: { approve: true },
      })
    ).status,
    200,
  );
  const sanctions = await data(
    await request("/api/staff/sancionar", {
      method: "POST",
      body: { userId: "123456789012345678", motivo: "Prueba de registro" },
    }),
  );
  assert.equal(sanctions.data.moderadorId, "local:admin");
  const saved = await data(await request("/api/staff/recent"));
  assert.ok(
    saved.sanctions.some(
      (r) => r.id === sanctions.data.id && r.moderadorId === "local:admin",
    ),
  );
});
