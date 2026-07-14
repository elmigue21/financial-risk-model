import { FIELDS } from "../fields";
import { healthScore, indexBand, RISK_LEVEL_LABEL } from "./scoring";
import { netProfit, formatMonth } from "./monthly";
import type { HistoryRecord, HistorySummary } from "./history";

/**
 * Report generation — the download half of the report feature. Turns a saved
 * assessment (or the whole history) into an Excel-openable CSV. Pure string
 * building here; the browser-only download helper is guarded so this module
 * stays importable from anywhere client-side. (The "print" half is plain
 * `window.print()` against the print-optimised CSS in globals.css.)
 */

type Cell = string | number;

function csvEscape(value: Cell): string {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Join a grid of cells into RFC-4180 CSV text. */
export function toCsv(rows: Cell[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

/** Trigger a client-side download of CSV text (Excel-safe UTF-8 BOM). */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** A filesystem-safe slug for one assessment, preferring its "YYYY-MM" month. */
export function recordSlug(record: {
  month: string | null;
  assessedOn: string | null;
  id?: number;
}): string {
  if (record.month) return record.month;
  if (record.assessedOn)
    return record.assessedOn.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return record.id != null ? String(record.id) : "report";
}

/** A single assessment as a sectioned CSV (summary, figures, ratios, drivers). */
export function recordToCsv(record: HistoryRecord): string {
  const { result, inputs, figures } = record;
  const idx = record.riskIndex;
  const band = indexBand(idx);
  const rows: Cell[][] = [];

  rows.push(["Financial Health Report"]);
  rows.push(["Month", record.assessedOn ?? (record.month ? formatMonth(record.month) : "")]);
  rows.push([]);

  rows.push(["Summary"]);
  rows.push(["Metric", "Value"]);
  rows.push(["Health score (/100)", healthScore(result.probability)]);
  rows.push(["Risk index (/100)", idx]);
  rows.push(["Status", band.label]);
  rows.push(["Trouble risk (%)", Math.round(result.probability * 100)]);
  rows.push(["Model risk level", RISK_LEVEL_LABEL[result.risk_level]]);
  rows.push([]);

  if (figures) {
    rows.push(["Figures entered"]);
    rows.push(["Item", "Amount (USD)"]);
    rows.push(["Revenue", figures.revenue]);
    rows.push(["Expenses", figures.expenses]);
    rows.push(["Interest paid", figures.interest]);
    rows.push(["Net profit", netProfit(figures)]);
    rows.push(["Cash on hand", figures.cash]);
    rows.push(["Total assets", figures.assets]);
    rows.push(["Total liabilities", figures.liabilities]);
    rows.push(["Owner's equity", figures.equity]);
    rows.push([]);
  }

  rows.push([figures ? "Computed ratios" : "Reported ratios"]);
  rows.push(["Ratio", "Value", "Unit", "Scored by model"]);
  for (const f of FIELDS) {
    const v = inputs[f.key];
    if (v === undefined) continue;
    rows.push([f.shortLabel, v, f.unit, f.used ? "yes" : "no"]);
  }
  rows.push([]);

  rows.push(["Risk factor contributions"]);
  rows.push(["Factor", "Contribution (log-odds)", "Scored driver"]);
  for (const c of result.contributions) {
    rows.push([c.label, Number(c.contribution.toFixed(4)), c.is_scored_driver ? "yes" : "no"]);
  }

  return toCsv(rows);
}

/** The full history as one flat table — one month per row, ideal for Excel. */
export function historyToCsv(records: HistorySummary[]): string {
  const header: Cell[] = [
    "Month",
    "Assessed on",
    "Status",
    "Health score",
    "Risk index",
    "Trouble risk (%)",
    "Model risk level",
    ...FIELDS.map((f) => `${f.shortLabel} (${f.unit})`),
    "Revenue",
    "Expenses",
    "Net profit",
    "Cash",
    "Assets",
    "Liabilities",
    "Equity",
  ];

  // Oldest → newest reads best as a report table.
  const sorted = [...records].sort((a, b) =>
    (a.month ?? a.createdAt).localeCompare(b.month ?? b.createdAt)
  );

  const rows: Cell[][] = [header];
  for (const r of sorted) {
    const band = indexBand(r.riskIndex);
    const f = r.figures;
    rows.push([
      r.month ? formatMonth(r.month) : "",
      r.assessedOn ?? "",
      band.label,
      100 - r.riskIndex, // health score = 100 − risk index
      r.riskIndex,
      Math.round(r.probability * 100),
      RISK_LEVEL_LABEL[r.riskLevel],
      ...FIELDS.map((fld) => r.inputs[fld.key] ?? ""),
      f?.revenue ?? "",
      f?.expenses ?? "",
      f ? netProfit(f) : "",
      f?.cash ?? "",
      f?.assets ?? "",
      f?.liabilities ?? "",
      f?.equity ?? "",
    ]);
  }

  return toCsv(rows);
}
