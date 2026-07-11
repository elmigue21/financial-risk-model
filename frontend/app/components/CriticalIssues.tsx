import { Tone } from "../fields";
import { Card, CardTitle, TONE_BG_SOFT, TONE_TEXT, TONE_DOT } from "./ui";

export interface CriticalItem {
  label: string;
  value: string;
  tone: Tone;
  note: string;
}

export function CriticalIssues({ items }: { items: CriticalItem[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardTitle>Most critical issues</CardTitle>
      <div className="flex flex-col gap-3">
        {items.map((it, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-field p-3 ${TONE_BG_SOFT[it.tone]}`}
          >
            <span aria-hidden className="text-sm">
              {TONE_DOT[it.tone]}
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-ink">{it.label}</span>
                <span className={`text-sm font-bold ${TONE_TEXT[it.tone]}`}>
                  {it.value}
                </span>
              </div>
              <span className="text-xs text-ink/80">{it.note}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
