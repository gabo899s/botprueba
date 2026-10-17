const fs = require("node:fs"),
  path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const { identityFilename } = require("./identity-document");
const { root, dataDir } = require("./config");
const { privateDirectory, privateFile, hardenPrivateTree } = require("./private-files");
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
  privacyRequests: [],
};
let db,
  depth = 0;
let mirrorLicenses = false;
let pendingIdentityInvalidations = new Set();
function identityChanges(previous, next) {
  const index = value => new Map(Object.values(value || {})
    .filter(record => /^[\w-]{2,40}$/.test(record?.numeroCedula || ""))
    .map(record => [record.numeroCedula, JSON.stringify(record)]));
  const before = index(previous), after = index(next);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter(number => before.get(number) !== after.get(number));
}
function invalidateIdentityPdfs() {
  for (const filename of pendingIdentityInvalidations) {
    // Identity PDFs are regenerable caches. A reused number must never expose
    // the previous holder's card; fine/arrest documents are left untouched.
    fs.rmSync(path.join(root, "public/pdfs", filename), { force: true });
    pendingIdentityInvalidations.delete(filename);
  }
}
function exportLicenses() {
  if (!mirrorLicenses) return;
  try { atomic(path.join(dataDir, "licencias.json"), read("licencias")); mirrorLicenses = false; }
  catch (error) { console.error("Licencias guardadas en SQLite; exportación JSON pendiente:", error.message); }
}
function database() {
  if (db) return db;
  privateDirectory(dataDir);
  const filename = path.join(dataDir, "maesrp.sqlite");
  for (const suffix of ["", "-wal", "-shm", "-journal"])
    privateFile(filename + suffix);
  db = new DatabaseSync(filename);
  privateFile(filename);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state(name TEXT PRIMARY KEY,value TEXT NOT NULL);",
  );
  return db;
}
function init() {
  // Imported JSON, old queue entries and documents can predate the private
  // file modes. Tighten them in place without deleting or rewriting records.
  hardenPrivateTree(dataDir);
  database();
  for (const d of ["notifications", "processed", "errors"])
    privateDirectory(path.join(dataDir, d));
  for (const d of ["pdfs", "uploads"])
    hardenPrivateTree(path.join(root, "public", d));
  // Do not recursively chmod .runtime: it may include the Node executable.
  privateDirectory(path.join(root, ".runtime"));
  privateFile(path.join(root, ".env"));
  privateFile(path.join(root, "bot/config.json"));
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
  const previousIdentities = name === "cedulas" ? read("cedulas") : {};
  const identityInvalidations = name === "cedulas" ? identityChanges(previousIdentities, value) : [];
  database()
    .prepare(
      "INSERT INTO state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
    )
    .run(name, JSON.stringify(value));
  for (const number of identityInvalidations) {
    pendingIdentityInvalidations.add("cedula_" + number + ".pdf");
    for (const record of [...Object.values(previousIdentities), ...Object.values(value)])
      if (record?.numeroCedula === number) pendingIdentityInvalidations.add(identityFilename(record));
  }
  if (!depth) invalidateIdentityPdfs();
  if (name === "licencias") { mirrorLicenses = true; if (!depth) exportLicenses(); }
  return true;
}
function transaction(fn) {
  const connection = database();
  if (depth) return fn();
  connection.exec("BEGIN IMMEDIATE");
  depth++;
  const previousMirror = mirrorLicenses;
  const previousIdentityInvalidations = new Set(pendingIdentityInvalidations);
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
    if (committed) { invalidateIdentityPdfs(); exportLicenses(); }
    else {
      mirrorLicenses = previousMirror;
      pendingIdentityInvalidations = previousIdentityInvalidations;
    }
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
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600, flag: "wx" });
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
