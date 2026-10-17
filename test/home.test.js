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
      data = { success: true, discordOAuth: true, robloxOAuth: false };
    else if (url === "/api/auth/me") {
      status = user ? 200 : 401;
      data = user
        ? { success: true, user }
        : { success: false, message: "Inicia sesión." };
    } else if (url === "/api/profile")
      data = { success: true, citizen: profile };
    else if (url === "/api/auth/logout") user = null;
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
test("visitante solo ve acceso Discord, sin campos de usuario ni contraseña", async () => {
 const d=await page();try{const doc=d.window.document;doc.querySelector('[data-action="login"]').click();assert.equal(doc.querySelector('#loginDialog').open,true);assert.equal(doc.querySelector('#localLogin,input[type="password"]'),null);assert.equal(doc.querySelector('#discordLogin').hidden,false);assert.equal(doc.querySelector('#discordLogin').getAttribute('href'),'/auth/discord');}finally{d.window.close();}
});
test("perfil Discord y foto se restauran al cargar la página", async () => {
 const user={discordId:'123',discordUsername:'MiDiscord',nombreCompleto:'Nombre',mode:'discord',trabajo:'Ciudadano',discordAvatar:'https://cdn.discordapp.com/avatars/123/photo.png'};
 for(let reload=0;reload<2;reload++){const d=await page({user});assert.equal(d.window.document.querySelector('.profile-trigger-avatar').getAttribute('src'),user.discordAvatar);assert.equal(d.window.document.querySelector('.profile-trigger-username').textContent,'MiDiscord');d.window.close();}
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
