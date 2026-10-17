const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const code = fs.readFileSync(path.join(__dirname, '../public/js/citizen-records.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides = {}) {
  const dom = new JSDOM('<div id="records"></div><div id="sanctions"></div>', { url: 'http://localhost:3000/ciudadano', runScripts: 'outside-only' });
  const w = dom.window, calls = [], notices = [];
  const app = { me: { discordId: '123456789012345678' }, el: (tag, text) => { const n = w.document.createElement(tag); if (text !== undefined) n.textContent = text; return n; }, link: (parent, href, text) => { const a = w.document.createElement('a'); a.href = href; a.textContent = text; parent.append(a); }, notice: text => notices.push(text), api: async (...args) => { calls.push(args); return {}; }, refresh: async () => {}, ...overrides };
  w.CitizenApp = app; w.eval(code);
  function update(detail = {}) { w.document.dispatchEvent(new w.CustomEvent('citizen:updated', { detail: { me: app.me, citizen: { multas: [], arrestos: [] }, sanctions: [], ...detail } })); }
  return { dom, w, app, calls, notices, update, $: selector => w.document.querySelector(selector) };
}
const fine = (id, overrides = {}) => ({ id, estado: 'REGISTRADA', articulos: 'Art. 7', oficialNombre: 'Agente Ana', createdAt: '2026-10-15T12:00:00Z', monto: 120, pdfUrl: '/pdfs/multa_1.pdf', ...overrides });
test('expediente separa tipos y combina búsqueda, fecha y estado sin perder filtros al refrescar', () => {
  const f = fixture();
  try {
    const c = { multas: [fine('m1'), fine('m2', { estado: 'PAGADA', oficialNombre: 'Agente Bruno', createdAt: '2026-09-01T00:00:00Z' })], arrestos: [{ id: 'a1', estado: 'REGISTRADO', articulos: 'Art. 10', tiempo: 5 }] };
    f.update({ citizen: c });
    assert.match(f.$('[data-record-kind="multas"]').textContent, /2/);
    const search = f.$('[data-record-filter="search"]'); search.value = 'Ana'; search.dispatchEvent(new f.w.Event('input'));
    assert.equal(f.w.document.querySelectorAll('.citizen-record').length, 1);
    const from = f.$('[data-record-filter="from"]'); from.value = '2026-10-16'; from.dispatchEvent(new f.w.Event('input'));
    assert.match(f.$('.records-list').textContent, /No hay resultados/);
    f.update({ citizen: c }); assert.equal(f.$('[data-record-filter="search"]').value, 'Ana');
    f.$('.record-filters button').click();
    const status = f.$('select'); status.value = 'PAGADA'; status.dispatchEvent(new f.w.Event('change'));
    assert.equal(f.w.document.querySelectorAll('.citizen-record').length, 1); assert.match(f.$('.citizen-record').textContent, /m2/);
    f.$('[data-record-kind="arrestos"]').click();
    assert.match(f.$('.citizen-record').textContent, /5 años de rol/); assert.equal(f.$('.record-actions button'), null);
  } finally { f.dom.window.close(); }
});
test('expediente escapa contenido y solamente ofrece documentos en rutas locales autorizadas', () => {
  const f = fixture();
  try {
    f.update({ citizen: { multas: [fine('m1', { articulos: '<img src=x onerror=alert(1)>', pdfUrl: 'javascript:alert(1)', imagenUrl: '/uploads/%2e%2e%2f.env' }), fine('m2', { pdfUrl: '/pdfs/multa-2.pdf', imagenUrl: 'https://evil.example/evidence' })] } });
    assert.equal(f.$('#records img'), null); assert.match(f.$('#records').textContent, /<img/);
    const links = [...f.w.document.querySelectorAll('#records a')]; assert.equal(links.length, 1); assert.equal(links[0].getAttribute('href'), '/pdfs/multa-2.pdf');
  } finally { f.dom.window.close(); }
});
test('solicitar validación envía el ID real una vez y mantiene la multa pendiente', async () => {
  let release; const f = fixture({ api: (...args) => { f.calls.push(args); return new Promise(resolve => { release = resolve; }); } });
  try {
    f.update({ citizen: { multas: [fine('m1'), fine('m2', { paymentAttempt: { status: 'no-confirmado' } }), fine('m3', { paymentAttempt: { status: 'en-proceso' } })] } });
    assert.match(f.$('#records').textContent, /no repitas el pago/); assert.match(f.$('#records').textContent, /Pago en proceso/);
    const button = f.$('.record-actions button'); button.click(); button.click(); assert.equal(f.calls.length, 1); assert.equal(button.disabled, true);
    assert.equal(f.calls[0][0], '/api/profile/payments'); assert.equal(f.calls[0][1].id, 'm1');
    release({}); await tick(); assert.match(f.$('#records').textContent, /Todavía no consta como pagada/); assert.match(f.notices[0], /sigue pendiente/);
    assert.equal(f.$('.record-actions button'), null);
  } finally { f.dom.window.close(); }
});
test('apelación usa formulario accesible, conserva borrador tras fallo y muestra resolución', async () => {
  let fail = true; const f = fixture({ api: async (...args) => { f.calls.push(args); if (fail) throw Error('Sin conexión'); return {}; } });
  try {
    const r = { id: 'sanction_1', estado: 'activa', motivo: '<script>mal</script>', fecha: '2026-10-01T00:00:00Z' };
    f.update({ sanctions: [r] }); const toggle = f.$('#sanctions button'); toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true'); assert.equal(f.$('textarea').maxLength, 1000);
    const form = f.$('form'), input = f.$('textarea'); input.value = 'Solicito revisar la prueba.'; input.dispatchEvent(new f.w.Event('input'));
    form.dispatchEvent(new f.w.Event('submit', { cancelable: true })); await tick();
    assert.match(f.$('.form-error').textContent, /Sin conexión/); assert.equal(input.value, 'Solicito revisar la prueba.');
    f.update({ sanctions: [r] }); assert.equal(f.$('textarea').value, input.value);
    f.$('#sanctions button').click(); fail = false; f.$('form').dispatchEvent(new f.w.Event('submit', { cancelable: true })); await tick();
    assert.equal(f.calls[1][0], '/api/staff/sanctions/123456789012345678/sanction_1/appeal'); assert.equal(f.calls[1][1].reason, input.value);
    assert.match(f.$('#sanctions').textContent, /pendiente/); assert.equal(f.$('form'), null);
    f.update({ sanctions: [{ ...r, estado: 'revocada', appeal: { status: 'aceptada', reason: 'Razón', decidedAt: '2026-10-17T00:00:00Z' } }] });
    assert.match(f.$('#sanctions').textContent, /Fecha de resolución/); assert.match(f.$('#sanctions').textContent, /sanción fue revocada/);
  } finally { f.dom.window.close(); }
});
test('fallo de pago permite reintento y cierre de sesión descarta resultados y borradores antiguos', async () => {
  let resolve; const f = fixture({ api: async () => { throw Error('No enviado'); } });
  try {
    f.update({ citizen: { multas: [fine('m1')] }, sanctions: [{ id: 's1', estado: 'activa' }] });
    let button = f.$('.record-actions button'); button.click(); await tick(); assert.equal(button.disabled, false); assert.match(f.$('.form-error').textContent, /No enviado/);
    f.$('textarea').value = 'Privado'; f.$('textarea').dispatchEvent(new f.w.Event('input'));
    f.app.api = () => new Promise(r => { resolve = r; }); button.click(); f.app.me = null; f.update({ demo: true, me: null }); resolve({}); await tick();
    assert.match(f.$('#records').textContent, /Inicia sesión/); assert.equal(f.$('.citizen-record'), null); assert.equal(f.notices.length, 0);
    f.app.me = { discordId: '987654321012345678' }; f.update({ sanctions: [{ id: 's1', estado: 'activa' }] }); assert.equal(f.$('textarea').value, '');
  } finally { f.dom.window.close(); }
});
test('fallo al cargar sanciones no se presenta como expediente vacío', () => {
  const f = fixture(); try { f.update({ sanctionsError: true }); assert.match(f.$('#sanctions').textContent, /No se pudieron cargar/); } finally { f.dom.window.close(); }
});
