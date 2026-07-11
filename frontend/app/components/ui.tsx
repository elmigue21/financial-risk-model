import { Tone } from "../fields";

/**
 * Tone → literal Tailwind classes. These must be full strings (not
 * `text-${tone}`) so Tailwind's content scanner keeps them in the build.
 */
export const TONE_TEXT: Record<Tone, string> = {
  low: "text-low",
  medium: "text-medium",
  high: "text-high",
};

export const TONE_BG: Record<Tone, string> = {
  low: "bg-low",
  medium: "bg-medium",
  high: "bg-high",
};

export const TONE_BG_SOFT: Record<Tone, string> = {
  low: "bg-low-bg",
  medium: "bg-medium-bg",
  high: "bg-high-bg",
};

export const TONE_DOT: Record<Tone, string> = {
  low: "🟢",
  medium: "🟠",
  high: "🔴",
};

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-card bg-surface p-5 shadow-card ${className}`}>
      {children}
    </section>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted">
      {children}
    </h3>
  );
}

/** A coloured status pill, e.g. "Critical". */
export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_BG_SOFT[tone]} ${TONE_TEXT[tone]}`}
    >
      {label}
    </span>
  );
}

/** Filled / empty star row for action impact. */
export function Stars({ value }: { value: number }) {
  return (
    <span className="text-medium" aria-label={`${value} of 5 impact`}>
      {"★".repeat(value)}
      <span className="text-field">{"★".repeat(5 - value)}</span>
    </span>
  );
}
