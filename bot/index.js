const runtime = require("./runtime");
if (require.main === module) {
  runtime.start().then(() => {
    // En modo bot independiente, un token que no conecta debe comunicar el fallo.
    if (process.env.DISCORD_TOKEN && !runtime.client) process.exitCode = 1;
  }).catch(async (error) => {
    console.error("Error al iniciar el bot:", error.message);
    try { await runtime.stop(); }
    catch { console.error("No se pudo completar la limpieza del bot."); }
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      try { await runtime.stop(); process.exitCode = 0; }
      catch (error) { console.error("Error al detener el bot:", error.message); process.exitCode = 1; }
    });
}
module.exports = runtime;
