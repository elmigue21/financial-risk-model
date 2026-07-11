import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { PredictResult } from "../fields";
import type { MonthlyFigures, MonthPoint } from "./monthly";
import type {
  CreateHistoryInput,
  HistoryRecord,
  HistorySummary,
  UpdateHistoryInput,
} from "./history";

/**
 * Local, file-based store for prediction sessions. SQLite keeps this
 * zero-config and serverless — the whole DB is one file under frontend/data.
 * The Python model service stays stateless; the frontend owns persistence
 * because it's the only layer that sees the full session (inputs + model
 * result + the AI flags, advisor conversation and suggestions).
 *
 * Server-only: this pulls in a native addon and must never reach the browser.
 * It's imported solely from route handlers under app/api/history.
 */

// Cache the connection on globalThis so Next's dev hot-reload doesn't reopen
// the file (and re-run the schema) on every request.
const g = globalThis as unknown as { __riskDb?: Database.Database };

function open(): Database.Database {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "app.db"));
  db.pragma("journal_mode = WAL"); // safe concurrent reads under route handlers
  return db;
}

/**
 * Idempotent schema setup + migration. Runs on every module load (not just when
 * the connection is first opened) so a cached hot-reload connection still picks
 * up new columns.
 */
function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      assessed_on   TEXT,
      month         TEXT,            -- "YYYY-MM"; one assessment per month
      figures       TEXT,            -- JSON: MonthlyFigures (raw dollar inputs)
      inputs        TEXT NOT NULL,   -- JSON: Record<FieldKey, number>
      probability   REAL NOT NULL,
      risk_level    TEXT NOT NULL,
      confidence    REAL,
      risk_index    INTEGER NOT NULL,
      contributions TEXT,            -- JSON: Contribution[]
      ai_flags      TEXT,            -- JSON: AiFlag[] | null
      messages      TEXT,            -- JSON: ChatMessage[]
      suggestions   TEXT             -- JSON: string[]
    );
  `);

  // Add the monthly columns to DBs created before they existed.
  const cols = (db.prepare("PRAGMA table_info(predictions)").all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!cols.includes("month")) db.exec("ALTER TABLE predictions ADD COLUMN month TEXT");
  if (!cols.includes("figures")) db.exec("ALTER TABLE predictions ADD COLUMN figures TEXT");
  // Unique month enables upsert-by-month; NULLs stay distinct (legacy rows).
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS predictions_month ON predictions(month)");
}

const db = g.__riskDb ?? (g.__riskDb = open());
migrate(db);

/** Shape of a raw row as stored (JSON columns still stringified). */
interface Row {
  id: number;
  created_at: string;
  assessed_on: string | null;
  month: string | null;
  figures: string | null;
  inputs: string;
  probability: number;
  risk_level: string;
  confidence: number | null;
  risk_index: number;
  contributions: string | null;
  ai_flags: string | null;
  messages: string | null;
  suggestions: string | null;
}

function parse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function toRecord(row: Row): HistoryRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    assessedOn: row.assessed_on,
    month: row.month,
    figures: parse(row.figures, null as MonthlyFigures | null),
    inputs: parse(row.inputs, {} as Record<string, number>),
    result: {
      probability: row.probability,
      risk_level: row.risk_level as PredictResult["risk_level"],
      confidence: row.confidence ?? 0,
      contributions: parse(row.contributions, []),
    },
    riskIndex: row.risk_index,
    aiFlags: parse(row.ai_flags, null as HistoryRecord["aiFlags"]),
    messages: parse(row.messages, []),
    suggestions: parse(row.suggestions, []),
  };
}

/**
 * Save a session. When `month` is set the row is upserted (one assessment per
 * month) and its AI data is reset, since the figures — and therefore the score —
 * are fresh. Returns the row id.
 */
export function createPrediction(data: CreateHistoryInput): number {
  const params = {
    assessed_on: data.assessedOn ?? null,
    month: data.month ?? null,
    figures: data.figures ? JSON.stringify(data.figures) : null,
    inputs: JSON.stringify(data.inputs ?? {}),
    probability: data.result.probability,
    risk_level: data.result.risk_level,
    confidence: data.result.confidence,
    risk_index: data.riskIndex,
    contributions: JSON.stringify(data.result.contributions ?? []),
  };
  const info = db
    .prepare(
      `INSERT INTO predictions
         (assessed_on, month, figures, inputs, probability, risk_level, confidence, risk_index, contributions, ai_flags, messages, suggestions)
       VALUES
         (@assessed_on, @month, @figures, @inputs, @probability, @risk_level, @confidence, @risk_index, @contributions, NULL, '[]', '[]')
       ON CONFLICT(month) DO UPDATE SET
         assessed_on   = excluded.assessed_on,
         figures       = excluded.figures,
         inputs        = excluded.inputs,
         probability   = excluded.probability,
         risk_level    = excluded.risk_level,
         confidence    = excluded.confidence,
         risk_index    = excluded.risk_index,
         contributions = excluded.contributions,
         ai_flags      = NULL,
         messages      = '[]',
         suggestions   = '[]',
         created_at    = datetime('now')`
    )
    .run(params);

  if (data.month) {
    const row = db
      .prepare(`SELECT id FROM predictions WHERE month = ?`)
      .get(data.month) as { id: number } | undefined;
    if (row) return row.id;
  }
  return Number(info.lastInsertRowid);
}

/** Patch in the async AI data (flags, conversation, suggestions) as it lands. */
export function updatePrediction(id: number, patch: UpdateHistoryInput): boolean {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  if ("aiFlags" in patch) {
    sets.push("ai_flags = @ai_flags");
    params.ai_flags = patch.aiFlags == null ? null : JSON.stringify(patch.aiFlags);
  }
  if ("messages" in patch) {
    sets.push("messages = @messages");
    params.messages = JSON.stringify(patch.messages ?? []);
  }
  if ("suggestions" in patch) {
    sets.push("suggestions = @suggestions");
    params.suggestions = JSON.stringify(patch.suggestions ?? []);
  }
  if (sets.length === 0) return false;
  const info = db
    .prepare(`UPDATE predictions SET ${sets.join(", ")} WHERE id = @id`)
    .run(params);
  return info.changes > 0;
}

/** All sessions, newest first, as lightweight summaries. */
export function listPredictions(): HistorySummary[] {
  const rows = db
    .prepare(
      `SELECT id, created_at, assessed_on, month, figures, inputs, probability, risk_level, risk_index
       FROM predictions ORDER BY id DESC`
    )
    .all() as Array<
    Pick<
      Row,
      | "id"
      | "created_at"
      | "assessed_on"
      | "month"
      | "figures"
      | "inputs"
      | "probability"
      | "risk_level"
      | "risk_index"
    >
  >;
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    assessedOn: r.assessed_on,
    month: r.month,
    probability: r.probability,
    riskLevel: r.risk_level as PredictResult["risk_level"],
    riskIndex: r.risk_index,
    inputs: parse(r.inputs, {} as Record<string, number>),
    figures: parse(r.figures, null as MonthlyFigures | null),
  }));
}

/** Monthly points (oldest first) for the advisor's financial-history summary. */
export function listMonths(): MonthPoint[] {
  const rows = db
    .prepare(
      `SELECT month, figures, risk_level, risk_index
       FROM predictions WHERE month IS NOT NULL AND figures IS NOT NULL
       ORDER BY month ASC`
    )
    .all() as Array<Pick<Row, "month" | "figures" | "risk_level" | "risk_index">>;
  return rows.map((r) => ({
    month: r.month as string,
    figures: parse(r.figures, {} as MonthlyFigures),
    riskLevel: r.risk_level as PredictResult["risk_level"],
    riskIndex: r.risk_index,
  }));
}

/** One full session, or null if the id doesn't exist. */
export function getPrediction(id: number): HistoryRecord | null {
  const row = db.prepare(`SELECT * FROM predictions WHERE id = ?`).get(id) as
    | Row
    | undefined;
  return row ? toRecord(row) : null;
}

/** Delete a session; returns true if a row was removed. */
export function deletePrediction(id: number): boolean {
  return db.prepare(`DELETE FROM predictions WHERE id = ?`).run(id).changes > 0;
}
