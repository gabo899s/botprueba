const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, ".."),
  html = fs.readFileSync(path.join(root, "public/admin.html"), "utf8"),
  script = fs.readFileSync(path.join(root, "public/js/admin.js"), "utf8");
async function page(mode) {
  const d = new JSDOM(html, {
    url: "http://localhost:3000/admin",
    runScripts: "outside-only",
  });
  let records = [];
  d.window.fetch = async (url, opts = {}) => {
    let status = 200,
      data = { success: true };
    if (url === "/api/config") data.adminOAuth = true;
    else if (url === "/api/admin/auth/me") {
      status = mode === "discord-admin" ? 200 : mode === "guest" ? 401 : 403;
      data =
        mode === "discord-admin"
          ? { success: true, user: { nombreCompleto: "admin" } }
          : { success: false, message: "Sin acceso" };
    } else if (url === "/api/admin/staff") {
      if (opts.method === "POST") {
        const s = JSON.parse(opts.body);
        records.push(s);
        data = { success: true, data: s };
      } else data = { success: true, staff: records };
    } else if (url === "/api/admin/summary")
      data = {
        success: true,
        total: records.length,
        activos: records.length,
        horas: 0,
      };
    else if (url.startsWith("/api/admin/staff/"))
      data = {
        success: true,
        data: {
          ...records[0],
          sancionesHechas: [],
          actividad: null,
          tickets: null,
          calificaciones: null,
        },
      };
    return { ok: status < 400, status, json: async () => data };
  };
  d.window.eval(script);
  await new Promise((r) => setImmediate(r));
  return d;
}
test("admin ofrece solo Discord y restringe sesiones no administrativas", async () => {
  for (const mode of ["guest", "denied"]) {
    const d = await page(mode);
    try {
      assert.equal(d.window.document.querySelector("#workspace").hidden, true);
      assert.equal(
        d.window.document.querySelector(
          mode === "guest" ? "#loginSection" : "#denied",
        ).hidden,
        false,
      );
    } finally {
      d.window.close();
    }
  }
});
test("admin registra staff y muestra expediente con nombres como texto", async () => {
  const d = await page("discord-admin");
  try {
    const w = d.window;
    assert.equal(w.document.querySelector("#workspace").hidden, false);
    const f = w.document.querySelector("#staffForm");
    f.elements.discordId.value = "987654321098765432";
    f.elements.nombre.value = "<img src=x onerror=alert(1)>";
    f.elements.estado.value = "Activo";
    f.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((r) => setImmediate(r));
    assert.equal(
      w.document.querySelector("#staffDetail h3").textContent,
      "<img src=x onerror=alert(1)>",
    );
    assert.equal(w.document.querySelector("#staffDetail img"), null);
    assert.equal(w.document.querySelector("#metricsPanel").hidden, false);
    assert.equal(w.document.querySelector("#totalStaff").textContent, "1");
  } finally {
    d.window.close();
  }
});
