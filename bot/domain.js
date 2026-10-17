const crypto = require("node:crypto"),
  fs = require("node:fs"),
  path = require("node:path");
const store = require("../lib/store"),
  settings = require("./settings");
const { root } = require("../lib/config");
const licenseQuestions = require("./content/license-questions.json"),
  whitelistQuestions = require("./content/whitelist-questions.json"),
  articles = require("./content/articles.json");
const now = () => new Date().toISOString(),
  id = () => crypto.randomUUID();
function error(message, status = 400) {
  const e = Error(message);
  e.status = status;
  return e;
}
function requireScope(ctx, scope) {
  if (!ctx?.id) throw error("Inicia sesión.", 401);
  if (ctx.local || ctx.admin) return;
  if (!ctx[scope]) throw error("No tienes permiso para esta operación.", 403);
}
function ownOr(ctx, user, scope = "staff") {
  if (user === ctx.id) return;
  requireScope(ctx, scope);
}
function text(value, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function numeric(value, min, max, integer = false) {
  const n = Number(value);
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isInteger(n))
  )
    throw error("Valor numérico inválido.");
  return n;
}
function discordId(value) {
  if (typeof value !== "string" || !/^\d{17,20}$/.test(value))
    throw error("ID Discord inválido.");
  return value;
}
function citizen(user) {
  return (
    Object.values(store.read("cedulas")).find((c) => c.discordId === user) ||
    null
  );
}
function registerCitizen(ctx, data) {
  const user = data.discordId || ctx.id;
  ownOr(ctx, user, "police");
  discordId(user);
  const nombre = text(data.nombre, 80),
    apellidos = text(data.apellidos, 100);
  if (!nombre || !apellidos) throw error("Nombre y apellidos requeridos.");
  return store.update("cedulas", (db) => {
    if (Object.values(db).some((c) => c.discordId === user))
      throw error("Ya existe una cédula para ese usuario.", 409);
    const numero =
      data.numeroCedula ||
      "RP-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    if (!/^[\w-]{2,40}$/.test(numero) || db[numero])
      throw error("Cédula inválida o duplicada.");
    const c = {
      numeroCedula: numero,
      discordId: user,
      nombre,
      apellidos,
      sexo: text(data.sexo, 20),
      grupoSanguineo: text(data.grupoSanguineo, 8),
      lugarNacimiento: text(data.lugarNacimiento, 80),
      estatura: text(data.estatura, 20),
      nacionalidad: text(data.nacionalidad, 50),
      provincia: text(data.provincia, 50),
      fechaNacimiento: text(data.fecha, 30),
      roblox: data.roblox ? { username: text(data.roblox, 40) } : null,
      createdAt: now(),
    };
    db[numero] = c;
    return c;
  });
}
function removeCitizen(ctx, user) {
  requireScope(ctx, "admin");
  return store.update("cedulas", (db) => {
    const entry = Object.entries(db).find(([, c]) => c.discordId === user);
    if (!entry) throw error("Ciudadano no encontrado.", 404);
    delete db[entry[0]];
    return entry[1];
  });
}
function registerVehicle(ctx, data) {
  const user = data.userId || ctx.id;
  ownOr(ctx, user, "police");
  const c = citizen(user);
  if (!c) throw error("Primero registra la cédula.");
  const placa = text(data.placa, 20).toUpperCase(),
    modelo = text(data.modelo, 80);
  if (!placa || !modelo) throw error("Placa y modelo requeridos.");
  return store.update("vehiculos", (db) => {
    if (
      Object.values(db)
        .flat()
        .some((v) => v.placa === placa)
    )
      throw error("Placa ya registrada.", 409);
    db[user] = db[user] || [];
    const v = {
      id: id(),
      discordId: user,
      placa,
      modelo,
      marca: text(data.marca, 60),
      año: data.año
        ? numeric(data.año, 1900, new Date().getFullYear() + 1, true)
        : null,
      color: text(data.color, 40),
      registradoEn: now(),
    };
    db[user].push(v);
    return v;
  });
}
function removeVehicle(ctx, user, vehicle) {
  requireScope(ctx, "police");
  return store.update("vehiculos", (db) => {
    const list = db[user] || [];
    const found = list.find((v) => v.id === vehicle || v.placa === vehicle);
    if (!found) throw error("Vehículo no encontrado.", 404);
    db[user] = list.filter((v) => v !== found);
    return found;
  });
}
function startExam(ctx, type, licenseType) {
  if (!ctx?.id) throw error("Inicia sesión.", 401);
  if (type === "whitelist") {
    const previous = store.read("whitelist")[ctx.id];
    if (previous?.status === "rechazado" && Date.now() < (previous.cooldownUntil ? Date.parse(previous.cooldownUntil) : Date.parse(previous.updatedAt) + 2 * 3600000)) throw error("Debes esperar hasta que termine el tiempo de espera de tu whitelist.", 429);
  }

  if (!ctx?.id) throw error("Inicia sesión.", 401);
  const bank =
    type === "license"
      ? licenseQuestions[licenseType]
      : whitelistQuestions.map((q) => ({
          question: q.pregunta,
          options: q.opciones.map((o) => o.label),
          correct: q.opciones.find((o) => o.correcta)?.label,
        }));
  if (!bank) throw error("Tipo de licencia inválido.");
  if (type === "license" && !citizen(ctx.id))
    throw error("Registra tu cédula primero.");
  if (
    type === "license" &&
    (store.read("licencias")[ctx.id] || []).some(
      (l) => l.tipo === licenseType && l.estado === "Activa",
    )
  )
    throw error("Ya tienes esa licencia.");
  const key = ctx.id + ":" + type;
  const record = {
    id: id(),
    userId: ctx.id,
    type,
    licenseType,
    index: 0,
    answers: [],
    expires: Date.now() + 15 * 60000,
  };
  store.update("exams", (db) => {
    const old = db[key];
    if (old && old.expires > Date.now() && !old.completed)
      throw error("Ya tienes un examen en curso.", 409);
    db[key] = record;
  });
  return examView(record);
}
function examView(exam) {
  const bank =
    exam.type === "license"
      ? licenseQuestions[exam.licenseType]
      : whitelistQuestions.map((q) => ({
          question: q.pregunta,
          options: q.opciones.map((o) => o.label),
          correct: q.opciones.find((o) => o.correcta)?.label,
        }));
  if (exam.completed)
    return {
      id: exam.id,
      completed: true,
      passed: exam.passed,
      score: exam.score,
      total: bank.length,
    };
  const q = bank[exam.index];
  return {
    id: exam.id,
    index: exam.index,
    total: bank.length,
    question: q.question,
    options: q.options,
  };
}
function answerExam(ctx, type, examId, index, answer) {
  return store.transaction(() => {
    const exams = store.read("exams"),
      key = ctx.id + ":" + type,
      e = exams[key];
    if (!e || e.id !== examId || e.completed || e.expires < Date.now())
      throw error("Examen expirado o terminado.", 409);
    if (e.index !== Number(index))
      throw error("Pregunta ya respondida o fuera de orden.", 409);
    const bank =
      e.type === "license"
        ? licenseQuestions[e.licenseType]
        : whitelistQuestions.map((q) => ({
            question: q.pregunta,
            options: q.opciones.map((o) => o.label),
            correct: q.opciones.find((o) => o.correcta)?.label,
          }));
    const choice = numeric(answer, 0, bank[e.index].options.length - 1, true);
    e.answers.push(bank[e.index].options[choice] === bank[e.index].correct);
    e.index++;
    if (e.index === bank.length) {
      e.completed = true;
      e.score = e.answers.filter(Boolean).length;
      const threshold =
        e.type === "license"
          ? settings.get().licensePassingPercent
          : settings.get().whitelistPassingPercent;
      e.passed = (e.score / bank.length) * 100 >= threshold;
      if (e.passed && e.type === "license")
        store.update("licencias", (db) => {
          db[ctx.id] = db[ctx.id] || [];
          if (
            !db[ctx.id].some(
              (l) => l.tipo === e.licenseType && l.estado === "Activa",
            )
          )
            db[ctx.id].push({
              tipo: e.licenseType,
              estado: "Activa",
              origen: "examen",
              fecha: now(),
            });
        });
      if (e.type === "whitelist")
        store.update("whitelist", (db) => {
          db[ctx.id] = {
            userId: ctx.id,
            status: e.passed ? "segunda-fase" : "rechazado-examen",
            score: e.score,
            updatedAt: now(),
          };
        });
    }
    store.write("exams", exams);
    return { ...examView(e), licenseType: e.licenseType };
  });
}
function reviewWhitelist(ctx, user, approve, roblox = "") {
  requireScope(ctx, "staff");
  discordId(user);
  return store.update("whitelist", (db) => {
    db[user] = {
      ...db[user],
      userId: user,
      status: approve ? "aceptado" : "rechazado",
      roblox: text(roblox, 40),
      reviewedBy: ctx.id,
      updatedAt: now(),
    };
    return db[user];
  });
}
function sanctions(user) {
  return store.read("sanciones")[user]?.sanctions || [];
}
function sanction(ctx, user, motivo, kind = "sancion", description = "") {
  requireScope(ctx, "moderator");
  discordId(user);
  const reason = text(motivo, 1000);
  if (!reason) throw error("Motivo requerido.");
  const result = store.transaction(() => {
    const db = store.read(
      kind === "advertencia" ? "advertencias" : "sanciones",
    );
    const key = kind === "advertencia" ? "warnings" : "sanctions";
    const recent = Object.values(db)
      .flatMap((r) => r[key] || [])
      .filter(
        (r) =>
          r.moderadorId === ctx.id &&
          Date.now() - Date.parse(r.fecha) <
            settings.get().sanctionCooldownSeconds * 1000,
      );
    if (recent.length)
      throw error("Espera antes de registrar otra sanción.", 429);
    db[user] = db[user] || { [key]: [] };
    const count =
      db[user][key].filter((r) => r.estado !== "revocada").length + 1;
    const punishments = [
      "Advertencia",
      "Kick de apertura",
      "Ban de 1 día",
      "Ban de 3 días",
      "Ban de 7 días",
    ];
    const s = {
      id: id(),
      usuarioId: user,
      moderadorId: ctx.id,
      tipo: kind,
      motivo: reason,
      descripcion: text(description, 1000),
      fecha: now(),
      estado: "activa",
      nivel: Math.min(count, 5),
      castigo:
        kind === "advertencia"
          ? "Advertencia"
          : punishments[Math.min(count, 5) - 1],
      externallyApplied: false,
      pendingApproval: kind === "sancion" && count >= 2,
    };
    db[user][key].push(s);
    store.write(kind === "advertencia" ? "advertencias" : "sanciones", db);
    return s;
  });
  store.audit(ctx.id, "sanction.create", { id: result.id, user });
  return result;
}
function editSanction(ctx, user, sid, motivo, remove = false) {
  requireScope(ctx, "admin");
  return store.update("sanciones", (db) => {
    const record = db[user]?.sanctions?.find((s) => s.id === sid);
    if (!record) throw error("Sanción no encontrada.", 404);
    record.changes = record.changes || [];
    record.changes.push({
      at: now(),
      actor: ctx.id,
      previousMotivo: record.motivo,
      previousEstado: record.estado,
    });
    if (remove) record.estado = "revocada";
    else {
      if (!text(motivo)) throw error("Motivo requerido.");
      record.motivo = text(motivo, 1000);
    }
    return record;
  });
}
function appeal(ctx, user, sid, reason) {
  ownOr(ctx, user, "moderator");
  return store.update("sanciones", (db) => {
    const r = db[user]?.sanctions?.find((s) => s.id === sid);
    if (!r) throw error("Sanción no encontrada.", 404);
    if (!text(reason)) throw error("Motivo requerido.");
    if (r.appeal?.status === "pendiente")
      throw error("Ya existe una apelación pendiente.", 409);
    r.appeal = {
      id: id(),
      reason: text(reason),
      author: ctx.id,
      at: now(),
      status: "pendiente",
    };
    return r;
  });
}
function decideAppeal(ctx, user, sid, accept) {
  requireScope(ctx, "admin");
  return store.update("sanciones", (db) => {
    const r = db[user]?.sanctions?.find((s) => s.id === sid);
    if (!r?.appeal || r.appeal.status !== "pendiente")
      throw error("No hay apelación pendiente.", 409);
    r.appeal.status = accept ? "aceptada" : "rechazada";
    r.appeal.decidedBy = ctx.id;
    r.appeal.decidedAt = now();
    if (accept) r.estado = "revocada";
    return r;
  });
}
function shift(ctx, action, at = Date.now()) {
  requireScope(ctx, "staff");
  return store.transaction(() => {
    const all = store.read("shifts");
    const s = all[ctx.id] || { userId: ctx.id, current: null, history: [] };
    const c = s.current;
    if (
      ["start", "resume"].includes(action) &&
      settings.get().voiceRequired &&
      !ctx.voiceOk &&
      !ctx.local
    )
      throw error(
        "Entra al canal de voz de actividad para iniciar o reanudar.",
      );
    if (action === "start") {
      if (c) throw error("Ya tienes un turno abierto.", 409);
      if (
        store
          .read("loa")
          .some(
            (l) =>
              l.userId === ctx.id &&
              l.status === "aceptada" &&
              Date.parse(l.start) <= at &&
              Date.parse(l.end) >= at,
          )
      )
        throw error("Tienes una ausencia aprobada para este periodo.");
      s.current = {
        id: id(),
        start: at,
        state: "active",
        last: at,
        activeMs: 0,
        pauses: 0,
      };
    } else {
      if (!c) throw error("No tienes un turno abierto.", 409);
      if (action === "pause") {
        if (c.state !== "active")
          throw error("El turno ya está en pausa.", 409);
        c.activeMs += Math.max(0, at - c.last);
        c.state = "paused";
        c.pauses++;
      } else if (action === "resume") {
        if (c.state !== "paused")
          throw error("El turno no está en pausa.", 409);
        c.state = "active";
        c.last = at;
      } else if (action === "stop") {
        if (c.state === "active") c.activeMs += Math.max(0, at - c.last);
        c.end = at;
        c.valid = c.activeMs >= settings.get().minimumShiftMinutes * 60000;
        s.history.push(c);
        s.current = null;
        const hours = store.read("horasactividad");
        hours[ctx.id] = {
          ...hours[ctx.id],
          horas: s.history
            .filter((h) => h.valid)
            .reduce((n, h) => n + h.activeMs / 3600000, 0),
          actualizado: now(),
        };
        store.write("horasactividad", hours);
      } else throw error("Acción de turno inválida.");
    }
    all[ctx.id] = s;
    store.write("shifts", all);
    return s;
  });
}
function shiftInfo(ctx, user = ctx.id) {
  ownOr(ctx, user, "staff");
  return (
    store.read("shifts")[user] || { userId: user, current: null, history: [] }
  );
}
function ranking() {
  return Object.entries(store.read("horasactividad"))
    .map(([userId, r]) => ({ userId, horas: Number(r.horas) || 0 }))
    .sort((a, b) => b.horas - a.horas);
}
function requestLoa(ctx, reason, start, end) {
  requireScope(ctx, "staff");
  const a = Date.parse(start),
    b = Date.parse(end);
  if (
    !text(reason) ||
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    b <= a ||
    b < Date.now()
  )
    throw error("Motivo y fechas de ausencia válidas requeridos.");
  return store.update("loa", (list) => {
    const r = {
      id: id(),
      userId: ctx.id,
      reason: text(reason),
      start: new Date(a).toISOString(),
      end: new Date(b).toISOString(),
      status: "pendiente",
      at: now(),
    };
    list.push(r);
    return r;
  });
}
function decideLoa(ctx, lid, approve) {
  requireScope(ctx, "admin");
  return store.update("loa", (list) => {
    const l = list.find((l) => l.id === lid);
    if (!l || l.status !== "pendiente")
      throw error("Solicitud no encontrada o ya resuelta.", 409);
    l.status = approve ? "aceptada" : "rechazada";
    l.decidedBy = ctx.id;
    l.decidedAt = now();
    return l;
  });
}
function createPoll(ctx, minVotes, minStaff, hora) {
  requireScope(ctx, "staff");
  return store.update("polls", (db) => {
    if (Object.values(db).some((p) => p.status === "abierta"))
      throw error("Ya hay una encuesta abierta.", 409);
    const p = {
      id: id(),
      author: ctx.id,
      minVotes: numeric(minVotes, 1, 100000, true),
      minStaff: numeric(minStaff, 0, 1000, true),
      hora: text(hora, 50),
      votes: {},
      status: "abierta",
      at: now(),
    };
    db[p.id] = p;
    return p;
  });
}
function vote(ctx, pid, option) {
  if (!ctx?.id) throw error("Inicia sesión.", 401);
  return store.update("polls", (db) => {
    const p = db[pid];
    if (!p || p.status !== "abierta")
      throw error("La encuesta está cerrada.", 409);
    if (!["si", "no", "staff", "later"].includes(option)) throw error("Voto inválido.");
    if (option === "staff") requireScope(ctx, "staff");
    if (p.votes[ctx.id] === option) delete p.votes[ctx.id];
    else p.votes[ctx.id] = option;
    return p;
  });
}
function closePoll(ctx, pid, status) {
  requireScope(ctx, "staff");
  return store.update("polls", (db) => {
    const p = db[pid];
    if (!p) throw error("Encuesta no encontrada.", 404);
    p.status = status === "abierto" ? "servidor-abierto" : "cerrada";
    p.closedAt = now();
    p.closedBy = ctx.id;
    return p;
  });
}
function createMessage(ctx, name, content, color = null) {
  requireScope(ctx, "admin");
  if (!/^[\p{L}\p{N} _-]{1,60}$/u.test(name || "") || ["__proto__", "constructor", "prototype"].includes(name) || !text(content, 4000))
    throw error("Nombre y contenido requeridos.");
  if (color !== null && !/^[0-9A-Fa-f]{6}$/.test(color))
    throw error("Color hexadecimal inválido.");
  return store.update("messages", (db) => {
    const record = {
      id: name,
      content: text(content, 4000),
      color,
      author: ctx.id,
      updatedAt: now(),
    };
    db[name] = record;
    return record;
  });
}
function removeMessage(ctx, name) {
  requireScope(ctx, "admin");
  store.update("messages", (db) => {
    if (!db[name]) throw error("Mensaje no encontrado.", 404);
    delete db[name];
  });
}
function ticketCreate(ctx, topic, channelId) {
  const r = {
    id: id(),
    userId: ctx.id,
    topic: text(topic, 150),
    channelId: channelId || null,
    status: "abierto",
    claimedBy: null,
    createdAt: now(),
    lastActiveAt: now(),
  };
  return store.update("tickets", (db) => {
    db.items = db.items || {};
    if (
      Object.values(db.items).some(
        (t) => t.userId === ctx.id && t.status === "abierto",
      )
    )
      throw error("Ya tienes un ticket abierto.", 409);
    db.items[r.id] = r;
    return r;
  });
}
function ticketClaim(ctx, tid) {
  requireScope(ctx, "staff");
  return store.update("tickets", (db) => {
    const t = db.items?.[tid];
    if (!t || t.status !== "abierto")
      throw error("Ticket cerrado o inexistente.", 409);
    if (t.claimedBy && t.claimedBy !== ctx.id)
      throw error("Otro staff ya reclamó el ticket.", 409);
    t.claimedBy = ctx.id;
    t.claimedAt = now();
    return t;
  });
}
function ticketClose(ctx, tid, transcriptFile = null) {
  return store.update("tickets", (db) => {
    const t = db.items?.[tid];
    if (!t) throw error("Ticket no encontrado.", 404);
    if (ctx.id !== t.userId) requireScope(ctx, "staff");
    if (t.status !== "abierto") throw error("Ticket ya cerrado.", 409);
    t.status = "cerrado";
    t.closedAt = now();
    t.closedBy = ctx.id;
    t.transcriptFile = transcriptFile;
    if (t.claimedBy) {
      db.stats = db.stats || {};
      const s = db.stats[t.claimedBy] || {
        atendidos: 0,
        cerrados: 0,
        stars: [],
      };
      s.atendidos++;
      s.cerrados++;
      db.stats[t.claimedBy] = s;
    }
    return t;
  });
}
function ticketRate(ctx, tid, score) {
  return store.update("tickets", (db) => {
    const t = db.items?.[tid];
    if (!t || ctx.id !== t.userId || t.status !== "cerrado")
      throw error("Solo el autor puede evaluar un ticket cerrado.", 403);
    if (t.rating) throw error("Ticket ya evaluado.", 409);
    t.rating = numeric(score, 1, 5, true);
    if (t.claimedBy) {
      const s = db.stats[t.claimedBy];
      s.stars = s.stars || [];
      s.stars.push(t.rating);
    }
    return t;
  });
}
function rating(ctx, user, nota, comentario) {
  if (!ctx?.id) throw error("Inicia sesión.", 401);
  if (ctx.id === user) throw error("No puedes evaluarte a ti mismo.");
  const value = numeric(nota, 1, 10);
  return store.update("calificaciones_staff", (db) => {
    const all = db[user] || [];
    if (!Array.isArray(all))
      throw error("La base anterior necesita conversión.");
    if (
      all.some(
        (r) =>
          r.evaluador === ctx.id && Date.now() - Date.parse(r.fecha) < 86400000,
      )
    )
      throw error("Solo puedes evaluar a este staff una vez al día.", 429);
    const r = {
      id: id(),
      nota: value,
      comentario: text(comentario),
      evaluador: ctx.id,
      fecha: now(),
    };
    all.push(r);
    db[user] = all;
    return r;
  });
}
module.exports = {
  error,
  requireScope,
  ownOr,
  text,
  numeric,
  discordId,
  citizen,
  registerCitizen,
  removeCitizen,
  registerVehicle,
  removeVehicle,
  startExam,
  examView,
  answerExam,
  reviewWhitelist,
  sanctions,
  sanction,
  editSanction,
  appeal,
  decideAppeal,
  shift,
  shiftInfo,
  ranking,
  requestLoa,
  decideLoa,
  createPoll,
  vote,
  closePoll,
  createMessage,
  removeMessage,
  ticketCreate,
  ticketClaim,
  ticketClose,
  ticketRate,
  rating,
  licenseQuestions,
  whitelistQuestions,
  articles,
};
