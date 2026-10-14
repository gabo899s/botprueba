const store = require('../lib/store');
const domain = require('./domain');
function resetCharacter(ctx, user, reason) {
  domain.requireScope(ctx, 'admin');
  domain.discordId(user);
  if (!domain.text(reason)) throw Error('Motivo requerido.');
  return store.transaction(() => {
    const identity = store.read('cedulas')[user];
    const removed = {};
    for (const name of ['cedulas', 'licencias', 'vehiculos', 'users']) {
      store.update(name, db => { removed[name] = db[user] ? 1 : 0; delete db[user]; });
    }
    for (const name of ['multas', 'arrestos']) {
      const all = store.read(name);
      const remaining = all.filter(r => r.userId !== user && r.discordId !== user && (!identity?.numeroCedula || r.documento !== identity.numeroCedula));
      removed[name] = all.length - remaining.length;
      store.write(name, remaining);
    }
    store.audit(ctx.id, 'character.ck', { user, reason: domain.text(reason), removed });
    return removed;
  });
}
module.exports = { resetCharacter };
