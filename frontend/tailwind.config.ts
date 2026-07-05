import type { Config } from "tailwindcss";

/**
 * Design tokens live here so spacing, type, color and shadows stay
 * consistent across the whole app. See design.md for the rationale.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#ffffff",
        canvas: "#eef1f6",
        field: "#f1f3f7",
        ink: "#1f2733",
        muted: "#6b7685",
        brand: { DEFAULT: "#3b5bdb", strong: "#2f4bc4" },
        low: { DEFAULT: "#2f9e44", bg: "#ebfbee" },
        medium: { DEFAULT: "#f08c00", bg: "#fff4e0" },
        high: { DEFAULT: "#e03131", bg: "#ffece9" },
      },
      // Shadows are used INSTEAD of borders for all separation.
      boxShadow: {
        card: "0 6px 20px rgba(23, 33, 51, 0.08)",
        soft: "0 1px 2px rgba(23, 33, 51, 0.06)",
        focus: "0 0 0 3px rgba(59, 91, 219, 0.25)",
      },
      borderRadius: {
        card: "14px",
        field: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
