"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/status", label: "Finance status" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Account" },
];

/** Routes that render their own full-screen layout and shouldn't show the nav. */
const HIDDEN_ON = ["/login", "/register"];

/**
 * Top navigation with tab highlighting for the active route. Shows the signed-in
 * user's name and a sign-out control; hides entirely on the auth pages and when
 * signed out.
 */
export function Nav({ userName }: { userName: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // The nav lives in the root layout, so this component instance persists across
  // client navigations (it just returns null while hidden). Reset the sign-out
  // state whenever the signed-in user changes, so a fresh sign-in doesn't inherit
  // a stale "Signing out…" from the previous session.
  useEffect(() => {
    setSigningOut(false);
  }, [userName]);

  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (hidden || !userName) return null;

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // FR-AUTH-003.3 — back to the login page after logout.
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className="no-print bg-surface shadow-soft">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4">
        <Link href="/" className="mr-4 flex items-center py-3">
          <img src="/logo.png" alt="Financial Health Check" className="h-8 w-auto" />
        </Link>
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px border-b-2 px-4 py-4 text-sm font-semibold transition ${
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">
            Hi, <span className="font-semibold text-ink">{userName}</span>
          </span>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="rounded-field px-3 py-1.5 text-sm font-semibold text-muted transition hover:bg-field hover:text-ink disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </nav>
  );
}
