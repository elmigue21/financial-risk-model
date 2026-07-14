import { NextResponse } from "next/server";
import { createUser } from "../../../lib/db";
import { hashPassword } from "../../../lib/password";
import { setSessionCookie } from "../../../lib/session";
import { normalizeEmail, validateRegistration, type RegisterInput } from "../../../lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register — create an account (FR-AUTH-001).
 * Validates the fields (FR-AUTH-001.2/.4), enforces a unique email
 * (FR-AUTH-001.3), stores the password hashed (NFR-AUTH-001), then signs the
 * user in so they land straight on the dashboard.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<RegisterInput>;

    const errors = validateRegistration(body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const email = normalizeEmail(body.email!);
    const passwordHash = await hashPassword(body.password!);

    let user;
    try {
      user = createUser({
        fullName: body.fullName!.trim(),
        email,
        passwordHash,
      });
    } catch (err: any) {
      if (typeof err?.code === "string" && err.code.includes("CONSTRAINT")) {
        return NextResponse.json(
          { error: "An account with that email already exists." },
          { status: 409 }
        );
      }
      throw err;
    }

    // FR-AUTH-001.5 — success; sign in immediately.
    const res = NextResponse.json({ user }, { status: 201 });
    await setSessionCookie(res, { userId: user.id, email: user.email, name: user.fullName });
    return res;
  } catch (err) {
    console.error("[auth] register failed:", err);
    return NextResponse.json({ error: "Could not create your account." }, { status: 500 });
  }
}
