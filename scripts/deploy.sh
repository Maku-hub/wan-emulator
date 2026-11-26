#!/usr/bin/env bash
# Copy the local project to the emulator host over SSH.
# The target directory is wiped first, so files deleted locally disappear there too.
#
# Usage: scripts/deploy.sh <host> [target_dir]
#        host can also be set with $WANEMU_HOST (any SSH destination, e.g. user@10.0.0.5)
#        target_dir defaults to ~/emulator_wan
set -euo pipefail

HOST="${1:-${WANEMU_HOST:-}}"
DEST="${2:-emulator_wan}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$HOST" ]; then
    echo "Usage: $0 <host> [target_dir]   (or set WANEMU_HOST)" >&2
    exit 1
fi

# $DEST is meant to expand locally
# shellcheck disable=SC2029
tar -czf - -C "$SRC" \
    --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' --exclude='.venv' \
    --exclude='.pytest_cache' --exclude='.ruff_cache' \
    . | ssh "$HOST" "{ rm -rf ~/'$DEST' 2>/dev/null || sudo rm -rf ~/'$DEST'; } && mkdir -p ~/'$DEST' && tar -xzf - -C ~/'$DEST' && find ~/'$DEST' -name '*.sh' -exec chmod +x {} +"

echo "Deployed $SRC -> $HOST:~/$DEST"
