import { Tone } from "../fields";
import { TONE_TEXT } from "./ui";

const TONE_STROKE: Record<Tone, string> = {
  low: "#2f9e44",
  medium: "#f08c00",
  high: "#e03131",
};

/**
 * Semicircular gauge for the 0–100 Risk Index. Hand-rolled SVG — no chart
 * library is installed, and an arc fits the shadow-based design system.
 */
export function HealthGauge({
  index,
  tone,
  label,
}: {
  index: number;
  tone: Tone;
  label: string;
}) {
  const R = 80;
  const CX = 100;
  const CY = 100;
  // Semicircle from 180° (left) to 0° (right).
  const angle = Math.PI * (1 - index / 100);
  const x = CX + R * Math.cos(angle);
  const y = CY - R * Math.sin(angle);
  const semi = Math.PI * R; // length of the half-circle arc
  const filled = (index / 100) * semi;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[240px]">
        {/* track */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#eef1f6"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* filled portion */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${semi}`}
        />
        {/* needle dot */}
        <circle cx={x} cy={y} r={7} fill={TONE_STROKE[tone]} />
        <circle cx={x} cy={y} r={3} fill="#ffffff" />
      </svg>
      <div className="-mt-6 flex flex-col items-center">
        <span className={`text-4xl font-bold leading-none ${TONE_TEXT[tone]}`}>
          {index}
        </span>
        <span className="mt-1 text-xs text-muted">Risk Index / 100</span>
        <span className={`mt-2 text-sm font-semibold ${TONE_TEXT[tone]}`}>{label}</span>
      </div>
    </div>
  );
}
