#!/usr/bin/env node
/**
 * Hero mechanic ledger generator.
 *
 * Emits one row per (hero card × mechanic) — a card with three mechanics yields
 * three rows — so the corpus can be read two ways at a glance: which cards still
 * do nothing (the authoring worklist), and, when a card misbehaves, which
 * mechanic owns it and where the code lives (the debugging index).
 *
 * Columns per row:
 *   extId      — canonical set-qualified card id (the engine's id space)
 *   heroName   — display name
 *   set        — set abbreviation
 *   mechanic   — normalized [keyword:X] token (or "(unmarked)" — see below)
 *   status     — executable | deferred | condition | unsupported | unmarked
 *   wp         — Work Packet that implemented the mechanic (from provenance map)
 *   decision   — DECISIONS.md id for it (from provenance map)
 *   handler    — where the code is (module#key) for executable mechanics
 *   designs    — the card design(s) whose abilities print this mechanic, as a
 *                {slug, name}[] (WP-491). One row still covers one (extId, mechanic);
 *                a mechanic printed on 2+ of a hero's designs lists them all here.
 *                Empty ([]) for an (unmarked) row (which is hero-level, not per-design).
 *
 * Status meanings (the five kinds of state, not just done/not-done):
 *   executable   — mechanic ∈ MVP_KEYWORDS (its executor mutates G today); a STATIC
 *                  composition marker (berserk — by-name, every parsed one resolves, D-24031);
 *                  OR a PARAMETERIZED composition marker THIS card's hook resolved (by-hook, D-24045)
 *   deferred     — mechanic ∈ HERO_KEYWORDS but not MVP: parsed, executor defers
 *   condition    — a recognized condition-gate mechanic (D-24055 spectrum: requires ≥3 hero classes);
 *                  not a keyword/effect executor, gates when effects fire
 *   unsupported  — mechanic ∉ HERO_KEYWORDS with no handler (a CODE todo), OR a PARAMETERIZED
 *                  composition marker this card's hook did NOT resolve — a deferred variant
 *                  with no executable primitive yet (by-hook, D-24045)
 *   unmarked     — the card has ability text but no [keyword:X] tag (a DATA todo)
 *
 * Sources of truth (no duplicated vocabulary):
 *   - HERO_KEYWORDS  — the known markup vocabulary the parser recognizes
 *   - MVP_KEYWORDS   — the subset whose executor mutates G today
 *   - provenance map — scripts/coverage/mechanic-provenance.json (wp/decision)
 *
 * Modes:
 *   (default)  regenerate docs/ai/coverage/hero-mechanic-ledger.{json,csv} + print a summary
 *   --check    regenerate in memory and diff against the committed files; exit 1 if stale
 *
 * Deterministic given the in-repo card data. Run from the repo root after
 * `pnpm -r build` (it imports the engine + registry dist).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRegistryFromLocalFiles } from '../packages/registry/dist/index.js';
// why: D-24045 — the ledger builds each hero's hooks the same way the coverage probe does
// (buildHeroAbilityHooks per hero) so it can read parse-time `resolvedMarkers` and classify
// composition markers by-hook (per-card), not by-name. Imported from the engine dist — the
// one-way Layer Boundary import the coverage probe already uses (the ledger never imports
// engine source, and the engine never imports the ledger).
import { buildHeroAbilityHooks } from '../packages/game-engine/dist/setup/heroAbility.setup.js';
import { HERO_KEYWORDS } from '../packages/game-engine/dist/rules/heroKeywords.js';
import { MVP_KEYWORDS } from '../packages/game-engine/dist/hero/heroEffects.execute.js';
// why: D-24031 — composition markers (berserk) are executable via the primitive
// interpreter (not a HeroKeyword/handler); sourced from the engine dist so the ledger
// recognizes them without duplicating the vocabulary. D-24045 — the PARAMETERIZED subset
// (empowered) is classified by-hook because it has deferred variants that resolve nothing;
// the static markers (berserk) have no variants and stay executable by-name.
import {
  HERO_COMPOSITION_MARKER_NAMES,
  PARAMETERIZED_COMPOSITION_MARKER_NAMES,
} from '../packages/game-engine/dist/rules/heroCompositions.js';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIRECTORY);
const METADATA_DIRECTORY = join(REPO_ROOT, 'data', 'metadata');
const CARDS_DIRECTORY = join(REPO_ROOT, 'data', 'cards');
const PROVENANCE_PATH = join(REPO_ROOT, 'scripts', 'coverage', 'mechanic-provenance.json');
const OUTPUT_DIRECTORY = join(REPO_ROOT, 'docs', 'ai', 'coverage');
const LEDGER_JSON_PATH = join(OUTPUT_DIRECTORY, 'hero-mechanic-ledger.json');
const LEDGER_CSV_PATH = join(OUTPUT_DIRECTORY, 'hero-mechanic-ledger.csv');

// why: WP-491 bumped the row shape — each row gained an additive `designs` column
// (the card design(s) whose abilities print the mechanic). The row set is unchanged
// (still one row per (extId, mechanic)); only the new column warrants the version bump.
const SCHEMA_VERSION = 2;
// why: every executable hero KEYWORD mechanic is dispatched from this one module
// (HERO_EFFECT_HANDLERS, keyed by the mechanic name); the handler column points
// here so a broken card is a direct jump to the function.
const HERO_HANDLER_MODULE = 'packages/game-engine/src/hero/heroEffects.execute.ts';
// why: D-24031 — a composition marker (berserk) is dispatched by the mechanic-agnostic
// primitive interpreter (the mechanic lives in the HERO_COMPOSITION_MARKERS data row), so
// its handler column points at the interpreter module, not the keyword handler module.
const PRIMITIVE_INTERPRETER_MODULE = 'packages/game-engine/src/hero/effectPrimitive.interpret.ts';
// why: D-24049 / D-24051 — a move-executed keyword is executable (∈ MVP_KEYWORDS) but has NO
// HERO_EFFECT_HANDLERS entry: its executor is a move (wall-crawl → the recruitHero deck-top
// placement; dodge → the dodgeCard hand-discard-to-draw move), not an onPlay keyword handler.
// Its handler column must point at the real executor module so a broken card is still a direct
// jump to the code, instead of the keyword-handler module that holds no branch for it. Keyed by
// mechanic name; one row per move-executed keyword regardless of WHEN it fires (recruit vs
// hand-action) — the ledger handler column cares only WHERE the executor lives.
const MOVE_EXECUTED_HANDLER_MODULES = {
  'wall-crawl': 'packages/game-engine/src/moves/recruitHero.ts',
  'dodge': 'packages/game-engine/src/moves/dodgeCard.ts',
};
const UNMARKED_MECHANIC = '(unmarked)';

const KNOWN_KEYWORDS = new Set(HERO_KEYWORDS);
const COMPOSITION_MARKERS = new Set(HERO_COMPOSITION_MARKER_NAMES);
// why: D-24045 — only the PARAMETERIZED composition markers (empowered) are classified
// by-hook: they have deferred variants (color-of-choice / conditional-prefix) whose hooks
// resolve nothing, the by-name over-claim this WP removes. Static markers (berserk) have no
// variants — every PARSED berserk resolves — so they stay executable by-name; a berserk
// printed on a transform-hero back face is a separate (out-of-scope) transform-modeling
// concern, not a by-name over-claim, so by-name avoids under-claiming it.
const PARAMETERIZED_COMPOSITION_MARKERS = new Set(PARAMETERIZED_COMPOSITION_MARKER_NAMES);
// why: D-24055 — condition-gate mechanics (spectrum) are recognized by the parser
// as conditions, not keywords. They gate effects but are themselves distinct
// mechanics that should be tracked in the ledger. Mapping from normalized keyword
// token (what appears in card markup) to condition type.
const KNOWN_CONDITIONS = {
  'spectrum': 'distinctHeroClassesAtLeast',  // requires ≥3 hero classes (D-24055)
};

/** Error type signalling a probe failure (exit code 2). */
class ProbeFailure extends Error {}

/**
 * Normalizes a `[keyword:X]` token to its bare mechanic name — strips a trailing
 * `:<digits>` / ` <digits>` magnitude, lowercases, collapses whitespace to
 * single hyphens. Identical to the coverage gate's normalizer so the two tools
 * classify the same token the same way.
 *
 * @param {string} rawToken - the text between `[keyword:` and `]`.
 * @returns {string} the normalized mechanic name (empty string if malformed).
 */
function normalizeMechanicToken(rawToken) {
  return rawToken
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\s+\d+$/, '')
    .replace(/\s+/g, '-');
}

/**
 * Reduces a parameterized keyword mechanic to its bare keyword head.
 *
 * The 3-segment marker tokens — `[keyword:optional-ko-reward:rescue:1]`,
 * `[keyword:attack-per-count:victory-bystanders:N]`,
 * `[keyword:shuffle-discard-empty-reward:recruit:2]`, and the forward-compat
 * `[keyword:reveal:<predicate>:<action>]` — carry a reward/source/predicate parameter that
 * `normalizeMechanicToken` keeps after stripping the trailing magnitude, so the slug
 * (`optional-ko-reward:rescue`) never matches the bare HeroKeyword the engine actually resolves
 * and registers a handler under (`optional-ko-reward`). The engine's resolved effect `.type` is
 * ALWAYS the bare keyword — verified by-hook: Black Widow's dangerous-rescue resolves
 * `optional-ko-reward`, Spider-Man's the-amazing-spider-man resolves `reveal`, Jocasta's
 * reprocess resolves `shuffle-discard-empty-reward` — so the parameter is a ledger-only slug
 * detail, not a distinct implementation target. Fold it back to the head whenever the head is a
 * recognized HeroKeyword.
 *
 * why: without this every parameterized-keyword card is mislabeled `unsupported` on the coverage
 * control surface despite a live, tested handler (the pre-2026-07-13 artifact — Jocasta's
 * shuffle-discard-empty-reward is the case that surfaced it). This reduction runs only in the
 * ledger, NOT in the shared `normalizeMechanicToken` (kept byte-identical to the coverage gate's
 * copy): the coverage gate's executable verdict is by-hook already, so it needs no vocabulary
 * coupling. A token whose head is NOT a known keyword — a malformed or genuinely unknown mechanic
 * such as the leading-colon `:-cross-dimensional-...-rampage.` (empty head) — is left intact so it
 * stays visible as unsupported.
 *
 * @param {string} name - a normalized mechanic name (post magnitude-strip).
 * @returns {string} the bare keyword when the head is a recognized keyword, else `name` unchanged.
 */
function reduceParameterizedKeyword(name) {
  const colonIndex = name.indexOf(':');
  if (colonIndex === -1) {
    return name;
  }
  const head = name.slice(0, colonIndex);
  if (KNOWN_KEYWORDS.has(head)) {
    return head;
  }
  return name;
}

// why: printed-keyword FAMILIES appear on cards as one distinct English phrase per
// parameter value — "Patrol the Rooftops" / "Patrol the Sewers" / "Patrol your Victory
// Pile", "Bridge Conqueror 2" / "Sewers Conqueror", "Cross-Dimensional Hulk Rampage" /
// "…Wolverine Rampage", "Burn 2 Shards" / "Burn 4 Shards" — so `normalizeMechanicToken`
// slugifies each phrase into a SEPARATE unsupported mechanic (25 distinct across these four
// families). That inflates the worklist: the engine implements the FAMILY once (one Patrol
// executor clears every location variant), not one mechanic per printed phrase. These rules
// fold each family to a single canonical slug for the coverage worklist ONLY — the card data
// keeps the faithful printed phrase (`[keyword:Patrol the Rooftops]` is rendered verbatim to
// players via useRules.parseAbilityText, so it must NOT be rewritten). The families fold to
// UNRECOGNIZED heads (there is no `patrol` HeroKeyword), so they correctly stay `unsupported`
// — just as one row per family instead of one per phrase. Ordered, first-match-wins.
//
// why (out-of-time): "Man Out of Time" / "Woman Out of Time" / "Man/Woman Out of Time" /
// "Man or Woman Out of Time" are the SAME keyword printed with the character-appropriate
// gender — one mechanic, so they fold to `out-of-time`. Contrast the Artifact family
// (`artifact` / `ritual-artifact` / `thrown-artifact` / `triggered-artifact`), which is
// DELIBERATELY NOT folded: the printed text shows four genuinely distinct mechanics
// (base once-per-turn passive vs reactive discard-for-effect vs a throw action vs a
// triggered ability), so implementing one does NOT clear the others — they are four
// separate worklist targets, not a parameterized family (verified 2026-07-13).
//
// why (cyber-mod, soulbind — verified 2026-07-13): both are ONE keyword parameterized by
// an axis. Cyber-Mod is an adaptive tiered ability — `[keyword:Cyber-Mod] [hc:X]: effect`,
// `Cyber-Mod Wound: +1 attack per Wound`, `Cyber-Mod 4 Wounds: instead +2 attack` — the
// parameter is the scaling source (classes / wounds / threshold). Soulbind is `Soulbind
// <target>: <effect>` (a Bystander / a Villain / six Villains / another Villain / Arnim
// Zola…), the parameter is the bound target — the same shape as Patrol, NOT the Artifact
// case. Implementing each keyword once clears every variant, so they fold by prefix.
const MECHANIC_FAMILY_RULES = [
  { pattern: /^patrol(-|$)/, canonical: 'patrol' },
  { pattern: /(^|-)conqueror$/, canonical: 'conqueror' },
  { pattern: /cross-dimensional.*rampage/, canonical: 'cross-dimensional-rampage' },
  { pattern: /^burn-.+-shards$/, canonical: 'burn-shards' },
  { pattern: /out-of-time$/, canonical: 'out-of-time' },
  { pattern: /^cyber-mod(-|$)/, canonical: 'cyber-mod' },
  { pattern: /^soulbind(-|$)/, canonical: 'soulbind' },
];

/**
 * Canonicalizes a normalized mechanic slug: strips leading/trailing punctuation artifacts
 * (a stray `:`, trailing `.`, `artifact--`), then folds a printed-keyword family to its single
 * canonical slug (see MECHANIC_FAMILY_RULES).
 *
 * why: complements the source-side typo fix (ssw1/ssw2/wwhk, 2026-07-13) — the punctuation
 * strip de-dupes any residual artifact twin on the coverage surface even before a re-convert,
 * and the family fold right-sizes the worklist so "implement Patrol once" reads as one row, not
 * twelve. Applied only in the ledger; the card data and its player-facing display are untouched.
 *
 * why (quote strip): a marker that QUOTES a referenced term — `[keyword:"When Recruited"
 * Abilities]`, `[keyword:Revenge for Deadpool's "Friends"]` — leaves stray delimiter quotes
 * MID-slug that the leading/trailing punctuation strip cannot reach (`when-recruited"-abilities`).
 * Strip double-quote characters (straight and curly) anywhere in the slug. Apostrophes are
 * DELIBERATELY spared — they are part of the word (`don't-speak`, `killmonger's-wounds`), and
 * stripping them would read as a typo.
 *
 * @param {string} name - a normalized, keyword-reduced mechanic name.
 * @returns {string} the canonical family slug, or the cleaned name when no family matches.
 */
function foldMechanicFamily(name) {
  const stripped = name
    .replace(/["“”]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '');
  for (const rule of MECHANIC_FAMILY_RULES) {
    if (rule.pattern.test(stripped)) {
      return rule.canonical;
    }
  }
  return stripped;
}

/**
 * Returns the distinct, normalized `[keyword:X]` mechanic tokens across a hero's
 * ability lines.
 *
 * @param {string[]} abilities - the hero's ability text lines.
 * @returns {Set<string>} the distinct mechanic names found.
 */
function extractMechanics(abilities) {
  const found = new Set();
  for (const ability of abilities) {
    const markupPattern = /\[keyword:([^\]]+)\]/g;
    let match;
    while ((match = markupPattern.exec(ability)) !== null) {
      const name = foldMechanicFamily(reduceParameterizedKeyword(normalizeMechanicToken(match[1])));
      if (name !== '') {
        found.add(name);
      }
    }
  }
  return found;
}

/**
 * Classifies a mechanic token into one of the mechanic states.
 * (`unmarked` is decided by the caller, since it is the absence of any token.)
 *
 * Keyword mechanics (MVP / known) are classified by name — their status is the same
 * for every card that bears them. A composition marker is classified by-hook (per-card):
 * executable only when THIS card's hook actually resolved it. Conditions are recognized
 * gatekeeping mechanics.
 *
 * @param {string} mechanic - a normalized mechanic name.
 * @param {Set<string>} cardResolvedMarkers - the composition markers THIS card's hooks resolved.
 * @returns {'executable'|'deferred'|'condition'|'unsupported'} the status.
 */
function statusForMechanic(mechanic, cardResolvedMarkers) {
  // why: D-24055 — conditions are recognized gate mechanics (spectrum requires ≥3 classes).
  // They are distinct mechanics worth tracking, but not keywords/effects themselves.
  if (KNOWN_CONDITIONS[mechanic] !== undefined) {
    return 'condition';
  }
  if (MVP_KEYWORDS.has(mechanic)) {
    return 'executable';
  }
  if (COMPOSITION_MARKERS.has(mechanic)) {
    // why: D-24045 — a PARAMETERIZED composition marker (empowered) is executable for THIS
    // card only if its hook actually resolved it (by-hook, not by-name): a deferred variant
    // (color-of-choice / conditional-prefix) resolved nothing, so it is `unsupported` — NOT
    // `deferred` (a composition row means a resolved primitive, not mere parser recognition;
    // absence matches the by-hook coverage probe + runtime hollow detector). This removes the
    // WP-267 / D-24044 by-name over-claim.
    if (PARAMETERIZED_COMPOSITION_MARKERS.has(mechanic)) {
      return cardResolvedMarkers.has(mechanic) ? 'executable' : 'unsupported';
    }
    // why: D-24045 — a STATIC composition marker (berserk) has no deferred variants — every
    // PARSED berserk resolves — so it stays executable by-name (D-24031). A berserk printed on
    // a transform-hero back face is never built into a canonical-face hook, but that is a
    // separate transform-modeling gap, not a by-name over-claim; by-name avoids under-claiming
    // it here (operator decision, this WP).
    return 'executable';
  }
  if (KNOWN_KEYWORDS.has(mechanic)) {
    return 'deferred';
  }
  return 'unsupported';
}

/**
 * Returns the handler-column location for a mechanic, or '' for non-executable mechanics.
 * Keyword mechanics point at their HERO_EFFECT_HANDLERS entry; composition markers point
 * at the mechanic-agnostic primitive interpreter (the mechanic lives in the data row).
 *
 * @param {string} mechanic - a normalized mechanic name.
 * @param {'executable'|'deferred'|'unsupported'|'unmarked'} status - the mechanic's state.
 * @returns {string} the handler location (module#key, a module path, or '').
 */
function handlerForMechanic(mechanic, status) {
  if (status !== 'executable') {
    return '';
  }
  // why: D-24031 — composition markers dispatch through the interpreter, not a keyword handler.
  if (COMPOSITION_MARKERS.has(mechanic)) {
    return PRIMITIVE_INTERPRETER_MODULE;
  }
  // why: D-24049 / D-24051 — a move-executed keyword (wall-crawl → recruitHero; dodge →
  // dodgeCard) executes in a move, not via a HERO_EFFECT_HANDLERS entry; point its handler
  // column at the real executor module.
  if (MOVE_EXECUTED_HANDLER_MODULES[mechanic] !== undefined) {
    return MOVE_EXECUTED_HANDLER_MODULES[mechanic];
  }
  return `${HERO_HANDLER_MODULE}#${mechanic}`;
}

/**
 * Converts a carrying-design `slug -> display name` map into the slug-sorted
 * `{slug, name}[]` a ledger row carries in its `designs` column. Sorted by slug so
 * the regenerated JSON + CSV stay byte-stable run to run (WP-491 / D-24297).
 *
 * @param {Map<string, string>} nameBySlug - carrying-design slug -> display name.
 * @returns {{slug: string, name: string}[]} the slug-sorted design list.
 */
function toSortedDesigns(nameBySlug) {
  const designs = [];
  for (const slug of [...nameBySlug.keys()].sort()) {
    designs.push({ slug, name: nameBySlug.get(slug) });
  }
  return designs;
}

/**
 * Builds one ledger row, joining the provenance map and deriving the handler
 * location for executable mechanics.
 *
 * @param {string} extId - the card ext id.
 * @param {{setAbbr: string, heroName: string}} info - the hero display info.
 * @param {string} mechanic - the mechanic name (or UNMARKED_MECHANIC).
 * @param {'executable'|'deferred'|'unsupported'|'unmarked'} status - the state.
 * @param {Record<string, {wp?: string, decision?: string}>} provenance - the map.
 * @param {{slug: string, name: string}[]} designs - the card design(s) whose
 *   abilities print this mechanic (WP-491); an empty list for an `(unmarked)` row.
 * @returns {object} the ledger row.
 */
function buildRow(extId, info, mechanic, status, provenance, designs) {
  const entry = provenance[mechanic] ?? {};
  const handler = handlerForMechanic(mechanic, status);
  return {
    extId,
    heroName: info.heroName,
    set: info.setAbbr,
    mechanic,
    status,
    wp: entry.wp ?? '',
    decision: entry.decision ?? '',
    handler,
    designs,
  };
}

/**
 * Walks the hero corpus and produces the sorted ledger rows plus a status
 * summary. A hero with ability text but no recognized mechanic token gets a
 * single `unmarked` row; a hero with no ability text at all (a vanilla card)
 * contributes no rows.
 *
 * @param {object} registry - a CardRegistry from createRegistryFromLocalFiles.
 * @param {Record<string, object>} provenance - the mechanic provenance map.
 * @returns {{rows: object[], summary: object}} sorted rows + counts.
 */
function buildLedger(registry, provenance) {
  const heroesByExtId = new Map();
  for (const card of registry.listCards()) {
    if (card.cardType !== 'hero') {
      continue;
    }
    const existing = heroesByExtId.get(card.extId) ?? {
      setAbbr: card.setAbbr,
      heroName: card.heroName ?? card.name,
      designs: [],
    };
    // why: WP-491 — retain each hero card DESIGN separately (its slug + display name
    // + own ability lines) instead of merging every design's abilities into one array.
    // The per-design abilities are what attribute a mechanic to the specific design(s)
    // that print it (the `designs` column below); the UNION of per-design mechanics
    // still equals the old whole-hero merged extraction, so row identity — one row per
    // (extId, mechanic) — is unchanged, and only the additive `designs` column is new.
    const abilities = [];
    for (const ability of card.abilities) {
      if (typeof ability === 'string' && ability.trim() !== '') {
        abilities.push(ability.trim());
      }
    }
    existing.designs.push({ slug: card.slug, name: card.name, abilities });
    heroesByExtId.set(card.extId, existing);
  }

  const rows = [];
  for (const [extId, info] of heroesByExtId) {
    const hasAbilityText = info.designs.some((design) => design.abilities.length > 0);
    if (!hasAbilityText) {
      continue;
    }
    // why: WP-491 — map each normalized mechanic to the design(s) whose abilities print
    // it, reusing the SAME extraction pipeline per design so the union of per-design
    // mechanics equals the old whole-hero set (row identity unchanged). extractMechanics
    // returns a Set, so a design that prints one mechanic on several ability lines is
    // deduped to one design entry, and a mechanic on several designs collects each once.
    const designNamesByMechanic = new Map();
    for (const design of info.designs) {
      for (const mechanic of extractMechanics(design.abilities)) {
        if (!designNamesByMechanic.has(mechanic)) {
          designNamesByMechanic.set(mechanic, new Map());
        }
        designNamesByMechanic.get(mechanic).set(design.slug, design.name);
      }
    }
    if (designNamesByMechanic.size === 0) {
      // why: WP-491 / D-24297 — an `(unmarked)` row is hero-level (the hero prints
      // ability text but no recognized [keyword:X] token on any design), so it carries
      // NO design attribution — an empty `designs` list, never per-design unmarked rows.
      // This keeps the `(unmarked)` semantics exactly as before so the downstream
      // card-mechanics.json glossary `unmarked` bucket stays byte-identical.
      rows.push(buildRow(extId, info, UNMARKED_MECHANIC, 'unmarked', provenance, []));
      continue;
    }
    // why: D-24045 — build THIS hero's hooks the same way the coverage probe does
    // (buildHeroAbilityHooks per hero) and aggregate the composition markers its hooks
    // resolved into a per-card Set. This is what makes composition-marker status by-hook
    // (per-card) instead of by-name. Multiple hooks on one card may resolve the same marker;
    // the Set collapses duplicates, so a duplicate-marker card yields exactly one row and the
    // regen stays byte-stable (membership is order-independent; the row sort below is unchanged).
    const cardResolvedMarkers = new Set();
    for (const hook of buildHeroAbilityHooks(registry, { heroDeckIds: [extId] })) {
      for (const marker of hook.resolvedMarkers ?? []) {
        cardResolvedMarkers.add(marker);
      }
    }
    for (const mechanic of [...designNamesByMechanic.keys()].sort()) {
      const designs = toSortedDesigns(designNamesByMechanic.get(mechanic));
      rows.push(buildRow(extId, info, mechanic, statusForMechanic(mechanic, cardResolvedMarkers), provenance, designs));
    }
  }

  // why: a stable composite sort key makes the JSON + CSV byte-identical run to
  // run, so the --check freshness gate compares cleanly across machines.
  rows.sort((a, b) => {
    const keyA = `${a.set} ${a.heroName} ${a.extId} ${a.mechanic}`;
    const keyB = `${b.set} ${b.heroName} ${b.extId} ${b.mechanic}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });

  const summary = {
    totalRows: rows.length,
    byStatus: { executable: 0, deferred: 0, condition: 0, unsupported: 0, unmarked: 0 },
    distinctMechanics: 0,
  };
  const distinct = new Set();
  for (const row of rows) {
    summary.byStatus[row.status] += 1;
    if (row.mechanic !== UNMARKED_MECHANIC) {
      distinct.add(row.mechanic);
    }
  }
  summary.distinctMechanics = distinct.size;

  return { rows, summary };
}

/**
 * Escapes one CSV field per RFC 4180 — wraps in double quotes and doubles any
 * embedded quote whenever the value contains a comma, quote, or newline.
 *
 * @param {string} value - the raw field value.
 * @returns {string} the CSV-safe field.
 */
function toCsvField(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serializes the ledger rows to CSV with a trailing newline.
 *
 * @param {object[]} rows - the sorted ledger rows.
 * @returns {string} the CSV document.
 */
function serializeCsv(rows) {
  const header = ['ext_id', 'hero_name', 'set', 'mechanic', 'status', 'wp', 'decision', 'handler', 'designs'];
  const lines = [header.join(',')];
  for (const row of rows) {
    // why: WP-491 — the CSV flattens the `designs` object array to a pipe-joined list
    // of design slugs (empty for an `(unmarked)` row); the JSON keeps the full
    // {slug, name} objects. Slugs are already slug-sorted, so the cell is byte-stable.
    const designSlugs = row.designs.map((design) => design.slug).join('|');
    lines.push(
      [
        row.extId,
        row.heroName,
        row.set,
        row.mechanic,
        row.status,
        row.wp,
        row.decision,
        row.handler,
        designSlugs,
      ]
        .map((field) => toCsvField(String(field)))
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Serializes the ledger to deterministic JSON (fixed key order per row, stable
 * row order from buildLedger) with a trailing newline.
 *
 * @param {object} summary - the status summary.
 * @param {object[]} rows - the sorted ledger rows.
 * @returns {string} the JSON document.
 */
function serializeJson(summary, rows) {
  return `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, cardType: 'hero', summary, rows }, null, 2)}\n`;
}

/**
 * Reads and validates the provenance map. A missing file is a probe failure
 * (the generator cannot fill the wp/decision columns without it).
 *
 * @returns {Record<string, object>} the mechanic → {wp, decision} map.
 */
function readProvenance() {
  let text;
  try {
    text = readFileSync(PROVENANCE_PATH, 'utf8');
  } catch (error) {
    throw new ProbeFailure(
      `Cannot read the mechanic provenance map at ${PROVENANCE_PATH}. It seeds the wp/decision columns. Underlying error: ${error.message}`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ProbeFailure(
      `The mechanic provenance map at ${PROVENANCE_PATH} is not valid JSON. Underlying error: ${error.message}`,
    );
  }
  return parsed.mechanics ?? {};
}

/**
 * Loads the registry and dispatches the requested CLI mode.
 *
 * @returns {Promise<number>} the process exit code.
 */
async function main() {
  const mode = process.argv.slice(2).find((argument) => argument.startsWith('--'));

  const registry = await createRegistryFromLocalFiles({
    metadataDir: METADATA_DIRECTORY,
    cardsDir: CARDS_DIRECTORY,
  });
  const provenance = readProvenance();
  const { rows, summary } = buildLedger(registry, provenance);

  if (rows.length === 0) {
    throw new ProbeFailure(
      'The hero ledger is empty — the registry or built dist did not load. Run "pnpm -r build" and confirm data/cards/ is present.',
    );
  }

  const jsonText = serializeJson(summary, rows);
  const csvText = serializeCsv(rows);

  if (mode === '--check') {
    // why: the committed file may be CRLF in a Windows working tree (git
    // autocrlf) while the generator always writes LF; compare line-ending-
    // normalized so --check tests content, not the platform's newline style.
    const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n');
    const staleFiles = [];
    for (const [path, fresh] of [
      [LEDGER_JSON_PATH, jsonText],
      [LEDGER_CSV_PATH, csvText],
    ]) {
      let committed;
      try {
        committed = readFileSync(path, 'utf8');
      } catch {
        staleFiles.push(`${path} (missing)`);
        continue;
      }
      if (normalizeNewlines(committed) !== normalizeNewlines(fresh)) {
        staleFiles.push(path);
      }
    }
    if (staleFiles.length > 0) {
      console.log(`FAIL: the hero mechanic ledger is stale:\n  ${staleFiles.join('\n  ')}`);
      console.log('Regenerate with "pnpm ledger:heroes" and commit the result.');
      return 1;
    }
    console.log(`OK: hero mechanic ledger is current (${summary.totalRows} rows).`);
    return 0;
  }

  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  writeFileSync(LEDGER_JSON_PATH, jsonText, 'utf8');
  writeFileSync(LEDGER_CSV_PATH, csvText, 'utf8');
  console.log(`Hero mechanic ledger written (${summary.totalRows} rows):`);
  console.log(
    `  executable ${summary.byStatus.executable} · deferred ${summary.byStatus.deferred} · ` +
      `condition ${summary.byStatus.condition} · unsupported ${summary.byStatus.unsupported} · unmarked ${summary.byStatus.unmarked}`,
  );
  console.log(`  ${summary.distinctMechanics} distinct mechanics`);
  console.log(`  ${LEDGER_JSON_PATH}`);
  console.log(`  ${LEDGER_CSV_PATH}`);
  return 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    if (error instanceof ProbeFailure) {
      console.error(`Probe failure: ${error.message}`);
      process.exitCode = 2;
      return;
    }
    console.error('Probe failure: the hero mechanic ledger generator threw an unexpected error.');
    console.error(error);
    process.exitCode = 2;
  });
