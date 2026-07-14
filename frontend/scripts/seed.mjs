/**
 * Seed the local SQLite database with a demo account and a believable run of
 * monthly assessments, so the dashboard / history / trends / advisor all look
 * populated for prototype screenshots.
 *
 *   Run from the frontend folder:  node scripts/seed.mjs
 *
 * Idempotent: it removes the demo user (and their rows) first, then recreates
 * them, so you can re-run it any time. It does not touch other accounts.
 */

import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

// ---- demo account ----------------------------------------------------------
const DEMO = {
  email: "demo@example.com",
  password: "demo1234", // meets the app's rule: 8+ chars, letter + number
  fullName: "Alex Rivera",
};

// ---- helpers (mirror app/lib/monthly.ts + app/lib/scoring.ts) --------------
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const netProfit = (f) => f.revenue - f.expenses;
const operatingProfit = (f) => netProfit(f) + f.interest;

function computeRatios(f) {
  const np = netProfit(f);
  const op = operatingProfit(f);
  const out = {};
  if (f.assets) out.return_on_assets = round2((np / f.assets) * 100);
  if (f.revenue) out.profit_margin = round2((np / f.revenue) * 100);
  out.interest_coverage = f.interest > 0 ? round2(op / f.interest) : 999;
  if (f.assets) out.debt_to_equity_ratio = round2((f.liabilities / f.assets) * 100);
  return out;
}

const ANCHORS = [
  [0.017, 5],
  [0.023, 34],
  [0.038, 67],
  [0.056, 95],
];
function riskIndex(p) {
  if (p <= ANCHORS[0][0]) return ANCHORS[0][1];
  if (p >= ANCHORS[ANCHORS.length - 1][0]) return ANCHORS[ANCHORS.length - 1][1];
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [p0, i0] = ANCHORS[i];
    const [p1, i1] = ANCHORS[i + 1];
    if (p >= p0 && p <= p1) {
      const t = (p - p0) / (p1 - p0);
      return Math.round(i0 + t * (i1 - i0));
    }
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

function riskLevel(p) {
  if (p >= 0.038) return "HIGH_RISK";
  if (p >= 0.023) return "MEDIUM_RISK";
  return "LOW_RISK";
}

function confidence(p) {
  return round4(Math.min(0.95, Math.max(0.6, Math.abs(p - 0.5) * 2)));
}

function formatMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

/** Plausible per-feature contributions, larger where a ratio is weaker. */
function contributions(inputs) {
  const roaBad = clamp01((5 - (inputs.return_on_assets ?? 0)) / 8);
  const marginBad = clamp01((10 - (inputs.profit_margin ?? 0)) / 15);
  const covBad = clamp01((3 - (inputs.interest_coverage ?? 0)) / 3);
  const debtBad = clamp01(((inputs.debt_to_equity_ratio ?? 0) - 45) / 40);
  const c = (bad) => round4(0.02 + bad * 0.18);
  return [
    { feature: "debt_to_equity_ratio", label: "Debt ratio", contribution: c(debtBad), is_scored_driver: true },
    { feature: "interest_coverage", label: "Interest coverage", contribution: c(covBad), is_scored_driver: true },
    { feature: "profit_margin", label: "Profit margin", contribution: c(marginBad), is_scored_driver: true },
    { feature: "return_on_assets", label: "Return on assets", contribution: c(roaBad), is_scored_driver: true },
    { feature: null, label: "Debt / EBITDA", contribution: 0.06, is_scored_driver: false },
    { feature: null, label: "Fixed asset turnover", contribution: 0.03, is_scored_driver: false },
  ];
}

/** A few AI-style input flags where ratios are weak. */
function aiFlags(inputs) {
  const flags = [];
  if ((inputs.debt_to_equity_ratio ?? 0) >= 70)
    flags.push({ field: "debt_to_equity_ratio", severity: "critical", reason: "Borrowing funds most of the business — pay down debt before taking on more." });
  else if ((inputs.debt_to_equity_ratio ?? 0) >= 60)
    flags.push({ field: "debt_to_equity_ratio", severity: "warning", reason: "Leverage is on the high side; keep an eye on new borrowing." });
  if ((inputs.interest_coverage ?? 0) < 2)
    flags.push({ field: "interest_coverage", severity: "critical", reason: "Earnings barely cover loan interest — a slow month could mean missed payments." });
  if ((inputs.profit_margin ?? 0) < 2)
    flags.push({ field: "profit_margin", severity: "warning", reason: "Very thin profit margin; review pricing and your biggest costs." });
  return flags;
}

// ---- the storyline: struggling -> healthy over 7 months --------------------
// Each row keeps the balance sheet valid (assets = liabilities + equity),
// cash <= assets, interest <= expenses. `p` is chosen to land in a sensible band.
const MONTHS = [
  { month: "2026-01", p: 0.045, f: { revenue: 40000, expenses: 41500, interest: 1800, cash: 12000, assets: 220000, liabilities: 165000, equity: 55000 } },
  { month: "2026-02", p: 0.036, f: { revenue: 45000, expenses: 44000, interest: 1700, cash: 15000, assets: 225000, liabilities: 160000, equity: 65000 } },
  { month: "2026-03", p: 0.030, f: { revenue: 52000, expenses: 49000, interest: 1600, cash: 20000, assets: 230000, liabilities: 150000, equity: 80000 } },
  { month: "2026-04", p: 0.026, f: { revenue: 58000, expenses: 53000, interest: 1500, cash: 26000, assets: 240000, liabilities: 145000, equity: 95000 } },
  { month: "2026-05", p: 0.022, f: { revenue: 64000, expenses: 56000, interest: 1400, cash: 34000, assets: 250000, liabilities: 140000, equity: 110000 } },
  { month: "2026-06", p: 0.020, f: { revenue: 70000, expenses: 59000, interest: 1300, cash: 44000, assets: 265000, liabilities: 135000, equity: 130000 } },
  { month: "2026-07", p: 0.018, f: { revenue: 78000, expenses: 63000, interest: 1200, cash: 56000, assets: 285000, liabilities: 130000, equity: 155000 } },
];

// A short advisor thread + suggestions for the most recent months, so the chat
// panel and the history detail look alive.
const THREAD = [
  { role: "assistant", content: "Good news — your health has been climbing steadily. Profitability and cash are both trending up, and your debt load is easing. The main thing to keep watching is leverage: it's improved, but debt still funds a big share of the business. Keep directing surplus cash toward paying it down." },
  { role: "user", content: "What should I focus on next month?" },
  { role: "assistant", content: "Protect the momentum: keep the profit margin above 15%, hold expenses steady as revenue grows, and put at least part of your rising cash toward the principal on your highest-rate loan. That single move will lift your interest coverage and lower your debt ratio at the same time." },
];
const SUGGESTIONS = [
  "What are your three biggest monthly expenses?",
  "Are your loans short-term or long-term, and at what rates?",
  "How much of your revenue comes from your largest customer?",
];

// ---- schema (matches app/lib/db.ts) ----------------------------------------
function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      full_name TEXT NOT NULL,
      email TEXT NOT NULL, password_hash TEXT NOT NULL
    );`);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email)");
  const ucols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
  if (ucols.includes("company_name")) db.exec("ALTER TABLE users DROP COLUMN company_name");
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER, assessed_on TEXT, month TEXT, figures TEXT,
      inputs TEXT NOT NULL, probability REAL NOT NULL, risk_level TEXT NOT NULL,
      confidence REAL, risk_index INTEGER NOT NULL, contributions TEXT,
      ai_flags TEXT, messages TEXT, suggestions TEXT
    );`);
  const cols = db.prepare("PRAGMA table_info(predictions)").all().map((c) => c.name);
  if (!cols.includes("user_id")) db.exec("ALTER TABLE predictions ADD COLUMN user_id INTEGER");
  db.exec("DROP INDEX IF EXISTS predictions_month");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS predictions_user_month ON predictions(user_id, month)");
}

// ---- run -------------------------------------------------------------------
const dir = path.join(process.cwd(), "data");
fs.mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, "app.db"));
db.pragma("journal_mode = WAL");
migrate(db);

// Remove any prior demo data so re-runs are clean.
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(DEMO.email);
if (existing) {
  db.prepare("DELETE FROM predictions WHERE user_id = ?").run(existing.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(existing.id);
}

const passwordHash = bcrypt.hashSync(DEMO.password, 10);
const userId = Number(
  db
    .prepare("INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)")
    .run(DEMO.fullName, DEMO.email, passwordHash).lastInsertRowid
);

const insert = db.prepare(`
  INSERT INTO predictions
    (user_id, created_at, assessed_on, month, figures, inputs, probability,
     risk_level, confidence, risk_index, contributions, ai_flags, messages, suggestions)
  VALUES
    (@user_id, @created_at, @assessed_on, @month, @figures, @inputs, @probability,
     @risk_level, @confidence, @risk_index, @contributions, @ai_flags, @messages, @suggestions)`);

MONTHS.forEach((row, i) => {
  const inputs = computeRatios(row.f);
  const isLatestFew = i >= MONTHS.length - 3;
  insert.run({
    user_id: userId,
    created_at: `${row.month}-15 09:00:00`,
    assessed_on: formatMonth(row.month),
    month: row.month,
    figures: JSON.stringify(row.f),
    inputs: JSON.stringify(inputs),
    probability: row.p,
    risk_level: riskLevel(row.p),
    confidence: confidence(row.p),
    risk_index: riskIndex(row.p),
    contributions: JSON.stringify(contributions(inputs)),
    ai_flags: JSON.stringify(aiFlags(inputs)),
    messages: JSON.stringify(isLatestFew ? THREAD : []),
    suggestions: JSON.stringify(i === MONTHS.length - 1 ? SUGGESTIONS : []),
  });
});

const count = db.prepare("SELECT COUNT(*) n FROM predictions WHERE user_id = ?").get(userId).n;
console.log(`Seeded ${count} months for ${DEMO.email} (user id ${userId}).`);
console.log(`Sign in with:  ${DEMO.email}  /  ${DEMO.password}`);
db.close();
