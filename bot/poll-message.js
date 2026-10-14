const {container}=require('./presentation');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags}=require('discord.js');
function payload(p){
 const count=option=>Object.values(p.votes).filter(v=>v===option).length;
 const box=container('Encuesta de apertura',`${p.hora||'Horario por definir'}\nMínimo de civiles: ${p.minVotes} · Mínimo de staff: ${p.minStaff}\n[separador]\nCiviles: ${count('si')} · Moderadores: ${count('staff')} · Se unen después: ${count('later')} · No asistirán: ${count('no')}`);
 box.addActionRowComponents(new ActionRowBuilder().addComponents(...[
  ['si','Votar como civil'],['staff','Votar como moderador'],['later','Me uno después'],['voters','Ver votantes'],['no','No asistiré']
 ].map(([value,label])=>new ButtonBuilder().setCustomId('poll:'+p.id+':'+value).setLabel(label).setStyle(ButtonStyle.Primary).setDisabled(p.status!=='abierta'&&value!=='voters'))));
 return {components:[box],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}};
}
function voters(p){return [['si','Civiles'],['staff','Moderadores'],['later','Se unen después'],['no','No asistirán']].map(([value,label])=>`**${label}**\n${Object.entries(p.votes).filter(([,v])=>v===value).map(([id])=>`<@${id}>`).join('\n')||'Sin votos'}`).join('\n[separador]\n');}
module.exports={payload,voters};
