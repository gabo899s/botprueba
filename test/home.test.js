const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, ".."),
  html = fs.readFileSync(path.join(root, "public/maes-rp.html"), "utf8"),
  script = fs.readFileSync(path.join(root, "public/js/home.js"), "utf8");
async function page({ user = null, profile = null } = {}) {
  const d = new JSDOM(html, {
    url: "http://localhost:3000/maes-rp",
    runScripts: "outside-only",
  });
  const w = d.window;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.fetch = async (url, options = {}) => {
    let status = 200,
      data = { success: true };
    if (url === "/api/config")
      data = { success: true, discordOAuth: false, robloxOAuth: false };
    else if (url === "/api/auth/me") {
      status = user ? 200 : 401;
      data = user
        ? { success: true, user }
        : { success: false, message: "Inicia sesión." };
    } else if (url === "/api/profile")
      data = { success: true, citizen: profile };
    else if (url === "/api/local/login") {
      const fields = JSON.parse(options.body);
      assert.equal(fields.username, "admin");
      assert.equal(fields.password, "prueba123456");
      user = {
        nombreCompleto: "admin",
        mode: "local",
        trabajo: "Administrador local",
        hasPoliceAccess: true,
      };
    } else if (url === "/api/auth/logout") user = null;
    return { ok: status < 400, status, json: async () => data };
  };
  w.eval(script);
  await new Promise((r) => setImmediate(r));
  return d;
}
test("HTML conserva secciones y sirve recursos locales sin scripts inline ni IDs de rol", () => {
  assert.match(html, /Departamentos/);
  assert.match(html, /id="staff"/);
  assert.match(html, /id="como-unirse"/);
  assert.ok(
    !/\bonclick=|\bstyle=|cdn.tailwindcss|localStorage|\d{17,20}/.test(
      html + script,
    ),
  );
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html));
  for (const m of html.matchAll(
    /(?:src|href)="(\/(?:css|js|images|fonts|webfonts)\/[^"?]+)"/g,
  ))
    assert.ok(fs.existsSync(path.join(root, "public", m[1])), m[1]);
});
test("visitante puede abrir login y entrar como administrador local", async () => {
  const d = await page();
  try {
    const w = d.window;
    w.document.querySelector('[data-action="login"]').click();
    assert.equal(w.document.querySelector("#loginDialog").open, true);
    const f = w.document.querySelector("#localLogin");
    f.elements.username.value = "admin";
    f.elements.password.value = "prueba123456";
    f.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setImmediate(r));
    assert.equal(w.document.querySelector("#loginDialog").open, false);
    assert.equal(w.document.querySelector("#hero-name").textContent, "admin");
    assert.ok(w.document.querySelector('#hero-content a[href="/v2/police"]'));
    w.document.querySelector('[data-action="logout"]').click();
    await new Promise((r) => setImmediate(r));
    assert.ok(w.document.querySelector(".hero-title"));
    assert.ok(w.document.querySelector('[data-action="login"]'));
  } finally {
    d.window.close();
  }
});
test("datos de perfil se muestran como texto y el ciudadano ve sus registros sin exigir Roblox", async () => {
  const user = {
    nombreCompleto: "<img src=x onerror=alert(1)>",
    discordUsername: "Usuario",
    discordId: "123",
    mode: "discord",
    trabajo: "Ciudadano",
    hasPoliceAccess: false,
  };
  const profile = {
    nombre: "Ana",
    apellidos: "Prueba",
    numeroCedula: "RP-001",
    vehiculos: [],
    licencias: [],
    multas: [
      {
        fecha: "Hoy",
        monto: 1,
        articulos: "Artículo 1",
        pdfUrl: "/pdfs/test.pdf",
      },
    ],
    arrestos: [],
  };
  const d = await page({ user, profile });
  try {
    const w = d.window;
    assert.equal(
      w.document.querySelector("#hero-name").textContent,
      user.nombreCompleto,
    );
    assert.equal(w.document.querySelector("#hero-name img"), null);
    w.document.querySelector('[data-action="citizen"]').click();
    await new Promise((r) => setImmediate(r));
    assert.equal(w.document.querySelector("#citizenDialog").open, true);
    assert.ok(
      w.document.querySelector('#citizenProfile a[href="/pdfs/test.pdf"]'),
    );
    assert.equal(
      w.document.querySelector("#roblox-modal").classList.contains("show"),
      false,
    );
  } finally {
    d.window.close();
  }
});
