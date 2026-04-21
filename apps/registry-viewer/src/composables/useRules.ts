/**
 * useRules.ts
 * Provides glossary lookups and ability-text tokenization for the registry viewer.
 *
 * Three lookup sources:
 *   RULES_GLOSSARY       — Game-mechanic rules (e.g. shards, divided cards) keyed by code.
 *                          Referenced in ability text as [rule:X]. Fetched at startup
 *                          from {metadataBaseUrl}/metadata/rules-full.json and pushed
 *                          into a module-scope holder by setGlossaries().
 *   KEYWORD_GLOSSARY     — Common gameplay keywords that appear across multiple sets,
 *                          keyed by lowercase keyword name.
 *                          Referenced in ability text as [keyword:X]. Fetched at startup
 *                          from {metadataBaseUrl}/metadata/keywords-full.json and pushed
 *                          into a module-scope holder by setGlossaries().
 *   KEYWORD_PDF_PAGES    — Parallel Map<key, pdfPage> for keywords that have a
 *                          rulebook page reference. Populated by setGlossaries()
 *                          from glossaryClient.ts's single fetch. Consulted by
 *                          useGlossary.ts when building entries for the panel.
 *
 * Hero class descriptions stay hardcoded below (5 entries, stable engine-class
 * labels) — they are not present in any external or R2 glossary artifact. A
 * parallel HERO_CLASS_LABELS Map enumerates the rulebook display names
 * verbatim; any future contributor tempted to reintroduce a string-transform
 * helper for these labels should consult HERO_CLASS_LABELS first.
 *
 * Ability text may also contain icon/hc/team tokens which are handled by
 * parseAbilityText() but do not have definitions — they're rendered as labels only.
 */

import type { KeywordGlossary, KeywordPdfPageMap } from "../lib/glossaryClient";

export interface RuleEntry {
  label:    string;
  summary:  string;
  pdfPage?: number;
}

// ── Glossary module-scope holders ────────────────────────────────────────────
// why: Populated by setGlossaries() at App.vue mount. Before the fetch
// resolves, these are null and lookupKeyword/lookupRule return null,
// which callers (CardDetail.vue, useGlossary.ts) already handle via
// tooltip-absent paths. This matches the non-blocking fetch guardrail.
let _keywordGlossary:  KeywordGlossary   | null = null;
let _keywordPdfPages:  KeywordPdfPageMap | null = null;
let _ruleGlossary:     Map<string, RuleEntry> | null = null;

/**
 * Installs the fetched glossary Maps. Called once from App.vue onMounted after
 * getKeywordGlossary(), getKeywordPdfPages(), and getRuleGlossary() all resolve.
 */
export function setGlossaries(
  keywords:        KeywordGlossary,
  keywordPdfPages: KeywordPdfPageMap,
  rules:           Map<string, RuleEntry>,
): void {
  _keywordGlossary = keywords;
  _keywordPdfPages = keywordPdfPages;
  _ruleGlossary    = rules;
}

/**
 * Returns the installed keyword glossary Map, or null if setGlossaries has
 * not yet been called. useGlossary.ts reads this to build the panel entry list.
 */
export function getKeywordGlossaryMap(): KeywordGlossary | null {
  return _keywordGlossary;
}

/**
 * Returns the installed parallel Map<key, pdfPage>. Keys not in this Map had
 * no confirmable rulebook page source (the `pdfPage` field was absent from
 * their JSON entry). useGlossary.ts reads this when attaching `pdfPage` to
 * GlossaryEntry for keyword-typed entries.
 */
export function getKeywordPdfPageMap(): KeywordPdfPageMap | null {
  return _keywordPdfPages;
}

/**
 * Returns the installed rule glossary Map, or null if setGlossaries has
 * not yet been called. useGlossary.ts reads this to build the panel entry list.
 */
export function getRuleGlossaryMap(): Map<string, RuleEntry> | null {
  return _ruleGlossary;
}

// ── Hero class glossary (superpower abilities) ─────────────────────────────
// Key: lowercase hero class name (matches the X in [hc:X])
// Superpower abilities trigger when you play a card of the matching hero class.
export const HERO_CLASS_GLOSSARY: Map<string, string> = new Map([
  ["covert", "Superpower Ability — triggers if you played another Covert (green) card this turn. Covert heroes use stealth, espionage, and precision."],
  ["instinct", "Superpower Ability — triggers if you played another Instinct (pink) card this turn. Instinct heroes rely on primal senses, reflexes, and feral power."],
  ["ranged", "Superpower Ability — triggers if you played another Ranged (blue) card this turn. Ranged heroes attack from a distance using energy blasts, arrows, or projectiles."],
  ["strength", "Superpower Ability — triggers if you played another Strength (red) card this turn. Strength heroes overpower enemies with raw physical might."],
  ["tech", "Superpower Ability — triggers if you played another Tech (yellow) card this turn. Tech heroes use gadgets, armor, and advanced technology."],
]);

// why: Hero class display labels are enumerated explicitly rather than derived
// from keys, so no future contributor reintroduces a titleCase-style helper to
// "clean up" the hardcoded Map. The WP-060 audit confirmed that label
// inference breaks canonical rulebook capitalization in cases like
// "chooseavillaingroup" → "Choose a Villain Group" and "shieldclearance" →
// "S.H.I.E.L.D. Clearance"; hero-class labels are trivially capitalized but
// the same "no inference" discipline applies.
export const HERO_CLASS_LABELS: Map<string, string> = new Map([
  ["covert",   "Covert"],
  ["instinct", "Instinct"],
  ["ranged",   "Ranged"],
  ["strength", "Strength"],
  ["tech",     "Tech"],
]);

/**
 * Look up a hero class description by name (case-insensitive).
 * Returns the description string, or null if not found.
 */
export function lookupHeroClass(name: string): string | null {
  return HERO_CLASS_GLOSSARY.get(name.toLowerCase()) ?? null;
}

// ── Ability text token types ──────────────────────────────────────────────────
export type TokenType = "text" | "keyword" | "rule" | "icon" | "hc" | "team";

export interface AbilityToken {
  type:  TokenType;
  value: string;  // The X in [type:X], or plain text for type="text"
  raw:   string;  // The original markup string
}

// ── parseAbilityText ──────────────────────────────────────────────────────────
/**
 * Parse a single ability text line into typed tokens.
 * Splits on [type:value] markup, yielding interleaved text and token segments.
 *
 * Example input:  "[keyword:Patrol]: If it's empty, you get +1[icon:recruit]."
 * Example output: [
 *   { type: "keyword", value: "Patrol",  raw: "[keyword:Patrol]" },
 *   { type: "text",    value: ": If it's empty, you get +1", raw: "" },
 *   { type: "icon",    value: "recruit", raw: "[icon:recruit]" },
 *   { type: "text",    value: ".",       raw: "" },
 * ]
 */
export function parseAbilityText(text: string): AbilityToken[] {
  const tokens: AbilityToken[] = [];
  // Matches [keyword:X], [icon:X], [hc:X], [team:X], [rule:X]
  const pattern = /\[(keyword|icon|hc|team|rule):([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Plain text before this token
    if (match.index > lastIndex) {
      tokens.push({
        type:  "text",
        value: text.slice(lastIndex, match.index),
        raw:   "",
      });
    }

    const tokenType = match[1] as TokenType;
    const tokenValue = match[2] ?? "";

    tokens.push({
      type:  tokenType,
      value: tokenValue,
      raw:   match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // Any remaining plain text
  if (lastIndex < text.length) {
    tokens.push({
      type:  "text",
      value: text.slice(lastIndex),
      raw:   "",
    });
  }

  return tokens;
}

// ── lookupKeyword ─────────────────────────────────────────────────────────────
/**
 * Look up a keyword definition by name.
 * Card data uses mixed-case variations like "Berserk", "Focus 2",
 * "Patrol the Bank", "Double Striker". This function tries:
 *   1. Exact lowercase match
 *   2. Match after stripping spaces (e.g., "wallcrawl" for "Wall-Crawl")
 *   3. Prefix match against known keys (e.g., "Patrol the Bank" -> "patrol")
 * Returns the summary string, or null if not found.
 */
export function lookupKeyword(name: string): string | null {
  if (_keywordGlossary === null) return null;
  const lower = name.toLowerCase();
  // why: exact match covers most tokens like "Berserk" -> "berserk"
  if (_keywordGlossary.has(lower)) return _keywordGlossary.get(lower)!.description;

  // why: some keywords have hyphens/spaces stripped in their keys
  const stripped = lower.replace(/[\s-]+/g, "");
  if (_keywordGlossary.has(stripped)) return _keywordGlossary.get(stripped)!.description;

  // why: card data uses parameterized forms like "Focus 2", "Patrol the Bank",
  // "Danger Sense 3", "Elusive 6" — match the longest known key that starts
  // the token. Also handles modifier prefixes like "Ultimate Abomination",
  // "Double Striker", "Rooftops Conqueror 3", "Streets Abomination" by
  // checking if any known key appears as a suffix or substring.
  let bestMatch: string | null = null;
  for (const key of _keywordGlossary.keys()) {
    const keyStripped = key.replace(/[\s-]+/g, "");

    // Prefix match: token starts with the glossary key
    if (lower.startsWith(key) && (bestMatch === null || key.length > bestMatch.length)) {
      bestMatch = key;
    }
    if (stripped.startsWith(keyStripped) && (bestMatch === null || key.length > bestMatch.length)) {
      bestMatch = key;
    }

    // Suffix match: token ends with the glossary key (handles "Ultimate Abomination",
    // "Double Striker", "Rooftops Abomination", "Triple Empowered", etc.)
    if (lower.endsWith(key) && key.length >= 4 && (bestMatch === null || key.length > bestMatch.length)) {
      bestMatch = key;
    }
    if (stripped.endsWith(keyStripped) && keyStripped.length >= 4 && (bestMatch === null || key.length > bestMatch.length)) {
      bestMatch = key;
    }

    // Substring match: token contains the glossary key as a word boundary
    // (handles "Cross-Dimensional Hulk Rampage" matching "crossdimensionalrampage")
    if (key.length >= 6 && lower.includes(key) && (bestMatch === null || key.length > bestMatch.length)) {
      bestMatch = key;
    }
  }
  return bestMatch ? _keywordGlossary.get(bestMatch)!.description : null;
}

// ── lookupRule ────────────────────────────────────────────────────────────────
/**
 * Look up a rules glossary entry by code (case-insensitive).
 * Tries both the exact value and a slugified version.
 * Returns the RuleEntry, or null if not found.
 */
export function lookupRule(code: string): RuleEntry | null {
  if (_ruleGlossary === null) return null;
  const normalizedCode = code.toLowerCase().replace(/\s+/g, "");
  // Try exact match first
  if (_ruleGlossary.has(code.toLowerCase())) {
    return _ruleGlossary.get(code.toLowerCase()) ?? null;
  }
  // Try without spaces
  for (const [key, entry] of _ruleGlossary) {
    if (key.replace(/\s+/g, "") === normalizedCode) {
      return entry;
    }
  }
  return null;
}
