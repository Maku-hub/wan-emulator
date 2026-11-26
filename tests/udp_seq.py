"""Test helper: send / receive numbered UDP packets and count reordering.

  python3 udp_seq.py recv PORT SECONDS          -> prints JSON {"received": N, "out_of_order": M}
  python3 udp_seq.py send HOST PORT COUNT GAP_S
"""

import json
import socket
import sys
import time


def recv(port: int, seconds: float):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.bind(("0.0.0.0", port))
    s.settimeout(0.2)
    end = time.time() + seconds
    received = ooo = 0
    max_seq = -1
    while time.time() < end:
        try:
            data, _ = s.recvfrom(2048)
        except TimeoutError:
            continue
        seq = int.from_bytes(data[:4], "big")
        received += 1
        if seq < max_seq:
            ooo += 1
        max_seq = max(max_seq, seq)
    print(json.dumps({"received": received, "out_of_order": ooo}))


def send(host: str, port: int, count: int, gap: float):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    for i in range(count):
        s.sendto(i.to_bytes(4, "big") + b"x" * 96, (host, port))
        time.sleep(gap)


if __name__ == "__main__":
    if sys.argv[1] == "recv":
        recv(int(sys.argv[2]), float(sys.argv[3]))
    else:
        send(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), float(sys.argv[5]))
