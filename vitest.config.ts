import path from "path";
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
        "src/app/page.tsx",
      ],
      // Type declarations have no runtime code to cover.
      exclude: ["src/domain/types.ts"],
      thresholds: { statements: 90, lines: 90, functions: 85, branches: 80 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
