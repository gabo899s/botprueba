// Shared by the web and Discord. Keep this module independent of either runtime.
const articles = require("../bot/content/articles.json");
const limits = Object.freeze({ amount: 100000000, arrestMinutes: 1000000, dueDays: 7 });
function invalid(message) {
  throw Object.assign(Error(message), { status: 400 });
}
function number(value, min, max, integer = false) {
  if (!["string", "number"].includes(typeof value) || String(value).trim() === "")
    invalid("Valor numérico requerido.");
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n)))
    invalid("Valor numérico fuera del límite permitido.");
  return n;
}
function articleText(value) {
  if (Array.isArray(value)) {
    if (!value.length || value.length > articles.length) invalid("Selecciona artículos válidos.");
    const selected = [...new Set(value.map(n => number(n, 1, 100000, true)))];
    if (selected.some(n => !articles.some(a => a.numero === n))) invalid("Artículo fuera del catálogo.");
    return selected.map(n => "Art. " + n).join(", ");
  }
  if (typeof value !== "string" || !value.trim()) invalid("Artículos requeridos.");
  if (value.trim().length > 1500) invalid("Los artículos no pueden superar 1500 caracteres.");
  return value.trim();
}
function recordFields(type, input = {}, at = Date.now()) {
  if (!["multa", "arresto"].includes(type)) invalid("Tipo de registro inválido.");
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid("Datos de registro inválidos.");
  const articulos = articleText(input.articulos);
  if (type === "arresto") return { articulos, tiempo: number(input.tiempo, 1, limits.arrestMinutes, true) };
  const present = value => value !== undefined && value !== null && value !== "";
  if (present(input.monto) && present(input.valor) && Number(input.monto) !== Number(input.valor))
    invalid("Monto y valor no coinciden.");
  let amount = present(input.monto) ? input.monto : input.valor;
  if (!present(amount)) {
    const ids = [...new Set([...articulos.matchAll(/\bArt(?:[íi]culo)?\.?\s*(\d+)/giu)].map(match => Number(match[1])))];
    if (!ids.length) invalid("Escribe un monto válido o artículos del catálogo.");
    amount = ids.reduce((total, id) => {
      const entry = articles.find(a => a.numero === id);
      if (!entry) invalid("Artículo fuera del catálogo; revisa el cálculo de la multa.");
      return total + Number(entry.monto);
    }, 0);
  }
  const monto = Math.round((number(amount, 0.01, limits.amount) + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(at) || !Number.isFinite(new Date(at).getTime())) invalid("Fecha de registro inválida.");
  if (input.placa !== undefined && input.placa !== null && typeof input.placa !== "string") invalid("Placa inválida.");
  const placa = (input.placa || "").trim().toUpperCase();
  if (placa.length > 20) invalid("La placa no puede superar 20 caracteres.");
  return { articulos, monto, placa, vence: new Date(at + limits.dueDays * 86400000).toISOString() };
}
module.exports = { recordFields, articles, limits };
