import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  SessionPayload,
  signSessionToken,
  verifySessionToken,
} from "./jwt";

/**
 * Server-side session helpers for route handlers and server components.
 * Reads the session cookie via next/headers and manages the cookie lifecycle.
 * Node runtime only (route handlers / server components) — middleware uses
 * the lighter jwt.ts directly.
 */

/** The current authenticated user's claims, or null if signed out. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/** Issue a fresh session cookie on a response (login/register/profile update). */
export async function setSessionCookie(res: NextResponse, payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  res.cookies.set({ name: COOKIE_NAME, value: token, ...cookieBase, maxAge: SESSION_MAX_AGE });
}

/** Clear the session cookie on a response (logout, FR-AUTH-003.2). */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({ name: COOKIE_NAME, value: "", ...cookieBase, maxAge: 0 });
}
