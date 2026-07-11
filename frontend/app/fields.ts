/** The inputs the model accepts. Keys match the model's API contract. */
export type FieldKey =
  | "return_on_assets"
  | "profit_margin"
  | "interest_coverage"
  | "debt_to_equity_ratio"
  | "current_ratio"
  | "quick_ratio";

/** Colour token used across ratio cards, insights and the gauge. */
export type Tone = "low" | "medium" | "high";

export interface Field {
  key: FieldKey;
  label: string;
  /** Short name for compact places (cards, tables). */
  shortLabel: string;
  hint: string;
  placeholder: string;
  /** The current model version only consumes 4 of the 6 inputs. */
  used: boolean;
  unit: "%" | "×";
  /** Which direction is healthier — drives status + insight wording. */
  direction: "higher" | "lower";
  /** Human-readable healthy target, shown in the interpretation table. */
  healthy: string;
  /**
   * Two cut points between the three tones, read according to `direction`.
   * higher-is-better: value >= good → low, >= warn → medium, else high.
   * lower-is-better:  value <= good → low, <= warn → medium, else high.
   */
  thresholds: { good: number; warn: number };
  /** Status word shown per tone. */
  labels: { low: string; medium: string; high: string };
}

export const FIELDS: Field[] = [
  {
    key: "return_on_assets",
    label: "Return on assets (%)",
    shortLabel: "ROA",
    hint: "For every $100 of assets you own, how much profit do you make?",
    placeholder: "e.g. 22.61",
    used: true,
    unit: "%",
    direction: "higher",
    healthy: "> 5%",
    thresholds: { good: 5, warn: 2 },
    labels: { low: "Healthy", medium: "Weak", high: "Poor" },
  },
  {
    key: "profit_margin",
    label: "Profit margin (%)",
    shortLabel: "Profit margin",
    hint: "Out of every $100 of sales, how much is actual profit?",
    placeholder: "e.g. 25.31",
    used: true,
    unit: "%",
    direction: "higher",
    healthy: "> 10%",
    thresholds: { good: 10, warn: 2 },
    labels: { low: "Healthy", medium: "Low", high: "Poor" },
  },
  {
    key: "interest_coverage",
    label: "Interest coverage (×)",
    shortLabel: "Interest coverage",
    hint: "How many times over can your earnings cover your loan interest? Higher is safer.",
    placeholder: "e.g. 29.9",
    used: true,
    unit: "×",
    direction: "higher",
    healthy: "> 2×",
    thresholds: { good: 2, warn: 1 },
    labels: { low: "Healthy", medium: "Tight", high: "Critical" },
  },
  {
    key: "debt_to_equity_ratio",
    label: "Debt ratio (%)",
    shortLabel: "Debt ratio",
    hint: "How much of your funding is borrowed vs. your own money? Higher is riskier.",
    placeholder: "e.g. 43",
    used: true,
    unit: "%",
    direction: "lower",
    healthy: "< 60%",
    thresholds: { good: 60, warn: 80 },
    labels: { low: "Healthy", medium: "High", high: "Very High" },
  },
  {
    key: "current_ratio",
    label: "Current ratio (×)",
    shortLabel: "Current ratio",
    hint: "Can you cover this year's bills with this year's assets? Above 1 means yes.",
    placeholder: "e.g. 1.07",
    used: false,
    unit: "×",
    direction: "higher",
    healthy: "> 1.5×",
    thresholds: { good: 1.5, warn: 1 },
    labels: { low: "Healthy", medium: "Tight", high: "Critical" },
  },
  {
    key: "quick_ratio",
    label: "Quick ratio (×)",
    shortLabel: "Quick ratio",
    hint: "Same as above, but stricter — ignores hard-to-sell inventory.",
    placeholder: "e.g. 0.83",
    used: false,
    unit: "×",
    direction: "higher",
    healthy: "> 1×",
    thresholds: { good: 1, warn: 0.7 },
    labels: { low: "Healthy", medium: "Tight", high: "Critical" },
  },
];

/** A single feature's real contribution to the model's log-odds. */
export interface Contribution {
  /** API field key, or null for the model's hardcoded baseline features. */
  feature: FieldKey | null;
  label: string;
  contribution: number;
  is_scored_driver: boolean;
}

export interface PredictResult {
  probability: number;
  risk_level: "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK";
  confidence: number;
  contributions: Contribution[];
}
