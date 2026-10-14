const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'maesrp-runtime-'));
process.env.MAESRP_DATA_DIR = temp;
const { examMessage } = require('../bot/runtime');
const settings = require('../bot/settings');
const { PRCClient } = require('../bot/prc');
after(() => fs.rmSync(temp, { recursive: true, force: true }));

test('licencia reprobada no muestra etiquetas de whitelist ni concede roles', async () => {
  let payload;
  await examMessage({ update: async p => { payload = p; } }, 'license', {
    completed: true, passed: false, score: 3, total: 10,
  });
  const description = payload.components[0].toJSON().components.filter(c => c.type === 10).map(c => c.content).join("\n");
  assert.match(description, /No aprobado/);
  assert.match(description, /licencia no se ha concedido/);
  assert.doesNotMatch(description, /Whitelist/);
  assert.equal(payload.components[0].toJSON().type, 17);
});

test('whitelist aprobada conserva el paso de segunda fase', async () => {
  let payload;
  await examMessage({ update: async p => { payload = p; } }, 'whitelist', {
    completed: true, passed: true, score: 11, total: 11,
  });
  assert.match(payload.components[0].toJSON().components.filter(c => c.type === 10).map(c => c.content).join("\n"), /pendiente de segunda fase/);
});

test('opciones largas permanecen completas en el examen y seleccionables por índice', async () => {
  let payload;
  const long = 'Una respuesta extensa '.repeat(8);
  await examMessage({ editReply: async p => { payload = p; } }, 'license', {
    id: 'exam', index: 0, total: 10, question: 'Pregunta', options: [long, 'Otra'],
  });
  assert.ok(payload.components[0].toJSON().components.filter(c => c.type === 10).map(c => c.content).join("\n").includes(long));
  const options = payload.components[0].toJSON().components.find(c => c.type === 1).components[0].options;
  assert.equal(options[0].label.length, 100);
  assert.equal(options[0].value, '0');
  assert.equal(options[1].value, '1');
});

test('permisos aceptan roles de API y managers incompletos sin conceder acceso', () => {
  assert.equal(settings.allowed({ roles: {} }, 'admin'), false);
  assert.equal(settings.allowed({ roles: { cache: new Map() } }, 'admin'), false);
  assert.equal(settings.allowed({ roles: [] }, 'admin'), false);
});

test('ER:LC rechaza comandos vacíos antes de enviar solicitudes', () => {
  const prc = new PRCClient({ serverKey: 'test', fetchImpl: () => { throw Error('No debe ejecutarse'); } });
  assert.throws(() => prc.command('   '), /inválido/);
});
