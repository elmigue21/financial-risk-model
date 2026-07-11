"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FIELDS } from "../fields";
import {
  classifyRatio,
  formatValue,
  healthScore,
  indexBand,
} from "../lib/scoring";
import { severityTone } from "../lib/insights";
import {
  MONTHLY_FIELDS,
  equity,
  netProfit,
  formatMoney,
} from "../lib/monthly";
import { useAdvisor } from "../lib/useAdvisor";
import type { HistoryRecord, HistorySummary, UpdateHistoryInput } from "../lib/history";
import { Card, CardTitle, StatusPill, TONE_BG_SOFT, TONE_TEXT } from "../components/ui";
import { TopCards } from "../components/TopCards";
import { RiskFactors } from "../components/RiskFactors";
import { AdvisorChat } from "../components/AdvisorChat";

const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

/** SQLite stores UTC without a zone marker; render it in the local zone. */
function formatWhen(createdAt: string): string {
  const d = new Date(createdAt.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return createdAt;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistorySummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<HistoryRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadList() {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load history.");
      const data = await res.json();
      setRecords(data.records as HistorySummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setRecords([]);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  async function select(id: number) {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/history/${id}`, { cache: "no-store" });
      if (res.ok) setDetail((await res.json()).record as HistoryRecord);
    } finally {
      setDetailLoading(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this saved assessment?")) return;
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
    }
    loadList();
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Prediction history</h1>
        <p className="mt-1 text-sm text-muted">
          Every financial health check you&apos;ve run, with its AI insights and advisor
          conversation. Stored locally on this machine.
        </p>
      </header>

      {error && (
        <section className="rounded-card bg-high-bg p-4 text-sm text-high shadow-card">
          {error}
        </section>
      )}

      {records && records.length === 0 && !error && (
        <section className="rounded-card bg-surface p-10 text-center text-sm text-muted shadow-card">
          No saved assessments yet.{" "}
          <Link href="/" className="font-semibold text-brand hover:underline">
            Run your first check
          </Link>
          .
        </section>
      )}

      {records === null && (
        <section className="rounded-card bg-surface p-10 text-center text-sm text-muted shadow-card">
          Loading…
        </section>
      )}

      {records && records.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* List */}
          <div className="flex flex-col gap-3 lg:col-span-2">
            {records.map((r) => {
              const band = indexBand(r.riskIndex);
              const active = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  onClick={() => select(r.id)}
                  className={`rounded-card bg-surface p-4 text-left shadow-card transition hover:shadow-focus ${
                    active ? "shadow-focus" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {formatWhen(r.createdAt)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_BG_SOFT[band.tone]} ${TONE_TEXT[band.tone]}`}
                    >
                      {band.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                    <span>
                      Risk index{" "}
                      <span className="font-semibold text-ink">{r.riskIndex}</span>
                    </span>
                    <span>
                      Trouble risk{" "}
                      <span className="font-semibold text-ink">
                        {Math.round(r.probability * 100)}%
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            {!selectedId && (
              <Card className="text-center text-sm text-muted">
                Select an assessment to see its full details.
              </Card>
            )}
            {selectedId && detailLoading && (
              <Card className="text-center text-sm text-muted">Loading…</Card>
            )}
            {detail && !detailLoading && (
              <Detail
                key={detail.id}
                record={detail}
                onDelete={() => remove(detail.id)}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Detail({
  record,
  onDelete,
}: {
  record: HistoryRecord;
  onDelete: () => void;
}) {
  const { result, inputs, figures, riskIndex: idx, aiFlags } = record;
  const band = indexBand(idx);
  const providedFields = FIELDS.filter((f) => inputs[f.key] !== undefined);

  // Continue the saved advisor conversation. Replies + suggestions are
  // persisted straight back onto this record so the thread stays up to date.
  function persist(patch: UpdateHistoryInput) {
    fetch(`/api/history/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {
      /* best-effort — a failed save never blocks the chat */
    });
  }

  const advisor = useAdvisor(persist);

  // Seed the hook once from the saved thread (Detail remounts per record via key).
  useEffect(() => {
    advisor.resume({ inputs, result }, record.messages, record.suggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {record.assessedOn ?? formatWhen(record.createdAt)}
        </h2>
        <button
          onClick={onDelete}
          className="rounded-field px-3 py-1.5 text-xs font-semibold text-high transition hover:bg-high-bg"
        >
          Delete
        </button>
      </div>

      <TopCards
        result={result}
        healthScore={healthScore(result.probability)}
        riskIndex={idx}
        band={band}
        assessedOn={record.assessedOn ?? "—"}
      />

      {/* Dollar figures the owner entered for the month */}
      {figures && (
        <Card>
          <CardTitle>Figures you entered</CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MONTHLY_FIELDS.map((f) => (
              <div key={f.key} className="rounded-field bg-field p-3">
                <p className="text-xs text-muted">{f.label}</p>
                <p className="mt-1 text-base font-bold text-ink">
                  {formatMoney(figures[f.key])}
                </p>
              </div>
            ))}
            <div className="rounded-field bg-field p-3">
              <p className="text-xs text-muted">Net profit</p>
              <p className="mt-1 text-base font-bold text-ink">
                {formatMoney(netProfit(figures))}
              </p>
            </div>
            <div className="rounded-field bg-field p-3">
              <p className="text-xs text-muted">Equity</p>
              <p className="mt-1 text-base font-bold text-ink">
                {formatMoney(equity(figures))}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Computed ratios (what the model scored) */}
      <Card>
        <CardTitle>{figures ? "Computed ratios" : "Reported figures"}</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {providedFields.map((f) => {
            const status = classifyRatio(f, inputs[f.key]);
            return (
              <div key={f.key} className="rounded-field bg-field p-3">
                <p className="text-xs text-muted">{f.shortLabel}</p>
                <p className="mt-1 text-lg font-bold text-ink">
                  {formatValue(f, inputs[f.key])}
                </p>
                <div className="mt-1">
                  <StatusPill tone={status.tone} label={status.status} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <RiskFactors contributions={result.contributions} />

      {/* AI flags */}
      {aiFlags && aiFlags.length > 0 && (
        <Card>
          <CardTitle>AI insights</CardTitle>
          <ul className="flex flex-col gap-2">
            {aiFlags.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <StatusPill
                  tone={severityTone(f.severity)}
                  label={FIELD_BY_KEY[f.field]?.shortLabel ?? f.field}
                />
                <span className="text-ink">{f.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Advisor conversation — resumable: pick up the thread where it left off */}
      <AdvisorChat
        messages={advisor.messages}
        chatInput={advisor.chatInput}
        setChatInput={advisor.setChatInput}
        onSend={advisor.onSend}
        onPick={advisor.pickQuestion}
        suggestions={advisor.suggestions}
        suggestLoading={advisor.suggestLoading}
        chatting={advisor.chatting}
      />
    </div>
  );
}
