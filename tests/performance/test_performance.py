"""
Performance tests for the Financial Health Check app (PT-01..PT-05).

Each test drives a real Chrome browser through one user flow, times it with a
stopwatch, and fails if the median time is over a generous limit (override the
limits with --max-* options). PT-04 (AI advisor) talks to an external AI service,
so its limit is deliberately lenient and it skips when the advisor isn't
configured — it still records how long the advisor took to respond.

Each test runs --samples times (default 3); the first run is a warm-up and is
dropped, and the median of the rest is what's asserted and recorded.
"""

import pytest
from selenium.common.exceptions import TimeoutException

import app_pages as app
import perf


def _measure(test_id, scenario, metric, samples, threshold, results, run_once):
    """Run `run_once` `samples` times, record the warmed-up median, assert the limit."""
    times = [run_once() for _ in range(samples)]
    steady = perf.drop_warmup(times, warmup=1)
    med = perf.median(steady)
    results.add(test_id, scenario, metric, times, med, threshold)
    assert med <= threshold, (
        f"{test_id} {metric}: median {med:.3f}s exceeds the {threshold:.1f}s limit "
        f"(all runs: {[round(t, 3) for t in times]})"
    )


# PT-01 -- Login completes within an acceptable response time.
def test_pt_01_login_response_time(driver, base_url, email, password, samples, thresholds, results):
    def run_once():
        app.logout_clientside(driver, base_url)  # start each run signed out
        app.set_react_input(driver, app.EMAIL, email)
        app.set_react_input(driver, app.PASSWORD, password)
        sw = perf.start_timer()
        app.js_click(driver, app.SUBMIT)
        # Auth is "done" the moment we're redirected off the sign-in page.
        app.wait(driver).until(lambda d: "/login" not in d.current_url)
        elapsed = sw.elapsed()
        # And confirm it was a real sign-in, not a validation bounce.
        app.wait(driver).until(
            lambda d: d.find_elements(*app.NAV_SIGN_OUT)
        )
        assert "/login" not in driver.current_url, "login did not leave the sign-in page"
        return elapsed

    _measure("PT-01", "User Login", "login", samples, thresholds["login"], results, run_once)


# PT-02 -- Risk prediction is generated within an acceptable response time.
def test_pt_02_prediction_response_time(logged_in_driver, base_url, samples, thresholds, results, model_up):
    if not model_up:
        pytest.skip("Risk model service not reachable at --model-url; start it to run PT-02.")

    driver = logged_in_driver
    # Clear any throwaway months a previous (possibly failed) run left behind, so
    # the one-record-per-month rule can't reject this run with a stale-data 409.
    app.delete_months(driver, prefix="2099-")
    # A distinct throwaway month per run so repeats within this run never collide;
    # all of them are cleaned up in the finally block.
    months = [f"2099-{i + 1:02d}" for i in range(samples)]
    run_index = {"i": 0}

    def run_once():
        month = months[run_index["i"]]
        run_index["i"] += 1
        app.open_status(driver, base_url)
        app.fill_month(driver, month)
        sw = perf.start_timer()
        app.submit_score(driver)
        app.wait_saved(driver)  # green "…now scored and in your history" banner
        return sw.elapsed()

    try:
        _measure(
            "PT-02", "Financial Assessment", "predict",
            samples, thresholds["predict"], results, run_once,
        )
    finally:
        app.delete_months(driver, prefix="2099-")


# PT-03 -- Dashboard loads without noticeable delay.
def test_pt_03_dashboard_load_time(logged_in_driver, base_url, samples, thresholds, results):
    driver = logged_in_driver

    def run_once():
        sw = perf.start_timer()
        app.open_dashboard(driver, base_url)
        try:
            app.wait_dashboard_ready(driver)  # the "Risk Index / 100" gauge renders
        except TimeoutException:
            pytest.fail(
                "Dashboard never finished loading. The test account needs data — "
                "run `node scripts/seed.mjs` in frontend/ first."
            )
        return sw.elapsed()

    _measure(
        "PT-03", "Dashboard Loading", "dashboard",
        samples, thresholds["dashboard"], results, run_once,
    )


# PT-04 -- AI advisor responds within an acceptable time (when the service is available).
def test_pt_04_advisor_response_time(logged_in_driver, base_url, samples, thresholds, results):
    driver = logged_in_driver
    app.open_dashboard(driver, base_url)
    try:
        app.wait_dashboard_ready(driver)
    except TimeoutException:
        pytest.fail(
            "No dashboard/advisor to test — the test account has no data. "
            "Run `node scripts/seed.mjs` in frontend/ first."
        )
    app.wait_advisor_idle(driver)

    # A rotating set of real questions so repeated runs aren't identical.
    questions = [
        "How can I improve my cash flow?",
        "What is my biggest financial risk right now?",
        "Should I pay down debt or build up cash reserves?",
        "How is my profitability trending?",
        "What should I focus on next month?",
    ]
    run_index = {"i": 0}

    def run_once():
        question = questions[run_index["i"] % len(questions)]
        run_index["i"] += 1
        app.wait_advisor_idle(driver)
        app.set_react_input(driver, app.ADVISOR_INPUT, question)
        count_before = len(driver.find_elements(*app.ASSISTANT_BUBBLES))
        sw = perf.start_timer()
        app.js_click(driver, app.ADVISOR_SEND)
        reply = app.wait_advisor_reply(driver, count_before, timeout=90)
        elapsed = sw.elapsed()
        if "not configured" in reply.lower():
            pytest.skip("AI advisor isn't configured (no GROQ_API_KEY) — set it to run PT-04.")
        assert "couldn't respond" not in reply.lower(), "advisor returned an error, not advice"
        return elapsed

    _measure("PT-04", "AI Financial Advisor", "advice", samples, thresholds["advice"], results, run_once)


# PT-05 -- Printable reports are generated successfully without significant delay.
def test_pt_05_report_generation_time(logged_in_driver, base_url, samples, thresholds, results):
    driver = logged_in_driver
    download_dir = driver.download_dir

    app.open_dashboard(driver, base_url)
    try:
        app.wait_dashboard_ready(driver)
    except TimeoutException:
        pytest.fail(
            "No report to export — the test account has no data. "
            "Run `node scripts/seed.mjs` in frontend/ first."
        )

    def export(kind, suffix):
        def run_once():
            app.clear_downloads(download_dir)
            sw = perf.start_timer()
            app.click_export(driver, kind)
            app.wait_for_download(driver, download_dir, suffix)
            return sw.elapsed()
        return run_once

    _measure(
        "PT-05", "Report Generation", "report_csv",
        samples, thresholds["report_csv"], results, export("csv", ".csv"),
    )
    _measure(
        "PT-05", "Report Generation", "report_pdf",
        samples, thresholds["report_pdf"], results, export("pdf", ".pdf"),
    )
