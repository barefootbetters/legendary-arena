import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".vue", ".json"],
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  // Tell Vite to ignore node: built-ins (only used in localRegistry which we don't import)
  optimizeDeps: {
    exclude: ["node:fs/promises", "node:path"],
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
