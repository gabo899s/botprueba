const store=require('../lib/store');
async function sync(guild,user,config){
 const bans=store.read('bans').filter(b=>b.userId===user);
 const active=bans.filter(b=>b.status==='aplicado');
 const member=await guild.members.fetch(user).catch(()=>null);if(!member)return;
 if(active.length){
  const record=active.at(-1);
  if(record.discordRestriction?.applied)return;
  const role=config.banRoles[Math.min(active.length,3)];if(!role)return;
  const snapshot=record.discordRestriction||{roles:member.roles.cache.filter(r=>r.id!==guild.id&&!Object.values(config.banRoles).includes(r.id)&&!r.managed&&r.editable).map(r=>r.id),nickname:member.nickname,applied:false};
  store.update('bans',all=>{all.find(b=>b.id===record.id).discordRestriction=snapshot;});
  if(snapshot.roles.length)await member.roles.remove(snapshot.roles);
  await member.roles.add(role);
  await member.setNickname(('BAN | '+(record.robloxUsername||record.roblox)).slice(0,32));
  store.update('bans',all=>{all.find(b=>b.id===record.id).discordRestriction.applied=true;});
 }else{
  const banRoles=Object.values(config.banRoles).filter(id=>id&&member.roles.cache.has(id));
  if(banRoles.length)await member.roles.remove(banRoles);
  for(const record of bans.filter(b=>b.status==='retirado'&&b.discordRestriction&&!b.discordRestriction.restored)){
   const ids=record.discordRestriction.roles.filter(id=>guild.roles.cache.has(id));
   if(ids.length)await member.roles.add(ids);
   await member.setNickname(record.discordRestriction.nickname);
   store.update('bans',all=>{all.find(b=>b.id===record.id).discordRestriction.restored=true;});
  }
 }
}
module.exports={sync};
