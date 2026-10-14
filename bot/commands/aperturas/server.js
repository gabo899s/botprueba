const { container } = require('../../presentation');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
module.exports = async ({ i, settings }) => {
 const box = container('Control del servidor Maes RP', 'Estado: ' + (settings.get().serverState || 'sin configurar') + '\nLa apertura registra el estado de rol; no enciende ni apaga Roblox.');
 box.addActionRowComponents(new ActionRowBuilder().addComponents(...[['abierto','Abrir'],['cerrado','Cerrar']].map(([value, label]) => new ButtonBuilder().setCustomId('server:' + value).setLabel(label).setStyle(ButtonStyle.Primary))));
 return i.editReply({ components: [box], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
};

module.exports.metadata = {
  "name": "server",
  "scope": "staff",
  "schema": {
    "options": [],
    "name": "server",
    "description": "Panel de control de aperturas de Maes RP",
    "dm_permission": false,
    "type": 1
  }
};
