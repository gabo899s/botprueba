const fs = require("node:fs"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const { root, dataDir } = require("./config");
const defaults = {
  cedulas: {},
  users: {},
  vehiculos: {},
  licencias: {},
  multas: [],
  arrestos: [],
  infostaff: {},
  sanciones: {},
  advertencias: {},
  horasactividad: {},
  calificaciones_staff: {},
  tickets: { stats: {}, items: {} },
  whitelist: {},
  exams: {},
  bans: [],
  shifts: {},
  loa: [],
  polls: {},
  messages: {},
  messageDrafts: {},
  textTemplates: {},
  audit: [],
  settings: {},
  actions: [],
};
let db,
  depth = 0;
let mirrorLicenses = false;
function exportLicenses() {
  if (!mirrorLicenses) return;
  try { atomic(path.join(dataDir, "licencias.json"), read("licencias")); mirrorLicenses = false; }
  catch (error) { console.error("Licencias guardadas en SQLite; exportación JSON pendiente:", error.message); }
}
function database() {
  if (db) return db;
  fs.mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(path.join(dataDir, "maesrp.sqlite"));
  fs.chmodSync(path.join(dataDir, "maesrp.sqlite"), 0o600);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state(name TEXT PRIMARY KEY,value TEXT NOT NULL);",
  );
  return db;
}
function init() {
  database();
  for (const d of ["notifications", "processed", "errors"])
    fs.mkdirSync(path.join(dataDir, d), { recursive: true });
  for (const d of ["pdfs", "uploads"])
    fs.mkdirSync(path.join(root, "public", d), { recursive: true });
  for (const [n, v] of Object.entries(defaults)) {
    if (!db.prepare("SELECT 1 FROM state WHERE name=?").get(n)) {
      let initial = v;
      const file = path.join(dataDir, n + ".json");
      if (fs.existsSync(file))
        initial = JSON.parse(fs.readFileSync(file, "utf8"));
      write(n, initial);
    }
  }
}
function read(name) {
  const row = database()
    .prepare("SELECT value FROM state WHERE name=?")
    .get(name);
  if (!row) {
    if (name in defaults) return structuredClone(defaults[name]);
    throw Error("Colección desconocida: " + name);
  }
  return JSON.parse(row.value);
}
function write(name, value) {
  database()
    .prepare(
      "INSERT INTO state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
    )
    .run(name, JSON.stringify(value));
  if (name === "licencias") { mirrorLicenses = true; if (!depth) exportLicenses(); }
  return true;
}
function transaction(fn) {
  const connection = database();
  if (depth) return fn();
  connection.exec("BEGIN IMMEDIATE");
  depth++;
  const previousMirror = mirrorLicenses;
  let committed = false;
  try {
    const result = fn();
    if (result && typeof result.then === "function")
      throw Error("Una transacción no puede contener operaciones asíncronas.");
    connection.exec("COMMIT");
    committed = true;
    return result;
  } catch (e) {
    connection.exec("ROLLBACK");
    throw e;
  } finally {
    depth--;
    if (committed) exportLicenses();
    else mirrorLicenses = previousMirror;
  }
}
function update(name, fn) {
  return transaction(() => {
    const value = read(name);
    const result = fn(value);
    write(name, value);
    return result;
  });
}
function atomic(file, value) {
  const tmp = file + "." + randomUUID() + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
function queue(type, record) {
  atomic(path.join(dataDir, "notifications", record.id + ".json"), {
    type,
    data: record,
    attempts: 0,
    nextAttempt: 0,
  });
}
function stats() {
  return Object.fromEntries(
    ["notifications", "processed", "errors"].map((d) => [
      d,
      fs.readdirSync(path.join(dataDir, d)).filter((n) => n.endsWith(".json"))
        .length,
    ]),
  );
}
function audit(actor, action, data = {}) {
  update("audit", (rows) => {
    rows.push({
      id: randomUUID(),
      at: new Date().toISOString(),
      actor,
      action,
      data,
    });
    if (rows.length > 20000) rows.splice(0, rows.length - 20000);
  });
}
module.exports = {
  init,
  read,
  write,
  transaction,
  update,
  atomic,
  queue,
  stats,
  audit,
  defaults,
};
