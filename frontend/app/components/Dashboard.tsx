import { FIELDS, FieldKey, PredictResult, Tone } from "../fields";
import {
  classifyRatio,
  riskIndex,
  healthScore,
  indexBand,
  formatValue,
  RatioStatus,
} from "../lib/scoring";
import {
  generateInsights,
  recommendedActions,
  AiFlag,
  severityTone,
} from "../lib/insights";
import { TopCards } from "./TopCards";
import { HealthGauge } from "./HealthGauge";
import { RatioGrid, RatioRow } from "./RatioGrid";
import { RiskFactors } from "./RiskFactors";
import { Insights, InsightItem } from "./Insights";
import { CriticalIssues, CriticalItem } from "./CriticalIssues";
import { RecommendedActions } from "./RecommendedActions";
import { InterpretationTable } from "./InterpretationTable";
import { TrendsSection } from "./TrendsSection";
import { Card } from "./ui";
import type { HistorySummary } from "../lib/history";

const TONE_ORDER: Record<Tone, number> = { high: 0, medium: 1, low: 2 };

export function Dashboard({
  result,
  inputs,
  aiFlags,
  assessedOn,
  history,
  chat,
}: {
  result: PredictResult;
  inputs: Record<string, number>;
  aiFlags: AiFlag[] | null;
  assessedOn: string;
  history: HistorySummary[];
  chat: React.ReactNode;
}) {
  const index = riskIndex(result.probability);
  const score = healthScore(result.probability);
  const band = indexBand(index);

  const rows: RatioRow[] = FIELDS.map((field) => ({
    field,
    value: inputs[field.key],
    status: classifyRatio(field, inputs[field.key]),
  }));
  const statuses = Object.fromEntries(
    rows.map((r) => [r.field.key, r.status])
  ) as Record<FieldKey, RatioStatus>;
  const fieldByKey = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

  const order = FIELDS.map((f) => f.key);
  const detInsights = generateInsights(statuses, order);
  const actions = recommendedActions(result.contributions, statuses);

  // AI flags take over the narrative when present; deterministic rules are the
  // fallback (missing key or failed call → aiFlags is null).
  const aiActive = !!aiFlags && aiFlags.length > 0;

  const insightItems: InsightItem[] = (
    aiActive
      ? aiFlags!
          .filter((f) => f.severity !== "ok")
          .map((f) => ({ tone: severityTone(f.severity), text: f.reason }))
      : detInsights.map((i) => ({ tone: i.tone, text: i.text }))
  ).sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);

  const criticalItems: CriticalItem[] = aiActive
    ? aiFlags!
        .filter((f) => f.severity === "critical")
        .map((f) => ({
          label: fieldByKey[f.field].shortLabel,
          value: formatValue(fieldByKey[f.field], inputs[f.field]),
          tone: "high" as Tone,
          note: f.reason,
        }))
    : rows
        .filter((r) => !r.status.missing && r.status.tone === "high")
        .map((r) => ({
          label: r.field.shortLabel,
          value: formatValue(r.field, r.value),
          tone: "high" as Tone,
          note: `${r.status.status} — a healthy level is ${r.field.healthy}.`,
        }));

  return (
    <div className="flex flex-col gap-4">
      <TopCards
        result={result}
        healthScore={score}
        riskIndex={index}
        band={band}
        assessedOn={assessedOn}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center justify-center lg:col-span-1">
          <HealthGauge index={index} tone={band.tone} label={band.label} />
        </Card>
        <div className="lg:col-span-2">
          <RatioGrid rows={rows} />
        </div>
      </div>

      <TrendsSection points={history} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RiskFactors contributions={result.contributions} />
        <Insights items={insightItems} aiPowered={aiActive} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CriticalIssues items={criticalItems} />
        <RecommendedActions actions={actions} />
      </div>

      <InterpretationTable rows={rows} />

      {chat}
    </div>
  );
}
