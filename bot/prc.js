class PRCClient {
  constructor({
    baseURL = "https://api.policeroleplay.community/v1",
    serverKey = process.env.PRC_SERVER_KEY || "",
    authKey = process.env.PRC_AUTH_KEY || "",
    fetchImpl = global.fetch,
    delay = 1200,
  } = {}) {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.serverKey = serverKey;
    this.authKey = authKey;
    this.fetch = fetchImpl;
    this.delay = delay;
    this.last = 0;
    this.tail = Promise.resolve();
  }
  request(endpoint, method = "GET", data) {
    const job = async () => {
      if (!this.serverKey)
        throw Error("Configura PRC_SERVER_KEY en el asistente.");
      const wait = Math.max(0, this.delay - (Date.now() - this.last));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      const headers = {
        "Server-Key": this.serverKey,
        "Content-Type": "application/json",
      };
      if (this.authKey) headers.Authorization = this.authKey;
      let response;
      try {
        response = await this.fetch(this.baseURL + endpoint, {
          method,
          headers,
          body: data === undefined ? undefined : JSON.stringify(data),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        throw Error(
          method === "POST"
            ? "No se pudo confirmar la ejecución en ER:LC. No se reintentó para evitar duplicados."
            : "No se pudo conectar con ER:LC.",
        );
      } finally {
        this.last = Date.now();
      }
      let body;
      try {
        body = await response.json();
      } catch {
        body = {};
      }
      if (!response.ok) {
        const e = Error(
          {
            401: "Clave ER:LC inválida.",
            403: "ER:LC rechazó los permisos.",
            404: "Servidor o ruta ER:LC no disponible.",
            429: "Límite de API ER:LC. Espera antes de repetir.",
          }[response.status] ||
            "ER:LC devolvió un error (" + response.status + ").",
        );
        e.status = response.status;
        throw e;
      }
      return body;
    };
    const task = this.tail.then(job, job);
    this.tail = task.catch(() => {});
    return task;
  }
  status() {
    return this.request("/server");
  }
  players() {
    return this.request("/server/players");
  }
  vehicles() {
    return this.request("/server/vehicles");
  }
  queue() {
    return this.request("/server/queue");
  }
  bans() {
    return this.request("/server/bans");
  }
  logs(type) {
    if (!["joinlogs", "killlogs", "commandlogs"].includes(type))
      throw Error("Tipo de log inválido.");
    return this.request("/server/" + type);
  }
  command(command) {
    if (
      typeof command !== "string" ||
      !command.trim() ||
      command.length > 1000 ||
      /[\r\n\x00]/.test(command)
    )
      throw Error("Comando ER:LC inválido.");
    return this.request("/server/command", "POST", { command });
  }
}
module.exports = { PRCClient };
