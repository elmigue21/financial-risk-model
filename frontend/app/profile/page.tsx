"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "../components/ui";
import { Field, inputClass, submitClass } from "../components/AuthForm";
import {
  PASSWORD_MIN,
  validatePasswordChange,
  validateProfile,
  type ProfileInput,
  type User,
} from "../lib/user";

/**
 * Account page — view and update the profile (FR-AUTH-005) and change the
 * password (FR-AUTH-006). Both forms validate client-side and surface the
 * server's messages inline (NFR-AUTH-006).
 */
export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load your profile.");
        setUser((await res.json()).user as User);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Your account</h1>
        <p className="mt-1 text-sm text-muted">
          Update your profile details or change your password.
        </p>
      </header>

      {loadError && (
        <section className="rounded-card bg-high-bg p-4 text-sm text-high shadow-card">
          {loadError}
        </section>
      )}
      {loading && (
        <section className="rounded-card bg-surface p-10 text-center text-sm text-muted shadow-card">
          Loading…
        </section>
      )}

      {user && (
        <>
          <ProfileCard user={user} onSaved={setUser} />
          <PasswordCard />
          <SignOutRow router={router} />
        </>
      )}
    </main>
  );
}

function ProfileCard({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const [form, setForm] = useState<ProfileInput>({
    fullName: user.fullName,
    email: user.email,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function set<K extends keyof ProfileInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problems = validateProfile(form);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setErrors([]);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save your profile.");
      onSaved(data.user as User);
      setSaved(true);
      router.refresh(); // refresh the nav's greeting
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardTitle>Profile</CardTitle>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {errors.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-field bg-high-bg px-3 py-2 text-sm text-high">
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}
        {saved && (
          <p className="rounded-field bg-low-bg px-3 py-2 text-sm text-low">
            Profile saved.
          </p>
        )}
        <Field label="Full name" htmlFor="fullName">
          <input
            id="fullName"
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
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <button type="submit" disabled={saving} className={submitClass}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const problems = validatePasswordChange(form);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setErrors([]);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not change your password.");
      setSaved(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardTitle>Change password</CardTitle>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {errors.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-field bg-high-bg px-3 py-2 text-sm text-high">
            {errors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}
        {saved && (
          <p className="rounded-field bg-low-bg px-3 py-2 text-sm text-low">
            Password changed.
          </p>
        )}
        <Field label="Current password" htmlFor="currentPassword">
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => set("currentPassword", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field
          label="New password"
          htmlFor="newPassword"
          hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`}
        >
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => set("newPassword", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmNewPassword">
          <input
            id="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <button type="submit" disabled={saving} className={submitClass}>
          {saving ? "Updating…" : "Change password"}
        </button>
      </form>
    </Card>
  );
}

function SignOutRow({ router }: { router: ReturnType<typeof useRouter> }) {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="flex justify-end">
      <button
        onClick={signOut}
        disabled={busy}
        className="rounded-field px-4 py-2.5 text-sm font-semibold text-high transition hover:bg-high-bg disabled:opacity-60"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
