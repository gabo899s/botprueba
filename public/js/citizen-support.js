(() => {
  'use strict';
  const make = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
  const app = () => window.CitizenApp, requestId = () => crypto.randomUUID();
  let createId = requestId(), attemptedTopic = null, draftTopic = '', ownerKey = null, renderEpoch = 0, epoch = 0;
  let activeTicket = null, holderNode = null, scopeNow = null, pollTimer = null, paused = false;
  const drafts = new Map();
  const current = (scope, node) => scope.owner === ownerKey && scope.render === renderEpoch && !!ownerKey && node.isConnected;
  const sameOwner = scope => scope.owner === ownerKey && !!ownerKey;
  function field(labelText, element) { const label = make('label', labelText); label.append(element); return label; }
  function report(node, text) { node.textContent = text; node.setAttribute('role', 'status'); }
  function humanDate(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es'); }
  function stop() { if (pollTimer) clearTimeout(pollTimer); pollTimer = null; }
  function visible() { const panel = document.querySelector('[data-view="support"]'); return !document.hidden && (!panel || !panel.hidden); }
  function schedule(fn) { stop(); if (!paused && ownerKey && activeTicket && visible()) pollTimer = setTimeout(() => { pollTimer = null; fn().finally(() => schedule(fn)); }, 15000); }
  function ticketDraft(id) { if (!drafts.has(id)) drafts.set(id, { content: '', requestId: requestId(), attempted: null, state: 'draft' }); return drafts.get(id); }
  async function conversation(ticket, holder, scope) {
    if (!current(scope, holder)) return;
    stop(); activeTicket = ticket.id; holderNode = holder; scopeNow = scope;
    const version = ++epoch, draft = ticketDraft(ticket.id), items = new Map();
    let nextBefore = null, busy = false;
    holder.replaceChildren();
    const heading = make('h3', ticket.topic), status = make('p', 'Cargando conversación…', 'support-status'), messages = make('div', undefined, 'support-conversation');
    messages.setAttribute('aria-live', 'polite');
    const toolbar = make('div', undefined, 'support-toolbar'), refresh = make('button', 'Actualizar conversación'), pause = make('button', paused ? 'Reanudar actualización' : 'Pausar actualización'), older = make('button', 'Cargar mensajes anteriores');
    for (const b of [refresh, pause, older]) b.type = 'button'; older.hidden = true;
    toolbar.append(refresh, pause, older); holder.append(heading, status, toolbar, messages);
    const alive = () => version === epoch && current(scope, holder);
    function draw() {
      messages.replaceChildren();
      const sorted = [...items.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      if (!sorted.length) messages.append(make('p', 'Aún no hay mensajes de texto. Puedes consultar los archivos compartidos en Discord.', 'empty-state'));
      for (const item of sorted) { const row = make('article', undefined, 'support-message' + (item.own ? ' own' : '')); row.append(make('strong', item.author), make('small', humanDate(item.createdAt)), make('p', item.content || 'Mensaje sin texto. Consúltalo en Discord.')); messages.append(row); }
      older.hidden = !nextBefore; older.disabled = items.size >= 500;
    }
    async function load(before) {
      if (!alive() || busy) return;
      busy = true; refresh.disabled = older.disabled = true;
      try {
        const result = await app().api(`/api/tickets/${encodeURIComponent(ticket.id)}/messages${before ? '?before=' + encodeURIComponent(before) : ''}`);
        if (!alive()) return;
        for (const item of result.items || []) items.set(item.id, item);
        // A regular refresh must not replace the oldest-page cursor after loading history.
        if (before || !nextBefore && items.size <= 50) nextBefore = result.nextBefore || null;
        draw(); report(status, `${items.size} mensajes cargados. ${paused ? 'Actualización pausada.' : 'Se actualiza cada 15 segundos mientras esta sección está visible.'}`);
      } catch (error) {
        if (!alive()) return;
        report(status, error.message);
        if ([401,403,404].includes(error.status)) { paused = true; stop(); if (error.status === 401) { drafts.clear(); holder.replaceChildren(make('p', 'La sesión terminó. Inicia sesión de nuevo.')); activeTicket = null; } }
      } finally { busy = false; if (alive()) { refresh.disabled = false; older.disabled = items.size >= 500; } }
    }
    refresh.addEventListener('click', () => load()); older.addEventListener('click', () => { if (nextBefore && items.size < 500) load(nextBefore); });
    pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Reanudar actualización' : 'Pausar actualización'; if (paused) stop(); else { load(); schedule(() => load()); } });
    await load(); if (!alive()) return;
    if (ticket.status !== 'abierto') { holder.append(make('p', 'Este ticket está cerrado. Puedes descargar su historial si ya está disponible.')); return; }
    const form = make('form', undefined, 'citizen-support-form'), input = make('textarea'); input.required = true; input.maxLength = 1600; input.rows = 4; input.autocomplete = 'off'; input.value = draft.content;
    const submit = make('button', 'Enviar mensaje'); submit.type = 'submit'; const response = make('p', '', 'support-status'); response.setAttribute('aria-live', 'polite');
    const uncertain = () => ['sending', 'uncertain'].includes(draft.state);
    submit.disabled = input.disabled = uncertain();
    if (draft.state === 'uncertain') report(response, 'No se pudo confirmar el envío anterior. Tu borrador se conserva. Revisa la conversación en Discord antes de escribir otra respuesta.');
    if (draft.state === 'sending') report(response, 'El envío sigue en curso. Actualiza la conversación para comprobarlo.');
    input.addEventListener('input', () => { if (!current(scope, input) || uncertain()) return; draft.content = input.value; if (draft.attempted !== null && draft.attempted !== input.value.trim()) { draft.requestId = requestId(); draft.attempted = null; } });
    form.append(field('Tu mensaje para soporte', input), make('small', 'El borrador se conserva al actualizar el panel durante esta sesión. Al cerrar sesión se elimina.', 'support-draft-note'), submit, response);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!alive() || !form.reportValidity() || uncertain()) return;
      const content = input.value.trim(); if (!content) return;
      if (draft.attempted !== null && draft.attempted !== content) draft.requestId = requestId();
      draft.content = input.value; draft.attempted = content; draft.state = 'sending'; submit.disabled = input.disabled = true; report(response, 'Enviando a Discord…');
      try {
        await app().api(`/api/tickets/${encodeURIComponent(ticket.id)}/messages`, { content, requestId: draft.requestId });
        if (!sameOwner(scope)) return;
        draft.content = ''; draft.attempted = null; draft.requestId = requestId(); draft.state = 'draft';
        if (alive()) await conversation(ticket, holder, scope);
        else if (activeTicket === ticket.id && holderNode && scopeNow && current(scopeNow, holderNode)) await conversation(ticket, holderNode, scopeNow);
      } catch (error) {
        if (!sameOwner(scope)) return;
        // Any network or upstream uncertainty keeps the original key locked;
        // refreshing the panel must never create a fresh external send.
        draft.state = !error.status || [409,500,502,503,504].includes(error.status) ? 'uncertain' : 'draft';
        if (!alive()) { if (activeTicket === ticket.id && holderNode && scopeNow && current(scopeNow, holderNode)) await conversation(ticket, holderNode, scopeNow); return; }
        report(response, error.message); submit.disabled = input.disabled = uncertain();
      }
    });
    holder.append(form); schedule(() => load());
  }
  async function render(event) {
    const state = event.detail || {}, top = document.querySelector('#ticketSupport'), tickets = document.querySelector('#tickets');
    if (!top || !tickets || !app()) return;
    const nextOwner = !state.demo && state.me ? (state.me.discordId || state.me.id || null) : null;
    if (nextOwner !== ownerKey) { drafts.clear(); activeTicket = null; paused = false; draftTopic = ''; attemptedTopic = null; createId = requestId(); }
    else if (ownerKey) draftTopic = top.querySelector('input')?.value ?? draftTopic;
    ownerKey = nextOwner; stop(); const scope = { owner: ownerKey, render: ++renderEpoch };
    top.replaceChildren(); tickets.replaceChildren(); epoch++;
    if (!ownerKey) { top.append(make('p', 'Inicia sesión con Discord para abrir tickets y consultar tus conversaciones.', 'empty-state')); const login = make('a', 'Iniciar sesión con Discord'); login.href = '/auth/discord?returnTo=citizen'; top.append(login); return; }
    const supportStatus = make('p', 'Comprobando conexión con soporte…', 'support-status'); supportStatus.setAttribute('aria-live', 'polite');
    const form = make('form', undefined, 'citizen-support-form'), topic = make('input'); topic.required = true; topic.maxLength = 150; topic.placeholder = 'Describe brevemente en qué podemos ayudarte'; topic.value = draftTopic;
    topic.addEventListener('input', () => { if (current(scope, topic)) draftTopic = topic.value; });
    const submit = make('button', 'Abrir ticket en Discord'); submit.type = 'submit'; submit.disabled = true; const result = make('p', '', 'support-status'); result.setAttribute('aria-live', 'polite');
    form.append(field('Asunto del ticket', topic), make('small', 'Se creará una conversación privada con el equipo de soporte en el servidor de Discord. No envíes contraseñas ni datos personales reales.'), submit, result); top.append(supportStatus, form);
    const items = Array.isArray(state.tickets) ? state.tickets : (state.tickets?.items || []), open = items.some(item => item.status === 'abierto');
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!current(scope, form) || !form.reportValidity() || submit.disabled) return;
      const value = topic.value.trim(); if (!value) return;
      if (attemptedTopic !== null && attemptedTopic !== value) createId = requestId();
      attemptedTopic = value; submit.disabled = true; topic.disabled = true; report(result, 'Creando ticket en Discord…');
      try { await app().api('/api/tickets', { topic: value, requestId: createId }); if (!current(scope, form)) return; createId = requestId(); attemptedTopic = null; draftTopic = ''; topic.value = ''; app().notice('Ticket creado. Puedes continuar aquí o en Discord.'); await app().refresh(); }
      catch (error) { if (current(scope, form)) { report(result, error.message); submit.disabled = false; topic.disabled = false; } }
    });
    if (state.ticketsError) tickets.append(make('p', state.ticketsError, 'empty-state')); else if (!items.length) tickets.append(make('p', 'Todavía no has abierto ningún ticket.', 'empty-state'));
    const holder = make('section', undefined, 'support-ticket-detail'); holder.setAttribute('aria-live', 'polite');
    for (const ticket of [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))) {
      const row = make('article', undefined, 'record support-ticket'); row.dataset.entityType = 'ticket'; row.dataset.entityId = String(ticket.id);
      row.append(make('strong', ticket.topic), make('p', `${ticket.status} · ${humanDate(ticket.createdAt)}`)); if (ticket.claimedBy) row.append(make('small', 'Un integrante de soporte está atendiendo tu caso.'));
      const actions = make('div', undefined, 'support-actions'), show = make('button', 'Ver conversación'); show.type = 'button'; show.addEventListener('click', () => conversation(ticket, holder, scope)); actions.append(show);
      if (ticket.transcriptFile) { const download = make('a', 'Descargar historial'); download.href = `/api/tickets/${encodeURIComponent(ticket.id)}/transcript`; download.target = '_blank'; download.rel = 'noopener'; actions.append(download); }
      row.append(actions); tickets.append(row);
    }
    tickets.append(holder); holderNode = holder; scopeNow = scope;
    if (activeTicket) { const selected = items.find(t => t.id === activeTicket); if (selected) conversation(selected, holder, scope); else activeTicket = null; }
    try { const available = await app().api('/api/profile/support'); if (!current(scope, supportStatus)) return; report(supportStatus, open ? 'Ya tienes un ticket abierto. Continúa la conversación más abajo.' : available.message); submit.disabled = !available.available || open || !!state.ticketsError; topic.disabled = open; }
    catch (error) { if (current(scope, supportStatus)) report(supportStatus, error.message); }
  }
  document.addEventListener('citizen:updated', render);
  document.addEventListener('citizen:navigate', event => {
    const target = event.detail?.target; if (!target?.type?.startsWith('ticket') || !ownerKey) return;
    const row = [...document.querySelectorAll('.support-ticket')].find(n => n.dataset.entityId === String(target.id));
    if (row) { document.querySelectorAll('.support-ticket').forEach(n => n.classList.remove('citizen-target')); row.classList.add('citizen-target'); row.querySelector('button')?.click(); row.tabIndex = -1; row.focus({preventScroll:true}); row.scrollIntoView?.({behavior:'smooth',block:'start'}); }
    else app().notice('El ticket ya no está disponible. Actualiza el panel para comprobarlo.');
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (!paused && activeTicket && scopeNow && holderNode && current(scopeNow, holderNode)) holderNode.querySelector('.support-toolbar button')?.click(); });
  document.addEventListener('click', event => {
    const tile = event.target.closest?.('[data-panel]'); if (!tile) return;
    if (tile.dataset.panel !== 'support') stop();
    else if (!paused && activeTicket && scopeNow && holderNode && current(scopeNow, holderNode)) holderNode.querySelector('.support-toolbar button')?.click();
  });
  window.addEventListener('pagehide', stop);
})();
