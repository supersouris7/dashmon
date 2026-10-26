#!/usr/bin/env python3
"""Expose the local Keepalived role to Dashmon without disclosing the VIP."""

import hmac
import json
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


VIP = os.environ.get("KEEPALIVED_VIP", "").strip()
TOKEN = os.environ.get("KEEPALIVED_TOKEN", "")
BIND = os.environ.get("KEEPALIVED_BIND", "").strip()
PORT = os.environ.get("KEEPALIVED_PORT", "").strip()

if not VIP or not TOKEN or not BIND or not PORT:
    raise SystemExit("KEEPALIVED_VIP, KEEPALIVED_TOKEN, KEEPALIVED_BIND and KEEPALIVED_PORT are required")


def owns_vip():
    try:
        result = subprocess.run(
            ["ip", "-j", "address", "show"], check=True, capture_output=True, text=True, timeout=3
        )
        interfaces = json.loads(result.stdout)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return False
    for interface in interfaces:
        for address in interface.get("addr_info", []):
            if address.get("local") == VIP:
                return True
    return False


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        expected = "Bearer " + TOKEN
        received = self.headers.get("Authorization", "")
        if not hmac.compare_digest(received, expected):
            self.send_response(401)
            self.end_headers()
            return
        payload = json.dumps({"keepalived": {"state": "MASTER" if owns_vip() else "BACKUP"}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, _format, *_args):
        pass


ThreadingHTTPServer((BIND, int(PORT)), Handler).serve_forever()
