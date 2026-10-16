import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests de integración: PostgreSQL real (TEST_DATABASE_URL), un archivo a la
// vez porque comparten la base de test.
export default defineConfig({
  // tsconfig deja el JSX para Next.js ("preserve"); en tests lo transforma Vite.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      "server-only": path.resolve(import.meta.dirname, "tests/setup/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.int.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    globalSetup: ["./tests/setup/integration-global.ts"],
    setupFiles: ["./tests/setup/integration.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
