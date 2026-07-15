#!/usr/bin/env python
"""
Run every test suite under tests/.

Discovers each subfolder of tests/ that contains test files (test_*.py) and runs
it as its own pytest session, so each suite keeps its own conftest, fixtures, and
command-line options. Prints a pass/fail summary at the end and exits non-zero if
any suite failed.

Usage (from tests/):
    python run_all_tests.py                 # run every suite
    python run_all_tests.py --headless      # extra args are forwarded to pytest

Run it with a Python that has the test dependencies installed, e.g. the
saucedemo venv:
    ../saucedemo/venv/Scripts/python.exe run_all_tests.py --headless
"""

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

# pytest exit codes: 0 = all passed, 5 = no tests collected. Both are "not a
# failure" for our purposes; anything else means something went wrong.
OK_CODES = {0, 5}


def has_tests(folder: Path) -> bool:
    return any(folder.rglob("test_*.py"))


# A suite that records timings drops a *.tsv here with these columns.
TIMING_COLUMNS = {"test_id", "metric", "median_s", "threshold_s", "result"}


def print_suite_timings(suite: Path) -> None:
    """Print per-test response times if the suite wrote a timing results file."""
    results_dir = suite / "results"
    if not results_dir.is_dir():
        return
    for tsv in sorted(results_dir.glob("*.tsv")):
        rows = tsv.read_text(encoding="utf-8").splitlines()
        if not rows:
            continue
        header = rows[0].split("\t")
        if not TIMING_COLUMNS.issubset(header):
            continue
        col = {name: i for i, name in enumerate(header)}
        print(f"   {'Test':<7}{'Metric':<14}{'Median':>9}{'Limit':>8}  Result")
        print("   " + "-" * 45)
        for line in rows[1:]:
            c = line.split("\t")
            print(
                f"   {c[col['test_id']]:<7}{c[col['metric']]:<14}"
                f"{c[col['median_s']] + 's':>9}{c[col['threshold_s']] + 's':>8}  "
                f"{c[col['result']]}"
            )


def main() -> int:
    forwarded = sys.argv[1:]

    suites = sorted(
        p
        for p in HERE.iterdir()
        if p.is_dir() and not p.name.startswith((".", "__")) and has_tests(p)
    )

    if not suites:
        print(f"No test suites found under {HERE}")
        return 0

    results = {}
    for suite in suites:
        print("\n" + "=" * 70)
        print(f" RUNNING SUITE: {suite.name}")
        print("=" * 70)
        code = subprocess.run(
            [sys.executable, "-m", "pytest", *forwarded],
            cwd=str(suite),
        ).returncode
        results[suite.name] = code

    print("\n" + "=" * 70)
    print(" ALL SUITES SUMMARY")
    print("=" * 70)
    for suite in suites:
        code = results[suite.name]
        status = "PASS" if code in OK_CODES else f"FAIL (pytest exit {code})"
        print(f"\n {suite.name} — {status}")
        print_suite_timings(suite)
    print("=" * 70)

    return 0 if all(code in OK_CODES for code in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
