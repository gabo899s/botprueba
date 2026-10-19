const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const source = path.resolve(__dirname, '..');
const ids = { owner: '111111111111111111', recycled: '222222222222222222', police: '333333333333333333', admin: '444444444444444444', supervisor: '555555555555555555' };
const fineId = 'multa_versioned_fixture';
let directory, child, base, logs = '', cookies, rpcId = 0;
const messages = new Map(), started = [];
function rpc(command) { const request = ++rpcId; return new Promise((resolve, reject) => { const timer = setTimeout(() => { messages.delete(request); reject(Error('IPC timeout')); }, 5000); messages.set(request, value => { clearTimeout(timer); resolve(value); }); child.send({ request, ...command }); }); }
function request(route, { session, method = 'GET', body, requestId } = {}) {
  return fetch(base + route, { method, redirect: 'manual', headers: { 'X-Local-Request': '1', ...(session ? { Cookie: session } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(requestId ? { 'X-Request-ID': requestId } : {}) }, body: body ? JSON.stringify(body) : undefined });
}
const cookie = (response, name) => response.headers.getSetCookie().find(value => value.startsWith(name + '='))?.split(';')[0];
async function login(name) {
  const begin = await request('/auth/discord');
  const state = new URL(begin.headers.get('location')).searchParams.get('state');
  const response = await fetch(base + '/auth/discord/callback?' + new URLSearchParams({ state, code: name }), { redirect: 'manual', headers: { Cookie: cookie(begin, 'oauth_state') } });
  const session = cookie(response, 'session'); assert.ok(session, logs); return session;
}
async function waitStarted(count) { for (let i = 0; i < 200; i++) { if (started.length >= count) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw Error('No inició el PDF: ' + logs); }
before(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maes-police-integration-'));
  require('./helpers/application-sandbox').copyApplication(source, directory);
  const bootstrap = `
    const fs=require('node:fs'),ids=${JSON.stringify(ids)},fineId=${JSON.stringify(fineId)};
    global.fetch=async(url,options={})=>({ok:true,status:200,json:async()=>{
      if(url.endsWith('/oauth2/token'))return{access_token:options.body.get('code')};
      const who=options.headers?.Authorization?.slice(7);
      if(url.endsWith('/users/@me'))return{id:ids[who],username:who,global_name:who};
      return{roles:who==='supervisor'?['fixture-police','fixture-admin']:who==='police'?['fixture-police']:who==='admin'?['fixture-admin']:[]};
    }});
    const store=require('./lib/store');store.init();
    store.write('cedulas',{C1:{numeroCedula:'C1',discordId:ids.recycled,nombre:'Nuevo',apellidos:'Titular'},C2:{numeroCedula:'C2',discordId:ids.owner,nombre:'Anterior',apellidos:'Titular'}});
    const original={id:fineId,userId:ids.owner,documento:'C1',ciudadano:'Anterior Titular',oficialId:ids.supervisor,oficialNombre:'Supervisor',estado:'REGISTRADA',monto:50,articulos:'Art. 1',createdAt:'2026-10-01T12:00:00Z',revision:2,pdfFileName:'fixture_current.pdf',pdfUrl:'/pdfs/fixture_current.pdf',originalPdfFileName:'fixture_original.pdf'};
    store.write('multas',[original]);
    store.write('policeRevisions',[
      {id:'first',type:'multa',recordId:fineId,number:1,pdfFileName:'fixture_middle.pdf',previous:{...original,pdfFileName:'fixture_original.pdf',userId:ids.recycled},snapshot:{...original,userId:ids.recycled}},
      {id:'second',type:'multa',recordId:fineId,number:2,pdfFileName:'fixture_current.pdf',previous:{...original,pdfFileName:'fixture_middle.pdf'}},
      {id:'orphan',type:'multa',recordId:'missing-record',pdfFileName:'fixture_orphan.pdf',previous:{userId:ids.owner,pdfFileName:'fixture_orphan_previous.pdf'}}
    ]);
    for(const file of ['fixture_original.pdf','fixture_middle.pdf','fixture_current.pdf','fixture_orphan.pdf','fixture_orphan_previous.pdf'])fs.writeFileSync('public/pdfs/'+file,'%PDF-fixture '+file);
    const waiting=[];
    require('./lib/pdf').generate=async(type,record)=>{
      const filename=record.id+'.pdf';fs.writeFileSync('public/pdfs/'+filename,'%PDF-generated '+filename);
      if(record.articulos.includes('DELAY')){process.send({started:record.id});await new Promise(resolve=>waiting.push(resolve));}
      return filename;
    };
    process.on('message',message=>{
      if(message.owner)store.update('multas',rows=>{rows.find(row=>row.id===fineId).userId=message.owner;});
      if(message.paymentState)store.update('multas',rows=>{rows.find(row=>row.id===fineId).paymentAttempt={id:'fixture-attempt',status:message.paymentState,amount:50};});
      if(message.clearPayment)store.update('multas',rows=>{delete rows.find(row=>row.id===fineId).paymentAttempt;});
      if(message.release)for(const resolve of waiting.splice(0))resolve();
      process.send({request:message.request,done:true});
    });
    const app=require('./server');const server=app.listen(0,'127.0.0.1',()=>console.log('POLICE_INTEGRATION_PORT='+server.address().port));
  `;
  child = spawn(process.execPath, ['-e', bootstrap], { cwd: directory, env: { ...process.env, NODE_PATH: path.join(source, 'node_modules'), MAESRP_DATA_DIR: path.join(directory, 'bot/data'), BASE_URL: 'http://localhost:3000', JWT_SECRET: 'fixture-police-integration-secret-no-production-values', DISCORD_TOKEN: '', DISCORD_CLIENT_ID: 'fixture', DISCORD_CLIENT_SECRET: 'fixture', DISCORD_GUILD_ID: 'fixture', ADMIN_ROLE_IDS: 'fixture-admin', POLICE_ROLE_IDS: 'fixture-police' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  child.stdout.on('data', data => { logs += data; }); child.stderr.on('data', data => { logs += data; });
  child.on('message', message => { if (message.started) started.push(message.started); if (message.request) { messages.get(message.request)?.(message); messages.delete(message.request); } });
  for (let i = 0; i < 200; i++) { const match = logs.match(/POLICE_INTEGRATION_PORT=(\d+)/); if (match) { base = 'http://localhost:' + match[1]; break; } await new Promise(resolve => setTimeout(resolve, 25)); }
  assert.ok(base, logs);
  cookies = Object.fromEntries(await Promise.all(Object.keys(ids).map(async name => [name, await login(name)])));
});
after(async () => { if (child?.exitCode === null) { child.kill(); await once(child, 'exit'); } if (directory) fs.rmSync(directory, { recursive: true, force: true }); });

test('integración conserva separación policial/administrativa en todos los workflows', async () => {
  for (const route of ['/pending', '/records', '/cases', '/records/multa/' + fineId + '/revisions']) {
    const url = '/api/police/workflows' + route;
    assert.equal((await request(url)).status, 401);
    assert.equal((await request(url, { session: cookies.owner })).status, 403);
    assert.equal((await request(url, { session: cookies.admin })).status, 403);
    assert.equal((await request(url, { session: cookies.police })).status, 200);
  }
  const response = await request('/api/police/workflows/records/multa/' + fineId + '/revisions', { session: cookies.police, method: 'POST', body: { action: 'anular', expectedRevision: 2, reason: 'Anulación motivada de prueba', changes: {} } });
  assert.equal(response.status, 403);
});

test('PDF original, intermedio y actual autorizan según registro canónico, nunca snapshot ni cédula reciclada', async () => {
  for (const filename of ['fixture_original.pdf', 'fixture_middle.pdf', 'fixture_current.pdf']) {
    const route = '/pdfs/' + filename;
    assert.equal((await request(route)).status, 401);
    assert.equal((await request(route, { session: cookies.owner })).status, 200);
    assert.equal((await request(route, { session: cookies.recycled })).status, 403);
    assert.equal((await request(route, { session: cookies.police })).status, 200);
    assert.equal((await request(route, { session: cookies.admin })).status, 403);
  }
  assert.equal((await request('/pdfs/%66ixture_middle.pdf', { session: cookies.recycled })).status, 403);
  for (const filename of ['fixture_orphan.pdf', 'fixture_orphan_previous.pdf']) for (const role of ['owner', 'police', 'supervisor']) assert.equal((await request('/pdfs/' + filename, { session: cookies[role] })).status, 403);
});

test('un cambio explícito del propietario canónico se aplica también a todas las versiones históricas', async () => {
  try {
    await rpc({ owner: ids.recycled });
    for (const filename of ['fixture_original.pdf', 'fixture_middle.pdf', 'fixture_current.pdf']) {
      assert.equal((await request('/pdfs/' + filename, { session: cookies.owner })).status, 403);
      assert.equal((await request('/pdfs/' + filename, { session: cookies.recycled })).status, 200);
    }
  } finally { await rpc({ owner: ids.owner }); }
});

test('integración bloquea rectificación y anulación mientras un cobro siga incierto', async () => {
  try {
    for (const paymentState of ['en-proceso', 'no-confirmado']) {
      await rpc({ paymentState });
      for (const action of ['rectificar', 'anular']) {
        const response = await request('/api/police/workflows/records/multa/' + fineId + '/revisions', { session: cookies.supervisor, method: 'POST', body: { action, expectedRevision: 2, reason: 'Revisión motivada para la prueba', changes: action === 'anular' ? {} : { monto: 20 } } });
        assert.equal(response.status, 409); assert.match((await response.json()).message, /cobro en proceso o incierto/);
      }
    }
  } finally { await rpc({ clearPayment: true }); }
});

test('emisión web usa reglas compartidas y no reutiliza un request-id para datos distintos', async () => {
  const options = { session: cookies.police, method: 'POST', requestId: 'integration-identical-request', body: { documento: 'C2', articulos: 'Art. 1', valor: 70, userId: ids.recycled } };
  const first = await request('/api/multa', options); assert.equal(first.status, 200, await first.clone().text());
  const original = (await first.json()).record;
  assert.equal(original.userId, ids.owner); assert.ok(original.vence);
  const repeated = await request('/api/multa', options); assert.equal(repeated.status, 200); assert.equal((await repeated.json()).record.id, original.id);
  const changed = await request('/api/multa', { ...options, body: { ...options.body, valor: 71 } }); assert.equal(changed.status, 409);
});

test('cerrar sesión durante PDF evita publicar registro y elimina documento huérfano', async () => {
  const session = await login('police'), count = started.length;
  const pending = request('/api/multa', { session, method: 'POST', requestId: 'integration-pdf-after-logout', body: { documento: 'C2', articulos: 'DELAY fixture de revalidación', valor: 20 } });
  await waitStarted(count + 1);
  try { assert.equal((await request('/api/auth/logout', { session, method: 'POST', body: {} })).status, 200); }
  finally { await rpc({ release: true }); }
  const response = await pending; assert.equal(response.status, 401);
  const filename = started[count] + '.pdf';
  assert.equal(fs.existsSync(path.join(directory, 'public/pdfs', filename)), false);
  const records = await (await request('/api/records', { session: cookies.supervisor })).json();
  assert.equal(records.multas.some(item => item.id === started[count]), false);
});

test('rectificación real conserva PDFs y anular una multa pagada no borra la confirmación', async () => {
  const route = '/api/police/workflows/records/multa/' + fineId + '/revisions';
  const change = { action: 'rectificar', expectedRevision: 2, reason: 'Corrección verificada del importe original', changes: { monto: 65 } };
  const response = await request(route, { session: cookies.supervisor, method: 'POST', body: change });
  assert.equal(response.status, 200, await response.clone().text());
  const revised = (await response.json()).record;
  assert.equal(revised.revision, 3); assert.equal(revised.monto, 65);
  assert.equal(revised.originalPdfFileName, 'fixture_original.pdf');
  assert.equal((await request(revised.pdfUrl, { session: cookies.owner })).status, 200);
  assert.equal((await request(revised.pdfUrl, { session: cookies.recycled })).status, 403);
  const payment = '/api/police/payments/' + fineId + '/confirm';
  assert.equal((await request(payment, { session: cookies.supervisor, method: 'POST', body: { reference: 'provider-verified-original-reference' } })).status, 200);
  assert.equal((await request(payment, { session: cookies.supervisor, method: 'POST', body: { reference: 'must-not-overwrite' } })).status, 409);
  assert.equal((await request(route, { session: cookies.supervisor, method: 'POST', body: { ...change, expectedRevision: 3 } })).status, 409);
  const cancellation = await request(route, { session: cookies.supervisor, method: 'POST', body: { action: 'anular', expectedRevision: 3, reason: 'Anulación histórica documentada posterior al pago', changes: {} } });
  assert.equal(cancellation.status, 200, await cancellation.clone().text());
  const cancelled = (await cancellation.json()).record;
  assert.equal(cancelled.estado, 'ANULADA'); assert.equal(cancelled.payment.reference, 'provider-verified-original-reference');
  assert.equal((await request(revised.pdfUrl, { session: cookies.owner })).status, 200);
  assert.equal((await request('/pdfs/fixture_original.pdf', { session: cookies.owner })).status, 200);
  const history = await (await request(route, { session: cookies.supervisor })).json();
  assert.equal(history.items.filter(item => item.recordId === fineId).length, 4);
  assert.equal(history.items.at(-1).previous.estado, 'PAGADA');
});
