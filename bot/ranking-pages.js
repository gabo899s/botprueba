const {container}=require('./presentation');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags}=require('discord.js');
const store=require('../lib/store'),domain=require('./domain');
function payload(page=0){
 const totals=new Map(domain.ranking().map(r=>[r.userId,r.horas]));
 for(const [user,s] of Object.entries(store.read('shifts'))){
  if(s.current){const x=s.current;const hours=(x.activeMs+(x.state==='active'?Math.max(0,Date.now()-x.last):0))/3600000;totals.set(user,(totals.get(user)||0)+hours);}
 }
 const all=[...totals].sort((a,b)=>b[1]-a[1]).slice(0,100);
 const pages=Math.max(1,Math.ceil(all.length/20));page=Math.max(0,Math.min(pages-1,Number(page)||0));
 const body=all.slice(page*20,(page+1)*20).map(([user,hours],index)=>`${page*20+index+1}. <@${user}> · ${hours.toFixed(2)} h`).join('\n')||'Sin registros.';
 const box=container(`Ranking de actividad · ${page+1}/${pages}`,body);
 if(pages>1)box.addActionRowComponents(new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('ranking:'+Math.max(0,page-1)).setLabel('Anterior').setDisabled(page===0).setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('ranking:'+Math.min(pages-1,page+1)).setLabel('Siguiente').setDisabled(page===pages-1).setStyle(ButtonStyle.Secondary)
 ));
 return {components:[box],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}};
}
module.exports={payload};
