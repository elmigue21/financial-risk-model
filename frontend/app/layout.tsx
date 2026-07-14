import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "./components/Nav";
import { getSession } from "./lib/session";

export const metadata: Metadata = {
  title: "Financial Health Check",
  description: "Check your company's risk of financial trouble in about a minute.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reading the session makes the layout dynamic (per-request) — fine here, and
  // it lets the nav greet the signed-in user without a client round-trip.
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        <Nav userName={session?.name ?? null} />
        {children}
      </body>
    </html>
  );
}
