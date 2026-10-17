const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const source = path.resolve(__dirname, "..");
let directory, child, base;
const bootstrap = `
let failure = false, revoked = false, blocked = false, release;
process.on('message', message => {
  failure = !!message.failure;
  revoked = !!message.revoked;
  blocked = !!message.block;
  if (message.release) { release?.(); release = null; }
  process.send({ack:true});
});
global.fetch = async (url, options = {}) => {
  if (blocked && url.includes('/member')) {
    blocked = false;
    process.send({blocked:true});
    await new Promise(resolve => { release = resolve; });
  }
  const token = options.headers?.Authorization?.split(' ')[1];
  const unavailable = failure && url.includes('/member');
  return {ok:!unavailable,status:unavailable?503:200,json:async()=> {
    if(url.endsWith('/oauth2/token'))return {access_token:options.body.get('code'),refresh_token:'fixture-refresh',expires_in:3600};
    if(url.endsWith('/users/@me'))return {id:token==='police'?'222222222222222222':token==='citizen'?'444444444444444444':'111111111111111111',username:token};
    return {roles:revoked?[]:token==='police'?['555555555555555555']:token==='admin'?['333333333333333333']:[]};
  }};
};
const store = require('./lib/store');
store.init();
store.write('multas',[{id:'fixture-fine',userId:'444444444444444444',estado:'REGISTRADA',monto:10}]);
const app = require('./server');
const server = app.listen(0,'127.0.0.1',()=>console.log('PORT='+server.address().port));
`;

before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "auth-boundary-"));
  require("./helpers/application-sandbox").copyApplication(source, directory);
  child = spawn(process.execPath, ["-e", bootstrap], {
    cwd: directory,
    env: {
      ...process.env,
      NODE_PATH: path.join(source, "node_modules"),
      MAESRP_DATA_DIR: path.join(directory, "bot/data"),
      BASE_URL: "http://localhost:3000",
      JWT_SECRET: "isolated-auth-boundary-fixture-signing-key",
      DISCORD_TOKEN: "",
      DISCORD_CLIENT_ID: "fixture-app",
      DISCORD_CLIENT_SECRET: "fixture-secret",
      DISCORD_GUILD_ID: "777777777777777777",
      ADMIN_GUILD_ID: "888888888888888888",
      ADMIN_ROLE_IDS: "333333333333333333",
      POLICE_ROLE_IDS: "555555555555555555",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let output = "";
  child.stdout.on("data", (bytes) => (output += bytes));
  child.stderr.on("data", (bytes) => (output += bytes));
  for (let attempt = 0; attempt < 200; attempt++) {
    const port = output.match(/PORT=(\d+)/);
    if (port) {
      base = "http://127.0.0.1:" + port[1];
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw Error("El sandbox no inició: " + output);
});

after(async () => {
  if (child) {
    const exit = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exit;
  }
  fs.rmSync(directory, { recursive: true, force: true });
});

function cookie(response, name = "session") {
  return response.headers
    .getSetCookie()
    .find((value) => value.startsWith(name + "="))
    ?.split(";")[0];
}
function request(route, session, method = "GET", body) {
  return fetch(base + route, {
    method,
    headers: {
      "X-Local-Request": "1",
      ...(session ? { Cookie: session } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}
async function login(kind) {
  const prefix = kind === "admin" ? "/admin/auth/discord" : "/auth/discord";
  const start = await request(prefix);
  const state = new URL(start.headers.get("location")).searchParams.get("state");
  const callback = await request(
    prefix + "/callback?state=" + state + "&code=" + kind,
    cookie(start, "oauth_state"),
  );
  const session = cookie(callback);
  assert.ok(session, "El proveedor simulado debe crear una sesión");
  return session;
}
function control(message) {
  return new Promise((resolve) => {
    child.once("message", resolve);
    child.send(message);
  });
}

test("el administrador web sin rol policial no consulta registros ni confirma pagos", async () => {
  const session = await login("admin");
  const { user } = await (await request("/api/auth/me", session)).json();
  assert.equal(user.isAdmin, true);
  assert.equal(user.hasPoliceAccess, false);
  for (const route of ["/api/records", "/api/citizens", "/api/search?q=fixture"])
    assert.equal((await request(route, session)).status, 403, route);
  for (const route of ["/api/multa", "/api/arresto", "/api/police/payments/fixture-fine/confirm"])
    assert.equal(
      (await request(route, session, "POST", { reference: "should-not-be-applied" })).status,
      403,
      route,
    );
});

test("policía puede confirmar pagos pero no obtiene privilegios administrativos; ciudadano no confirma", async () => {
  const police = await login("police"), citizen = await login("citizen");
  assert.equal((await request("/api/admin/staff", police)).status, 403);
  assert.equal((await request("/api/bot/settings", police)).status, 403);
  assert.equal(
    (await request("/api/police/payments/fixture-fine/confirm", citizen, "POST", { reference: "forged" })).status,
    403,
  );
  const accepted = await request("/api/police/payments/fixture-fine/confirm", police, "POST", { reference: "isolated-fixture-reference" });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).data.estado, "PAGADA");
});

test("los tres cierres de sesión funcionan aunque Discord no esté disponible", async () => {
  for (const route of ["/api/auth/logout", "/api/staff/auth/logout", "/api/admin/auth/logout"]) {
    const session = await login("admin");
    await control({ failure: true });
    try {
      const logout = await request(route, session, "POST");
      assert.equal(logout.status, 200, route);
      assert.match(logout.headers.get("set-cookie"), /session=;/);
      assert.equal((await request("/api/auth/me", session)).status, 401);
    } finally {
      await control({ failure: false });
    }
  }
});

test("un rol revocado bloquea inmediatamente la escritura y permite cerrar el portal administrativo", async () => {
  const session = await login("admin");
  await control({ revoked: true });
  try {
    assert.equal(
      (await request("/api/admin/staff", session, "POST", { discordId: "999999999999999999", nombre: "Rejected" })).status,
      403,
    );
    assert.equal((await request("/api/admin/auth/logout", session, "POST")).status, 200);
    assert.equal((await request("/api/auth/me", session)).status, 401);
  } finally {
    await control({ revoked: false });
  }
});

test("una escritura esperando a Discord no continúa después de cerrar su sesión", { timeout: 10000 }, async () => {
  const session = await login("admin");
  await control({ block: true });
  const waiting = new Promise((resolve) => {
    const listener = (message) => {
      if (message.blocked) {
        child.off("message", listener);
        resolve();
      }
    };
    child.on("message", listener);
  });
  const write = request("/api/admin/staff", session, "POST", {
    discordId: "999999999999999999",
    nombre: "Must not be persisted after logout",
  });
  await waiting;
  try {
    assert.equal((await request("/api/auth/logout", session, "POST")).status, 200);
  } finally {
    await control({ release: true });
  }
  assert.equal((await write).status, 401);
});

test("rotar el acceso invalida también las escrituras pendientes de la sesión anterior", { timeout: 10000 }, async () => {
  const session = await login("admin");
  await control({ block: true });
  const waiting = new Promise((resolve) => {
    const listener = (message) => {
      if (message.blocked) {
        child.off("message", listener);
        resolve();
      }
    };
    child.on("message", listener);
  });
  const write = request("/api/admin/staff", session, "POST", {
    discordId: "999999999999999998",
    nombre: "Must not be persisted after rotation",
  });
  await waiting;
  try {
    const start = await request("/admin/auth/discord");
    const state = new URL(start.headers.get("location")).searchParams.get("state");
    const callback = await request(
      "/admin/auth/discord/callback?state=" + state + "&code=admin",
      session + "; " + cookie(start, "oauth_state"),
    );
    assert.ok(cookie(callback));
  } finally {
    await control({ release: true });
  }
  assert.equal((await write).status, 401);
});
