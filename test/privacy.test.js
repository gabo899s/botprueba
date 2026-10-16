const{test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'maes-privacy-'));process.env.MAESRP_DATA_DIR=temporary;require('../lib/config').root=temporary;
const store=require('../lib/store');store.init();const privacy=require('../lib/privacy'),me={id:'111111111111111111',discordId:'111111111111111111',discordUsername:'Persona',oauth:{accessToken:'never-export'}};after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
test('copia de datos restringida a la cuenta, sin configuración o tokens',()=>{
 store.write('cedulas',{A:{numeroCedula:'A',discordId:me.id,nombre:'Propio'},B:{numeroCedula:'B',discordId:'222222222222222222',nombre:'Ajeno'}});store.write('multas',[{id:'fine-a',userId:me.id,documento:'A',monto:20},{id:'fine-b',userId:'222222222222222222',documento:'B',monto:30}]);store.write('settings',{secret:'internal-secret'});
 const exported=privacy.ownData(me),serialized=JSON.stringify(exported);assert.equal(exported.identity.length,1);assert.equal(exported.fines.length,1);assert.ok(!serialized.includes('Ajeno'));assert.ok(!serialized.includes('fine-b'));assert.ok(!serialized.includes('never-export'));assert.ok(!serialized.includes('internal-secret'));
});
test('información del responsable pendiente no afirma cumplimiento ni inventa identidad',()=>{
 const old=Object.fromEntries(['LEGAL_OWNER_NAME','LEGAL_CONTACT_EMAIL','LEGAL_JURISDICTION'].map(key=>[key,process.env[key]]));
 try{for(const key of Object.keys(old))delete process.env[key];assert.equal(privacy.legalInfo().identificationComplete,false);process.env.LEGAL_OWNER_NAME='Responsable de prueba';process.env.LEGAL_CONTACT_EMAIL='privacy@example.test';process.env.LEGAL_JURISDICTION='País de prueba';assert.equal(privacy.legalInfo().identificationComplete,true);assert.equal(Object.hasOwn(privacy.legalInfo(),'compliant'),false);}finally{for(const[key,value]of Object.entries(old))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
test('solicitud de eliminación se registra para revisión, no borra ni concede derechos a otro usuario',()=>{
 const request=privacy.createRequest(me,{type:'deletion',details:'Revisar mis datos'});assert.equal(request.userId,me.id);assert.equal(request.status,'pending');assert.equal(store.read('cedulas').A.nombre,'Propio');assert.throws(()=>privacy.createRequest(me,{type:'admin',details:''}),{status:400});
});
test('API exige sesión, separa solicitudes por usuario y restringe revisión a administración',async()=>{
 const app=require('express')();app.use(require('express').json());const auth=(req,res,next)=>{if(!req.headers['x-user'])return res.status(401).json({message:'Inicia sesión.'});req.user={id:req.headers['x-user'],discordId:req.headers['x-user'],isAdmin:req.headers['x-admin']==='yes'};next();},wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
 privacy.mountPrivacy(app,{auth,wrap});app.use((error,req,res,next)=>res.status(error.status||500).json({message:error.message}));const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(base+'/api/privacy/export')).status,401);const request=store.read('privacyRequests')[0];assert.equal((await fetch(base+'/api/admin/privacy/requests')).status,401);assert.equal((await fetch(base+'/api/admin/privacy/requests',{headers:{'x-user':me.id}})).status,403);const other=await(await fetch(base+'/api/privacy/requests',{headers:{'x-user':'222222222222222222'}})).json();assert.deepEqual(other.items,[]);
 const update=await fetch(base+'/api/admin/privacy/requests/'+request.id,{method:'PATCH',headers:{'x-user':'admin','x-admin':'yes','Content-Type':'application/json'},body:JSON.stringify({status:'in-review',note:'Se revisarán las fuentes y copias correspondientes.'})});assert.equal(update.status,200);assert.equal(store.read('privacyRequests')[0].status,'in-review');assert.equal(store.read('cedulas').A.nombre,'Propio');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('web legal no carga scripts remotos ni oculta la revisión pendiente',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../public/legal.html'),'utf8');assert.match(html,/Versión preparatoria/);assert.match(html,/no ejecuta un borrado periódico automático/);assert.doesNotMatch(html,/<script[^>]+src=["']https?:/);assert.match(html,/no se impone/i);
});
