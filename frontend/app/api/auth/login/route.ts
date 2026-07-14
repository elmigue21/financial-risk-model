import { NextResponse } from "next/server";
import { getUserByEmailWithHash } from "../../../lib/db";
import { verifyPassword } from "../../../lib/password";
import { setSessionCookie } from "../../../lib/session";
import { normalizeEmail, type LoginInput } from "../../../lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login — authenticate and start a session (FR-AUTH-002).
 * On bad credentials we return a single generic message (FR-AUTH-002.4) so we
 * never reveal whether the email exists.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<LoginInput>;
    if (!body.email?.trim() || !body.password) {
      return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
    }

    const invalid = NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 }
    );

    const account = getUserByEmailWithHash(normalizeEmail(body.email));
    if (!account) return invalid;

    const ok = await verifyPassword(body.password, account.passwordHash);
    if (!ok) return invalid;

    const { passwordHash, ...user } = account;
    const res = NextResponse.json({ user });
    await setSessionCookie(res, { userId: user.id, email: user.email, name: user.fullName });
    return res;
  } catch (err) {
    console.error("[auth] login failed:", err);
    return NextResponse.json({ error: "Could not sign you in." }, { status: 500 });
  }
}
