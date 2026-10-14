const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
test("dashboard policial recuperado carga sesión, busca y abre formulario sin JWT local", async () => {
  const html = fs.readFileSync(path.join(root, "public/police.html"), "utf8"),
    code = fs.readFileSync(
      path.join(root, "public/js/police-recovered.js"),
      "utf8",
    );
  assert.ok(!/onclick=|localStorage|api\/dev\/login/.test(html + code));
  const d = new JSDOM(html, {
    url: "http://localhost:3000/v2/police",
    runScripts: "outside-only",
  });
  const w = d.window;
  w.fetch = async (url) => ({
    ok: true,
    json: async () =>
      url === "/api/auth/me"
        ? {
            user: {
              nombreCompleto: "Oficial",
              hasPoliceAccess: true,
              trabajo: "Policía",
            },
          }
        : {
            data: {
              nombre: "Ana",
              apellidos: "Prueba",
              numeroCedula: "RP-001",
              licencias: [],
              vehiculos: [],
              multas: [],
              arrestos: [],
            },
          },
  });
  try {
    w.eval(code);
    await new Promise((r) => setImmediate(r));
    assert.equal(
      w.document
        .querySelector("#view-dashboard")
        .classList.contains("hidden-view"),
      false,
    );
    const input = w.document.querySelector("#search-input");
    input.value = "RP-001";
    input.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter" }));
    await new Promise((r) => setImmediate(r));
    assert.equal(
      w.document.querySelector("#cit-name").textContent,
      "Ana Prueba",
    );
    w.document.querySelector('[data-action="open-multa"]').click();
    assert.equal(
      w.document
        .querySelector("#modal-multa")
        .classList.contains("hidden-view"),
      false,
    );
  } finally {
    w.close();
  }
});
