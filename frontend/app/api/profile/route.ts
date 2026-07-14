import { NextResponse } from "next/server";
import { emailTakenByOther, getUserById, updateUserProfile } from "../../lib/db";
import { getSession, setSessionCookie } from "../../lib/session";
import { normalizeEmail, validateProfile, type ProfileInput } from "../../lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/profile — the signed-in user's profile (FR-AUTH-005.1). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const user = getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({ user });
}

/** PATCH /api/profile — update the signed-in user's profile (FR-AUTH-005.2/.3). */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<ProfileInput>;
    const errors = validateProfile(body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const email = normalizeEmail(body.email!);
    if (emailTakenByOther(email, session.userId)) {
      return NextResponse.json(
        { error: "That email is already in use by another account." },
        { status: 409 }
      );
    }

    const user = updateUserProfile(session.userId, {
      fullName: body.fullName!.trim(),
      email,
    });
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    // Keep the session token's name/email in sync with the saved profile.
    const res = NextResponse.json({ user });
    await setSessionCookie(res, { userId: user.id, email: user.email, name: user.fullName });
    return res;
  } catch (err) {
    console.error("[auth] profile update failed:", err);
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }
}
