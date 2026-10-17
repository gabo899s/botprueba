const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { JSDOM } = require("jsdom");
const { citizenModules, mountCitizenModules } = require("../lib/citizen-modules");

const dotRole = "111111111111111111", fireRole = "222222222222222222", gangRole = "333333333333333333";
const ids = (modules) => modules.map((module) => module.id);

test("los módulos departamentales requieren su rol exacto y no conceden privilegios al administrador", () => {
  const env = { DOT_ROLE_IDS: " " + dotRole + ", invalid", FIRE_ROLE_IDS: fireRole, GANG_ROLE_IDS: gangRole };
  const expected = ["store", "assets", "housing", "transactions", "trades", "ck"];
  assert.deepEqual(ids(citizenModules({ isAdmin: true, roles: [] }, env)), expected);
  assert.deepEqual(ids(citizenModules({ roles: [dotRole] }, env)), [...expected, "dot"]);
  assert.deepEqual(ids(citizenModules({ roles: [fireRole, gangRole] }, env)), [...expected, "fire", "gangs"]);
  assert.deepEqual(ids(citizenModules({ roles: [dotRole] }, {})), expected);
  assert.deepEqual(ids(citizenModules({ roles: dotRole }, env)), expected);
  const manifest = JSON.stringify(citizenModules({ roles: [dotRole, fireRole, gangRole] }, env));
  for (const secret of [dotRole, fireRole, gangRole, "ROLE_IDS", "roleVariable"]) assert.ok(!manifest.includes(secret));
  assert.ok(citizenModules({ roles: [dotRole] }, env).every((module) => module.status === "pending"));
});

test("el manifiesto exige sesión, no se almacena en caché y no crea operaciones de departamento", async () => {
  const app = express();
  mountCitizenModules(app, { auth: (req, res, next) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ success: false });
    req.user = { id: "fixture", roles: [], isAdmin: true };
    next();
  } });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    assert.equal((await fetch(base + "/api/profile/modules")).status, 401);
    const response = await fetch(base + "/api/profile/modules", { headers: { "X-Test-User": "fixture" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(!ids(body.modules).includes("dot"));
    assert.equal((await fetch(base + "/api/profile/modules", { method: "POST" })).status, 404);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

const script = fs.readFileSync(path.join(__dirname, "../public/js/citizen-modules.js"), "utf8");
function browser(api) {
  const dom = new JSDOM('<button class="tile" data-module="store"><span>Tienda</span></button><button class="tile locked" data-module="dot" hidden><i class="lock-icon"></i><span>DOT</span></button><button data-panel="personal">Perfil</button><section data-view="module"><div id="moduleDetails"></div></section>', { runScripts: "outside-only" });
  const app = { me: null, api, notice() {}, selectPanel(name) { app.selected = name; } };
  dom.window.CitizenApp = app;
  dom.window.eval(script);
  function update(me, demo = false) {
    app.me = me;
    dom.window.document.dispatchEvent(new dom.window.CustomEvent("citizen:updated", { bubbles: true, detail: { me, demo } }));
  }
  return { dom, app, update, document: dom.window.document };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("los botones pendientes abren información sin escribir datos y no acumulan etiquetas", async () => {
  let requests = 0;
  const view = browser(async () => { requests++; return { modules: [] }; });
  try {
    const button = view.document.querySelector('[data-module="store"]');
    button.click();
    assert.equal(view.app.selected, "module");
    assert.match(view.document.querySelector("#moduleDetails").textContent, /Próximamente/);
    assert.equal(requests, 0);
    const user = { id: "fixture" };
    view.update(user); await tick();
    view.update(user); await tick();
    assert.equal(button.querySelectorAll(".module-status").length, 1);
    assert.equal(view.document.querySelector('[data-module="dot"]').hidden, true);
  } finally { view.dom.window.close(); }
});

test("los permisos fallidos, el cierre de sesión y respuestas antiguas ocultan los departamentos", async () => {
  let resolveOld, failure = false;
  const view = browser(() => failure ? Promise.reject(Error("offline")) : new Promise((resolve) => { resolveOld = resolve; }));
  try {
    const dot = view.document.querySelector('[data-module="dot"]');
    view.update({ id: "first" });
    const old = resolveOld;
    view.update({ id: "second" });
    old({ modules: [{ id: "dot", status: "pending" }] }); await tick();
    assert.equal(dot.hidden, true);
    resolveOld({ modules: [{ id: "dot", status: "pending" }] }); await tick();
    assert.equal(dot.hidden, false);
    dot.click();
    assert.match(view.document.querySelector("#moduleDetails").textContent, /DOT/);
    failure = true;
    view.update({ id: "second" }); await tick();
    assert.equal(dot.hidden, true);
    assert.equal(view.app.selected, "personal");
    assert.equal(view.document.querySelector("#moduleDetails").textContent, "");
    view.update(null, true); await tick();
    assert.equal(dot.hidden, true);
  } finally { view.dom.window.close(); }
});
