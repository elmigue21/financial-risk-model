import { describe, it, expect } from "vitest";
import { computeRatios, type MonthlyFigures } from "../../app/lib/monthly";

/**
 * UT-03 — Financial ratio computation.
 * Exercises the real computeRatios from app/lib/monthly.ts: the dollar figures a
 * user enters are turned into the four ratios the model consumes.
 */

const base: MonthlyFigures = {
  revenue: 100000,
  expenses: 80000,
  interest: 5000,
  cash: 40000,
  assets: 200000,
  liabilities: 120000,
  equity: 80000,
};

describe("UT-03 Financial ratio computation (computeRatios)", () => {
  it("computes the four model ratios from the dollar figures", () => {
    // net profit = 20000, operating profit (EBIT) = 25000.
    const r = computeRatios(base);
    expect(r.return_on_assets).toBe(10); //  20000 / 200000 * 100
    expect(r.profit_margin).toBe(20); //     20000 / 100000 * 100
    expect(r.interest_coverage).toBe(5); //  25000 / 5000
    expect(r.debt_to_equity_ratio).toBe(60); // 120000 / 200000 * 100
  });

  it("caps interest coverage at 999 when there is no interest", () => {
    expect(computeRatios({ ...base, interest: 0 }).interest_coverage).toBe(999);
  });

  it("omits the asset-based ratios when assets are zero (no divide-by-zero)", () => {
    const r = computeRatios({ ...base, assets: 0 });
    expect(r.return_on_assets).toBeUndefined();
    expect(r.debt_to_equity_ratio).toBeUndefined();
  });

  it("omits profit margin when revenue is zero", () => {
    expect(computeRatios({ ...base, revenue: 0 }).profit_margin).toBeUndefined();
  });

  it("rounds ratios to two decimals", () => {
    // ROA = 20000 / 300000 * 100 = 6.666… → 6.67
    expect(computeRatios({ ...base, assets: 300000 }).return_on_assets).toBe(6.67);
  });

  it("reflects a loss as negative return and margin", () => {
    // revenue 50000, expenses 80000 → net profit -30000, operating profit -25000.
    const r = computeRatios({ ...base, revenue: 50000, expenses: 80000 });
    expect(r.profit_margin).toBe(-60); //    -30000 / 50000 * 100
    expect(r.return_on_assets).toBe(-15); // -30000 / 200000 * 100
    expect(r.interest_coverage).toBe(-5); // -25000 / 5000
  });
});
