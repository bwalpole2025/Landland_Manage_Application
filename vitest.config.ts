import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // Load .env so DB-backed tests pick up DATABASE_URL locally.
    setupFiles: ["dotenv/config"],
    include: ["test/**/*.test.ts", "packages/**/test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@obligations-engine": fileURLToPath(
        new URL("./packages/obligations-engine/src/index.ts", import.meta.url),
      ),
      "@integrations": fileURLToPath(new URL("./packages/integrations/src/index.ts", import.meta.url)),
    },
  },
});
