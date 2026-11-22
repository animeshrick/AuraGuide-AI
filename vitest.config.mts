import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Components use the automatic JSX runtime. Next handles this itself in the app.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/domain/**",
        "src/ai/**",
        "src/lib/**",
        "src/i18n/**",
        "src/components/**",
        "src/app/api/**",
        "src/app/**/*.tsx",
      ],
      // Type declarations have no runtime code to cover.
      exclude: ["src/domain/types.ts"],
      thresholds: { statements: 95, lines: 95, functions: 95, branches: 88 },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
