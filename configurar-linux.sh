#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ -x .runtime/node/bin/node ]]; then export PATH="$PWD/.runtime/node/bin:$PATH"; fi
exec npm run setup
