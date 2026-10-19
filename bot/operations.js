const crypto = require("node:crypto");
const fs = require("node:fs"), path = require("node:path");
const { root } = require("../lib/config");
const store = require("../lib/store"),
  domain = require("./domain");
const pdf = require("../lib/pdf");
const { documentJob } = require("../lib/bot-resource-limits");
const { recordFields } = require("../lib/record-rules");
async function record(ctx, type, user, values) {
  domain.requireScope(ctx, "police");
  return documentJob(ctx.id, () => recordDocument(ctx, type, user, values));
}
async function recordDocument(ctx, type, user, values) {
  const c = domain.citizen(user);
  if (!c) throw domain.error("El usuario no tiene cédula registrada.");
  const at = Date.now();
  const fields = recordFields(type, values, at);
  const r = {
    id: type + "_" + crypto.randomUUID(),
    documento: c.numeroCedula,
    ciudadano: c.nombre + " " + c.apellidos,
    userId: user,
    oficialId: ctx.id,
    oficialNombre: ctx.name || ctx.id,
    fecha: new Date().toLocaleString("es-CR", {
      timeZone: "America/Costa_Rica",
    }),
    createdAt: new Date(at).toISOString(),
    estado: type === "multa" ? "REGISTRADA" : "REGISTRADO",
    ...fields,
  };
  r.pdfFileName = await pdf.generate(type, r);
  r.pdfUrl = "/pdfs/" + r.pdfFileName;
  try {
    store.transaction(() => {
      const current = domain.citizen(user);
      if (!current || current.numeroCedula !== c.numeroCedula || current.nombre !== c.nombre || current.apellidos !== c.apellidos)
        throw domain.error("La identidad cambió durante la generación. Vuelve a intentarlo.", 409);
      store.update(type === "multa" ? "multas" : "arrestos", list => list.push(r));
      store.audit(ctx.id, "record.create", { id: r.id, type, userId: user, source: "discord" });
    });
  } catch (error) {
    // A document without its canonical record must never remain accessible.
    try { fs.rmSync(path.join(root, "public/pdfs", path.basename(r.pdfFileName)), { force: true }); } catch {}
    throw error;
  }
  try {
    store.queue(type, r);
    r.notificationPending = true;
  } catch {
    // The record is already committed: report delivery failure without inviting
    // a second command that would create a duplicate fine/arrest.
    r.notificationPending = false;
    r.notificationError = "Registro guardado; la notificación requiere reintento.";
  }
  store.update(type === "multa" ? "multas" : "arrestos", list => Object.assign(list.find(item => item.id === r.id), {
    notificationPending: r.notificationPending,
    ...(r.notificationError ? { notificationError: r.notificationError } : {}),
  }));
  return r;
}
async function ban(ctx, user, roblox, motivo, dias, prc) {
  domain.requireScope(ctx, "moderator");
  domain.discordId(user);
  const reason = domain.text(motivo);
  if (!reason) throw domain.error("Motivo requerido.");
  const days = domain.numeric(dias || 0, 0, 3650);
  const resolved = await require("./roblox").individualTarget(roblox);
  roblox = resolved.id;
  const matches = record => record.robloxUserId === roblox || record.roblox === roblox || (!!resolved.username && String(record.robloxUsername || record.roblox).toLowerCase() === resolved.username.toLowerCase());
  if (store.read("bans").some(b => (b.userId === user || matches(b)) && ["aplicado", "pendiente", "no-confirmado"].includes(b.status))) throw domain.error("Ya existe un ban activo, pendiente o no confirmado para este usuario.", 409);
  const r = {
    id: crypto.randomUUID(),
    userId: user,
    roblox,
    robloxUserId: roblox,
    robloxUsername: resolved.username,
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
  const resolved = await require("./roblox").individualTarget(roblox);
  roblox = resolved.id;
  await prc.command(":unban " + roblox);
  const userIds = new Set();
  store.update("bans", (list) => {
    for (const r of list)
      if (
        (r.robloxUserId === roblox || r.roblox === roblox || (resolved.username && String(r.robloxUsername || r.roblox).toLowerCase() === resolved.username.toLowerCase())) &&
        ["aplicado", "no-confirmado", "pendiente"].includes(r.status)
      ) {
        r.roblox = roblox;
        r.robloxUserId = roblox;
        if (resolved.username) r.robloxUsername = resolved.username;
        r.status = "retirado";
        r.unbannedBy = ctx.id;
        r.unbannedAt = new Date().toISOString();
        userIds.add(r.userId);
      }
  });
  store.audit(ctx.id, "ban.remove", { roblox });
  return { success: true, roblox, userIds: [...userIds] };
}
function requestPayment(ctx, fineId) {
  if (!ctx?.id) throw domain.error("Inicia sesión.", 401);
  return store.update("multas", (list) => {
    const fine = list.find((f) => f.id === fineId);
    if (!fine || fine.userId !== ctx.id)
      throw domain.error(
        "Multa no encontrada o no pertenece a tu usuario.",
        403,
      );
    assertPaymentAvailable(fine);
    if (fine.paymentRequested)
      throw domain.error("Ya existe una solicitud de pago.", 409);
    fine.paymentRequested = {
      at: new Date().toISOString(),
      by: ctx.id,
      status: "pendiente-validacion",
    };
    store.audit(ctx.id, "payment.request", { id: fine.id, userId: fine.userId });
    return fine;
  });
}
function assertPaymentAvailable(fine) {
  const state = String(fine.estado || "").toUpperCase();
  if (state === "PAGADA" || fine.payment || fine.paymentAttempt?.status === "confirmado")
    throw domain.error("La multa ya está pagada o tiene una confirmación registrada.", 409);
  if (["ANULADA", "ANULADO", "CANCELADA", "CANCELADO", "RECTIFICADA", "RECTIFICADO"].includes(state))
    throw domain.error("El registro no está vigente para recibir pagos.", 409);
  if (["en-proceso", "no-confirmado"].includes(fine.paymentAttempt?.status))
    throw domain.error("Hay un cobro en proceso o incierto. Revisa la transacción antes de confirmar un pago manual.", 409);
}
function confirmPayment(ctx, fineId, reference) {
  domain.requireScope(ctx, "police");
  if (!domain.text(reference))
    throw domain.error("Referencia del pago requerida.");
  return store.update("multas", (list) => {
    const fine = list.find((f) => f.id === fineId);
    if (!fine) throw domain.error("Multa no encontrada.", 404);
    assertPaymentAvailable(fine);
    fine.estado = "PAGADA";
    fine.payment = {
      reference: domain.text(reference, 200),
      approvedBy: ctx.id,
      at: new Date().toISOString(),
    };
    if (fine.paymentRequested) {
      fine.paymentRequested.status = "confirmado";
      fine.paymentRequested.confirmedAt = fine.payment.at;
    }
    store.audit(ctx.id, "payment.confirm", { id: fine.id, userId: fine.userId, via: "manual" });
    return fine;
  });
}
async function approvePunishment(ctx, user, sid, prc) {
  domain.requireScope(ctx, "admin");
  const s = domain.sanctions(user).find((s) => s.id === sid);
  if (!s || s.estado !== "activa" || !s.pendingApproval || s.externallyApplied)
    throw domain.error("No hay castigo pendiente.", 409);
  const c = domain.citizen(user),
    target = c?.roblox?.userId || c?.roblox?.username;
  if (!target)
    throw domain.error(
      "Vincula un usuario Roblox válido antes de aplicar el castigo.",
    );
  const { id: roblox } = await require("./roblox").individualTarget(target);
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
function identityPdf(citizen, actorId = citizen?.discordId) {
  return documentJob(actorId, () => pdf.identityPdf(citizen));
}
function identityDocuments(citizen, actorId = citizen?.discordId) {
  return documentJob(actorId, async () => {
    const {identityImage,identityImageKey} = require("../lib/identity-image");
    const snapshot=structuredClone(citizen),key=identityImageKey(snapshot);
    const image=await identityImage(snapshot);
    const file=await pdf.identityPdf(snapshot);
    const current=domain.citizen(snapshot.discordId);
    if(!current || identityImageKey(current)!==key)throw domain.error("La cédula cambió durante la generación. Vuelve a consultarla.",409);
    return {image,file};
  });
}
module.exports = {
  identityDocuments,
  approvePunishment,
  record,
  ban,
  unban,
  requestPayment,
  confirmPayment,
  identityPdf,
};
