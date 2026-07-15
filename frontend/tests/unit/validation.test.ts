import { describe, it, expect } from "vitest";
import {
  validateFigures,
  hasBlockingErrors,
  type MonthlyFigures,
} from "../../app/lib/monthly";

/**
 * UT-02 — Financial input validation.
 * Exercises the real validateFigures/hasBlockingErrors from app/lib/monthly.ts:
 * valid figures are accepted; impossible/inconsistent ones are rejected as
 * blocking errors; likely-typo cases are warnings that don't block saving.
 */

// A valid, internally consistent month (assets = liabilities + equity).
const valid: MonthlyFigures = {
  revenue: 100000,
  expenses: 80000,
  interest: 5000,
  cash: 40000,
  assets: 200000,
  liabilities: 120000,
  equity: 80000,
};

const errorMessages = (f: MonthlyFigures) =>
  validateFigures(f)
    .filter((i) => i.severity === "error")
    .map((i) => i.message);

describe("UT-02 Financial input validation (validateFigures)", () => {
  it("accepts a valid, balanced month (no blocking errors)", () => {
    expect(hasBlockingErrors(validateFigures(valid))).toBe(false);
  });

  it("rejects negative revenue", () => {
    const f = { ...valid, revenue: -1 };
    expect(hasBlockingErrors(validateFigures(f))).toBe(true);
    expect(errorMessages(f).some((m) => m.includes("Revenue") && m.includes("negative"))).toBe(true);
  });

  it("rejects an unbalanced balance sheet (assets ≠ liabilities + equity)", () => {
    const f = { ...valid, equity: 50000 }; // 120000 + 50000 = 170000 ≠ 200000
    expect(hasBlockingErrors(validateFigures(f))).toBe(true);
    expect(errorMessages(f).some((m) => m.includes("Balance sheet"))).toBe(true);
  });

  it("rejects cash greater than total assets", () => {
    const f = { ...valid, cash: 250000 };
    expect(errorMessages(f).some((m) => m.includes("Cash") && m.includes("assets"))).toBe(true);
  });

  it("rejects interest greater than total expenses", () => {
    const f = { ...valid, interest: 90000 };
    expect(errorMessages(f).some((m) => m.includes("Interest") && m.includes("expenses"))).toBe(true);
  });

  it("allows negative equity (insolvency is a valid input, not an error)", () => {
    // Keep the sheet balanced: assets = liabilities + equity = 220000 + (-20000).
    const f = { ...valid, equity: -20000, liabilities: 220000 };
    expect(errorMessages(f).some((m) => m.includes("negative"))).toBe(false);
    expect(hasBlockingErrors(validateFigures(f))).toBe(false);
  });

  it("treats a zero-revenue month as a warning, not a blocking error", () => {
    const f = { ...valid, revenue: 0, expenses: 0, interest: 0 };
    const issues = validateFigures(f);
    expect(hasBlockingErrors(issues)).toBe(false);
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });
});
