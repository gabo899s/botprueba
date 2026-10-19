const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorkflowService, mountPoliceWorkflows } = require('../lib/police-workflows');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
let sequence = 0;
function fixture(extra = {}) {
  const owner = '123456789012345678', id = String(++sequence).padStart(18, '5');
  const original = { id: 'multa_demo_' + sequence, userId: owner, documento: 'RP-100', ciudadano: 'Persona de prueba', oficialId: id, oficialNombre: 'Oficial de prueba', monto: 400, articulos: 'Art. 1', estado: 'REGISTRADA', createdAt: '2026-10-15T12:00:00.000Z', pdfFileName: 'multa_original.pdf', imagenFileName: 'evidence.png', paymentRequested: { status: 'pendiente-validacion' }, notificationPending: false };
  let state = { multas: [original], arrestos: [{ ...original, id: 'arresto_demo_' + sequence, tiempo: 2 }], policeCases: [], policeRevisions: [], infostaff: {}, audit: [] };
  const store = {
    read: name => structuredClone(state[name]),
    write: (name, value) => { state[name] = structuredClone(value); },
    update(name, fn) { const value = this.read(name); const result = fn(value); this.write(name, value); return result; },
    transaction(fn) { const before = structuredClone(state); try { return fn(); } catch (error) { state = before; throw error; } },
    audit(by, action, data) { this.update('audit', rows => rows.push({ by, action, data })); }
  };
  const req = { user: { id, discordId: id, hasPoliceAccess: true, isAdmin: true, nombreCompleto: 'Supervisor de prueba' }, sid: 'test' };
  let valid = true;
  const service = createWorkflowService({ store, queueDirectory: path.join(os.tmpdir(), 'maes-fixture-queues-not-created-' + sequence), assertSession: () => { if (!valid) throw Object.assign(Error('Sesión cerrada'), { status: 401 }); }, generate: async (type, record) => record.id + '.pdf', ...extra });
  const body = { action: 'rectificar', reason: 'Rectificación de prueba documentada', expectedRevision: 0, changes: { monto: 250, articulos: 'Art. 2' } };
  const caseBody = { title: 'Incidente de prueba', narrative: 'Narrativa completa de un incidente ficticio documentado.', location: 'Cruce central', occurredAt: '2026-10-15T12:00:00.000Z', records: [{ type: 'multa', id: original.id }], evidence: [{ type: 'multa', id: original.id }] };
  return { service, store, req, original, body, caseBody, expire: () => { valid = false; } };
}

test('mesa filtra pagos, notificaciones y actuaciones con paginación', () => {
  const { service, req, original } = fixture();
  const pending = service.pending(req, { kind: 'payments', from: '2026-10-01', to: '2026-10-31', officer: original.oficialId });
  assert.equal(pending.total, 1); assert.equal(pending.items[0].id, original.id);
  assert.equal(service.pending(req, { kind: 'notifications' }).total, 2);
  assert.equal(service.pending(req, { kind: 'recent', officer: 'missing' }).total, 0);
  assert.equal(service.records(req, { q: 'RP-100', limit: '1', page: '2' }).items.length, 1);
  assert.throws(() => service.records(req, { page: '-1' }), /Paginación/);
  assert.throws(() => service.pending(req, { from: 'oops' }), /fecha/);
});

test('colas actuales reemplazan errores históricos tras reencolar o procesar, manteniendo errors autoritativo', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maes-police-queue-fixture-'));
  try {
    for (const name of ['errors', 'notifications', 'processed']) fs.mkdirSync(path.join(directory, name));
    const f = fixture({ queueDirectory: directory });
    f.store.update('multas', rows => { rows[0].notificationError = 'Fallo de encolado histórico'; });
    assert.equal(f.service.pending(f.req, { kind: 'notifications' }).total, 2);
    const queued = path.join(directory, 'notifications', f.original.id + '.json');
    const processed = path.join(directory, 'processed', f.original.id + '.json');
    const failed = path.join(directory, 'errors', f.original.id + '.json');
    fs.writeFileSync(queued, JSON.stringify({ type: 'multa', data: f.original }));
    assert.equal(f.service.pending(f.req, { kind: 'notifications' }).total, 1);
    let current = f.service.pending(f.req, { kind: 'recent' }).items.find(item => item.id === f.original.id);
    assert.deepEqual(current.delivery, { status: 'en-cola', source: 'notifications', retryRequired: false });
    fs.renameSync(queued, processed);
    assert.equal(f.service.pending(f.req, { kind: 'notifications' }).total, 1);
    current = f.service.pending(f.req, { kind: 'recent' }).items.find(item => item.id === f.original.id);
    assert.deepEqual(current.delivery, { status: 'procesada', source: 'processed', retryRequired: false });
    fs.writeFileSync(failed, JSON.stringify({ type: 'multa', data: f.original, attempts: 5 }));
    const errors = f.service.pending(f.req, { kind: 'notifications' });
    assert.equal(errors.total, 2);
    assert.deepEqual(errors.items.find(item => item.id === f.original.id).delivery, { status: 'fallida', source: 'errors', retryRequired: true });
    fs.unlinkSync(failed);
    assert.equal(f.service.pending(f.req, { kind: 'notifications' }).total, 1);
    assert.equal(f.store.read('multas')[0].notificationError, 'Fallo de encolado histórico');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('administrador sin policial sigue denegado y policial sin admin no rectifica', async () => {
  const f = fixture(); f.req.user.hasPoliceAccess = false;
  assert.throws(() => f.service.cases(f.req), { status: 403 });
  await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, f.body), { status: 403 });
  f.req.user.hasPoliceAccess = true; f.req.user.isAdmin = false;
  assert.equal(f.service.revisions(f.req, 'multa', f.original.id).canRevise, false);
  await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, f.body), { status: 403 });
});

test('rectificación conserva original, titular, versiones y auditoría', async () => {
  const f = fixture();
  const result = await f.service.revise(f.req, 'multa', f.original.id, f.body);
  assert.equal(result.record.id, f.original.id);
  assert.equal(result.record.monto, 250);
  assert.equal(result.record.userId, f.original.userId);
  assert.equal(result.record.originalPdfFileName, f.original.pdfFileName);
  assert.notEqual(result.record.pdfFileName, f.original.pdfFileName);
  const versions = f.store.read('policeRevisions');
  assert.deepEqual(versions[0].previous, f.original);
  assert.equal(versions[0].snapshot.monto, 250);
  assert.equal(f.store.read('audit')[0].action, 'police.record.rectificar');
  await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, f.body), { status: 409 });
});

test('no permite cambiar dueño, agente, evidencia o importe pagado', async () => {
  const f = fixture();
  for (const field of ['userId', 'documento', 'oficialId', 'imagenFileName', 'pdfFileName']) {
    await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, { ...f.body, changes: { [field]: 'forged' } }), /titular/);
  }
  f.store.update('multas', rows => { rows[0].estado = 'PAGADA'; });
  await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, f.body), { status: 409 });
  assert.equal(f.store.read('policeRevisions').length, 0);
});

test('anulación motivada crea nueva emisión sin borrar pago ni documento de origen', async () => {
  const f = fixture();
  f.store.update('multas', rows => { rows[0].estado = 'PAGADA'; rows[0].payment = { reference: 'ref-original' }; });
  const result = await f.service.revise(f.req, 'multa', f.original.id, { ...f.body, action: 'anular', changes: {} });
  assert.equal(result.record.estado, 'ANULADA');
  assert.equal(result.record.payment.reference, 'ref-original');
  assert.equal(f.service.pending(f.req, { kind: 'payments' }).total, 0);
  await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, { ...f.body, expectedRevision: 1, action: 'anular', changes: {} }), { status: 409 });
});

test('rectificar o anular exige conciliar primero un cobro en proceso o incierto', async () => {
  const f = fixture();
  for (const status of ['en-proceso', 'no-confirmado']) {
    f.store.update('multas', rows => { rows[0].paymentAttempt = { id: 'pending-attempt', amount: 400, status }; });
    for (const action of ['rectificar', 'anular']) await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, { ...f.body, action, changes: action === 'anular' ? {} : f.body.changes }), { status: 409 });
  }
  f.store.update('multas', rows => { rows[0].paymentAttempt.status = 'confirmado'; });
  await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, f.body), { status: 409 });
  f.store.update('multas', rows => { delete rows[0].paymentAttempt; rows[0].payment = { reference: 'legacy-confirmation' }; });
  await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, f.body), { status: 409 });
  assert.equal(f.store.read('policeRevisions').length, 0);
  assert.equal(f.store.read('multas')[0].monto, 400);
});

test('error de persistencia después de emitir PDF revierte registro, versiones y auditoría juntos', async () => {
  const f = fixture(); const update = f.store.update.bind(f.store);
  f.store.update = (name, fn) => { if (name === 'policeRevisions') throw Error('Fixture storage failure'); return update(name, fn); };
  await assert.rejects(() => f.service.revise(f.req, 'multa', f.original.id, f.body), /Fixture storage failure/);
  assert.deepEqual(f.store.read('multas')[0], f.original);
  assert.equal(f.store.read('policeRevisions').length, 0);
  assert.equal(f.store.read('audit').length, 0);
});

test('sesión cerrada o pago concurrente durante PDF no publica revisión', async () => {
  let current;
  current = fixture({ generate: async () => { current.expire(); return 'test_revision_session_closed.pdf'; } });
  await assert.rejects(() => current.service.revise(current.req, 'multa', current.original.id, current.body), { status: 401 });
  assert.equal(current.store.read('policeRevisions').length, 0);
  let race;
  race = fixture({ generate: async () => { race.store.update('multas', rows => { rows[0].estado = 'PAGADA'; }); return 'test_revision_concurrent_payment.pdf'; } });
  await assert.rejects(() => race.service.revise(race.req, 'multa', race.original.id, race.body), { status: 409 });
  assert.equal(race.store.read('multas')[0].estado, 'PAGADA'); assert.equal(race.store.read('policeRevisions').length, 0);
});

test('casos agrupan solo registros/evidencias existentes y agentes conocidos', () => {
  const f = fixture();
  assert.throws(() => f.service.createCase(f.req, { ...f.caseBody, evidence: [{ url: 'https://example.test/x' }] }), /evidencia/);
  assert.throws(() => f.service.createCase(f.req, { ...f.caseBody, records: [{ type: 'multa', id: 'missing' }] }), { status: 404 });
  assert.throws(() => f.service.createCase(f.req, { ...f.caseBody, agents: ['unrelated'] }), /agentes/);
  const item = f.service.createCase(f.req, { ...f.caseBody, createdBy: 'forged' });
  assert.equal(item.createdBy, f.req.user.id);
  assert.equal(item.linkedRecords[0].id, f.original.id);
  assert.equal(item.linkedEvidence[0].url, '/uploads/evidence.png');
  assert.equal(f.service.cases(f.req, { status: 'abierto' }).total, 1);
});

test('actualizar caso exige creador o supervisor y deja historial inmutable', () => {
  const f = fixture(); const item = f.service.createCase(f.req, f.caseBody);
  const update = { ...f.caseBody, title: 'Incidente corregido', status: 'cerrado', reason: 'Se completó la verificación del incidente', expectedVersion: 1 };
  f.req.user.id = f.req.user.discordId = '923456789012345678'; f.req.user.isAdmin = false;
  assert.throws(() => f.service.updateCase(f.req, item.id, update), { status: 403 });
  f.req.user.isAdmin = true;
  const revised = f.service.updateCase(f.req, item.id, update);
  assert.equal(revised.history[0].previous.title, item.title);
  assert.equal(revised.version, 2); assert.equal(revised.status, 'cerrado');
  assert.equal(f.service.cases(f.req, { status: 'abierto' }).total, 0);
  assert.throws(() => f.service.updateCase(f.req, item.id, update), { status: 409 });
});

test('todas las rutas pasan por auth y policial antes del servicio', () => {
  const routes = [], auth = () => {}, police = () => {};
  const app = Object.fromEntries(['get', 'post', 'patch'].map(method => [method, (...args) => routes.push({ method, args })]));
  mountPoliceWorkflows(app, { auth, police, wrap: fn => fn, assertSession: () => {} });
  assert.equal(routes.length, 8);
  for (const { args } of routes) { assert.equal(args[1], auth); assert.equal(args[2], police); assert.match(args[0], /^\/api\/police\/workflows\//); }
});

test('interfaz muestra errores de autorización sin crear acciones sensibles ni HTML inyectado', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/js/police-workflows.js'), 'utf8');
  const dom = new JSDOM('<section id="policeWorkflows"></section>', { runScripts: 'outside-only', url: 'http://localhost/police-tools' });
  dom.window.fetch = async () => ({ ok: false, json: async () => ({ message: 'Inicia sesión.' }) });
  dom.window.eval(source);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.match(dom.window.document.querySelector('[role=status]').textContent, /Inicia sesión/);
  assert.equal(dom.window.document.querySelectorAll('script').length, 0);
  assert.equal(source.includes('innerHTML'), false);
  assert.equal(source.includes('onclick='), false);
  dom.window.close();
});

test('UI solo enlaza documentos canónicos relativos y trata contenido importado como texto', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/js/police-workflows.js'), 'utf8');
  const dom = new JSDOM('<section id="policeWorkflows"></section>', { runScripts: 'outside-only', url: 'http://localhost/police-tools' });
  const malicious = ['javascript:alert(1)', 'https://example.test/legacy.pdf', '../outside.pdf', 'wrong%2Fpath.pdf', '//example.test/x.pdf'];
  const base = { type: 'multa', id: 'fixture', ciudadano: '<img src=x onerror=alert(1)>', documento: 'RP-100', articulos: '<script>alert(1)</script>', estado: 'REGISTRADA', monto: 10, createdAt: '2026-10-01T12:00:00Z', kind: 'recent', pdfUrl: 'javascript:alert(1)' };
  dom.window.fetch = async () => ({ ok: true, json: async () => ({ success: true, counts: { payments: 0, notifications: 0, recent: 6 }, items: [...malicious.map(pdfFileName => ({ ...base, pdfFileName })), { ...base, pdfFileName: 'valid_uuid-100.pdf' }], page: 1, pages: 1, total: 6 }) });
  dom.window.eval(source); await new Promise(resolve => setTimeout(resolve, 20));
  const links = [...dom.window.document.querySelectorAll('a')];
  assert.deepEqual(links.map(link => link.getAttribute('href')), ['/pdfs/valid_uuid-100.pdf']);
  assert.equal(dom.window.document.querySelectorAll('img,script').length, 0);
  assert.equal(dom.window.document.querySelectorAll('span.pw-muted').length, 5);
  dom.window.close();
});
