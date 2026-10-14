#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
# Si hay Node compatible en el sistema, úsalo. Si no, instala Node 24
# dentro del proyecto, sin sudo y sin modificar tu instalación global.
if [[ -x .runtime/node/bin/node ]]; then export PATH="$PWD/.runtime/node/bin:$PATH"; fi
if ! command -v node >/dev/null 2>&1 || ! node -e 'const[a,b]=process.versions.node.split(".").map(Number);process.exit(a>24||(a===24&&b>=15)?0:1)' || ! command -v npm >/dev/null 2>&1; then
  for tool in curl tar xz sha256sum awk; do
    command -v "$tool" >/dev/null 2>&1 || { echo "Falta $tool. Instala los requisitos indicados en README.md." >&2; exit 1; }
  done
  case "$(uname -m)" in x86_64) arch=x64;; aarch64|arm64) arch=arm64;; *) echo 'Instalación automática disponible para Linux x86_64 y ARM64.' >&2; exit 1;; esac
  temporary="$(mktemp -d)"
  trap 'rm -rf -- "$temporary"' EXIT
  curl --fail --show-error --silent --location https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt --output "$temporary/SHASUMS256.txt"
  archive="$(awk -v suffix="-linux-$arch.tar.xz" 'index($2,suffix) && substr($2,length($2)-length(suffix)+1)==suffix {print $2;exit}' "$temporary/SHASUMS256.txt")"
  [[ "$archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || { echo 'No se pudo identificar el archivo oficial de Node 24.' >&2; exit 1; }
  curl --fail --show-error --location "https://nodejs.org/dist/latest-v24.x/$archive" --output "$temporary/$archive"
  awk -v name="$archive" '$2==name {print}' "$temporary/SHASUMS256.txt" > "$temporary/checksum.txt"
  (cd -- "$temporary" && sha256sum --check checksum.txt)
  mkdir -p .runtime/node
  tar -xJf "$temporary/$archive" --strip-components=1 -C .runtime/node
  export PATH="$PWD/.runtime/node/bin:$PATH"
fi
npm ci --no-fund
npm run setup
[[ -s .env ]] || { echo 'La configuración no terminó. Ejecuta bash configurar-linux.sh.' >&2; exit 1; }
npm test
printf '\nInstalación comprobada. Ejecuta: bash iniciar-linux.sh\n'
