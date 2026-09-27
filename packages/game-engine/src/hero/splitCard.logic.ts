/**
 * Divided Card (split hero card) off-play read helpers (WP-724 / D-24545 / WP-772 / D-24604).
 *
 * A split physical card carries two faces. Setup enumerates both faces into G.cardTraits /
 * G.cardStats under their own instance ext_ids, and records the copy-agnostic primary→alternate
 * card-key map (the split-face map, D-24545). An UNPLAYED split card sits in its zone under ONE
 * face id, so every per-id trait / stat read sees only that face. These helpers give off-play
 * read sites the rulebook view of the whole card, derived at read time — no G state is written.
 *
 * In-play reads never call these helpers: once played, the card counts only as the chosen face.
 *
 * Pure: no boardgame.io import, no I/O, no randomness, never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardTraitEntry } from '../state/cardTraits.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';

/**
 * Splits an instance ext_id into its copy-agnostic base key and its `#copyIndex` suffix.
 *
 * @param cardId - A card instance ext_id, e.g. `cvwr/peter-parker/hot-bowl-of-soup#0`.
 * @returns The base key (before `#`) and the suffix (`#0`, or '' when absent).
 */
function splitIntoBaseAndCopySuffix(cardId: string): { baseKey: string; copySuffix: string } {
  const hashIndex = cardId.indexOf('#');
  if (hashIndex === -1) {
    return { baseKey: cardId, copySuffix: '' };
  }
  return { baseKey: cardId.slice(0, hashIndex), copySuffix: cardId.slice(hashIndex) };
}

/**
 * Resolves both face instance ids for a split card instance, from EITHER face id.
 *
 * Returns null when there is no split-face map (a game with no split hero) or when the id's
 * base is neither a primary nor an alternate split face. The primary key is looked up first;
 * the alternate scan runs only on a miss.
 *
 * @param G - The game state (reads the split-face map only).
 * @param cardId - A card instance ext_id of either face.
 * @returns Both face instance ids at the id's own `#copyIndex` (faceA = primary / sides[0],
 *   faceB = alternate / sides[1]), or null when not a split card.
 */
export function resolveSplitFacePair(
  G: LegendaryGameState,
  cardId: string,
): { faceA: CardExtId; faceB: CardExtId } | null {
  const splitFaceMap = G.splitFaces;
  if (splitFaceMap === undefined) {
    return null;
  }
  const { baseKey, copySuffix } = splitIntoBaseAndCopySuffix(cardId);

  const alternateBase = splitFaceMap[baseKey as CardExtId];
  if (alternateBase !== undefined) {
    return {
      faceA: `${baseKey}${copySuffix}` as CardExtId,
      faceB: `${alternateBase}${copySuffix}` as CardExtId,
    };
  }

  // why: a card played as face b keeps its face-b id through cleanup (the resolve relabel
  // survives into the discard pile), so face-b ids reach off-play zones and the next play.
  // The split-face map is keyed by the primary face only, so find the alternate by value.
  for (const [primaryBase, candidateAlternate] of Object.entries(splitFaceMap)) {
    if (candidateAlternate === baseKey) {
      return {
        faceA: `${primaryBase}${copySuffix}` as CardExtId,
        faceB: `${baseKey}${copySuffix}` as CardExtId,
      };
    }
  }
  return null;
}

/**
 * Returns the off-play Hero Class / team view of a card (rules v23 p.49 Divided Cards).
 *
 * For a split card: both faces' classes (heroClass = face a's, heroClass2 = face b's, omitted
 * when equal) and face a's team. For any other card, or when a face entry is missing: the raw
 * G.cardTraits entry for the id (the live reference — callers must not mutate it).
 *
 * @param G - The game state (reads the split-face map and G.cardTraits).
 * @param cardId - The card instance ext_id, in a zone other than inPlay.
 * @returns The off-play trait entry, or undefined when the card has none.
 */
export function offPlayCardTraits(G: LegendaryGameState, cardId: string): CardTraitEntry | undefined {
  const cardTraits = G.cardTraits as Record<CardExtId, CardTraitEntry> | undefined;
  if (cardTraits === undefined) {
    return undefined;
  }
  const rawTraits = cardTraits[cardId as CardExtId];
  const pair = resolveSplitFacePair(G, cardId);
  if (pair === null) {
    return rawTraits;
  }
  const faceATraits = cardTraits[pair.faceA];
  const faceBTraits = cardTraits[pair.faceB];
  if (faceATraits === undefined || faceBTraits === undefined) {
    return rawTraits;
  }
  // why: rules v23 p.49 Divided Cards — anywhere other than in play, a Divided Card counts as
  // ALL its Hero Classes ("a multicolored card"). Every split face has exactly one class (no
  // hc2 on either face, pinned by splitCard.logic.test.ts), so the two-slot entry holds the union.
  const unionTraits: CardTraitEntry = {
    heroClass: faceATraits.heroClass,
    team: faceATraits.team,
  };
  if (faceBTraits.heroClass !== faceATraits.heroClass) {
    unionTraits.heroClass2 = faceBTraits.heroClass;
  }
  return unionTraits;
}

/**
 * Returns the off-play printed-stat view of a card (rules v23 p.49 Divided Cards).
 *
 * For a split card: face a's entry with attack and recruit totalled across both faces and the
 * icon flags OR-ed; every other field (including cost) is face a's. For any other card, or when
 * a face entry is missing: the raw G.cardStats entry for the id (the live reference).
 *
 * @param G - The game state (reads the split-face map and G.cardStats).
 * @param cardId - The card instance ext_id, in a zone other than inPlay.
 * @returns The off-play stat entry, or undefined when the card has none.
 */
export function offPlayCardStats(G: LegendaryGameState, cardId: string): CardStatEntry | undefined {
  const cardStats = G.cardStats as Record<CardExtId, CardStatEntry> | undefined;
  if (cardStats === undefined) {
    return undefined;
  }
  const rawStats = cardStats[cardId as CardExtId];
  const pair = resolveSplitFacePair(G, cardId);
  if (pair === null) {
    return rawStats;
  }
  const faceAStats = cardStats[pair.faceA];
  const faceBStats = cardStats[pair.faceB];
  if (faceAStats === undefined || faceBStats === undefined) {
    return rawStats;
  }
  // why: rules v23 p.49 Divided Cards — off play, a Divided Card's printed Attack / Recruit is
  // the TOTAL of both halves; its cost counts once (both halves print the same cost, so face a's
  // cost is the card's cost).
  return {
    ...faceAStats,
    attack: faceAStats.attack + faceBStats.attack,
    recruit: faceAStats.recruit + faceBStats.recruit,
    hasAttackIcon: faceAStats.hasAttackIcon || faceBStats.hasAttackIcon,
    hasRecruitIcon: faceAStats.hasRecruitIcon || faceBStats.hasRecruitIcon,
  };
}
