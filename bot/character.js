const store = require('../lib/store');
const domain = require('./domain');
const { recordBelongsTo } = require('../lib/record-access');
function resetCharacter(ctx, user, reason) {
  domain.requireScope(ctx, 'admin');
  domain.discordId(user);
  if (!domain.text(reason)) throw Error('Motivo requerido.');
  return store.transaction(() => {
    const identities = Object.entries(store.read('cedulas')).filter(([key, record]) => record?.discordId === user || (key === user && !record?.discordId));
    const documents = new Set(identities.map(([, record]) => record.numeroCedula).filter(Boolean));
    const removed = {};
    store.update('cedulas', db => { removed.cedulas = identities.length; for (const [key] of identities) delete db[key]; });
    for (const name of ['licencias', 'vehiculos', 'users']) {
      store.update(name, db => { removed[name] = db[user] ? 1 : 0; delete db[user]; });
    }
    for (const name of ['multas', 'arrestos']) {
      const all = store.read(name);
      const remaining = all.filter(record => {
        const hasOwner = record.userId !== undefined && record.userId !== null && record.userId !== '';
        const normalized = !hasOwner && record.discordId ? { ...record, userId: record.discordId } : record;
        return !recordBelongsTo(normalized, user, documents);
      });
      removed[name] = all.length - remaining.length;
      store.write(name, remaining);
    }
    store.audit(ctx.id, 'character.ck', { user, reason: domain.text(reason), removed });
    return removed;
  });
}
module.exports = { resetCharacter };
