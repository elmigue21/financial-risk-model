# Integration Tests — How They Work

Integration tests prove that **separate components work together** — the frontend
with the database, the frontend with the model service, and the pages with the
stored data. Unlike unit tests, these drive a real Chrome browser and hit the
running app. This document is a step-by-step walkthrough of each one.

Covered: **IT-01** auth + database, **IT-02** prediction service, **IT-03**
dashboard/history read-back. IT-04 (AI advisor) and IT-05 (report) are verified
manually because they depend on an external AI service.

---

## Scenarios

| ID | What it proves | Components wired together |
| --- | --- | --- |
| IT-01 | An account can be created, stored, and read back | Frontend ↔ Auth ↔ Database |
| IT-02 | Submitting figures reaches the model and the score is shown | Frontend ↔ Flask model service |
| IT-03 | Saved assessments are read back onto the dashboard and history | Frontend ↔ Database |

---

## Prerequisites

1. **App running** at `--base-url` (built, not dev):
   `cd frontend && npm run build && npm start` → `http://localhost:3000`
2. **Model service** at `--model-url` (IT-02 only):
   `cd financial-risk-model && python app.py` → `http://localhost:5000`
3. **Seeded demo account** (for IT-03): `cd frontend && node scripts/seed.mjs`
   → `demo@example.com` / `demo1234`
4. Install test deps: `pip install -r tests/integration/requirements.txt`
   (Chrome must be installed; the driver is fetched automatically.)

---

## How to run

From `tests/integration/`:

```
pytest                         # run all three
pytest --headless              # no browser window
pytest test_integration.py::test_it_01_auth_and_database   # one test
```

Options (from `conftest.py`): `--base-url`, `--model-url`, `--email`,
`--password`, `--headless`.

Fixtures: `driver` (a fresh Chrome per test), `logged_in_driver` (a `driver`
already signed in as the demo account), `model_up` (True if the model service
answers `/health` — IT-02 skips if not).

---

## IT-01 — Authentication + database (`test_it_01_auth_and_database`)

**What it proves:** a brand-new account is really written to the database and can
be read back — the full register → logout → login → read-profile loop.

Uses a fresh browser and a **unique random email** each run (so re-runs never
collide).

1. **Register** — go to `/register`, fill in name, the unique email, and a
   password, and submit. This writes the new user to the database and signs in.
2. **Log out** — click the nav's **Sign out**; wait until we're back on `/login`.
3. **Log back in** — sign in again with the *same* credentials. This can only
   succeed if the account was actually persisted (it reads the database).
4. **Read the stored profile** — open `/profile` and read the name and email
   fields.
5. **Assert** — the stored name and email match exactly what was registered.
   Proves the round-trip write-then-read worked.

---

## IT-02 — Prediction service integration (`test_it_02_prediction_service`)

**What it proves:** when the user submits financial data, the request actually
reaches the Flask model service, and the score it returns is displayed by the
app. **Skips** if the model service isn't reachable (`model_up` is False).

Uses a logged-in browser and a throwaway future month (`2097-01`).

1. **Clean up first** — `delete_months("2097-")` removes any leftover throwaway
   months from a previous run (the app allows one record per month).
2. **Open the assessment form** — go to `/status` and wait for the month field.
3. **Fill the month** — set month `2097-01` and the seven dollar figures to a
   fixed, balanced dataset (so the form's balance check passes).
4. **Submit** — click **Save & score this month**.
5. **Wait for the "saved" banner** — this banner only appears *after*
   `/api/predict` returns successfully (a failed prediction shows an error banner
   instead). So reaching it already proves the Flask service responded.
6. **Check the result is displayed** — open the dashboard, wait for it to be
   ready, and read the risk-index value. Assert it's a **number**, and assert the
   Trouble Risk card is present. Proves the returned assessment made it to screen.
7. **Clean up (always)** — in a `finally`, `delete_months("2097-")` removes the
   throwaway data whether the test passed or failed.

---

## IT-03 — Dashboard/history read from the database (`test_it_03_dashboard_and_database`)

**What it proves:** assessments saved earlier are read back out of the database
and shown on both the dashboard and the history page. Relies on the **seeded demo
account** having months.

Uses a logged-in browser.

1. **Open the dashboard** — go to `/`.
2. **Wait for it to be ready** — wait for the risk-gauge caption
   ("Risk Index / 100"), which only renders once a real saved assessment is on
   screen. If it never appears, the test fails with a hint to run the seed script.
3. **Assert the dashboard shows saved data** — the ready element is present.
4. **Open the history page** — go to `/history`.
5. **Assert the history table has rows** — the saved assessments were retrieved
   and listed (at least one row).

---

## Not automated here

- **IT-04 (AI advisor integration)** and **IT-05 (report integration)** depend on
  the external AI service and are verified manually. The advisor's live
  round-trip is exercised by **PT-04** in the performance suite, and report
  generation by **ST-08** in the system suite.

---

## Files

- `tests/integration/test_integration.py` — the three tests above.
- `tests/integration/app_pages.py` — the page object: locator constants plus
  `driver`-first helper functions (`register`, `login`, `logout`, `open_status`,
  `fill_month`, `submit_score`, `wait_saved`, `open_dashboard`, `open_profile`,
  `open_history`, `delete_months`).
- `tests/integration/conftest.py` — command-line options and the `driver`,
  `logged_in_driver`, and `model_up` fixtures.
