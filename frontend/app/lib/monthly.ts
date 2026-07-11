import { FieldKey, PredictResult } from "../fields";

/**
 * The monthly financial status is the app's single source of input. The owner
 * records plain dollar figures for a month; we derive the model's ratios from
 * them (so nobody needs to know what a ratio is), run the prediction, and store
 * the month. The full run of months is the customer's financial history, which
 * is summarised into the advisor's context so it reasons about trends, not just
 * a single snapshot.
 *
 * Pure module — no server-only imports — so API routes and client pages share it.
 */

export type MonthlyKey =
  | "revenue"
  | "expenses"
  | "interest"
  | "cash"
  | "assets"
  | "liabilities"
  | "equity";

export interface MonthlyFigures {
  revenue: number;
  expenses: number;
  interest: number;
  cash: number;
  assets: number;
  liabilities: number;
  equity: number;
}

export interface MonthlyField {
  key: MonthlyKey;
  label: string;
  hint: string;
  placeholder: string;
  section: "income" | "balance";
}

export const MONTHLY_SECTIONS: Record<MonthlyField["section"], string> = {
  income: "This month's income",
  balance: "End-of-month balances",
};

export const MONTHLY_FIELDS: MonthlyField[] = [
  {
    key: "revenue",
    label: "Revenue",
    hint: "All sales / money earned this month.",
    placeholder: "50000",
    section: "income",
  },
  {
    key: "expenses",
    label: "Expenses",
    hint: "Everything you spent this month, including interest.",
    placeholder: "48000",
    section: "income",
  },
  {
    key: "interest",
    label: "Interest paid",
    hint: "Loan interest included in expenses. Enter 0 if none.",
    placeholder: "1500",
    section: "income",
  },
  {
    key: "cash",
    label: "Cash on hand",
    hint: "Money in the bank at month end.",
    placeholder: "20000",
    section: "balance",
  },
  {
    key: "assets",
    label: "Total assets",
    hint: "Everything the business owns — cash, gear, stock, receivables.",
    placeholder: "300000",
    section: "balance",
  },
  {
    key: "liabilities",
    label: "Total liabilities",
    hint: "Everything the business owes — loans, bills, payables.",
    placeholder: "200000",
    section: "balance",
  },
  {
    key: "equity",
    label: "Owner's equity",
    hint: "Your stake in the business. Assets should equal liabilities + equity.",
    placeholder: "100000",
    section: "balance",
  },
];

// ---- Derived figures (accounting identities) -------------------------------

export const equity = (f: MonthlyFigures) => f.equity;
export const netProfit = (f: MonthlyFigures) => f.revenue - f.expenses;
/** Operating profit (EBIT) ≈ net profit with interest added back. */
export const operatingProfit = (f: MonthlyFigures) => netProfit(f) + f.interest;

// ---- Input validation ------------------------------------------------------

export interface FigureIssue {
  severity: "error" | "warning";
  message: string;
}

const NON_NEGATIVE: Array<[MonthlyKey, string]> = [
  ["revenue", "Revenue"],
  ["expenses", "Expenses"],
  ["interest", "Interest paid"],
  ["cash", "Cash on hand"],
  ["assets", "Total assets"],
  ["liabilities", "Total liabilities"],
];

/**
 * Sanity-check a month's figures so obviously wrong or inconsistent numbers get
 * caught before scoring. Errors block saving; warnings just flag likely typos.
 * Equity may be negative (insolvency), so it's exempt from the non-negative rule.
 */
export function validateFigures(f: MonthlyFigures): FigureIssue[] {
  const issues: FigureIssue[] = [];

  for (const [key, label] of NON_NEGATIVE) {
    if (f[key] < 0)
      issues.push({ severity: "error", message: `${label} can't be negative.` });
  }

  // Balance sheet must balance: assets = liabilities + equity.
  const expected = f.liabilities + f.equity;
  const tol = Math.max(1, Math.abs(f.assets) * 0.005);
  if (f.assets > 0 && Math.abs(f.assets - expected) > tol) {
    issues.push({
      severity: "error",
      message: `Balance sheet doesn't add up: assets (${formatMoney(
        f.assets
      )}) should equal liabilities + equity (${formatMoney(expected)}).`,
    });
  }

  // Part-of-whole checks — a part can't exceed its whole.
  if (f.assets > 0 && f.cash > f.assets)
    issues.push({
      severity: "error",
      message: `Cash (${formatMoney(f.cash)}) can't be more than total assets (${formatMoney(
        f.assets
      )}).`,
    });
  if (f.expenses > 0 && f.interest > f.expenses)
    issues.push({
      severity: "error",
      message: `Interest paid (${formatMoney(
        f.interest
      )}) can't be more than total expenses (${formatMoney(f.expenses)}).`,
    });

  // Plausibility warnings — likely typos, not impossible.
  if (f.assets === 0)
    issues.push({
      severity: "warning",
      message: "Enter total assets so we can score returns and leverage.",
    });
  if (f.revenue === 0)
    issues.push({ severity: "warning", message: "No revenue recorded — is that right?" });
  else if (netProfit(f) / f.revenue > 0.9)
    issues.push({
      severity: "warning",
      message: "That's an unusually high profit margin — double-check your expenses.",
    });
  if (f.revenue > 0 && f.expenses === 0)
    issues.push({ severity: "warning", message: "No expenses recorded — double-check." });
  if (f.liabilities > 0 && (f.interest * 12) / f.liabilities > 1)
    issues.push({
      severity: "warning",
      message: "Interest looks high for your debt level — check the amount.",
    });

  return issues;
}

export const hasBlockingErrors = (issues: FigureIssue[]) =>
  issues.some((i) => i.severity === "error");

/** No-interest months have effectively unlimited coverage; cap it high. */
const MAX_COVERAGE = 999;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Derive the model's ratio inputs from a month's dollar figures. Returns the
 * exact shape /api/predict expects. Because Assets = Liabilities + Equity, the
 * debt ratio is simply liabilities / assets.
 */
export function computeRatios(
  f: MonthlyFigures
): Partial<Record<FieldKey, number>> {
  const out: Partial<Record<FieldKey, number>> = {};
  const np = netProfit(f);
  const op = operatingProfit(f);

  if (f.assets) out.return_on_assets = round2((np / f.assets) * 100);
  if (f.revenue) out.profit_margin = round2((np / f.revenue) * 100);
  out.interest_coverage = f.interest > 0 ? round2(op / f.interest) : MAX_COVERAGE;
  if (f.assets) out.debt_to_equity_ratio = round2((f.liabilities / f.assets) * 100);

  return out;
}

// ---- Formatting ------------------------------------------------------------

export function formatMoney(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** "2026-07" → "Jul 2026". */
export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** Current month as "YYYY-MM" for defaulting the form. */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---- History summary for the advisor ---------------------------------------

/** A stored month, trimmed to what the summary needs. */
export interface MonthPoint {
  month: string;
  figures: MonthlyFigures;
  riskIndex: number;
  riskLevel: PredictResult["risk_level"];
}

const RISK_WORD: Record<PredictResult["risk_level"], string> = {
  LOW_RISK: "low",
  MEDIUM_RISK: "medium",
  HIGH_RISK: "high",
};

function pctChange(first: number, last: number): string {
  if (!first) return "n/a";
  const pct = Math.round(((last - first) / Math.abs(first)) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/**
 * Compact multi-month summary fed to the advisor so it understands the
 * customer's financial trajectory. Oldest to newest, capped to the last 12
 * months to bound token use.
 */
export function summarizeMonths(points: MonthPoint[]): string {
  if (!points.length) return "";
  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const recent = sorted.slice(-12);

  const lines = recent.map((p) => {
    const f = p.figures;
    return `- ${formatMonth(p.month)}: revenue ${formatMoney(f.revenue)}, net profit ${formatMoney(
      netProfit(f)
    )}, cash ${formatMoney(f.cash)}, assets ${formatMoney(f.assets)}, liabilities ${formatMoney(
      f.liabilities
    )}, equity ${formatMoney(equity(f))} → risk index ${p.riskIndex}/100 (${RISK_WORD[p.riskLevel]}).`;
  });

  const first = recent[0];
  const last = recent[recent.length - 1];
  const trend =
    recent.length > 1
      ? `Movement across ${recent.length} months — revenue ${pctChange(
          first.figures.revenue,
          last.figures.revenue
        )}, net profit ${pctChange(
          netProfit(first.figures),
          netProfit(last.figures)
        )}, cash ${pctChange(first.figures.cash, last.figures.cash)}, liabilities ${pctChange(
          first.figures.liabilities,
          last.figures.liabilities
        )}, equity ${pctChange(
          equity(first.figures),
          equity(last.figures)
        )}. Risk index moved from ${first.riskIndex} to ${last.riskIndex}.`
      : "";

  return [
    "FINANCIAL HISTORY — the owner's monthly books, each scored by the model (oldest to newest):",
    ...lines,
    trend,
  ]
    .filter(Boolean)
    .join("\n");
}
