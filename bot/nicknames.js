const { container } = require('./presentation');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const jobs = new Map();
function cancel(id, actor) {
  const job = jobs.get(id);
  if (!job || job.owner !== actor) throw Error('No puedes detener esta operación.');
  job.cancelled = true;
}
async function reset({ i, c, member, user, respond, domain }) {
  domain.requireScope(c, 'admin');
  const selected = i.options.getUser('usuario');
  if (selected) {
    await (await member(user, i.guild)).setNickname(null);
    return respond(i, 'Apodo restablecido', 'Miembro actualizado.');
  }
  if (jobs.has(i.guildId)) throw Error('Ya hay una operación de apodos en este servidor.');
  const job = { owner: c.id, cancelled: false, completed: 0, failed: 0 };
  jobs.set(i.guildId, job);
  try {
    const members = [...(await i.guild.members.fetch()).values()].filter(m => !m.user.bot);
    const progress = async (finished = false) => {
      const box = container(finished ? 'Restablecimiento terminado' : 'Restableciendo apodos', `Restablecidos: ${job.completed}\nSin permisos o fallidos: ${job.failed}\nPendientes: ${Math.max(0, members.length-job.completed-job.failed)}${job.cancelled ? '\nOperación detenida.' : ''}`);
      if (!finished) box.addActionRowComponents(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('nicknames:stop:' + i.guildId).setLabel('Detener').setStyle(ButtonStyle.Danger)));
      await i.editReply({ components: [box], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    };
    await progress();
    let last = Date.now();
    for (const m of members) {
      if (job.cancelled) break;
      try { if (m.nickname) await m.setNickname(null, 'Restablecimiento solicitado por ' + c.id); job.completed++; }
      catch { job.failed++; }
      if (Date.now()-last > 3000) { await progress(); last=Date.now(); }
    }
    await progress(true);
  } finally { jobs.delete(i.guildId); }
}
module.exports = { reset, cancel };
