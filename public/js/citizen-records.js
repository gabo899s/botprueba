/* Citizen-owned records: display server-authorized data; never infer payment success. */
(() => {
  'use strict';
  const app = window.CitizenApp;
  if (!app) return;
  const drafts = new Map(), pending = new Set();
  let owner = null, generation = 0, current = {}, kind = 'multas', focusTarget = null;
  const filters = { search: '', status: '', from: '', to: '' };
  const node = (tag, text, className) => { const n = app.el(tag, text); if (className) n.className = className; return n; };
  const empty = (parent, text) => parent.append(node('p', text, 'empty-state'));
  const userId = me => me?.discordId || me?.id || null;
  function safeDocument(value, folder) {
    if (typeof value !== 'string' || !value.startsWith('/' + folder + '/')) return null;
    const name = value.slice(folder.length + 2);
    try { const decoded = decodeURIComponent(name); return /^[a-zA-Z0-9_.-]+$/.test(decoded) && !decoded.includes('..') && !/[?#/\\]/.test(decoded) ? value : null; } catch { return null; }
  }
  const date = value => { const d = new Date(value); return Number.isNaN(d.valueOf()) ? null : d; };
  const displayDate = value => date(value)?.toLocaleString('es-CR') || String(value || 'Sin fecha registrada');
  const money = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' }).format(Number(value)) + ' · dinero del rol' : 'Sin monto registrado';
  function field(parent, label, value) { const row = node('p', '', 'record-detail'); row.append(node('strong', label + ': '), document.createTextNode(String(value ?? '—'))); parent.append(row); }
  function download(parent, value, folder, label) { const url = safeDocument(value, folder); if (url) app.link(parent, url, label); }
  function active(id, epoch) { return owner === id && generation === epoch && userId(app.me) === id; }
  function pendingPayment(r) { return r.paymentRequested || ['en-proceso', 'no-confirmado'].includes(r.paymentAttempt?.status); }
  async function requestPayment(r, button, errorNode) {
    const id = owner, epoch = generation, key = 'payment:' + r.id;
    if (!id || pending.has(key)) return;
    pending.add(key); button.disabled = true; errorNode.textContent = '';
    try {
      await app.api('/api/profile/payments', { id: r.id });
      if (!active(id, epoch)) return;
      r.paymentRequested = true;
      app.notice('Solicitud de validación enviada. La multa sigue pendiente hasta que el personal confirme el pago.');
      renderRecords(); await app.refresh();
    } catch (e) { if (active(id, epoch)) errorNode.textContent = e.message || 'No se pudo enviar la solicitud. Puedes intentarlo de nuevo.'; }
    finally { pending.delete(key); if (active(id, epoch) && !pendingPayment(r)) button.disabled = false; }
  }
  function recordCard(r) {
    const card = node('article', '', 'record citizen-record'); card.dataset.entityId = String(r.id); card.dataset.entityType = kind; if (focusTarget?.id === String(r.id) && focusTarget.type === kind) card.classList.add('citizen-target');
    card.append(node('h3', (kind === 'multas' ? 'Multa' : 'Arresto') + ' · ' + (r.estado || 'Sin estado')));
    field(card, 'Referencia', r.id); field(card, 'Fecha', displayDate(r.createdAt || r.fecha));
    field(card, 'Agente', r.oficialNombre || r.oficialId); field(card, 'Artículos y motivo', r.articulos);
    if (kind === 'multas') { field(card, 'Importe', money(r.monto)); if (r.placa) field(card, 'Matrícula', r.placa); }
    else field(card, 'Sentencia', r.tiempo === undefined ? 'Sin sentencia registrada' : r.tiempo + ' años de rol');
    const actions = node('div', '', 'record-actions');
    download(actions, r.pdfUrl, 'pdfs', 'Abrir PDF'); download(actions, r.imagenUrl, 'uploads', 'Ver evidencia');
    if (kind === 'multas' && String(r.estado).toUpperCase() !== 'PAGADA') {
      if (r.paymentAttempt?.status === 'no-confirmado') empty(card, 'Pago sin confirmar: no repitas el pago. El personal debe revisar la operación.');
      else if (r.paymentAttempt?.status === 'en-proceso') empty(card, 'Pago en proceso: espera su confirmación.');
      else if (r.paymentRequested) empty(card, 'Validación solicitada. Todavía no consta como pagada.');
      else {
        const b = node('button', 'Solicitar validación de pago'), errorNode = node('p', '', 'form-error'); b.type = 'button';
        errorNode.setAttribute('role', 'status'); b.disabled = pending.has('payment:' + r.id);
        b.addEventListener('click', () => requestPayment(r, b, errorNode)); actions.append(b, errorNode);
      }
    }
    card.append(actions); return card;
  }
  function renderRecords() {
    const root = document.querySelector('#records'); if (!root) return;
    root.replaceChildren();
    if (!owner || current.demo) { empty(root, 'Inicia sesión con Discord para consultar tu expediente.'); return; }
    if (!current.citizen) { empty(root, 'Registra tu personaje para consultar multas y arrestos.'); return; }
    const tabs = node('div', '', 'record-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Tipo de expediente');
    for (const [value, label] of [['multas', 'Multas'], ['arrestos', 'Arrestos']]) {
      const b = node('button', label + ' (' + (current.citizen[value] || []).length + ')'); b.type = 'button'; b.dataset.recordKind = value; b.setAttribute('aria-pressed', String(kind === value));
      b.addEventListener('click', () => { kind = value; filters.status = ''; renderRecords(); }); tabs.append(b);
    }
    root.append(tabs);
    const controls = node('div', '', 'record-filters'), search = node('input'), status = node('select');
    search.type = 'search'; search.placeholder = 'Buscar por referencia, agente o artículo'; search.value = filters.search; search.setAttribute('aria-label', 'Buscar en el expediente'); search.dataset.recordFilter = 'search';
    status.setAttribute('aria-label', 'Filtrar por estado'); status.dataset.recordFilter = 'status'; const all = node('option', 'Todos los estados'); all.value = ''; status.append(all);
    const records = current.citizen[kind] || [];
    for (const value of [...new Set(records.map(r => r.estado || 'Sin estado'))].sort()) { const opt = node('option', value); opt.value = value; status.append(opt); }
    status.value = filters.status; controls.append(search, status);
    for (const [key, text] of [['from', 'Desde'], ['to', 'Hasta']]) {
      const label = node('label', text), input = node('input'); input.type = 'date'; input.value = filters[key]; input.dataset.recordFilter = key; input.setAttribute('aria-label', text); label.append(input); controls.append(label);
    }
    const reset = node('button', 'Limpiar filtros'); reset.type = 'button'; reset.addEventListener('click', () => { Object.keys(filters).forEach(k => filters[k] = ''); renderRecords(); }); controls.append(reset);
    const list = node('div', '', 'records-list'); list.setAttribute('aria-live', 'polite');
    function renderList() {
      list.replaceChildren(); const q = filters.search.trim().toLocaleLowerCase('es');
      const selected = records.filter(r => {
        const haystack = [r.id, r.articulos, r.oficialNombre, r.oficialId, r.placa].join(' ').toLocaleLowerCase('es');
        const day = date(r.createdAt)?.toISOString().slice(0, 10);
        return (!q || haystack.includes(q)) && (!filters.status || (r.estado || 'Sin estado') === filters.status) && (!filters.from || day && day >= filters.from) && (!filters.to || day && day <= filters.to);
      }).sort((a, b) => (date(b.createdAt)?.valueOf() || 0) - (date(a.createdAt)?.valueOf() || 0));
      if (!selected.length) empty(list, records.length ? 'No hay resultados con estos filtros.' : 'No tienes ' + (kind === 'multas' ? 'multas' : 'arrestos') + ' registrados.');
      else selected.forEach(r => list.append(recordCard(r)));
    }
    controls.querySelectorAll('[data-record-filter]').forEach(input => input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => { filters[input.dataset.recordFilter] = input.value; renderList(); }));
    root.append(controls, list); renderList();
  }
  function renderSanctions() {
    const root = document.querySelector('#sanctions'); if (!root) return;
    root.replaceChildren();
    if (!owner || current.demo) { empty(root, 'Inicia sesión con Discord para consultar tus sanciones y apelaciones.'); return; }
    if (current.sanctionsError) { empty(root, 'No se pudieron cargar las sanciones. Actualiza el panel para intentarlo de nuevo.'); return; }
    const records = Array.isArray(current.sanctions) ? current.sanctions : [];
    if (!records.length) { empty(root, 'No tienes sanciones registradas.'); return; }
    for (const r of records) {
      const card = node('article', '', 'record citizen-sanction'); card.dataset.entityId = String(r.id); card.dataset.entityType = 'sanction'; if (focusTarget?.type === 'sanction' && focusTarget.id === String(r.id)) card.classList.add('citizen-target'); card.append(node('h3', 'Sanción · ' + (r.estado || 'Sin estado')));
      field(card, 'Motivo', r.motivo); field(card, 'Fecha', displayDate(r.at || r.createdAt || r.fecha));
      if (r.appeal) {
        field(card, 'Apelación', r.appeal.status); field(card, 'Tu explicación', r.appeal.reason);
        if (r.appeal.decidedAt) field(card, 'Fecha de resolución', displayDate(r.appeal.decidedAt));
        if (r.appeal.status === 'aceptada') empty(card, 'Apelación aceptada. La sanción fue revocada.');
        if (r.appeal.status === 'rechazada') empty(card, 'Apelación rechazada. Se mantiene el estado indicado de la sanción.');
      }
      if (!r.appeal && r.estado !== 'revocada') {
        const toggle = node('button', 'Presentar apelación'); toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'false');
        const form = node('form', '', 'citizen-form appeal-form'); form.hidden = true;
        const label = node('label', 'Explica por qué solicitas la revisión de esta sanción'), input = node('textarea'); input.required = true; input.maxLength = 1000; input.rows = 5; input.value = drafts.get(r.id) || ''; label.append(input);
        const counter = node('small', input.value.length + '/1000 caracteres'), errorNode = node('p', '', 'form-error'); errorNode.setAttribute('role', 'status');
        const send = node('button', 'Enviar apelación'); send.type = 'submit'; send.disabled = pending.has('appeal:' + r.id);
        const cancel = node('button', 'Cerrar formulario'); cancel.type = 'button'; cancel.addEventListener('click', () => { form.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); });
        toggle.addEventListener('click', () => { form.hidden = !form.hidden; toggle.setAttribute('aria-expanded', String(!form.hidden)); if (!form.hidden) input.focus(); });
        input.addEventListener('input', () => { drafts.set(r.id, input.value); counter.textContent = input.value.length + '/1000 caracteres'; });
        form.append(label, counter, errorNode, send, cancel);
        form.addEventListener('submit', async event => {
          event.preventDefault(); const reason = input.value.trim(), id = owner, epoch = generation, key = 'appeal:' + r.id;
          if (!id || pending.has(key)) return;
          drafts.set(r.id, input.value);
          if (!reason || reason.length > 1000) { errorNode.textContent = 'Escribe una explicación de 1 a 1000 caracteres.'; return; }
          pending.add(key); send.disabled = true; errorNode.textContent = '';
          try {
            await app.api('/api/staff/sanctions/' + encodeURIComponent(id) + '/' + encodeURIComponent(r.id) + '/appeal', { reason });
            if (!active(id, epoch)) return;
            drafts.delete(r.id); r.appeal = { status: 'pendiente', reason }; renderSanctions(); app.notice('Apelación enviada. Puedes consultar aquí su resolución.'); await app.refresh();
          } catch (e) { if (active(id, epoch)) errorNode.textContent = e.message || 'No se pudo enviar. Conservamos tu explicación para que lo intentes de nuevo.'; }
          finally { pending.delete(key); if (active(id, epoch)) send.disabled = false; }
        });
        card.append(toggle, form);
      }
      root.append(card);
    }
  }
  function update(detail) {
    const nextOwner = detail.demo ? null : userId(detail.me);
    if (nextOwner !== owner) { owner = nextOwner; generation++; focusTarget = null; drafts.clear(); pending.clear(); Object.keys(filters).forEach(k => filters[k] = ''); }
    current = detail; renderRecords(); renderSanctions();
  }
  document.addEventListener('citizen:navigate', event => {
    const target = event.detail?.target; if (!owner || !target) return;
    const type = target.type === 'payment' ? 'multas' : target.type;
    if (!['multas','arrestos','sanction'].includes(type)) return;
    document.querySelectorAll('#records .citizen-target,#sanctions .citizen-target').forEach(n => n.classList.remove('citizen-target'));
    focusTarget = {type, id: String(target.id)};
    if (type !== 'sanction') { kind = type; Object.keys(filters).forEach(k => filters[k] = ''); renderRecords(); } else renderSanctions();
    const card = [...document.querySelectorAll('[data-entity-id]')].find(n => n.dataset.entityId === focusTarget.id && n.dataset.entityType === type);
    if (card) { card.tabIndex = -1; card.focus({preventScroll:true}); card.scrollIntoView?.({behavior:'smooth',block:'center'}); }
    else app.notice('El registro ya no está disponible. Actualiza tu expediente.');
  });
  document.addEventListener('citizen:updated', event => update(event.detail || {}));
  if (app.state?.me || app.state?.demo) update(app.state);
})();
