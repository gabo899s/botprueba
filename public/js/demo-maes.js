/* Public, isolated demonstration: all state lives in this closure, never in production. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const workspace = $('#workspace'), dialog = $('#demoDialog'), dialogBody = $('#dialogBody');
  const money = (value) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(value);
  const stamp = () => new Date().toLocaleString('es-CR');
  const initialState = () => ({
    cash: 25000, bank: 180000, sequence: 3, selected: 'DEMO-001',
    people: [
      { id: 'DEMO-001', name: 'Alex Ciudadano Ejemplo', user: 'CiudadanoDemo', initials: 'AC', born: '02/04/2000', nation: 'Costarricense (ficción)', blood: 'O+', height: '175 cm', birthplace: 'San José · ficticio' },
      { id: 'DEMO-002', name: 'Sam Personaje Ficticio', user: 'PersonajeDemo', initials: 'SP', born: '18/11/1998', nation: 'Costarricense (ficción)', blood: 'A+', height: '169 cm', birthplace: 'Cartago · ficticio' },
    ],
    records: [{ id: 'MULTA-DEMO-001', person: 'DEMO-001', type: 'Multa', amount: 5000, reason: 'Estacionamiento indebido · artículo ficticio A-01', status: 'Pendiente', created: '12/10/2026', due: '26/10/2026', history: ['Emisión de ejemplo por Agente Demo'], caseId: 'CASO-DEMO-001' }],
    notices: [{ id: 'AVISO-DEMO-001', title: 'Una multa de ejemplo está disponible', record: 'MULTA-DEMO-001', read: false }],
    tickets: [{ id: 'TICKET-DEMO-001', subject: 'Consulta de ejemplo sobre mi licencia', messages: [{ author: 'Personaje demo', text: '¿Cómo consulto mi licencia de ejemplo?' }, { author: 'Respuesta simulada', text: 'Abre la sección Licencias de esta demostración. Esta conversación es ficticia.' }] }],
    renewals: [], transactions: [], events: ['Datos ficticios cargados; no se ha consultado ningún servicio.'],
    cases: [{ id: 'CASO-DEMO-001', title: 'Revisión de tránsito · ejemplo', description: 'Incidente ficticio para enseñar cómo se agrupan actuaciones.', status: 'Abierto' }],
  });
  let state = initialState(), view = '', tab = 'perfil', lastOpener = null, statusTimer;
  function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2), value);
      else if (key === 'class') element.className = value;
      else if (key === 'text') element.textContent = value;
      else if (value !== false && value != null) element.setAttribute(key, String(value));
    }
    for (const child of children.flat(Infinity)) if (child != null) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
    return element;
  }
  function button(label, action, primary = false) { return el('button', { type: 'button', class: primary ? 'primary' : '', onclick: action }, label); }
  function toast(text) { $('#demoStatus').textContent = text; clearTimeout(statusTimer); statusTimer = setTimeout(() => { $('#demoStatus').textContent = ''; }, 6500); }
  function log(text) { state.events.unshift(`${stamp()} · ${text}`); state.events.length = Math.min(100, state.events.length); }
  function person() { return state.people.find((p) => p.id === state.selected); }
  function details(pairs) { return el('dl', { class: 'details' }, pairs.map(([label, value]) => el('div', {}, el('dt', {}, label), el('dd', {}, value)))); }
  function card(title, ...content) { return el('section', { class: 'card' }, el('h3', {}, title), content); }
  function empty(text) { return el('p', { class: 'empty' }, text); }
  function modal(title, contents) {
    lastOpener = document.activeElement;
    $('#dialogTitle').textContent = title;
    dialogBody.replaceChildren(contents);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    const first = dialog.querySelector('input, select, textarea') || $('#closeDialog');
    first.focus();
  }
  function closeModal() { if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open'); if (lastOpener?.isConnected) lastOpener.focus(); }
  $('#closeDialog').addEventListener('click', closeModal);
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeModal(); });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button,input,select,textarea,a[href]')].filter((node) => !node.disabled);
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
  });
  function field(label, name, options = {}) {
    const type = options.type || 'input';
    const input = el(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input', { name, required: true, ...options });
    input.removeAttribute('options');
    if (type === 'select') { input.removeAttribute('type'); for (const [value, text] of options.options || []) input.append(el('option', { value }, text)); }
    if (type === 'textarea') input.removeAttribute('type');
    return el('label', {}, label, input);
  }
  function form(submit, ...children) {
    return el('form', { class: 'form', onsubmit: (event) => { event.preventDefault(); const f = event.currentTarget; if (f.reportValidity()) submit(new FormData(f), f); } }, children);
  }
  function pickTab(next, recordId) {
    tab = next; render();
    const section = $('#activePanel');
    if (recordId) { const record = document.getElementById(recordId); if (record) { record.classList.add('result-highlight'); record.focus(); record.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); return; } }
    section?.focus();
  }
  function navigate(next, updateHistory = true) {
    view = ['ciudadano', 'policia'].includes(next) ? next : '';
    tab = view === 'policia' ? 'buscar' : 'perfil';
    if (updateHistory) history.pushState(null, '', `/demo/maes${view ? `/${view}` : ''}`);
    render(); if (updateHistory) workspace.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-view]').forEach((link) => link.addEventListener('click', (event) => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); navigate(link.dataset.view); } }));
  addEventListener('popstate', () => navigate(location.pathname.split('/').at(-1), false));
  $('#resetDemo').addEventListener('click', () => modal('Restablecer esta demostración', el('div', {}, el('p', {}, 'Se borrarán únicamente las actuaciones, mensajes y movimientos simulados de esta pestaña. Ningún dato real se verá afectado.'), button('Restablecer datos ficticios', () => { state = initialState(); closeModal(); render(); toast('Demo restablecida.'); }, true))));
  function render() {
    document.querySelectorAll('[data-view]').forEach((link) => { if (link.dataset.view === view) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    if (!view) return renderWelcome();
    const citizen = view === 'ciudadano';
    const menu = citizen ? [['perfil', 'Perfil'], ['cedula', 'Mi cédula'], ['vehiculos', 'Vehículos'], ['licencias', 'Licencias'], ['expediente', 'Expediente'], ['avisos', `Avisos (${state.notices.filter((n) => !n.read).length})`], ['soporte', 'Soporte'], ['economia', 'Economía']] : [['buscar', 'Ciudadanos'], ['expediente', 'Expediente'], ['multa', 'Nueva multa'], ['arresto', 'Nuevo arresto'], ['casos', 'Casos'], ['pendientes', 'Pendientes'], ['historial', 'Historial']];
    const banner = el('section', { class: 'banner' }, el('div', {}, el('span', { class: 'eyebrow' }, 'MAES RP / DEMOSTRACIÓN'), el('h1', {}, citizen ? 'Panel ciudadano' : 'Plataforma policial'), el('p', {}, citizen ? 'Alex Ciudadano Ejemplo · Personaje ficticio' : 'Agente Demo · Permisos simulados, sin acceso real')));
    if (citizen) banner.append(el('div', { class: 'summary' }, el('div', { class: 'metric' }, el('small', {}, 'Efectivo ficticio'), el('strong', {}, money(state.cash))), el('div', { class: 'metric' }, el('small', {}, 'Banco ficticio'), el('strong', {}, money(state.bank)))));
    const tabs = el('nav', { class: 'tabs', 'aria-label': citizen ? 'Secciones del ciudadano' : 'Herramientas policiales' }, menu.map(([key, label]) => el('button', { type: 'button', 'data-tab': key, 'aria-pressed': key === tab, onclick: () => pickTab(key) }, label)));
    const panel = el('section', { id: 'activePanel', class: 'panel', tabindex: '-1', 'aria-label': menu.find(([key]) => key === tab)?.[1] || 'Detalle' });
    workspace.replaceChildren(banner, tabs, panel);
    const pages = citizen ? { perfil: renderProfile, cedula: renderIdentity, vehiculos: renderVehicles, licencias: renderLicenses, expediente: renderRecords, avisos: renderNotices, soporte: renderSupport, economia: renderEconomy } : { buscar: renderSearch, expediente: renderRecords, multa: () => renderCreateRecord('Multa'), arresto: () => renderCreateRecord('Arresto'), casos: renderCases, pendientes: renderPending, historial: renderHistory };
    (pages[tab] || renderProfile)(panel);
  }
  function renderWelcome() {
    workspace.replaceChildren(el('section', { class: 'welcome' }, el('span', { class: 'eyebrow' }, 'SISTEMA COMPLETO PARA ROLEPLAY'), el('h1', {}, 'Tu comunidad. Sus historias. Un mismo sistema.'), el('p', { class: 'muted' }, 'Explora dos perspectivas del ejemplo Maes RP. Consulta una identidad ficticia, crea una actuación de prueba y comprueba cómo aparece en el panel ciudadano.')),
      el('div', { class: 'grid' }, ['ciudadano', 'policia'].map((next) => el('section', { class: 'portal-choice' }, el('span', { class: 'badge' }, 'Sin registro · datos ficticios'), el('h2', {}, next === 'ciudadano' ? 'Vive tu personaje' : 'Gestiona una actuación'), el('p', { class: 'muted' }, next === 'ciudadano' ? 'Identidad, vehículos, licencias, avisos y soporte en un solo espacio.' : 'Búsqueda de personajes, multas, arrestos, casos y pendientes de ejemplo.'), el('a', { href: `/demo/maes/${next}`, onclick: (event) => { event.preventDefault(); navigate(next); } }, next === 'ciudadano' ? 'Explorar ciudadano' : 'Explorar policía')))));
  }
  function heading(panel, title, subtitle) { panel.append(el('div', { class: 'panel-heading' }, el('h2', {}, title), el('span', { class: 'badge' }, 'DATOS FICTICIOS'))); if (subtitle) panel.append(el('p', { class: 'help' }, subtitle)); }
  function renderProfile(panel) {
    heading(panel, 'Mi perfil de ejemplo');
    const p = state.people[0];
    panel.append(el('div', { class: 'grid' }, card('Datos del personaje', el('div', { class: 'person' }, el('div', { class: 'avatar', 'aria-hidden': 'true' }, p.initials), el('div', {}, el('h3', {}, p.name), el('p', {}, `${p.id} · @${p.user}`))), details([['Nacimiento ficticio', p.born], ['Nacionalidad ficticia', p.nation], ['Estatura ficticia', p.height], ['Grupo sanguíneo ficticio', p.blood]]), button('Ver mi cédula', () => pickTab('cedula'))), card('Cuentas y privacidad', el('p', {}, 'Esta demostración no vincula cuentas. Discord y Roblox solo se conectan en el servicio real, con autorización.'), details([['Discord', 'Sin conexión · demo'], ['Roblox', 'Sin conexión · demo'], ['Almacenamiento', 'Memoria de esta pestaña'], ['Datos personales reales', 'Ninguno']]), button('Consultar avisos', () => pickTab('avisos')))));
  }
  function renderIdentity(panel) {
    heading(panel, 'Mi cédula de roleplay', 'Diseño de ejemplo. No acredita identidad y no es un documento oficial. La impresión siempre conserva la marca de demostración.');
    const p = state.people[0];
    panel.append(el('article', { class: 'identity', id: 'demoIdentity', 'aria-label': 'Cédula ficticia de Maes RP' }, el('header', {}, el('h3', {}, 'MAES RP'), el('span', { class: 'badge' }, 'DEMO · SIN VALIDEZ')), el('div', { class: 'identity-body' }, el('div', { class: 'identity-portrait' }, el('strong', {}, p.initials), 'PERSONAJE FICTICIO'), el('div', {}, el('span', { class: 'eyebrow' }, 'IDENTIDAD DE ROLEPLAY'), el('h2', {}, p.name), details([['Identificador de ejemplo', p.id], ['Usuario de ejemplo', p.user], ['Nacimiento ficticio', p.born], ['Nacionalidad ficticia', p.nation], ['Estatura ficticia', p.height], ['Grupo sanguíneo ficticio', p.blood]]))), el('footer', {}, 'DEMOSTRACIÓN · DATOS FICTICIOS · NO ES UN DOCUMENTO OFICIAL · SIN VALIDEZ LEGAL')), el('div', { class: 'toolbar' }, button('Imprimir cédula de demostración', () => window.print())));
  }
  function renderVehicles(panel) {
    heading(panel, 'Mis vehículos', 'Ejemplos ilustrativos; no se consulta ningún inventario de Roblox.');
    panel.append(el('div', { class: 'grid' }, card('Sedán de ejemplo', el('span', { class: 'badge' }, 'Registrado · ficticio'), details([['Matrícula ficticia', 'DEMO-101'], ['Modelo', 'Sedán urbano'], ['Color', 'Rojo'], ['Titular ficticio', state.people[0].name]]), button('Ver ficha de ejemplo', () => modal('Ficha del vehículo ficticio', details([['Matrícula de ejemplo', 'DEMO-101'], ['Origen', 'Catálogo ficticio de la demo'], ['Estado', 'Sin trámites reales'], ['Nota', 'No acredita propiedad de ningún vehículo real ni de Roblox.']])))), card('Motocicleta de ejemplo', el('span', { class: 'badge' }, 'Registrado · ficticio'), details([['Matrícula ficticia', 'DEMO-202'], ['Modelo', 'Motocicleta urbana'], ['Color', 'Negro'], ['Titular ficticio', state.people[0].name]]))));
  }
  function renderLicenses(panel) {
    heading(panel, 'Licencias y solicitudes', 'Vigencias y categorías ficticias. Ninguna solicitud de esta pantalla otorga permisos reales.');
    const requested = state.renewals.length > 0;
    const renew = button(requested ? 'Solicitud simulada pendiente' : 'Simular solicitud de renovación', () => modal('Solicitar renovación de ejemplo', form((data) => { const reason = data.get('reason').trim(); if (reason.length < 10) return toast('Describe el motivo con al menos 10 caracteres.'); if (state.renewals.length) return toast('Ya existe una solicitud simulada pendiente.'); state.renewals.push({ reason, status: 'Pendiente' }); log('Solicitud ficticia de renovación presentada'); closeModal(); render(); toast('Solicitud de ejemplo enviada a Pendientes policiales.'); }, field('Motivo ficticio de renovación', 'reason', { type: 'textarea', minlength: 10, maxlength: 300 }), el('p', { class: 'help' }, 'No añadas datos ni documentos personales.'), el('button', { class: 'primary', type: 'submit' }, 'Enviar solicitud simulada'))));
    renew.disabled = requested;
    panel.append(card('Licencia de conducción · B1 de ejemplo', details([['Número ficticio', 'LIC-DEMO-001'], ['Estado ilustrativo', 'Vigente en el escenario'], ['Vigencia del ejemplo', '01/10/2026 – 01/10/2028'], ['Solicitud de renovación', requested ? state.renewals[0].status : 'Sin solicitud']]), renew));
  }
  function renderRecords(panel) {
    const citizen = view === 'ciudadano';
    const selected = citizen ? state.people[0] : person();
    heading(panel, citizen ? 'Mi expediente ficticio' : `Expediente: ${selected.name}`, 'Las actuaciones se pueden crear desde Policía y consultar aquí. Todo se borra al recargar.');
    if (!citizen) panel.append(details([['Personaje ficticio', selected.name], ['Identificador', selected.id]]));
    const list = el('div', { class: 'record-list' });
    const filter = el('select', { 'aria-label': 'Filtrar actuaciones' }, [['', 'Todas las actuaciones'], ['Multa', 'Multas'], ['Arresto', 'Arrestos']].map(([value, title]) => el('option', { value }, title)));
    filter.className = 'search-input';
    const paint = () => { const records = state.records.filter((r) => r.person === selected.id && (!filter.value || r.type === filter.value)); list.replaceChildren(...records.map(recordCard)); if (!records.length) list.append(empty('No hay actuaciones ficticias con este filtro.')); };
    filter.addEventListener('change', paint); paint(); panel.append(filter, el('p', { class: 'help' }, 'Los documentos PDF del servicio real no se generan en esta demostración.'), list);
  }
  function recordCard(record) {
    const citizen = view === 'ciudadano';
    const result = card(`${record.type} · ${record.id}`, el('span', { class: 'badge' }, record.status), el('p', {}, record.reason), details([['Importe ficticio', record.type === 'Multa' ? money(record.amount) : 'No corresponde'], ['Fecha de ejemplo', record.created], ['Vencimiento ficticio', record.due || 'No corresponde'], ['Caso de ejemplo', record.caseId || 'Sin asignar']]));
    result.id = record.id; result.tabIndex = -1;
    const actions = el('div', { class: 'toolbar' }, button('Ver historial', () => modal('Historial de ejemplo', el('ol', { class: 'timeline' }, record.history.map((entry) => el('li', {}, entry))))));
    if (citizen && record.type === 'Multa' && record.status === 'Pendiente') actions.append(button('Simular aviso de pago', () => modal('Aviso de pago de demostración', el('div', {}, el('p', {}, 'No hay pago ni cargo real. Este botón únicamente mueve la multa ficticia a la bandeja de validación del agente.'), button('Enviar aviso simulado', () => { if (record.status !== 'Pendiente') return toast('Esta actuación ya cambió de estado.'); record.status = 'Pago por validar'; record.history.push(`${stamp()} · Aviso de pago ficticio`); log(`Aviso de pago simulado: ${record.id}`); closeModal(); render(); toast('Aviso ficticio en Pendientes policiales.'); }, true)))));
    if (!citizen && record.status !== 'Anulada') actions.append(button('Rectificar o anular', () => correction(record)));
    result.append(actions); return result;
  }
  function renderNotices(panel) {
    heading(panel, 'Avisos de ejemplo');
    panel.append(button('Marcar todos como leídos', () => { state.notices.forEach((n) => { n.read = true; }); render(); toast('Avisos ficticios marcados como leídos.'); }));
    const list = el('div', { class: 'record-list' });
    for (const notice of state.notices) list.append(card(notice.title, el('p', {}, notice.read ? 'Leído · ejemplo' : 'Nuevo · ejemplo'), button('Abrir actuación', () => { notice.read = true; pickTab('expediente', notice.record); })));
    panel.append(el('p', { class: 'help' }, 'Cada aviso abre exactamente su actuación de ejemplo.'), list);
  }
  function renderSupport(panel) {
    heading(panel, 'Soporte de demostración', 'No se envían mensajes a personal real. No introduzcas información personal.');
    panel.append(button('Crear consulta de ejemplo', () => modal('Consulta ficticia', form((data) => { if (state.tickets.length >= 10) return toast('Límite de 10 consultas de ejemplo. Restablece la demo para continuar.'); const subject = data.get('subject').trim(), text = data.get('message').trim(); if (subject.length < 5 || text.length < 10) return toast('Añade un asunto de al menos 5 caracteres y un mensaje de 10.'); state.tickets.unshift({ id: `TICKET-DEMO-${++state.sequence}`, subject, messages: [{ author: 'Personaje demo', text }, { author: 'Respuesta automática simulada', text: 'Consulta de ejemplo recibida. Esta es una respuesta ficticia, sin conexión a un servicio de soporte.' }] }); closeModal(); render(); toast('Consulta guardada solo en esta pestaña.'); }, field('Asunto ficticio', 'subject', { minlength: 5, maxlength: 80 }), field('Mensaje ficticio', 'message', { type: 'textarea', minlength: 10, maxlength: 800 }), el('button', { type: 'submit', class: 'primary' }, 'Crear consulta simulada')))));
    for (const ticket of state.tickets) panel.append(card(`${ticket.id} · ${ticket.subject}`, el('div', { class: 'record-list' }, ticket.messages.map((message) => card(message.author, el('p', {}, message.text)))), form((data, f) => { const text = data.get('message').trim(); if (text.length < 3) return toast('Escribe al menos 3 caracteres.'); if (ticket.messages.length >= 32) return toast('Esta conversación de ejemplo alcanzó su límite.'); ticket.messages.push({ author: 'Personaje demo', text }); f.reset(); render(); toast('Respuesta ficticia añadida.'); }, field('Respuesta de ejemplo', 'message', { type: 'textarea', minlength: 3, maxlength: 800 }), el('button', { type: 'submit' }, 'Añadir respuesta simulada'))));
  }
  function renderEconomy(panel) {
    heading(panel, 'Economía de ejemplo', 'Los importes son ficticios. No se conecta un banco, proveedor de economía ni Roblox; no hay dinero real.');
    panel.append(el('div', { class: 'toolbar' }, button('Depositar ficticiamente', () => moveMoney('depositar')), button('Retirar ficticiamente', () => moveMoney('retirar')), button('Transferir ficticiamente', () => moveMoney('transferir'))));
    panel.append(details([['Efectivo de ejemplo', money(state.cash)], ['Banco de ejemplo', money(state.bank)]]));
    const search = el('input', { class: 'search-input', type: 'search', placeholder: 'Buscar movimiento ficticio', 'aria-label': 'Buscar movimiento ficticio', maxlength: 100 });
    const list = el('div', { class: 'record-list' });
    const paint = () => { const rows = state.transactions.filter((t) => `${t.type} ${t.id} ${t.target || ''}`.toLowerCase().includes(search.value.trim().toLowerCase())); list.replaceChildren(...rows.map((t) => card(`${t.type} · ${money(t.amount)}`, el('p', {}, `${t.id} · ${t.created}${t.target ? ` · ${t.target}` : ''}`), button('Ver comprobante ficticio', () => modal('Comprobante SIN VALIDEZ', details([['Operación ficticia', t.id], ['Importe ficticio', money(t.amount)], ['Movimiento', t.type], ['Destino de ejemplo', t.target || 'Cuenta propia ficticia'], ['Aviso', 'No acredita pago ni transferencia real.']])))))); if (!rows.length) list.append(empty('No hay movimientos ficticios con este filtro.')); };
    search.addEventListener('input', paint); paint(); panel.append(search, list);
  }
  function moveMoney(type) {
    modal(`${type[0].toUpperCase()}${type.slice(1)} · simulación`, form((data) => {
      const amount = Number(data.get('amount'));
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) return toast('Usa un entero entre 1 y 100 000.');
      if (state.transactions.length >= 50) return toast('Límite de 50 movimientos simulados.');
      if (type === 'depositar' && state.cash < amount || type !== 'depositar' && state.bank < amount) return toast('Saldo ficticio insuficiente.');
      if (type === 'depositar') { state.cash -= amount; state.bank += amount; } else { state.bank -= amount; if (type === 'retirar') state.cash += amount; }
      state.transactions.unshift({ id: `MOV-DEMO-${++state.sequence}`, type, amount, created: stamp(), target: type === 'transferir' ? state.people[1].name : '' });
      log(`Movimiento de economía ficticio: ${type}`); closeModal(); render(); toast('Movimiento ficticio registrado; no se movió dinero real.');
    }, field('Importe ficticio en colones', 'amount', { type: 'number', min: 1, max: 100000, step: 1 }), type === 'transferir' ? field('Destinatario ficticio', 'target', { type: 'select', options: [['DEMO-002', state.people[1].name]] }) : null, el('p', { class: 'help' }, 'Solo se modifica el saldo de ejemplo de esta pestaña.'), el('button', { type: 'submit', class: 'primary' }, 'Confirmar simulación')));
  }
  function renderSearch(panel) {
    heading(panel, 'Buscar un personaje ficticio', 'La búsqueda solo contiene dos personajes de ejemplo. No consulta identidades reales.');
    const input = el('input', { class: 'search-input', type: 'search', maxlength: 80, placeholder: 'Nombre, usuario o DEMO-001', 'aria-label': 'Buscar personaje ficticio' });
    const results = el('div', { class: 'record-list' });
    const search = () => { const term = input.value.trim().toLocaleLowerCase('es'); const people = state.people.filter((p) => `${p.name} ${p.id} ${p.user}`.toLocaleLowerCase('es').includes(term)); results.replaceChildren(...people.map((p) => card(p.name, el('p', {}, `${p.id} · @${p.user}`), button('Abrir expediente', () => { state.selected = p.id; pickTab('expediente'); })))); if (!people.length) results.append(empty('Ningún personaje de ejemplo coincide. Prueba «Alex» o «Sam».')); };
    input.addEventListener('input', search); search(); panel.append(input, el('p', { class: 'help' }, 'Selecciona un personaje para emitir actuaciones ficticias.'), results);
  }
  const articles = [['A-01', 'Estacionamiento indebido · ejemplo', 5000], ['A-02', 'Señal de tránsito · ejemplo', 10000], ['A-03', 'Conducción imprudente · ejemplo', 20000]];
  function renderCreateRecord(type, panel = $('#activePanel')) {
    heading(panel, `${type} de demostración`, 'Catálogo inventado para esta demo. No representa legislación ni tarifas reales. Primero revisa la previsualización.');
    const articleField = field('Artículo ficticio', 'article', { type: 'select', options: articles.map(([id, text]) => [id, `${id} · ${text}`]) });
    const amountField = field(type === 'Multa' ? 'Importe calculado ficticio' : 'Duración ficticia en minutos', 'amount', { type: 'number', min: 1, max: type === 'Multa' ? 100000 : 120, step: 1 });
    amountField.querySelector('input').value = type === 'Multa' ? '5000' : '15';
    if (type === 'Multa') { amountField.querySelector('input').readOnly = true; articleField.querySelector('select').addEventListener('change', (event) => { amountField.querySelector('input').value = articles.find(([id]) => id === event.target.value)[2]; }); }
    const f = form((data) => {
      const article = articles.find(([id]) => id === data.get('article'));
      const target = state.people.find((p) => p.id === data.get('person'));
      const amount = type === 'Multa' ? article?.[2] : Number(data.get('amount'));
      const reason = data.get('reason').trim();
      if (!article || !target || reason.length < 10 || !Number.isSafeInteger(amount) || amount < 1 || amount > (type === 'Multa' ? 100000 : 120)) return toast('Revisa el personaje, artículo, importe y descripción de al menos 10 caracteres.');
      if (state.records.length >= 50) return toast('Límite de 50 actuaciones ficticias. Restablece la demo para continuar.');
      const caseId = String(data.get('caseId') || '');
      if (caseId && !state.cases.some((c) => c.id === caseId && c.status === 'Abierto')) return toast('El caso de ejemplo ya no está abierto.');
      let confirmed = false;
      const preview = el('div', {}, el('p', { class: 'badge' }, 'PREVISUALIZACIÓN · SIN EFECTOS REALES'), details([['Personaje ficticio', target.name], ['Artículo ficticio', `${article[0]} · ${article[1]}`], [type === 'Multa' ? 'Importe ficticio' : 'Duración ficticia', type === 'Multa' ? money(amount) : `${amount} minutos`], ['Motivo de ejemplo', reason], ['Caso', caseId || 'Sin asignar']]), button(`Confirmar ${type.toLowerCase()} ${type === 'Multa' ? 'simulada' : 'simulado'}`, () => {
        if (confirmed || state.records.length >= 50) return;
        confirmed = true;
        const now = new Date(), due = new Date(now); due.setDate(due.getDate() + 14);
        const record = { id: `${type.toUpperCase()}-DEMO-${++state.sequence}`, person: target.id, type, amount: type === 'Multa' ? amount : 0, reason: `${article[0]} · ${reason}${type === 'Arresto' ? ` · ${amount} min ficticios` : ''}`, created: now.toLocaleDateString('es-CR'), due: type === 'Multa' ? due.toLocaleDateString('es-CR') : '', status: 'Pendiente', caseId, history: [`${stamp()} · Emisión simulada por Agente Demo`] };
        state.records.unshift(record);
        if (target.id === 'DEMO-001') state.notices.unshift({ id: `AVISO-DEMO-${state.sequence}`, title: `${type === 'Multa' ? 'Nueva' : 'Nuevo'} ${type.toLowerCase()} de ejemplo`, record: record.id, read: false });
        state.selected = target.id; log(`Creación de ${record.id}`); closeModal(); pickTab('expediente', record.id); toast('Actuación ficticia creada. Puedes consultarla desde la perspectiva ciudadana.');
      }, true));
      modal('Revisar antes de simular', preview);
    }, field('Personaje ficticio', 'person', { type: 'select', options: state.people.map((p) => [p.id, p.name]) }), articleField, amountField, field('Descripción ficticia de los hechos', 'reason', { type: 'textarea', minlength: 10, maxlength: 500 }), field('Caso ficticio (opcional)', 'caseId', { type: 'select', required: false, options: [['', 'Sin asignar'], ...state.cases.filter((c) => c.status === 'Abierto').map((c) => [c.id, c.title])] }), el('button', { type: 'submit', class: 'primary' }, 'Previsualizar actuación simulada'));
    f.elements.person.value = state.selected; panel.append(f);
  }
  function correction(record) {
    modal('Rectificar sin borrar el historial', form((data) => {
      const reason = data.get('reason').trim(); if (reason.length < 10) return toast('Indica un motivo de al menos 10 caracteres.');
      const mode = data.get('mode');
      if (!['rectificar', 'anular'].includes(mode) || record.status === 'Anulada') return toast('Esta actuación ya no se puede modificar.');
      if (mode === 'anular') record.status = 'Anulada';
      record.history.push(`${stamp()} · ${mode === 'anular' ? 'Anulación' : 'Nota de rectificación'} simulada por Agente Demo: ${reason}`);
      log(`${mode} · ${record.id}`); closeModal(); render(); toast('Cambio ficticio registrado sin borrar el historial original.');
    }, field('Acción de ejemplo', 'mode', { type: 'select', options: [['rectificar', 'Añadir nota de rectificación'], ['anular', 'Anular actuación ficticia']] }), field('Motivo ficticio y corrección solicitada', 'reason', { type: 'textarea', minlength: 10, maxlength: 500 }), el('p', { class: 'help' }, 'Se conserva el motivo original y se añade una entrada al historial ficticio.'), el('button', { type: 'submit', class: 'primary' }, 'Guardar cambio simulado')));
  }
  function renderCases(panel) {
    heading(panel, 'Casos por incidente', 'Agrupación ilustrativa de actuaciones y seguimiento. No se admiten evidencias ni archivos reales.');
    panel.append(button('Crear caso ficticio', () => modal('Crear incidente de ejemplo', form((data) => {
      const title = data.get('title').trim(), description = data.get('description').trim();
      if (title.length < 5 || description.length < 10) return toast('Completa un título de 5 caracteres y una descripción de 10.');
      if (state.cases.length >= 20) return toast('Límite de 20 casos ficticios.');
      state.cases.unshift({ id: `CASO-DEMO-${++state.sequence}`, title, description, status: 'Abierto' }); log('Caso ficticio creado'); closeModal(); render(); toast('Caso de ejemplo disponible al previsualizar una actuación.');
    }, field('Título del caso ficticio', 'title', { minlength: 5, maxlength: 80 }), field('Resumen ficticio', 'description', { type: 'textarea', minlength: 10, maxlength: 500 }), el('button', { type: 'submit', class: 'primary' }, 'Crear caso simulado')))));
    for (const incident of state.cases) {
      const linked = state.records.filter((r) => r.caseId === incident.id);
      panel.append(card(`${incident.id} · ${incident.title}`, el('span', { class: 'badge' }, incident.status), el('p', {}, incident.description), el('p', {}, `${linked.length} ${linked.length === 1 ? 'actuación ficticia vinculada' : 'actuaciones ficticias vinculadas'} · Agente Demo`), linked.map((r) => button(`Ver ${r.id}`, () => { state.selected = r.person; pickTab('expediente', r.id); })), button(incident.status === 'Abierto' ? 'Cerrar caso simulado' : 'Reabrir caso simulado', () => { incident.status = incident.status === 'Abierto' ? 'Cerrado' : 'Abierto'; log(`${incident.status} · ${incident.id}`); render(); toast('Estado del caso ficticio actualizado.'); })));
    }
  }
  function renderPending(panel) {
    heading(panel, 'Mesa de pendientes', 'Avisos de pago y solicitudes de licencia, sin validaciones ni pagos reales.');
    const payments = state.records.filter((r) => r.status === 'Pago por validar');
    for (const record of payments) panel.append(card(`Pago por validar · ${record.id}`, el('p', {}, `${record.reason} · ${money(record.amount)}`), button('Validar aviso ficticio', () => { if (record.status !== 'Pago por validar') return; record.status = 'Pagada (simulación)'; record.history.push(`${stamp()} · Validación ficticia por Agente Demo`); log(`Pago ficticio validado: ${record.id}`); render(); toast('Validación simulada registrada una sola vez.'); }, true), button('Devolver a pendiente', () => { if (record.status !== 'Pago por validar') return; record.status = 'Pendiente'; record.history.push(`${stamp()} · Aviso ficticio devuelto`); render(); })));
    for (const renewal of state.renewals.filter((r) => r.status === 'Pendiente')) panel.append(card('Renovación ficticia · LIC-DEMO-001', el('p', {}, renewal.reason), button('Marcar como revisada', () => { if (renewal.status !== 'Pendiente') return; renewal.status = 'Revisada (simulación)'; log('Solicitud ficticia de licencia revisada'); render(); toast('Revisión ficticia completada; no se concedieron permisos reales.'); })));
    if (!payments.length && !state.renewals.some((r) => r.status === 'Pendiente')) panel.append(empty('Sin pendientes ficticios. Desde Ciudadano, simula un aviso de pago o solicita una renovación.'));
  }
  function renderHistory(panel) {
    heading(panel, 'Historial de la demostración', 'Registro local limitado a 100 eventos. No es el registro de auditoría del servicio real.');
    panel.append(el('ol', { class: 'timeline' }, state.events.map((entry) => el('li', {}, entry))));
  }
  navigate(location.pathname.split('/').at(-1), false);
})();
