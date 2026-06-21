import { defineConfig } from "vitest/config";

// Self-contained: pure adapters tested against the in-memory implementation, so
// the suite runs with no network and no external services.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
