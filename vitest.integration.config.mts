import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Tests contra un Supabase real (local o de pruebas): permisos RLS por rol
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Permite importar módulos de servidor (marcados con "server-only") en los tests
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
}));
