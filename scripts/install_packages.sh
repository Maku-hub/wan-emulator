#!/usr/bin/env bash
# Install the packages needed on the emulator host (Debian 13). Requires Internet access.
#   sudo ./scripts/install_packages.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "iperf3 iperf3/start_daemon boolean false" | debconf-set-selections

PKGS=(
  # emulation and bridge
  iproute2 ethtool bridge-utils ifupdown
  # web panel
  python3 python3-fastapi python3-uvicorn python3-pydantic python3-yaml
  # tests and measurements
  python3-pytest iperf3 tcpdump mtr-tiny
)

apt-get update
apt-get install -y "${PKGS[@]}"

echo "Done."
