import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "e2e/fixtures/**/*.test.ts"],
    environment: "node",
    exclude: ["e2e/**/*.spec.ts", "node_modules/**"],
  },
});
