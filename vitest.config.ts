import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws when imported outside a server bundle; in vitest
      // we want it to no-op so we can unit-test server modules directly.
      "server-only": path.resolve(__dirname, "./src/test/server-only-shim.ts"),
    },
  },
});
