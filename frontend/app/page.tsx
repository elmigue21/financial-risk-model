"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PredictResult } from "./fields";
import { riskIndex } from "./lib/scoring";
import { AiFlag } from "./lib/insights";
import type { HistoryRecord, HistorySummary, UpdateHistoryInput } from "./lib/history";
import { formatMonth } from "./lib/monthly";
import { useAdvisor } from "./lib/useAdvisor";
import { Dashboard } from "./components/Dashboard";
import { AdvisorChat } from "./components/AdvisorChat";

export default function Home() {
  const [record, setRecord] = useState<HistoryRecord | null>(null);
  const [aiFlags, setAiFlags] = useState<AiFlag[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Id of the loaded month, reused to patch in AI data as it streams in.
  const historyIdRef = useRef<number | null>(null);

  /** Fire-and-forget patch of the current record with async AI data. */
  function patchHistory(patch: UpdateHistoryInput) {
    const id = historyIdRef.current;
    if (id == null) return;
    fetch(`/api/history/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {
      /* history is best-effort — a failed save never blocks the UI */
    });
  }

  const advisor = useAdvisor(patchHistory);

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Load the most recent month and show its assessment. */
  async function loadLatest() {
    setLoading(true);
    setError("");
    try {
      const listRes = await fetch("/api/history", { cache: "no-store" });
      if (!listRes.ok) throw new Error("Could not load your data.");
      const { records } = (await listRes.json()) as { records: HistorySummary[] };
      const latest = records.find((r) => r.month); // list is newest-first
      if (!latest) {
        setRecord(null);
        return;
      }
      const detRes = await fetch(`/api/history/${latest.id}`, { cache: "no-store" });
      if (!detRes.ok) throw new Error("Could not load your latest month.");
      const rec = (await detRes.json()).record as HistoryRecord;

      setRecord(rec);
      historyIdRef.current = rec.id;
      setAiFlags(rec.aiFlags);

      const ctx = { inputs: rec.inputs, result: rec.result };
      if (rec.messages && rec.messages.length > 0) {
        // Already assessed before — pick the advisor thread back up.
        advisor.resume(ctx, rec.messages, rec.suggestions);
      } else {
        // Fresh month — generate the opening assessment + questions + flags.
        advisor.begin(ctx);
        fetchFlags(rec.inputs, rec.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  /** Ask the AI which inputs are problematic (structured, non-streaming). */
  async function fetchFlags(
    ctxInputs: Record<string, number>,
    ctxResult: PredictResult
  ) {
    try {
      const res = await fetch("/api/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: ctxInputs,
          riskIndex: riskIndex(ctxResult.probability),
          contributions: ctxResult.contributions,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.flags) && data.flags.length > 0) {
        setAiFlags(data.flags as AiFlag[]);
        patchHistory({ aiFlags: data.flags as AiFlag[] });
      }
    } catch {
      /* deterministic insights remain as the fallback */
    }
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Financial Health Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Your latest monthly assessment, explained — with an AI advisor that knows your
          history.
        </p>
      </header>

      {error && (
        <section className="rounded-card bg-high-bg p-4 text-center text-sm text-high shadow-card">
          {error}
        </section>
      )}

      {loading && (
        <section className="rounded-card bg-surface p-10 text-center text-sm text-muted shadow-card">
          Loading…
        </section>
      )}

      {!loading && !record && !error && (
        <section className="rounded-card bg-surface p-10 text-center shadow-card">
          <p className="text-sm text-muted">
            No months recorded yet. Add your first monthly finance status to see your
            dashboard.
          </p>
          <Link
            href="/status"
            className="mt-4 inline-block rounded-field bg-brand px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong"
          >
            Add this month&apos;s numbers →
          </Link>
        </section>
      )}

      {!loading && record && (
        <Dashboard
          result={record.result}
          inputs={record.inputs}
          aiFlags={aiFlags}
          assessedOn={record.assessedOn ?? (record.month ? formatMonth(record.month) : "—")}
          chat={
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
          }
        />
      )}
    </main>
  );
}
