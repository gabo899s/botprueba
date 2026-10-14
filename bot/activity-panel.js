const {container}=require('./presentation');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags}=require('discord.js');
const store=require('../lib/store'),domain=require('./domain'),settings=require('./settings');
let busy=false;
async function publish(client,force=false){
 const cfg=settings.get();if(!cfg.activityPanelEnabled||!cfg.channels.activity||!client?.isReady()||busy)return;
 const record=store.read('settings').activityPublication;
 if(!force&&record&&Date.now()-Date.parse(record.at)<60000)return;
 busy=true;
 try{
  const ch=await client.channels.fetch(cfg.channels.activity);
  if(!ch?.isTextBased())throw Error('Canal de actividad inválido.');
  const at=Date.now();
  const active=Object.entries(store.read('shifts')).filter(([,s])=>s.current).map(([user,s])=>{const shift=s.current;const elapsed=shift.activeMs+(shift.state==='active'?Math.max(0,at-shift.last):0);return `<@${user}> · ${(elapsed/3600000).toFixed(2)} h · ${shift.state==='active'?'activo':'pausado'}`;});
  const box=container('Moderadores Activos',active.join('\n')||'No hay turnos abiertos.');
  box.addActionRowComponents(new ActionRowBuilder().addComponents(...[['start','Entrar al trabajo'],['stop','Salir del trabajo']].map(([value,label])=>new ButtonBuilder().setCustomId('shift:'+value).setLabel(label).setStyle(ButtonStyle.Primary))));
  const old=record?.channelId===ch.id?await ch.messages.fetch(record.id).catch(()=>null):null;
  const payload={components:[box],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}};
  const msg=old?await old.edit(payload):await ch.send(payload);
  store.update('settings',s=>{s.activityPublication={id:msg.id,channelId:ch.id,at:new Date().toISOString()};});
 }finally{busy=false;}
}
module.exports={publish};
