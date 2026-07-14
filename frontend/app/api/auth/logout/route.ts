import { NextResponse } from "next/server";
import { clearSessionCookie } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — end the session (FR-AUTH-003).
 * Clears the session cookie (FR-AUTH-003.2); the client redirects to /login.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
