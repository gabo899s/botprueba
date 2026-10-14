const { container } = require('../../presentation');
const { MessageFlags } = require('discord.js');
module.exports = async ({ i, c, user, number, str, domain, member, settings, store }) => {
  const target = await member(user, i.guild);
  if (!settings.allowed(target, 'staff')) throw Error('Solo miembros del staff pueden ser calificados.');
  const score = number('estrellas') ?? number('puntuacion');
  const r = domain.rating(c, user, score, str('comentarios') || str('comentario'));
  const all = store.read('calificaciones_staff')[user] || [];
  const percent = all.reduce((sum, rating) => sum + rating.nota, 0) / (all.length * 10) * 100;
  return i.editReply({ flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] }, components: [container(
    '<:estrellitadondeestas:1459935932307472730> Nueva Evaluación de Staff',
    `<:persona:1459936786468966637> **Persona que Califica:** <@${c.id}>
<:mod:1459936869398609992> **Moderador Evaluado:** <@${user}>
[separador]
⭐ Estrellas: ${'⭐'.repeat(Math.round(r.nota))} (${r.nota}/10)
💬 Opinion: ${r.comentario || 'Sin comentarios'}
🧮 Calificaciones Totales: ${all.length}
📈 Porcentaje de calificación: ${percent.toFixed(1)}%`,
    { accent: score === 10 ? 0xffd700 : score >= 6 ? 0x00aa55 : 0xff3333 },
  )] });
};

module.exports.metadata = {
  "name": "calificar-staff",
  "scope": "public",
  "schema": {
    "options": [
      {
        "name": "usuario",
        "description": "usuario",
        "required": true,
        "type": 6
      },
      {
        "max_value": 10,
        "min_value": 1,
        "type": 10,
        "name": "puntuacion",
        "description": "puntuacion",
        "required": false
      },
      {
        "type": 3,
        "name": "comentario",
        "description": "comentario",
        "required": false,
        "max_length": 1000
      },
      {
        "max_value": 10,
        "min_value": 1,
        "type": 10,
        "name": "estrellas",
        "description": "estrellas",
        "required": false
      },
      {
        "type": 3,
        "name": "comentarios",
        "description": "comentarios",
        "required": false,
        "max_length": 1000
      }
    ],
    "name": "calificar-staff",
    "description": "Evalúa un miembro del staff",
    "dm_permission": false,
    "type": 1
  }
};
