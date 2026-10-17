// Public Roblox data only. OAuth credentials never go to these endpoints.
const {limiter}=require('./security');
const validUsername=v=>typeof v==='string' && /^[A-Za-z0-9_]{3,20}$/.test(v);
const validId=v=>/^[1-9]\d{0,19}$/.test(String(v??''));
function avatarHost(address){try{const u=new URL(address);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&/^(?:tr|t[0-7])\.rbxcdn\.com$/.test(u.hostname);}catch{return false;}}
function isHeadshot(address){return avatarHost(address)&&/AvatarHeadshot/i.test(new URL(address).pathname);}
async function json(url,{fetchImpl=global.fetch,signal=AbortSignal.timeout(2000),...options}={}){
 const response=await fetchImpl(url,{...options,signal,redirect:'error'});
 if(!response.ok)throw Object.assign(Error('No se pudo consultar el perfil público de Roblox.'),{status:response.status});
 if(Number(response.headers?.get('content-length')||0)>262144)throw Error('Respuesta de Roblox demasiado grande.');
 if(response.body){let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>262144)throw Error('Respuesta de Roblox demasiado grande.');chunks.push(Buffer.from(chunk));}return JSON.parse(Buffer.concat(chunks).toString());}
 return response.json();
}
async function cookieProfile({id,username},{fetchImpl=global.fetch,signal,key=process.env.COOKIE_API_KEY}={}){
 if(!key || !/^[A-Za-z0-9._~-]{8,512}$/.test(key) || !validId(id)&&!validUsername(username))return null;
 const query=new URLSearchParams(validId(id)?{userid:String(id)}:{username});
 try{const result=await json('https://api.cookie-api.com/api/roblox/user?'+query,{fetchImpl,signal,headers:{Authorization:key}});
 if(result.success!==true||result.is_banned||!validId(result.userid)||!validUsername(result.username))return null;
 if(validId(id)?String(result.userid)!==String(id):result.username.toLowerCase()!==username.toLowerCase())return null;
 return{id:String(result.userid),username:result.username,headshotUrl:isHeadshot(result.user_avatar_picture)?result.user_avatar_picture:null};
 }catch{return null;}
}
async function headshot(c,{fetchImpl=global.fetch,signal=AbortSignal.timeout(4500),cookieKey=process.env.COOKIE_API_KEY}={}){
 let id=String(c.roblox?.userId||''),username=c.roblox?.username||c.robloxUsername;
 let fallback;
 if(!validId(id)){
  if(!validUsername(username))return null;
  try{const result=await json('https://users.roblox.com/v1/usernames/users',{fetchImpl,signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernames:[username],excludeBannedUsers:false})});
  const user=result.data?.[0];if(Number.isSafeInteger(user?.id)&&user.id>0&&validUsername(user.name))id=String(user.id);
  }catch{}
  if(!validId(id)){fallback=await cookieProfile({username},{fetchImpl,signal,key:cookieKey});if(!fallback)return null;id=fallback.id;}
 }
 try{const result=await json(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png&isCircular=false`,{fetchImpl,signal});
 const item=result.data?.find(item=>String(item.targetId)===id&&item.state==='Completed');
 if(avatarHost(item?.imageUrl))return item.imageUrl;
 }catch{}
 // Only a confirmed headshot is eligible as a fallback; profile pictures may be full-body.
 if(c.roblox?.avatarType==='headshot'&&isHeadshot(c.roblox.avatarUrl))return c.roblox.avatarUrl;
 fallback??=await cookieProfile({id},{fetchImpl,signal,key:cookieKey});return fallback?.headshotUrl||null;
}
function createUserSearch({fetchImpl=global.fetch,now=Date.now,timeoutMs=1900}={}){
 const cache=new Map(),known=new Map(),pending=new Map();let active=0,cooldown=0;
 const allowed=limiter({limit:60,windowMs:60000,now});
 function remember(user){if(!Number.isSafeInteger(user?.id)||user.id<=0||!validUsername(user.name))return null;
  const value={id:String(user.id),username:user.name,displayName:typeof user.displayName==='string'?user.displayName.slice(0,50):user.name};
  known.delete(user.name.toLowerCase());known.set(user.name.toLowerCase(),{value,expires:now()+300000});while(known.size>500)known.delete(known.keys().next().value);return value;
 }
 function local(query){const results=[];for(const [key,item]of known){if(item.expires<=now()){known.delete(key);continue;}if(key.includes(query)||item.value.displayName.toLowerCase().includes(query))results.push(item.value);}return rank(results,query);}
 function rank(items,query){const seen=new Set();return items.filter(u=>u&&!seen.has(u.id)&&seen.add(u.id)).sort((a,b)=>score(b)-score(a)||a.username.localeCompare(b.username)).slice(0,10);function score(u){const s=u.username.toLowerCase();return s===query?3:s.startsWith(query)?2:1;}}
 async function run(query){
  const fallback=local(query),hit=cache.get(query);if(hit&&hit.expires>now())return rank([...hit.items,...fallback],query);
  if(cooldown>now()||active>=3||!allowed('roblox-search'))return fallback;
  active++;
  try{const result=await json('https://users.roblox.com/v1/users/search?'+new URLSearchParams({keyword:query,limit:'10'}),{fetchImpl,signal:AbortSignal.timeout(timeoutMs)});
   const items=rank([...(Array.isArray(result.data)?result.data:[]).slice(0,50).filter(u=>u&&!u.isBanned).map(remember),...fallback],query);
   cache.delete(query);cache.set(query,{items,expires:now()+(items.length?30000:5000)});while(cache.size>200)cache.delete(cache.keys().next().value);return items;
  }catch(error){if(error.status===429)cooldown=now()+30000;return fallback;}finally{active--;}
 }
 return async input=>{const query=String(input??'').trim().toLowerCase();if(!/^[a-z0-9_]{3,20}$/.test(query))return [];
  const suggestions=local(query);if(suggestions.some(u=>u.username.toLowerCase().startsWith(query)))return suggestions;
  if(pending.has(query))return pending.get(query);
  const task=run(query);pending.set(query,task);try{return await task;}finally{pending.delete(query);}
 };
}
const searchUsers=createUserSearch();
module.exports={headshot,avatarHost,isHeadshot,cookieProfile,createUserSearch,searchUsers};
