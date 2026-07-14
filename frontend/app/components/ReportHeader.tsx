"use client";

import { useEffect, useState } from "react";

/**
 * Header for a printable/downloadable report. Renders two things:
 *  - a `.print-only` letterhead (brand + title + month + generated time) that
 *    shows only on paper / in the PDF, and
 *  - an on-screen banner that makes the report's month obvious and carries the
 *    Print and Export actions (hidden from the printout via `.no-print`).
 */
export function ReportHeader({
  title,
  monthLabel,
  onExportCsv,
  onExportPdf,
}: {
  title: string;
  monthLabel: string;
  onExportCsv: () => void;
  onExportPdf?: () => void;
}) {
  // Filled after mount so the printed timestamp never causes a hydration
  // mismatch (server and first client render both start empty).
  const [generatedAt, setGeneratedAt] = useState("");
  useEffect(() => {
    setGeneratedAt(
      new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })
    );
  }, []);

  return (
    <>
      <header className="print-only report-letterhead">
        <p className="brand">Financial Health Check</p>
        <h1>{title}</h1>
        <p className="meta">
          {monthLabel}
          {generatedAt ? ` · Generated ${generatedAt}` : ""}
        </p>
      </header>

      <div className="no-print flex flex-wrap items-end justify-between gap-3 rounded-card bg-surface p-5 shadow-card">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {title}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-ink">{monthLabel}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {onExportPdf && (
            <button
              onClick={onExportPdf}
              className="rounded-field bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-strong"
            >
              ⬇ Export PDF
            </button>
          )}
          <button
            onClick={onExportCsv}
            className="rounded-field bg-field px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
          >
            ⬇ Export CSV
          </button>
        </div>
      </div>
    </>
  );
}
