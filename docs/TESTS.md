# Test Suites — Overview

The Financial Health Check app is covered by four kinds of tests. Each one lives
in its own folder under `tests/` and has its own step-by-step walkthrough doc.

| Layer | What it proves | IDs | Doc |
| --- | --- | --- | --- |
| **Unit** | Individual functions are correct in isolation (no browser, no server) | UT-02, UT-03, UT-04 | [UNIT_TESTS.md](UNIT_TESTS.md) |
| **Integration** | Components work together — frontend ↔ database ↔ model service | IT-01 … IT-03 | [INTEGRATION_TESTS.md](INTEGRATION_TESTS.md) |
| **System** | Every feature works end to end in a real browser | ST-01 … ST-10 | [SYSTEM_TESTS.md](SYSTEM_TESTS.md) |
| **Performance** | Each flow finishes under a time limit | PT-01 … PT-05 | [PERFORMANCE_TESTS.md](PERFORMANCE_TESTS.md) |

---

## The testing pyramid (how to explain it in one breath)

```
        ▲  fewer, slower, more realistic
        │      ┌───────────────┐
        │      │  Performance   │   is it fast enough?
        │      ├───────────────┤
        │      │    System      │   does the whole feature work in a browser?
        │      ├───────────────┤
        │      │  Integration   │   do the parts talk to each other?
        │      ├───────────────┤
        │      │     Unit        │   is each function correct on its own?
        │      └───────────────┘
        ▼  more, faster, more isolated
```

- **Unit** tests are the fastest and most numerous — they call one function
  directly and check the answer. No browser, no network.
- **Integration** tests wire two or more real components together (e.g. the app
  and the database) and prove data flows correctly between them.
- **System** tests drive a real Chrome browser through the app exactly like a
  user would — click, type, read the screen.
- **Performance** tests do the same as system tests but also **time** each flow
  and fail if it's too slow.

---

## Running everything

From `tests/`:

```
python run_all_tests.py               # run every suite in turn
python run_all_tests.py --headless    # no browser windows (for the browser suites)
```

`run_all_tests.py` finds each subfolder that contains `test_*.py`, runs it as its
own pytest session (so each keeps its own fixtures and options), prints a
PASS/FAIL summary per suite, and exits non-zero if any suite failed. If a suite
recorded timings (the performance suite), it also prints that timing table.

> The frontend unit tests (UT-02, UT-03) are JavaScript/TypeScript and run with
> `npm test` (Vitest), not pytest — see [UNIT_TESTS.md](UNIT_TESTS.md).

---

## What is tested where (and what is manual)

| ID | Feature | Automated? | Notes |
| --- | --- | --- | --- |
| UT-02 | Input validation | ✅ Vitest | pure function |
| UT-03 | Ratio computation | ✅ Vitest | pure function |
| UT-04 | Risk prediction | ✅ pytest | calls the model directly |
| IT-01 | Auth + database | ✅ Selenium | |
| IT-02 | Prediction service | ✅ Selenium | skips if model service is down |
| IT-03 | Dashboard/history read | ✅ Selenium | |
| IT-04 | AI advisor integration | ⚠️ manual | external AI service |
| IT-05 | Report integration | ⚠️ manual | |
| ST-01 … ST-05, ST-07 … ST-10 | Each feature end to end | ✅ Selenium | |
| ST-06 | AI advisor | ⚠️ covered by PT-04 | external AI service |
| PT-01 … PT-05 | Response times | ✅ Selenium | see performance doc |
