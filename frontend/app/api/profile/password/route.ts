import { NextResponse } from "next/server";
import { getUserHash, updateUserPassword } from "../../../lib/db";
import { hashPassword, verifyPassword } from "../../../lib/password";
import { getSession } from "../../../lib/session";
import { validatePasswordChange, type PasswordChangeInput } from "../../../lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/profile/password — change the signed-in user's password (FR-AUTH-006).
 * Requires the current password (FR-AUTH-006.2) and a confirmed new one (FR-AUTH-006.3).
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<PasswordChangeInput>;
    const errors = validatePasswordChange(body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0], errors }, { status: 400 });
    }

    const currentHash = getUserHash(session.userId);
    if (!currentHash) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const ok = await verifyPassword(body.currentPassword!, currentHash);
    if (!ok) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }

    await updateUserPasswordFor(session.userId, body.newPassword!);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth] password change failed:", err);
    return NextResponse.json({ error: "Could not change your password." }, { status: 500 });
  }
}

async function updateUserPasswordFor(userId: number, newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  updateUserPassword(userId, hash);
}
