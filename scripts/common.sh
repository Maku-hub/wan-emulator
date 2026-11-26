#!/usr/bin/env bash
# Shared helper: load config/wanemu.conf (sourced by the other scripts).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT/config/wanemu.conf"

if [ ! -f "$CONF" ]; then
    echo "Missing $CONF" >&2
    echo "Create it from the example and adjust it:  cp config/wanemu.conf.example config/wanemu.conf" >&2
    exit 1
fi

# shellcheck source=/dev/null
. "$CONF"

for var in PORT_A PORT_B BRIDGE MGMT_IF PANEL_PORT; do
    if [ -z "${!var:-}" ]; then
        echo "$CONF: $var is not set" >&2
        exit 1
    fi
done
MGMT_ADDRESS="${MGMT_ADDRESS:-}"
MGMT_GATEWAY="${MGMT_GATEWAY:-}"
