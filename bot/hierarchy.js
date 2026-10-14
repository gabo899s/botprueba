const { EmbedBuilder } = require('discord.js');
const settings = require('./settings'), store = require('../lib/store');
let busy = false;
async function publish(guild, force = false) {
  if (busy) return;
  const cfg = settings.get();
  if (!cfg.channels.hierarchy || !cfg.hierarchy.length) {
    if (force) throw Error('Configura el canal y los roles de jerarquía.');
    return;
  }
  if (process.env.ADMIN_GUILD_ID && guild.id !== process.env.ADMIN_GUILD_ID) {
    if (force) throw Error('La jerarquía solo se publica en el servidor administrativo configurado.');
    return;
  }
  const saved = store.read('settings').hierarchyPublication;
  if (!force && saved?.channelId === cfg.channels.hierarchy && Date.now()-Date.parse(saved.at) < 86400000) return;
  busy = true;
  try {
    await guild.members.fetch();
    const mentions = [];
    const description = cfg.hierarchy.map(h => {
      const members = [...guild.members.cache.filter(m => m.roles.cache.has(h.roleId)).values()];
      mentions.push(...members.map(m => m.id));
      return `**${h.name}**\n${members.map(m => `<@${m.id}>`).join('\n') || 'Sin miembros'}`;
    }).join('\n\n');
    if (description.length > 3900) throw Error('La jerarquía supera el tamaño de un mensaje; reduce los grupos por canal.');
    const e = new EmbedBuilder().setColor(0xffd700).setTitle('Jerarquia interna del Equipo Administrativo').setDescription(description).setFooter({ text: 'Maes Roleplay | ER:LC © Todos los derechos reservados.', iconURL: 'https://cdn.discordapp.com/icons/1437462245868310661/54ca61bce8995e0c165f3b2bd5b083c2.webp?size=1024' }).setTimestamp();
    const channel = await guild.channels.fetch(cfg.channels.hierarchy);
    if (!channel?.isTextBased()) throw Error('Canal de jerarquía inválido.');
    const previous = saved?.channelId === channel.id && saved?.id ? await channel.messages.fetch(saved.id).catch(() => null) : null;
    const unique = [...new Set(mentions)];
    const content = unique.map(id => `<@${id}>`).join(' ');
    const payload = { embeds: [e], content: content.length <= 2000 ? content : '', allowedMentions: { parse: [], users: previous ? [] : unique.slice(0, 100), roles: [] } };
    const message = previous ? await previous.edit(payload) : await channel.send(payload);
    store.update('settings', s => { s.hierarchyPublication = { id: message.id, channelId: channel.id, at: new Date().toISOString() }; });
  } finally { busy = false; }
}
module.exports = { publish };
