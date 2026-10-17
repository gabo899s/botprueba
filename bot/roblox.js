async function resolveUser(value, fetchImpl = global.fetch) {
  const input = String(value || '').trim();
  if (!/^(?:[A-Za-z0-9_]{3,20}|\d{1,20})$/.test(input)) throw Error('Usuario o ID de Roblox inválido.');
  const numeric = /^\d+$/.test(input);
  const response = await fetchImpl(numeric ? `https://users.roblox.com/v1/users/${input}` : 'https://users.roblox.com/v1/usernames/users', {
    ...(numeric ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [input], excludeBannedUsers: false }) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error('No se pudo verificar el usuario de Roblox.');
  const data = await response.json();
  const user = numeric ? data : data.data?.[0];
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.name !== 'string') throw Error('El usuario de Roblox no existe.');
  return { id: String(user.id), username: user.name };
}
async function individualTarget(value, fetchImpl = global.fetch) {
  if (typeof value !== 'string') throw Error('Usuario Roblox individual inválido.');
  const input = value.trim();
  if (/^(all|others|random|me)$/i.test(input)) throw Error('No se admiten selectores masivos de ER:LC.');
  if (/^\d{1,20}$/.test(input)) {
    const id = BigInt(input);
    if (!id) throw Error('ID Roblox inválido.');
    return { id: id.toString(), username: null };
  }
  return resolveUser(input, fetchImpl);
}
function duration(value) {
  if (!value || /^(permanente|permanent|perm)$/i.test(value)) return 0;
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(M|s|m|h|d|w|segundos?|minutos?|horas?|dias?|días?|semanas?|mes(?:es)?|a|años?|anos?)$/);
  if (!match) throw Error('Tiempo inválido. Usa 1s, 45m, 2h, 1d, 1w, 1M o permanente.');
  const unit = match[2];
  const factor = /^(a|año|ano)/.test(unit) ? 365 * 86400000 : unit === 'M' || /^mes/.test(unit) ? 30 * 86400000 : /^s/.test(unit) && !/^sem/.test(unit) ? 1000 : /^m/.test(unit) ? 60000 : /^h/.test(unit) ? 3600000 : /^d/.test(unit) ? 86400000 : 7 * 86400000;
  const ms = Number(match[1]) * factor;
  if (!Number.isFinite(ms) || ms < 1000 || ms > 3650 * 86400000) throw Error('La duración debe ser de 1 segundo a 3650 días.');
  return ms / 86400000;
}
module.exports = { resolveUser, individualTarget, duration };
