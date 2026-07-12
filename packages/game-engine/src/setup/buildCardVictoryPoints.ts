/**
 * Card victory-point builder for setup-time resolution.
 *
 * Resolves each VP-bearing card's printed victory points — villains (per-card
 * vp), henchmen (group-level vp), and the mastermind (mastermind-level vp) —
 * from registry data at setup time. Produces G.cardVictoryPoints, a sibling
 * snapshot to G.cardStats / G.villainDeckCardTypes keyed by the same
 * copy-suffixed zone ext_ids, so computeFinalScores can award printed VP
 * without runtime registry access.
 *
 * why: D-24157 — the flat VP table (scoring.types.ts) understated every
 * high-VP villain/mastermind because the engine had no printed VP at scoring
 * time. This builder is the setup-time plumbing that fixes that; scoring reads
 * G.cardVictoryPoints[cardId] and falls back to the flat constant only when a
 * card has no printed vp.
 *
 * No boardgame.io imports. No registry-package imports. No .reduce().
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import { villainCardInstanceExtIds } from '../villainDeck/villainDeck.setup.js';

// why: WP-014B — henchmen are 10 identical virtual copies per group, keyed
// henchman-{groupSlug}-{00..09}. Mirrors the same literal in economy.logic.ts's
// buildCardStats henchman section (that file hardcodes it too); kept local to
// avoid a new cross-module export just for this builder.
const HENCHMAN_COPIES_PER_GROUP = 10;

// ---------------------------------------------------------------------------
// Structural registry reader — local interface (layer boundary)
// ---------------------------------------------------------------------------

// why: the game-engine must not import @legendary-arena/registry; this interface
// is satisfied structurally by CardRegistry. Same pattern as
// CardTraitsRegistryReader (buildCardTraits.ts) and CardStatsRegistryReader.

/** Setup-time registry interface for victory-point resolution. */
export interface VictoryPointsRegistryReader {
  getSet(abbr: string): unknown | undefined;
}

/** Runtime type guard for VictoryPointsRegistryReader. */
export function isVictoryPointsRegistryReader(
  registry: unknown,
): registry is VictoryPointsRegistryReader {
  if (!registry || typeof registry !== 'object') return false;
  const candidate = registry as Record<string, unknown>;
  return typeof candidate.getSet === 'function';
}

// ---------------------------------------------------------------------------
// normalizePrintedVictoryPoints — total, defensive vp parser
// ---------------------------------------------------------------------------

/**
 * Normalizes a printed `vp` field into a non-negative integer, or `undefined`
 * when the card carries no usable printed VP.
 *
 * The registry `vp` field is nullable and source-typed `string | number`. A
 * numeric string parses; `null` / `undefined` / empty / `NaN` / negative /
 * non-integer all resolve to `undefined`.
 *
 * why: an omitted entry lets scoring apply the category fallback constant
 * (VP_VILLAIN / VP_HENCHMAN / VP_TACTIC) rather than scoring the card 0 — a
 * null-vp card (e.g. an mgtg MCU-Guardians mastermind) must never score 0 by
 * accident. Never throws (only Game.setup may throw).
 *
 * @param raw - The registry `vp` value (unknown shape, defensively handled).
 * @returns A non-negative integer, or undefined when there is no printed VP.
 */
export function normalizePrintedVictoryPoints(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0) return undefined;
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return undefined;
    // why: Number('') is 0, so the empty-string guard above is required before
    // parsing; a non-numeric string yields NaN and is rejected below.
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) return undefined;
    return parsed;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Internal structural helpers (defensive getSet walks)
// ---------------------------------------------------------------------------

/**
 * Minimal structural type for a villain card entry inside
 * SetData.villains[i].cards[j]. `copies` feeds villainCardInstanceExtIds; `vp`
 * is the printed victory-point value.
 */
interface VictoryPointsVillainCard {
  slug?: unknown;
  vp?: unknown;
  copies?: number;
}

/**
 * Parses a set-qualified ID `<setAbbr>/<slug>` into its components.
 *
 * Locally duplicated (same rules as the validator / economy.logic.ts) to keep
 * this builder free of validator coupling. Returns null on any malformed input.
 */
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
 * Returns the cards of a villain group within the named set's villains[], or an
 * empty array on any malformed shape. Never throws.
 */
function findVillainGroupCards(
  registry: VictoryPointsRegistryReader,
  setAbbr: string,
  villainGroupSlug: string,
): VictoryPointsVillainCard[] {
  const setData = registry.getSet(setAbbr);
  if (!setData || typeof setData !== 'object') return [];
  const candidate = setData as { villains?: unknown };
  if (!Array.isArray(candidate.villains)) return [];

  for (const group of candidate.villains) {
    if (!group || typeof group !== 'object') continue;
    const villainGroup = group as { slug?: unknown; cards?: unknown };
    if (villainGroup.slug !== villainGroupSlug) continue;
    if (!Array.isArray(villainGroup.cards)) return [];
    return villainGroup.cards as VictoryPointsVillainCard[];
  }
  return [];
}

/**
 * Returns the group-level printed `vp` of a henchman group within the named
 * set's henchmen[], or undefined when absent. Never throws.
 */
function findHenchmanGroupVp(
  registry: VictoryPointsRegistryReader,
  setAbbr: string,
  henchmanGroupSlug: string,
): unknown {
  const setData = registry.getSet(setAbbr);
  if (!setData || typeof setData !== 'object') return undefined;
  const candidate = setData as { henchmen?: unknown };
  if (!Array.isArray(candidate.henchmen)) return undefined;

  for (const group of candidate.henchmen) {
    if (!group || typeof group !== 'object') continue;
    const henchmanGroup = group as { slug?: unknown; vp?: unknown };
    if (henchmanGroup.slug === henchmanGroupSlug) {
      return henchmanGroup.vp;
    }
  }
  return undefined;
}

/**
 * Returns the mastermind-level printed `vp` for the qualified mastermindId
 * (`<setAbbr>/<slug>`) within the named set's masterminds[], or undefined when
 * absent. Never throws.
 */
function findMastermindVp(
  registry: VictoryPointsRegistryReader,
  mastermindId: string,
): unknown {
  const parsed = parseQualifiedId(mastermindId);
  if (parsed === null) return undefined;
  const setData = registry.getSet(parsed.setAbbr);
  if (!setData || typeof setData !== 'object') return undefined;
  const candidate = setData as { masterminds?: unknown };
  if (!Array.isArray(candidate.masterminds)) return undefined;

  for (const entry of candidate.masterminds) {
    if (!entry || typeof entry !== 'object') continue;
    const mastermind = entry as { slug?: unknown; vp?: unknown };
    if (mastermind.slug === parsed.slug) {
      return mastermind.vp;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// buildCardVictoryPoints — main builder
// ---------------------------------------------------------------------------

/**
 * Builds the G.cardVictoryPoints lookup from registry data at setup time.
 *
 * Enumerates the VP-bearing card universe — villains (per-card vp, fanned out
 * per copy via the shared villainCardInstanceExtIds emitter), henchmen
 * (group-level vp across the 10 virtual copies), and the mastermind
 * (mastermind-level vp keyed by the already-built baseCardId) — and records only
 * cards with a valid printed vp. Cards without one are omitted so scoring
 * applies the fallback constant.
 *
 * @param registry - Registry reader (structural interface).
 * @param config - Validated match setup config.
 * @param mastermindBaseCardId - The mastermind's baseCardId from the already-built
 *   MastermindState (the ext_id computeFinalScores reads for tactic VP).
 * @returns Record mapping each VP-bearing CardExtId to its printed VP. Empty when
 *   no card carries a printed vp (e.g. the EMPTY_REGISTRY replay harness).
 */
export function buildCardVictoryPoints(
  registry: unknown,
  config: MatchSetupConfig,
  mastermindBaseCardId: CardExtId,
): Record<CardExtId, number> {
  const victoryPoints: Record<CardExtId, number> = {};
  if (!isVictoryPointsRegistryReader(registry)) {
    return victoryPoints;
  }

  // --- 1. Villains (per-card vp; fan out per copy instance) ---
  for (const villainGroupId of config.villainGroupIds) {
    const parsed = parseQualifiedId(villainGroupId);
    if (parsed === null) continue;
    const villainCards = findVillainGroupCards(registry, parsed.setAbbr, parsed.slug);
    for (const villainCard of villainCards) {
      if (typeof villainCard.slug !== 'string') continue;
      const printedVp = normalizePrintedVictoryPoints(villainCard.vp);
      if (printedVp === undefined) continue;
      const instanceExtIds = villainCardInstanceExtIds(
        parsed.setAbbr,
        parsed.slug,
        villainCard.slug,
        villainCard,
      );
      for (const extId of instanceExtIds) {
        victoryPoints[extId] = printedVp;
      }
    }
  }

  // --- 2. Henchmen (group-level vp; 10 virtual copies henchman-{slug}-{00..09}) ---
  for (const henchmanGroupId of config.henchmanGroupIds) {
    const parsed = parseQualifiedId(henchmanGroupId);
    if (parsed === null) continue;
    const printedVp = normalizePrintedVictoryPoints(
      findHenchmanGroupVp(registry, parsed.setAbbr, parsed.slug),
    );
    if (printedVp === undefined) continue;
    for (let copyIndex = 0; copyIndex < HENCHMAN_COPIES_PER_GROUP; copyIndex++) {
      const paddedIndex = String(copyIndex).padStart(2, '0');
      const extId = `henchman-${parsed.slug}-${paddedIndex}` as CardExtId;
      victoryPoints[extId] = printedVp;
    }
  }

  // --- 3. Mastermind (mastermind-level vp; keyed by the built baseCardId) ---
  // why: computeFinalScores reads G.cardVictoryPoints[G.mastermind.baseCardId]
  // for each defeated tactic. The baseCardId is passed in (already computed by
  // buildMastermindState) so this builder need not re-classify base vs tactic.
  const mastermindVp = normalizePrintedVictoryPoints(
    findMastermindVp(registry, config.mastermindId),
  );
  if (mastermindVp !== undefined) {
    victoryPoints[mastermindBaseCardId] = mastermindVp;
  }

  return victoryPoints;
}
