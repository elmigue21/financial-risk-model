"""
Timing, thresholds, and results recording for the performance suite.

Kept deliberately small and dependency-free (standard library only) so the
tests read clearly and there is no measurement overhead from a helper library.
"""

import statistics
import time
from datetime import datetime
from pathlib import Path


# Generous default limits, in seconds. A test fails if the median measured time
# exceeds its limit. Override any of these from the command line (see conftest).
DEFAULT_THRESHOLDS = {
    "login": 3.0,
    "predict": 5.0,
    "dashboard": 5.0,
    "report_csv": 3.0,
    "report_pdf": 8.0,
    # The advisor calls an external AI service (and the free tier rate-limits
    # back-to-back calls), so its time is inherently variable — this limit is
    # deliberately lenient and only catches a hang or an outright broken
    # advisor. Override with --max-advice.
    "advice": 60.0,
}


class Stopwatch:
    """A monotonic stopwatch. Start it, do the work, read elapsed seconds."""

    def __init__(self):
        self._start = time.perf_counter()

    def elapsed(self) -> float:
        return time.perf_counter() - self._start


def start_timer() -> Stopwatch:
    return Stopwatch()


def drop_warmup(samples, warmup=1):
    """
    Discard the first `warmup` sample(s). The first run of any flow is slower
    for reasons unrelated to real performance (the app compiles the page on its
    first hit; the PDF export loads its libraries on first use), so we throw it
    away and measure the steady state.
    """
    return samples[warmup:] if len(samples) > warmup else samples


def median(samples):
    return statistics.median(samples)


class Results:
    """Collects one row per measured metric and writes them out at the end."""

    def __init__(self, out_dir):
        self.out_dir = Path(out_dir)
        self.rows = []

    def add(self, test_id, scenario, metric, samples, median_s, threshold_s):
        self.rows.append(
            {
                "test_id": test_id,
                "scenario": scenario,
                "metric": metric,
                "median_s": round(median_s, 3),
                "min_s": round(min(samples), 3),
                "max_s": round(max(samples), 3),
                "threshold_s": threshold_s,
                "passed": median_s <= threshold_s,
                "samples": ", ".join(f"{s:.3f}" for s in samples),
            }
        )

    def write(self):
        if not self.rows:
            return
        self.out_dir.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Machine-readable tab-separated values.
        headers = [
            "test_id",
            "scenario",
            "metric",
            "median_s",
            "min_s",
            "max_s",
            "threshold_s",
            "result",
            "samples",
        ]
        tsv_lines = ["\t".join(headers)]
        for r in self.rows:
            tsv_lines.append(
                "\t".join(
                    str(x)
                    for x in [
                        r["test_id"],
                        r["scenario"],
                        r["metric"],
                        r["median_s"],
                        r["min_s"],
                        r["max_s"],
                        r["threshold_s"],
                        "PASS" if r["passed"] else "FAIL",
                        r["samples"],
                    ]
                )
            )
        (self.out_dir / "performance_results.tsv").write_text(
            "\n".join(tsv_lines) + "\n", encoding="utf-8"
        )

        # Human-readable Markdown table.
        md = [
            f"# Performance results",
            "",
            f"_Recorded {stamp}. Times are the median of the measured runs, in seconds._",
            "",
            "| Test | Scenario | What was measured | Median | Fastest | Slowest | Limit | Result |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for r in self.rows:
            md.append(
                f"| {r['test_id']} | {r['scenario']} | {r['metric']} "
                f"| {r['median_s']:.3f}s | {r['min_s']:.3f}s | {r['max_s']:.3f}s "
                f"| {r['threshold_s']:.1f}s | {'✅ PASS' if r['passed'] else '❌ FAIL'} |"
            )
        md.append("")
        (self.out_dir / "performance_results.md").write_text(
            "\n".join(md) + "\n", encoding="utf-8"
        )
