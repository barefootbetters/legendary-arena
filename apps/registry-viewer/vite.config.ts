import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("./package.json");

// why: git may be unavailable in CI shallow clones or ZIP deploys
let gitSha = "unknown";
try {
  gitSha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  console.warn("[build] Could not resolve git SHA — using \"unknown\".");
}

// why: WP-552 / D-24361 — emit a tiny build-stamped `version.json` ({ gitSha })
// into the build output so an already-open tab can poll it (cache-busted) and
// learn a newer viewer build has been deployed. Before this existed,
// `/version.json` returned the SPA fallback HTML, so an operator on a cached
// bundle had no signal at all — a shipped WP-549 change was simply invisible and
// read as broken. Reuses the `gitSha` captured above: no second git call, no new
// dependency. `configureServer` serves the same body in dev so the poll path is
// exercisable against `pnpm --filter registry-viewer dev` without a build.
function emitVersionJsonPlugin(shortGitSha: string): Plugin {
  const versionBody = JSON.stringify({ gitSha: shortGitSha });
  return {
    name: "legendary-emit-version-json",
    apply: () => true,
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: versionBody });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === undefined || request.url.split("?")[0] !== "/version.json") {
          next();
          return;
        }
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        response.end(versionBody);
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), emitVersionJsonPlugin(gitSha)],
  // why: these are build-time constants replaced by Vite, not runtime globals
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
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
