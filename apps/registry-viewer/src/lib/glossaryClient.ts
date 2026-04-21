/**
 * glossaryClient.ts — Fetches keyword and rule glossary JSON files from R2 for
 * the registry viewer.
 *
 * Glossary data is stored alongside card metadata at {metadataBaseUrl}/metadata/:
 *   /metadata/keywords-full.json  — Array<{ key, description }>
 *   /metadata/rules-full.json     — Array<{ key, label, summary }>
 *
 * Shape and discipline mirror themeClient.ts: module-scope singleton promises,
 * non-blocking at the caller boundary (throws inside the IIFE so App.vue can
 * console.warn + continue), devLog instrumentation.
 */

import type { RuleEntry } from "../composables/useRules";
import { devLog } from "./devLog";

// ── Types (viewer-local) ────────────────────────────────────────────────────

export type KeywordGlossary = Map<string, string>;
export type RuleGlossary    = Map<string, RuleEntry>;

// ── Singleton loaders ───────────────────────────────────────────────────────

// why: singleton cache prevents duplicate R2 fetches within a session
// (mirrors themeClient.ts _promise pattern).
let _keywordPromise: Promise<KeywordGlossary> | null = null;
let _rulePromise:    Promise<RuleGlossary>    | null = null;

/**
 * Fetches the keyword glossary from R2. Results are cached for the session.
 * @param metadataBaseUrl - The base URL for R2 metadata (same as card data).
 */
export function getKeywordGlossary(metadataBaseUrl: string): Promise<KeywordGlossary> {
  if (_keywordPromise) return _keywordPromise;
  _keywordPromise = (async () => {
    const startedAt = performance.now();
    devLog("glossary", "load start", { baseUrl: metadataBaseUrl, resource: "keywords" });
    try {
      const response = await fetch(`${metadataBaseUrl}/metadata/keywords-full.json`);
      if (!response.ok) {
        throw new Error(
          `Cannot load metadata/keywords-full.json: HTTP ${response.status}. ` +
          'Verify that keyword glossary data has been uploaded to R2.',
        );
      }
      const entries = (await response.json()) as Array<{ key: string; description: string }>;
      const map: KeywordGlossary = new Map(entries.map((entry) => [entry.key, entry.description]));
      devLog("glossary", "load complete", {
        baseUrl: metadataBaseUrl,
        resource: "keywords",
        durationMs: Math.round(performance.now() - startedAt),
        entryCount: map.size,
      });
      return map;
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
 * Fetches the rule glossary from R2. Results are cached for the session.
 * @param metadataBaseUrl - The base URL for R2 metadata (same as card data).
 */
export function getRuleGlossary(metadataBaseUrl: string): Promise<RuleGlossary> {
  if (_rulePromise) return _rulePromise;
  _rulePromise = (async () => {
    const startedAt = performance.now();
    devLog("glossary", "load start", { baseUrl: metadataBaseUrl, resource: "rules" });
    try {
      const response = await fetch(`${metadataBaseUrl}/metadata/rules-full.json`);
      if (!response.ok) {
        throw new Error(
          `Cannot load metadata/rules-full.json: HTTP ${response.status}. ` +
          'Verify that rule glossary data has been uploaded to R2.',
        );
      }
      const entries = (await response.json()) as Array<{ key: string; label: string; summary: string }>;
      const map: RuleGlossary = new Map(
        entries.map((entry) => [entry.key, { label: entry.label, summary: entry.summary }]),
      );
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
