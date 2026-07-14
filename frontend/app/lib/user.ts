/**
 * Shared user shapes and input validation. Kept free of any server-only
 * imports (better-sqlite3, bcrypt, jose) so both the API routes and the client
 * pages can import the same types and validators — one source of truth for the
 * validation messages the auth forms show (FR input-validation, NFR-AUTH-006).
 */

/** A user as exposed to the client — never carries the password hash. */
export interface User {
  id: number;
  fullName: string;
  email: string;
  createdAt: string;
}

/** Fields collected at registration (FR-AUTH-001.1). */
export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Profile fields the user may edit (FR-AUTH-005.2). */
export interface ProfileInput {
  fullName: string;
  email: string;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const PASSWORD_MIN = 8;

/** RFC-lite email check — good enough to reject obvious typos client-side. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Normalise an email for storage and lookup so uniqueness is case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Password complexity (NFR-AUTH-001 companion / optional complexity rule):
 * at least PASSWORD_MIN chars with a letter and a number. Returns an error
 * message, or null when the password is acceptable.
 */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

/**
 * Validate a registration payload. Returns a list of human-readable problems;
 * an empty list means the input is valid. Used authoritatively on the server
 * (FR-AUTH-001.2/.4) and for instant feedback on the form.
 */
export function validateRegistration(input: Partial<RegisterInput>): string[] {
  const errors: string[] = [];
  if (!input.fullName?.trim()) errors.push("Full name is required.");
  if (!input.email?.trim()) errors.push("Email address is required.");
  else if (!isValidEmail(input.email)) errors.push("Enter a valid email address.");

  const pw = input.password ?? "";
  if (!pw) errors.push("Password is required.");
  else {
    const problem = passwordProblem(pw);
    if (problem) errors.push(problem);
  }

  if (!input.confirmPassword) errors.push("Please confirm your password.");
  else if (pw && pw !== input.confirmPassword) errors.push("Passwords do not match.");

  return errors;
}

/** Validate a profile update (FR-AUTH-005.3). */
export function validateProfile(input: Partial<ProfileInput>): string[] {
  const errors: string[] = [];
  if (!input.fullName?.trim()) errors.push("Full name is required.");
  if (!input.email?.trim()) errors.push("Email address is required.");
  else if (!isValidEmail(input.email)) errors.push("Enter a valid email address.");
  return errors;
}

/** Validate a password change (FR-AUTH-006). */
export function validatePasswordChange(input: Partial<PasswordChangeInput>): string[] {
  const errors: string[] = [];
  if (!input.currentPassword) errors.push("Enter your current password.");
  const pw = input.newPassword ?? "";
  if (!pw) errors.push("Enter a new password.");
  else {
    const problem = passwordProblem(pw);
    if (problem) errors.push(problem);
  }
  if (!input.confirmPassword) errors.push("Please confirm your new password.");
  else if (pw && pw !== input.confirmPassword) errors.push("New passwords do not match.");
  return errors;
}
