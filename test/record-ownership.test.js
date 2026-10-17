const{test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'record-owner-'));process.env.MAESRP_DATA_DIR=dir;require('../lib/config').root=dir;
const store=require('../lib/store');store.init();const{recordBelongsTo,recordMatchesCitizen}=require('../lib/record-access');
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('un dueño explícito nunca se sustituye por el nuevo titular de una cédula reciclada',()=>{
 const old='111111111111111111',next='222222222222222222',citizen={numeroCedula:'RP-1',discordId:next},record={id:'old',documento:'RP-1',userId:old};
 assert.equal(recordBelongsTo(record,next,new Set(['RP-1'])),false);assert.equal(recordMatchesCitizen(record,citizen),false);assert.equal(recordBelongsTo(record,old,new Set()),true);
 assert.equal(recordMatchesCitizen({documento:'RP-1'},citizen),true);assert.equal(recordBelongsTo({documento:'RP-1'},next,new Set(['RP-1'])),true);
 assert.equal(recordBelongsTo({documento:'RP-1',userId:0},next,new Set(['RP-1'])),false);
});
test('la exportación del nuevo titular no incluye multas ni arrestos del titular anterior',()=>{
 const old='111111111111111111',next='222222222222222222';store.write('cedulas',{'RP-1':{numeroCedula:'RP-1',discordId:next,nombre:'Next'}});
 for(const name of ['multas','arrestos'])store.write(name,[{id:'previous-secret',documento:'RP-1',userId:old},{id:'mine',documento:'RP-1',userId:next},{id:'legacy',documento:'RP-1'}]);
 const data=require('../lib/privacy').ownData({id:next,discordId:next});assert.deepEqual(data.fines.map(r=>r.id),['mine','legacy']);assert.deepEqual(data.arrests.map(r=>r.id),['mine','legacy']);assert.ok(!JSON.stringify(data).includes('previous-secret'));
});
test('BASE_URL se normaliza y autenticación remota requiere HTTPS',()=>{
 const source=path.resolve(__dirname,'..');
 function config(baseUrl){const result=spawnSync(process.execPath,['-e',`const c=require('./lib/config');console.log(JSON.stringify({url:c.baseUrl,secure:c.secureAuthentication}));`],{cwd:source,env:{...process.env,BASE_URL:baseUrl},encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout.trim());}
 assert.deepEqual(config('HTTPS://EXAMPLE.COM:443/'),{url:'https://example.com',secure:true});assert.equal(config('http://192.168.1.10:3000').secure,false);assert.equal(config('http://localhost:3000').secure,true);assert.equal(config('http://[::1]:3000').secure,true);
});
test('la identidad PDF queda ligada al dueño y contenido, incluso con un generador antiguo aún en curso',()=>{
 const{identityFilename}=require('../lib/identity-document');const before={numeroCedula:'RP-1',discordId:'111111111111111111',nombre:'Anterior'},after={...before,discordId:'222222222222222222',nombre:'Nuevo'};
 assert.notEqual(identityFilename(before),identityFilename(after));assert.notEqual(identityFilename(after),identityFilename({...after,nombre:'Corregido'}));assert.equal(identityFilename(after),identityFilename({...after}));
 const oldFile=path.join(dir,'public/pdfs',identityFilename(before));store.write('cedulas',{'RP-1':before});fs.writeFileSync(oldFile,'old cache');store.write('cedulas',{'RP-1':after});assert.equal(fs.existsSync(oldFile),false);
 fs.writeFileSync(oldFile,'late old generation');assert.notEqual(path.basename(oldFile),identityFilename(store.read('cedulas')['RP-1']));
});
