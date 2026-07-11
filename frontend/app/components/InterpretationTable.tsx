import { Card, CardTitle, StatusPill } from "./ui";
import { RatioRow } from "./RatioGrid";
import { formatValue } from "../lib/scoring";

export function InterpretationTable({ rows }: { rows: RatioRow[] }) {
  return (
    <Card>
      <CardTitle>Ratio interpretation</CardTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2 pr-4 font-semibold">Ratio</th>
              <th className="pb-2 pr-4 font-semibold">Your value</th>
              <th className="pb-2 pr-4 font-semibold">Healthy</th>
              <th className="pb-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ field, value, status }) => (
              <tr key={field.key} className="odd:bg-field/50">
                <td className="rounded-l-field py-2 pl-3 pr-4 text-ink">
                  {field.shortLabel}
                </td>
                <td className="py-2 pr-4 font-medium text-ink">
                  {formatValue(field, value)}
                </td>
                <td className="py-2 pr-4 text-muted">{field.healthy}</td>
                <td className="rounded-r-field py-2 pr-3">
                  {status.missing ? (
                    <span className="text-xs text-muted">—</span>
                  ) : (
                    <StatusPill tone={status.tone} label={status.status} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
