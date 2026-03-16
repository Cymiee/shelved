import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point @gameboxd/lib directly to source for hot-reload in dev
      "@gameboxd/lib": resolve(__dirname, "../lib/src/index.ts"),
    },
  },
});
