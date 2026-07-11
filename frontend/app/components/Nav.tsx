"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/status", label: "Finance status" },
  { href: "/history", label: "History" },
];

/** Top navigation with tab highlighting for the active route. */
export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="bg-surface shadow-soft">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4">
        <span className="mr-4 py-4 text-sm font-bold text-brand">
          Financial Health Check
        </span>
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
      </div>
    </nav>
  );
}
