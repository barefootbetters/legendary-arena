/**
 * Villain deck construction for the Legendary Arena game engine.
 *
 * buildVillainDeck resolves cards from the registry at setup time and
 * produces a shuffled villain deck with type classifications. This is
 * the only point where registry data enters the villain deck subsystem —
 * moves operate solely on G.villainDeck and G.villainDeckCardTypes.
 *
 * Per WP-113 / D-10014, all four entity-ID inputs (villainGroupIds,
 * henchmanGroupIds, schemeId, mastermindId) are set-qualified
 * `<setAbbr>/<slug>` strings. Builders parse the qualified form, then
 * iterate ONLY the named set's data — no cross-set fallback exists.
 *
 * No @legendary-arena/registry imports. No .reduce(). Setup-time only.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType, VillainDeckState } from './villainDeck.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { SetupContext } from '../types.js';
import { shuffleDeck } from '../setup/shuffle.js';

// ---------------------------------------------------------------------------
// VillainDeckRegistryReader — local structural interface
// ---------------------------------------------------------------------------

// why: game-engine must not import @legendary-arena/registry; this interface
// is satisfied structurally by CardRegistry. It exposes the minimum methods
// needed for villain deck construction.

/**
 * Minimal structural type for a flat card returned by listCards().
 * Matches a subset of FlatCard from the registry package.
 */
export interface VillainDeckFlatCard {
  /** Unique key in format {setAbbr}-{cardType}-{groupSlug}-{cardSlug}. */
  key: string;
  /** Coarse card type: "hero", "mastermind", "villain", or "scheme". */
  cardType: string;
  /** Card-level slug within its parent entity. */
  slug: string;
  /** Set abbreviation (e.g., "core", "2099"). */
  setAbbr: string;
}

/**
 * Minimal structural type for a henchman group entry in SetData.
 * SetData.henchmen is z.array(z.unknown()); we validate structurally.
 */
interface HenchmanGroupEntry {
  slug: string;
}

/**
 * Minimal structural type for a mastermind card entry in SetData.
 */
interface MastermindCardEntry {
  slug: string;
  tactic?: boolean;
}

/**
 * Minimal structural type for a mastermind entry in SetData.
 */
interface MastermindEntry {
  slug: string;
  cards: MastermindCardEntry[];
}

/**
 * Minimal structural type for a scheme entry in SetData.
 */
interface SchemeEntry {
  slug: string;
}

/**
 * Minimal structural type for set data returned by getSet().
 * Only the fields needed for villain deck construction are included.
 */
interface SetDataSubset {
  abbr: string;
  henchmen: unknown[];
  masterminds: MastermindEntry[];
  schemes: SchemeEntry[];
}

/**
 * Setup-time registry interface for villain deck construction.
 *
 * Satisfied structurally by the real CardRegistry from the registry
 * package. Defined locally to respect the layer boundary.
 */
export interface VillainDeckRegistryReader {
  /** All flat cards across all loaded sets. */
  listCards(): VillainDeckFlatCard[];
  /** All loaded set index entries. */
  listSets(): Array<{ abbr: string }>;
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// ---------------------------------------------------------------------------
// Count constants (MVP base rules)
// ---------------------------------------------------------------------------

// why: standard Legendary base rule (MVP); see D-1412.
// These are rule invariants, not tuning knobs.

/** Number of identical copies per henchman group in the villain deck. */
const HENCHMAN_COPIES_PER_GROUP = 10;

/** Number of scheme twist cards added to the villain deck. */
const SCHEME_TWIST_COUNT = 8;

// Bystander count = context.ctx.numPlayers (derived, not a constant)

// ---------------------------------------------------------------------------
// buildVillainDeck
// ---------------------------------------------------------------------------

/**
 * Result of building the villain deck at setup time.
 */
export interface BuildVillainDeckResult {
  /** The villain deck state (shuffled deck + empty discard). */
  state: VillainDeckState;
  /** Card type classification for every card in the deck. */
  cardTypes: Record<CardExtId, RevealedCardType>;
}

/**
 * Builds the villain deck from registry data at setup time.
 *
 * Resolves villain cards, generates virtual henchman/scheme-twist/bystander
 * instances, filters mastermind strike cards, shuffles the combined deck,
 * and returns the deck state with type classifications.
 *
 * @param config - The match setup config providing entity IDs.
 * @param registry - Setup-time registry reader. Accepts unknown to support
 *   narrow test mocks (CardRegistryReader). If the registry does not satisfy
 *   VillainDeckRegistryReader structurally (missing listSets/getSet/full
 *   listCards), returns an empty deck gracefully.
 * @param context - Setup context providing numPlayers and random.Shuffle.
 * @returns The villain deck state and card type classifications.
 * @throws {Error} If required registry data is missing or malformed when the
 *   registry DOES satisfy VillainDeckRegistryReader.
 */
export function buildVillainDeck(
  config: MatchSetupConfig,
  registry: unknown,
  context: SetupContext,
): BuildVillainDeckResult {
  // why: narrow test mocks (CardRegistryReader) only have listCards() returning
  // { key: string }[]. We check for the full VillainDeckRegistryReader interface
  // at runtime. If the registry doesn't have the required methods, we return
  // an empty deck — the reveal pipeline handles this gracefully (WP-014A).
  if (!isVillainDeckRegistryReader(registry)) {
    return { state: { deck: [], discard: [] }, cardTypes: {} };
  }
  const deck: CardExtId[] = [];
  const cardTypes: Record<CardExtId, RevealedCardType> = {};

  // --- 1. Villain cards (from listCards — FlatCard.key is the canonical ext_id) ---
  // why: config.villainGroupIds values match SetData.villains[].slug. FlatCard
  // keys encode this as {setAbbr}-villain-{groupSlug}-{cardSlug}. We use
  // listCards() because FlatCard.key is already the canonical ext_id format.
  const allFlatCards = registry.listCards();
  const villainFlatCards = filterFlatCardsByType(allFlatCards, 'villain');

  // why: D-10014 — Builder Filtering Order — iterate named set only.
  // Each villainGroupIds entry is `<setAbbr>/<groupSlug>`. We parse the
  // qualified form, filter villain cards to that setAbbr first, then match
  // by groupSlug within that set's cards only. No cross-set fallback.
  //
  // Soft-skip on missing data per the validator-is-authoritative model:
  // when validateMatchSetup passes, the data IS present; when tests
  // bypass the validator with empty mocks, the builder produces an
  // empty deck (defense-in-depth). The validator emits format and
  // existence errors with full remediation guidance; the builder
  // never duplicates that responsibility.
  for (const villainGroupId of config.villainGroupIds) {
    const parsed = parseQualifiedId(villainGroupId);
    if (parsed === null) continue;
    const groupCards = filterVillainCardsByGroupSlug(
      villainFlatCards,
      parsed.setAbbr,
      parsed.slug,
    );

    for (const card of groupCards) {
      const extId = card.key as CardExtId;
      deck.push(extId);
      cardTypes[extId] = 'villain';
    }
  }

  // --- 2. Henchman virtual cards (from getSet — not in FlatCard) ---
  // why: D-10014 — Builder Filtering Order — iterate named set only.
  // config.henchmanGroupIds values are `<setAbbr>/<groupSlug>`; the helper
  // constrains the henchmen[] iteration to the named set. Soft-skip on
  // missing data — validator is the authoritative format/existence reporter.
  for (const henchmanGroupId of config.henchmanGroupIds) {
    const parsed = parseQualifiedId(henchmanGroupId);
    if (parsed === null) continue;
    const groupSlug = findHenchmanGroupSlug(registry, parsed.setAbbr, parsed.slug);
    if (groupSlug === null) continue;

    for (let copyIndex = 0; copyIndex < HENCHMAN_COPIES_PER_GROUP; copyIndex++) {
      const paddedIndex = String(copyIndex).padStart(2, '0');
      const extId = `henchman-${groupSlug}-${paddedIndex}` as CardExtId;
      deck.push(extId);
      cardTypes[extId] = 'henchman';
    }
  }

  // --- 3. Scheme twist virtual cards ---
  // why: D-10014 — Builder Filtering Order — iterate named set only.
  // Soft-skip on missing data per the validator-is-authoritative model.
  const parsedScheme = parseQualifiedId(config.schemeId);
  const schemeSlug =
    parsedScheme === null
      ? null
      : findSchemeSlug(registry, parsedScheme.setAbbr, parsedScheme.slug);

  if (schemeSlug !== null) {
    for (let twistIndex = 0; twistIndex < SCHEME_TWIST_COUNT; twistIndex++) {
      const paddedIndex = String(twistIndex).padStart(2, '0');
      const extId = `scheme-twist-${schemeSlug}-${paddedIndex}` as CardExtId;
      deck.push(extId);
      cardTypes[extId] = 'scheme-twist';
    }
  }

  // --- 4. Bystander virtual cards ---
  // why: bystander-villain-deck-{index} format chosen for consistency with
  // henchman and scheme twist patterns. Enables replay targeting of individual
  // bystander reveal events. Count = 1 per player (D-1412). This is separate
  // from config.bystandersCount which sizes the bystander pile (supply).
  const bystanderCount = context.ctx.numPlayers;

  for (let bystanderIndex = 0; bystanderIndex < bystanderCount; bystanderIndex++) {
    const paddedIndex = String(bystanderIndex).padStart(2, '0');
    const extId = `bystander-villain-deck-${paddedIndex}` as CardExtId;
    deck.push(extId);
    cardTypes[extId] = 'bystander';
  }

  // --- 5. Mastermind strike cards (from getSet — need tactic field) ---
  // why: D-10014 — Builder Filtering Order — iterate named set only.
  // config.mastermindId is `<setAbbr>/<mastermindSlug>`; tactic !== true
  // identifies strikes (registry schema contract D-1413). FlatCard.cardType
  // is "mastermind" for all mastermind cards — the strike vs tactic
  // distinction comes from the tactic boolean field in the per-set data.
  // Soft-skip on missing data per the validator-is-authoritative model.
  const parsedMastermind = parseQualifiedId(config.mastermindId);
  const mastermindResult =
    parsedMastermind === null
      ? null
      : findMastermindStrikes(registry, parsedMastermind.setAbbr, parsedMastermind.slug);

  if (mastermindResult !== null) {
    for (const strike of mastermindResult.strikes) {
      const extId = `${mastermindResult.setAbbr}-mastermind-${mastermindResult.mastermindSlug}-${strike.cardSlug}` as CardExtId;
      deck.push(extId);
      cardTypes[extId] = 'mastermind-strike';
    }
  }

  // --- 6. Sort lexically for deterministic pre-shuffle ordering ---
  // why: registry list ordering may vary depending on load order. Stable
  // pre-shuffle ordering ensures the same inputs always generate the same
  // pre-shuffle sequence, making shuffleDeck fully deterministic.
  const sortedDeck = [...deck].sort();

  // --- 7. Shuffle ---
  // why: ctx.random.Shuffle provides deterministic shuffling seeded by
  // boardgame.io's PRNG, ensuring replay reproducibility.
  const shuffledDeck = shuffleDeck(sortedDeck, context);

  return {
    state: { deck: shuffledDeck, discard: [] },
    cardTypes,
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Runtime type guard for VillainDeckRegistryReader.
 *
 * Returns true if the registry object has the required methods (listCards
 * with full FlatCard shape, listSets, getSet). Narrow test mocks that only
 * implement CardRegistryReader will return false.
 */
// why: D-10014 — orchestration-side diagnostic detection seam. The
// orchestration layer (buildInitialGameState) imports this guard to detect
// registry-reader interface mismatches and emit G.messages diagnostics.
export function isVillainDeckRegistryReader(
  registry: unknown,
): registry is VillainDeckRegistryReader {
  if (!registry || typeof registry !== 'object') return false;

  const candidate = registry as Record<string, unknown>;
  return (
    typeof candidate.listCards === 'function' &&
    typeof candidate.listSets === 'function' &&
    typeof candidate.getSet === 'function'
  );
}

/**
 * Parses a set-qualified ID `<setAbbr>/<slug>` into its components.
 *
 * Returns null on any malformed input — empty string, missing slash,
 * multiple slashes, empty parts, or leading/trailing whitespace. Builders
 * throw on null parse results; the validator emits a structured error.
 *
 * Locally duplicated per WP-113 §6 step 1 — `// why: import or duplicate
 * locally — author choice`. The same parser logic lives in
 * `matchSetup.validate.ts` and the four builders that consume qualified
 * IDs. Keeping these copies byte-identical is enforced by tests.
 */
// why: D-10014 — duplicated locally to avoid a circular import between
// builders and matchSetup.validate.ts. The validator imports the four
// Class A/B helpers + guards from the builders; the builders cannot
// reciprocally import from the validator.
function parseQualifiedId(input: string): { setAbbr: string; slug: string } | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  if (input !== input.trim()) return null;
  const slashIndex = input.indexOf('/');
  if (slashIndex === -1) return null;
  if (input.indexOf('/', slashIndex + 1) !== -1) return null;
  const setAbbr = input.slice(0, slashIndex);
  const slug = input.slice(slashIndex + 1);
  if (setAbbr.length === 0 || slug.length === 0) return null;
  return { setAbbr, slug };
}

/**
 * Filters flat cards to only those with the given cardType.
 */
function filterFlatCardsByType(
  cards: VillainDeckFlatCard[],
  cardType: string,
): VillainDeckFlatCard[] {
  const result: VillainDeckFlatCard[] = [];
  for (const card of cards) {
    if (card.cardType === cardType) {
      result.push(card);
    }
  }
  return result;
}

/**
 * Filters villain flat cards by setAbbr first, then by group slug.
 *
 * Per WP-113 D-10014 Builder Filtering Order: parse `<setAbbr>/<slug>` →
 * filter cards by `setAbbr` first → match by `<slug>` within that set's
 * cards only. Builders that match across all sets are in violation of the
 * determinism contract (hero slugs and others collide across sets).
 */
// why: D-10014 — Builder Filtering Order — iterate named set only.
function filterVillainCardsByGroupSlug(
  villainCards: VillainDeckFlatCard[],
  targetSetAbbr: string,
  targetGroupSlug: string,
): VillainDeckFlatCard[] {
  const result: VillainDeckFlatCard[] = [];

  for (const card of villainCards) {
    if (card.setAbbr !== targetSetAbbr) continue;
    const groupSlug = extractVillainGroupSlug(card);
    if (groupSlug === targetGroupSlug) {
      result.push(card);
    }
  }

  return result;
}

/**
 * Extracts the villain group slug from a villain FlatCard.
 *
 * Key format: {setAbbr}-villain-{groupSlug}-{cardSlug}
 * We know setAbbr and cardSlug (card.slug), so groupSlug is the middle part.
 *
 * Promoted to a named export for WP-113 — the validator's
 * `buildKnownVillainGroupQualifiedIds` consumes this as the single source
 * of truth for villain-group-slug grammar (Class A: flat-card-key decoder).
 * Inventing a parallel decoder is contract drift per D-10014 Authority Lock.
 */
// why: D-10014 — single source of truth — flat-card-key decoder.
export function extractVillainGroupSlug(card: VillainDeckFlatCard): string {
  const prefix = `${card.setAbbr}-villain-`;
  const suffix = `-${card.slug}`;

  if (!card.key.startsWith(prefix) || !card.key.endsWith(suffix)) {
    return '';
  }

  return card.key.slice(prefix.length, card.key.length - suffix.length);
}

/**
 * Enumerates henchman-group slugs in a single set's data.
 *
 * Reads `setData.henchmen[].slug` defensively. Returns an empty array on
 * any malformed shape — never throws. Used by the validator's
 * `buildKnownHenchmanGroupQualifiedIds` (Class B: set-data slug
 * enumerator) as the single source of truth for henchman-group slug
 * semantics.
 */
// why: D-10014 — single source of truth — set-data slug enumerator.
export function listHenchmanGroupSlugsInSet(setData: unknown): string[] {
  if (!setData || typeof setData !== 'object') return [];
  const candidate = setData as { henchmen?: unknown };
  if (!Array.isArray(candidate.henchmen)) return [];

  const slugs: string[] = [];
  for (const entry of candidate.henchmen) {
    if (entry && typeof entry === 'object') {
      const henchman = entry as { slug?: unknown };
      if (typeof henchman.slug === 'string' && henchman.slug.length > 0) {
        slugs.push(henchman.slug);
      }
    }
  }
  return slugs;
}

/**
 * Finds a henchman group slug within the named set's henchmen[].
 *
 * Returns null if the named set is not loaded or the slug is not present
 * in it — no cross-set fallback exists. The validator emits actionable
 * errors upfront; this helper soft-skips so test paths bypassing the
 * validator can produce empty decks rather than throwing.
 */
// why: D-10014 — Builder Filtering Order — iterate named set only.
function findHenchmanGroupSlug(
  registry: VillainDeckRegistryReader,
  setAbbr: string,
  henchmanGroupSlug: string,
): string | null {
  const setData = registry.getSet(setAbbr) as SetDataSubset | undefined;
  if (!setData || !Array.isArray(setData.henchmen)) return null;

  for (const entry of setData.henchmen) {
    const henchman = entry as HenchmanGroupEntry;
    if (typeof henchman.slug !== 'string') continue;
    if (henchman.slug === henchmanGroupSlug) {
      return henchman.slug;
    }
  }

  return null;
}

/**
 * Finds a scheme slug within the named set's schemes[].
 *
 * Returns null if the named set is not loaded or the slug is not present
 * in it — no cross-set fallback exists.
 */
// why: D-10014 — Builder Filtering Order — iterate named set only.
function findSchemeSlug(
  registry: VillainDeckRegistryReader,
  setAbbr: string,
  schemeSlug: string,
): string | null {
  const setData = registry.getSet(setAbbr) as SetDataSubset | undefined;
  if (!setData || !Array.isArray(setData.schemes)) return null;

  for (const scheme of setData.schemes) {
    if (typeof scheme.slug !== 'string') continue;
    if (scheme.slug === schemeSlug) {
      return scheme.slug;
    }
  }

  return null;
}

/**
 * Finds mastermind strike cards (tactic !== true) within the named set's
 * masterminds[].
 *
 * Returns null if the named set is not loaded or the mastermind slug is
 * not present in it — no cross-set fallback exists.
 */
// why: D-10014 — Builder Filtering Order — iterate named set only.
function findMastermindStrikes(
  registry: VillainDeckRegistryReader,
  setAbbr: string,
  mastermindSlug: string,
): { setAbbr: string; mastermindSlug: string; strikes: Array<{ cardSlug: string }> } | null {
  const setData = registry.getSet(setAbbr) as SetDataSubset | undefined;
  if (!setData || !Array.isArray(setData.masterminds)) return null;

  for (const mastermind of setData.masterminds) {
    if (typeof mastermind.slug !== 'string') continue;
    if (mastermind.slug !== mastermindSlug) continue;
    if (!Array.isArray(mastermind.cards)) return null;

    const strikes: Array<{ cardSlug: string }> = [];

    for (const card of mastermind.cards) {
      // why: tactic !== true identifies strikes; this is a registry schema
      // contract (D-1413), not a heuristic.
      if (card.tactic !== true) {
        if (typeof card.slug !== 'string') continue;
        strikes.push({ cardSlug: card.slug });
      }
    }

    return {
      setAbbr,
      mastermindSlug: mastermind.slug,
      strikes,
    };
  }

  return null;
}
