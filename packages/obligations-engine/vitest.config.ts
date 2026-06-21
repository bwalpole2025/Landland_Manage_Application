import { defineConfig } from "vitest/config";

// Self-contained: a Node test runner over a pure package. No setup files, no
// env, no aliases — nothing that couples it to the host app.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
