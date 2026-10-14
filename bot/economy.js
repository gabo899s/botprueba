const store = require("../lib/store"),
  domain = require("./domain");
async function pay(
  ctx,
  fineId,
  {
    fetchImpl = global.fetch,
    token = process.env.UNBELIEVABOT_TOKEN,
    guild = process.env.DISCORD_GUILD_ID,
  } = {},
) {
  if (!token || !guild)
    throw Error("Economía no configurada. Solicita validación manual.");
  const fine = store.update("multas", (list) => {
    const r = list.find((f) => f.id === fineId);
    if (!r || r.userId !== ctx.id)
      throw domain.error("Multa no encontrada.", 403);
    if (
      r.estado === "PAGADA" ||
      (r.paymentAttempt &&
        ["en-proceso", "no-confirmado"].includes(r.paymentAttempt.status))
    )
      throw domain.error(
        "Pago completado, en proceso o pendiente de revisar.",
        409,
      );
    r.paymentAttempt = { at: new Date().toISOString(), status: "en-proceso" };
    return structuredClone(r);
  });
  const url = `https://unbelievaboat.com/api/v1/guilds/${guild}/users/${ctx.id}`,
    headers = { Authorization: token, "Content-Type": "application/json" };
  let debiting = false;
  try {
    const balance = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!balance.ok) throw Error("No se pudo consultar la moneda del usuario.");
    const body = await balance.json();
    if (!Number.isFinite(Number(body.cash)))
      throw Error("La economía devolvió un saldo inválido.");
    if (Number(body.cash) < fine.monto)
      throw Error("Saldo ficticio insuficiente.");
    debiting = true;
    const response = await fetchImpl(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        cash: -fine.monto,
        reason: "Pago de multa Maes RP " + fine.id,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      if (response.status < 500 && response.status !== 429) debiting = false;
      throw Error("La economía rechazó el cobro (" + response.status + ").");
    }
    store.update("multas", (list) => {
      const r = list.find((f) => f.id === fineId);
      r.estado = "PAGADA";
      r.paymentAttempt.status = "confirmado";
      r.payment = { via: "UnbelievaBoat", at: new Date().toISOString() };
    });
    return { success: true };
  } catch (e) {
    store.update("multas", (list) => {
      const r = list.find((f) => f.id === fineId);
      r.paymentAttempt.status = debiting ? "no-confirmado" : "rechazado";
    });
    throw Error(
      debiting
        ? "No se pudo confirmar el cobro. No lo repitas: el administrador debe revisar la transacción."
        : e.message,
    );
  }
}
module.exports = { pay };
