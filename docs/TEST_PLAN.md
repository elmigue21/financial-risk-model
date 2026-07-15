# Test Plan — Manual Test Cases & Automated Integration Tests

This document defines how the Financial Health Check System will be tested. The primary
approach is **manual testing** of the user-facing functionality (Part 1). **Automated
testing is focused on integration tests** — the API routes, data-layer ownership rules,
and the model service — where inputs and outputs are well-defined and expensive to verify
by hand repeatedly (Part 2).

**Test account (seeded):** `demo@example.com` / `demo1234` — 7 months of data.
**Status column:** leave blank during planning; mark **Pass / Fail** during execution.

---

# Part 1 — Manual Test Cases

## 1.1 User Registration

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-REG-01 | Valid registration | 1) Open app; 2) click "Create an account"; 3) enter valid name, unique email, matching passwords (8+ chars, letter + number); 4) submit | Account created; user signed in automatically and taken to the dashboard | |
| TC-REG-02 | Missing required field | Leave the full name (or email) blank and submit | Inline error (e.g. "Full name is required."); no account created | |
| TC-REG-03 | Invalid email format | Enter `notanemail` and submit | Error "Enter a valid email address." | |
| TC-REG-04 | Weak password | Enter a password under 8 chars or with no number | Error "Password must be at least 8 characters." / "…include at least one letter and one number." | |
| TC-REG-05 | Passwords don't match | Enter different password and confirm | Error "Passwords do not match." | |
| TC-REG-06 | Duplicate email | Register with an email that already exists | Error "An account with that email already exists." (409) | |

## 1.2 User Login

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-LOG-01 | Valid login | Enter correct email + password; submit | Redirected to the dashboard | |
| TC-LOG-02 | Wrong password | Correct email, wrong password | Error "Incorrect email or password." | |
| TC-LOG-03 | Unknown email | Email that isn't registered | **Same** generic error "Incorrect email or password." (no account disclosure) | |
| TC-LOG-04 | Empty fields | Submit with blank email/password | Prompted to enter email and password | |

## 1.3 Logout & Session

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-SES-01 | Logout | While signed in, click "Sign out" | Returned to `/login`; session ended | |
| TC-SES-02 | Protected page while signed out | Visit `/`, `/status`, `/history`, or `/profile` while signed out | Redirected to `/login` | |
| TC-SES-03 | Auth page while signed in | Visit `/login` or `/register` while signed in | Redirected to the dashboard | |
| TC-SES-04 | Sign out then sign back in | Sign out, then sign in again | Sign-out button reads "Sign out" (not stuck on "Signing out…") | |

## 1.4 Profile & Password

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-PRF-01 | View profile | Open the Account tab | Shows current full name and email | |
| TC-PRF-02 | Update profile | Change name/email; save | "Profile saved."; nav greeting updates | |
| TC-PRF-03 | Email already in use | Change email to another account's email | Error "That email is already in use by another account." | |
| TC-PRF-04 | Wrong current password | Enter wrong current password on change | Error "Your current password is incorrect."; nothing changes | |
| TC-PRF-05 | Change password | Enter correct current + valid matching new password | "Password changed."; sign out and log in with the new password succeeds | |

## 1.5 Financial Data Entry & Validation

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-FIN-01 | Valid month saved | Enter a valid month's figures (balanced); click "Save & score this month" | Month scored and saved; appears in "Your months" and on the dashboard | |
| TC-FIN-02 | Balance sheet mismatch | Enter assets ≠ liabilities + equity | Error blocks saving ("Balance sheet doesn't add up…") | |
| TC-FIN-03 | Negative value | Enter a negative revenue/expense/asset | Error "…can't be negative."; save blocked | |
| TC-FIN-04 | Cash exceeds assets | Enter cash greater than total assets | Error "Cash can't be more than total assets."; save blocked | |
| TC-FIN-05 | Duplicate month | Save a month that already exists | Error "You already have data for this month. Delete it first to re-enter." (409) | |
| TC-FIN-06 | Warning (non-blocking) | Enter 0 revenue (or unusually high margin) | Warning shown; saving is still allowed | |
| TC-FIN-07 | Live derived values | Type figures | Net profit and balance-check update live before saving | |

## 1.6 Dashboard & Assessment

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-DSH-01 | Summary cards | Open the dashboard | Shows Health Score, Trouble Risk, Status, **Model Confidence %**, and Last Assessment | |
| TC-DSH-02 | Ratio breakdown | View ratio grid | Each ratio shows value + status (Healthy/Weak/Tight/Poor/Critical) | |
| TC-DSH-03 | Top risk factors | View risk factors | Weakest ratios listed as the biggest drivers | |
| TC-DSH-04 | AI advisor | With `GROQ_API_KEY` set, load dashboard | Opening assessment + suggested questions appear; without a key, the advisor is gracefully disabled and scoring still works | |
| TC-DSH-05 | Trends | View trends section with multiple months | Chart shows month-over-month movement | |

## 1.7 History & Report Export

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-HIS-01 | History list | Open the History tab | All of the user's months listed, newest first | |
| TC-HIS-02 | Open a report | Click a month | Full report opens (figures, ratios, risk factors, insights, advisor thread) | |
| TC-HIS-03 | Export PDF | Click "Export PDF" on a report | A PDF file downloads containing the report | |
| TC-HIS-04 | Export CSV | Click "Export CSV" | A CSV file downloads (opens in Excel) | |
| TC-HIS-05 | Delete a month | Delete a saved month | Month removed from the list and dashboard | |

## 1.8 Confidentiality (per-user isolation)

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-CNF-01 | Separate histories | Sign in as a second, empty account | History is empty — none of the first user's months are visible | |
| TC-CNF-02 | No cross-user access | While signed in as user B, try to open a report id belonging to user A | Not found / no access (record is not returned) | |

## 1.9 Non-Functional (manual observation)

| ID | Test Scenario | Steps | Expected Result | Status |
| --- | --- | --- | --- | --- |
| TC-NFR-01 | Auth performance | Time a login | Completes within ~3 seconds | |
| TC-NFR-02 | Model unavailable | Stop the Python service, then save a month | Clear error: "Could not reach the model service. Is it running?" | |
| TC-NFR-03 | Password storage | Inspect the `users` table | Passwords are stored hashed, never in plain text | |

---

# Part 2 — Automated Integration Tests

These have clear inputs/outputs and per-user rules that are tedious and error-prone to
re-check by hand, so they are the best candidates for automation. Recommended stack:
a Node test runner (e.g. **Vitest/Jest** + **supertest**) against a temporary SQLite
database, and **pytest** for the model service.

## 2.1 API — Authentication & Profile

| Area | Cases to automate |
| --- | --- |
| `POST /api/auth/register` | 201 + Set-Cookie on valid; 400 on validation; 409 on duplicate email (case-insensitive) |
| `POST /api/auth/login` | 200 + cookie on valid; 401 generic on wrong password **and** unknown email |
| `POST /api/auth/logout` | 200 + session cookie cleared |
| `GET/PATCH /api/profile` | 401 when unauthenticated; update succeeds; 409 on email taken by another user |
| `PATCH /api/profile/password` | 400 on wrong current password; success then login with new password |

## 2.2 API — History & Ownership (highest value)

| Area | Cases to automate |
| --- | --- |
| `GET/POST /api/history` | returns only the caller's rows; 401 unauthenticated; 409 duplicate month |
| `GET/PATCH/DELETE /api/history/[id]` | owner succeeds; **another user → 404**; bad id → 400 |
| `middleware.ts` | unauthenticated `/api/*` → 401; unauthenticated page → redirect to `/login` |

## 2.3 Data Layer — `app/lib/db.ts` (temp SQLite)

| Area | Cases to automate |
| --- | --- |
| User CRUD | duplicate email throws; lookup by email/id; profile & password update |
| Prediction scoping | `getPrediction`/`updatePrediction`/`deletePrediction` succeed for owner and **fail for non-owner**; `listPredictions`/`listMonths` return only the user's rows; per-user month uniqueness |

## 2.4 Model Service — `financial-risk-model/app.py` (pytest)

| Area | Cases to automate |
| --- | --- |
| `predict(inputs)` | risk-level thresholds at the boundaries (< 0.023 LOW, 0.023–0.038 MEDIUM, ≥ 0.038 HIGH); only the 4 user features flagged as scored drivers; hardcoded defaults applied |
| `binned_runscoring` | correct bin rate; missing/`NM` handling |
| `GET /health`, `POST /predict` | health returns ok; blank/invalid inputs coerced to None |

## 2.5 Optional — pure unit tests (cheap, high value)

Although the plan is manual-first, these pure functions are trivial to automate if time
allows and would guard the core math: `computeRatios`, `riskIndex`, `indexBand`,
`classifyRatio` (in `app/lib/`), and the validators in `app/lib/user.ts`.

---

## Execution notes

- Run manual test cases against the seeded demo account plus at least one freshly
  registered account (for the confidentiality cases, TC-CNF-01/02).
- Record Actual Result and Pass/Fail per row; attach screenshots for defects.
- Re-run the affected manual cases after any fix; keep the automated integration suite
  green in CI on every change.
