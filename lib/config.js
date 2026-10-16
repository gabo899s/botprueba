const path = require("node:path");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const port = Number(process.env.PORT || 3000);
const baseUrl = (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');
const publicUrl = new URL(baseUrl);
if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash)
  throw Error('BASE_URL debe ser una dirección http(s) sin ruta, credenciales ni parámetros.');
const listenHost = process.env.LISTEN_HOST || '127.0.0.1';
const allowedHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]', publicUrl.hostname.toLowerCase()]);
function configured() {
  return Boolean(process.env.JWT_SECRET && process.env.LOCAL_PASSWORD_HASH);
}
module.exports = {
  root,
  port,
  baseUrl,
  listenHost,
  allowedHosts,
  configured,
  dataDir: process.env.MAESRP_DATA_DIR || path.join(root, "bot/data"),
};
