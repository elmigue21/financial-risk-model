# Performance Tests — How They Work

Selenium + pytest tests that drive a real Chrome browser through the app's flows,
time each one, and fail if the median time is over a set limit. They live in
`tests/performance/`. This document is a step-by-step walkthrough of what each
test and helper does.

Covered: PT-01 Login, PT-02 Financial Assessment, PT-03 Dashboard Loading,
PT-04 AI Advisor, PT-05 Report Generation. PT-04 talks to an external AI service,
so its limit is deliberately lenient (it only catches a hang) and it skips when
the advisor isn't configured — but it still records how long the advisor took.

---

## Scenarios and limits

| ID | Flow | Timed from → to | Default limit |
| --- | --- | --- | --- |
| PT-01 | Login | click **Sign in** → redirected off `/login` | 3.0 s |
| PT-02 | Assessment | click **Save & score** → "saved" banner | 5.0 s |
| PT-03 | Dashboard | open `/` → risk gauge visible | 5.0 s |
| PT-04 | AI advisor | click **Send** → advisor's full reply appears | 60.0 s |
| PT-05 | Report (CSV) | click **Export CSV** → `.csv` in downloads | 3.0 s |
| PT-05 | Report (PDF) | click **Export PDF** → `.pdf` in downloads | 8.0 s |

Limits are overridable per metric (`--max-login`, `--max-predict`,
`--max-dashboard`, `--max-advice`, `--max-report-csv`, `--max-report-pdf`).

---

## Prerequisites

1. Build and start the app (use the built app, not the dev server — dev is
   slower and gives unrepresentative numbers):
   `cd frontend && npm run build && npm start` → `http://localhost:3000`
2. Start the risk model service (PT-02 only):
   `cd financial-risk-model && python app.py` → `http://localhost:5000`
   PT-04 additionally needs the advisor configured (a `GROQ_API_KEY` in the
   app's `.env.local`), otherwise it skips.
3. Seed the demo account (login + data for the dashboard/report):
   `cd frontend && node scripts/seed.mjs` → `demo@example.com` / `demo1234`
4. Install test deps: `pip install -r tests/performance/requirements.txt`
   (Chrome must be installed; the driver is fetched automatically.)

---

## How to run

From `tests/performance/`:

```
python run_all.py                 # run all four, print a timing summary
python run_all.py --headless      # no browser window
python run_all.py --samples 5     # more runs per test
pytest                            # plain pytest also works
pytest test_performance.py::test_pt_01_login_response_time   # one test
```

`run_all.py` runs pytest and then prints a table of each metric's median time,
its limit, and PASS/FAIL, plus total wall-clock time.

---

## How a test is structured

Every test runs its flow `--samples` times (default 3). The first run is a
warm-up and is dropped (first page hit compiles the page; first PDF export loads
its libraries). The median of the remaining runs is asserted against the limit
and recorded. Shared logic lives in `_measure(...)` in `test_performance.py`:

1. Call the flow function `samples` times, collecting elapsed seconds.
2. Drop the first sample (`perf.drop_warmup`).
3. Take the median (`perf.median`).
4. Record the row (`results.add`).
5. `assert median <= limit`.

Timing uses `perf.Stopwatch` (`time.perf_counter()`): start it right before the
action, read `.elapsed()` the moment the completion signal appears.

---

## PT-01 — Login (`test_pt_01_login_response_time`)

Uses a fresh browser (not logged in). For each run:

1. `logout_clientside` — delete cookies and load `/login` so the run starts
   signed out.
2. `set_react_input` the email and password fields (see "React inputs" below).
3. Start the stopwatch.
4. `js_click` the **Sign in** button.
5. Wait until the URL no longer contains `/login` (login succeeded) and stop the
   stopwatch — this is the measured time.
6. Wait until the nav's **Sign out** button exists, and assert we left `/login`,
   to confirm it was a real sign-in and not a validation bounce.

## PT-02 — Financial Assessment (`test_pt_02_prediction_response_time`)

Uses a logged-in browser. Skips if the model service `/health` is unreachable.

1. `delete_months("2099-")` — clear any throwaway months a previous run left, so
   the "one record per month" rule can't reject this run.
2. For each run, use a distinct future month (`2099-01`, `2099-02`, …) so repeats
   never collide.
3. `open_status` — go to `/status` and wait for the month field.
4. `fill_month` — set the month and the seven figure fields to a fixed, balanced
   dataset (assets = liabilities + equity, so the form's save button isn't
   disabled by a validation error).
5. Start the stopwatch.
6. `submit_score` — `js_click` the **Save & score this month** button.
7. `wait_saved` — wait for the green "…now scored and in your history" banner,
   then stop the stopwatch. This covers the model prediction plus saving it.
8. After all runs (in a `finally`), `delete_months("2099-")` removes the
   throwaway data.

## PT-03 — Dashboard Loading (`test_pt_03_dashboard_load_time`)

Uses a logged-in browser (the demo account has seeded months). For each run:

1. Start the stopwatch.
2. `open_dashboard` — navigate to `/`.
3. `wait_dashboard_ready` — wait for the risk gauge caption ("Risk Index / 100")
   to appear, then stop the stopwatch. That element only renders once the real
   assessment is on screen; the AI advice section fills in later and is not
   waited on.

If the gauge never appears the test fails with a hint to seed the demo account.

## PT-04 — AI Advisor (`test_pt_04_advisor_response_time`)

Uses a logged-in browser on the dashboard. Requires the advisor to be configured
(a `GROQ_API_KEY` in the app's environment); if it isn't, the test skips. For
each run:

1. `wait_advisor_idle` — wait until the advisor chat input is enabled (it's
   disabled while a reply is streaming).
2. `set_react_input` a question into the chat box (a rotating list, so repeats
   aren't identical).
3. Record how many advisor (assistant) message bubbles exist.
4. Start the stopwatch.
5. `js_click` the **Send** button.
6. `wait_advisor_reply` — wait until a new advisor bubble has appeared, the input
   is enabled again (streaming finished), and the bubble has text; then stop the
   stopwatch. That's the full round-trip to the AI service.
7. If the reply is the "not configured" message, skip; if it's the error
   fallback, fail.

Notes: the measured time is the real round-trip to the AI service and varies a
lot — on the free tier, several advice calls in a row get rate-limited and can
each take tens of seconds, which is why the limit is a lenient 60 s. Also, each
reply is saved to the demo account's latest month (the app persists the
conversation), so PT-04 adds a few messages there; re-run `node scripts/seed.mjs`
to reset the demo data if you want a clean thread.

## PT-05 — Report Generation (`test_pt_05_report_generation_time`)

Uses a logged-in browser on the dashboard. Runs the CSV export, then the PDF
export, each measured separately. For each run:

1. `clear_downloads` — empty the browser's download folder.
2. Start the stopwatch.
3. `click_export("csv")` / `click_export("pdf")` — click the export button.
4. `wait_for_download` — poll the download folder until a finished file with the
   right extension appears (a file without Chrome's `.crdownload` suffix), then
   stop the stopwatch.

The PDF gets a larger limit because it does more work (it rasterizes the report
and builds a document). Chrome is configured to download files silently and to
allow several downloads in a row.

---

## Helpers and fixtures

**`app_pages.py`** — the page object: locator constants plus `driver`-first
functions. Notable pieces:

- `set_react_input(driver, locator, value)` — the app is React, and typing with
  `send_keys` can be dropped by controlled inputs. This sets the value through
  the browser's native value setter and fires an `input` event so React sees it.
- `js_click(driver, locator)` — clicks via JavaScript to avoid React click
  no-ops.
- `login` / `logout_clientside` — sign in and wait for the nav; or drop the
  cookie and return to `/login`.
- `open_status` / `fill_month` / `submit_score` / `wait_saved` — the assessment
  flow.
- `open_dashboard` / `wait_dashboard_ready` — the dashboard flow.
- `click_export` / `clear_downloads` / `wait_for_download` — the report flow.
- `wait_advisor_idle` / `wait_advisor_reply` — the advisor flow: wait until the
  chat input is enabled, and wait until a new reply has fully streamed in.
- `delete_months(driver, prefix)` — runs a `fetch` inside the browser (reusing
  the session cookie) to delete the signed-in user's records whose month starts
  with `prefix`; used to clean up PT-02's throwaway data.

**`conftest.py`** — command-line options and fixtures:

- Options: `--headless`, `--base-url`, `--model-url`, `--email`, `--password`,
  `--samples`, and the `--max-*` limit overrides.
- `driver` — a fresh headless-capable Chrome per test, with download settings
  pointed at a per-test temp folder.
- `logged_in_driver` — a `driver` already signed in as the test account.
- `thresholds` — the limits dict, with any `--max-*` overrides applied.
- `model_up` — True if the model service answers `/health` (PT-02 skips if not).
- `results` — collects one row per metric and writes the results files at the
  end of the session.

**`perf.py`** — `Stopwatch`, `drop_warmup`, `median`, the default limits, and the
`Results` writer.

---

## Results output

Two files are written to `tests/performance/results/` (git-ignored):

- `performance_results.md` — readable table: test, scenario, metric, median,
  fastest, slowest, limit, PASS/FAIL.
- `performance_results.tsv` — same data, tab-separated, for spreadsheets.

`run_all.py` also prints a summary table and the total run time to the terminal.
