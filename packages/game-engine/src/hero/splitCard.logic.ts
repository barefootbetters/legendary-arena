/**
 * Divided Card (split hero card) off-play read helpers (WP-724 / D-24545 / WP-772 / D-24604).
 *
 * A split physical card carries two faces. Setup enumerates both faces into G.cardTraits /
 * G.cardStats under their own instance ext_ids, and records the copy-agnostic primary→alternate
 * card-key map (the split-face map, D-24545). An UNPLAYED split card sits in its zone under ONE
 * face id, so every per-id trait / stat read sees only that face. These helpers give off-play
 * read sites the rulebook view of the whole card, derived at read time — no G state is written.
 *
 * In-play reads never call the off-play helpers: once played, the card counts only as the chosen
 * face. The one exception is `playedCardIdsThisTurn` (WP-780 / D-24619): a card Penumbra played
 * both-sides counts as BOTH faces for rules-facing "played this turn" reads.
 *
 * Pure: no boardgame.io import, no I/O, no randomness, never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { CardTraitEntry } from '../state/cardTraits.types.js';
import type { CardStatEntry } from '../economy/economy.types.js';
import { SIDEKICK_EXT_ID } from '../setup/pilesInit.js';

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

/**
 * Returns the "cards played this turn" view of an inPlay zone (WP-780 / D-24619), extended
 * with the cards that went Out of Time or returned from it this turn (WP-803 / D-24692).
 *
 * Starts from `playedCardIdsStillInPlay` (the Penumbra-expanded inPlay), then appends each
 * `G.turnEconomy.outOfTimePlayedCardIds` entry not already present, in record order. Reads the
 * ledger optionally (the minimal-G slice has no turnEconomy) and always returns a fresh array.
 *
 * ACTIVE-PLAYER-SCOPED: the Out of Time ledger belongs to the player whose turn it is, so a
 * call for any other seat's inPlay must not rely on it. Every rules-facing "played" caller
 * evaluates the active player.
 *
 * @param G - The game state (reads turnEconomy and the split-face map only).
 * @param inPlay - The active player's inPlay zone (not mutated).
 * @returns A new array of card ids, one per played card (a both-sides card counts twice; a
 *   card that went Out of Time counts once).
 */
export function playedCardIdsThisTurn(G: LegendaryGameState, inPlay: readonly CardExtId[]): CardExtId[] {
  const played = playedCardIdsStillInPlay(G, inPlay);
  // why: WP-842 / D-24776 — rules v23 "You still 'played' that Sidekick": a played Sidekick
  // returned to the Sidekick Stack left inPlay, so the turn count supplies it. A COUNT (not an
  // id ledger) because every Sidekick token shares one id, so these appends are never
  // de-duplicated among themselves. Placed BEFORE the Out of Time loop so a Sidekick replayed
  // from Out of Time and then returned (in both histories) is absorbed by that loop's
  // `includes` and counts once. Accepted residual (D-24776): two Sidekicks in one turn, one set
  // aside by a granted Out of Time, also collapse to one.
  const sidekicksReturned = G.turnEconomy?.sidekicksReturnedThisTurn ?? 0;
  for (let i = 0; i < sidekicksReturned; i++) {
    played.push(SIDEKICK_EXT_ID);
  }
  // why: WP-803 / D-24692 — rules v23 L1682 ("You 'played' a Man Out of Time card on both the
  // first turn you played it and the second turn when you replayed it") + L3441-3453 (a card
  // you played that moved elsewhere still counts as "cards you played this turn"). The card
  // left inPlay, so the turn ledger supplies it. A card present in both (the turn-2 replay,
  // while it is still in inPlay) counts once.
  const outOfTimePlayed = G.turnEconomy?.outOfTimePlayedCardIds;
  if (outOfTimePlayed === undefined) {
    return played;
  }
  for (const cardId of outOfTimePlayed) {
    if (!played.includes(cardId)) {
      played.push(cardId);
    }
  }
  return played;
}

/**
 * Returns the "played this turn and still in play" view of an inPlay zone (WP-803 / D-24692).
 *
 * This is the Penumbra-expanded inPlay (WP-780 / D-24619) WITHOUT the Out of Time ledger. Each
 * inPlay entry listed in `G.turnEconomy.bothSidesPlayedCardIds` is replaced in place by its two
 * face ids `[faceA, faceB]`; every other entry is copied unchanged, in order. Returns a fresh
 * copy of `inPlay` (identity) when there is no turnEconomy (the minimal-G slice), when the
 * ledger is absent or empty, or when a listed entry's pair resolves to null.
 *
 * "Heroes you have" / "your Heroes" reads use this: rules v23 L3443-3447 say a played card
 * that moved elsewhere doesn't count as "Your Heroes" or "Heroes you Have".
 *
 * @param G - The game state (reads turnEconomy and the split-face map only).
 * @param inPlay - The player's inPlay zone (not mutated).
 * @returns A new array of card ids, one per played card (a both-sides card counts twice).
 */
export function playedCardIdsStillInPlay(G: LegendaryGameState, inPlay: readonly CardExtId[]): CardExtId[] {
  // why: cvwr Penumbra — "play both sides as if they were two different cards". The physical
  // card stays ONE inPlay entry (cleanup, invariants, UI and targets read it raw), so only
  // rules-facing "played this turn" Hero trait / count reads expand it to both face ids here.
  const bothSidesPlayed = G.turnEconomy?.bothSidesPlayedCardIds;
  if (bothSidesPlayed === undefined || bothSidesPlayed.length === 0) {
    return [...inPlay];
  }
  const expanded: CardExtId[] = [];
  for (const cardId of inPlay) {
    const pair = bothSidesPlayed.includes(cardId) ? resolveSplitFacePair(G, cardId) : null;
    if (pair === null) {
      expanded.push(cardId);
      continue;
    }
    expanded.push(pair.faceA, pair.faceB);
  }
  return expanded;
}
