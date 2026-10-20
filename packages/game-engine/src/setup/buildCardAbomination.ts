/**
 * Setup-time Abomination kinds for villain and mastermind cards (WP-815 / D-24747).
 *
 * Abomination, Double Abomination (Villains), Ultimate Abomination and Double
 * Highest Abomination (Masterminds) are printed as bare `[keyword:X]` lines; the
 * co2e Abomination prints the Villain rule as a sentence instead. The villain
 * parser reads only `[effect:X]` tokens, so this builder scans the ability text
 * once at setup and records each kind. The fight-cost resolvers read the result.
 *
 * No boardgame.io import. No randomness. No .reduce().
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { AbominationKind } from '../economy/abomination.logic.js';
// why: the villain entries must key the copy-indexed villain INSTANCE ids that sit
// in the City (the same grammar as G.cardKeywords, D-18704); the shared emitter is
// imported, not re-implemented.
import { villainCardInstanceExtIds } from '../villainDeck/villainDeck.setup.js';

// why: game-engine must not import @legendary-arena/registry; these interfaces
// are satisfied structurally by CardRegistry and narrow the fields read here.
interface AbominationVillainCardEntry {
  slug: string;
  abilities: string[];
  /** Copy count (WP-167 / D-16701); read by the shared instance-id emitter. */
  copies?: number;
}

interface AbominationVillainGroupEntry {
  slug: string;
  cards: AbominationVillainCardEntry[];
}

interface AbominationMastermindCardEntry {
  slug: string;
  tactic?: boolean;
  abilities?: string[];
}

interface AbominationMastermindEntry {
  slug: string;
  cards: AbominationMastermindCardEntry[];
}

interface AbominationRegistryReader {
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// why: matched case-insensitively and tolerant of spacing inside the brackets, so
// a data-casing change can't silently drop a kind. Double is tested before the
// plain keyword (first match wins).
const DOUBLE_ABOMINATION_PATTERN = /\[keyword:\s*double abomination\s*\]/i;
const ABOMINATION_PATTERN = /\[keyword:\s*abomination\s*\]/i;
// why: the co2e Abomination prints the rule in words with no keyword token; matching
// the sentence avoids a data edit that would render a duplicate keyword chip. The
// `^[^:]*` anchor keeps a timing line (`Fight:` / `Ambush:`) from matching.
const ABOMINATION_SENTENCE_PATTERN =
  /^[^:]*gets \+\[icon:attack\] equal to the printed \[icon:attack\] of the Hero in the HQ space under (?:his|her|its) current city space\.?$/i;
const ULTIMATE_ABOMINATION_PATTERN = /\[keyword:\s*ultimate abomination\s*\]/i;
const DOUBLE_HIGHEST_ABOMINATION_PATTERN = /\[keyword:\s*double highest abomination\s*\]/i;

/**
 * Runtime type guard for the registry reader.
 *
 * @param registry - The setup registry, typed unknown to accept narrow mocks.
 * @returns true when the registry exposes getSet.
 */
function isAbominationRegistryReader(registry: unknown): registry is AbominationRegistryReader {
  if (!registry || typeof registry !== 'object') {
    return false;
  }
  return typeof (registry as Record<string, unknown>).getSet === 'function';
}

/**
 * Splits a set-qualified id `<setAbbr>/<slug>` into its parts.
 *
 * @param qualifiedId - The qualified id.
 * @returns The set abbreviation and slug, or null when malformed.
 */
function splitQualifiedId(qualifiedId: string): { setAbbr: string; slug: string } | null {
  const separatorIndex = qualifiedId.indexOf('/');
  if (separatorIndex <= 0 || separatorIndex === qualifiedId.length - 1) {
    return null;
  }
  return { setAbbr: qualifiedId.slice(0, separatorIndex), slug: qualifiedId.slice(separatorIndex + 1) };
}

/**
 * Reads an array-valued field from set data defensively.
 *
 * @param setData - The value returned by getSet.
 * @param fieldName - 'villains' or 'masterminds'.
 * @returns The array, or an empty array when absent or malformed.
 */
function readSetArray(setData: unknown, fieldName: 'villains' | 'masterminds'): unknown[] {
  if (!setData || typeof setData !== 'object') {
    return [];
  }
  const candidate = (setData as Record<string, unknown>)[fieldName];
  if (!Array.isArray(candidate)) {
    return [];
  }
  return candidate;
}

/**
 * The villain-family Abomination kind printed on a villain card, if any.
 *
 * @param abilities - The card's ability lines (may be missing on malformed data).
 * @returns 'double-abomination', 'abomination', or null.
 */
function villainAbominationKind(abilities: unknown): AbominationKind | null {
  if (!Array.isArray(abilities)) {
    return null;
  }
  for (const line of abilities) {
    if (typeof line !== 'string') {
      continue;
    }
    if (DOUBLE_ABOMINATION_PATTERN.test(line)) {
      return 'double-abomination';
    }
    if (ABOMINATION_PATTERN.test(line) || ABOMINATION_SENTENCE_PATTERN.test(line)) {
      return 'abomination';
    }
  }
  return null;
}

/**
 * The mastermind-family Abomination kind printed on a mastermind card, if any.
 *
 * @param abilities - The card's ability lines (may be missing on malformed data).
 * @returns 'ultimate-abomination', 'double-highest-abomination', or null.
 */
function mastermindAbominationKind(abilities: unknown): AbominationKind | null {
  if (!Array.isArray(abilities)) {
    return null;
  }
  for (const line of abilities) {
    if (typeof line !== 'string') {
      continue;
    }
    if (ULTIMATE_ABOMINATION_PATTERN.test(line)) {
      return 'ultimate-abomination';
    }
    if (DOUBLE_HIGHEST_ABOMINATION_PATTERN.test(line)) {
      return 'double-highest-abomination';
    }
  }
  return null;
}

/**
 * Adds an entry for every copy of each Abomination villain in the selected groups.
 *
 * @param registry - The setup registry reader.
 * @param villainGroupIds - The match's `<setAbbr>/<groupSlug>` villain groups.
 * @param result - The map being built (mutated).
 */
function addVillainAbominations(
  registry: AbominationRegistryReader,
  villainGroupIds: readonly string[],
  result: Record<CardExtId, AbominationKind>,
): void {
  for (const villainGroupId of villainGroupIds) {
    const parsed = splitQualifiedId(villainGroupId);
    if (parsed === null) {
      continue;
    }
    for (const groupCandidate of readSetArray(registry.getSet(parsed.setAbbr), 'villains')) {
      const villainGroup = groupCandidate as AbominationVillainGroupEntry;
      if (villainGroup?.slug !== parsed.slug || !Array.isArray(villainGroup.cards)) {
        continue;
      }
      for (const villainCard of villainGroup.cards) {
        const kind = villainAbominationKind(villainCard?.abilities);
        if (typeof villainCard?.slug !== 'string' || kind === null) {
          continue;
        }
        const instanceExtIds = villainCardInstanceExtIds(parsed.setAbbr, parsed.slug, villainCard.slug, villainCard);
        for (const instanceExtId of instanceExtIds) {
          result[instanceExtId] = kind;
        }
      }
    }
  }
}

/**
 * Adds the mastermind's entry when its base face prints a mastermind Abomination kind.
 *
 * @param registry - The setup registry reader.
 * @param mastermindId - The match's `<setAbbr>/<mastermindSlug>`.
 * @param mastermindBaseCardId - The base face id buildMastermindState chose.
 * @param result - The map being built (mutated).
 */
function addMastermindAbomination(
  registry: AbominationRegistryReader,
  mastermindId: string,
  mastermindBaseCardId: CardExtId,
  result: Record<CardExtId, AbominationKind>,
): void {
  const parsed = splitQualifiedId(mastermindId);
  if (parsed === null) {
    return;
  }
  for (const mastermindCandidate of readSetArray(registry.getSet(parsed.setAbbr), 'masterminds')) {
    const mastermind = mastermindCandidate as AbominationMastermindEntry;
    if (mastermind?.slug !== parsed.slug || !Array.isArray(mastermind.cards)) {
      continue;
    }
    for (const mastermindCard of mastermind.cards) {
      if (mastermindCard?.tactic === true || typeof mastermindCard?.slug !== 'string') {
        continue;
      }
      // why: the lookup matches baseCardId by equality so it can never key a different
      // face than buildMastermindState chose (D-24193) — an Epic face printing the same
      // keyword is never flagged.
      const cardId = `${parsed.setAbbr}-mastermind-${parsed.slug}-${mastermindCard.slug}`;
      if (cardId !== mastermindBaseCardId) {
        continue;
      }
      const kind = mastermindAbominationKind(mastermindCard.abilities);
      if (kind !== null) {
        result[mastermindBaseCardId] = kind;
      }
      return;
    }
  }
}

/**
 * Builds the Abomination kind map for the villain groups and mastermind selected for this match.
 *
 * // why: scoped to the selected villain groups and mastermind, not every loaded set,
 * so the map is empty in every match without an Abomination card — the caller
 * assigns it onto G only when non-empty, keeping G (and every hash oracle)
 * byte-identical.
 *
 * @param registry - Setup-time registry reader; unknown so narrow mocks work
 *   (a reader without getSet yields an empty map).
 * @param villainConfig - The match setup carrying the scheme-effective villainGroupIds.
 * @param mastermindId - The selected mastermind, `<setAbbr>/<mastermindSlug>`.
 * @param mastermindBaseCardId - G.mastermind.baseCardId from buildMastermindState.
 * @returns A map from each Abomination villain copy id and the mastermind base id to its kind.
 */
export function buildCardAbomination(
  registry: unknown,
  villainConfig: MatchSetupConfig,
  mastermindId: string,
  mastermindBaseCardId: CardExtId,
): Record<CardExtId, AbominationKind> {
  const result: Record<CardExtId, AbominationKind> = {};
  if (!isAbominationRegistryReader(registry)) {
    return result;
  }
  addVillainAbominations(registry, villainConfig.villainGroupIds, result);
  addMastermindAbomination(registry, mastermindId, mastermindBaseCardId, result);
  return result;
}
