import { SignJWT, jwtVerify } from "jose";

/**
 * Signed session tokens (JWT, HS256). This module is deliberately dependency-light
 * — only `jose`, which runs on the Edge runtime — so it can be imported from
 * `middleware.ts` to gate routes without pulling in better-sqlite3 or bcrypt.
 *
 * The token is the whole session: a valid signature + unexpired `exp` means the
 * user is authenticated. Expiry drives re-authentication (NFR-AUTH-004.3).
 */

/** Cookie that carries the session token. */
export const COOKIE_NAME = "fhc_session";

/** Session lifetime, in seconds (7 days). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Claims we care about, decoded from a verified token. */
export interface SessionPayload {
  userId: number;
  email: string;
  name: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    // A stable dev fallback keeps local runs working without setup. Anything
    // real must set AUTH_SECRET — warn loudly so it isn't shipped unset.
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set. Refusing to sign sessions in production.");
    }
    console.warn(
      "[auth] AUTH_SECRET is not set — using an insecure development fallback. " +
        "Set AUTH_SECRET in .env.local before deploying."
    );
    return new TextEncoder().encode("dev-insecure-secret-change-me-0123456789abcdef");
  }
  return new TextEncoder().encode(secret);
}

/** Sign a session token for a user. */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(payload.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/** Verify a token and return its payload, or null if invalid/expired. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return {
      userId,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}
