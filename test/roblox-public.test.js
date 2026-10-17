const {test,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createUserSearch,headshot,cookieProfile}=require('../lib/roblox-public');
const row=(name,id,displayName=name)=>({id,name,displayName});
test('predicción pandasgord devuelve Pandasgordo, prioriza prefijos y reutiliza caché sin otra petición',async()=>{
 let calls=0;const search=createUserSearch({fetchImpl:async(url,options)=>{calls++;assert.equal(options.redirect,'error');const u=new URL(url);assert.equal(u.origin,'https://users.roblox.com');assert.equal(u.searchParams.get('keyword'),'pandasgord');assert.equal(u.searchParams.get('limit'),'10');return Response.json({data:[row('OtherPandasgord',4),row('Pandasgordo',2,'Pandas'),row('Pandasgord',3),row('Pandasgordo',2),row('Invalid User',8),{...row('Banned',9),isBanned:true}]});}});
 assert.deepEqual((await search('Pandasgord')).map(u=>u.username),['Pandasgord','Pandasgordo','OtherPandasgord']);
 assert.equal((await search('pandasgordo'))[0].username,'Pandasgordo');await search('Pandasgord');assert.equal(calls,1);
 for(const input of ['', 'pa','https://internal','a'.repeat(21),'a b'])assert.deepEqual(await search(input),[]);assert.equal(calls,1);
});
test('búsquedas iguales simultáneas comparten petición y 429 no dispara una tormenta de reintentos',async()=>{
 let calls=0;const search=createUserSearch({fetchImpl:async()=>{calls++;await new Promise(r=>setTimeout(r,5));return Response.json({data:[row('Pandasgordo',2)]});}});
 const [a,b]=await Promise.all([search('pandas'),search('pandas')]);assert.deepEqual(a,b);assert.equal(calls,1);
 let now=100,requests=0;const limited=createUserSearch({now:()=>now,fetchImpl:async()=>{requests++;return new Response('',{status:429});}});
 assert.deepEqual(await limited('pandas'),[]);assert.deepEqual(await limited('otro'),[]);assert.equal(requests,1);now+=30001;await limited('otro');assert.equal(requests,2);
});
test('timeout del proveedor responde vacío antes del vencimiento de la interacción Discord',async()=>{
 const search=createUserSearch({timeoutMs:30,fetchImpl:async(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))});
 const timer=setTimeout(()=>{},1000);try{const start=Date.now();assert.deepEqual(await search('pandas'),[]);assert.ok(Date.now()-start<500);}finally{clearTimeout(timer);}
});
test('cédula pide cabeza por ID verificado e ignora la foto de cuerpo entero de OAuth',async()=>{
 const calls=[];const got=await headshot({roblox:{userId:'123',username:'Pandasgordo',avatarUrl:'https://tr.rbxcdn.com/Avatar/full-body.png'}},{cookieKey:'',fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'error');assert.ok(url.startsWith('https://thumbnails.roblox.com/v1/users/avatar-headshot?'));assert.equal(new URL(url).searchParams.get('userIds'),'123');return Response.json({data:[{targetId:123,state:'Completed',imageUrl:'https://tr.rbxcdn.com/AvatarHeadshot/head.png'}]});}});
 assert.equal(got,'https://tr.rbxcdn.com/AvatarHeadshot/head.png');assert.equal(calls.length,1);
});
test('Cookie API es respaldo opcional, valida identidad y nunca recibe credenciales Roblox',async()=>{
 const key='fixture_cookie_key_only';let calls=[];
 const fetchImpl=async(url,options)=>{calls.push(url);if(url.startsWith('https://thumbnails.roblox.com'))return new Response('',{status:429});
 assert.ok(url.startsWith('https://api.cookie-api.com/api/roblox/user?userid=123'));assert.deepEqual(options.headers,{Authorization:key});assert.equal(options.redirect,'error');
 return Response.json({success:true,userid:123,username:'Pandasgordo',user_avatar_picture:'https://tr.rbxcdn.com/AvatarHeadshot/profile.png'});};
 assert.equal(await headshot({roblox:{userId:'123'}},{fetchImpl,cookieKey:key}),'https://tr.rbxcdn.com/AvatarHeadshot/profile.png');assert.equal(calls.length,2);
 for(const result of [{success:true,userid:222,username:'Wrong'},{success:true,userid:123,username:'Pandasgordo',is_banned:true}])assert.equal(await cookieProfile({id:'123'},{key,fetchImpl:async()=>Response.json(result)}),null);
 const unsafe=await cookieProfile({id:'123'},{key,fetchImpl:async()=>Response.json({success:true,userid:123,username:'Pandasgordo',user_avatar_picture:'http://127.0.0.1/private'})});assert.equal(unsafe.headshotUrl,null);
 const full=await headshot({roblox:{userId:'123',avatarUrl:'https://tr.rbxcdn.com/Avatar/full-body.png'}},{cookieKey:key,fetchImpl:async url=>url.includes('cookie-api')?Response.json({success:true,userid:123,username:'Pandasgordo',user_avatar_picture:'https://tr.rbxcdn.com/Avatar/full-body.png'}):new Response('',{status:503})});assert.equal(full,null);
});
test('respaldo resuelve el nombre exacto pero no inventa sugerencias parciales',async()=>{
 const urls=[];const result=await headshot({roblox:{username:'Pandasgordo'}},{cookieKey:'fixture_cookie_key_only',fetchImpl:async url=>{urls.push(url);if(url.includes('cookie-api'))return Response.json({success:true,userid:123,username:'Pandasgordo',user_avatar_picture:'https://tr.rbxcdn.com/AvatarHeadshot/profile.png'});return new Response('',{status:503});}});
 assert.equal(result,'https://tr.rbxcdn.com/AvatarHeadshot/profile.png');assert.ok(urls.some(u=>u.endsWith('username=Pandasgordo')));
});
test('autocompletado público no pide rol admin y plantillas de mensajes siguen protegidas',async()=>{
 const service=require('../lib/roblox-public'),original=service.searchUsers;let choices;service.searchUsers=async q=>{assert.equal(q,'pandasgord');return [{id:'123',username:'Pandasgordo',displayName:'Pandas'}];};
 const runtime=require('../bot/runtime');try{
 const interaction={commandName:'registrar-cedula',user:{id:'111111111111111111'},options:{getFocused:()=>({name:'roblox',value:'pandasgord'})},respond:async v=>choices=v};
 await runtime.autocomplete(interaction);assert.equal(choices[0].value,'Pandasgordo');assert.ok(choices[0].name.includes('123'));
 const settings=require('../bot/settings'),allowed=settings.allowed,get=settings.get;settings.allowed=()=>false;settings.get=()=>({channels:{}});
 try{await assert.rejects(runtime.autocomplete({...interaction,commandName:'enviar-mensaje',options:{getFocused:()=>({name:'nombre',value:'x'})}}),/permiso/i);}finally{settings.allowed=allowed;settings.get=get;}
 const option=require('../bot/commands/cedulas/registrar-cedula').metadata.schema.options.find(o=>o.name==='roblox');assert.equal(option.autocomplete,true);
 }finally{service.searchUsers=original;}
});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roblox-setup-'));after(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('configurar solo Roblox conserva los demás valores y no expone archivos de credenciales',()=>{
 const filename=path.join(dir,'.env'),original='JWT_SECRET="fixture-existing-jwt"\nDISCORD_TOKEN="fixture-existing-token"\n# conservar comentario\nROBLOX_CLIENT_ID="old"\n';fs.writeFileSync(filename,original);
 const {saveRobloxConfig}=require('../scripts/setup-roblox');saveRobloxConfig(filename,{ROBLOX_CLIENT_ID:'1234567890',ROBLOX_CLIENT_SECRET:'fixture_new_secret',COOKIE_API_KEY:'fixture_cookie_key'});
 const text=fs.readFileSync(filename,'utf8');assert.ok(text.includes('JWT_SECRET="fixture-existing-jwt"'));assert.ok(text.includes('DISCORD_TOKEN="fixture-existing-token"'));assert.ok(text.includes('# conservar comentario'));assert.equal(fs.statSync(filename).mode&0o777,0o600);
 const before=text;assert.throws(()=>saveRobloxConfig(filename,{ROBLOX_CLIENT_ID:'invalid',ROBLOX_CLIENT_SECRET:'x'}));assert.equal(fs.readFileSync(filename,'utf8'),before);
 const symlink=path.join(dir,'linked.env');fs.symlinkSync(filename,symlink);assert.throws(()=>saveRobloxConfig(symlink,{ROBLOX_CLIENT_ID:'1234567890',ROBLOX_CLIENT_SECRET:'fixture_new_secret'}),{code:'EPRIVATEPATH'});
});
