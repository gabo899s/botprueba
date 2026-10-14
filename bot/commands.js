const fs = require('node:fs'), path = require('node:path');
const commands = [], handlers = {};
function load(dir) {
 for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) { load(file); continue; }
  if (!entry.name.endsWith('.js')) continue;
  const execute = require(file), meta = execute.metadata;
  if (typeof execute !== 'function' || !meta?.schema || !meta.name || meta.schema.name !== meta.name) throw Error('Comando inválido: ' + file);
  if (handlers[meta.name]) throw Error('Comando duplicado: ' + meta.name);
  handlers[meta.name] = execute;
  commands.push({ name: meta.name, scope: meta.scope, guildScope: meta.guildScope, data: { toJSON: () => structuredClone(meta.schema) }, execute });
 }
}
load(path.join(__dirname, 'commands'));
module.exports = { commands, handlers };
