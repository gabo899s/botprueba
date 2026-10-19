(() => {
  'use strict';
  const labels = { nombre: 'Nombre del personaje', apellidos: 'Apellidos del personaje', fechaNacimiento: 'Nacimiento del personaje', nacionalidad: 'Nacionalidad', sexo: 'Sexo', estatura: 'Estatura en cm', provincia: 'Provincia', lugarNacimiento: 'Lugar de nacimiento', grupoSanguineo: 'Grupo sanguíneo' };
  const statuses = { pending: 'Pendiente de revisión', approved: 'Aprobada', rejected: 'Rechazada' };
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const date = value => new Date(value).toLocaleString('es');
  async function staffApi(url, body) {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'X-Local-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json(); if (!response.ok) throw Object.assign(Error(result.message || 'No se pudo completar la solicitud.'), { status: response.status }); return result;
  }
  function changesList(item) {
    const list = node('dl', undefined, 'correction-changes');
    for (const [key, value] of Object.entries(item.changes || {})) {
      list.append(node('dt', labels[key] || key), node('dd', `${item.previous?.[key] || 'Sin dato'} → ${value}`));
    }
    return list;
  }
  function card(item) {
    const article = node('article', undefined, 'record correction-record'); article.dataset.entityType = 'profile.correction'; article.dataset.entityId = String(item.id);
    article.append(node('h4', `${statuses[item.status] || 'Solicitud'} · ${date(item.createdAt)}`), changesList(item), node('p', `Motivo: ${item.reason}`));
    if (item.reviewedAt) article.append(node('p', `Revisada: ${date(item.reviewedAt)}`));
    if (item.note) article.append(node('p', `Respuesta de administración: ${item.note}`));
    return article;
  }
  let revision = 0, configTask;
  function accountHelp(roblox, message, enabled) {
    if (roblox) { roblox.setAttribute('aria-disabled', String(!enabled)); roblox.tabIndex = enabled ? 0 : -1; }
    const help = document.querySelector('#robloxHelp'); if (help) help.textContent = message;
  }
  async function citizenUpdated(event) {
    const app = window.CitizenApp, host = document.querySelector('#profileCorrections');
    if (!app || !host) return;
    const mine = ++revision, { demo, citizen, me } = event.detail;
    const discord = document.querySelector('#discordRefresh'), roblox = document.querySelector('#robloxRefresh');
    if (discord) discord.disabled = demo || !me;
    if (roblox) {
      roblox.href = '/auth/roblox?returnTo=citizen';
      roblox.textContent = citizen?.roblox?.userId ? 'Actualizar cuenta de Roblox' : 'Vincular cuenta de Roblox';
      accountHelp(roblox, demo || !me ? 'Inicia sesión para vincular tu cuenta.' : !citizen ? 'Registra tu personaje con el bot o el staff antes de vincular Roblox.' : 'Comprobando la vinculación de Roblox…', false);
    }
    if (demo || !me) { host.replaceChildren(node('p', 'Inicia sesión con Discord para solicitar correcciones de tu personaje.')); delete host.dataset.owner; return; }
    const owner = `${me.discordId || me.id}:${citizen?.numeroCedula || ''}`;
    // Discard another account's history and draft before starting any request.
    // Failed or delayed responses must never leave the preceding account visible.
    if (host.dataset.owner !== owner) { host.replaceChildren(node('p', 'Cargando tus solicitudes…')); delete host.dataset.owner; }
    if (citizen && roblox) {
      configTask ||= app.api('/api/config').catch(() => { configTask = null; return null; });
      configTask.then(config => {
        if (mine !== revision) return;
        const enabled = config?.robloxOAuth === true;
        accountHelp(roblox, enabled ? (citizen.roblox?.userId ? 'Actualiza tu cuenta mediante la conexión segura con Roblox.' : 'Vincula tu cuenta mediante la conexión segura con Roblox.') : config ? 'La vinculación de Roblox todavía no está configurada. Contacta con administración.' : 'No se pudo comprobar la vinculación de Roblox. Actualiza el panel para reintentar.', enabled);
      });
    }
    try {
      const { items } = await app.api('/api/profile/corrections');
      if (mine !== revision) return;
      if (host.dataset.owner !== owner) {
        host.replaceChildren(); host.dataset.owner = owner;
        if (citizen) buildCorrectionForm(host, citizen, app);
        else host.append(node('p', 'Registra tu personaje en el bot o solicita ayuda al staff para pedir cambios.'));
        const history = node('div'); history.id = 'correctionHistory'; history.setAttribute('aria-live', 'polite'); host.append(history);
      }
      const form = host.querySelector('.correction-form');
      if (form && form.dataset.dirty !== 'true') {
        for (const input of form.querySelectorAll('input[name]')) input.value = citizen?.[input.name] || '';
      }
      const history = host.querySelector('#correctionHistory');
      history.replaceChildren(node('h4', 'Mis solicitudes de corrección'));
      if (!items.length) history.append(node('p', 'No has enviado solicitudes.'));
      for (const item of items) history.append(card(item));
      const submit = host.querySelector('button[type=submit]');
      if (submit) { submit.disabled = items.some(item => item.status === 'pending'); submit.textContent = submit.disabled ? 'Ya tienes una solicitud pendiente' : 'Enviar para revisión'; }
    } catch (error) { if (mine === revision) app.notice(error.message, true); }
  }
  function buildCorrectionForm(host, citizen, app) {
    const details = node('details'), summary = node('summary', 'Solicitar corrección del personaje'); details.append(summary);
    const form = node('form', undefined, 'correction-form');
    form.append(node('p', 'Solo datos ficticios de rol. Selecciona los campos que quieres cambiar. Administración revisará la solicitud antes de modificar tu personaje.'));
    const inputs = {};
    const markDirty = () => { form.dataset.dirty = 'true'; };
    form.addEventListener('input', markDirty); form.addEventListener('change', markDirty);
    for (const [key, label] of Object.entries(labels)) {
      const group = node('div', undefined, 'form-row'), toggleLabel = node('label'), toggle = node('input'); toggle.type = 'checkbox';
      toggle.setAttribute('aria-label', `Corregir ${label.toLowerCase()}`); toggleLabel.append(toggle, document.createTextNode(' ' + label));
      const inputLabel = node('label', `Nuevo valor: ${label.toLowerCase()}`), input = node('input');
      input.id = `correction-${key}`; inputLabel.htmlFor = input.id; input.name = key; input.disabled = true; input.value = citizen[key] || ''; input.maxLength = ({ nombre: 80, apellidos: 100, nacionalidad: 50, sexo: 20, estatura: 20, provincia: 50, lugarNacimiento: 100, grupoSanguineo: 3 })[key] || 10;
      if (key === 'fechaNacimiento') input.type = 'date';
      if (key === 'estatura') input.placeholder = '180 cm';
      if (key === 'grupoSanguineo') input.placeholder = 'O+';
      toggle.addEventListener('change', () => { input.disabled = !toggle.checked; input.required = toggle.checked; if (toggle.checked) input.focus(); });
      inputs[key] = input; group.append(toggleLabel, inputLabel, input); form.append(group);
    }
    const reasonLabel = node('label', 'Motivo de la corrección'), reason = node('textarea'); reason.id = 'correction-reason'; reasonLabel.htmlFor = reason.id; reason.required = true; reason.minLength = 10; reason.maxLength = 1000; reason.rows = 3;
    const submit = node('button', 'Enviar para revisión', 'action red'); submit.type = 'submit';
    const feedback = node('p'); feedback.setAttribute('role', 'status');
    form.append(reasonLabel, reason, submit, feedback);
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!form.reportValidity()) return;
      const changes = Object.fromEntries(Object.entries(inputs).filter(([, input]) => !input.disabled).map(([key, input]) => [key, input.value]));
      if (!Object.keys(changes).length) { feedback.textContent = 'Selecciona al menos un campo para corregir.'; return; }
      submit.disabled = true;
      try { const result = await app.api('/api/profile/corrections', { changes, reason: reason.value }); form.dataset.dirty = 'false'; reason.value = ''; for (const checkbox of form.querySelectorAll('input[type=checkbox]')) checkbox.checked = false; for (const input of Object.values(inputs)) { input.disabled = true; input.required = false; } feedback.textContent = result.message; app.notice(result.message); await app.refresh(); }
      catch (error) { feedback.textContent = error.message; submit.disabled = false; }
    });
    details.append(form); host.append(details);
  }
  document.addEventListener('citizen:updated', citizenUpdated);
  document.addEventListener('citizen:navigate', event => {
    if (event.detail?.target?.type !== 'profile.correction') return;
    document.querySelectorAll('.correction-record.citizen-target').forEach(n => n.classList.remove('citizen-target'));
    const item = [...document.querySelectorAll('.correction-record')].find(n => n.dataset.entityId === String(event.detail.target.id));
    if (item) { item.classList.add('citizen-target'); item.tabIndex = -1; item.focus({preventScroll:true}); item.scrollIntoView?.({behavior:'smooth',block:'center'}); }
  });
  document.querySelector('#robloxRefresh')?.addEventListener('click', event => {
    if (event.currentTarget.getAttribute('aria-disabled') === 'true') { event.preventDefault(); window.CitizenApp?.notice(document.querySelector('#robloxHelp')?.textContent || 'La vinculación de Roblox no está disponible.', true); }
  });
  document.querySelector('#discordRefresh')?.addEventListener('click', async event => {
    const app = window.CitizenApp, button = event.currentTarget; if (!app || button.disabled) return;
    button.disabled = true;
    try { const result = await app.api('/api/profile/discord/refresh', {}); app.notice(result.message); await app.refresh(); }
    catch (error) { app.notice(error.message, true); }
    finally { button.disabled = !!app.state?.demo || !app.me; }
  });
  const reviews = document.querySelector('#profileCorrectionReviews');
  let reviewRevision = 0;
  function hideReviews() {
    reviewRevision++;
    if (reviews) { reviews.hidden = true; reviews.replaceChildren(node('h2', 'Correcciones de personajes')); reviews.closest('[data-profile-reviews]')?.setAttribute('hidden', ''); }
  }
  async function loadReviews() {
    if (!reviews) return;
    const mine = ++reviewRevision;
    try {
      const { user } = await staffApi('/api/staff/me');
      if (mine !== reviewRevision) return;
      if (!user?.isAdmin) { hideReviews(); return; }
      const { items } = await staffApi('/api/staff/profile-corrections');
      if (mine !== reviewRevision) return;
      const { user: rechecked } = await staffApi('/api/staff/me');
      if (mine !== reviewRevision) return;
      if (!rechecked?.isAdmin || (rechecked.discordId || rechecked.id) !== (user.discordId || user.id)) { hideReviews(); return; }
      reviews.hidden = false; reviews.closest('[data-profile-reviews]')?.removeAttribute('hidden');
      reviews.replaceChildren(node('h2', 'Correcciones de personajes'));
      const pending = items.filter(item => item.status === 'pending'), recent = items.filter(item => item.status !== 'pending').slice(0, 20);
      if (!pending.length) reviews.append(node('p', 'No hay solicitudes pendientes.'));
      for (const item of [...pending, ...recent]) {
        const article = card(item); article.prepend(node('p', `Discord: ${item.userId} · Cédula: ${item.citizenNumber}`));
        if (item.status === 'pending') {
          if (item.userId === user.discordId || item.userId === user.id) article.append(node('p', 'Otro administrador debe revisar tu solicitud.'));
          else {
            const form = node('form', undefined, 'correction-review-form'), label = node('label', 'Respuesta para el ciudadano'), note = node('textarea'), feedback = node('p');
            note.id = `review-${item.id}`; label.htmlFor = note.id; note.maxLength = 1000; note.rows = 3; feedback.setAttribute('role', 'status');
            const approve = node('button', 'Aprobar cambios', 'primary'), reject = node('button', 'Rechazar', 'secondary'); approve.type = reject.type = 'submit'; approve.value = 'approve'; reject.value = 'reject';
            form.append(label, note, approve, reject, feedback);
            form.addEventListener('submit', async event => {
              event.preventDefault(); const accept = event.submitter === approve;
              if (!accept && !note.value.trim()) { feedback.textContent = 'Explica al ciudadano por qué se rechaza.'; note.focus(); return; }
              approve.disabled = reject.disabled = true;
              try { await staffApi(`/api/staff/profile-corrections/${encodeURIComponent(item.id)}/decision`, { approve: accept, note: note.value }); await loadReviews(); }
              catch (error) { feedback.textContent = error.message; approve.disabled = reject.disabled = false; }
            }); article.append(form);
          }
        }
        reviews.append(article);
      }
    } catch (error) { if (mine === reviewRevision) hideReviews(); }
  }
  if (reviews) { loadReviews(); document.addEventListener('staff:updated', loadReviews); document.querySelector('#logout')?.addEventListener('click', hideReviews, { capture: true }); window.addEventListener('pagehide', hideReviews); }
})();
