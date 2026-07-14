/**
 * Shared presentational pieces for the auth pages (login / register).
 * Pure styling wrappers so both forms look identical and stay consistent with
 * the rest of the app's Tailwind design tokens.
 */

export const inputClass =
  "mt-1 w-full rounded-field bg-field px-4 py-3 text-base shadow-soft outline-none transition focus:shadow-focus";

export const submitClass =
  "mt-2 rounded-field bg-brand px-4 py-3 text-base font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-card bg-surface p-8 shadow-card">
        <header className="mb-6 text-center">
          <img
            src="/logo.png"
            alt="Financial Health Check"
            className="mx-auto mb-3 h-12 w-auto"
          />
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </header>
        {children}
      </div>
    </main>
  );
}

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
    </div>
  );
}
