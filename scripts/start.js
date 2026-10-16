const { configured } = require("../lib/config");
if (!configured()) {
  console.error("Primero ejecuta bash configurar-linux.sh");
  process.exit(1);
}
if(!require("../lib/privacy").legalInfo().identificationComplete) console.warn("Aviso legal: falta identificar responsable, correo y jurisdicción. Completa configurar-linux.sh antes de abrir el servicio al público.");
const server = require("../server").startServer();
const runtime = require("../bot/runtime");
runtime.start().catch((e) => console.error(e.message));
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    await runtime.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
