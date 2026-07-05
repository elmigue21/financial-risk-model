import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Health Check",
  description: "Check your company's risk of financial trouble in about a minute.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
