'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public/js/portfolio.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const key = 'infinitedev.order-draft.v1';
function page(options = {}) {
 const dom = new JSDOM(html, { url: 'http://localhost:3000', runScripts: 'outside-only', pretendToBeVisual: true });
 const w = dom.window;
 w.matchMedia = () => ({ matches: options.reduced !== false });
 w.HTMLElement.prototype.scrollIntoView = function () {};
 w.scrollTo = () => {};
 options.prepare?.(w);
 w.eval(source);
 return dom;
}
function input(w, id, value) { const el = w.document.getElementById(id); el.value = value; el.dispatchEvent(new w.Event('input')); }
function summary(w, description = 'Un panel para mi comunidad') {
 w.document.querySelector('[data-service-start="web"]').click(); input(w, 'input-project-description', description);
 w.document.querySelector('#wizard-btn-next').click(); w.document.querySelector('#wizard-btn-next').click();
}
test('ningún salto al resumen ni acción final evita los requisitos del servicio', () => {
 const d = page(), w = d.window, doc = w.document;
 doc.querySelector('[data-service-start="web"]').click();
 doc.querySelector('#wizard-stepper-list li:last-child button').click();
 assert.equal(doc.querySelector('#wizard-panel-summary').classList.contains('hidden'), true);
 assert.equal(doc.activeElement.id, 'input-project-description');
 assert.equal(doc.querySelector('#wizard-btn-discord-final').dispatchEvent(new w.MouseEvent('click', { cancelable: true })), false);
 input(w, 'input-project-description', 'Descripción válida');
 doc.querySelector('#wizard-stepper-list li:last-child button').click();
 assert.equal(doc.querySelector('#wizard-panel-summary').classList.contains('hidden'), false);
 doc.querySelector('[data-service-start="bots"]').click();
 doc.querySelector('#wizard-stepper-list li:nth-child(3) button').click();
 doc.querySelectorAll('#bot-features-grid button[aria-pressed="true"]').forEach(button => button.click());
 doc.querySelector('#wizard-stepper-list li:last-child button').click();
 assert.equal(doc.querySelector('#wizard-panel-summary').classList.contains('hidden'), true);
 assert.match(doc.querySelector('#wizard-feedback').textContent, /al menos una función/); w.close();
});
test('fallar clipboard y execCommand nunca anuncia que el resumen se copió', async () => {
 const d = page({ prepare(w) { Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } }); w.document.execCommand = () => false; } });
 const w = d.window; summary(w); w.document.querySelector('#btn-copy-summary').click(); await new Promise(resolve => setImmediate(resolve));
 assert.match(w.document.querySelector('#wizard-feedback-text').textContent, /No se pudo copiar/);
 assert.ok(w.document.querySelector('#copy-toast-badge').classList.contains('hidden'));
 assert.equal(w.document.querySelector('#copy-summary-label').textContent, 'Copiar resumen para Discord');
 assert.equal(w.document.querySelector('#btn-copy-summary').disabled, false); w.close();
});
test('descargar prepara un archivo local y revoca la URL sin enviar solicitudes', () => {
 let blob, filename, revoked;
 const d = page({ prepare(w) { w.URL.createObjectURL = value => { blob = value; return 'blob:pedido'; }; w.URL.revokeObjectURL = value => { revoked = value; }; w.HTMLAnchorElement.prototype.click = function () { filename = this.download; }; } });
 const w = d.window; summary(w); let timer; const original = w.setTimeout; w.setTimeout = fn => { timer = fn; return 1; };
 w.document.querySelector('#btn-download-summary').click();
 assert.equal(blob.type, 'text/plain;charset=utf-8'); assert.equal(filename, 'solicitud-infinitedev.txt'); timer(); assert.equal(revoked, 'blob:pedido');
 assert.match(w.document.querySelector('#wizard-feedback-text').textContent, /todavía no se ha enviado/); w.setTimeout = original; w.close();
});
test('borrador solo se guarda por acción explícita, restaura sin enviar y se elimina', () => {
 const d = page(), w = d.window, doc = w.document;
 summary(w); input(w, 'input-extra-details', 'Mis notas'); assert.equal(w.localStorage.length, 0);
 doc.querySelector('#draft-save').click(); const saved = JSON.parse(w.localStorage.getItem(key));
 assert.equal(saved.expiresAt - saved.savedAt, 7 * 86400000); assert.equal(saved.state.projectDescriptionByService.web, 'Un panel para mi comunidad');
 input(w, 'input-project-description', 'Cambio sin guardar');
 assert.equal(JSON.parse(w.localStorage.getItem(key)).state.projectDescriptionByService.web, 'Un panel para mi comunidad');
 doc.querySelector('#draft-restore').click(); assert.match(doc.querySelector('#summary-text-preview').textContent, /Un panel para mi comunidad/);
 doc.querySelector('#draft-delete').click(); assert.equal(w.localStorage.getItem(key), null); assert.equal(doc.querySelector('#draft-restore').disabled, true); w.close();
});
test('borrador expirado o inválido se elimina, nunca bloquea la página', () => {
 for (const value of ['{broken', JSON.stringify({ version: 1, savedAt: 1, expiresAt: 2, state: {} }), JSON.stringify({ version: 1, savedAt: Date.now(), expiresAt: Date.now() + 1000, state: { service: '__proto__', botCategory: 'rol' } })]) {
  const d = page({ prepare(w) { w.localStorage.setItem(key, value); } }); assert.equal(d.window.localStorage.getItem(key), null); assert.equal(d.window.document.querySelectorAll('[inert]').length, 0); d.window.close();
 }
 const d = page({ prepare(w) { Object.defineProperty(w, 'localStorage', { get() { throw new Error('disabled'); } }); } });
 assert.match(d.window.document.querySelector('#draft-status').textContent, /no está disponible/); d.window.close();
});
test('un borrador disponible espera restauración voluntaria y escapa el texto', () => {
 let stored; const first = page(); summary(first.window, '<img src=x onerror=alert(1)>'); first.window.document.querySelector('#draft-save').click(); stored = first.window.localStorage.getItem(key); first.window.close();
 const d = page({ prepare(w) { w.localStorage.setItem(key, stored); } }), w = d.window;
 assert.match(w.document.querySelector('#wizard-service-badge').textContent, /Bots/);
 assert.equal(w.document.querySelector('#input-project-description').value, '');
 w.document.querySelector('#draft-restore').click();
 assert.equal(w.document.querySelector('#summary-dl-list img'), null); assert.match(w.document.querySelector('#summary-text-preview').textContent, /<img/); w.close();
});
test('casos conservan referencias sin inventar resultados y preparan el pedido', () => {
 const d = page(), w = d.window, doc = w.document;
 assert.equal(doc.querySelectorAll('.portfolio-case').length, 4);
 assert.equal([...doc.querySelectorAll('.portfolio-case')].filter(el => /pendientes de completar/.test(el.textContent)).length, 3);
 doc.querySelector('[data-case-start="Maes RP"]').click();
 assert.match(doc.querySelector('#wizard-service-badge').textContent, /Sistemas Personalizados/);
 input(w, 'input-project-description', 'Mi proyecto'); doc.querySelector('#wizard-btn-next').click();
 assert.equal(doc.querySelector('#input-community-name').value, 'Proyecto inspirado en Maes RP');
 assert.ok(doc.querySelector('.portfolio-case a[href="/demo/maes"]')); w.close();
});
test('sin JavaScript el documento no contiene bloqueos y ofrece contacto accesible', () => {
 const d = new JSDOM(html); assert.equal(d.window.document.querySelectorAll('[inert]').length, 0);
 assert.equal(d.window.document.body.classList.contains('intro-locked'), false);
 assert.match(html, /<noscript>/); assert.equal(d.window.document.querySelector('#intro-skip').hidden, true); d.window.close();
});
test('Omitir libera la presentación sin esperar fuentes y restaura foco', () => {
 const d = page({ reduced: false, prepare(w) { w.requestAnimationFrame = () => 1; w.cancelAnimationFrame = () => {}; } }), w = d.window;
 assert.equal(w.document.querySelector('#intro-skip').hidden, false); w.document.querySelector('#intro-skip').click();
 assert.equal(w.document.querySelectorAll('[inert]').length, 0); assert.equal(w.document.querySelector('#intro-stage').style.display, 'none');
 assert.equal(w.document.activeElement, w.document.querySelector('header a')); assert.equal(w.document.querySelector('#intro-skip').hidden, true); w.close();
});
test('fuentes bloqueadas tienen plazo máximo y no impiden iniciar la secuencia', async () => {
 let deadline, scheduled = 0;
 const d = page({ reduced: false, prepare(w) {
  Object.defineProperty(w.document, 'fonts', { value: { load: () => new Promise(() => {}) } });
  w.setTimeout = (fn, delay) => { if (delay === 1200) deadline = fn; return 1; }; w.clearTimeout = () => {};
  w.requestAnimationFrame = () => { scheduled++; return 1; }; w.cancelAnimationFrame = () => {};
 } });
 assert.equal(scheduled, 0); assert.equal(typeof deadline, 'function'); deadline(); await new Promise(resolve => setImmediate(resolve));
 assert.equal(scheduled, 1); d.window.document.querySelector('#intro-skip').click(); d.window.close();
});
test('metal y aura se pausan fuera de pantalla y vuelven al regresar', () => {
 let observer, callback, scheduled = 0, now = 0;
 const d = page({ reduced: false, prepare(w) {
  w.Date.now = () => now; w.requestAnimationFrame = fn => { callback = fn; return ++scheduled; }; w.cancelAnimationFrame = () => {};
  w.IntersectionObserver = class { constructor(cb) { observer = cb; } observe() {} disconnect() {} };
 } }), w = d.window;
 now = 10000; callback(); const initial = scheduled;
 observer([{ isIntersecting: false }]); assert.equal(scheduled, initial);
 assert.equal(w.document.querySelector('.aura-layer-deep').style.animationPlayState, 'paused');
 const before = w.document.documentElement.style.cssText; now = 12000; callback(); assert.equal(w.document.documentElement.style.cssText, before); assert.equal(scheduled, initial);
 observer([{ isIntersecting: true }]); assert.equal(scheduled, initial + 1); assert.equal(w.document.querySelector('.aura-layer-deep').style.animationPlayState, 'running'); w.close();
});
