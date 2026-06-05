import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
      // server-only throws in default (non-RSC) Node context; replace with no-op for tests
      "server-only": path.resolve(process.cwd(), "test/mocks/server-only.ts"),
    },
  },
});
