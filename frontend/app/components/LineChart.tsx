"use client";

/**
 * Small, dependency-free line chart for month-over-month trends. Hand-rolled SVG
 * to match the shadow-based design system (no chart library installed).
 *
 * Colours come from the validated categorical pair (indigo #3b5bdb + cyan
 * #1098ad); status colours stay reserved for risk bands. Identity is carried by
 * the coloured marks + legend + direct labels, never colour alone. Per-point
 * hover shows the exact value.
 */

export interface Series {
  name: string;
  color: string;
  values: number[];
}

const W = 340;
const PAD = { l: 10, r: 14, t: 16, b: 22 };

export function LineChart({
  labels,
  series,
  formatY,
  height = 170,
}: {
  labels: string[];
  series: Series[];
  formatY: (n: number) => string;
  height?: number;
}) {
  const n = labels.length;
  const plotW = W - PAD.l - PAD.r;
  const plotH = height - PAD.t - PAD.b;

  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v));
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    // Flat line — pad so it doesn't sit on an edge.
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  } else {
    const range = max - min;
    max += range * 0.12;
    min -= range * 0.12;
  }
  if (min > 0 && min < max * 0.35) min = 0; // include zero when close, for honesty

  const x = (i: number) => PAD.l + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (v: number) => PAD.t + plotH * (1 - (v - min) / (max - min));

  const gridVals = [max, (max + min) / 2, min];
  const showZero = min < 0 && max > 0;

  // Show every label when there's room, otherwise thin them out.
  const step = n <= 7 ? 1 : Math.ceil(n / 7);

  return (
    <div className="w-full">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        role="img"
        aria-label={series.map((s) => s.name).join(", ") + " over time"}
      >
        {/* gridlines + y labels */}
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(gv)}
              y2={y(gv)}
              stroke="#eef1f6"
              strokeWidth={1}
            />
            <text x={2} y={y(gv) + 3} fontSize={8} fill="#6b7685">
              {formatY(gv)}
            </text>
          </g>
        ))}

        {/* zero baseline, if the data crosses it */}
        {showZero && (
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(0)}
            y2={y(0)}
            stroke="#c9ced8"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}

        {/* x labels */}
        {labels.map((lab, i) =>
          i % step === 0 || i === n - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={height - 6}
              fontSize={8}
              fill="#6b7685"
              textAnchor="middle"
            >
              {lab}
            </text>
          ) : null
        )}

        {series.map((s) => {
          const path = s.values
            .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
            .join(" ");
          const last = s.values.length - 1;
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={2.6} fill={s.color}>
                  <title>{`${labels[i]}: ${formatY(v)}`}</title>
                </circle>
              ))}
              {/* direct label on the latest point (in ink, not the series colour) */}
              <text
                x={x(last)}
                y={y(s.values[last]) - 6}
                fontSize={9}
                fontWeight={600}
                fill="#1f2733"
                textAnchor="end"
              >
                {formatY(s.values[last])}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
