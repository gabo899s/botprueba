(() => {
  'use strict';
  const make = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
  const states = { pending: 'Pendiente de revisión', approved: 'Aprobada', rejected: 'Rechazada' };
  const date = value => { if (!value) return 'No registrada'; const d = new Date(value); return Number.isFinite(d.valueOf()) ? d.toLocaleDateString('es-CR') : 'No registrada'; };
  const app = () => window.CitizenApp;
  let owner = null, revision = 0, data = null, focusId = null;
  const filters = { vehicle: '', license: '', status: '' }, drafts = new Map();
  function field(parent, title, value) { const p = make('p'); p.append(make('span', title), make('strong', value || 'No registrado')); parent.append(p); }
  function status(license) {
    const expiry = license.expiresAt || license.fechaVencimiento || license.vence;
    if (String(license.estado).toLowerCase() === 'inactiva') return { text: 'Inactiva', className: 'inactive' };
    if (expiry && Number.isFinite(Date.parse(expiry))) return Date.parse(expiry) <= Date.now() ? { text: 'Vencida', className: 'expired' } : { text: license.estado || 'Vigente', className: 'active' };
    return { text: `${license.estado || 'Sin estado'} · sin vigencia registrada`, className: 'unknown' };
  }
  function focusLicense() {
    if (!focusId) return;
    const card = [...document.querySelectorAll('.asset-license')].find(n => n.dataset.entityId === focusId);
    if (!card) return;
    card.classList.add('citizen-target'); card.tabIndex = -1; card.focus({ preventScroll: true }); card.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }
  function render() {
    const host = document.querySelector('#citizenAssets'); if (!host || !data) return;
    host.replaceChildren(make('h3', 'Vehículos y licencias'));
    const vehicleSection = make('section', undefined, 'asset-section'), licenseSection = make('section', undefined, 'asset-section');
    vehicleSection.append(make('h4', `Mis vehículos · ${data.vehicles.length}`)); licenseSection.append(make('h4', `Mis licencias · ${data.licenses.length}`));
    const vehicleSearch = make('input'); vehicleSearch.type = 'search'; vehicleSearch.placeholder = 'Buscar matrícula, modelo o marca'; vehicleSearch.setAttribute('aria-label', 'Buscar vehículo'); vehicleSearch.value = filters.vehicle;
    const licenseSearch = make('input'); licenseSearch.type = 'search'; licenseSearch.placeholder = 'Buscar tipo de licencia'; licenseSearch.setAttribute('aria-label', 'Buscar licencia'); licenseSearch.value = filters.license;
    const select = make('select'); select.setAttribute('aria-label', 'Estado de licencia');
    for (const [value, title] of [['', 'Todos los estados'], ['active', 'Con vigencia futura'], ['expired', 'Vencidas'], ['inactive', 'Inactivas'], ['unknown', 'Sin vigencia registrada']]) { const o = make('option', title); o.value = value; select.append(o); } select.value = filters.status;
    const vehicleGrid = make('div', undefined, 'asset-grid'), licenseGrid = make('div', undefined, 'asset-grid');
    const tools = make('div', undefined, 'asset-filters'); tools.append(licenseSearch, select);
    function drawVehicles() {
      vehicleGrid.replaceChildren(); const q = filters.vehicle.toLocaleLowerCase('es').trim();
      const matches = data.vehicles.filter(v => [v.placa, v.modelo, v.marca].join(' ').toLocaleLowerCase('es').includes(q));
      for (const v of matches) { const c = make('article', undefined, 'asset-card asset-vehicle'); c.append(make('small', 'VEHÍCULO REGISTRADO'), make('h4', v.placa || 'Sin matrícula')); field(c, 'Modelo', v.modelo); if (v.marca) field(c, 'Marca', v.marca); if (v.color) field(c, 'Color', v.color); field(c, 'Estado', v.estado || 'Registrado'); vehicleGrid.append(c); }
      if (!matches.length) vehicleGrid.append(make('p', data.vehicles.length ? 'No hay vehículos con esa búsqueda.' : 'Tu personaje no tiene vehículos registrados.', 'empty-state'));
    }
    function drawLicenses() {
      licenseGrid.replaceChildren(); const q = filters.license.toLocaleLowerCase('es').trim();
      const matches = data.licenses.filter(l => String(l.tipo || '').toLocaleLowerCase('es').includes(q) && (!filters.status || status(l).className === filters.status));
      for (const l of matches) {
        const c = make('article', undefined, 'asset-card asset-license'); c.dataset.entityId = String(l.id); c.dataset.entityType = 'license';
        const state = status(l), badge = make('span', state.text, 'asset-badge ' + state.className);
        c.append(make('small', 'LICENCIA DEL PERSONAJE'), make('h4', l.tipo || 'Sin tipo registrado'), badge);
        field(c, 'Expedición', date(l.fechaExpedicion || l.createdAt)); field(c, 'Vencimiento', date(l.expiresAt || l.fechaVencimiento || l.vence));
        const history = data.renewals.filter(r => r.licenseId === l.id), pending = history.some(r => r.status === 'pending');
        if (pending) c.append(make('p', 'Renovación pendiente. La vigencia actual todavía no ha cambiado.', 'asset-help'));
        else {
          const details = make('details'), summary = make('summary', 'Solicitar renovación'), form = make('form', undefined, 'asset-renewal-form');
          const label = make('label', 'Motivo de la renovación'), reason = make('textarea'); reason.required = true; reason.minLength = 10; reason.maxLength = 1000; reason.rows = 3; reason.value = drafts.get(l.id) || ''; reason.addEventListener('input', () => drafts.set(l.id, reason.value)); label.append(reason);
          const button = make('button', 'Enviar a revisión'); button.type = 'submit'; const feedback = make('p'); feedback.setAttribute('role', 'status');
          const expectedOwner = owner, expectedRevision = revision;
          form.append(label, make('small', 'No modifica ni extiende la licencia automáticamente. El equipo revisará tu solicitud.'), button, feedback);
          form.addEventListener('submit', async event => {
            event.preventDefault(); if (!form.reportValidity() || button.disabled || owner !== expectedOwner || revision !== expectedRevision) return;
            button.disabled = true; feedback.textContent = 'Enviando solicitud…';
            try { const result = await app().api(`/api/profile/licenses/${encodeURIComponent(l.id)}/renewal`, { reason: reason.value }); if (owner !== expectedOwner || revision !== expectedRevision) return; drafts.delete(l.id); data.renewals.unshift(result.item); app().notice(result.message); render(); }
            catch (error) { if (owner === expectedOwner && revision === expectedRevision) { feedback.textContent = error.message; button.disabled = false; } }
          });
          details.append(summary, form); c.append(details);
        }
        for (const r of history.slice(0, 3)) { const p = make('p', `${states[r.status] || r.status} · ${date(r.createdAt)}`, 'asset-renewal-status'); if (r.note) p.append(make('span', ` · ${r.note}`)); c.append(p); }
        licenseGrid.append(c);
      }
      if (!matches.length) licenseGrid.append(make('p', data.licenses.length ? 'No hay licencias con esos filtros.' : 'Tu personaje no tiene licencias registradas.', 'empty-state'));
    }
    vehicleSearch.addEventListener('input', () => { filters.vehicle = vehicleSearch.value; drawVehicles(); }); licenseSearch.addEventListener('input', () => { filters.license = licenseSearch.value; drawLicenses(); }); select.addEventListener('change', () => { filters.status = select.value; drawLicenses(); });
    vehicleSection.append(vehicleSearch, vehicleGrid); licenseSection.append(tools, licenseGrid); host.append(vehicleSection, licenseSection); drawVehicles(); drawLicenses(); focusLicense();
  }
  document.addEventListener('citizen:updated', async event => {
    const host = document.querySelector('#citizenAssets'); if (!host || !app()) return;
    const state = event.detail || {}, next = !state.demo && state.me ? String(state.me.discordId || state.me.id || '') : null;
    if (owner !== next) { drafts.clear(); data = null; focusId = null; for (const key of Object.keys(filters)) filters[key] = ''; }
    owner = next; const current = ++revision;
    const legacy = document.querySelector('#vehiclesLicenses'); if (legacy) legacy.hidden = true;
    if (!owner || !state.citizen) { host.replaceChildren(make('h3', 'Vehículos y licencias'), make('p', owner ? 'Registra tu personaje para consultar sus vehículos y licencias.' : 'Inicia sesión con Discord para consultar tus vehículos y licencias.', 'empty-state')); return; }
    if (!data) host.replaceChildren(make('p', 'Consultando tus vehículos y licencias…', 'empty-state'));
    try { const response = await app().api('/api/profile/assets'); if (current !== revision || next !== owner) return; data = response; render(); }
    catch (error) { if (current === revision) { data = null; host.replaceChildren(make('p', error.message, 'empty-state')); } }
  });
  document.addEventListener('citizen:navigate', event => {
    if (event.detail?.target?.type !== 'license' || !owner) return;
    focusId = String(event.detail.target.id); filters.license = ''; filters.status = ''; if (data) render();
  });
  // The administration page can include the same script without CitizenApp.
  const reviews = document.querySelector('#licenseRenewalReviews'); let reviewEpoch = 0;
  async function staffApi(url, body) {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'X-Local-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw Object.assign(Error(result.message || 'No se pudo completar la solicitud.'), { status: response.status }); return result;
  }
  async function loadReviews() {
    if (!reviews) return; const mine = ++reviewEpoch;
    reviews.replaceChildren(); reviews.hidden = true;
    try {
      const { user } = await staffApi('/api/staff/me'); if (mine !== reviewEpoch || !user?.isAdmin) return;
      const result = await staffApi('/api/staff/license-renewals'), { user: again } = await staffApi('/api/staff/me');
      if (mine !== reviewEpoch || !again?.isAdmin || (again.discordId || again.id) !== (user.discordId || user.id)) return;
      reviews.hidden = false; reviews.append(make('h2', 'Renovaciones de licencias'), make('p', 'Cada aprobación requiere una nueva fecha de vencimiento y queda registrada en el historial.'));
      const refresh = make('button', 'Actualizar solicitudes'); refresh.type = 'button'; refresh.addEventListener('click', loadReviews); reviews.append(refresh);
      if (!result.items.length) reviews.append(make('p', 'No hay solicitudes de renovación.'));
      for (const r of result.items.slice(0, 200)) {
        const card = make('article', undefined, 'asset-card'); card.append(make('h3', `${r.licenseType} · ${states[r.status] || r.status}`), make('p', `Personaje: ${r.citizenNumber} · Discord: ${r.userId}`), make('p', r.reason), make('p', `Vigencia anterior: ${date(r.previousExpiry)}`));
        if (r.note) card.append(make('p', `Resolución: ${r.note}`));
        if (r.status === 'pending') {
          const form = make('form', undefined, 'asset-renewal-form'), dateLabel = make('label', 'Nueva fecha de vencimiento (al aprobar)'), expiry = make('input'); expiry.type = 'date'; dateLabel.append(expiry);
          const label = make('label', 'Observación de la decisión'), note = make('textarea'); note.minLength = 5; note.maxLength = 1000; note.required = true; label.append(note);
          const yes = make('button', 'Aprobar renovación'), no = make('button', 'Rechazar'); yes.type = 'button'; no.type = 'button'; const feedback = make('p'); feedback.setAttribute('role', 'status'); form.append(dateLabel, label, yes, no, feedback);
          for (const [button, approve] of [[yes, true], [no, false]]) button.addEventListener('click', async () => {
            if (!form.reportValidity() || yes.disabled || mine !== reviewEpoch) return;
            if (approve && !expiry.value) { feedback.textContent = 'Indica la nueva fecha de vencimiento.'; expiry.focus(); return; }
            yes.disabled = no.disabled = true;
            try { await staffApi(`/api/staff/license-renewals/${encodeURIComponent(r.id)}/decision`, { approve, note: note.value, expiresAt: expiry.value }); if (mine === reviewEpoch) loadReviews(); }
            catch (error) { if (mine === reviewEpoch) { feedback.textContent = error.message; yes.disabled = no.disabled = false; if ([401,403].includes(error.status)) { reviews.replaceChildren(); reviews.hidden = true; reviewEpoch++; } } }
          }); card.append(form);
        }
        reviews.append(card);
      }
    } catch { if (mine === reviewEpoch) { reviews.replaceChildren(); reviews.hidden = true; } }
  }
  document.addEventListener('staff:logout', () => { reviewEpoch++; reviews?.replaceChildren(); if (reviews) reviews.hidden = true; });
  if (reviews) loadReviews();
})();
