/**
 * glossaryClient.ts — Fetches keyword and rule glossary JSON files from R2 for
 * the registry viewer.
 *
 * Glossary data is stored alongside card metadata at {metadataBaseUrl}/metadata/:
 *   /metadata/keywords-full.json  — Array<KeywordGlossaryEntry>
 *   /metadata/rules-full.json     — Array<RuleGlossaryEntry>
 *
 * Shape and discipline mirror themeClient.ts: module-scope singleton promises,
 * non-blocking at the caller boundary (throws on network errors so App.vue can
 * console.warn + continue; schema failures log + return empty Map), devLog
 * instrumentation.
 *
 * Schema authority lives at `packages/registry/src/schema.ts`; this module
 * imports `KeywordGlossarySchema` / `RuleGlossarySchema` and calls `.safeParse`
 * at the fetch boundary so malformed R2 publishes degrade to an empty panel
 * with a full-sentence operator warning rather than a silent empty Map.
 */

// why: import the schemas from the `@legendary-arena/registry/schema`
// subpath rather than the barrel. The barrel (`@legendary-arena/registry`)
// re-exports `createRegistryFromLocalFiles` from `impl/localRegistry.js`,
// which in turn imports Node-only modules (`node:fs/promises`, `node:path`).
// Vite externalizes those for the browser build, but Rollup resolves the
// import graph before tree-shaking can prune the unused Node-only factory,
// so the browser build fails on `resolve` from `__vite-browser-external`.
// The dedicated `./schema` subpath export (defined in the package's
// exports map) has zero Node-module dependencies and sidesteps the issue.
import {
  KeywordGlossarySchema,
  RuleGlossarySchema,
} from "@legendary-arena/registry/schema";
import type { RuleEntry } from "../composables/useRules";
import { devLog } from "./devLog";

// ── Types (viewer-local) ────────────────────────────────────────────────────

/**
 * The keyword glossary Map value carries both the rulebook-sourced human label
 * (used for Rules Glossary panel display) and the description text (used for
 * tooltips). pdfPage lives in a parallel Map rather than in this value — see
 * KeywordPdfPageMap below.
 */
export interface KeywordGlossaryValue {
  label:       string;
  description: string;
}

export type KeywordGlossary   = Map<string, KeywordGlossaryValue>;
export type KeywordPdfPageMap = Map<string, number>;
export type RuleGlossary      = Map<string, RuleEntry>;

// ── Singleton loaders ───────────────────────────────────────────────────────

// why: singleton cache prevents duplicate R2 fetches within a session
// (mirrors themeClient.ts _promise pattern). Keywords and rules each have their
// own promise; the keyword promise resolves to a bundle containing both the
// glossary and the parallel pdfPage Map so the two views share a single fetch.
interface KeywordBundle {
  glossary: KeywordGlossary;
  pdfPages: KeywordPdfPageMap;
}

let _keywordPromise: Promise<KeywordBundle> | null = null;
let _rulePromise:    Promise<RuleGlossary>  | null = null;

function loadKeywordBundle(metadataBaseUrl: string): Promise<KeywordBundle> {
  if (_keywordPromise) return _keywordPromise;
  _keywordPromise = (async () => {
    const url = `${metadataBaseUrl}/metadata/keywords-full.json`;
    const startedAt = performance.now();
    devLog("glossary", "load start", { baseUrl: metadataBaseUrl, resource: "keywords" });
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Cannot load metadata/keywords-full.json: HTTP ${response.status}. ` +
          "Verify that keyword glossary data has been uploaded to R2.",
        );
      }
      const rawPayload = await response.json();
      const result = KeywordGlossarySchema.safeParse(rawPayload);
      if (!result.success) {
        const issue = result.error.issues[0]!;
        // why: dot-joined path keeps viewer logs operator-readable without
        // Zod fluency; default ["0","label"]-style array paths are noisy.
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        console.warn(
          `[Glossary] Rejected keywords-full.json from ${url}: ${path} — ${issue.message}. ` +
          "Panel will show no entries until data is corrected.",
        );
        return { glossary: new Map(), pdfPages: new Map() };
      }
      const glossary: KeywordGlossary = new Map();
      const pdfPages: KeywordPdfPageMap = new Map();
      for (const entry of result.data) {
        glossary.set(entry.key, { label: entry.label, description: entry.description });
        if (entry.pdfPage !== undefined) pdfPages.set(entry.key, entry.pdfPage);
      }
      devLog("glossary", "load complete", {
        baseUrl: metadataBaseUrl,
        resource: "keywords",
        durationMs: Math.round(performance.now() - startedAt),
        entryCount: glossary.size,
        pdfPageCount: pdfPages.size,
      });
      return { glossary, pdfPages };
    } catch (error) {
      devLog("glossary", "load failed", {
        baseUrl: metadataBaseUrl,
        resource: "keywords",
        durationMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : String(error),
      });
      // why: throw here so the App.vue caller can console.warn + continue
      // (mirrors themeClient.ts failure path — non-blocking at the boundary).
      throw error;
    }
  })();
  return _keywordPromise;
}

/**
 * Fetches the keyword glossary from R2. Results are cached for the session.
 * Returns a Map keyed by lowercase keyword code, valued by { label, description }.
 *
 * @param metadataBaseUrl - The base URL for R2 metadata (same as card data).
 */
export async function getKeywordGlossary(metadataBaseUrl: string): Promise<KeywordGlossary> {
  const bundle = await loadKeywordBundle(metadataBaseUrl);
  return bundle.glossary;
}

/**
 * Fetches the parallel keyword-to-pdfPage Map from R2. Shares the singleton
 * fetch with `getKeywordGlossary` — calling both does not produce a second HTTP
 * request. Keys present in this Map are exactly the keywords that had a
 * `pdfPage` field in the source JSON; keys without a confirmable rulebook page
 * are omitted from this Map (there is no placeholder value).
 *
 * @param metadataBaseUrl - The base URL for R2 metadata (same as card data).
 */
export async function getKeywordPdfPages(metadataBaseUrl: string): Promise<KeywordPdfPageMap> {
  const bundle = await loadKeywordBundle(metadataBaseUrl);
  return bundle.pdfPages;
}

/**
 * Fetches the rule glossary from R2. Results are cached for the session.
 * @param metadataBaseUrl - The base URL for R2 metadata (same as card data).
 */
export function getRuleGlossary(metadataBaseUrl: string): Promise<RuleGlossary> {
  if (_rulePromise) return _rulePromise;
  _rulePromise = (async () => {
    const url = `${metadataBaseUrl}/metadata/rules-full.json`;
    const startedAt = performance.now();
    devLog("glossary", "load start", { baseUrl: metadataBaseUrl, resource: "rules" });
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Cannot load metadata/rules-full.json: HTTP ${response.status}. ` +
          "Verify that rule glossary data has been uploaded to R2.",
        );
      }
      const rawPayload = await response.json();
      const result = RuleGlossarySchema.safeParse(rawPayload);
      if (!result.success) {
        const issue = result.error.issues[0]!;
        // why: dot-joined path keeps viewer logs operator-readable without
        // Zod fluency; default ["0","label"]-style array paths are noisy.
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        console.warn(
          `[Glossary] Rejected rules-full.json from ${url}: ${path} — ${issue.message}. ` +
          "Panel will show no entries until data is corrected.",
        );
        return new Map();
      }
      const map: RuleGlossary = new Map();
      for (const entry of result.data) {
        const value: RuleEntry = { label: entry.label, summary: entry.summary };
        if (entry.pdfPage !== undefined) value.pdfPage = entry.pdfPage;
        map.set(entry.key, value);
      }
      devLog("glossary", "load complete", {
        baseUrl: metadataBaseUrl,
        resource: "rules",
        durationMs: Math.round(performance.now() - startedAt),
        entryCount: map.size,
      });
      return map;
    } catch (error) {
      devLog("glossary", "load failed", {
        baseUrl: metadataBaseUrl,
        resource: "rules",
        durationMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : String(error),
      });
      // why: throw here so the App.vue caller can console.warn + continue
      // (mirrors themeClient.ts failure path — non-blocking at the boundary).
      throw error;
    }
  })();
  return _rulePromise;
}

export function resetGlossaries(): void {
  _keywordPromise = null;
  _rulePromise = null;
}
