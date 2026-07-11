import { Field, Tone, PredictResult } from "../fields";

/**
 * Map the model's raw default probability onto an intuitive 0–100 Risk Index.
 *
 * The model predicts a rare event, so its probability only ever spans ~1.7–5.6%.
 * Showing "3%" reads as harmless and the numbers barely move between companies,
 * so we rescale onto 0–100 anchored on the model's OWN risk thresholds
 * (prob 0.023 = MEDIUM cutoff → 34, prob 0.038 = HIGH cutoff → 67). The result
 * is a faithful, monotonic transform of the real probability — not a new number.
 */
const ANCHORS: Array<[prob: number, index: number]> = [
  [0.017, 5],
  [0.023, 34],
  [0.038, 67],
  [0.056, 95],
];

export function riskIndex(probability: number): number {
  const p = probability;
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

export function healthScore(probability: number): number {
  return 100 - riskIndex(probability);
}

/** Tone + wording for a Risk Index band. Kept consistent with risk_level. */
export function indexBand(index: number): { tone: Tone; label: string } {
  if (index >= 67) return { tone: "high", label: "High Risk" };
  if (index >= 34) return { tone: "medium", label: "Moderate Risk" };
  return { tone: "low", label: "Low Risk" };
}

export interface RatioStatus {
  tone: Tone;
  /** Status word, e.g. "Poor", "Healthy", "Critical". */
  status: string;
  /** True when the user left the field blank. */
  missing: boolean;
}

/** Classify a single entered ratio against its healthy thresholds. */
export function classifyRatio(field: Field, value: number | undefined): RatioStatus {
  if (value === undefined || Number.isNaN(value)) {
    return { tone: "medium", status: "No data", missing: true };
  }
  const { good, warn } = field.thresholds;
  let tone: Tone;
  if (field.direction === "higher") {
    tone = value >= good ? "low" : value >= warn ? "medium" : "high";
  } else {
    tone = value <= good ? "low" : value <= warn ? "medium" : "high";
  }
  return { tone, status: field.labels[tone], missing: false };
}

/** Format a value with its unit, e.g. 2 → "2%", 0.1 → "0.1×". */
export function formatValue(field: Field, value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "—";
  const n = Number.isInteger(value) ? value : Number(value.toFixed(2));
  return field.unit === "%" ? `${n}%` : `${n}×`;
}

export const RISK_LEVEL_LABEL: Record<PredictResult["risk_level"], string> = {
  LOW_RISK: "Low Risk",
  MEDIUM_RISK: "Medium Risk",
  HIGH_RISK: "High Risk",
};
