import { PredictResult, Tone } from "../fields";
import { TONE_TEXT } from "./ui";
import { RISK_LEVEL_LABEL } from "../lib/scoring";

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold leading-none ${
          tone ? TONE_TEXT[tone] : "text-ink"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function TopCards({
  result,
  healthScore,
  riskIndex,
  band,
  assessedOn,
}: {
  result: PredictResult;
  healthScore: number;
  riskIndex: number;
  band: { tone: Tone; label: string };
  assessedOn: string;
}) {
  const pct = Math.round(result.probability * 100);
  const confidencePct = Math.round((result.confidence ?? 0) * 100);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat
        label="Health Score"
        value={`${healthScore}`}
        sub="out of 100"
        tone={band.tone}
      />
      <Stat
        label="Trouble Risk"
        value={`${pct}%`}
        sub={`${RISK_LEVEL_LABEL[result.risk_level]} · index ${riskIndex}`}
        tone={band.tone}
      />
      <Stat label="Status" value={band.label} tone={band.tone} />
      <Stat
        label="Model Confidence"
        value={`${confidencePct}%`}
        sub="certainty in this prediction"
      />
      <Stat label="Last Assessment" value={assessedOn} />
    </div>
  );
}
