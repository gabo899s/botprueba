module.exports = async ({ i, c, user, str, domain, respond, store, log }) => {
  const id = str('id_sancion') || domain.sanctions(user).filter(s => s.estado === 'activa').at(-1)?.id;
  if (!id) throw Error('Sanción activa no encontrada.');
  if (i.options.getUser('usuario')) {
    domain.requireScope(c, 'moderator');
    store.update('sanciones', db => {
      const r = db[user]?.sanctions?.find(s => s.id === id);
      if (!r) throw Error('Sanción no encontrada.');
      r.estado = 'revocada';
      r.appeal = { reason: str('motivo'), author: c.id, at: new Date().toISOString(), status: 'aceptada' };
    });
    store.audit(c.id, 'sanction.appeal.revoke', { user, id });
    await log(i.guild, 'Sanción apelada', `Usuario: <@${user}>
Moderador: <@${c.id}>
Motivo: ${str('motivo')}
Registro: ${id}`);
    return respond(i, 'Sanción apelada', id);
  }
  const r = domain.appeal(c, c.id, id, str('motivo'));
  await log(i.guild, 'Apelación presentada', `Usuario: <@${c.id}>
Motivo: ${str('motivo')}
Registro: ${r.id}`);
  return respond(i, 'Apelación presentada', r.id);
};

module.exports.metadata = {
  "name": "apelar-sancion",
  "scope": "public",
  "schema": {
    "options": [
      {
        "type": 3,
        "name": "motivo",
        "description": "motivo",
        "required": true,
        "max_length": 1000
      },
      {
        "type": 3,
        "name": "id_sancion",
        "description": "id_sancion",
        "required": false,
        "max_length": 80
      },
      {
        "name": "usuario",
        "description": "usuario",
        "required": false,
        "type": 6
      }
    ],
    "name": "apelar-sancion",
    "description": "Presenta una apelación de tu sanción",
    "dm_permission": false,
    "type": 1
  }
};
