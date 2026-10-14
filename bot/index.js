const runtime = require("./runtime");
if (require.main === module) {
  runtime.start().then(() => {
    if (runtime.client) setInterval(() => {}, 60000);
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await runtime.stop();
      process.exit(0);
    });
}
module.exports = runtime;
