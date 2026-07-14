import bcrypt from "bcryptjs";

/**
 * Password hashing (NFR-AUTH-001 — passwords are stored hashed, never plain).
 * bcryptjs is a pure-JS implementation, so there's no native build step on
 * Windows. Server-only: this must never reach the browser.
 */

const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
