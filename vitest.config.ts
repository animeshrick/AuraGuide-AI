import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Components use the automatic JSX runtime. Next handles this itself in the app.
  esbuild: { jsx: "automatic" },
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
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
