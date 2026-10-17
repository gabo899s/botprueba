(() => {
  'use strict';
  let owner = null, epoch = 0, pending = false, queued = false;
  const target = () => document.querySelector('#notifications');
  function node(tag,text,className) {
    const result = document.createElement(tag); if(text) result.textContent = text;
    if(className) result.className = className; return result;
  }
  function badge(count) {
    const element = document.querySelector('#notificationBadge'); if(!element) return;
    element.textContent = String(count); element.hidden = !count;
    element.setAttribute('aria-label',`${count} notificaciones sin leer`);
  }
  function empty(text) { if(target()) target().replaceChildren(node('p',text,'empty-state')); badge(0); }
  function render(data) {
    const parent = target(); if(!parent) return;
    badge(data.unread); parent.replaceChildren();
    if(!data.items.length) { parent.append(node('p','No tienes notificaciones recientes.','empty-state')); return; }
    const toolbar = node('div',null,'citizen-toolbar');
    const all = node('button','Marcar todas como leídas'); all.type = 'button'; all.disabled = !data.unread;
    all.addEventListener('click',() => mutate({all:true},all)); toolbar.append(all); parent.append(toolbar);
    for(const item of data.items) {
      const row = node('article',null,'record notification-record' + (item.read ? '' : ' unread'));
      row.append(node('strong',item.title));
      const time = node('time',new Intl.DateTimeFormat('es',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.at)));
      time.dateTime = item.at; row.append(time,node('p',item.text));
      const actions = node('div',null,'citizen-actions');
      const open = node('button','Ver detalle'); open.type = 'button';
      open.addEventListener('click', async () => {
        if(!item.read) await mutate({ids:[item.id]},open);
        window.CitizenApp?.selectPanel(item.panel);
      });
      actions.append(open);
      if(!item.read) {
        const mark = node('button','Marcar como leída'); mark.type = 'button';
        mark.addEventListener('click',() => mutate({ids:[item.id]},mark)); actions.append(mark);
      }
      row.append(actions); parent.append(row);
    }
  }
  async function mutate(body,button) {
    if(!owner || button.disabled) return;
    const current = epoch; button.disabled = true;
    try {
      const data = await window.CitizenApp.api('/api/profile/notifications/read',body);
      if(current === epoch && owner) render(data);
    } catch(error) {
      if(current === epoch) {
        if(error.status === 401) { owner = null; epoch++; empty('Inicia sesión para consultar tus notificaciones.'); }
        else window.CitizenApp?.notice(error.message);
      }
    } finally { button.disabled = false; }
  }
  async function refresh() {
    if(pending || !owner || document.hidden || !window.CitizenApp) return;
    const current = epoch; pending = true;
    try {
      const data = await window.CitizenApp.api('/api/profile/notifications');
      if(current === epoch && owner) render(data);
    } catch(error) {
      if(current === epoch) {
        if(error.status === 401) { owner = null; epoch++; empty('Inicia sesión para consultar tus notificaciones.'); }
        else if(target()) target().replaceChildren(node('p','No se pudieron actualizar las notificaciones. Se volverá a intentar.','empty-state'));
      }
    } finally { pending = false; if(queued) { queued = false; refresh(); } }
  }
  document.addEventListener('citizen:updated',event => {
    const {me,demo} = event.detail || {};
    const next = !demo && me ? String(me.discordId || me.id || '') : null;
    epoch++;
    if(next !== owner) empty(next ? 'Cargando notificaciones…' : 'Inicia sesión para consultar tus notificaciones.');
    owner = next;
    // A queued refresh runs after any previous request finishes, never in parallel.
    if(pending) queued = true; else refresh();
  });
  document.addEventListener('visibilitychange',() => { if(!document.hidden) refresh(); });
  window.setInterval(refresh,60000);
})();
