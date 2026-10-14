const { Readable } = require('node:stream');
const { PermissionFlagsBits } = require('discord.js');
async function speak(i, client, { fetchImpl=global.fetch }={}) {
 const channel=i.member?.voice?.channel;
 if(!channel)throw Error('Debes estar en un canal de voz para usar este modo.');
 const permissions=channel.permissionsFor(client.user);
 if(!permissions?.has([PermissionFlagsBits.Connect,PermissionFlagsBits.Speak]))throw Error('El bot necesita permisos Conectar y Hablar en ese canal.');
 const voice=require('@discordjs/voice');
 const url=new URL('https://translate.google.com/translate_tts');
 url.search = new URLSearchParams({ie:'UTF-8',q:'Welcome to the channel',tl:'en',total:'1',idx:'0',textlen:'22',client:'tw-ob',ttsspeed:'1'}).toString();
 const response=await fetchImpl(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok||!response.body)throw Error('No se pudo obtener el audio de bienvenida.');
 const connection=voice.joinVoiceChannel({channelId:channel.id,guildId:i.guildId,adapterCreator:i.guild.voiceAdapterCreator,selfDeaf:true,selfMute:false,group:'maesrp'});
 let player;
 try{
  await voice.entersState(connection,voice.VoiceConnectionStatus.Ready,20000);
  player=voice.createAudioPlayer();
  const failure=new Promise((_,reject)=>player.once('error',reject));
  connection.subscribe(player);
  player.play(voice.createAudioResource(Readable.fromWeb(response.body)));
  await Promise.race([voice.entersState(player,voice.AudioPlayerStatus.Idle,45000),failure]);
 }finally{player?.stop();connection.destroy();}
}
function stop(){for(const connection of (require('@discordjs/voice').getVoiceConnections('maesrp')?.values() || []))connection.destroy();}
module.exports={speak,stop};
