const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
test("asistente genera .env privado, secretos y JSON de roles válido", async () => {
  const source = path.resolve(__dirname, ".."),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "maesrp-setup-"));
  for (const name of ["scripts", "lib", "bot"])
    fs.cpSync(path.join(source, name), path.join(dir, name), {
      recursive: true,
    });
  const env = { ...process.env, NODE_PATH: path.join(source, "node_modules") };
  for (const k of [
    "PORT",
    "BASE_URL",
    "LOCAL_ADMIN",
    "LOCAL_PASSWORD_HASH",
    "JWT_SECRET",
    "DISCORD_TOKEN",
    "DISCORD_CLIENT_ID",
    "DISCORD_CLIENT_SECRET",
    "DISCORD_GUILD_ID",
    "POLICE_ROLE_IDS",
    "LICENSE_ROLE_MAP",
    "MULTA_CHANNEL_ID",
    "ARRESTO_CHANNEL_ID",
    "ROBLOX_CLIENT_ID",
    "ROBLOX_CLIENT_SECRET",
    "ADMIN_GUILD_ID",
    "ADMIN_ROLE_IDS",
  ])
    delete env[k];
  const steps = [
    ["Puerto web", ""],
    ["Token del bot", ""],
    ["ID de la aplicación", ""],
    ["Secreto OAuth2 de Discord", ""],
    ["ID del servidor", ""],
    ["IDs de roles", ""],
    ["ID del canal de multas", ""],
    ["ID del canal de arrestos", ""],
    ["Licencias por rol", '{"123456789012345678":"B1"}'],
    ["ID del servidor Discord de administración", ""],
    ["IDs de roles administrativos", ""],
    ["ID de aplicación Roblox", ""],
    ["Secreto OAuth2 Roblox", ""],
    ["Clave del servidor ER:LC", ""],
    ["Clave global PRC", ""],
    ["Token de economía", ""],
    ["Configurar ahora roles", "n"],
    ["Configurar información legal", "n"],
  ];
  let next = 0,
    output = "";
  const child = spawn(process.execPath, ["scripts/setup.js"], {
    cwd: dir,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(Error("Asistente detenido en paso " + next));
    }, 10000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(Error("Asistente falló: " + output));
    });
    child.on("error", reject);
  });
  child.stdout.on("data", (b) => {
    output += b;
    if (next < steps.length && output.includes(steps[next][0])) {
      const value = steps[next++][1];
      output = "";
      child.stdin.write(value + "\n");
    }
  });
  child.stderr.on("data", (b) => (output += b));
  try {
    await done;
    const file = path.join(dir, ".env");
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    const parsed = require("dotenv").parse(fs.readFileSync(file));
    assert.equal(parsed.DISCORD_TOKEN, "");
    assert.equal(parsed.POLICE_ROLE_IDS, "");
    assert.equal(parsed.BASE_URL, "http://localhost:3000");
    assert.equal(
      JSON.parse(parsed.LICENSE_ROLE_MAP)["123456789012345678"],
      "B1",
    );
    assert.ok(parsed.JWT_SECRET.length >= 64);
    assert.equal(parsed.LOCAL_PASSWORD_HASH, undefined);
    assert.equal(parsed.LOCAL_ADMIN, undefined);
    assert.ok(fs.existsSync(path.join(dir, "bot/data/notifications")));
  } finally {
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
