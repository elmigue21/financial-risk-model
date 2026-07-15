import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure domain logic in app/lib (UT-02 validation, UT-03 ratio
 * computation). These functions have no React/DOM/Next dependencies, so a plain
 * node environment is enough and no extra setup is needed.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
