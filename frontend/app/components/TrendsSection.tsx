import type { HistorySummary } from "../lib/history";
import {
  MonthlyFigures,
  netProfit,
  formatMonth,
  formatMoneyShort,
} from "../lib/monthly";
import { Card, CardTitle } from "./ui";
import { LineChart } from "./LineChart";

const BRAND = "#3b5bdb";
const CYAN = "#1098ad";

interface Point {
  month: string;
  figures: MonthlyFigures;
  riskIndex: number;
}

/** Tiny inline trend line for a KPI tile. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 80;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (w * i) / Math.max(1, values.length - 1);
      const y = h - 2 - (h - 4) * ((v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-20" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

/** A single KPI tile: latest value, month-over-month delta, sparkline. */
function TrendStat({
  label,
  values,
  format,
  higherIsBetter,
}: {
  label: string;
  values: number[];
  format: (n: number) => string;
  higherIsBetter: boolean;
}) {
  const latest = values[values.length - 1];
  const prev = values.length > 1 ? values[values.length - 2] : undefined;
  const delta = prev !== undefined ? latest - prev : undefined;

  let tone = "text-muted";
  let arrow = "";
  if (delta !== undefined && delta !== 0) {
    const good = higherIsBetter ? delta > 0 : delta < 0;
    tone = good ? "text-low" : "text-high";
    arrow = delta > 0 ? "▲" : "▼";
  }

  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface p-4 shadow-card">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-2xl font-bold leading-none text-ink">{format(latest)}</span>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${tone}`}>
          {delta === undefined
            ? "—"
            : delta === 0
              ? "no change"
              : `${arrow} ${format(Math.abs(delta))}`}
        </span>
        <Sparkline values={values} color={BRAND} />
      </div>
    </div>
  );
}

export function TrendsSection({ points }: { points: HistorySummary[] }) {
  // Only monthly records with figures, oldest → newest.
  const data: Point[] = points
    .filter((p): p is HistorySummary & { month: string; figures: MonthlyFigures } =>
      Boolean(p.month && p.figures)
    )
    .map((p) => ({ month: p.month, figures: p.figures, riskIndex: p.riskIndex }))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (data.length < 2) return null; // need at least two months to show a trend

  const labels = data.map((d) => formatMonth(d.month));
  const risk = data.map((d) => d.riskIndex);
  const revenue = data.map((d) => d.figures.revenue);
  const profit = data.map((d) => netProfit(d.figures));
  const cash = data.map((d) => d.figures.cash);
  const assets = data.map((d) => d.figures.assets);
  const liabilities = data.map((d) => d.figures.liabilities);

  const intFmt = (n: number) => `${Math.round(n)}`;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Trends over time</h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TrendStat label="Risk index" values={risk} format={intFmt} higherIsBetter={false} />
        <TrendStat
          label="Revenue"
          values={revenue}
          format={formatMoneyShort}
          higherIsBetter
        />
        <TrendStat
          label="Net profit"
          values={profit}
          format={formatMoneyShort}
          higherIsBetter
        />
        <TrendStat label="Cash" values={cash} format={formatMoneyShort} higherIsBetter />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Risk index</CardTitle>
          <LineChart
            labels={labels}
            formatY={intFmt}
            series={[{ name: "Risk index", color: BRAND, values: risk }]}
          />
        </Card>
        <Card>
          <CardTitle>Revenue &amp; net profit</CardTitle>
          <LineChart
            labels={labels}
            formatY={formatMoneyShort}
            series={[
              { name: "Revenue", color: BRAND, values: revenue },
              { name: "Net profit", color: CYAN, values: profit },
            ]}
          />
        </Card>
        <Card>
          <CardTitle>Cash on hand</CardTitle>
          <LineChart
            labels={labels}
            formatY={formatMoneyShort}
            series={[{ name: "Cash", color: BRAND, values: cash }]}
          />
        </Card>
        <Card>
          <CardTitle>Assets vs liabilities</CardTitle>
          <LineChart
            labels={labels}
            formatY={formatMoneyShort}
            series={[
              { name: "Assets", color: BRAND, values: assets },
              { name: "Liabilities", color: CYAN, values: liabilities },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
