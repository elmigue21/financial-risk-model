"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PredictResult } from "../fields";
import { riskIndex, indexBand } from "../lib/scoring";
import type { HistorySummary } from "../lib/history";
import {
  MONTHLY_FIELDS,
  MONTHLY_SECTIONS,
  MonthlyKey,
  MonthlyFigures,
  computeRatios,
  equity,
  netProfit,
  formatMoney,
  formatMonth,
  currentMonth,
} from "../lib/monthly";
import { Card, CardTitle, TONE_BG_SOFT, TONE_TEXT } from "../components/ui";

type FormState = Record<MonthlyKey, string>;
const EMPTY = Object.fromEntries(MONTHLY_FIELDS.map((f) => [f.key, ""])) as FormState;

const SECTION_ORDER: Array<"income" | "balance"> = ["income", "balance"];

export default function StatusPage() {
  const [month, setMonth] = useState(currentMonth());
  const [form, setForm] = useState<FormState>(EMPTY);
  const [records, setRecords] = useState<HistorySummary[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMonth, setSavedMonth] = useState("");

  async function loadList() {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      const data = await res.json();
      setRecords((data.records as HistorySummary[]).filter((r) => r.month));
    } catch {
      setRecords([]);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  const figures: MonthlyFigures = {
    revenue: Number(form.revenue) || 0,
    expenses: Number(form.expenses) || 0,
    interest: Number(form.interest) || 0,
    cash: Number(form.cash) || 0,
    assets: Number(form.assets) || 0,
    liabilities: Number(form.liabilities) || 0,
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSavedMonth("");
    try {
      const inputs = computeRatios(figures);
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      if (!res.ok) throw new Error("The model service is not reachable.");
      const result: PredictResult = await res.json();

      const hres = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          assessedOn: formatMonth(month),
          figures,
          inputs,
          result,
          riskIndex: riskIndex(result.probability),
        }),
      });
      if (!hres.ok) throw new Error("Could not save this month.");
      setSavedMonth(month);
      setForm(EMPTY);
      loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Monthly finance status</h1>
        <p className="mt-1 text-sm text-muted">
          Record your numbers each month. We score every month and build your financial
          history — your dashboard and AI advisor use it to see how things are trending.
        </p>
      </header>

      {error && (
        <section className="rounded-card bg-high-bg p-4 text-sm text-high shadow-card">
          {error}
        </section>
      )}

      {savedMonth && (
        <section className="flex items-center justify-between gap-4 rounded-card bg-low-bg p-4 text-sm text-low shadow-card">
          <span>Saved {formatMonth(savedMonth)}. It&apos;s now scored and in your history.</span>
          <Link href="/" className="font-semibold underline">
            View dashboard →
          </Link>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Entry form */}
        <div className="lg:col-span-3">
          <Card>
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col">
                <label htmlFor="month" className="text-sm font-semibold">
                  Month
                </label>
                <input
                  id="month"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="mt-1 w-48 rounded-field bg-field px-4 py-3 text-base shadow-soft outline-none transition focus:shadow-focus"
                />
              </div>

              {SECTION_ORDER.map((section) => (
                <div key={section} className="flex flex-col gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
                    {MONTHLY_SECTIONS[section]}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {MONTHLY_FIELDS.filter((f) => f.section === section).map((f) => (
                      <div key={f.key} className="flex flex-col">
                        <label htmlFor={f.key} className="text-sm font-semibold">
                          {f.label}
                        </label>
                        <p className="mt-1 text-xs text-muted">{f.hint}</p>
                        <div className="mt-auto flex items-center rounded-field bg-field pl-3 shadow-soft focus-within:shadow-focus">
                          <span className="text-sm text-muted">$</span>
                          <input
                            id={f.key}
                            type="number"
                            step="any"
                            value={form[f.key]}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, [f.key]: e.target.value }))
                            }
                            placeholder={f.placeholder}
                            className="w-full bg-transparent px-2 py-3 text-base outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Derived, so the owner sees the accounting fall out */}
              <div className="flex flex-wrap gap-4 rounded-field bg-field px-4 py-3 text-sm">
                <span className="text-muted">
                  Net profit{" "}
                  <span className="font-semibold text-ink">
                    {formatMoney(netProfit(figures))}
                  </span>
                </span>
                <span className="text-muted">
                  Equity{" "}
                  <span className="font-semibold text-ink">
                    {formatMoney(equity(figures))}
                  </span>
                </span>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-field bg-brand px-4 py-4 text-base font-semibold text-white shadow-soft transition hover:bg-brand-strong disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save & score this month"}
              </button>
            </form>
          </Card>
        </div>

        {/* Months list */}
        <div className="lg:col-span-2">
          <Card>
            <CardTitle>Your months</CardTitle>
            {records === null && <p className="text-sm text-muted">Loading…</p>}
            {records && records.length === 0 && (
              <p className="text-sm text-muted">No months recorded yet.</p>
            )}
            {records && records.length > 0 && (
              <div className="flex flex-col gap-2">
                {records.map((r) => {
                  const band = indexBand(r.riskIndex);
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-field bg-field p-3"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ink">
                          {r.month ? formatMonth(r.month) : "—"}
                        </span>
                        {r.figures && (
                          <span className="text-xs text-muted">
                            Rev {formatMoney(r.figures.revenue)} · Cash{" "}
                            {formatMoney(r.figures.cash)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_BG_SOFT[band.tone]} ${TONE_TEXT[band.tone]}`}
                      >
                        {r.riskIndex}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <Link
              href="/history"
              className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Open full history →
            </Link>
          </Card>
        </div>
      </div>
    </main>
  );
}
