"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FIELDS } from "../fields";
import {
  classifyRatio,
  formatValue,
  healthScore,
  indexBand,
} from "../lib/scoring";
import { severityTone } from "../lib/insights";
import { MONTHLY_FIELDS, netProfit, formatMoney, formatMonth } from "../lib/monthly";
import { useAdvisor } from "../lib/useAdvisor";
import { downloadCsv, historyToCsv, recordToCsv, recordSlug } from "../lib/report";
import { exportElementToPdf } from "../lib/pdf";
import type { HistoryRecord, HistorySummary, UpdateHistoryInput } from "../lib/history";
import { Card, CardTitle, StatusPill, TONE_BG_SOFT, TONE_TEXT } from "../components/ui";
import { TopCards } from "../components/TopCards";
import { RiskFactors } from "../components/RiskFactors";
import { ReportHeader } from "../components/ReportHeader";
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
          conversation.
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
        <div className="flex flex-col gap-6">
          {/* Toolbar — export the whole history as one Excel-openable table */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {records.length} month{records.length === 1 ? "" : "s"} recorded
            </p>
            <button
              onClick={() =>
                downloadCsv("financial-health-history.csv", historyToCsv(records))
              }
              className="rounded-field bg-field px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
            >
              ⬇ Export CSV (Excel)
            </button>
          </div>

          {/* Records table — click a row to open its full report below */}
          <div
            className={`overflow-x-auto rounded-card bg-surface shadow-card ${
              selectedId ? "no-print" : ""
            }`}
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-semibold">Month</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Risk index</th>
                  <th className="px-4 py-3 text-right font-semibold">Trouble risk</th>
                  <th className="px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const band = indexBand(r.riskIndex);
                  const active = r.id === selectedId;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => select(r.id)}
                      className={`cursor-pointer border-t border-canvas transition hover:bg-field ${
                        active ? "bg-field" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-semibold text-ink">
                        {r.month ? formatMonth(r.month) : formatWhen(r.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_BG_SOFT[band.tone]} ${TONE_TEXT[band.tone]}`}
                        >
                          {band.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-ink">
                        {r.riskIndex}
                      </td>
                      <td className="px-4 py-3 text-right text-ink">
                        {Math.round(r.probability * 100)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-semibold text-brand">
                          {active ? "Viewing" : "View →"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Detail — the selected month's full, printable report */}
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
  const reportRef = useRef<HTMLDivElement>(null);

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

  const monthLabel =
    record.assessedOn ?? (record.month ? formatMonth(record.month) : formatWhen(record.createdAt));

  return (
    <div ref={reportRef} className="flex flex-col gap-4">
      <ReportHeader
        title="Financial Health Report"
        monthLabel={monthLabel}
        onExportCsv={() =>
          downloadCsv(`financial-health-report-${recordSlug(record)}.csv`, recordToCsv(record))
        }
        onExportPdf={() =>
          exportElementToPdf(
            reportRef.current,
            `financial-health-report-${recordSlug(record)}.pdf`
          )
        }
      />

      <div className="no-print flex justify-end">
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
      <div className="no-print">
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
    </div>
  );
}
