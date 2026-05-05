#!/usr/bin/env python3
"""
Pings the HF Space /health endpoint to prevent the 48h sleep.
Run manually or add to a cron: */5 * * * * python3 scripts/keepalive.py
"""
import urllib.request
import sys

URL = "https://minhtai-ai-agent-app.hf.space/health"

try:
    with urllib.request.urlopen(URL, timeout=10) as r:
        print(f"OK {r.status} — {URL}")
except Exception as e:
    print(f"FAIL — {e}", file=sys.stderr)
    sys.exit(1)
