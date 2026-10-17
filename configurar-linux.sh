#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ -x .runtime/node/bin/node ]]; then export PATH="$PWD/.runtime/node/bin:$PATH"; fi
exec npm run setup
