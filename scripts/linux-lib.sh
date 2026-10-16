#!/usr/bin/env bash
# Funciones compartidas para el arranque y las actualizaciones de Linux.
ensure_runtime() {
  if [[ -x "$PROJECT_DIR/.runtime/node/bin/node" ]]; then export PATH="$PROJECT_DIR/.runtime/node/bin:$PATH"; fi
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && node -e 'const[a,b]=process.versions.node.split(".").map(Number);process.exit(a>=24||(a===22&&b>=13)?0:1)'; then return; fi
  for tool in curl tar xz sha256sum awk; do command -v "$tool" >/dev/null 2>&1 || { echo "Falta $tool. Instala ca-certificates, curl y xz-utils." >&2; return 1; }; done
  local arch temporary archive
  case "$(uname -m)" in x86_64) arch=x64;; aarch64|arm64) arch=arm64;; *) echo 'La instalación automática necesita Linux x86_64 o ARM64.' >&2; return 1;; esac
  temporary="$(mktemp -d)"
  curl --fail --show-error --silent --location https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt --output "$temporary/SHASUMS256.txt" || { rm -rf -- "$temporary"; return 1; }
  archive="$(awk -v suffix="-linux-$arch.tar.xz" 'index($2,suffix) && substr($2,length($2)-length(suffix)+1)==suffix {print $2;exit}' "$temporary/SHASUMS256.txt")"
  [[ "$archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || { rm -rf -- "$temporary"; echo 'No se pudo identificar Node oficial.' >&2; return 1; }
  curl --fail --show-error --silent --location "https://nodejs.org/dist/latest-v24.x/$archive" --output "$temporary/$archive" || { rm -rf -- "$temporary"; return 1; }
  awk -v name="$archive" '$2==name {print}' "$temporary/SHASUMS256.txt" > "$temporary/checksum.txt"
  (cd -- "$temporary" && sha256sum --check checksum.txt) || { rm -rf -- "$temporary"; return 1; }
  mkdir -p "$PROJECT_DIR/.runtime/node"
  tar -xJf "$temporary/$archive" --strip-components=1 -C "$PROJECT_DIR/.runtime/node" || { rm -rf -- "$temporary"; return 1; }
  rm -rf -- "$temporary"
  export PATH="$PROJECT_DIR/.runtime/node/bin:$PATH"
}
running_pid() {
  local pid cwd
  [[ -f "$PROJECT_DIR/.runtime/app.pid" ]] || return 1
  read -r pid < "$PROJECT_DIR/.runtime/app.pid"
  [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null || return 1
  cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null)" || return 1
  [[ "$cwd" == "$PROJECT_DIR" ]] || return 1
  local -a args
  mapfile -d '' -t args < "/proc/$pid/cmdline" || return 1
  [[ "${args[1]:-}" == "scripts/start.js" || "${args[1]:-}" == "$PROJECT_DIR/scripts/start.js" ]] || return 1
  printf '%s\n' "$pid"
}
stop_app() {
  local pid
  if pid="$(running_pid)"; then
    kill -TERM "$pid"
    for ((i=0;i<80;i++)); do
      if ! running_pid >/dev/null; then rm -f "$PROJECT_DIR/.runtime/app.pid"; return 0; fi
      sleep .1
    done
    echo 'El proceso aún no se ha detenido. No se modificaron los archivos de la aplicación.' >&2
    return 1
  fi
  rm -f "$PROJECT_DIR/.runtime/app.pid"
}
