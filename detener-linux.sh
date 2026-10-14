#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
PROJECT_DIR="$(pwd -P)"
source "$PROJECT_DIR/scripts/linux-lib.sh"
stop_app
echo 'Aplicación detenida.'
