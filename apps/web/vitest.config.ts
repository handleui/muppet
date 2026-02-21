import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@nosis/agent-runtime",
        replacement: fileURLToPath(
          new URL("../../packages/agent-runtime/src/index.ts", import.meta.url)
        ),
      },
      {
        find: "@nosis",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: [
        "src/components/code-workspace-provider.tsx",
        "src/features/**/*.ts",
        "src/features/**/*.tsx",
        "src/lib/api-config.ts",
      ],
      exclude: ["**/*.d.ts"],
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 90,
        lines: 85,
      },
    },
  },
});
