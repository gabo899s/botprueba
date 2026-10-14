const path = require("node:path");
const root = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(root, ".env"), quiet: true });
const port = Number(process.env.PORT || 3000);
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
function configured() {
  return !!(process.env.JWT_SECRET && process.env.LOCAL_PASSWORD_HASH);
}
module.exports = {
  root,
  port,
  baseUrl,
  configured,
  dataDir: process.env.MAESRP_DATA_DIR || path.join(root, "bot/data"),
};
