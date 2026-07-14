"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, Field, inputClass, submitClass } from "../components/AuthForm";
import { PASSWORD_MIN, validateRegistration, type RegisterInput } from "../lib/user";

/**
 * Registration page (FR-AUTH-001). Collects the five required fields, validates
 * them client-side for instant feedback (the server re-validates), then — on
 * success — the user is signed in and sent to the dashboard.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterInput>({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof RegisterInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problems = validateRegistration(form);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not create your account.");
      }
      // FR-AUTH-001.5 — registered and signed in; go to the dashboard.
      router.replace("/");
      router.refresh();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong."]);
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Start tracking your financial health.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {errors.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-field bg-high-bg px-3 py-2 text-sm text-high">
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}
        <Field label="Full name" htmlFor="fullName">
          <input
            id="fullName"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Email address" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`}
        >
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword">
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <button type="submit" disabled={submitting} className={submitClass}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
