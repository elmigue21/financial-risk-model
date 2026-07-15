# Unit Tests — How They Work

Unit tests check **one function at a time**, in isolation — no browser, no
network, no database. They're the fastest tests: they call a function with known
inputs and assert on the returned value. This document is a step-by-step
walkthrough of each unit test.

Covered: **UT-02** input validation, **UT-03** ratio computation (both
TypeScript, run with Vitest), and **UT-04** risk prediction (Python, run with
pytest — calls the trained model directly).

---

## Scenarios

| ID | What it tests | Function under test | Language / runner |
| --- | --- | --- | --- |
| UT-02 | Financial input validation | `validateFigures`, `hasBlockingErrors` | TypeScript / Vitest |
| UT-03 | Financial ratio computation | `computeRatios` | TypeScript / Vitest |
| UT-04 | Risk prediction output | `predict` (the model service) | Python / pytest |

---

## Prerequisites

- **UT-02, UT-03** (frontend): Node.js 18+ and `npm install` in `frontend/`.
- **UT-04** (model): a Python with the model service's deps installed
  (`pip install -r financial-risk-model/requirements.txt`). If those aren't
  installed, UT-04 **skips itself** with a hint instead of failing.

---

## How to run

```
# UT-02 and UT-03 (frontend, from frontend/)
npm test                       # runs all Vitest unit tests
npm test -- ratios             # just the ratio tests

# UT-04 (model, from tests/unit/)
pytest                         # runs the prediction tests
```

---

## UT-02 — Financial input validation (`validation.test.ts`)

**What it proves:** the form's validation accepts sensible numbers, blocks
impossible ones, and only *warns* (doesn't block) on likely typos. It calls the
real `validateFigures` from `app/lib/monthly.ts`.

Each test starts from one **valid, balanced month** (assets = liabilities +
equity) and changes one field to create the case being tested.

1. **Accepts a valid month** — feed the balanced figures in, check
   `hasBlockingErrors` is `false` (nothing blocks saving).
2. **Rejects negative revenue** — set revenue to `-1`, check there's a blocking
   error whose message mentions "Revenue" and "negative".
3. **Rejects an unbalanced balance sheet** — set equity so assets ≠ liabilities +
   equity, check there's a blocking "Balance sheet" error.
4. **Rejects cash greater than total assets** — a part can't exceed the whole;
   check the error mentions "Cash" and "assets".
5. **Rejects interest greater than expenses** — interest is part of expenses;
   check the error mentions "Interest" and "expenses".
6. **Allows negative equity** — insolvency is a real situation, not a typo. Keep
   the sheet balanced with negative equity and check there's **no** "negative"
   error and nothing blocks saving.
7. **Zero-revenue month is a warning, not an error** — a blank month shouldn't be
   impossible; check it produces a warning but `hasBlockingErrors` stays `false`.

> Takeaway: **errors block saving; warnings just flag.** The test pins down
> exactly which cases are which.

---

## UT-03 — Financial ratio computation (`ratios.test.ts`)

**What it proves:** the dollar figures a user types are correctly turned into the
four ratios the model consumes. It calls the real `computeRatios` from
`app/lib/monthly.ts`.

The base month is: revenue 100k, expenses 80k, interest 5k, assets 200k,
liabilities 120k → so **net profit = 20k** and **operating profit (EBIT) = 25k**.

1. **Computes the four ratios** — check each formula produces the exact number:
   - Return on assets = 20k / 200k × 100 = **10%**
   - Profit margin = 20k / 100k × 100 = **20%**
   - Interest coverage = 25k / 5k = **5×**
   - Debt ratio = 120k / 200k × 100 = **60%**
2. **Caps interest coverage when there's no interest** — set interest to 0; you
   can't divide by zero, so coverage is capped at **999** (effectively
   "unlimited").
3. **Skips asset-based ratios when assets are 0** — no divide-by-zero: return on
   assets and debt ratio come back `undefined`.
4. **Skips profit margin when revenue is 0** — same idea for the revenue-based
   ratio.
5. **Rounds to two decimals** — with assets = 300k, ROA = 6.666… → checks it's
   rounded to **6.67**.
6. **Reflects a loss correctly** — with expenses above revenue, check the profit
   margin, return on assets, and interest coverage all come back **negative**.

> Takeaway: this is the "dollars → ratios" step of the pipeline, proven number by
> number, including the edge cases (no interest, no assets, a loss).

---

## UT-04 — Risk prediction (`test_prediction.py`)

**What it proves:** the trained model, called directly, returns a well-formed
risk assessment and behaves sensibly. It imports `predict` straight from the
model service (`financial-risk-model/app.py`) — **no HTTP, no browser** — so it
tests the model logic itself. The inputs are the four ratios the frontend sends.

A shared fixture (`predict_fn`) loads the model once. If the model's Python deps
aren't installed, every UT-04 test **skips** with a hint instead of erroring.

1. **Returns the expected shape** — call `predict` with a normal set of ratios;
   check the result has `probability`, `risk_level`, `confidence`, and
   `contributions`.
2. **Probability is a real number in [0, 1]** — it's a probability, so it must be
   a float between 0 and 1.
3. **Risk level is one of the three bands** — check it's exactly one of
   `LOW_RISK`, `MEDIUM_RISK`, `HIGH_RISK`.
4. **Confidence is in range** — check it's a number between 0 and 1.
5. **Risk level matches the probability thresholds** — re-apply the model's own
   cutoffs (≥ 0.038 → HIGH, ≥ 0.023 → MEDIUM, else LOW) and check the label
   agrees with the probability. Proves the label and the number never disagree.
6. **Weaker financials are not less risky** — score a deliberately *strong*
   company and a deliberately *weak* one, and check the weak one's probability is
   **≥** the strong one's. This is the sanity check that the model points the
   right way (monotonicity).
7. **Contributions are present** — check the per-feature contributions list is
   non-empty and at least one is marked as a real scored driver. Proves the
   explainability data (the "Top Risk Factors") is produced.

> Takeaway: UT-04 doesn't hard-code an expected probability (that would be
> brittle) — it checks the output is **well-formed, self-consistent, and ordered
> the right way.**

---

## Files

- `frontend/tests/unit/validation.test.ts` — UT-02
- `frontend/tests/unit/ratios.test.ts` — UT-03
- `tests/unit/test_prediction.py` — UT-04
- `tests/unit/conftest.py` — the `predict_fn` fixture that loads the model and
  skips gracefully if its deps are missing.
