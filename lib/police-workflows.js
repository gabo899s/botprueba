const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const defaultStore = require('./store');
const { root, dataDir } = require('./config');
const { documentJob } = require('./bot-resource-limits');
const { pending: paymentPending } = require('../bot/economy');

const collection = type => type === 'multa' ? 'multas' : type === 'arresto' ? 'arrestos' : null;
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const clean = (value, max, min = 0) => {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('Completa los campos con texto válido.');
  return value.trim();
};
const revisionNumber = record => Number(record.revision || 0);
const actor = req => req.user?.discordId || req.user?.id;
const active = record => !['ANULADA', 'ANULADO', 'PAGADA'].includes(record.estado);
const snapshot = record => structuredClone(record);
function page(items, query = {}) {
  const number = (value, fallback, max) => value === undefined ? fallback : /^\d+$/.test(String(value)) && Number(value) >= 1 && Number(value) <= max ? Number(value) : fail('Paginación inválida.');
  const current = number(query.page, 1, 100000), limit = number(query.limit, 20, 50);
  return { items: items.slice((current - 1) * limit, current * limit), total: items.length, page: current, pages: Math.max(1, Math.ceil(items.length / limit)), limit };
}

function createWorkflowService({ store = defaultStore, generate = require('./pdf').generate, assertSession = () => {}, queueDirectory = dataDir } = {}) {
  function record(type, id) {
    const name = collection(type);
    if (!name) fail('Tipo de registro inválido.');
    const found = store.read(name).find(item => item.id === id);
    if (!found) fail('Registro no encontrado.', 404);
    return found;
  }
  function recordLookup() {
    const index = new Map(['multa', 'arresto'].flatMap(type => store.read(collection(type)).map(item => [type + ':' + item.id, item])));
    return (type, id) => {
      if (!collection(type)) fail('Tipo de registro inválido.');
      const found = index.get(type + ':' + id);
      if (!found) fail('Registro no encontrado.', 404);
      return found;
    };
  }
  function access(req, supervisor = false) {
    assertSession(req);
    if (!actor(req)) fail('Inicia sesión.', 401);
    if (!req.user.hasPoliceAccess) fail('Necesitas un rol policial autorizado.', 403);
    if (supervisor && !req.user.isAdmin) fail('La rectificación requiere supervisión administrativa y acceso policial.', 403);
  }
  function matches(row, query) {
    if (query.officer && row.oficialId !== query.officer) return false;
    for (const key of ['from', 'to']) if (query[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(query[key]) || !Number.isFinite(Date.parse(query[key])))) fail('La fecha del filtro es inválida.');
    if (query.from && query.to && query.from > query.to) fail('La fecha inicial no puede ser posterior a la final.');
    const date = String(row.createdAt || '').slice(0, 10);
    if (query.from && date < query.from || query.to && date > query.to) return false;
    const q = String(query.q || '').toLocaleLowerCase('es').slice(0, 100);
    return !q || [row.id, row.documento, row.ciudadano, row.articulos, row.oficialNombre].some(value => String(value || '').toLocaleLowerCase('es').includes(q));
  }
  function records(req, query = {}) {
    access(req);
    if (query.type && !collection(query.type)) fail('Tipo de registro inválido.');
    const rows = ['multa', 'arresto'].filter(type => !query.type || type === query.type).flatMap(type => store.read(collection(type)).map(item => ({ ...item, type })));
    return page(rows.filter(item => matches(item, query)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), query);
  }
  function pending(req, query = {}) {
    access(req);
    if (query.kind && !['payments', 'notifications', 'recent'].includes(query.kind)) fail('Tipo de pendiente inválido.');
    const queues = Object.fromEntries(['errors', 'notifications', 'processed'].map(directory => {
      const ids = new Set();
      try { for (const filename of fs.readdirSync(path.join(queueDirectory, directory))) if (/^[\w-]+\.json$/.test(filename)) ids.add(filename.slice(0, -5)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      return [directory, ids];
    }));
    function delivery(item) {
      // A failure marker remains authoritative if contradictory files exist.
      // Otherwise a real retry/processed entry supersedes a historical DB flag.
      if (queues.errors.has(item.id)) return { status: 'fallida', source: 'errors', retryRequired: true };
      if (queues.notifications.has(item.id)) return { status: 'en-cola', source: 'notifications', retryRequired: false };
      if (queues.processed.has(item.id)) return { status: 'procesada', source: 'processed', retryRequired: false };
      if (item.notificationPending === false || item.notificationError) return { status: 'sin-encolar', source: 'record', retryRequired: true };
      return { status: 'sin-constancia', source: 'record', retryRequired: false };
    }
    const rows = ['multa', 'arresto'].flatMap(type => store.read(collection(type)).flatMap(item => {
      const base = { ...item, type, delivery: delivery(item) };
      const result = [{ ...base, kind: 'recent' }];
      if (type === 'multa' && active(item) && item.paymentRequested?.status === 'pendiente-validacion') result.push({ ...base, kind: 'payments' });
      if (base.delivery.retryRequired) result.push({ ...base, kind: 'notifications' });
      return result;
    })).filter(item => (!query.kind || item.kind === query.kind) && matches(item, query)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { ...page(rows, query), counts: Object.fromEntries(['payments', 'notifications', 'recent'].map(kind => [kind, rows.filter(item => item.kind === kind).length])) };
  }
  function revisions(req, type, id) {
    access(req); const current = record(type, id);
    return { record: current, canRevise: !!req.user.isAdmin, items: store.read('policeRevisions').filter(item => item.type === type && item.recordId === id) };
  }
  async function revise(req, type, id, body = {}) {
    access(req, true);
    const original = record(type, id), expected = body.expectedRevision;
    if (!Number.isSafeInteger(expected) || expected !== revisionNumber(original)) fail('El registro cambió. Recarga antes de revisar.', 409);
    if (expected >= 500) fail('El registro alcanzó el límite de versiones.', 409);
    if (!['rectificar', 'anular'].includes(body.action)) fail('Selecciona rectificar o anular.');
    if (['ANULADA', 'ANULADO'].includes(original.estado)) fail('El registro ya está anulado.', 409);
    if (paymentPending(original.paymentAttempt)) fail('Hay un cobro en proceso o incierto. Concilia la operación antes de rectificar o anular el registro.', 409);
    const reason = clean(body.reason, 1000, 12), changes = body.changes || {};
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) fail('Cambios inválidos.');
    const allowed = new Set(type === 'multa' ? ['articulos', 'monto', 'placa'] : ['articulos', 'tiempo']);
    if (Object.keys(changes).some(key => !allowed.has(key))) fail('No puedes cambiar el titular, los agentes ni asociaciones del registro.');
    const next = snapshot(original);
    if (body.action === 'anular') {
      if (Object.keys(changes).length) fail('La anulación no admite cambios adicionales.');
      next.estado = type === 'multa' ? 'ANULADA' : 'ANULADO';
    } else {
      if (!Object.keys(changes).length) fail('Indica al menos un campo a rectificar.');
      if (original.estado === 'PAGADA' || original.payment || original.paymentAttempt?.status === 'confirmado') fail('Una multa pagada requiere revisión por anulación; no se altera el importe confirmado.', 409);
      for (const [key, value] of Object.entries(changes)) {
        if (key === 'articulos') next.articulos = clean(value, 1500, 1);
        else if (key === 'placa') next.placa = clean(value, 20);
        else {
          if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > (key === 'tiempo' ? 1000000 : 100000000) || key === 'tiempo' && !Number.isInteger(value)) fail('Monto o tiempo inválido.');
          next[key] = key === 'monto' ? Math.round(value * 100) / 100 : value;
        }
      }
    }
    const revision = { id: crypto.randomUUID(), type, recordId: id, number: expected + 1, action: body.action, reason, by: actor(req), byName: req.user.nombreCompleto || actor(req), at: new Date().toISOString(), previous: snapshot(original) };
    return documentJob(actor(req), async () => {
      let filename;
      try {
        filename = await generate(type, {
          ...next,
          id: id + '_revision_' + revision.id,
          articulos: next.articulos + '\n\nCONSTANCIA DE ' + (body.action === 'anular' ? 'ANULACIÓN' : 'RECTIFICACIÓN') +
            '\nRegistro de origen: ' + id + '\nVersión: ' + revision.number + '\nMotivo: ' + reason +
            '\nSupervisor: ' + revision.byName + ' (' + revision.by + ')\nFecha: ' + revision.at,
        });
        access(req, true);
        return store.transaction(() => {
          const current = record(type, id);
          // Compare the whole record: a payment, ownership update or other concurrent
          // operation must not be overwritten by the PDF that finished later.
          if (JSON.stringify(current) !== JSON.stringify(original)) fail('El registro cambió durante la emisión. Recarga y revisa los cambios.', 409);
          next.originalPdfFileName = original.originalPdfFileName || original.pdfFileName;
          next.pdfFileName = filename; next.pdfUrl = '/pdfs/' + filename;
          next.revision = revision.number; next.revisedAt = revision.at;
          next.revisionReason = reason; next.revisedBy = revision.by;
          revision.pdfFileName = filename; revision.snapshot = snapshot(next);
          store.update(collection(type), rows => { rows[rows.findIndex(item => item.id === id)] = next; });
          store.update('policeRevisions', rows => rows.push(revision));
          store.audit(actor(req), 'police.record.' + body.action, { type, recordId: id, revisionId: revision.id, reason });
          return { record: next, revision };
        });
      } catch (error) {
        if (filename && /^[\w-]+\.pdf$/.test(filename)) fs.rmSync(path.join(root, 'public/pdfs', filename), { force: true });
        throw error;
      }
    });
  }
  function references(value, lookup) {
    if (!Array.isArray(value) || !value.length || value.length > 100) fail('Relaciona entre 1 y 100 registros.');
    const seen = new Set();
    return value.map(ref => {
      if (!ref || typeof ref.id !== 'string' || !collection(ref.type)) fail('Referencia de registro inválida.');
      lookup(ref.type, ref.id);
      const key = ref.type + ':' + ref.id;
      if (seen.has(key)) fail('No repitas un registro en el caso.');
      seen.add(key); return { type: ref.type, id: ref.id };
    });
  }
  function caseFields(req, body) {
    const lookup = recordLookup(), refs = references(body.records, lookup);
    const agents = body.agents === undefined ? [actor(req)] : body.agents;
    const knownAgents = new Set([actor(req), ...Object.keys(store.read('infostaff')), ...refs.map(ref => lookup(ref.type, ref.id).oficialId)]);
    if (!Array.isArray(agents) || !agents.length || agents.length > 20 || agents.some(id => typeof id !== 'string' || !knownAgents.has(id))) fail('Selecciona agentes existentes del personal o de los registros.');
    const occurredAt = clean(body.occurredAt, 30, 10);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt))) fail('Fecha y hora del incidente inválidas.');
    const evidence = body.evidence || [];
    if (!Array.isArray(evidence) || evidence.length > 100) fail('Referencias de evidencia inválidas.');
    const seenEvidence = new Set();
    for (const ref of evidence) {
      if (!ref || !refs.some(item => item.type === ref.type && item.id === ref.id) || !lookup(ref.type, ref.id).imagenFileName) fail('La evidencia debe pertenecer a un registro relacionado con el caso.');
      const key = ref.type + ':' + ref.id;
      if (seenEvidence.has(key)) fail('No repitas una evidencia.');
      seenEvidence.add(key);
    }
    return { title: clean(body.title, 160, 5), narrative: clean(body.narrative, 8000, 20), location: clean(body.location, 200, 3), occurredAt, agents: [...new Set(agents)], records: refs, evidence: evidence.map(ref => ({ type: ref.type, id: ref.id })) };
  }
  function caseView(item, lookup = recordLookup()) {
    const refs = item.records.map(ref => {
      try { return { type: ref.type, ...lookup(ref.type, ref.id) }; } catch { return { type: ref.type, id: ref.id, unavailable: true }; }
    });
    return { ...item, linkedRecords: refs, linkedEvidence: item.evidence.flatMap(ref => {
      const current = refs.find(row => row.type === ref.type && row.id === ref.id);
      return current?.imagenFileName ? [{ type: ref.type, id: ref.id, url: '/uploads/' + encodeURIComponent(current.imagenFileName) }] : [];
    }) };
  }
  function cases(req, query = {}) {
    access(req);
    if (query.status && !['abierto', 'cerrado'].includes(query.status)) fail('Estado inválido.');
    const q = String(query.q || '').toLowerCase().slice(0, 100);
    const result = page(store.read('policeCases').filter(item => (!query.status || item.status === query.status) && (!q || [item.id, item.title, item.location].some(v => v.toLowerCase().includes(q)))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), query);
    // The list is a summary. Resolve records, evidence and the potentially long
    // immutable history only when opening a single case.
    result.items = result.items.map(item => Object.fromEntries(['id', 'title', 'status', 'version', 'location', 'occurredAt', 'agents', 'records', 'evidence', 'createdBy', 'createdAt', 'updatedAt'].map(key => [key, item[key]])));
    return result;
  }
  function caseDetail(req, id) {
    access(req); const item = store.read('policeCases').find(item => item.id === id);
    if (!item) fail('Caso no encontrado.', 404); return caseView(item);
  }
  function createCase(req, body) {
    access(req); const fields = caseFields(req, body);
    const item = { ...fields, id: 'caso_' + crypto.randomUUID(), status: 'abierto', version: 1, createdBy: actor(req), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), history: [] };
    store.transaction(() => {
      store.update('policeCases', rows => { if (rows.length >= 20000) fail('Se alcanzó el cupo de casos.', 409); rows.push(item); });
      store.audit(actor(req), 'police.case.create', { id: item.id, records: fields.records });
    }); return caseView(item);
  }
  function updateCase(req, id, body) {
    access(req);
    return store.transaction(() => {
      const prior = caseDetail(req, id);
      if (prior.createdBy !== actor(req) && !req.user.isAdmin) fail('Solo el creador o un supervisor policial puede modificar este caso.', 403);
      if (body.expectedVersion !== prior.version) fail('El caso cambió. Recarga antes de continuar.', 409);
      const reason = clean(body.reason, 1000, 12);
      const fields = caseFields(req, body);
      if (!['abierto', 'cerrado'].includes(body.status)) fail('Estado de caso inválido.');
      let saved;
      store.update('policeCases', rows => {
        const index = rows.findIndex(row => row.id === id), original = rows[index];
        if (original.history.length >= 500) fail('El caso alcanzó el límite de revisiones.', 409);
        const { history, ...before } = original;
        saved = { ...original, ...fields, status: body.status, updatedAt: new Date().toISOString(), version: original.version + 1, history: [...history, { by: actor(req), at: new Date().toISOString(), reason, previous: before }] };
        rows[index] = saved;
      });
      store.audit(actor(req), 'police.case.update', { id, reason, version: saved.version });
      return caseView(saved);
    });
  }
  return { records, pending, revisions, revise, cases, caseDetail, createCase, updateCase };
}

function mountPoliceWorkflows(app, { auth, police, wrap, assertSession, ...dependencies }) {
  const service = createWorkflowService({ assertSession, ...dependencies });
  const get = (url, handler) => app.get('/api/police/workflows' + url, auth, police, wrap(async (req, res) => res.json({ success: true, ...handler(req) })));
  get('/pending', req => service.pending(req, req.query));
  get('/records', req => service.records(req, req.query));
  get('/records/:type/:id/revisions', req => service.revisions(req, req.params.type, req.params.id));
  app.post('/api/police/workflows/records/:type/:id/revisions', auth, police, wrap(async (req, res) => res.json({ success: true, ...await service.revise(req, req.params.type, req.params.id, req.body) })));
  get('/cases', req => service.cases(req, req.query));
  get('/cases/:id', req => ({ item: service.caseDetail(req, req.params.id) }));
  app.post('/api/police/workflows/cases', auth, police, wrap(async (req, res) => res.status(201).json({ success: true, item: service.createCase(req, req.body) })));
  app.patch('/api/police/workflows/cases/:id', auth, police, wrap(async (req, res) => res.json({ success: true, item: service.updateCase(req, req.params.id, req.body) })));
}
module.exports = { mountPoliceWorkflows, createWorkflowService };
