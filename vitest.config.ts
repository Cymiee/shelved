import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@gameboxd/lib": resolve(__dirname, "lib/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/src/**/*.test.ts", "web/src/**/*.test.ts"],
  },
});
