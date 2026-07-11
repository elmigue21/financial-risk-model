import { Action } from "../lib/insights";
import { Card, CardTitle, Stars } from "./ui";

export function RecommendedActions({ actions }: { actions: Action[] }) {
  return (
    <Card>
      <CardTitle>Recommended actions</CardTitle>
      {actions.length === 0 ? (
        <p className="text-sm text-muted">
          No urgent actions — keep monitoring your key ratios.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {actions.map((a) => (
            <li key={a.priority} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {a.priority}
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-sm text-ink">{a.text}</span>
                <span className="text-xs">
                  <span className="text-muted">Expected impact </span>
                  <Stars value={a.impact} />
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
