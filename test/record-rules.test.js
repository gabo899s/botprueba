const { test } = require("node:test");
const assert = require("node:assert/strict");
const { recordFields, limits } = require("../lib/record-rules");
const at = Date.parse("2026-10-18T12:00:00Z");
test("web y Discord reciben monto, placa y vencimiento canónicos con ambos alias", () => {
  const web = recordFields("multa", { valor: "100.567", articulos: "Art. 1", placa: " abc123 " }, at);
  assert.deepEqual(web, recordFields("multa", { monto: 100.567, articulos: "Art. 1", placa: "ABC123" }, at));
  assert.equal(web.monto, 100.57);
  assert.equal(web.vence, "2026-10-25T12:00:00.000Z");
  assert.equal(limits.dueDays, 7);
  assert.throws(() => recordFields("multa", { monto: 10, valor: 20, articulos: "Art. 1" }), /no coinciden/);
});
test("cálculo de catálogo no cobra artículos duplicados y rechaza artículos desconocidos", () => {
  assert.equal(recordFields("multa", { articulos: "Art. 1, Artículo 2, Art. 1" }, at).monto, 400);
  const selected = recordFields("multa", { articulos: [1, 2, 1] }, at);
  assert.equal(selected.articulos, "Art. 1, Art. 2");
  assert.equal(selected.monto, 400);
  assert.throws(() => recordFields("multa", { articulos: "Art. 1, Art. 999" }, at), /catálogo/);
  assert.throws(() => recordFields("multa", { monto: 0, articulos: "Art. 1" }), /límite/);
});
test("límites compartidos rechazan tipos coercibles, sentencias fraccionadas y entradas ambiguas", () => {
  for (const monto of [true, [], {}, Infinity, -1, 0.001, 100000001])
    assert.throws(() => recordFields("multa", { monto, articulos: "Art. 1" }));
  for (const tiempo of [true, [], 0, 1.5, 1000001])
    assert.throws(() => recordFields("arresto", { tiempo, articulos: "Art. 1" }));
  assert.deepEqual(recordFields("arresto", { tiempo: "1000000", articulos: " Art. 1 " }), { articulos: "Art. 1", tiempo: 1000000 });
  assert.throws(() => recordFields("invalid", { articulos: "Art. 1" }));
  assert.throws(() => recordFields("multa", { monto: 1, articulos: "a".repeat(1501) }));
});
