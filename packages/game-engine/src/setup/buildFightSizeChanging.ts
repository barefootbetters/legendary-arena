/**
 * Setup-time Size-Changing fight discounts for villain and mastermind cards (D-24802).
 *
 * A Villain or Mastermind that prints "Size-Changing [Class]" can be fought for 2 less if
 * you played any [Class] cards this turn (rules v23 p.33). One that prints "Microscopic
 * Size-Changing [Class][Class]…" can be fought for 2 less for each matching card you played
 * this turn, up to one card per icon (rules v23 p.30). Both are printed as a bare line:
 * `[keyword:Size-Changing]: [hc:X], [hc:Y]` or `[keyword:Microscopic Size-Changing] [hc:X][hc:X]`.
 * The villain parser reads only `[effect:X]` tokens, so this builder scans the ability text
 * once at setup (the Abomination precedent, WP-815). The fight-price resolvers read the result.
 *
 * No boardgame.io import. No randomness. No .reduce().
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { FightSizeChanging } from '../types.js';
import { normalizeTraitSlug } from '../state/traits.normalize.js';
// why: the villain entries must key the copy-indexed villain INSTANCE ids that sit in the
// City (the same grammar as G.cardKeywords, D-18704); the shared emitter is imported, not
// re-implemented.
import { villainCardInstanceExtIds } from '../villainDeck/villainDeck.setup.js';

// why: game-engine must not import @legendary-arena/registry; these interfaces are
// satisfied structurally by CardRegistry and narrow the fields read here.
interface SizeChangingVillainCardEntry {
  slug: string;
  abilities: string[];
  /** Copy count (WP-167 / D-16701); read by the shared instance-id emitter. */
  copies?: number;
}

interface SizeChangingVillainGroupEntry {
  slug: string;
  cards: SizeChangingVillainCardEntry[];
}

interface SizeChangingMastermindCardEntry {
  slug: string;
  tactic?: boolean;
  abilities?: string[];
}

interface SizeChangingMastermindEntry {
  slug: string;
  cards: SizeChangingMastermindCardEntry[];
}

interface SizeChangingRegistryReader {
  /** Full set data for one set. */
  getSet(abbr: string): unknown | undefined;
}

// why: anchored to the WHOLE line — the keyword first, then only class icons. A timing line
// that merely mentions the keyword ("Fight: A Hero in the HQ gains [keyword:Size-Changing]
// [hc:tech] this turn", a Master Strike "discards a … [keyword:Size-Changing] Hero") is a
// different effect and must not discount the fight. Case-insensitive, spacing-tolerant.
const SIZE_CHANGING_LINE_PATTERN = /^\s*\[keyword:\s*size-changing\s*\]\s*:?\s*((?:\[hc:[^\]]+\]\s*,?\s*)+)$/i;
const MICROSCOPIC_SIZE_CHANGING_LINE_PATTERN =
  /^\s*\[keyword:\s*microscopic size-changing\s*\]\s*:?\s*((?:\[hc:[^\]]+\]\s*,?\s*)+)$/i;
// why: global, so it is re-created per call (a shared /g regex carries lastIndex state).
const CLASS_ICON_SOURCE = '\\[hc:([^\\]]+)\\]';

/**
 * Runtime type guard for the registry reader.
 *
 * @param registry - The setup registry, typed unknown to accept narrow mocks.
 * @returns true when the registry exposes getSet.
 */
function isSizeChangingRegistryReader(registry: unknown): registry is SizeChangingRegistryReader {
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
 * Reads the normalized class icons from the icon run of a Size-Changing line.
 *
 * @param iconRun - The `[hc:X]…` text after the keyword.
 * @returns One normalized class slug per printed icon, in printed order.
 */
function readClassIcons(iconRun: string): string[] {
  const classIcons: string[] = [];
  const iconPattern = new RegExp(CLASS_ICON_SOURCE, 'gi');
  let iconMatch = iconPattern.exec(iconRun);
  while (iconMatch !== null) {
    classIcons.push(normalizeTraitSlug(iconMatch[1]!));
    iconMatch = iconPattern.exec(iconRun);
  }
  return classIcons;
}

/**
 * Reads a card's Size-Changing fight discount from its ability lines.
 *
 * // why: D-24801 / D-24802 — a Size-Changing class is one 2-less step however many lines
 * name it, so its classes are de-duplicated; each Microscopic icon is its own step, so the
 * icons keep their repeats.
 *
 * @param abilities - The card's ability lines (may be missing on malformed data).
 * @returns The discount, or null when the card prints neither Size-Changing form.
 */
export function readFightSizeChanging(abilities: unknown): FightSizeChanging | null {
  if (!Array.isArray(abilities)) {
    return null;
  }
  const classes: string[] = [];
  const microscopicIcons: string[] = [];
  for (const line of abilities) {
    if (typeof line !== 'string') {
      continue;
    }
    const sizeChangingMatch = SIZE_CHANGING_LINE_PATTERN.exec(line);
    if (sizeChangingMatch !== null) {
      for (const classSlug of readClassIcons(sizeChangingMatch[1]!)) {
        if (!classes.includes(classSlug)) {
          classes.push(classSlug);
        }
      }
      continue;
    }
    const microscopicMatch = MICROSCOPIC_SIZE_CHANGING_LINE_PATTERN.exec(line);
    if (microscopicMatch !== null) {
      for (const classSlug of readClassIcons(microscopicMatch[1]!)) {
        microscopicIcons.push(classSlug);
      }
    }
  }
  if (classes.length === 0 && microscopicIcons.length === 0) {
    return null;
  }
  return { classes, microscopicIcons };
}

/**
 * Adds an entry for every copy of each Size-Changing villain in the selected groups.
 *
 * @param registry - The setup registry reader.
 * @param villainGroupIds - The match's `<setAbbr>/<groupSlug>` villain groups.
 * @param result - The map being built (mutated).
 */
function addVillainSizeChanging(
  registry: SizeChangingRegistryReader,
  villainGroupIds: readonly string[],
  result: Record<CardExtId, FightSizeChanging>,
): void {
  for (const villainGroupId of villainGroupIds) {
    const parsed = splitQualifiedId(villainGroupId);
    if (parsed === null) {
      continue;
    }
    for (const groupCandidate of readSetArray(registry.getSet(parsed.setAbbr), 'villains')) {
      const villainGroup = groupCandidate as SizeChangingVillainGroupEntry;
      if (villainGroup?.slug !== parsed.slug || !Array.isArray(villainGroup.cards)) {
        continue;
      }
      for (const villainCard of villainGroup.cards) {
        const discount = readFightSizeChanging(villainCard?.abilities);
        if (typeof villainCard?.slug !== 'string' || discount === null) {
          continue;
        }
        const instanceExtIds = villainCardInstanceExtIds(parsed.setAbbr, parsed.slug, villainCard.slug, villainCard);
        for (const instanceExtId of instanceExtIds) {
          result[instanceExtId] = { classes: [...discount.classes], microscopicIcons: [...discount.microscopicIcons] };
        }
      }
    }
  }
}

/**
 * Adds an entry for each fightable mastermind face that prints Size-Changing.
 *
 * // why: only the faces the match can fight are keyed: the base face buildMastermindState
 * chose and, for an allowlisted transforming mastermind, its alternate face (the flip swaps
 * the two, so resolveMastermindFightPrice always reads G.mastermind.baseCardId). An Epic face
 * or a not-yet-allowlisted transform face (amwp Yellowjacket) is never fought, so it gets no
 * entry and no hash surface.
 *
 * @param registry - The setup registry reader.
 * @param mastermindId - The match's `<setAbbr>/<mastermindSlug>`.
 * @param fightableFaceIds - The base face id and, when present, the alternate face id.
 * @param result - The map being built (mutated).
 */
function addMastermindSizeChanging(
  registry: SizeChangingRegistryReader,
  mastermindId: string,
  fightableFaceIds: readonly CardExtId[],
  result: Record<CardExtId, FightSizeChanging>,
): void {
  const parsed = splitQualifiedId(mastermindId);
  if (parsed === null) {
    return;
  }
  for (const mastermindCandidate of readSetArray(registry.getSet(parsed.setAbbr), 'masterminds')) {
    const mastermind = mastermindCandidate as SizeChangingMastermindEntry;
    if (mastermind?.slug !== parsed.slug || !Array.isArray(mastermind.cards)) {
      continue;
    }
    for (const mastermindCard of mastermind.cards) {
      if (mastermindCard?.tactic === true || typeof mastermindCard?.slug !== 'string') {
        continue;
      }
      const cardId = `${parsed.setAbbr}-mastermind-${parsed.slug}-${mastermindCard.slug}`;
      if (!fightableFaceIds.includes(cardId)) {
        continue;
      }
      const discount = readFightSizeChanging(mastermindCard.abilities);
      if (discount !== null) {
        result[cardId] = discount;
      }
    }
    return;
  }
}

/**
 * Builds the Size-Changing fight-discount map for the villain groups and mastermind selected for this match.
 *
 * // why: scoped to the selected villain groups and mastermind, not every loaded set, so the
 * map is empty in every match without a Size-Changing villain or mastermind — the caller
 * assigns it onto G only when non-empty, keeping G (and every hash oracle) byte-identical.
 *
 * @param registry - Setup-time registry reader; unknown so narrow mocks work (a reader
 *   without getSet yields an empty map).
 * @param villainConfig - The match setup carrying the scheme-effective villainGroupIds.
 * @param mastermindId - The selected mastermind, `<setAbbr>/<mastermindSlug>`.
 * @param fightableFaceIds - G.mastermind.baseCardId and, when present, alternateFaceId.
 * @returns A map from each Size-Changing villain copy id and mastermind face id to its discount.
 */
export function buildFightSizeChanging(
  registry: unknown,
  villainConfig: MatchSetupConfig,
  mastermindId: string,
  fightableFaceIds: readonly CardExtId[],
): Record<CardExtId, FightSizeChanging> {
  const result: Record<CardExtId, FightSizeChanging> = {};
  if (!isSizeChangingRegistryReader(registry)) {
    return result;
  }
  addVillainSizeChanging(registry, villainConfig.villainGroupIds, result);
  addMastermindSizeChanging(registry, mastermindId, fightableFaceIds, result);
  return result;
}
