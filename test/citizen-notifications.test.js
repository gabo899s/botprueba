const {test,after} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {DatabaseSync} = require('node:sqlite');
const directory = fs.mkdtempSync(path.join(os.tmpdir(),'maes-notifications-'));
process.env.MAESRP_DATA_DIR = directory;
const store = require('../lib/store');
const notifications = require('../lib/citizen-notifications');
store.init();
after(() => { fs.rmSync(directory,{recursive:true,force:true}); });
const me = {id:'123456789012345678',discordId:'123456789012345678'}, other={id:'223456789012345678'};
const now = new Date().toISOString(), earlier = new Date(Date.now()-86400000).toISOString();
function reset() {
  for(const key of ['multas','arrestos','profileCorrections']) store.write(key,[]);
  for(const key of ['cedulas','licencias','sanciones']) store.write(key,{});
  store.write('tickets',{items:{},stats:{}});
}
test('notificaciones respetan propietario explícito aun al reutilizar cédula y no revelan razones privadas',() => {
  reset();
  store.write('cedulas',{one:{discordId:me.id,numeroCedula:'CR-123'}});
  store.write('multas',[
    {id:'mine',userId:me.id,documento:'CR-123',createdAt:now,articulos:'PRIVATE CONTENT'},
    {id:'other',userId:other.id,documento:'CR-123',createdAt:now},
    {id:'legacy',documento:'CR-123',createdAt:now},
    {id:'old',userId:me.id,createdAt:'2020-01-01T00:00:00.000Z'}
  ]);
  const events = notifications.list(me);
  assert.equal(events.items.length,2); assert.equal(events.unread,2);
  assert.equal(JSON.stringify(events).includes('PRIVATE CONTENT'),false);
  assert.equal(notifications.list(other).items.length,1);
});
test('pago solo notifica confirmación real, apelaciones y soporte usan sus fechas y estados reales',() => {
  reset();
  store.write('multas',[
    {id:'pending',userId:me.id,createdAt:earlier,paymentRequested:{at:now},estado:'REGISTRADA'},
    {id:'paid',userId:me.id,createdAt:earlier,payment:{at:now},estado:'PAGADA'},
  ]);
  store.write('sanciones',{[me.id]:{sanctions:[{id:'s1',appeal:{id:'a1',status:'aceptada',decidedAt:now}}]},[other.id]:{sanctions:[{id:'s2',appeal:{status:'rechazada',decidedAt:now}}]}});
  store.write('tickets',{items:{one:{id:'one',userId:me.id,createdAt:earlier,claimedBy:other.id,claimedAt:now,status:'cerrado',closedAt:now,lastReplyBy:other.id,lastReplyAt:now},two:{id:'two',userId:other.id,createdAt:now}},stats:{}});
  store.write('profileCorrections',[{id:'c1',userId:me.id,status:'approved',reviewedAt:now},{id:'c2',userId:other.id,status:'rejected',reviewedAt:now}]);
  const events = notifications.list(me).items;
  assert.equal(events.filter(e=>e.kind === 'payment').length,1);
  assert.equal(events.filter(e=>e.kind === 'appeal').length,1);
  assert.equal(events.filter(e=>e.kind.startsWith('ticket.')).length,4);
  assert.equal(events.filter(e=>e.kind === 'profile.correction').length,1);
});
test('licencias solo avisan por vencimientos explícitos, marcadores propios persisten y no duplican contenido',() => {
  reset();
  store.write('licencias',{[me.id]:[{tipo:'B1',estado:'Activa',expiresAt:new Date(Date.now()+86400000).toISOString()},{tipo:'A1',estado:'Activa'},{tipo:'C1',estado:'Inactiva',expiresAt:now}], [other.id]:[{tipo:'D1',expiresAt:now}]});
  let response = notifications.list(me);
  assert.equal(response.items.length,1);
  const id = response.items[0].id;
  assert.throws(()=>notifications.markRead(other,{ids:[id]}),{status:404});
  assert.throws(()=>notifications.markRead(me,{ids:['invalid']}),{status:400});
  response = notifications.markRead(me,{ids:[id]});
  assert.equal(response.unread,0); assert.equal(response.items[0].read,true);
  assert.equal(notifications.notificationReadState(other).length,0);
  assert.equal(notifications.notificationReadState(me).some(row=>row.id === id),true);
  const filename = path.join(directory,'citizen-notifications.sqlite');
  assert.equal(fs.statSync(filename).mode & 0o777,0o600);
  const db = new DatabaseSync(filename);
  assert.deepEqual(db.prepare('PRAGMA table_info(read_markers)').all().map(c=>c.name),['user_id','event_id','read_at']); db.close();
});
test('retención y respuesta tienen límites y marcar todas no marca eventos ajenos',() => {
  reset();
  store.write('arrestos',Array.from({length:650},(_,i)=>({id:'r'+i,userId:me.id,createdAt:now})));
  assert.equal(notifications.list(me).items.length,100);
  assert.equal(notifications.list(me).unread,500);
  assert.equal(notifications.markRead(me,{all:true}).unread,0);
  assert.ok(notifications.notificationReadState(me).length <= 500);
});
test('respuesta pendiente de notificaciones no reaparece al cerrar sesión',async() => {
  const {JSDOM} = require('jsdom');
  const dom = new JSDOM('<div id="notificationBadge"></div><div id="notifications"></div>',{runScripts:'outside-only',pretendToBeVisual:true});
  let resolveRequest;
  dom.window.CitizenApp={api:()=>new Promise(resolve=>{resolveRequest=resolve;}),notice:()=>{},selectPanel:()=>{}};
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../public/js/citizen-notifications.js'),'utf8'));
  dom.window.document.dispatchEvent(new dom.window.CustomEvent('citizen:updated',{detail:{me,demo:false}}));
  assert.equal(typeof resolveRequest,'function');
  dom.window.document.dispatchEvent(new dom.window.CustomEvent('citizen:updated',{detail:{me:null,demo:true}}));
  resolveRequest({unread:1,items:[{id:'x',title:'Private old session',text:'private',at:now,read:false,panel:'fines'}]});
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(dom.window.document.querySelector('#notifications').textContent.includes('Private old session'),false);
  assert.match(dom.window.document.querySelector('#notifications').textContent,/Inicia sesión/);
  assert.equal(dom.window.document.querySelector('#notificationBadge').hidden,true);
  dom.window.close();
});
