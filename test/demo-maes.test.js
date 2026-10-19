const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/demo-maes.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/js/demo-maes.js'), 'utf8');
function page(route = '') {
  const dom = new JSDOM(html, { url: `http://localhost:3000/demo/maes${route}`, runScripts: 'outside-only' });
  const calls = [];
  dom.window.fetch = (...args) => { calls.push(args); throw new Error('La demo no debe hacer peticiones'); };
  dom.window.XMLHttpRequest = class { constructor() { throw new Error('La demo no debe usar XMLHttpRequest'); } };
  dom.window.WebSocket = class { constructor() { throw new Error('La demo no debe usar WebSocket'); } };
  dom.window.print = () => { calls.push(['print']); };
  dom.window.eval(script);
  return { dom, w: dom.window, d: dom.window.document, calls };
}
function click(ctx, text, scope = ctx.d) {
  const node = [...scope.querySelectorAll('button,a')].find((el) => el.textContent === text);
  assert.ok(node, `Existe el botón «${text}»`);
  node.click();
  return node;
}
function submit(ctx, selector, values) {
  const f = ctx.d.querySelector(selector);
  assert.ok(f, `Existe ${selector}`);
  for (const [key, value] of Object.entries(values)) f.elements[key].value = value;
  f.dispatchEvent(new ctx.w.Event('submit', { bubbles: true, cancelable: true }));
}
function tab(ctx, key) { ctx.d.querySelector(`[data-tab="${key}"]`).click(); }

test('demo pública explora ambas perspectivas sin red, sesión ni almacenamiento persistente', () => {
  const ctx = page();
  try {
    assert.match(ctx.d.body.textContent, /datos ficticios/i);
    click(ctx, 'Explorar ciudadano');
    assert.equal(ctx.w.location.pathname, '/demo/maes/ciudadano');
    for (const key of ['perfil', 'cedula', 'vehiculos', 'licencias', 'expediente', 'avisos', 'soporte', 'economia']) {
      tab(ctx, key);
      assert.ok(ctx.d.querySelector('#activePanel').textContent.trim());
    }
    click(ctx, 'Policía');
    for (const key of ['buscar', 'expediente', 'multa', 'arresto', 'casos', 'pendientes', 'historial']) {
      tab(ctx, key);
      assert.ok(ctx.d.querySelector('#activePanel').textContent.trim());
    }
    assert.deepEqual(ctx.calls, []);
    assert.equal(ctx.w.localStorage.length, 0);
    assert.equal(ctx.w.sessionStorage.length, 0);
    assert.equal(ctx.d.cookie, '');
    assert.equal(ctx.d.querySelector('a[href^="/auth"],a[href^="/api"],img[src^="http"]'), null);
    assert.doesNotMatch(script, /fetch\s*\(|localStorage|sessionStorage|document\.cookie|\/api\/|\/auth\//);
  } finally { ctx.dom.window.close(); }
});

test('demo conecta multa policial, aviso ciudadano y pago simulado idempotente', () => {
  const ctx = page('/policia');
  try {
    tab(ctx, 'multa');
    submit(ctx, '#activePanel form', { person: 'DEMO-001', article: 'A-02', reason: 'Hechos totalmente ficticios de prueba' });
    assert.match(ctx.d.querySelector('#dialogBody').textContent, /PREVISUALIZACIÓN/);
    assert.equal(ctx.d.querySelector('#activePanel').textContent.includes('MULTA-DEMO-4'), false);
    const confirm = click(ctx, 'Confirmar multa simulada', ctx.d.querySelector('#dialogBody'));
    confirm.click();
    assert.equal(ctx.d.querySelectorAll('#activePanel article').length, 0);
    assert.equal(ctx.d.querySelectorAll('#MULTA-DEMO-4').length, 1);
    assert.match(ctx.d.querySelector('#MULTA-DEMO-4').textContent, /10[.,\s]?000/);
    click(ctx, 'Ciudadano');
    tab(ctx, 'avisos');
    click(ctx, 'Abrir actuación');
    assert.equal(ctx.d.activeElement.id, 'MULTA-DEMO-4');
    click(ctx, 'Simular aviso de pago', ctx.d.getElementById('MULTA-DEMO-4'));
    click(ctx, 'Enviar aviso simulado', ctx.d.querySelector('#dialogBody'));
    click(ctx, 'Policía');
    tab(ctx, 'pendientes');
    const validate = click(ctx, 'Validar aviso ficticio');
    validate.click();
    assert.match(ctx.d.querySelector('#activePanel').textContent, /Sin pendientes ficticios/);
    tab(ctx, 'expediente');
    assert.match(ctx.d.querySelector('#MULTA-DEMO-4').textContent, /Pagada \(simulación\)/);
    click(ctx, 'Ver historial', ctx.d.getElementById('MULTA-DEMO-4'));
    assert.equal(ctx.d.querySelector('#dialogBody').textContent.match(/Validación ficticia/g).length, 1);
    assert.deepEqual(ctx.calls, []);
  } finally { ctx.dom.window.close(); }
});

test('demo conserva entradas como texto y exige motivos sin emitir actuaciones incompletas', () => {
  const ctx = page('/policia');
  try {
    tab(ctx, 'arresto');
    submit(ctx, '#activePanel form', { reason: '   ', amount: '15' });
    assert.equal(ctx.d.querySelector('#demoDialog').hasAttribute('open'), false);
    const text = '<img src=x onerror=alert(1)> descripción ficticia';
    submit(ctx, '#activePanel form', { reason: text, amount: '15' });
    assert.equal(ctx.d.querySelector('#dialogBody img'), null);
    assert.ok(ctx.d.querySelector('#dialogBody').textContent.includes(text));
    click(ctx, 'Confirmar arresto simulado', ctx.d.querySelector('#dialogBody'));
    assert.equal(ctx.d.querySelector('#activePanel img'), null);
    assert.ok(ctx.d.querySelector('#activePanel').textContent.includes(text));
  } finally { ctx.dom.window.close(); }
});

test('demo limita economía al saldo ficticio y restablece todo sin afectar datos reales', () => {
  const ctx = page('/ciudadano');
  try {
    tab(ctx, 'economia');
    click(ctx, 'Retirar ficticiamente');
    submit(ctx, '#dialogBody form', { amount: '100000' });
    assert.match(ctx.d.querySelector('#activePanel').textContent, /MOV-DEMO-4/);
    click(ctx, 'Retirar ficticiamente');
    submit(ctx, '#dialogBody form', { amount: '100000' });
    assert.match(ctx.d.querySelector('#demoStatus').textContent, /Saldo ficticio insuficiente/);
    assert.equal(ctx.d.querySelectorAll('#activePanel .record-list .card').length, 1);
    click(ctx, 'Cerrar');
    click(ctx, 'Restablecer demo');
    click(ctx, 'Restablecer datos ficticios');
    assert.match(ctx.d.querySelector('#activePanel').textContent, /No hay movimientos ficticios/);
    assert.deepEqual(ctx.calls, []);
  } finally { ctx.dom.window.close(); }
});

test('demo enlaza solicitudes de renovación y casos ficticios con su historial', () => {
  const ctx = page('/ciudadano');
  try {
    tab(ctx, 'licencias');
    click(ctx, 'Simular solicitud de renovación');
    submit(ctx, '#dialogBody form', { reason: 'Renovación ficticia para esta demostración' });
    assert.equal([...ctx.d.querySelectorAll('button')].find((b) => b.textContent === 'Solicitud simulada pendiente').disabled, true);
    click(ctx, 'Policía');
    tab(ctx, 'pendientes');
    click(ctx, 'Marcar como revisada');
    assert.match(ctx.d.querySelector('#activePanel').textContent, /Sin pendientes ficticios/);
    tab(ctx, 'casos');
    click(ctx, 'Crear caso ficticio');
    submit(ctx, '#dialogBody form', { title: 'Incidente completamente ficticio', description: 'Descripción inventada sin información personal' });
    tab(ctx, 'multa');
    const caseOption = [...ctx.d.querySelector('[name=caseId]').options].find((o) => o.textContent.includes('Incidente completamente ficticio'));
    submit(ctx, '#activePanel form', { caseId: caseOption.value, reason: 'Descripción ficticia para unir al caso' });
    click(ctx, 'Confirmar multa simulada', ctx.d.querySelector('#dialogBody'));
    tab(ctx, 'casos');
    assert.match(ctx.d.querySelector('#activePanel').textContent, /1 actuación ficticia vinculada/);
    assert.deepEqual(ctx.calls, []);
  } finally { ctx.dom.window.close(); }
});
