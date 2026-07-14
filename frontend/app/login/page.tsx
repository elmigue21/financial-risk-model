"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, Field, inputClass, submitClass } from "../components/AuthForm";

/**
 * Sign-in page (FR-AUTH-002). On success the browser is sent to the dashboard
 * (or the `next` path it was redirected from). Errors are shown inline
 * (FR-AUTH-002.4 / NFR-AUTH-006).
 */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error;
        throw new Error(msg || "Could not sign you in.");
      }
      // FR-AUTH-002.3 — redirect authenticated users to the dashboard.
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Financial Health Check.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && (
          <p className="rounded-field bg-high-bg px-3 py-2 text-sm text-high">{error}</p>
        )}
        <Field label="Email address" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <button type="submit" disabled={submitting} className={submitClass}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/register" className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<AuthShell title="Welcome back" subtitle="Loading…">{null}</AuthShell>}
    >
      <LoginForm />
    </Suspense>
  );
}
