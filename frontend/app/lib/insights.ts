import { Contribution, FieldKey, Tone } from "../fields";
import { RatioStatus } from "./scoring";

export interface Insight {
  tone: Tone;
  text: string;
}

/** Structured flag returned by /api/flag (the AI's view of each input). */
export interface AiFlag {
  field: FieldKey;
  severity: "critical" | "warning" | "ok";
  reason: string;
}

export function severityTone(severity: AiFlag["severity"]): Tone {
  return severity === "critical" ? "high" : severity === "warning" ? "medium" : "low";
}

export interface Action {
  priority: number;
  text: string;
  /** 1–5, relative to the biggest driver. */
  impact: number;
}

/** Observation templates per field, keyed by severity tone. */
const INSIGHT_TEMPLATES: Record<FieldKey, Partial<Record<Tone, string>>> = {
  return_on_assets: {
    high: "Return on assets is very low — your assets are generating little profit.",
    medium: "Return on assets is on the weak side; assets aren't working very hard.",
  },
  profit_margin: {
    high: "Profitability is weak — very little of your revenue converts to profit.",
    medium: "Profit margin is thin, leaving little cushion.",
  },
  interest_coverage: {
    high: "Interest coverage is below 1, meaning current earnings may not be enough to cover interest expenses.",
    medium: "Interest coverage is tight — limited buffer to service debt if earnings dip.",
  },
  debt_to_equity_ratio: {
    high: "Your debt ratio is very high, indicating heavy reliance on borrowed funds.",
    medium: "Debt levels are elevated relative to a healthy capital structure.",
  },
  current_ratio: {
    high: "Current ratio suggests the company may struggle to meet short-term obligations.",
    medium: "Current ratio is on the tight side for covering near-term bills.",
  },
  quick_ratio: {
    high: "Quick ratio is low — limited liquid assets to cover immediate obligations.",
    medium: "Quick ratio is a little tight once inventory is excluded.",
  },
};

/** Deterministic observations for every ratio that isn't healthy. */
export function generateInsights(
  statuses: Record<FieldKey, RatioStatus>,
  order: FieldKey[]
): Insight[] {
  const out: Insight[] = [];
  for (const key of order) {
    const s = statuses[key];
    if (!s || s.missing || s.tone === "low") continue;
    const text = INSIGHT_TEMPLATES[key]?.[s.tone];
    if (text) out.push({ tone: s.tone, text });
  }
  return out;
}

/** Canned remediation per scored driver. */
const ACTION_TEXT: Partial<Record<FieldKey, string>> = {
  debt_to_equity_ratio: "Reduce debt and deleverage the balance sheet.",
  interest_coverage: "Grow operating earnings or refinance to ease interest load.",
  return_on_assets: "Improve asset efficiency and operating returns.",
  profit_margin: "Lift operating profit — review pricing and cut avoidable costs.",
};

/**
 * Prioritise actions by each scored driver's REAL contribution to the score,
 * limited to drivers that are actually strained (medium/high tone).
 */
export function recommendedActions(
  contributions: Contribution[],
  statuses: Record<FieldKey, RatioStatus>
): Action[] {
  const scored = contributions
    .filter((c) => c.is_scored_driver && c.feature)
    .filter((c) => {
      const s = statuses[c.feature as FieldKey];
      return s && !s.missing && s.tone !== "low" && ACTION_TEXT[c.feature as FieldKey];
    })
    .sort((a, b) => b.contribution - a.contribution);

  if (scored.length === 0) return [];

  const max = scored[0].contribution || 1;
  return scored.map((c, i) => ({
    priority: i + 1,
    text: ACTION_TEXT[c.feature as FieldKey] as string,
    impact: Math.max(1, Math.min(5, Math.round((c.contribution / max) * 5))),
  }));
}
