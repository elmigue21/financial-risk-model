# System Tests — How They Work

System tests drive a **real Chrome browser** through every feature of the app,
exactly like a user would: they navigate to pages, type into fields, click
buttons, and read what's on screen. Each one is a functional pass/fail check of a
whole feature end to end. This document is a step-by-step walkthrough of each test.

Covered: **ST-01** registration, **ST-02** login/logout, **ST-03** data entry,
**ST-04** risk assessment, **ST-05** dashboard, **ST-07** history, **ST-08**
report printing, **ST-09** profile update, **ST-10** access control. ST-06 (AI
advisor) isn't automated here because it depends on an external AI service — its
response is exercised by **PT-04** in the performance suite instead.

---

## Scenarios

| ID | Feature | In one line |
| --- | --- | --- |
| ST-01 | User registration | Create a new account and land signed in |
| ST-02 | Login & logout | Sign in creates a session; sign out ends it |
| ST-03 | Financial data entry | A month of figures is validated and saved |
| ST-04 | Risk assessment | Score, trouble risk, and confidence are shown |
| ST-05 | Dashboard | Heading, risk gauge, and charts all render |
| ST-07 | Assessment history | Past assessments are listed |
| ST-08 | Report printing | A PDF report is generated and downloaded |
| ST-09 | Profile update | A profile change is saved and confirmed |
| ST-10 | Access control | Unauthenticated users are redirected to login |

---

## Prerequisites

1. **App running** at `--base-url` (built, not dev):
   `cd frontend && npm run build && npm start` → `http://localhost:3000`
2. **Model service** on `:5000` (for ST-03/ST-04):
   `cd financial-risk-model && python app.py`
3. **Seeded demo account** (most tests log into it and read its data):
   `cd frontend && node scripts/seed.mjs` → `demo@example.com` / `demo1234`
4. Install test deps: `pip install -r tests/system/requirements.txt`
   (Chrome must be installed; the driver is fetched automatically.)

---

## How to run

From `tests/system/`:

```
pytest                         # run all system tests
pytest --headless              # no browser window
pytest test_system.py::test_st_01_user_registration   # one test
```

Options (from `conftest.py`): `--base-url`, `--email`, `--password`,
`--headless`. Fixtures: `driver` (fresh Chrome per test, downloads pointed at a
per-test temp folder), `logged_in_driver` (a `driver` already signed in).

---

## A note on how these tests click and type

The app is React, so two low-level helpers are used everywhere (in `app_pages.py`):

- **`set_react_input`** — sets a field's value through the browser's native value
  setter and fires an `input` event, so React reliably "sees" the change
  (plain typing can get dropped by controlled inputs).
- **`js_click`** — clicks via JavaScript, to avoid React click no-ops.

---

## ST-01 — User registration (`test_st_01_user_registration`)

Uses a fresh browser and a **unique random email** so re-runs never collide.

1. Go to `/register`, fill name, email, password, and confirm-password.
2. Click submit.
3. Wait until we're no longer on `/register`.
4. **Assert** we left `/register` **and** the nav's **Sign out** button exists —
   i.e. registration signed us straight in.

## ST-02 — Login & logout (`test_st_02_login_and_logout`)

1. Log in with the demo credentials.
2. **Assert** the **Sign out** button is present and we left `/login` — a session
   was established.
3. Click **Sign out**.
4. **Assert** we're back on `/login`.
5. Try to open the dashboard (`/`) and **assert** it bounces back to `/login` —
   proving the session was really destroyed, not just visually hidden.

## ST-03 — Financial data entry (`test_st_03_financial_data_entry`)

Uses a logged-in browser and a throwaway month (`2098-01`).

1. `delete_months("2098-")` — clear any leftover throwaway months first.
2. Open `/status` and wait for the month field.
3. Fill the month and the seven dollar figures with a balanced dataset.
4. Click **Save & score this month**.
5. Wait for the "…now scored and in your history" banner.
6. **Assert** the banner is present — the month was validated and accepted.
7. In a `finally`, `delete_months("2098-")` cleans up the throwaway data.

## ST-04 — Risk assessment (`test_st_04_financial_risk_assessment`)

Uses a logged-in browser reading the seeded demo data.

1. Open the dashboard and wait for it to be ready (fails with a seed hint if
   there's no data).
2. **Assert** all three headline cards are shown: **Health Score**,
   **Trouble Risk**, and **Model Confidence** — the full assessment rendered.

## ST-05 — Dashboard (`test_st_05_dashboard`)

1. Open the dashboard and wait for it to be ready.
2. **Assert** the dashboard heading is present.
3. **Assert** the risk gauge is present.
4. **Assert** at least one `<svg>` is on the page — i.e. the charts/indicators
   actually rendered (matched by local name because SVG has its own namespace).

## ST-07 — Assessment history (`test_st_07_assessment_history`)

1. Open `/history`.
2. **Assert** the history heading is present.
3. **Assert** the table has at least one row — the seeded account's past
   assessments are listed.

## ST-08 — Report printing (`test_st_08_report_printing`)

Printing can't be observed in a headless browser, so this verifies the
**printable document itself** is produced.

1. Open the dashboard and wait for it to be ready.
2. `clear_downloads` — empty the browser's download folder.
3. Click **Export PDF**.
4. `wait_for_download` — poll the download folder until a finished `.pdf` file
   appears (one without Chrome's `.crdownload` in-progress suffix).
5. **Assert** the PDF exists and is non-empty — a real report was generated.

## ST-09 — Profile update (`test_st_09_user_profile`)

Changes the profile, confirms the save, then **restores the original** so the
demo account is left unchanged.

1. Open `/profile` and remember the current name.
2. Set the name to a new value and click **Save changes**.
3. Wait for the "Profile saved" confirmation.
4. **Assert** the confirmation appeared.
5. In a `finally`, set the name back to the original and save again.

## ST-10 — Access control (`test_st_10_access_control`)

A parameterized test — it runs once for each protected path: `/`, `/history`,
`/profile`, `/status`.

1. Using a fresh browser that has **never logged in**, go straight to the
   protected path.
2. Wait until the URL becomes `/login`.
3. **Assert** we ended up on `/login` — the page was not reachable without
   authenticating.

---

## Not automated here

- **ST-06 (AI advisor)** depends on the external AI service, so it isn't a
  pass/fail system test. Its real round-trip is measured by **PT-04** in the
  performance suite.

---

## Files

- `tests/system/test_system.py` — the tests above.
- `tests/system/app_pages.py` — the page object: locator constants plus
  `driver`-first helpers (`register`, `login`, `logout`, `open_status`,
  `fill_month`, `submit_score`, `wait_saved`, `open_dashboard`,
  `wait_dashboard_ready`, `open_history`, `open_profile`, `click_export`,
  `clear_downloads`, `wait_for_download`, `delete_months`), plus the React-safe
  `set_react_input` / `js_click` primitives.
- `tests/system/conftest.py` — command-line options and the `driver` /
  `logged_in_driver` fixtures.
