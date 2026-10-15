import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Tests contra un Supabase real (local o de pruebas): permisos RLS por rol
export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
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
