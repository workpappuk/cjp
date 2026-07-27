import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup/setupTests.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    maxWorkers: 1,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      include: [
        "app/_utils/auth.ts",
        "app/_utils/api.ts",
      ],
      exclude: [
        "app/api/auth/[...nextauth]/route.ts",
        "app/layout.tsx",
        "app/globals.css",
        "**/*.d.ts",
      ],
    },
  },
});
