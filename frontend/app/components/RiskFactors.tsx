import { Contribution } from "../fields";
import { Card, CardTitle } from "./ui";

/**
 * Top risk factors from the model's REAL per-feature contributions
 * (coef × bin_rate). Only the scored drivers are charted; bars are scaled to
 * the largest contribution.
 */
export function RiskFactors({ contributions }: { contributions: Contribution[] }) {
  const drivers = contributions
    .filter((c) => c.is_scored_driver)
    .sort((a, b) => b.contribution - a.contribution);

  const max = Math.max(...drivers.map((c) => c.contribution), 1e-9);

  return (
    <Card>
      <CardTitle>Top risk factors</CardTitle>
      <div className="flex flex-col gap-3">
        {drivers.map((c) => {
          const pct = Math.max(4, Math.round((c.contribution / max) * 100));
          return (
            <div key={c.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{c.label}</span>
                <span className="text-xs text-muted">{c.contribution.toFixed(2)}</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-field">
                <div
                  className="h-2.5 rounded-full bg-brand"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">
        Based on the model&apos;s own weighting of each factor. Higher bars pushed your
        risk up the most.
      </p>
    </Card>
  );
}
