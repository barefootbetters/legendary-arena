/**
 * cardTypesClient.ts — Fetches the card-types taxonomy JSON from R2 for the
 * registry viewer ribbon.
 *
 * Card-types data is stored alongside other registry metadata at
 * `{metadataBaseUrl}/metadata/card-types.json` — an array of CardTypeEntry
 * (slug, label, emoji?, order, parentType). The 13-entry taxonomy drives
 * the registry viewer's ribbon button generator (10 top-level entries +
 * 3 SHIELD sub-chips).
 *
 * Shape and discipline mirror glossaryClient.ts: module-scope singleton
 * promise, devLog instrumentation, .safeParse at the fetch boundary.
 *
 * Schema authority lives at `packages/registry/src/schema.ts`; this module
 * imports `CardTypesIndexSchema` (with relational orphan validation applied
 * post-parse here) and calls `.safeParse` so a malformed R2 publish degrades
 * to an empty-array fallback that App.vue's displayedTypeGroups computed
 * resolves into LEGACY_TYPE_GROUPS. This fetcher never throws — fully
 * non-blocking at the boundary.
 */

// why: import the schema from the `@legendary-arena/registry/schema`
// subpath rather than the barrel. The barrel re-exports a Node-only
// local-file registry factory that pulls in `node:fs/promises` and
// `node:path`. Vite externalizes those for the browser build, but Rollup
// resolves the import graph before tree-shaking can prune the unused
// Node-only factory, so the browser build fails on `resolve` from
// `__vite-browser-external`. The dedicated `./schema` subpath export
// (defined in the package's exports map) has zero Node-module dependencies
// and sidesteps the issue. Established by glossaryClient.ts (WP-082) +
// themeClient.ts (WP-083).
import {
  CardTypesIndexSchema,
  type CardTypeEntry,
} from "@legendary-arena/registry/schema";
import { devLog } from "./devLog";

// ── Singleton loader ────────────────────────────────────────────────────────

let _promise: Promise<CardTypeEntry[]> | null = null;

/**
 * Fetches the card-types taxonomy from R2. Results are cached for the
 * session.
 *
 * Non-blocking at the boundary: HTTP failure or schema rejection resolves to
 * `[]`, never throws. App.vue's displayedTypeGroups computed selects
 * LEGACY_TYPE_GROUPS when this returns empty.
 *
 * @param metadataBaseUrl - The base URL for R2 metadata (same as card data).
 */
export function getCardTypes(metadataBaseUrl: string): Promise<CardTypeEntry[]> {
  if (_promise) return _promise;
  _promise = (async () => {
    const url = `${metadataBaseUrl}/metadata/card-types.json`;
    const startedAt = performance.now();
    devLog("cardTypes", "load start", { baseUrl: metadataBaseUrl });
    try {
      const response = await fetch(url);
      if (!response.ok) {
        devLog("cardTypes", "load failed", {
          baseUrl:    metadataBaseUrl,
          durationMs: Math.round(performance.now() - startedAt),
          status:     response.status,
          message:    `HTTP ${response.status}`,
        });
        // why: empty-array fallback rather than throw. Mirrors glossaryClient.ts
        // .safeParse() pattern but downgrades the throw on HTTP failure to
        // empty-array because the cardTypes ribbon always has a degraded-mode
        // fallback (LEGACY_TYPE_GROUPS) and never breaks the card view.
        return [];
      }
      const rawPayload = await response.json();
      const result = CardTypesIndexSchema.safeParse(rawPayload);
      if (!result.success) {
        const issue = result.error.issues[0]!;
        // why: dot-joined path keeps viewer logs operator-readable; default
        // ["0","label"]-style array paths are noisy. Mirrors glossaryClient.ts
        // and themeClient.ts WP-082 / WP-083 precedent.
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        console.warn(
          `[CardTypes] Rejected card-types.json from ${url}: ${path} — ${issue.message}. ` +
          "Ribbon will fall back to LEGACY_TYPE_GROUPS until data is corrected.",
        );
        return [];
      }
      // why: relational invariant — every parentType either equals an existing
      // slug or is null. Not expressible in Zod (cross-element reference);
      // enforced post-parse here. Orphan entries are dropped from the returned
      // list with one warn per unique offending parentType value, dedup'd via
      // seenOrphans Set so the operator log stays scannable when many entries
      // share a single bad parent reference.
      const validSlugs = new Set(result.data.map((entry) => entry.slug));
      const seenOrphans = new Set<string>();
      const filtered: CardTypeEntry[] = [];
      for (const entry of result.data) {
        if (entry.parentType !== null && !validSlugs.has(entry.parentType)) {
          if (!seenOrphans.has(entry.parentType)) {
            seenOrphans.add(entry.parentType);
            console.warn(
              `[CardTypes] Orphan parentType: ${entry.parentType} ` +
              `(referenced by entry slug=${entry.slug}). Entry dropped from the ribbon; ` +
              "fix data/metadata/card-types.json to either remove the orphan reference " +
              "or add a top-level entry with the missing slug.",
            );
          }
          continue;
        }
        filtered.push(entry);
      }
      devLog("cardTypes", "load complete", {
        baseUrl:            metadataBaseUrl,
        durationMs:         Math.round(performance.now() - startedAt),
        entryCount:         filtered.length,
        droppedOrphanCount: result.data.length - filtered.length,
      });
      return filtered;
    } catch (error) {
      devLog("cardTypes", "load failed", {
        baseUrl:    metadataBaseUrl,
        durationMs: Math.round(performance.now() - startedAt),
        message:    error instanceof Error ? error.message : String(error),
      });
      // why: never throw — displayedTypeGroups computed handles empty array
      // via LEGACY_TYPE_GROUPS fallback. More non-blocking than
      // glossaryClient.ts's throw because the cardTypes ribbon always has a
      // degraded-mode fallback and the card view stays functional.
      return [];
    }
  })();
  return _promise;
}

export function resetCardTypes(): void {
  _promise = null;
}
