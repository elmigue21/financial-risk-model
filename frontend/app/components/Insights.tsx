import { Tone } from "../fields";
import { Card, CardTitle, TONE_TEXT } from "./ui";

export interface InsightItem {
  tone: Tone;
  text: string;
}

export function Insights({
  items,
  aiPowered,
}: {
  items: InsightItem[];
  aiPowered: boolean;
}) {
  return (
    <Card>
      <CardTitle>AI insights</CardTitle>
      {items.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing stands out — your ratios are within healthy ranges.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className={`mt-1 text-xs ${TONE_TEXT[it.tone]}`}>●</span>
              <span className="text-ink">{it.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">
        {aiPowered
          ? "Reviewed by the AI analyst."
          : "Generated from your ratios."}
      </p>
    </Card>
  );
}
