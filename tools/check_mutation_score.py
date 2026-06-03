#!/usr/bin/env python3
"""
Mutation score gate — reads mutmut results and exits non-zero if below threshold.

Usage:
    python3 tools/check_mutation_score.py --min 80
    python3 tools/check_mutation_score.py --min 70 --verbose

Exit codes:
    0  — mutation score >= threshold
    1  — mutation score < threshold (gate fails)
    2  — mutmut results not found (run `mutmut run` first)
"""
import argparse
import json
import subprocess
import sys


def _get_mutmut_results() -> dict | None:
    """Run `mutmut results --json` and return parsed output, or None on failure."""
    try:
        proc = subprocess.run(
            ["mutmut", "results", "--json"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return None
        return json.loads(proc.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
        return None


def _get_mutmut_summary() -> dict | None:
    """
    Parse `mutmut results` text output as fallback when --json is unavailable.
    Returns dict with keys: killed, survived, total.
    """
    try:
        proc = subprocess.run(
            ["mutmut", "results"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = proc.stdout + proc.stderr
        killed = survived = timeout_count = 0
        for line in output.splitlines():
            line = line.strip()
            if line.startswith("Killed"):
                killed = int(line.split()[1])
            elif line.startswith("Survived"):
                survived = int(line.split()[1])
            elif line.startswith("Timeout"):
                timeout_count = int(line.split()[1])
        total = killed + survived + timeout_count
        if total == 0:
            return None
        return {"killed": killed, "survived": survived, "total": total}
    except (subprocess.TimeoutExpired, ValueError, FileNotFoundError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Mutation score gate for CI")
    parser.add_argument(
        "--min",
        type=int,
        default=70,
        metavar="THRESHOLD",
        help="Minimum mutation score %% required to pass (default: 70)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print surviving mutant details",
    )
    args = parser.parse_args()

    # Try JSON output first, fall back to text parsing
    data = _get_mutmut_results()
    if data is None:
        data = _get_mutmut_summary()

    if data is None:
        print(
            "ERROR: Could not read mutmut results.\n"
            "       Run `mutmut run --paths-to-mutate backend/app/agent/` first.",
            file=sys.stderr,
        )
        sys.exit(2)

    killed = data.get("killed", 0)
    total = data.get("total", 0)

    if total == 0:
        print("WARNING: mutmut found 0 mutants. Check --paths-to-mutate.", file=sys.stderr)
        sys.exit(2)

    score = round(killed / total * 100, 1)
    survived = total - killed

    print(f"Mutation score: {score:.1f}% ({killed}/{total} mutants killed)")
    print(f"Survived mutants: {survived}")

    if args.verbose and data.get("survived_ids"):
        print("\nSurviving mutant IDs (run `mutmut show <id>` to inspect):")
        for mid in data.get("survived_ids", []):
            print(f"  {mid}")

    if score < args.min:
        print(
            f"\nFAIL: mutation score {score:.1f}% < threshold {args.min}%\n"
            f"      Add assertions to kill surviving mutants or lower --min if intentional.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"\nPASS: mutation score {score:.1f}% >= threshold {args.min}%")
    sys.exit(0)


if __name__ == "__main__":
    main()
