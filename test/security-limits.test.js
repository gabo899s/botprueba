const{test,after}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os');
const temporary=fs.mkdtempSync(os.tmpdir()+'/maes-security-limits-');process.env.MAESRP_DATA_DIR=temporary;require('../lib/config').root=temporary;after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
const{limiter,verifyPassword}=require('../lib/security');
test('límites reinician al vencer la ventana y no admiten claves ilimitadas',()=>{let now=0;const hit=limiter({limit:2,windowMs:1000,maxKeys:2,now:()=>now});assert.ok(hit('a'));assert.ok(hit('a'));assert.equal(hit('a'),false);assert.ok(hit('b'));assert.equal(hit('c'),false);now=1001;assert.ok(hit('c'));assert.ok(hit('a'));});
test('contraseña asíncrona valida el hash, rechaza errores y limita trabajo concurrente',async()=>{const hash='fixture-salt:'+crypto.scryptSync('fixture-password','fixture-salt',64).toString('hex');assert.equal(await verifyPassword('fixture-password',hash),true);assert.equal(await verifyPassword('wrong-password',hash),false);assert.equal(await verifyPassword('fixture-password','malformed'),false);const attempts=await Promise.allSettled(Array.from({length:8},()=>verifyPassword('fixture-password',hash)));assert.equal(attempts.filter(r=>r.status==='fulfilled'&&r.value===true).length,4);assert.equal(attempts.filter(r=>r.status==='rejected'&&r.reason.status===429).length,4);});
test('todos los comandos con scope privado rechazan a un ciudadano antes de ejecutar',async()=>{const{commands}=require('../bot/commands'),runtime=require('../bot/runtime');let checked=0;for(const command of commands.filter(c=>c.scope!=='public')){await assert.rejects(runtime.dispatch({commandName:command.name,guildId:'fixture-guild',user:{id:'111111111111111111',username:'Citizen'},member:{roles:[]}}));checked++;}assert.ok(checked>40);});

test('operaciones PDF tienen cupo acotado y liberan recursos al terminar o desconectar',()=>{
 const {jobGate}=require('../lib/security'),{EventEmitter}=require('node:events'),gate=jobGate({maxConcurrent:2});
 function response(){const r=new EventEmitter();r.status=code=>{r.code=code;return r;};r.set=()=>r;r.json=()=>r;return r;}
 const a=response(),b=response(),c=response(),request={user:{id:'fixture'}};let admitted=0;
 gate(request,a,()=>admitted++);gate(request,b,()=>admitted++);gate(request,c,()=>admitted++);assert.equal(admitted,2);assert.equal(c.code,429);
 a.emit('finish');a.emit('close');gate(request,response(),()=>admitted++);assert.equal(admitted,3);b.emit('close');
});

test('desconectar la respuesta no libera el cupo mientras el trabajo real de PDF sigue activo',async()=>{
 const{jobGate}=require('../lib/security'),{EventEmitter}=require('node:events'),gate=jobGate({maxConcurrent:1});
 function pair(){const req={user:{id:'fixture-disconnect'}},res=new EventEmitter();res.status=code=>{res.code=code;return res;};res.set=()=>res;res.json=()=>res;return{req,res};}
 const first=pair();let admitted=0,finishWork;gate(first.req,first.res,()=>admitted++);
 const running=first.req.runDocumentJob(()=>new Promise(resolve=>{finishWork=resolve;}));first.res.emit('close');
 const blocked=pair();gate(blocked.req,blocked.res,()=>admitted++);assert.equal(blocked.res.code,429);assert.equal(admitted,1);
 finishWork();await running;const next=pair();gate(next.req,next.res,()=>admitted++);assert.equal(admitted,2);next.res.emit('finish');
});
test('el cupo de documentos se libera si falla el trabajo o se corta antes de empezar',async()=>{
 const{jobGate}=require('../lib/security'),{EventEmitter}=require('node:events'),gate=jobGate({maxConcurrent:1});
 function pair(){const req={user:{id:'fixture-error'}},res=new EventEmitter();res.status=code=>{res.code=code;return res;};res.set=()=>res;res.json=()=>res;gate(req,res,()=>{});return{req,res};}
 const aborted=pair();aborted.res.emit('close');await assert.rejects(aborted.req.runDocumentJob(()=>assert.fail('No debe comenzar')),{status:400});
 const failing=pair();await assert.rejects(failing.req.runDocumentJob(async()=>{throw Error('fixture');}),/fixture/);
 const next=pair();assert.equal(next.res.code,undefined);next.res.emit('close');
});
