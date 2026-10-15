const crypto = require("node:crypto");
const store = require("../lib/store"),
  domain = require("./domain");
const { generate, identityPdf } = require("../lib/pdf");
async function record(ctx, type, user, values) {
  domain.requireScope(ctx, "police");
  const c = domain.citizen(user);
  if (!c) throw domain.error("El usuario no tiene cédula registrada.");
  const articles = domain.text(values.articulos, 1500);
  if (!articles) throw domain.error("Artículos requeridos.");
  let amount = values.monto;
  if (type === "multa" && !amount) {
    amount = 0;
    for (const match of articles.matchAll(/Art\.?\s*(\d+)/gi)) {
      const a = domain.articles.find(
        (a) => Number(a.numero) === Number(match[1]),
      );
      if (a) amount += Number(a.monto) || 0;
    }
    if (!amount)
      throw domain.error("Escribe un monto válido o artículos del catálogo.");
  }
  const r = {
    id: type + "_" + crypto.randomUUID(),
    documento: c.numeroCedula,
    ciudadano: c.nombre + " " + c.apellidos,
    userId: user,
    oficialId: ctx.id,
    oficialNombre: ctx.name || ctx.id,
    articulos: articles,
    fecha: new Date().toLocaleString("es-CR", {
      timeZone: "America/Costa_Rica",
    }),
    createdAt: new Date().toISOString(),
    estado: type === "multa" ? "REGISTRADA" : "REGISTRADO",
    ...(type === "multa"
      ? {
          monto: domain.numeric(amount, 0.01, 100000000),
          placa: domain.text(values.placa, 20),
          vence: new Date(Date.now() + 7 * 86400000).toISOString(),
        }
      : { tiempo: domain.numeric(values.tiempo, 1, 1000000, true) }),
  };
  r.pdfFileName = await generate(type, r);
  r.pdfUrl = "/pdfs/" + r.pdfFileName;
  store.update(type === "multa" ? "multas" : "arrestos", (list) =>
    list.push(r),
  );
  store.queue(type, r);
  return r;
}
async function ban(ctx, user, roblox, motivo, dias, prc) {
  domain.requireScope(ctx, "moderator");
  domain.discordId(user);
  if (!/^[A-Za-z0-9_]{3,20}$/.test(roblox))
    throw domain.error("Usuario Roblox inválido.");
  if (store.read("bans").some(b => (b.userId === user || b.roblox === roblox) && ["aplicado", "pendiente", "no-confirmado"].includes(b.status))) throw domain.error("Ya existe un ban activo, pendiente o no confirmado para este usuario.", 409);
  const reason = domain.text(motivo);
  if (!reason) throw domain.error("Motivo requerido.");
  const days = domain.numeric(dias || 0, 0, 3650);
  const r = {
    id: crypto.randomUUID(),
    userId: user,
    roblox,
    motivo: reason,
    moderadorId: ctx.id,
    createdAt: new Date().toISOString(),
    expiresAt: days
      ? new Date(Date.now() + days * 86400000).toISOString()
      : null,
    status: "pendiente",
  };
  store.update("bans", (list) => list.push(r));
  try {
    await prc.command(":ban " + roblox);
    store.update("bans", (list) => {
      const saved = list.find((b) => b.id === r.id);
      saved.status = "aplicado";
      saved.appliedAt = new Date().toISOString();
    });
    r.status = "aplicado";
  } catch (e) {
    store.update("bans", (list) => {
      const saved = list.find((b) => b.id === r.id);
      saved.status = "no-confirmado";
      saved.error = e.message;
    });
    r.status = "no-confirmado";
    r.error = e.message;
  }
  store.audit(ctx.id, "ban.create", { id: r.id, status: r.status });
  return r;
}
async function unban(ctx, roblox, prc) {
  domain.requireScope(ctx, "moderator");
  if (!/^[A-Za-z0-9_]{3,20}$/.test(roblox))
    throw domain.error("Usuario Roblox inválido.");
  await prc.command(":unban " + roblox);
  store.update("bans", (list) => {
    for (const r of list)
      if (
        r.roblox === roblox &&
        ["aplicado", "no-confirmado", "pendiente"].includes(r.status)
      ) {
        r.status = "retirado";
        r.unbannedBy = ctx.id;
        r.unbannedAt = new Date().toISOString();
      }
  });
  store.audit(ctx.id, "ban.remove", { roblox });
  return { success: true, roblox };
}
function requestPayment(ctx, fineId) {
  return store.update("multas", (list) => {
    const fine = list.find((f) => f.id === fineId);
    if (!fine || fine.userId !== ctx.id)
      throw domain.error(
        "Multa no encontrada o no pertenece a tu usuario.",
        403,
      );
    if (fine.estado === "PAGADA")
      throw domain.error("La multa ya está pagada.", 409);
    if (fine.paymentRequested)
      throw domain.error("Ya existe una solicitud de pago.", 409);
    fine.paymentRequested = {
      at: new Date().toISOString(),
      by: ctx.id,
      status: "pendiente-validacion",
    };
    return fine;
  });
}
function confirmPayment(ctx, fineId, reference) {
  domain.requireScope(ctx, "police");
  if (!domain.text(reference))
    throw domain.error("Referencia del pago requerida.");
  return store.update("multas", (list) => {
    const fine = list.find((f) => f.id === fineId);
    if (!fine) throw domain.error("Multa no encontrada.", 404);
    fine.estado = "PAGADA";
    fine.payment = {
      reference: domain.text(reference, 200),
      approvedBy: ctx.id,
      at: new Date().toISOString(),
    };
    return fine;
  });
}
async function approvePunishment(ctx, user, sid, prc) {
  domain.requireScope(ctx, "admin");
  const s = domain.sanctions(user).find((s) => s.id === sid);
  if (!s || s.estado !== "activa" || !s.pendingApproval || s.externallyApplied)
    throw domain.error("No hay castigo pendiente.", 409);
  const c = domain.citizen(user),
    roblox = c?.roblox?.username;
  if (!roblox || !/^[A-Za-z0-9_]{3,20}$/.test(roblox))
    throw domain.error(
      "Vincula un usuario Roblox válido antes de aplicar el castigo.",
    );
  if (s.nivel === 2) await prc.command(":kick " + roblox);
  else {
    const result = await ban(
      ctx,
      user,
      roblox,
      s.motivo,
      { 3: 1, 4: 3, 5: 7 }[s.nivel] || 7,
      prc,
    );
    if (result.status !== "aplicado")
      throw domain.error(
        "El ban no fue confirmado. Revisa el registro antes de reintentar.",
        502,
      );
  }
  store.update("sanciones", (db) => {
    const target = db[user].sanctions.find((r) => r.id === sid);
    target.externallyApplied = true;
    target.pendingApproval = false;
    target.approvedBy = ctx.id;
    target.approvedAt = new Date().toISOString();
  });
  return { success: true };
}
module.exports = {
  approvePunishment,
  record,
  ban,
  unban,
  requestPayment,
  confirmPayment,
  identityPdf,
};
