const { test, after } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "maesrp-domain-"));
process.env.MAESRP_DATA_DIR = temp;
const store = require("../lib/store"),
  d = require("../bot/domain"),
  settings = require("../bot/settings"),
  operations = require("../bot/operations"),
  { PRCClient } = require("../bot/prc"),
  { commands } = require("../bot/commands"),
  { buildMessage } = require("../bot/message-builder"),
  economy = require("../bot/economy");
store.init();
const admin = { id: "987654321098765432", name: "Admin", local: true },
  person = { id: "123456789012345678" },
  other = { id: "111111111111111111" };
after(() => fs.rmSync(temp, { recursive: true, force: true }));
test("esquemas de comandos completos, sin nombres duplicados", () => {
  const names = new Set();
  assert.ok(commands.length > 50);
  for (const c of commands) {
    assert.ok(!names.has(c.name));
    names.add(c.name);
    const json = c.data.toJSON();
    assert.equal(json.name, c.name);
    assert.ok(json.description.length <= 100);
  }
  assert.ok(names.has("erlc"));
  assert.ok(names.has("ticket-sys"));
});
test("persistencia transaccional revierte cambios al fallar", () => {
  assert.throws(() =>
    store.transaction(() => {
      store.write("messages", { fake: true });
      throw Error("rollback");
    }),
  );
  assert.deepEqual(store.read("messages"), {});
});
test("identidad y vehículos integrados rechazan duplicados y datos ajenos", () => {
  const c = d.registerCitizen(person, { nombre: "Ana", apellidos: "Prueba" });
  assert.equal(c.discordId, person.id);
  assert.throws(() =>
    d.registerCitizen(person, { nombre: "Otra", apellidos: "Prueba" }),
  );
  d.registerVehicle(person, { placa: "ABC123", modelo: "Sedán" });
  assert.throws(() =>
    d.registerVehicle(person, { placa: "ABC123", modelo: "Sedán" }),
  );
  assert.throws(() => d.removeVehicle(person, person.id, "ABC123"));
});
test("bancos recuperados tienen todas las respuestas seleccionables", () => {
  assert.equal(Object.keys(d.licenseQuestions).length, 12);
  assert.equal(Object.values(d.licenseQuestions).flat().length, 120);
  assert.equal(d.whitelistQuestions.length, 11);
  assert.equal(d.articles.length, 34);
  for (const q of Object.values(d.licenseQuestions).flat())
    assert.ok(q.options.includes(q.correct), q.question);
});
test("examen bloquea repetición, suplantación y doble respuesta; registra licencia aprobada", () => {
  let e = d.startExam(person, "license", "B1");
  assert.throws(() => d.startExam(person, "license", "B1"));
  assert.throws(() => d.answerExam(other, "license", e.id, e.index, 0));
  const first = e;
  for (const q of d.licenseQuestions.B1)
    e = d.answerExam(
      person,
      "license",
      e.id,
      e.index,
      q.options.indexOf(q.correct),
    );
  assert.equal(e.passed, true);
  assert.equal(e.score, 10);
  assert.equal(store.read("licencias")[person.id][0].tipo, "B1");
  assert.throws(() => d.answerExam(person, "license", first.id, 0, 0));
});
test("whitelist aprobada queda en segunda fase hasta revisión del staff", () => {
  let e = d.startExam(person, "whitelist");
  for (const q of d.whitelistQuestions)
    e = d.answerExam(
      person,
      "whitelist",
      e.id,
      e.index,
      q.opciones.findIndex((o) => o.correcta),
    );
  assert.equal(store.read("whitelist")[person.id].status, "segunda-fase");
  assert.throws(() => d.reviewWhitelist(other, person.id, true));
  d.reviewWhitelist(admin, person.id, true, "RobloxTest");
  assert.equal(store.read("whitelist")[person.id].status, "aceptado");
});
test("turno pausa y reanuda sin sumar descansos y contabiliza una sola vez", () => {
  store.write("settings", { minimumShiftMinutes: 1 });
  const start = 1000000;
  d.shift(admin, "start", start);
  assert.throws(() => d.shift(admin, "start", start));
  d.shift(admin, "pause", start + 60000);
  d.shift(admin, "resume", start + 180000);
  const s = d.shift(admin, "stop", start + 240000);
  assert.equal(s.history[0].activeMs, 120000);
  assert.equal(store.read("horasactividad")[admin.id].horas, 120000 / 3600000);
  assert.throws(() => d.shift(admin, "stop", start + 300000));
});
test("ausencias necesitan fechas válidas y decisión administrativa", () => {
  const start = new Date(Date.now() + 86400000).toISOString(),
    end = new Date(Date.now() + 172800000).toISOString();
  assert.throws(() => d.requestLoa(person, "Motivo", start, end));
  const l = d.requestLoa(admin, "Vacaciones", start, end);
  assert.throws(() => d.decideLoa(person, l.id, true));
  d.decideLoa(admin, l.id, true);
  assert.equal(store.read("loa")[0].status, "aceptada");
});
test("sanciones, apelaciones y revocación mantienen historial y permisos", () => {
  store.write("settings", { sanctionCooldownSeconds: 0 });
  assert.throws(() => d.sanction(person, other.id, "Prueba"));
  const s = d.sanction(admin, person.id, "Prueba");
  assert.throws(() => d.appeal(other, person.id, s.id, "No"));
  d.appeal(person, person.id, s.id, "Apelación");
  d.decideAppeal(admin, person.id, s.id, true);
  assert.equal(d.sanctions(person.id)[0].estado, "revocada");
  d.editSanction(admin, person.id, s.id, "Motivo corregido");
  assert.equal(d.sanctions(person.id)[0].changes.length, 1);
});
test("votos persistentes y únicos por usuario; público no puede votar como staff", () => {
  const p = d.createPoll(admin, 2, 1, "20:00");
  d.vote(person, p.id, "si");
  d.vote(person, p.id, "no");
  assert.equal(Object.keys(store.read("polls")[p.id].votes).length, 1);
  assert.throws(() => d.vote(person, p.id, "staff"));
  d.closePoll(admin, p.id, "cerrado");
  assert.throws(() => d.vote(person, p.id, "si"));
});
test("tickets protegen reclamación y evaluación, sin duplicar métricas", () => {
  const t = d.ticketCreate(person, "Consulta");
  assert.throws(() => d.ticketCreate(person, "Otra"));
  assert.throws(() => d.ticketClaim(other, t.id));
  d.ticketClaim(admin, t.id);
  d.ticketClose(admin, t.id);
  assert.throws(() => d.ticketClose(admin, t.id));
  assert.throws(() => d.ticketRate(other, t.id, 5));
  d.ticketRate(person, t.id, 5);
  assert.throws(() => d.ticketRate(person, t.id, 5));
  assert.equal(store.read("tickets").stats[admin.id].cerrados, 1);
});
test("cliente ER:LC usa ruta v1 y Server-Key; serializa peticiones", async () => {
  let active = 0,
    max = 0;
  const seen = [];
  const p = new PRCClient({
    serverKey: "test",
    delay: 0,
    fetchImpl: async (url, opts) => {
      active++;
      max = Math.max(max, active);
      seen.push([url, opts]);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  await Promise.all([p.status(), p.players(), p.command(":h Prueba")]);
  assert.equal(max, 1);
  assert.equal(
    seen[2][0],
    "https://api.policeroleplay.community/v1/server/command",
  );
  assert.equal(seen[2][1].headers["Server-Key"], "test");
  assert.deepEqual(JSON.parse(seen[2][1].body), { command: ":h Prueba" });
});
test("una operación ER:LC no confirmada no se reintenta ni se marca aplicada", async () => {
  let calls = 0;
  const prc = new PRCClient({
    serverKey: "test",
    delay: 0,
    fetchImpl: async () => {
      calls++;
      throw Error("timeout");
    },
  });
  const r = await operations.ban(
    admin,
    person.id,
    "RobloxTest",
    "Motivo",
    1,
    prc,
  );
  assert.equal(r.status, "no-confirmado");
  assert.equal(calls, 1);
  assert.equal(store.read("bans")[0].status, "no-confirmado");
});
test("mensajes Components V2 soportan separadores y galería sin content incompatible", () => {
  const value = buildMessage({
    color: "FF1E1E",
    content:
      "Texto [separador] https://cdn.discordapp.com/attachments/123/456/image.png",
  }).toJSON();
  assert.equal(value.type, 17);
  assert.equal(value.components.length, 3);
});
test("economía rechaza cobro repetido tras incertidumbre y no marca falso pago", async () => {
  store.update("multas", (list) =>
    list.push({
      id: "test-fine",
      userId: person.id,
      monto: 10,
      estado: "REGISTRADA",
    }),
  );
  let calls = 0;
  const fake = async (url, opts) => {
    calls++;
    if (opts.method === "PATCH") throw Error("timeout");
    return { ok: true, json: async () => ({ cash: 100 }) };
  };
  await assert.rejects(
    economy.pay(person, "test-fine", {
      fetchImpl: fake,
      token: "test",
      guild: "test",
    }),
  );
  assert.equal(store.read("multas")[0].paymentAttempt.status, "no-confirmado");
  await assert.rejects(
    economy.pay(person, "test-fine", {
      fetchImpl: fake,
      token: "test",
      guild: "test",
    }),
  );
  assert.equal(calls, 2);
  assert.equal(store.read("multas")[0].estado, "REGISTRADA");
});
