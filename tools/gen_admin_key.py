#!/usr/bin/env python3
"""Emergency fallback: derive and print the current admin key locally.

Usage:
    python tools/gen_admin_key.py
    python tools/gen_admin_key.py --period monthly

Normally the key is generated automatically by the cron job and written to
/data/admin_keys.txt on HF Spaces. Use this script only when you need the key
before the cron has run, or when you have no access to the log file.
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.admin_auth import get_window_label, derive_key, get_expiry_date


def main():
    parser = argparse.ArgumentParser(description="Derive current admin key from master secret")
    parser.add_argument("--period", default=None, help="Override rotation period (daily/weekly/monthly/quarterly/annual)")
    args = parser.parse_args()

    master = os.environ.get("ADMIN_MASTER_SECRET", "").strip()
    if not master:
        master = input("ADMIN_MASTER_SECRET: ").strip()
    if not master:
        print("Error: ADMIN_MASTER_SECRET is required", file=sys.stderr)
        sys.exit(1)

    period = args.period or os.environ.get("ADMIN_KEY_ROTATION_PERIOD", "weekly")
    label = get_window_label(period, offset=0)
    key = derive_key(master, label)
    expiry = get_expiry_date(period)

    print(f"Window : {label}")
    print(f"Expires: {expiry}")
    print(f"Key    : {key}")


if __name__ == "__main__":
    main()
