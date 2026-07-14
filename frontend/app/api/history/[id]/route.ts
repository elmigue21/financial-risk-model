import { NextResponse } from "next/server";
import { deletePrediction, getPrediction, updatePrediction } from "../../../lib/db";
import { getSession } from "../../../lib/session";
import type { UpdateHistoryInput } from "../../../lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** GET /api/history/[id] — one full session (only the owner's — NFR-AUTH-002). */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  try {
    const record = getPrediction(session.userId, id);
    if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ record });
  } catch (err) {
    console.error("[history] get failed:", err);
    return NextResponse.json({ error: "Could not read record." }, { status: 500 });
  }
}

/** PATCH /api/history/[id] — attach async AI data (flags, chat, suggestions). */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  try {
    const patch = (await req.json()) as UpdateHistoryInput;
    const ok = updatePrediction(session.userId, id, patch);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error("[history] update failed:", err);
    return NextResponse.json({ error: "Could not update record." }, { status: 500 });
  }
}

/** DELETE /api/history/[id] — remove one of the user's sessions. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  try {
    const ok = deletePrediction(session.userId, id);
    if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok });
  } catch (err) {
    console.error("[history] delete failed:", err);
    return NextResponse.json({ error: "Could not delete record." }, { status: 500 });
  }
}
