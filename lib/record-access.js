// A Discord owner is authoritative. Document-number fallback is only for legacy
// records without an owner, never for records explicitly belonging to someone else.
function recordBelongsTo(record, userId, documentNumbers = new Set()) {
  if (!userId || !record) return false;
  if (record.userId !== undefined && record.userId !== null && record.userId !== '')
    return String(record.userId) === String(userId);
  return documentNumbers.has(record.documento);
}
function recordMatchesCitizen(record, citizen) {
  if (!record || !citizen || record.documento !== citizen.numeroCedula) return false;
  if (record.userId !== undefined && record.userId !== null && record.userId !== '')
    return !!citizen.discordId && String(record.userId) === String(citizen.discordId);
  return true;
}
module.exports = { recordBelongsTo, recordMatchesCitizen };
