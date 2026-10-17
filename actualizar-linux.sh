#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
PROJECT_DIR="$(pwd -P)"
source "$PROJECT_DIR/scripts/linux-lib.sh"
command -v git >/dev/null || { echo 'Instala git para actualizar.' >&2; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo 'Esta carpeta no fue instalada desde GitHub. Usa instalar-github.sh una vez.' >&2; exit 1; }
[[ "$(git branch --show-current)" == 'main' ]] || { echo 'La actualización necesita la rama main.' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo 'Hay cambios locales en el código. Se conservan; no se actualizó.' >&2; exit 1; }
mkdir -p .runtime
chmod 700 .runtime
if command -v flock >/dev/null; then exec 9>.runtime/update.lock; flock -n 9 || { echo 'Ya hay una actualización en curso.' >&2; exit 1; }; fi
remote="$(git config --get remote.origin.url)"
[[ "$remote" == 'https://github.com/gabo899s/botprueba.git' || "$remote" == 'https://github.com/gabo899s/botprueba' || "$remote" == 'git@github.com:gabo899s/botprueba.git' ]] || { echo 'El origen no es gabo899s/botprueba; no se actualizó.' >&2; exit 1; }
echo 'Buscando actualizaciones de botprueba…'
git fetch origin main
old="$(git rev-parse HEAD)"
next="$(git rev-parse FETCH_HEAD)"
git merge-base --is-ancestor "$old" "$next" || { echo 'El historial local difiere de GitHub. No se sobrescribió.' >&2; exit 1; }
if [[ "$old" == "$next" && -f .runtime/installed-revision && "$(cat .runtime/installed-revision)" == "$next" ]]; then echo 'Ya tienes la última versión.'; exit 0; fi
restart=false
if running_pid >/dev/null; then restart=true; stop_app; fi
backup="$(mktemp -d "$PROJECT_DIR/.runtime/respaldo-$(date +%Y%m%d-%H%M%S)-XXXXXX")"
for file in .env bot/config.json; do if [[ -f "$file" ]]; then mkdir -p "$backup/$(dirname "$file")"; cp -p "$file" "$backup/$file"; fi; done
for dir in bot/data public/pdfs public/uploads; do if [[ -d "$dir" ]]; then mkdir -p "$backup/$(dirname "$dir")"; cp -a "$dir" "$backup/$dir"; fi; done
git merge --ff-only "$next"
ensure_runtime
echo 'Instalando y comprobando la nueva versión…'
if ! npm ci --no-fund >.runtime/update.log 2>&1 || ! npm test >>.runtime/update.log 2>&1; then
  tail -n 25 .runtime/update.log
  echo "La comprobación falló. Tu configuración y datos se conservaron. Respaldo: $backup" >&2
  exit 1
fi
if [[ -f scripts/refresh-pdfs.js ]]; then
  node scripts/refresh-pdfs.js || echo 'Los PDF anteriores se conservaron. Revisa el mensaje anterior.' >&2
fi
printf '%s\n' "$next" > .runtime/installed-revision
node -e 'console.log("Actualizado a la versión "+require("./package.json").version)'
if [[ "$restart" == true ]]; then bash iniciar-linux.sh; fi
