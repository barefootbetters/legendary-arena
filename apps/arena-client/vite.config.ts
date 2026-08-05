import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

// why: git may be unavailable in CI shallow clones or ZIP deploys
let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  console.warn('[build] Could not resolve git SHA — using "unknown".');
}

// why: build.sourcemap is enabled so that first-time bootstrap failures are
// diagnosable against the original TypeScript / Vue source rather than the
// minified bundle. Revisit in a future packet once the app grows and the
// sourcemap size becomes a production concern.

// why: D-14401 ("Boundary Leakage" failure class) — the engine package
// runtime entry (`@legendary-arena/game-engine` = `.` subpath) is the
// Runtime-Safe Engine Surface and contains zero `node:*` imports
// transitively reachable. The Setup-Tooling Surface (`./setup` subpath)
// holds every Node-IO module (scoringConfigLoader + par.storage) and is
// Node-only. arena-client must NEVER import from
// `@legendary-arena/game-engine/setup`. This `onwarn` handler is one of
// three independent enforcement layers (subpath exports + this hard-fail
// + arena-client tsconfig path guard); it converts any silent
// `node:*` externalization regression into a build failure. The handler
// MUST `throw`, not `console.warn` — silent regressions defeat structural
// enforcement and were exactly what the pre-WP `stubParStoragePlugin`
// workaround masked.
function failOnNodeExternalization(warning: { code?: string; message?: string; source?: string; id?: string }): void {
  const message = warning.message ?? '';
  const source = warning.source ?? '';
  const isNodeUnresolved =
    warning.code === 'UNRESOLVED_IMPORT' && source.startsWith('node:');
  const isNodeExternalized =
    message.includes('__vite-browser-external') ||
    /externalized.*node:/.test(message);
  if (isNodeUnresolved || isNodeExternalized) {
    throw new Error(
      'Boundary Leakage detected (D-14401): arena-client production build ' +
      'tried to bundle a `node:*` import. The Runtime-Safe Engine Surface ' +
      '(`@legendary-arena/game-engine`) must not transitively reach Node-IO ' +
      'modules. If a new Node-IO surface was added to the engine, author it ' +
      'under `packages/game-engine/src/setup-tooling/` and consume it via ' +
      '`@legendary-arena/game-engine/setup` from server / CLI code only. ' +
      `Original Rollup warning: code=${warning.code ?? 'n/a'} ` +
      `source=${source || 'n/a'} message=${message}`,
    );
  }
}

// why: WP-418 — emit a tiny build-stamped `version.json` ({ gitSha }) into the
// build output so an already-open tab can poll it (cache-busted) and learn a
// newer client build has been deployed — the signal that drives the
// UpdateAvailableBanner. It reuses the SAME `gitSha` captured above (no second
// git call, no new dependency). `configureServer` serves the same file in dev so
// the poll path is exercisable against `pnpm --filter … dev` without a build.
function emitVersionJsonPlugin(shortGitSha: string): Plugin {
  const versionBody = JSON.stringify({ gitSha: shortGitSha });
  return {
    name: 'legendary-emit-version-json',
    apply: () => true,
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: versionBody });
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url === undefined || request.url.split('?')[0] !== '/version.json') {
          next();
          return;
        }
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('Cache-Control', 'no-store');
        response.end(versionBody);
      });
    },
  };
}

// why: Vite injects `crossorigin` onto every built `<link rel="stylesheet">`
// and module `<script>` it emits. For a SAME-ORIGIN stylesheet with no
// Subresource-Integrity (`integrity`) attribute, `crossorigin` buys nothing —
// it only forces the browser to fetch the sheet in CORS mode. On Cloudflare
// Pages, that CORS-mode fetch during the cold-cache window right after a deploy
// (new hashed asset = `cf-cache-status: MISS`, served through the Pages
// Functions runtime because of the root `functions/_middleware.ts`)
// intermittently aborts in the browser (`net::ERR_ABORTED`) even though the
// asset itself serves a clean 200. The sheet never applies and the page renders
// fully unstyled until a reload. Observed live on play.legendary-arena.com,
// 2026-08-04, immediately after the EC-534 deploy. The asset, its bytes, and
// its `Access-Control-Allow-Origin: *` header are all correct and consistent
// server-side (verified 21/21 requests) — the failure is purely the browser
// aborting the CORS-mode request, so the fix is to stop requesting the
// same-origin stylesheet in CORS mode at all. Script/`modulepreload` links are
// left untouched: only the stylesheet exhibited the abort, so the change stays
// scoped to the one surface that needs it.
function stripCrossoriginFromStylesheetLinksPlugin(): Plugin {
  return {
    name: 'legendary-strip-crossorigin-from-stylesheet-links',
    apply: () => true,
    // why: order 'post' runs after Vite has injected its built asset tags into
    // index.html, so the emitted `<link rel="stylesheet" crossorigin ...>` is
    // present in the HTML string this handler receives and can be rewritten.
    transformIndexHtml: {
      order: 'post',
      handler(html: string): string {
        // why: rewrite only stylesheet <link> tags. The callback removes the
        // `crossorigin` attribute (valueless or `="..."`) from within each
        // matched tag, leaving the href and every other attribute intact.
        const stylesheetLinkPattern = /<link\b[^>]*\brel="stylesheet"[^>]*>/g;
        const crossoriginAttributePattern = /\s+crossorigin(?:=("[^"]*"|'[^']*'))?/g;
        return html.replace(stylesheetLinkPattern, (linkTag) =>
          linkTag.replace(crossoriginAttributePattern, ''),
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [vue(), emitVersionJsonPlugin(gitSha), stripCrossoriginFromStylesheetLinksPlugin()],
  // why: these are build-time constants replaced by Vite, not runtime globals
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA__: JSON.stringify(gitSha),
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        failOnNodeExternalization(warning);
        defaultHandler(warning);
      },
    },
  },
});