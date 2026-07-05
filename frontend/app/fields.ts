/** The inputs the model accepts. Keys match the model's API contract. */
export type FieldKey =
  | "return_on_assets"
  | "profit_margin"
  | "interest_coverage"
  | "debt_to_equity_ratio"
  | "current_ratio"
  | "quick_ratio";

export interface Field {
  key: FieldKey;
  label: string;
  hint: string;
  placeholder: string;
  /** The current model version only consumes 4 of the 6 inputs. */
  used: boolean;
}

export const FIELDS: Field[] = [
  {
    key: "return_on_assets",
    label: "Return on assets (%)",
    hint: "For every $100 of assets you own, how much profit do you make?",
    placeholder: "e.g. 22.61",
    used: true,
  },
  {
    key: "profit_margin",
    label: "Profit margin (%)",
    hint: "Out of every $100 of sales, how much is actual profit?",
    placeholder: "e.g. 25.31",
    used: true,
  },
  {
    key: "interest_coverage",
    label: "Interest coverage (×)",
    hint: "How many times over can your earnings cover your loan interest? Higher is safer.",
    placeholder: "e.g. 29.9",
    used: true,
  },
  {
    key: "debt_to_equity_ratio",
    label: "Debt ratio (%)",
    hint: "How much of your funding is borrowed vs. your own money? Higher is riskier.",
    placeholder: "e.g. 43",
    used: true,
  },
  {
    key: "current_ratio",
    label: "Current ratio (×)",
    hint: "Can you cover this year's bills with this year's assets? Above 1 means yes.",
    placeholder: "e.g. 1.07",
    used: false,
  },
  {
    key: "quick_ratio",
    label: "Quick ratio (×)",
    hint: "Same as above, but stricter — ignores hard-to-sell inventory.",
    placeholder: "e.g. 0.83",
    used: false,
  },
];

export interface PredictResult {
  probability: number;
  risk_level: "LOW_RISK" | "MEDIUM_RISK" | "HIGH_RISK";
  confidence: number;
}
