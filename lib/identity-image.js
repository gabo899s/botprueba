const sharp = require('sharp');
const { identityImageKey } = require('./identity-document');
const MAX_BYTES = 2 * 1024 * 1024;
const cache = new Map();
const escape = input => String(input ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function avatarHost(address) {
  try { const u=new URL(address);return u.protocol==='https:' && !u.username && !u.password && !u.port && /^(?:tr|t[0-7])\.rbxcdn\.com$/.test(u.hostname); } catch { return false; }
}
async function readResponse(response) {
  if(!response.ok || Number(response.headers.get('content-length') || 0)>MAX_BYTES)throw Error('Respuesta de avatar inválida.');
  const parts=[];let size=0;
  for await (const part of response.body) {size+=part.length;if(size>MAX_BYTES)throw Error('Avatar demasiado grande.');parts.push(Buffer.from(part));}
  return Buffer.concat(parts);
}
async function avatar(c, fetchImpl) {
  // Never fetch a user-provided URL or follow redirects to internal addresses.
  const signal=AbortSignal.timeout(6000);
  const json=async(url,options={})=>JSON.parse((await readResponse(await fetchImpl(url,{...options,signal,redirect:'error'}))).toString());
  try {
    let url=avatarHost(c.roblox?.avatarUrl)?c.roblox.avatarUrl:null;
    if(!url){
      let id=String(c.roblox?.userId||'');
      const username=String(c.roblox?.username||c.robloxUsername||'');
      if(!/^[1-9]\d{0,19}$/.test(id)){
        if(!/^[A-Za-z0-9_]{3,20}$/.test(username))return null;
        const result=await json('https://users.roblox.com/v1/usernames/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernames:[username],excludeBannedUsers:false})});
        const user=result.data?.[0];
        if(!Number.isSafeInteger(user?.id)||user.id<=0)return null;
        id=String(user.id);
      }
      const result=await json(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png&isCircular=false`);
      const item=result.data?.find(item=>String(item.targetId)===id && item.state==='Completed');
      if(!avatarHost(item?.imageUrl))return null;
      url=item.imageUrl;
    }
    const response=await fetchImpl(url,{signal,redirect:'error'});
    if(!/^image\/(?:png|jpeg|webp)(?:;|$)/i.test(response.headers.get('content-type')||''))return null;
    const data=await readResponse(response);
    const image=sharp(data,{limitInputPixels:10000000,animated:false});
    const meta=await image.metadata();
    if(!['png','jpeg','webp'].includes(meta.format)||meta.width>6000||meta.height>6000)return null;
    return await image.resize(350,442,{fit:'cover',position:'attention'}).png().toBuffer();
  }catch{return null;}
}
function dateLabel(input, years=0) {
  if(!input)return 'No consignada';
  // ISO dates are displayed without shifting the character's birthday by timezone.
  const raw=String(input);if(!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(raw))return raw.slice(0,30);
  const d=new Date(raw);if(!Number.isFinite(d.getTime()))return 'No consignada';
  const day=d.getUTCDate(),month=d.getUTCMonth(),year=d.getUTCFullYear()+years;
  const target=new Date(Date.UTC(year,month,day));if(target.getUTCMonth()!==month)target.setUTCDate(0);
  return `${String(target.getUTCDate()).padStart(2,'0')} ${['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][month]} ${year}`;
}
function cardSvg(c, photo) {
  const txt=(value,x,y,size=29,width=590,font='serif',color='#182a34',extra='')=>{
    const content=String(value || 'No consignado').slice(0,160);
    const fitted=Math.min(size,width/(Math.max(content.length,1)*.62));
    return `<text x="${x}" y="${y}" font-family="${font}" font-size="${fitted}" fill="${color}" ${extra}>${escape(content)}</text>`;
  };
  const field=(label,value,x,y,width=270,size=28)=>txt(label,x,y,17,width,'sans-serif','#3f667f')+txt(value,x,y+30,size,width);
  let waves='';
  for(let n=0;n<64;n++){
    const y=32+n*12;
    waves+=`<path d="M-80 ${y} C210 ${y-190} 420 ${y+215} 715 ${y+26} S1080 ${y-182} 1160 ${y+45}" stroke="#77a7bd" stroke-opacity=".25" stroke-width="1.4"/>`;
  }
  for(let n=0;n<32;n++)waves+=`<ellipse cx="1082" cy="60" rx="${210+n*13}" ry="${135+n*10}" transform="rotate(33 1082 60)" stroke="#c78b52" stroke-opacity=".28" stroke-width="1.2"/>`;
  const number=String(c.numeroCedula||'');
  const signature=[c.nombre,c.apellidos].filter(Boolean).join(' ');
  const portrait=photo?`<image href="data:image/png;base64,${photo.toString('base64')}" x="36" y="116" width="350" height="442" clip-path="url(#portrait)"/>`:
    '<g fill="#9aa9ad"><circle cx="211" cy="279" r="66"/><path d="M90 473 Q90 358 211 358 Q332 358 332 473Z"/></g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="690" viewBox="0 0 1080 690">
  <defs><clipPath id="card"><rect width="1080" height="690" rx="25"/></clipPath><clipPath id="portrait"><rect x="36" y="116" width="350" height="442" rx="42"/></clipPath><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#faf6ec"/><stop offset="1" stop-color="#e6eeec"/></linearGradient><linearGradient id="head"><stop stop-color="#f6ddd5"/><stop offset="1" stop-color="#efd8cd"/></linearGradient></defs>
  <g clip-path="url(#card)"><rect width="1080" height="690" fill="url(#paper)"/><g fill="none">${waves}</g>
  <rect width="1080" height="94" fill="url(#head)" fill-opacity=".86"/>
  ${txt('CÉDULA DEL',35,34,23,215,'sans-serif')}${txt('PERSONAJE',35,64,23,215,'sans-serif')}
  <g transform="translate(267 25)"><rect width="64" height="10" fill="#164382"/><rect y="10" width="64" height="8" fill="white"/><rect y="18" width="64" height="15" fill="#b83238"/><rect y="33" width="64" height="8" fill="white"/><rect y="41" width="64" height="10" fill="#164382"/></g>
  ${txt('MAES ROLEPLAY',369,64,52,665,'sans-serif','#a72d35','font-weight="700"')}
  ${txt('COSTA RICA · ER:LC',371,88,15,620,'sans-serif','#7c4545','letter-spacing="2"')}
  ${txt('N.º RP',736,119,17,90,'sans-serif','#3f667f')}${txt(number,820,120,25,220,'serif','#172933','font-weight="700"')}
  <rect x="36" y="116" width="350" height="442" rx="42" fill="#d5dbd8"/>${portrait}
  ${!photo?txt('AVATAR NO DISPONIBLE',65,535,17,295,'sans-serif','#53676d'):''}
  ${field('Apellidos',c.apellidos,416,160,610,34)}${field('Nombres',c.nombre,416,235,610,34)}
  ${field('Nacionalidad',c.nacionalidad,416,311,232)}${field('Estatura',c.estatura,666,311,115)}${field('Sexo',c.sexo,800,311,200)}
  ${field('Fecha de nacimiento',dateLabel(c.fechaNacimiento),416,379,233,26)}${field('G. S.',c.grupoSanguineo,666,379,320)}
  ${field('Lugar de nacimiento',c.lugarNacimiento||c.provincia,416,447,605)}
  ${field('Expedición del personaje · Maes RP',dateLabel(c.createdAt),416,519,600)}
  ${txt('Firma del personaje',36,586,17,350,'sans-serif','#3f667f')}${txt(signature,48,629,34,338,'serif','#22333c','font-style="italic"')}
  ${field('Vencimiento del personaje',c.fechaExpiracion ? dateLabel(c.fechaExpiracion) : 'No establecido',416,592,465)}
  <g transform="translate(947 542)"><path d="M-48 0 Q0-22 48 0 L42 60 Q25 96 0 111 Q-25 96-42 60Z" fill="#1d333d" stroke="#bc943f" stroke-width="3"/><text x="0" y="30" text-anchor="middle" font-family="sans-serif" font-size="19" fill="#f1d28b" font-weight="700">MAES</text><text x="0" y="59" text-anchor="middle" font-family="serif" font-size="26" fill="white">RP</text><text x="0" y="83" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#f1d28b">ER:LC</text></g>
  <rect y="661" width="1080" height="29" fill="#192f39"/>
  ${txt('DOCUMENTO DE FICCIÓN · SOLO ROLEPLAY · SIN VALIDEZ LEGAL',540,681,15,1020,'sans-serif','#ffffff','text-anchor="middle" letter-spacing="1"')}
  </g></svg>`;
}
async function identityImage(c, {fetchImpl=global.fetch, useCache=true}={}) {
  const snapshot=structuredClone(c),key=identityImageKey(snapshot);
  const hit=cache.get(key);if(useCache&&hit&&hit.expires>Date.now())return hit.image;
  const photo=await avatar(snapshot,fetchImpl);
  const image=await sharp(Buffer.from(cardSvg(snapshot,photo))).png().toBuffer();
  if(useCache){cache.delete(key);while(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,{image,expires:Date.now()+(photo?300000:30000)});}
  return image;
}
module.exports={identityImage,identityImageKey,cardSvg,avatarHost,dateLabel};
