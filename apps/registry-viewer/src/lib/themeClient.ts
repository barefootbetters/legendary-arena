/**
 * themeClient.ts — Fetches theme JSON files from R2 for the registry viewer.
 *
 * Themes are stored alongside card metadata at {metadataBaseUrl}/themes/.
 * An index.json manifest lists all available theme filenames.
 */

// why: import schemas from the narrow `./schema` and `./theme.schema`
// subpaths rather than the barrel `@legendary-arena/registry`. The barrel
// re-exports a Node-only local-file registry factory (`node:fs/promises`,
// `node:path`); Rollup resolves the import graph before tree-shaking can
// prune the unused factory, so a barrel import would break the viewer's
// production build at `resolve` from `__vite-browser-external`. The
// dedicated subpath exports have zero Node-module dependencies.
import { ThemeIndexSchema } from "@legendary-arena/registry/schema";
import {
  ThemeDefinitionSchema,
  type ThemeDefinition,
} from "@legendary-arena/registry/theme.schema";
import { devLog } from "./devLog";

// why: re-export so existing consumers (App.vue, ThemeGrid.vue, ThemeDetail.vue)
// continue to `import type { ThemeDefinition } from "./themeClient"` without
// widening the WP-083 allowlist to cover component files that never needed
// editing for validation-wiring reasons.
export type { ThemeDefinition };

// ── Singleton loader ────────────────────────────────────────────────────────

let _promise: Promise<ThemeDefinition[]> | null = null;

/**
 * Fetches all theme definitions from R2. Results are cached for the session.
 * @param metadataBaseUrl - The base URL for R2 metadata (same as card data).
 */
export function getThemes(metadataBaseUrl: string): Promise<ThemeDefinition[]> {
  if (_promise) return _promise;
  _promise = (async () => {
    const startedAt = performance.now();
    devLog("theme", "load start", { baseUrl: metadataBaseUrl });
    try {
      const indexUrl = `${metadataBaseUrl}/themes/index.json`;
      const indexResponse = await fetch(indexUrl);
      if (!indexResponse.ok) {
        throw new Error(
          `Cannot load themes/index.json: HTTP ${indexResponse.status}. ` +
          'Verify that theme files have been uploaded to R2.',
        );
      }
      const rawIndex = await indexResponse.json();
      const indexResult = ThemeIndexSchema.safeParse(rawIndex);
      if (!indexResult.success) {
        const issue = indexResult.error.issues[0];
        // why: dot-joined path keeps viewer logs operator-readable without
        // Zod fluency; default ["0"]-style array paths are noisy. First issue
        // only — additional issues suppressed so operator logs stay scannable,
        // per WP-083 §"Zod error reporting" lock.
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        throw new Error(
          `[Themes] Rejected themes/index.json from ${indexUrl}: ${path} — ${issue.message}. ` +
          `The Themes tab cannot populate without a valid index.`,
        );
      }
      const filenames = indexResult.data;

      const fetchResults = await Promise.allSettled(
        filenames.map(async (filename) => {
          const themeUrl = `${metadataBaseUrl}/themes/${filename}`;
          const themeResponse = await fetch(themeUrl);
          if (!themeResponse.ok) {
            console.warn(`[Themes] Failed to load ${filename}: HTTP ${themeResponse.status}`);
            return null;
          }
          const rawTheme = await themeResponse.json();
          const themeResult = ThemeDefinitionSchema.safeParse(rawTheme);
          if (!themeResult.success) {
            const issue = themeResult.error.issues[0];
            // why: `console.warn` + `return null` preserves the pre-existing
            // `Promise.allSettled` + null-filter tail below. An individual
            // malformed theme must not hide the rest — severity is warn-and-skip
            // per D-083C.
            const path = issue.path.length > 0 ? issue.path.join(".") : "root";
            console.warn(
              `[Themes] Rejected ${filename} from ${themeUrl}: ${path} — ${issue.message}. ` +
              `Theme skipped; Themes tab will not show it.`,
            );
            return null;
          }
          return themeResult.data;
        }),
      );

      const themes: ThemeDefinition[] = [];
      for (const result of fetchResults) {
        if (result.status === 'fulfilled' && result.value !== null) {
          themes.push(result.value);
        }
      }

      // why: sort alphabetically by name for stable display order
      themes.sort((a, b) => a.name.localeCompare(b.name));
      devLog("theme", "load complete", {
        baseUrl: metadataBaseUrl,
        durationMs: Math.round(performance.now() - startedAt),
        themeCount: themes.length,
        sampleThemeIds: themes.slice(0, 3).map((t) => t.themeId),
      });
      return themes;
    } catch (error) {
      devLog("theme", "load failed", {
        baseUrl: metadataBaseUrl,
        durationMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  })();
  return _promise;
}

export function resetThemes(): void {
  _promise = null;
}
