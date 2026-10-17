const {test}=require('node:test'),assert=require('node:assert/strict'),sharp=require('sharp');
const {identityImage,identityImageKey,cardSvg,avatarHost,dateLabel}=require('../lib/identity-image');
const card={numeroCedula:'RP-PREVIEW',discordId:'111111111111111111',nombre:'Ana María',apellidos:'Méndez',fechaNacimiento:'2000-02-29',createdAt:'2024-02-29T15:00:00Z',sexo:'F',estatura:'176 cm',grupoSanguineo:'A+',nacionalidad:'Costarricense',lugarNacimiento:'San José'};
const failFetch=async()=>{throw Error('offline');};
test('cédula PNG de alta resolución incorpora datos, firma y aviso RP aun sin Roblox',async()=>{
 const data=await identityImage(card,{fetchImpl:failFetch,useCache:false});
 const meta=await sharp(data).metadata();assert.equal(meta.format,'png');assert.equal(meta.width,1080);assert.equal(meta.height,690);
 const svg=cardSvg(card,null);for(const text of ['Ana María','Méndez','176 cm','A+','SIN VALIDEZ LEGAL','AVATAR NO DISPONIBLE','MAES ROLEPLAY'])assert.ok(svg.includes(text),text);
 assert.equal(dateLabel(card.createdAt,5),'28 FEB 2029');assert.equal(dateLabel('2000-01-01'),'01 ENE 2000');
});
test('avatar Roblox se resuelve por nombre sin vincular cuentas ni admitir redirecciones',async()=>{
 const png=await sharp({create:{width:420,height:420,channels:3,background:'#285591'}}).png().toBuffer();const calls=[];
 const fetchImpl=async(url,options)=>{calls.push({url,options});assert.equal(options.redirect,'error');
 if(url==='https://users.roblox.com/v1/usernames/users'){assert.deepEqual(JSON.parse(options.body).usernames,['AnaEjemplo']);return Response.json({data:[{id:123,name:'AnaEjemplo'}]});}
 if(url.startsWith('https://thumbnails.roblox.com/'))return Response.json({data:[{targetId:123,state:'Completed',imageUrl:'https://tr.rbxcdn.com/fixture.png'}]});
 assert.equal(url,'https://tr.rbxcdn.com/fixture.png');return new Response(png,{headers:{'content-type':'image/png'}});};
 const c={...card,roblox:{username:'AnaEjemplo'}},before=structuredClone(c);
 const result=await identityImage(c,{fetchImpl,useCache:false});assert.deepEqual(c,before);assert.equal(calls.length,3);
 const noPhoto=await identityImage(c,{fetchImpl:failFetch,useCache:false});assert.notDeepEqual(result,noPhoto);
});
test('URLs externas, imágenes enormes, respuestas inválidas y XML inyectado quedan aislados',async()=>{
 for(const url of ['http://tr.rbxcdn.com/a','https://127.0.0.1/a','https://tr.rbxcdn.com.evil/a','https://user@tr.rbxcdn.com/a','file:///etc/passwd','https://tr.rbxcdn.com:444/a'])assert.equal(avatarHost(url),false,url);
 let calls=0;
 await identityImage({...card,roblox:{avatarUrl:'http://localhost/private'}},{fetchImpl:async()=>{calls++;throw Error();},useCache:false});assert.equal(calls,0);
 const hostile=cardSvg({...card,nombre:'<script>alert(1)</script>&"'},null);assert.ok(!hostile.includes('<script>'));assert.ok(hostile.includes('&lt;script&gt;'));
 for(const response of [new Response('<svg></svg>',{headers:{'content-type':'image/svg+xml'}}),new Response('bad',{headers:{'content-type':'image/png','content-length':'99999999'}}),new Response('bad',{headers:{'content-type':'image/png'}})]){
 const got=await identityImage({...card,roblox:{avatarUrl:'https://tr.rbxcdn.com/a'}},{fetchImpl:async()=>response,useCache:false});assert.equal((await sharp(got).metadata()).format,'png');
 }
 await assert.rejects(identityImage({...card,numeroCedula:'../private'}),{status:400});
});
test('huella de imagen incluye dueño, datos físicos y avatar para no reutilizar identidades anteriores',()=>{
 for(const change of [{discordId:'222222222222222222'},{estatura:'180'},{sexo:'M'},{grupoSanguineo:'O+'},{lugarNacimiento:'Otra ciudad'},{createdAt:'2025-01-01'},{roblox:{userId:'12'}}])assert.notEqual(identityImageKey(card),identityImageKey({...card,...change}));
 assert.equal(identityImageKey(card),identityImageKey(structuredClone(card)));
});
test('registro y consulta Discord envían PNG visible en Components V2 conservando el PDF',async()=>{
 const {AttachmentBuilder}=require('discord.js');const {v2Payload}=require('../bot/presentation');
 // presentation reads templates; stub that single read without opening a database.
 const store=require('../lib/store'),original=store.read;store.read=()=>({});
 try{for(const name of ['registrar-cedula','ver-cedula']){
 let payload;
 await require('../bot/commands/cedulas/'+name)({c:{id:card.discordId},user:card.discordId,str:key=>({nombre:'Ana',apellidos:'Méndez','grupo-sanguineo':'A+'}[key]),root:'/example',path:require('node:path'),AttachmentBuilder,domain:{registerCitizen:(_c,values)=>{assert.equal(values.grupoSanguineo,'A+');return card;},ownOr:()=>{},citizen:()=>card},operations:{identityDocuments:async()=>({image:Buffer.from('png'),file:'example.pdf'})},respond:(_i,title,body,files)=>{payload=v2Payload({embeds:[{title,description:body}],files,flags:64});}});
 assert.equal(payload.files.length,2);assert.ok(JSON.stringify(payload.components).includes('attachment://cedula-personaje.png'));assert.ok(JSON.stringify(payload.components).includes('attachment://example.pdf'));assert.ok(payload.flags&64);
 }}finally{store.read=original;}
});
