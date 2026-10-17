const crypto=require('node:crypto');
function limiter({limit,windowMs,maxKeys=5000,now=()=>Date.now()}){
 const entries=new Map();
 return key=>{
  const time=now();let item=entries.get(key);
  if(!item||item.until<=time){
   if(entries.size>=maxKeys){for(const[k,v]of entries)if(v.until<=time)entries.delete(k);if(!entries.has(key)&&entries.size>=maxKeys)return false;}
   item={count:0,until:time+windowMs};entries.set(key,item);
  }
  if(item.count>=limit)return false;item.count++;return true;
 };
}
let passwordJobs=0;
async function verifyPassword(password,encoded){
 const [salt,hash]=String(encoded||'').split(':');
 if(!salt||!/^[a-f0-9]{128}$/i.test(hash||''))return false;
 if(passwordJobs>=4)throw Object.assign(Error('Hay varios accesos en curso. Inténtalo de nuevo.'),{status:429});
 passwordJobs++;
 try{const actual=await new Promise((resolve,reject)=>crypto.scrypt(password,salt,64,(error,result)=>error?reject(error):resolve(result)));return crypto.timingSafeEqual(actual,Buffer.from(hash,'hex'));}
 finally{passwordJobs--;}
}
function jobGate({maxConcurrent=2,limit=30,windowMs=60000}={}){
 let active=0;const allowed=limiter({limit,windowMs});
 return (req,res,next)=>{
  if(active>=maxConcurrent||!allowed(req.user?.id||req.ip))return res.status(429).set('Retry-After','5').json({success:false,message:'Hay varias operaciones de documentos en curso. Inténtalo de nuevo.'});
  active++;let released=false,running=false,ended=false;
  const release=()=>{if(!released&&!running){released=true;active--;}};
  const responseEnded=()=>{ended=true;release();};
  // A disconnected response does not mean its asynchronous PDF work stopped.
  req.runDocumentJob=async work=>{
   if(ended||released)throw Object.assign(Error('Solicitud de documento cerrada.'),{status:400});
   running=true;
   try{return await work();}
   finally{running=false;release();}
  };
  res.once('finish',responseEnded);res.once('close',responseEnded);next();
 };
}
module.exports={limiter,verifyPassword,jobGate};
