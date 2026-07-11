import { Field } from "../fields";
import { RatioStatus, formatValue } from "../lib/scoring";
import { Card, CardTitle, StatusPill, TONE_DOT } from "./ui";

export interface RatioRow {
  field: Field;
  value: number | undefined;
  status: RatioStatus;
}

function RatioCard({ row }: { row: RatioRow }) {
  const { field, value, status } = row;
  return (
    <div className="flex flex-col gap-2 rounded-field bg-field p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-muted">{field.shortLabel}</span>
        <span aria-hidden>{status.missing ? "" : TONE_DOT[status.tone]}</span>
      </div>
      <span className="text-2xl font-bold leading-none text-ink">
        {formatValue(field, value)}
      </span>
      <div className="flex items-center justify-between gap-2">
        {status.missing ? (
          <span className="text-xs text-muted">No data</span>
        ) : (
          <StatusPill tone={status.tone} label={status.status} />
        )}
      </div>
      {!field.used && (
        <span className="text-[11px] text-brand">Informational · not scored</span>
      )}
    </div>
  );
}

export function RatioGrid({ rows }: { rows: RatioRow[] }) {
  return (
    <Card>
      <CardTitle>Financial ratios</CardTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map((row) => (
          <RatioCard key={row.field.key} row={row} />
        ))}
      </div>
    </Card>
  );
}
