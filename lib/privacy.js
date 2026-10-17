const crypto=require('node:crypto');
const store=require('./store');
const {recordBelongsTo}=require('./record-access');
const VERSION='3.11.0';
function legalInfo(){
 const owner=String(process.env.LEGAL_OWNER_NAME||'').trim(),email=String(process.env.LEGAL_CONTACT_EMAIL||'').trim(),jurisdiction=String(process.env.LEGAL_JURISDICTION||'').trim();
 return{version:VERSION,owner,email,jurisdiction,identificationComplete:!!(owner&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&jurisdiction)};
}
function ownData(user){
 const id=user.discordId||user.id;
 const citizens=Object.values(store.read('cedulas')||{}).filter(c=>c.discordId===id);
 const documents=new Set(citizens.map(c=>c.numeroCedula));
 const pick=(record,keys)=>Object.fromEntries(keys.filter(k=>record?.[k]!==undefined).map(k=>[k,record[k]]));
 const recordKeys=['id','documento','ciudadano','userId','oficialNombre','articulos','fecha','createdAt','estado','monto','placa','tiempo','paymentRequested','payment'];
 const records=key=>(store.read(key)||[]).filter(r=>recordBelongsTo(r,id,documents)).map(r=>pick(r,recordKeys));
 const tickets=Object.values(store.read('tickets')?.items||{}).filter(t=>t.userId===id).map(t=>pick(t,['id','topic','status','createdAt','closedAt','claimedBy']));
 return{generatedAt:new Date().toISOString(),policyVersion:VERSION,scope:'Copia automática de los registros vinculados a tu cuenta. Para otras fuentes o mensajes compartidos solicita revisión humana.',account:pick(user,['id','discordId','discordUsername','nombreCompleto']),identity:citizens,vehicles:store.read('vehiculos')?.[id]||[],licenses:store.read('licencias')?.[id]||[],fines:records('multas'),arrests:records('arrestos'),sanctions:store.read('sanciones')?.[id]||null,warnings:store.read('advertencias')?.[id]||null,staffRecord:store.read('infostaff')?.[id]||null,activity:store.read('horasactividad')?.[id]||null,tickets,requests:(store.read('privacyRequests')||[]).filter(r=>r.userId===id),profileCorrections:(store.read('profileCorrections')||[]).filter(r=>r.userId===id).map(r=>pick(r,['id','citizenNumber','changes','previous','reason','status','createdAt','reviewedAt','note'])),notificationReadState:require('./citizen-notifications').notificationReadState(user)};
}
function createRequest(user,body){
 const id=user.discordId||user.id,type=body?.type,details=typeof body?.details==='string'?body.details.trim():'';
 if(!['access','rectification','deletion','objection','withdrawal'].includes(type)||details.length>2000)throw Object.assign(Error('Selecciona un tipo de solicitud válido y usa hasta 2000 caracteres.'),{status:400});
 return store.update('privacyRequests',all=>{
  if(all.filter(r=>r.userId===id&&['pending','in-review'].includes(r.status)).length>=3)throw Object.assign(Error('Ya tienes tres solicitudes pendientes de revisión.'),{status:429});
  const request={id:crypto.randomUUID(),userId:id,type,details,status:'pending',createdAt:new Date().toISOString(),policyVersion:VERSION};all.push(request);return request;
 });
}
function mountPrivacy(app,{auth,wrap}){
 app.get('/api/legal',(req,res)=>res.json(legalInfo()));
 app.get('/api/privacy/export',auth,(req,res)=>res.set({'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="mis-datos-maesrp.json"'}).json(ownData(req.user)));
 app.get('/api/privacy/requests',auth,(req,res)=>res.json({items:(store.read('privacyRequests')||[]).filter(r=>r.userId===(req.user.discordId||req.user.id))}));
 app.post('/api/privacy/requests',auth,wrap(async(req,res)=>res.status(201).json({success:true,request:createRequest(req.user,req.body)})));
 const admin=(req,res,next)=>req.user.isAdmin?next():res.status(403).json({success:false,message:'Acceso administrativo requerido.'});
 app.get('/api/admin/privacy/requests',auth,admin,(req,res)=>res.json({items:store.read('privacyRequests')||[]}));
 app.patch('/api/admin/privacy/requests/:id',auth,admin,wrap(async(req,res)=>{
  const status=req.body?.status,note=typeof req.body?.note==='string'?req.body.note.trim():'';
  if(!['pending','in-review','resolved','denied'].includes(status)||!note||note.length>2000)throw Object.assign(Error('Estado válido y respuesta motivada de hasta 2000 caracteres requeridos.'),{status:400});
  const request=store.update('privacyRequests',all=>{const r=all.find(r=>r.id===req.params.id);if(!r)throw Object.assign(Error('Solicitud no encontrada.'),{status:404});r.status=status;r.response=note;r.reviewedAt=new Date().toISOString();r.reviewedBy=req.user.discordId||req.user.id;return r;});
  res.json({success:true,request});
 }));
}
module.exports={legalInfo,ownData,createRequest,mountPrivacy};
