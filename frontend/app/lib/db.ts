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
import type { User } from "./user";

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
  // Accounts. Passwords are stored hashed (NFR-AUTH-001); email is unique
  // (FR-AUTH-001.3) and stored normalised (lower-cased) for case-insensitive
  // lookup and uniqueness.
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      full_name     TEXT NOT NULL,
      email         TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email)");

  // Drop the legacy company_name column from DBs created before it was removed,
  // so inserts (which no longer provide it) don't hit its NOT NULL constraint.
  const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map(
    (c) => c.name
  );
  if (userCols.includes("company_name")) db.exec("ALTER TABLE users DROP COLUMN company_name");

  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      user_id       INTEGER,         -- owner (FK users.id); NULL for legacy rows
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

  // Add columns to DBs created before they existed.
  const cols = (db.prepare("PRAGMA table_info(predictions)").all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!cols.includes("month")) db.exec("ALTER TABLE predictions ADD COLUMN month TEXT");
  if (!cols.includes("figures")) db.exec("ALTER TABLE predictions ADD COLUMN figures TEXT");
  if (!cols.includes("user_id")) db.exec("ALTER TABLE predictions ADD COLUMN user_id INTEGER");

  // Ownership makes "one assessment per month" a per-user rule, so the old
  // global unique index on month is replaced by a composite (user_id, month).
  // SQLite treats NULLs as distinct, so legacy NULL-owner rows never collide.
  db.exec("DROP INDEX IF EXISTS predictions_month");
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS predictions_user_month ON predictions(user_id, month)"
  );
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

/** The id of the given user's record for a month, or null if none exists yet. */
export function findPredictionByMonth(userId: number, month: string): number | null {
  const row = db
    .prepare(`SELECT id FROM predictions WHERE user_id = ? AND month = ?`)
    .get(userId, month) as { id: number } | undefined;
  return row ? row.id : null;
}

/**
 * Save a new session; returns its id. One record per month — the unique index
 * on `month` makes a duplicate insert throw (surfaced as a 409 by the route),
 * so an existing month must be deleted before it can be re-entered.
 */
export function createPrediction(userId: number, data: CreateHistoryInput): number {
  const info = db
    .prepare(
      `INSERT INTO predictions
         (user_id, assessed_on, month, figures, inputs, probability, risk_level, confidence, risk_index, contributions, ai_flags, messages, suggestions)
       VALUES
         (@user_id, @assessed_on, @month, @figures, @inputs, @probability, @risk_level, @confidence, @risk_index, @contributions, NULL, '[]', '[]')`
    )
    .run({
      user_id: userId,
      assessed_on: data.assessedOn ?? null,
      month: data.month ?? null,
      figures: data.figures ? JSON.stringify(data.figures) : null,
      inputs: JSON.stringify(data.inputs ?? {}),
      probability: data.result.probability,
      risk_level: data.result.risk_level,
      confidence: data.result.confidence,
      risk_index: data.riskIndex,
      contributions: JSON.stringify(data.result.contributions ?? []),
    });
  return Number(info.lastInsertRowid);
}

/**
 * Patch in the async AI data (flags, conversation, suggestions) as it lands.
 * Scoped to the owner so one user can never mutate another's record.
 */
export function updatePrediction(
  userId: number,
  id: number,
  patch: UpdateHistoryInput
): boolean {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id, user_id: userId };
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
    .prepare(`UPDATE predictions SET ${sets.join(", ")} WHERE id = @id AND user_id = @user_id`)
    .run(params);
  return info.changes > 0;
}

/** A user's sessions, newest first, as lightweight summaries. */
export function listPredictions(userId: number): HistorySummary[] {
  const rows = db
    .prepare(
      `SELECT id, created_at, assessed_on, month, figures, inputs, probability, risk_level, risk_index
       FROM predictions WHERE user_id = ? ORDER BY id DESC`
    )
    .all(userId) as Array<
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

/** A user's monthly points (oldest first) for the advisor's history summary. */
export function listMonths(userId: number): MonthPoint[] {
  const rows = db
    .prepare(
      `SELECT month, figures, risk_level, risk_index
       FROM predictions WHERE user_id = ? AND month IS NOT NULL AND figures IS NOT NULL
       ORDER BY month ASC`
    )
    .all(userId) as Array<Pick<Row, "month" | "figures" | "risk_level" | "risk_index">>;
  return rows.map((r) => ({
    month: r.month as string,
    figures: parse(r.figures, {} as MonthlyFigures),
    riskLevel: r.risk_level as PredictResult["risk_level"],
    riskIndex: r.risk_index,
  }));
}

/** One of the user's full sessions, or null if it doesn't exist or isn't theirs. */
export function getPrediction(userId: number, id: number): HistoryRecord | null {
  const row = db
    .prepare(`SELECT * FROM predictions WHERE id = ? AND user_id = ?`)
    .get(id, userId) as Row | undefined;
  return row ? toRecord(row) : null;
}

/** Delete one of the user's sessions; returns true if a row was removed. */
export function deletePrediction(userId: number, id: number): boolean {
  return (
    db.prepare(`DELETE FROM predictions WHERE id = ? AND user_id = ?`).run(id, userId).changes > 0
  );
}

/* --------------------------------------------------------------------------
 * Users
 * ------------------------------------------------------------------------ */

interface UserRow {
  id: number;
  created_at: string;
  full_name: string;
  email: string;
  password_hash: string;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    createdAt: row.created_at,
    fullName: row.full_name,
    email: row.email,
  };
}

/**
 * Create a user. The caller passes an already-hashed password and a normalised
 * (lower-cased) email. Throws a UNIQUE constraint error if the email is taken
 * (surfaced as a 409 by the route — FR-AUTH-001.3).
 */
export function createUser(data: {
  fullName: string;
  email: string;
  passwordHash: string;
}): User {
  const info = db
    .prepare(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES (@full_name, @email, @password_hash)`
    )
    .run({
      full_name: data.fullName,
      email: data.email,
      password_hash: data.passwordHash,
    });
  const user = getUserById(Number(info.lastInsertRowid));
  if (!user) throw new Error("User creation failed.");
  return user;
}

/** Look up a user by normalised email, including the hash (for login). */
export function getUserByEmailWithHash(
  email: string
): (User & { passwordHash: string }) | null {
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as
    | UserRow
    | undefined;
  return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
}

/** A user's public profile by id, or null if not found. */
export function getUserById(id: number): User | null {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

/** The stored password hash for a user (for verifying a password change). */
export function getUserHash(id: number): string | null {
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(id) as
    | { password_hash: string }
    | undefined;
  return row ? row.password_hash : null;
}

/** Whether an email is already registered to a *different* user. */
export function emailTakenByOther(email: string, excludeUserId: number): boolean {
  const row = db
    .prepare(`SELECT id FROM users WHERE email = ? AND id != ?`)
    .get(email, excludeUserId) as { id: number } | undefined;
  return row != null;
}

/** Update a user's profile fields (FR-AUTH-005.2). Email must be normalised. */
export function updateUserProfile(
  id: number,
  data: { fullName: string; email: string }
): User | null {
  db.prepare(
    `UPDATE users SET full_name = @full_name, email = @email
     WHERE id = @id`
  ).run({
    id,
    full_name: data.fullName,
    email: data.email,
  });
  return getUserById(id);
}

/** Replace a user's password hash (FR-AUTH-006.1). */
export function updateUserPassword(id: number, passwordHash: string): boolean {
  return (
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(passwordHash, id).changes >
    0
  );
}
