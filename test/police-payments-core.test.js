const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "maesrp-payments-core-"));
process.env.MAESRP_DATA_DIR = path.join(temp, "data");
require("../lib/config").root = temp;
const store = require("../lib/store");
const domain = require("../bot/domain");
const operations = require("../bot/operations");
const pdf = require("../lib/pdf");
store.init();
after(() => fs.rmSync(temp, { recursive: true, force: true }));
const user = { id: "123456789012345678" };
const police = { id: "987654321098765432", police: true, name: "Agente Ejemplo" };
function fine(id, fields = {}) {
  store.update("multas", list => list.push({ id, userId: user.id, estado: "REGISTRADA", monto: 10, ...fields }));
}
test("pago manual mantiene referencia y responsable originales ante confirmaciones repetidas", () => {
  fine("manual");
  operations.requestPayment(user, "manual");
  const saved = operations.confirmPayment(police, "manual", "Comprobante original");
  assert.equal(saved.paymentRequested.status, "confirmado");
  assert.throws(() => operations.confirmPayment(police, "manual", "Otra referencia"), { status: 409 });
  assert.deepEqual(store.read("multas").find(f => f.id === "manual").payment, saved.payment);
  assert.equal(store.read("audit").filter(a => a.action === "payment.confirm" && a.data.id === "manual").length, 1);
  assert.throws(() => operations.confirmPayment(user, "manual", "Falso"), { status: 403 });
});
test("propiedad, estado anulado y cobro incierto bloquean nuevas solicitudes y confirmaciones", () => {
  fine("other", { userId: "111111111111111111" });
  assert.throws(() => operations.requestPayment(user, "other"), { status: 403 });
  for (const status of ["en-proceso", "no-confirmado", "confirmado"]) {
    fine(status, { paymentAttempt: { status } });
    assert.throws(() => operations.requestPayment(user, status), { status: 409 });
    assert.throws(() => operations.confirmPayment(police, status, "Ref"), { status: 409 });
    assert.equal(store.read("multas").find(f => f.id === status).estado, "REGISTRADA");
  }
  fine("void", { estado: "ANULADA" });
  assert.throws(() => operations.confirmPayment(police, "void", "Ref"), { status: 409 });
  assert.throws(() => operations.requestPayment(user, "void"), { status: 409 });
});
test("un fallo de auditoría revierte la confirmación en la misma transacción", () => {
  fine("rollback");
  const audit = store.audit;
  store.audit = () => { throw Error("fallo simulado de almacenamiento"); };
  try { assert.throws(() => operations.confirmPayment(police, "rollback", "Ref"), /fallo simulado/); }
  finally { store.audit = audit; }
  const saved = store.read("multas").find(f => f.id === "rollback");
  assert.equal(saved.estado, "REGISTRADA");
  assert.equal(saved.payment, undefined);
});
test("registro Discord usa reglas compartidas, guarda auditoría y tolera fallo de notificación sin duplicar", async () => {
  domain.registerCitizen(user, { nombre: "Ana", apellidos: "Ejemplo" });
  const generate = pdf.generate, queue = store.queue;
  pdf.generate = async (type, record) => record.id + ".pdf";
  store.queue = () => { throw Error("cola no disponible"); };
  try {
    const record = await operations.record(police, "multa", user.id, { articulos: [1, 2], valor: "100.125", placa: " abc " });
    assert.equal(record.monto, 100.13);
    assert.equal(record.placa, "ABC");
    assert.equal(Date.parse(record.vence) - Date.parse(record.createdAt), 7 * 86400000);
    assert.equal(record.notificationPending, false);
    assert.equal(store.read("multas").filter(f => f.id === record.id).length, 1);
    assert.ok(store.read("audit").some(a => a.action === "record.create" && a.data.id === record.id));
  } finally { pdf.generate = generate; store.queue = queue; }
});
test("una identidad modificada durante el PDF cancela registro y limpia el documento huérfano", async () => {
  const generate = pdf.generate;
  let document;
  fs.mkdirSync(path.join(temp, "public/pdfs"), { recursive: true });
  pdf.generate = async (type, record) => {
    document = record.id + ".pdf";
    fs.writeFileSync(path.join(temp, "public/pdfs", document), "PDF de prueba");
    store.update("cedulas", records => {
      const c = Object.values(records).find(c => c.discordId === user.id);
      c.nombre = "Nombre rectificado";
    });
    return document;
  };
  try {
    const before = store.read("multas").length;
    await assert.rejects(operations.record(police, "multa", user.id, { articulos: "Art. 1", monto: 50 }), { status: 409 });
    assert.equal(store.read("multas").length, before);
    assert.equal(fs.existsSync(path.join(temp, "public/pdfs", document)), false);
  } finally { pdf.generate = generate; }
});
