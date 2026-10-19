'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/js/citizen-economy.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(api) {
  const dom = new JSDOM('<section id="citizenEconomy"></section>', { runScripts: 'outside-only', url: 'http://localhost' });
  const app = { me: null, api, notice() {}, refresh() {} }; dom.window.CitizenApp = app; dom.window.eval(source);
  const update = me => { app.me = me; dom.window.document.dispatchEvent(new dom.window.CustomEvent('citizen:updated', { detail: { me, citizen: me ? {} : null, demo: !me } })); };
  return { dom, app, update, document: dom.window.document };
}
const response = cash => ({ available: true, balance: { cash, bank: 20, at: new Date().toISOString() }, currency: 'Dinero de rol', operations: { deposit: { reason: 'Pendiente' }, withdraw: { reason: 'Pendiente' }, transfer: { reason: 'Pendiente' } }, fines: [{ id: 'fine-one', amount: 10, pending: false }], history: [], historyNotice: 'Solo multas', balanceNotice: 'Consulta puntual' });
test('UI no muestra saldos de la cuenta anterior cuando llegan respuestas atrasadas o se cierra sesión', async () => {
  const queue = [], f = fixture(() => new Promise(resolve => queue.push(resolve)));
  try {
    f.update({ discordId: 'first' }); f.update({ discordId: 'second' }); queue[0](response(991234)); await tick(); assert.ok(!f.document.body.textContent.includes('991'));
    queue[1](response(42)); await tick(); assert.match(f.document.body.textContent, /42/);
    f.update({ discordId: 'second' }); f.update(null); queue[2](response(991234)); await tick(); assert.match(f.document.body.textContent, /Inicia sesión/); assert.ok(!f.document.body.textContent.includes('991'));
  } finally { f.dom.window.close(); }
});
test('UI exige confirmación explícita y conserva referencia para no generar doble cobro', async () => {
  const writes = [], f = fixture(async (url, body) => { if (body) { writes.push(body); throw Error('Resultado incierto'); } return response(50); });
  try {
    f.update({ discordId: 'first' }); await tick(); assert.equal(writes.length, 0);
    const confirm = [...f.document.querySelectorAll('button')].find(n => /Confirmar pago/.test(n.textContent)); confirm.click(); confirm.click(); await tick();
    assert.equal(writes.length, 1); assert.equal(writes[0].fineId, 'fine-one'); assert.ok(!Object.hasOwn(writes[0], 'amount')); assert.match(writes[0].requestId, /^[a-z0-9-]{16,}$/i); assert.match(f.document.body.textContent, /incierto/); assert.equal(confirm.disabled, true);
  } finally { f.dom.window.close(); }
});
