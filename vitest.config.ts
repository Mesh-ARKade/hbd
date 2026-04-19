import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: "./test/setup.ts",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  coverage: {
    provider: "v8",
    reporter: ["text", "json", "html"],
    thresholds: {
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
    },
    include: ["src/**/*.ts"],
    exclude: ["node_modules", "dist", "test"],
  },
});