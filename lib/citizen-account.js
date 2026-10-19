const crypto=require('node:crypto');
const fail=(text,status=400)=>Object.assign(Error(text),{status});
function mountCitizenAccount(app,{auth,wrap,assertSession,sessions,store=require('./store')}){
 const owner=req=>{assertSession(req);const id=req.user?.discordId;if(!id)throw fail('Inicia sesión con Discord.',401);return id;};
 const tag=(sid,id)=>crypto.createHash('sha256').update('account-session:'+id+':'+sid).digest('hex');
 const mine=(s,id)=>s?.user?.discordId===id&&s.expires>Date.now();
 app.get('/api/profile/sessions',auth,wrap((req,res)=>{
  const id=owner(req),items=[];for(const [sid,s]of sessions)if(mine(s,id))items.push({id:tag(sid,id),current:sid===req.sid,browser:s.meta?.browser||'Navegador',createdAt:s.meta?.createdAt||null,lastSeenAt:s.meta?.lastSeenAt||null,expiresAt:new Date(s.expires).toISOString()});
  res.json({success:true,items:items.sort((a,b)=>Number(b.current)-Number(a.current))});
 }));
 app.post('/api/profile/sessions/revoke-others',auth,wrap((req,res)=>{
  const id=owner(req);let count=0;for(const [sid,s]of sessions)if(sid!==req.sid&&mine(s,id)){sessions.delete(sid);count++;}
  store.audit(id,'account.sessions.revoke-others',{count});res.json({success:true,count});
 }));
 app.delete('/api/profile/sessions/:id',auth,wrap((req,res)=>{
  const id=owner(req),token=req.params.id;if(!/^[a-f0-9]{64}$/.test(token||''))throw fail('Sesión no encontrada.',404);
  const match=[...sessions].find(([sid,s])=>mine(s,id)&&tag(sid,id)===token);if(!match)throw fail('Sesión no encontrada.',404);
  if(match[0]===req.sid)throw fail('Usa Salir para cerrar la sesión actual.');sessions.delete(match[0]);store.audit(id,'account.session.revoke',{});res.json({success:true});
 }));
 app.post('/api/profile/roblox/unlink',auth,wrap((req,res)=>{
  const id=owner(req);if(req.body?.confirm!==true)throw fail('Confirma que deseas desvincular Roblox.');
  store.transaction(()=>{const rows=store.read('cedulas'),entries=Object.entries(rows).filter(([,c])=>c.discordId===id);if(entries.length!==1)throw fail('No se encontró un personaje único.',409);
   const [number,c]=entries[0];if(!c.roblox?.userId)throw fail('No hay una cuenta Roblox vinculada.',409);
   rows[number]={...c,roblox:null};store.write('cedulas',rows);store.audit(id,'profile.roblox.unlink',{userId:String(c.roblox.userId)});
  });res.json({success:true,message:'Roblox desvinculado. Tu personaje y expediente se conservaron.'});
 }));
}
module.exports={mountCitizenAccount};
