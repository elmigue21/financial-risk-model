import { PredictResult } from "../fields";
import type { AiFlag } from "./insights";
import type { ChatMessage } from "../components/AdvisorChat";
import type { MonthlyFigures } from "./monthly";

/**
 * Shared shapes for a saved prediction session. Kept free of any server-only
 * (better-sqlite3) imports so both the API routes and client pages can use it.
 */

/** A full saved session — inputs, the model result, and all derived AI data. */
export interface HistoryRecord {
  id: number;
  /** UTC timestamp assigned by SQLite (datetime('now')). */
  createdAt: string;
  /** Human-friendly assessment date shown on the dashboard, e.g. "July 2026". */
  assessedOn: string | null;
  /** The month this record represents, "YYYY-MM" (null for legacy records). */
  month: string | null;
  /** Raw dollar figures the owner entered for the month (null for legacy). */
  figures: MonthlyFigures | null;
  inputs: Record<string, number>;
  result: PredictResult;
  riskIndex: number;
  aiFlags: AiFlag[] | null;
  messages: ChatMessage[];
  suggestions: string[];
}

/** Lightweight row for the history list (no heavy JSON blobs). */
export interface HistorySummary {
  id: number;
  createdAt: string;
  assessedOn: string | null;
  month: string | null;
  probability: number;
  riskLevel: PredictResult["risk_level"];
  riskIndex: number;
  inputs: Record<string, number>;
  figures: MonthlyFigures | null;
}

/** Payload the client sends to create a record right after a prediction. */
export interface CreateHistoryInput {
  assessedOn?: string | null;
  /** When set, the record is upserted by month (one assessment per month). */
  month?: string | null;
  figures?: MonthlyFigures | null;
  inputs: Record<string, number>;
  result: PredictResult;
  riskIndex: number;
}

/** Fields the client patches in later as async AI data arrives. */
export interface UpdateHistoryInput {
  aiFlags?: AiFlag[] | null;
  messages?: ChatMessage[];
  suggestions?: string[];
}
