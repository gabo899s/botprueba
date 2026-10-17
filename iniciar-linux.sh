#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
PROJECT_DIR="$(pwd -P)"
source "$PROJECT_DIR/scripts/linux-lib.sh"
mkdir -p .runtime
chmod 700 .runtime
if pid="$(running_pid)"; then echo "Ya está iniciado (PID $pid). Abre http://localhost:3000"; exit 0; fi
if command -v flock >/dev/null; then
  exec 8>.runtime/start.lock
  flock -n 8 || { echo 'El arranque ya está en curso.' >&2; exit 1; }
fi
if pid="$(running_pid)"; then echo "Ya está iniciado (PID $pid)."; exit 0; fi
ensure_runtime
if [[ ! -d node_modules ]]; then npm ci --no-fund; fi
if ! node -e 'process.exit(require("./lib/config").configured()?0:1)'; then npm run setup; fi
# Evita abrir una segunda versión si localhost ya está ocupado.
node - <<'JS'
const net=require('node:net'),{port}=require('./lib/config');
const probe=net.createServer();probe.once('error',e=>{console.error(e.code==='EADDRINUSE'?'Ese puerto ya está ocupado. Detén la versión anterior con Ctrl+C y vuelve a iniciar.':e.message);process.exitCode=1;});probe.listen(port,'127.0.0.1',()=>probe.close());
JS
( exec 8>&- 9>&-; exec nohup "$(command -v node)" scripts/start.js >> .runtime/app.log 2>&1 < /dev/null ) &
pid=$!
printf '%s\n' "$pid" > .runtime/app.pid
for ((i=0;i<60;i++)); do
  # El hijo puede seguir ejecutando bash/nohup antes de convertirse en Node.
  # Durante esa transición comprobamos existencia; la identidad se exige al estar listo.
  if ! kill -0 "$pid" 2>/dev/null; then
    echo 'El proceso terminó antes de completar el arranque.' >&2
    tail -n 15 .runtime/app.log
    rm -f .runtime/app.pid
    exit 1
  fi
  if node - <<'JS'
const {port}=require('./lib/config');fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(500)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));
JS
  then
    if ! running_pid >/dev/null; then sleep .15; continue; fi
    node -e 'console.log("Iniciado: "+require("./lib/config").baseUrl+" · versión "+require("./package.json").version)'
    echo 'Puedes cerrar esta terminal. Logs: .runtime/app.log'
    exit 0
  fi
  sleep .15
 done
 echo 'El arranque tardó más de lo esperado. Revisa .runtime/app.log.' >&2
 exit 1
