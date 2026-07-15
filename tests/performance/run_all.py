#!/usr/bin/env python
"""
Run every performance test, then print how fast each flow was.

Usage (from tests/performance/):
    python run_all.py                 # visible browser
    python run_all.py --headless      # no window (servers / CI)

Any extra arguments are passed straight through to pytest, e.g.
    python run_all.py --headless --samples 5 --max-login 2
"""

import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
RESULTS_TSV = HERE / "results" / "performance_results.tsv"


def main():
    pytest_args = sys.argv[1:]

    started = time.perf_counter()
    proc = subprocess.run([sys.executable, "-m", "pytest", *pytest_args], cwd=str(HERE))
    total = time.perf_counter() - started

    print("\n" + "=" * 70)
    print(" PERFORMANCE SUMMARY (how fast each flow returned)")
    print("=" * 70)

    if RESULTS_TSV.exists():
        rows = RESULTS_TSV.read_text(encoding="utf-8").splitlines()
        col = {name: i for i, name in enumerate(rows[0].split("\t"))}
        print(
            f" {'Test':<7}{'Scenario':<22}{'Metric':<13}"
            f"{'Median':>9}{'Limit':>8}  Result"
        )
        print(" " + "-" * 68)
        for line in rows[1:]:
            c = line.split("\t")
            print(
                f" {c[col['test_id']]:<7}{c[col['scenario']]:<22}{c[col['metric']]:<13}"
                f"{c[col['median_s']] + 's':>9}{c[col['threshold_s']] + 's':>8}  "
                f"{c[col['result']]}"
            )
        print(" " + "-" * 68)
    else:
        print(" No results file was produced — did any test run?")

    print(f" Total wall-clock time: {total:.1f}s")
    print("=" * 70)
    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
