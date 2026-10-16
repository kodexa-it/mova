import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests unitarios: lógica pura, sin base de datos ni red.
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
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "**/*.int.test.ts"],
    setupFiles: ["./tests/setup/unit.ts"],
  },
});
