/* Real provider balances only; receipt references describe Maes requests, never fabricated bank transfers. */
(() => {
  'use strict';
  const make = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
  const host = document.querySelector('#citizenEconomy'), app = () => window.CitizenApp;
  const names = { confirmado: 'Confirmado', rechazado: 'No cobrado / rechazado', 'no-confirmado': 'Incierto · no repetir', 'en-proceso': 'En proceso · no repetir' };
  const format = value => new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 }).format(value) + ' · dinero del rol';
  const date = value => value ? new Date(value).toLocaleString('es-CR') : 'Sin fecha registrada';
  let owner = null, epoch = 0, data = null; const keys = new Map();
  const key = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(20)), n => n.toString(16).padStart(2, '0')).join('');
  function balances(values) { for (const [id, field] of [['citizenCash', 'cash'], ['citizenBank', 'bank'], ['heroCash','cash'], ['heroBank','bank']]) { const n = document.getElementById(id); if (n) n.textContent = values ? (id.startsWith('hero')?'$'+new Intl.NumberFormat('es-CR',{maximumFractionDigits:2}).format(values[field]):format(values[field])) : 'No disponible'; } }
  const current = (id, revision) => owner === id && epoch === revision && String(app()?.me?.discordId || app()?.me?.id || '') === id;
  async function load() {
    if (!host || !owner) return; const id = owner, revision = ++epoch;
    host.replaceChildren(make('p', 'Consultando economía del servidor…', 'economy-muted'));
    try { const response = await app().api('/api/profile/economy'); if (!current(id, revision)) return; data = response; balances(data.available ? data.balance : null); for (const fine of data.fines) { const latest = data.history.find(a => a.fineId === fine.id); if (latest?.status === 'rechazado' && !fine.pending) keys.delete(fine.id); } render(); }
    catch (error) { if (current(id, revision)) { data = null; balances(null); host.replaceChildren(make('h3', 'Economía Maes RP'), make('p', error.message, 'economy-feedback')); } }
  }
  function detail(card, label, value) { const p = make('p'); p.append(make('strong', label + ': '), make('span', String(value))); card.append(p); }
  function render() {
    if (!host || !data || !owner) return;
    host.replaceChildren(make('h3', 'Economía Maes RP'), make('p', data.currency, 'economy-muted'));
    const refresh = make('button', 'Actualizar saldo e historial'); refresh.type = 'button'; refresh.addEventListener('click', load); const tools = make('div', undefined, 'economy-actions'); tools.append(refresh); host.append(tools);
    const grid = make('div', undefined, 'economy-grid');
    for (const [field, title] of [['cash', 'Efectivo'], ['bank', 'Banco']]) { const c = make('article', undefined, 'economy-card'); c.append(make('h4', title), make('strong', data.available ? format(data.balance[field]) : 'No disponible', 'economy-amount')); if (data.available) c.append(make('small', 'Consulta: ' + date(data.balance.at), 'economy-muted')); grid.append(c); }
    host.append(grid, make('p', data.message, 'economy-muted'), make('p', data.balanceNotice, 'economy-muted'));
    const operations = make('div', undefined, 'economy-grid');
    for (const [id, title] of [['deposit', 'Depositar'], ['withdraw', 'Retirar'], ['transfer', 'Transferir']]) { const c = make('article', undefined, 'economy-card'), button = make('button', title); button.type = 'button'; button.disabled = true; c.append(button, make('p', data.operations[id].reason, 'economy-muted')); operations.append(c); } host.append(operations);
    const fines = make('section'); fines.append(make('h4', 'Pagar una multa con efectivo del rol'), make('p', 'El importe se obtiene del expediente. Confirma una sola vez. Si el resultado es incierto, no vuelvas a pagar; el personal debe revisarlo.', 'economy-muted'));
    if (!data.fines.length) fines.append(make('p', 'No tienes multas vigentes pendientes de pago.', 'economy-muted'));
    for (const f of data.fines) {
      const card = make('article', undefined, 'economy-card'); card.append(make('h4', f.id), make('strong', format(f.amount)));
      const details = make('details'), summary = make('summary', 'Revisar antes de pagar'), note = make('p', 'Se descontará el importe indicado del efectivo de tu cuenta de rol.'), confirm = make('button', 'Confirmar pago único'), feedback = make('p', undefined, 'economy-feedback'); confirm.type = 'button'; confirm.disabled = !data.available || f.pending || data.history.some(a => ['en-proceso', 'no-confirmado'].includes(a.status)); feedback.setAttribute('role', 'status');
      if (f.pending) feedback.textContent = 'Existe un intento en proceso o incierto. Espera su revisión.';
      const id = owner, revision = epoch;
      confirm.addEventListener('click', async () => {
        if (confirm.disabled || !current(id, revision)) return; confirm.disabled = true; feedback.textContent = 'Procesando una única solicitud…';
        const requestId = keys.get(f.id) || key(); keys.set(f.id, requestId);
        try {
          const response = await app().api('/api/profile/economy/payments', { fineId: f.id, requestId });
          if (!current(id, revision)) return; feedback.textContent = response.message; app().notice(response.message); await app().refresh();
        } catch (error) { if (!current(id, revision)) return; feedback.textContent = error.message + ' Actualiza el historial antes de continuar.'; }
      });
      details.append(summary, note, confirm, feedback); card.append(details); fines.append(card);
    } host.append(fines);
    const history = make('section'); history.append(make('h4', 'Historial y comprobantes'), make('p', data.historyNotice, 'economy-muted'));
    const filters = make('div', undefined, 'economy-filters'), search = make('input'), select = make('select'), list = make('div'); search.type = 'search'; search.placeholder = 'Buscar referencia o multa'; search.setAttribute('aria-label', 'Buscar movimiento'); select.setAttribute('aria-label', 'Estado del movimiento'); for (const [value, text] of [['', 'Todos los estados'], ...Object.entries(names)]) { const option = make('option', text); option.value = value; select.append(option); } filters.append(search, select); history.append(filters, list);
    function draw() {
      list.replaceChildren(); const q = search.value.trim().toLowerCase(), rows = data.history.filter(a => (!select.value || a.status === select.value) && [a.reference, a.fineId, a.reviewReference].join(' ').toLowerCase().includes(q));
      if (!rows.length) list.append(make('p', 'No hay movimientos con esos filtros.', 'economy-muted'));
      for (const a of rows) {
        const card = make('article', undefined, 'economy-card'); card.append(make('h4', a.fineId), make('span', names[a.status] || a.status, 'economy-status')); detail(card, 'Referencia Maes', a.reference || 'Intento heredado sin referencia'); detail(card, 'Importe', format(a.amount)); detail(card, 'Fecha', date(a.at)); if (a.reviewReference) detail(card, 'Referencia revisada', a.reviewReference);
        if (a.status === 'confirmado') { const button = make('button', 'Descargar comprobante'); button.type = 'button'; const id = owner, revision = epoch; button.addEventListener('click', async () => {
          if (!current(id, revision)) return; button.disabled = true;
          try { const result = await app().api('/api/profile/economy/receipts/' + encodeURIComponent(a.id)); if (!current(id, revision)) return; const a = result.item, text = [result.document, '', 'Estado: CONFIRMADO', 'Multa: ' + a.fineId, 'Importe: ' + format(a.amount), 'Proveedor: ' + result.provider, 'Referencia Maes: ' + a.reference, 'Fecha: ' + date(a.finishedAt || a.reviewedAt || a.at), ...(a.reviewReference ? ['Referencia revisada del proveedor: ' + a.reviewReference] : []), '', result.referenceNotice].join('\n'), file = new Blob([text], { type: 'text/plain;charset=utf-8' }), url = URL.createObjectURL(file), link = make('a'); link.href = url; link.download = 'maes-comprobante-' + a.id + '.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
          catch (error) { if (current(id, revision)) app().notice(error.message); } finally { if (current(id, revision)) button.disabled = false; }
        }); card.append(button); } list.append(card);
      }
    } search.addEventListener('input', draw); select.addEventListener('change', draw); draw(); host.append(history);
  }
  document.addEventListener('citizen:updated', event => {
    if (!host || !app()) return; const state = event.detail || {}, next = !state.demo && state.me ? String(state.me.discordId || state.me.id || '') : null;
    if (owner !== next) keys.clear(); owner = next; epoch++; data = null; balances(null);
    if (!next || !state.citizen) { host.replaceChildren(make('h3', 'Economía Maes RP'), make('p', next ? 'Registra tu personaje para consultar la economía.' : 'Inicia sesión con Discord para consultar tu economía.', 'economy-muted')); return; } load();
  });
  const reviews = document.querySelector('#economyReviews'); let reviewEpoch = 0;
  async function staffApi(url, body) { const response = await fetch(url, { headers: { 'X-Local-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) }); const result = await response.json(); if (!response.ok) throw Object.assign(Error(result.message), { status: response.status }); return result; }
  async function review() {
    if (!reviews) return; const mine = ++reviewEpoch; reviews.replaceChildren(); reviews.hidden = true;
    try {
      const { user } = await staffApi('/api/staff/me'); if (mine !== reviewEpoch || !user?.isAdmin || !user?.hasPoliceAccess) return;
      const result = await staffApi('/api/staff/economy/reviews'), again = await staffApi('/api/staff/me'); if (mine !== reviewEpoch || !again.user?.isAdmin || !again.user?.hasPoliceAccess || (again.user.discordId || again.user.id) !== (user.discordId || user.id)) return;
      reviews.hidden = false; reviews.append(make('h2', 'Revisión de cobros inciertos'), make('p', 'Verifica primero la operación en UnbelievaBoat. Una consulta de saldo no demuestra si se cobró. Esta resolución no envía nuevos cobros.', 'economy-muted')); const refresh = make('button', 'Actualizar operaciones'); refresh.addEventListener('click', review); reviews.append(refresh);
      if (!result.items.length) reviews.append(make('p', 'No hay operaciones en proceso o inciertas.'));
      for (const row of result.items) {
        const c = make('article', undefined, 'economy-card'); c.append(make('h3', row.fineId)); detail(c, 'Titular Discord', row.userId); detail(c, 'Referencia Maes', row.attempt.reference); detail(c, 'Importe', format(row.attempt.amount)); detail(c, 'Estado', names[row.attempt.status]);
        const form = make('form'), label = make('label', 'Referencia verificada del proveedor'), reference = make('input'), nlabel = make('label', 'Evidencia y comprobación realizadas'), note = make('textarea'), yes = make('button', 'Cobro verificado: marcar pagada'), no = make('button', 'Sin cobro verificado: desbloquear'), feedback = make('p', undefined, 'economy-feedback'); reference.required = true; reference.minLength = 5; reference.maxLength = 200; note.required = true; note.minLength = 15; note.maxLength = 1500; feedback.setAttribute('role', 'status'); label.append(reference); nlabel.append(note); yes.type = no.type = 'button'; form.append(label, nlabel, yes, no, feedback); c.append(form); reviews.append(c);
        for (const [button, charged] of [[yes, true], [no, false]]) button.addEventListener('click', async () => {
          if (!form.reportValidity() || yes.disabled || mine !== reviewEpoch) return; yes.disabled = no.disabled = true;
          try { await staffApi('/api/staff/economy/reviews/' + encodeURIComponent(row.fineId), { expectedAttemptId: row.attempt.id, charged, reference: reference.value, note: note.value }); if (mine === reviewEpoch) review(); }
          catch (error) { if (mine === reviewEpoch) { feedback.textContent = error.message; yes.disabled = no.disabled = false; if ([401, 403].includes(error.status)) { reviewEpoch++; reviews.replaceChildren(); reviews.hidden = true; } } }
        });
      }
    } catch { if (mine === reviewEpoch) { reviews.replaceChildren(); reviews.hidden = true; } }
  }
  document.addEventListener('staff:logout', () => { reviewEpoch++; if (reviews) { reviews.replaceChildren(); reviews.hidden = true; } });
  if (reviews) review();
})();
