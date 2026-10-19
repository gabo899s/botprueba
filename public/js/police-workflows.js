(() => {
  'use strict';
  const host = document.getElementById('policeWorkflows');
  if (!host) return;
  const endpoint = '/api/police/workflows';
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
  const button = (text, action, cls = '') => { const el = node('button', text, 'pw-button ' + cls); el.type = 'button'; el.addEventListener('click', action); return el; };
  const link = (text, href) => {
    if (typeof href !== 'string' || !/^\/(?:pdfs\/[A-Za-z0-9_-]+\.pdf|uploads\/[A-Za-z0-9_-]+\.(?:png|jpg|jpeg))$/.test(href)) return node('span', text + ' · enlace no disponible', 'pw-muted');
    const a = node('a', text, 'pw-link'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a;
  };
  const status = node('p', '', 'pw-notice'); status.setAttribute('role', 'status'); status.hidden = true;
  function announce(message, error = false) { status.textContent = message; status.classList.toggle('pw-error', error); status.hidden = !message; }
  async function api(route, body, method = 'POST') {
    const response = await fetch(endpoint + route, { headers: { 'X-Local-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { method, body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw Error(result.message || 'No se pudo completar la operación.');
    return result;
  }
  const date = value => value ? new Date(value).toLocaleString('es-CR') : 'No consignada';
  function field(form, title, name, type = 'text', value = '') {
    const label = node('label', undefined, 'pw-field'); label.append(node('span', title));
    const input = node(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
    input.name = name;
    if (!['textarea', 'select'].includes(type)) input.type = type;
    input.value = value;
    label.append(input); form.append(label); return input;
  }
  function select(form, title, name, options) { const el = field(form, title, name, 'select'); for (const [value, title] of options) el.append(new Option(title, value)); return el; }
  async function run(action) { announce(''); try { await action(); } catch (error) { announce(error.message, true); } }
  async function submit(button, action, feedback) { button.disabled = true; feedback.textContent = ''; try { await action(); } catch (error) { feedback.textContent = error.message; } finally { button.disabled = false; } }
  function dialog(title) {
    const modal = node('dialog', undefined, 'pw-dialog');
    const heading = node('h3', title), close = button('Cerrar', () => modal.close(), 'pw-secondary');
    const head = node('div', undefined, 'pw-dialog-head'); head.append(heading, close);
    const content = node('div', undefined, 'pw-dialog-content');
    const error = node('p', '', 'pw-error'); error.setAttribute('role', 'alert');
    modal.append(head, content, error); host.append(modal);
    modal.addEventListener('close', () => modal.remove(), { once: true });
    modal.showModal(); return { modal, content, error };
  }
  const header = node('header', undefined, 'pw-heading');
  const brand = node('p', 'MAES · UNIDAD POLICIAL', 'pw-eyebrow');
  header.append(brand, node('h2', 'Mesa de operaciones'), node('p', 'Pagos pendientes, actuaciones y expedientes con trazabilidad.', 'pw-muted'));
  const tabs = node('nav', undefined, 'pw-tabs'); tabs.setAttribute('aria-label', 'Herramientas de gestión policial');
  const body = node('div', undefined, 'pw-body');
  host.classList.add('pw-root'); host.append(header, tabs, status, body);
  let currentTab = 'pending';
  const nav = [['pending', 'Pendientes'], ['records', 'Revisiones'], ['cases', 'Expedientes']];
  for (const [value, label] of nav) tabs.append(button(label, () => run(() => render(value))));
  function pagination(data, action) {
    const row = node('div', undefined, 'pw-pagination');
    const previous = button('Anterior', () => run(() => action(data.page - 1)), 'pw-secondary'); previous.disabled = data.page <= 1;
    const next = button('Siguiente', () => run(() => action(data.page + 1)), 'pw-secondary'); next.disabled = data.page >= data.pages;
    row.append(previous, node('span', `Página ${data.page} de ${data.pages} · ${data.total} resultados`), next); return row;
  }
  function recordCard(item, { revision = true } = {}) {
    const card = node('article', undefined, 'pw-card');
    card.append(node('span', item.type === 'multa' ? 'MULTA' : 'ARRESTO', 'pw-eyebrow'), node('h4', item.ciudadano || 'Ciudadano registrado'), node('p', item.documento + ' · ' + item.estado, 'pw-muted'), node('p', item.articulos), node('p', item.type === 'multa' ? '$' + Number(item.monto).toLocaleString('es-CR') : item.tiempo + ' años'), node('p', `${date(item.createdAt)} · ${item.oficialNombre || item.oficialId}`, 'pw-muted'));
    const actions = node('div', undefined, 'pw-actions');
    if (item.pdfFileName) actions.append(link('Documento vigente', '/pdfs/' + encodeURIComponent(item.pdfFileName)));
    if (revision) actions.append(button('Historial y revisión', () => run(() => showRevisions(item.type, item.id)), 'pw-secondary'));
    card.append(actions); return card;
  }
  async function showRevisions(type, id) {
    const data = await api(`/records/${encodeURIComponent(type)}/${encodeURIComponent(id)}/revisions`);
    const { content, error } = dialog('Historial del registro');
    const current = { ...data.record, type };
    content.append(recordCard(current, { revision: false }));
    const original = current.originalPdfFileName || data.items[0]?.previous?.pdfFileName;
    if (original) content.append(link('Consultar documento original', '/pdfs/' + encodeURIComponent(original)));
    const history = node('div', undefined, 'pw-history');
    for (const item of data.items) {
      const row = node('article', undefined, 'pw-history-item');
      row.append(node('h4', `Versión ${item.number} · ${item.action === 'anular' ? 'Anulación' : 'Rectificación'}`), node('p', item.reason), node('p', `${date(item.at)} · ${item.byName || item.by}`, 'pw-muted'));
      if (item.pdfFileName) row.append(link('PDF de esta versión', '/pdfs/' + encodeURIComponent(item.pdfFileName)));
      history.append(row);
    }
    if (!data.items.length) history.append(node('p', 'Este registro conserva su primera emisión.', 'pw-muted'));
    content.append(node('h4', 'Versiones conservadas'), history);
    if (!data.canRevise) { content.append(node('p', 'Solo un supervisor con acceso policial y administrativo puede rectificar o anular.', 'pw-muted')); return; }
    if (['ANULADA', 'ANULADO'].includes(current.estado)) return;
    const form = node('form', undefined, 'pw-form');
    const action = select(form, 'Acción de supervisión', 'action', [['rectificar', 'Rectificar campos'], ['anular', 'Anular registro']]);
    const changes = node('div', undefined, 'pw-form'); form.append(changes);
    const articles = field(changes, 'Artículos y fundamento', 'articulos', 'textarea', current.articulos); articles.maxLength = 1500;
    const metric = field(changes, type === 'multa' ? 'Monto' : 'Tiempo (años)', 'metric', 'number', type === 'multa' ? current.monto : current.tiempo); metric.min = type === 'multa' ? '0.01' : '1'; metric.step = type === 'multa' ? '0.01' : '1';
    const plate = type === 'multa' ? field(changes, 'Placa', 'placa', 'text', current.placa || '') : null;
    if (plate) plate.maxLength = 20;
    action.addEventListener('change', () => { changes.hidden = action.value === 'anular'; });
    const reason = field(form, 'Motivo obligatorio (mínimo 12 caracteres)', 'reason', 'textarea'); reason.required = true; reason.minLength = 12; reason.maxLength = 1000;
    form.append(node('p', 'Se conserva el documento original. No se modifica el titular, el oficial de origen ni las evidencias. La anulación no devuelve pagos automáticamente.', 'pw-muted'));
    const save = node('button', 'Emitir nueva versión', 'pw-button'); save.type = 'submit'; form.append(save);
    form.addEventListener('submit', event => { event.preventDefault(); submit(save, async () => {
      const delta = {};
      if (action.value === 'rectificar') {
        if (articles.value !== current.articulos) delta.articulos = articles.value;
        const key = type === 'multa' ? 'monto' : 'tiempo';
        if (Number(metric.value) !== Number(current[key])) delta[key] = Number(metric.value);
        if (plate && plate.value !== (current.placa || '')) delta.placa = plate.value;
      }
      const result = await api(`/records/${type}/${encodeURIComponent(id)}/revisions`, { action: action.value, expectedRevision: current.revision || 0, reason: reason.value, changes: delta });
      content.replaceChildren(node('h4', 'Nueva versión guardada'), node('p', 'El original permanece en el historial.'), recordCard({ ...result.record, type }));
      announce('Revisión guardada con su motivo y documento versionado.');
    }, error); });
    content.append(node('h4', 'Revisión de supervisión'), form);
  }
  async function renderPending() {
    const filter = node('form', undefined, 'pw-filters');
    select(filter, 'Mostrar', 'kind', [['', 'Todo'], ['payments', 'Pagos por validar'], ['notifications', 'Notificaciones fallidas'], ['recent', 'Actuaciones recientes']]);
    field(filter, 'Oficial (ID Discord)', 'officer'); field(filter, 'Desde', 'from', 'date'); field(filter, 'Hasta', 'to', 'date');
    const search = node('button', 'Aplicar filtros', 'pw-button'); search.type = 'submit'; filter.append(search);
    const results = node('div', undefined, 'pw-results'); body.replaceChildren(filter, results);
    async function load(page = 1) {
      const query = new URLSearchParams(new FormData(filter)); query.set('page', page);
      const data = await api('/pending?' + query);
      const counts = node('p', `${data.counts.payments} pagos por validar · ${data.counts.notifications} avisos fallidos · ${data.counts.recent} actuaciones`, 'pw-summary');
      results.replaceChildren(counts);
      for (const item of data.items) {
        const card = recordCard(item);
        card.prepend(node('p', item.kind === 'payments' ? 'PAGO POR VALIDAR' : item.kind === 'notifications' ? 'AVISO FALLIDO' : 'ACTUACIÓN RECIENTE', 'pw-badge'));
        if (item.delivery) {
          const states = { 'fallida': 'falló; requiere revisión', 'en-cola': 'en cola del bot', 'procesada': 'procesado por el bot', 'sin-encolar': 'no se pudo encolar', 'sin-constancia': 'sin constancia de entrega' };
          card.append(node('p', 'Aviso de Discord: ' + (states[item.delivery.status] || 'estado no disponible') + '.', 'pw-muted'));
        }
        if (item.kind === 'payments') card.append(button('Validar referencia de pago', () => {
          const { content, error } = dialog('Validar pago');
          const form = node('form', undefined, 'pw-form');
          form.append(node('p', 'Verifica el ingreso antes de confirmar. Esta operación registra la validación; no mueve dinero.'));
          const reference = field(form, 'Referencia comprobada', 'reference'); reference.required = true; reference.maxLength = 200;
          const save = node('button', 'Confirmar pago verificado', 'pw-button'); save.type = 'submit'; form.append(save); content.append(form);
          form.addEventListener('submit', event => { event.preventDefault(); submit(save, async () => {
            const response = await fetch('/api/police/payments/' + encodeURIComponent(item.id) + '/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Local-Request': '1' }, body: JSON.stringify({ reference: reference.value }) });
            const result = await response.json(); if (!response.ok) throw Error(result.message || 'No se pudo confirmar el pago.');
            content.replaceChildren(node('p', 'Pago validado. Se conserva la referencia y el responsable.')); await load(page);
          }, error); });
        }));
        if (item.kind === 'notifications') card.append(node('p', 'El documento está guardado. Consulta el estado del bot y usa el reintento administrativo de notificaciones; no emitas otra actuación.', 'pw-muted'));
        results.append(card);
      }
      if (!data.items.length) results.append(node('p', 'No hay registros para estos filtros.', 'pw-empty'));
      results.append(pagination(data, load));
    }
    filter.addEventListener('submit', event => { event.preventDefault(); run(() => load()); }); await load();
  }
  async function renderRecords() {
    const filter = node('form', undefined, 'pw-filters');
    field(filter, 'Buscar por ciudadano, cédula o artículo', 'q');
    select(filter, 'Tipo', 'type', [['', 'Todos'], ['multa', 'Multas'], ['arresto', 'Arrestos']]);
    const search = node('button', 'Buscar registros', 'pw-button'); search.type = 'submit'; filter.append(search);
    const results = node('div', undefined, 'pw-results'); body.replaceChildren(filter, results);
    async function load(page = 1) {
      const query = new URLSearchParams(new FormData(filter)); query.set('page', page);
      const data = await api('/records?' + query); results.replaceChildren();
      for (const item of data.items) results.append(recordCard(item));
      if (!data.items.length) results.append(node('p', 'No se encontraron actuaciones.', 'pw-empty'));
      results.append(pagination(data, load));
    }
    filter.addEventListener('submit', event => { event.preventDefault(); run(() => load()); }); await load();
  }
  async function caseForm(existing) {
    const { content, error } = dialog(existing ? 'Actualizar expediente' : 'Nuevo expediente por incidente');
    const form = node('form', undefined, 'pw-form'); content.append(form);
    const title = field(form, 'Título del incidente', 'title', 'text', existing?.title || ''); title.required = true; title.minLength = 5; title.maxLength = 160;
    const location = field(form, 'Lugar', 'location', 'text', existing?.location || ''); location.required = true; location.minLength = 3; location.maxLength = 200;
    const occurred = field(form, 'Fecha y hora (zona horaria de este dispositivo)', 'occurredAt', 'datetime-local', existing ? localDate(existing.occurredAt) : localDate(new Date().toISOString())); occurred.required = true;
    const narrative = field(form, 'Narrativa del incidente', 'narrative', 'textarea', existing?.narrative || ''); narrative.required = true; narrative.minLength = 20; narrative.maxLength = 8000;
    const agents = field(form, 'Agentes adicionales: IDs Discord separados por comas (opcional)', 'agents', 'text', existing?.agents.join(', ') || '');
    form.append(node('p', 'Solo se admiten agentes del personal registrado, responsables de los registros elegidos o tu propia cuenta. Deja el campo vacío para asignarte.', 'pw-muted'));
    const selected = new Map((existing?.linkedRecords || []).filter(item => !item.unavailable).map(item => [item.type + ':' + item.id, item]));
    const selectedEvidence = new Set((existing?.evidence || []).map(item => item.type + ':' + item.id));
    const chosen = node('div', undefined, 'pw-selection');
    const searchLabel = node('label', undefined, 'pw-field'); searchLabel.append(node('span', 'Buscar actuaciones para relacionar'));
    const query = node('input'); query.type = 'search'; query.placeholder = 'Cédula, ciudadano o artículo'; searchLabel.append(query);
    const searchButton = button('Buscar actuaciones', () => run(() => loadPicker()));
    const picker = node('div', undefined, 'pw-picker');
    form.append(node('h4', 'Registros y evidencias del caso'), chosen, searchLabel, searchButton, picker);
    function drawSelected() {
      chosen.replaceChildren();
      for (const [key, item] of selected) {
        const row = node('div', undefined, 'pw-selected');
        row.append(node('span', `${item.type} · ${item.ciudadano} · ${item.documento}`), button('Quitar', () => { selected.delete(key); selectedEvidence.delete(key); drawSelected(); }, 'pw-secondary'));
        if (item.imagenFileName) {
          const label = node('label', undefined, 'pw-checkbox'); const check = node('input'); check.type = 'checkbox'; check.checked = selectedEvidence.has(key);
          check.addEventListener('change', () => { if (check.checked) selectedEvidence.add(key); else selectedEvidence.delete(key); });
          label.append(check, node('span', 'Incluir la evidencia adjunta de este registro')); row.append(label);
        }
        chosen.append(row);
      }
      if (!selected.size) chosen.append(node('p', 'Selecciona al menos una actuación.', 'pw-muted'));
    }
    async function loadPicker(page = 1) {
      const data = await api('/records?' + new URLSearchParams({ q: query.value, page, limit: 10 })); picker.replaceChildren();
      for (const item of data.items) picker.append(button(`${item.type} · ${item.ciudadano} · ${item.documento} · ${item.id}`, () => { selected.set(item.type + ':' + item.id, item); drawSelected(); }, 'pw-picker-item'));
      picker.append(pagination(data, loadPicker));
    }
    drawSelected(); await loadPicker();
    const state = existing ? select(form, 'Estado', 'status', [['abierto', 'Abierto'], ['cerrado', 'Cerrado']]) : null;
    if (state) state.value = existing.status;
    const reason = existing ? field(form, 'Motivo de la actualización (mínimo 12 caracteres)', 'reason', 'textarea') : null;
    if (reason) { reason.required = true; reason.minLength = 12; reason.maxLength = 1000; }
    const save = node('button', existing ? 'Guardar versión del expediente' : 'Crear expediente', 'pw-button'); save.type = 'submit'; form.append(save);
    form.addEventListener('submit', event => { event.preventDefault(); submit(save, async () => {
      const records = [...selected.values()].map(item => ({ type: item.type, id: item.id }));
      const evidence = records.filter(item => selectedEvidence.has(item.type + ':' + item.id));
      const payload = { title: title.value, location: location.value, narrative: narrative.value, occurredAt: new Date(occurred.value).toISOString(), records, evidence, ...(agents.value.trim() ? { agents: agents.value.split(',').map(value => value.trim()).filter(Boolean) } : {}) };
      if (existing) Object.assign(payload, { expectedVersion: existing.version, status: state.value, reason: reason.value });
      const result = await api('/cases' + (existing ? '/' + encodeURIComponent(existing.id) : ''), payload, existing ? 'PATCH' : 'POST');
      content.replaceChildren(node('h4', 'Expediente guardado'), node('p', result.item.title), node('p', result.item.id, 'pw-muted'));
      if (currentTab === 'cases') await renderCases();
    }, error); });
  }
  function localDate(value) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  async function showCase(id) {
    const data = await api('/cases/' + encodeURIComponent(id)); const item = data.item;
    const { content } = dialog('Expediente · ' + item.title);
    content.append(node('p', `${item.status.toUpperCase()} · Versión ${item.version}`, 'pw-badge'), node('p', `${item.location} · ${date(item.occurredAt)}`), node('p', item.narrative, 'pw-narrative'), node('p', 'Agentes: ' + item.agents.join(', '), 'pw-muted'));
    for (const record of item.linkedRecords) content.append(record.unavailable ? node('p', 'Registro ya no disponible: ' + record.id) : recordCard(record));
    for (const evidence of item.linkedEvidence) content.append(link('Evidencia asociada · ' + evidence.id, evidence.url));
    content.append(node('h4', 'Historial del caso'));
    for (const version of item.history) {
      const detail = node('details', undefined, 'pw-history-item');
      detail.append(node('summary', `Versión ${version.previous.version} · ${date(version.at)} · ${version.by}`), node('p', 'Motivo: ' + version.reason), node('p', version.previous.title), node('p', version.previous.narrative, 'pw-narrative'));
      content.append(detail);
    }
    if (!item.history.length) content.append(node('p', 'Primera versión del expediente.', 'pw-muted'));
    content.append(button('Actualizar expediente', () => run(() => caseForm(item))));
  }
  async function renderCases() {
    const top = node('div', undefined, 'pw-actions'); top.append(button('Nuevo expediente', () => run(() => caseForm())));
    const filter = node('form', undefined, 'pw-filters'); field(filter, 'Buscar por título, ID o lugar', 'q');
    select(filter, 'Estado', 'status', [['', 'Todos'], ['abierto', 'Abiertos'], ['cerrado', 'Cerrados']]);
    const search = node('button', 'Buscar casos', 'pw-button'); search.type = 'submit'; filter.append(search);
    const results = node('div', undefined, 'pw-results'); body.replaceChildren(top, filter, results);
    async function load(page = 1) {
      const query = new URLSearchParams(new FormData(filter)); query.set('page', page);
      const data = await api('/cases?' + query); results.replaceChildren();
      for (const item of data.items) {
        const card = node('article', undefined, 'pw-card');
        card.append(node('p', item.status.toUpperCase() + ' · V' + item.version, 'pw-badge'), node('h4', item.title), node('p', `${item.location} · ${date(item.occurredAt)}`, 'pw-muted'), node('p', `${item.records.length} actuaciones · ${item.evidence.length} evidencias`), button('Abrir expediente', () => run(() => showCase(item.id)), 'pw-secondary'));
        results.append(card);
      }
      if (!data.items.length) results.append(node('p', 'No hay expedientes para estos filtros. Crea un caso para agrupar las actuaciones de un incidente.', 'pw-empty'));
      results.append(pagination(data, load));
    }
    filter.addEventListener('submit', event => { event.preventDefault(); run(() => load()); }); await load();
  }
  async function render(tab) {
    currentTab = tab;
    [...tabs.children].forEach((button, index) => { button.classList.toggle('pw-active', nav[index][0] === tab); button.setAttribute('aria-current', nav[index][0] === tab ? 'page' : 'false'); });
    body.setAttribute('aria-busy', 'true');
    try { await ({ pending: renderPending, records: renderRecords, cases: renderCases }[tab])(); }
    finally { body.removeAttribute('aria-busy'); }
  }
  run(() => render('pending'));
})();
