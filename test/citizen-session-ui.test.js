const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),tick=()=>new Promise(resolve=>setImmediate(resolve));
const me={id:'111111111111111111',discordId:'111111111111111111',discordUsername:'Original',mode:'discord'},citizen={nombre:'Nombre privado',numeroCedula:'RP-1',multas:[],arrestos:[]};
function response(data,status=200){return{ok:status<400,status,json:async()=>data};}
function sandbox(fetch){const d=new JSDOM(fs.readFileSync(path.join(root,'public/citizen.html'),'utf8'),{url:'http://localhost:3000/ciudadano',runScripts:'outside-only'});d.window.fetch=fetch;d.window.eval(fs.readFileSync(path.join(root,'public/js/citizen.js'),'utf8'));return d;}
test('cerrar sesión invalida una actualización pendiente y no restaura la cuenta anterior',async()=>{
 let resolveAccount,hold=false;const d=sandbox(async url=>{
  if(url==='/api/auth/me')return hold?new Promise(resolve=>{resolveAccount=resolve;}):response({user:me});
  if(url==='/api/profile')return response({citizen});
  if(url==='/api/profile/sanctions')return response({sanctions:[]});
  if(url==='/api/tickets?scope=mine')return response({items:[]});
  if(url==='/api/auth/logout')return response({success:true});throw Error(url);
 });try{
  await tick();assert.equal(d.window.CitizenApp.state.demo,false);hold=true;
  const pending=d.window.CitizenApp.refresh();await tick();d.window.document.querySelector('#citizenLogout').click();await tick();
  assert.equal(d.window.CitizenApp.state.demo,true);assert.equal(d.window.CitizenApp.me,null);
  resolveAccount(response({user:me}));await pending;await tick();assert.equal(d.window.CitizenApp.state.demo,true);assert.ok(!d.window.document.querySelector('#profile').textContent.includes('Nombre privado'));assert.equal(d.window.document.querySelector('#citizenLogout').hidden,true);
 }finally{d.window.close();}
});
test('un 401 al consultar perfil borra la sesión y los datos de la cuenta en pantalla',async()=>{
 let expired=false;const d=sandbox(async url=>url==='/api/auth/me'?response({user:me}):url==='/api/profile'?expired?response({message:'Inicia sesión'},401):response({citizen}):url==='/api/profile/sanctions'?response({sanctions:[]}):response({items:[]}));
 try{await tick();assert.equal(d.window.CitizenApp.state.demo,false);expired=true;await d.window.CitizenApp.refresh();assert.equal(d.window.CitizenApp.state.demo,true);assert.equal(d.window.CitizenApp.me,null);assert.ok(!d.window.document.querySelector('#profile').textContent.includes('Nombre privado'));}finally{d.window.close();}
});
test('fallar perfil tras cambiar de cuenta no conserva el personaje anterior',async()=>{
 let changed=false;const second={...me,id:'222222222222222222',discordId:'222222222222222222',discordUsername:'Segunda'};
 const d=sandbox(async url=>url==='/api/auth/me'?response({user:changed?second:me}):url==='/api/profile'?changed?response({message:'Servicio no disponible'},503):response({citizen}):url==='/api/profile/sanctions'?response({sanctions:[]}):response({items:[]}));
 try{await tick();changed=true;await assert.rejects(d.window.CitizenApp.refresh());assert.equal(d.window.CitizenApp.citizen,null);assert.equal(d.window.CitizenApp.me.id,second.id);assert.ok(!d.window.document.querySelector('#profile').textContent.includes('Nombre privado'));}finally{d.window.close();}
});
