#!/usr/bin/env bash
set -euo pipefail
umask 077
REPO_URL='https://github.com/gabo899s/botprueba.git'
PROJECT_DIR="$HOME/botprueba"
if ! command -v git >/dev/null || ! command -v xz >/dev/null || ! command -v ffmpeg >/dev/null; then
  if command -v apt-get >/dev/null && command -v sudo >/dev/null; then
    sudo apt-get update
    sudo apt-get install -y git ca-certificates curl xz-utils tar ffmpeg
  else echo 'Instala git, curl, ca-certificates, tar, xz y FFmpeg antes de continuar.' >&2; exit 1; fi
fi
if [[ -e "$PROJECT_DIR" ]] && ! git -C "$PROJECT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  backup="${PROJECT_DIR}-anterior-$(date +%Y%m%d-%H%M%S)"
  [[ ! -e "$backup" ]] || { echo 'Ya existe el respaldo; vuelve a intentarlo.' >&2; exit 1; }
  mv -- "$PROJECT_DIR" "$backup"
  echo "La carpeta anterior se conservó en $backup"
fi
if [[ ! -d "$PROJECT_DIR/.git" ]]; then git clone --branch main "$REPO_URL" "$PROJECT_DIR"; fi
remote="$(git -C "$PROJECT_DIR" config --get remote.origin.url)"
[[ "$remote" == "$REPO_URL" || "$remote" == 'https://github.com/gabo899s/botprueba' || "$remote" == 'git@github.com:gabo899s/botprueba.git' ]] || { echo 'La carpeta botprueba pertenece a otro repositorio; no se modificó.' >&2; exit 1; }
# Migración inicial: las instalaciones existentes nunca se borran.
if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  for source in "$HOME/infinitedev-maesrp-v3.1.1" "$HOME/infinitedev-maesrp" "$HOME/maesrp-desde-prompts" "$HOME/maesrp-reconstruido" "$HOME/maesrp-local" "${backup:-$PROJECT_DIR}"; do
    if [[ -f "$source/.env" && "$source" != "$PROJECT_DIR" ]]; then
      cp -p "$source/.env" "$PROJECT_DIR/.env"
      if [[ -f "$source/bot/config.json" ]]; then cp -p "$source/bot/config.json" "$PROJECT_DIR/bot/config.json"; fi
      for dir in bot/data public/pdfs public/uploads; do if [[ -d "$source/$dir" ]]; then mkdir -p "$PROJECT_DIR/$dir"; cp -an "$source/$dir/." "$PROJECT_DIR/$dir/"; fi; done
      echo "Configuración y datos recuperados de $source"
      break
    fi
  done
fi
bash "$PROJECT_DIR/actualizar-linux.sh"
bash "$PROJECT_DIR/iniciar-linux.sh"
