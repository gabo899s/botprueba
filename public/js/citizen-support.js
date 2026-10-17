(() => {
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const app = () => window.CitizenApp;
  const requestId = () => crypto.randomUUID();
  let createId = requestId(), attemptedTopic = null, draftTopic = '', ownerKey = null, renderEpoch = 0, epoch = 0;
  const current = (scope, node) => scope.owner === ownerKey && scope.render === renderEpoch && !!ownerKey && node.isConnected;
  function field(labelText, element) {
    const label = make('label', labelText); label.append(element); return label;
  }
  function report(node, text) { node.textContent = text; node.setAttribute('role', 'status'); }
  function humanDate(value) {
    const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es');
  }
  async function conversation(ticket, holder, scope) {
    if (!current(scope, holder)) return;
    const version = ++epoch;
    holder.replaceChildren();
    const heading = make('h3', ticket.topic), status = make('p', 'Cargando conversación…', 'support-status');
    const messages = make('div', undefined, 'support-conversation');
    const back = make('button', 'Actualizar conversación'); back.type = 'button';
    back.addEventListener('click', () => conversation(ticket, holder, scope));
    holder.append(heading, status, back, messages);
    try {
      const result = await app().api(`/api/tickets/${encodeURIComponent(ticket.id)}/messages`);
      if (version !== epoch || !current(scope, holder)) return;
      report(status, 'Últimos 50 mensajes de la conversación compartida con soporte.');
      if (!result.items.length) messages.append(make('p', 'Aún no hay mensajes de texto. Puedes consultar los archivos compartidos en Discord.', 'empty-state'));
      for (const item of result.items) {
        const row = make('article', undefined, 'support-message' + (item.own ? ' own' : ''));
        row.append(make('strong', item.author), make('small', humanDate(item.createdAt)), make('p', item.content || 'Mensaje sin texto. Consúltalo en Discord.'));
        messages.append(row);
      }
      if (ticket.status !== 'abierto') { holder.append(make('p', 'Este ticket está cerrado. Puedes descargar su historial si ya está disponible.')); return; }
      const form = make('form', undefined, 'citizen-support-form');
      const input = make('textarea'); input.required = true; input.maxLength = 1600; input.rows = 4; input.autocomplete = 'off';
      const submit = make('button', 'Enviar mensaje'); submit.type = 'submit';
      const response = make('p', '', 'support-status'); response.setAttribute('aria-live', 'polite');
      let messageId = requestId(), submittedContent = null;
      form.append(field('Tu mensaje para soporte', input), submit, response);
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (version !== epoch || !current(scope, form) || !form.reportValidity()) return;
        const content = input.value.trim(); if (!content) return;
        if (submittedContent !== null && submittedContent !== content) messageId = requestId();
        submittedContent = content; submit.disabled = true; input.disabled = true;
        report(response, 'Enviando a Discord…');
        try {
          await app().api(`/api/tickets/${encodeURIComponent(ticket.id)}/messages`, { content, requestId: messageId });
          if (version !== epoch || !current(scope, holder)) return;
          await conversation(ticket, holder, scope);
        } catch (error) {
          if (version !== epoch || !current(scope, form)) return;
          report(response, error.message); submit.disabled = false; input.disabled = false;
        }
      });
      holder.append(form);
    } catch (error) { if (version === epoch && current(scope, holder)) report(status, error.message); }
  }
  async function render(event) {
    const state = event.detail, top = document.querySelector('#ticketSupport'), tickets = document.querySelector('#tickets');
    if (!top || !tickets || !app()) return;
    const nextOwner = !state.demo && state.me ? (state.me.discordId || state.me.id || null) : null;
    if (nextOwner !== ownerKey) {
      ownerKey = nextOwner; draftTopic = ''; attemptedTopic = null; createId = requestId();
    } else if (ownerKey) draftTopic = top.querySelector('input')?.value ?? draftTopic;
    const scope = { owner: ownerKey, render: ++renderEpoch };
    top.replaceChildren(); tickets.replaceChildren(); epoch++;
    if (!ownerKey) {
      top.append(make('p', 'Inicia sesión con Discord para abrir tickets y consultar tus conversaciones.', 'empty-state'));
      const login = make('a', 'Iniciar sesión con Discord'); login.href = '/auth/discord?returnTo=citizen'; top.append(login); return;
    }
    const supportStatus = make('p', 'Comprobando conexión con soporte…', 'support-status'); supportStatus.setAttribute('aria-live', 'polite');
    const form = make('form', undefined, 'citizen-support-form');
    const topic = make('input'); topic.required = true; topic.maxLength = 150; topic.placeholder = 'Describe brevemente en qué podemos ayudarte'; topic.value = draftTopic;
    topic.addEventListener('input', () => { if (current(scope, topic)) draftTopic = topic.value; });
    const submit = make('button', 'Abrir ticket en Discord'); submit.type = 'submit'; submit.disabled = true;
    const result = make('p', '', 'support-status'); result.setAttribute('aria-live', 'polite');
    form.append(field('Asunto del ticket', topic), make('small', 'Se creará una conversación privada con el equipo de soporte en el servidor de Discord. No envíes contraseñas ni datos personales reales.'), submit, result);
    top.append(supportStatus, form);
    const items = Array.isArray(state.tickets) ? state.tickets : (state.tickets?.items || []);
    const open = items.some(item => item.status === 'abierto');
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!current(scope, form) || !form.reportValidity()) return;
      const value = topic.value.trim(); if (!value) return;
      if (attemptedTopic !== null && attemptedTopic !== value) createId = requestId();
      attemptedTopic = value; submit.disabled = true; topic.disabled = true; report(result, 'Creando ticket en Discord…');
      try {
        await app().api('/api/tickets', { topic: value, requestId: createId });
        if (!current(scope, form)) return;
        createId = requestId(); attemptedTopic = null; draftTopic = ''; topic.value = '';
        app().notice('Ticket creado. Puedes continuar aquí o en Discord.'); await app().refresh();
      } catch (error) {
        if (!current(scope, form)) return;
        report(result, error.message); submit.disabled = false; topic.disabled = false;
      }
    });
    if (state.ticketsError) tickets.append(make('p', state.ticketsError, 'empty-state'));
    else if (!items.length) tickets.append(make('p', 'Todavía no has abierto ningún ticket.', 'empty-state'));
    const holder = make('section', undefined, 'support-ticket-detail');
    holder.setAttribute('aria-live', 'polite');
    for (const ticket of [...items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))) {
      const row = make('article', undefined, 'record support-ticket');
      row.append(make('strong', ticket.topic), make('p', `${ticket.status} · ${humanDate(ticket.createdAt)}`));
      if (ticket.claimedBy) row.append(make('small', 'Un integrante de soporte está atendiendo tu caso.'));
      const actions = make('div', undefined, 'support-actions');
      const show = make('button', 'Ver conversación'); show.type = 'button'; show.addEventListener('click', () => conversation(ticket, holder, scope)); actions.append(show);
      if (ticket.transcriptFile) {
        const download = make('a', 'Descargar historial'); download.href = `/api/tickets/${encodeURIComponent(ticket.id)}/transcript`; download.target = '_blank'; download.rel = 'noopener'; actions.append(download);
      }
      row.append(actions); tickets.append(row);
    }
    tickets.append(holder);
    try {
      const available = await app().api('/api/profile/support');
      if (!current(scope, supportStatus)) return;
      report(supportStatus, open ? 'Ya tienes un ticket abierto. Continúa la conversación más abajo.' : available.message);
      submit.disabled = !available.available || open || !!state.ticketsError;
      topic.disabled = open;
    } catch (error) { if (current(scope, supportStatus)) report(supportStatus, error.message); }
  }
  document.addEventListener('citizen:updated', render);
})();
