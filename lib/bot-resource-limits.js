// Límites de trabajo del bot: las respuestas efímeras de Discord no limitan
// por sí solas el coste de generar documentos o archivar conversaciones.
function busy(message) {
  return Object.assign(Error(message), { status: 429 });
}
function gate({ limit, windowMs, concurrency, perUser = 1, maxKeys = 5000, now = Date.now }) {
  const users = new Map();
  let active = 0;
  return async function run(key, job) {
    key = String(key || 'unknown');
    const at = now();
    for (const [id, value] of users)
      if (!value.active && at - value.start >= windowMs) users.delete(id);
    let state = users.get(key);
    if (!state) {
      if (users.size >= maxKeys) throw busy('Hay demasiadas solicitudes. Inténtalo más tarde.');
      state = { start: at, count: 0, active: 0 };
      users.set(key, state);
    }
    if (at - state.start >= windowMs) { state.start = at; state.count = 0; }
    if (active >= concurrency || state.active >= perUser)
      throw busy('Ya hay una operación en curso. Espera a que termine.');
    if (state.count >= limit) throw busy('Has realizado demasiadas solicitudes. Espera antes de repetir.');
    state.count++; state.active++; active++;
    try { return await job(); }
    finally { state.active--; active--; }
  };
}
const documentJob = gate({ limit: 6, windowMs: 60000, concurrency: 2 });
const transcriptJob = gate({ limit: 3, windowMs: 60000, concurrency: 2 });
const ticketJob = gate({ limit: 1, windowMs: 60000, concurrency: 4 });
module.exports = { gate, documentJob, transcriptJob, ticketJob, busy };
