import { NextResponse } from "next/server";
import { createPrediction, findPredictionByMonth, listPredictions } from "../../lib/db";
import type { CreateHistoryInput } from "../../lib/history";

export const runtime = "nodejs";
// Always read fresh from disk — the list changes as new checks are run.
export const dynamic = "force-dynamic";

/** GET /api/history — all saved sessions, newest first (summaries). */
export function GET() {
  try {
    return NextResponse.json({ records: listPredictions() });
  } catch (err) {
    console.error("[history] list failed:", err);
    return NextResponse.json({ error: "Could not read history." }, { status: 500 });
  }
}

/** POST /api/history — create a session from a completed prediction. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateHistoryInput;
    if (!body?.result || typeof body.result.probability !== "number") {
      return NextResponse.json({ error: "Missing prediction result." }, { status: 400 });
    }
    // One record per month — reject duplicates so the owner deletes to re-enter.
    if (body.month && findPredictionByMonth(body.month) != null) {
      return NextResponse.json(
        { error: "You already have data for this month. Delete it first to re-enter." },
        { status: 409 }
      );
    }
    const id = createPrediction(body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err: any) {
    // Unique-index backstop in case of a race between the check and the insert.
    if (typeof err?.code === "string" && err.code.includes("CONSTRAINT")) {
      return NextResponse.json(
        { error: "You already have data for this month. Delete it first to re-enter." },
        { status: 409 }
      );
    }
    console.error("[history] create failed:", err);
    return NextResponse.json({ error: "Could not save prediction." }, { status: 500 });
  }
}
