/**
 * Pure resolver for count-scaled hero ability effects.
 *
 * resolveCountSource maps a HeroCountSource to the non-negative integer count
 * an `attack-per-count` effect scales by. It is pure and total: it reads only
 * `G`, never mutates, never throws, and returns 0 for any source it does not
 * recognize (the union is closed, so this is defensive). No randomness, no
 * clock, no I/O. Counts are resolved from `G` alone — card ext_ids in the
 * zones (victory-bystanders) and the per-card cost in `G.cardStats`
 * (worthy-cards-played-this-turn) — never from registry lookups at runtime.
 *
 * No boardgame.io imports. No .reduce(). No throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroCountSource } from '../rules/heroCountSource.js';
import { BYSTANDER_EXT_ID } from '../setup/pilesInit.js';

// why: villain-deck bystanders carry the `bystander-villain-deck-NN` ext_id
// form (villainDeck.setup.ts), distinct from the global-pile `pile-bystander`
// form (BYSTANDER_EXT_ID). The victory pile may hold both, so the count must
// span both ext_id forms.
const VILLAIN_DECK_BYSTANDER_PREFIX = 'bystander-villain-deck-';

// why: WP-673 / D-24488 — a card "makes you Worthy" when it is a Hero costing
// >= 5 (the Worthy definition, D-24464). Mirrors the threshold the parser writes
// into the Worthy condition in setup/heroAbility.setup.ts; kept as a local
// constant per the duplicate-first rule (two uses today, no shared owner).
const WORTHY_HERO_COST_THRESHOLD = 5;

// why: WP-674 / D-24489 — the "costs 4 or more" sibling family counts OTHER
// cards played this turn whose printed cost is >= 4. Local constant per the
// duplicate-first rule (one use, distinct from the Worthy threshold above).
const COST_4_PLUS_THRESHOLD = 4;

/**
 * Returns true when an ext_id names a bystander in either ext_id form.
 *
 * @param extId - The card ext_id stored in a zone.
 * @returns Whether the ext_id is a bystander (pile or villain-deck form).
 */
function isBystanderExtId(extId: CardExtId): boolean {
  // why: victory-bystanders counts both bystander ext_id forms
  // (pile-bystander + bystander-villain-deck-NN); villain/henchman/tactic
  // victory-pile cards do not match either form and are excluded.
  return extId === BYSTANDER_EXT_ID || extId.startsWith(VILLAIN_DECK_BYSTANDER_PREFIX);
}

/**
 * Counts the player's victory-pile bystanders across both ext_id forms.
 *
 * @param G - Game state (read-only).
 * @param playerID - The player whose victory pile to count.
 * @returns The number of bystander entries in that player's victory pile.
 */
function countVictoryBystanders(G: LegendaryGameState, playerID: string): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return 0;
  }

  let bystanderCount = 0;
  for (const extId of playerZones.victory) {
    if (isBystanderExtId(extId)) {
      bystanderCount++;
    }
  }
  return bystanderCount;
}

/**
 * Counts the OTHER cards a player has played this turn that make them Worthy.
 *
 * A card "makes you Worthy" when it is a Hero costing >= 5 (D-24464). "Other"
 * excludes the triggering card itself — Divine Lightning's text is "+1 attack
 * for each OTHER card you played this turn that makes you Worthy", and Divine
 * Lightning (cost 5) would otherwise count itself. Cards played this turn live
 * in the in-play zone; a token or basic with no cardStats row (cost 0) never
 * meets the threshold.
 *
 * @param G - Game state (read-only).
 * @param playerID - The player whose in-play zone to count.
 * @param triggeringCardId - The card whose effect is resolving, excluded from the count.
 * @returns The number of other Worthy-making cards played this turn.
 */
function countWorthyCardsPlayedThisTurn(
  G: LegendaryGameState,
  playerID: string,
  triggeringCardId: CardExtId | undefined,
): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardStats) {
    return 0;
  }

  let worthyCount = 0;
  for (const playedCardId of playerZones.inPlay) {
    if (triggeringCardId !== undefined && playedCardId === triggeringCardId) {
      continue;
    }
    // why: safe access — a token in play has no cardStats row (cost 0), so it
    // never meets the >= 5 threshold; only true Heroes contribute.
    const cost = G.cardStats[playedCardId as CardExtId]?.cost ?? 0;
    if (cost >= WORTHY_HERO_COST_THRESHOLD) {
      worthyCount++;
    }
  }
  return worthyCount;
}

/**
 * Counts the OTHER cards a player has played this turn that cost 4 or more.
 *
 * "Other" excludes the triggering card itself — the sibling cards' text is
 * "+N attack/recruit for each OTHER card you played this turn that costs 4 or
 * more", and a triggering card that itself costs >= 4 would otherwise count
 * itself. Cards played this turn live in the in-play zone; a token or basic
 * with no cardStats row (cost 0) never meets the threshold.
 *
 * @param G - Game state (read-only).
 * @param playerID - The player whose in-play zone to count.
 * @param triggeringCardId - The card whose effect is resolving, excluded from the count.
 * @returns The number of other cost-4-plus cards played this turn.
 */
function countCost4PlusCardsPlayedThisTurn(
  G: LegendaryGameState,
  playerID: string,
  triggeringCardId: CardExtId | undefined,
): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardStats) {
    return 0;
  }

  let cost4PlusCount = 0;
  for (const playedCardId of playerZones.inPlay) {
    if (triggeringCardId !== undefined && playedCardId === triggeringCardId) {
      continue;
    }
    // why: safe access — a token in play has no cardStats row (cost 0), so it
    // never meets the >= 4 threshold; only true Heroes contribute.
    const cost = G.cardStats[playedCardId as CardExtId]?.cost ?? 0;
    if (cost >= COST_4_PLUS_THRESHOLD) {
      cost4PlusCount++;
    }
  }
  return cost4PlusCount;
}

/**
 * Counts the OTHER cards a player has played this turn that show a given power icon.
 *
 * "Show an attack/recruit icon" is the FAITHFUL presence test — `hasAttackIcon` /
 * `hasRecruitIcon` on `G.cardStats`, set at setup from the RAW registry value being
 * non-null (WP-675 / D-24490). A `"0+"` card shows the icon but parses to cost/attack 0,
 * so this must NOT test `attack > 0`. "Other" excludes the triggering card itself —
 * vnom's text is "for each OTHER card you played this turn with a … icon". Cards played
 * this turn live in the in-play zone; a card with no cardStats row never counts.
 *
 * @param G - Game state (read-only).
 * @param playerID - The player whose in-play zone to count.
 * @param triggeringCardId - The card whose effect is resolving, excluded from the count.
 * @param icon - Which printed icon to count: 'attack' or 'recruit'.
 * @returns The number of other cards played this turn that show the given icon.
 */
function countIconCardsPlayedThisTurn(
  G: LegendaryGameState,
  playerID: string,
  triggeringCardId: CardExtId | undefined,
  icon: 'attack' | 'recruit',
): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones || !G.cardStats) {
    return 0;
  }

  let iconCount = 0;
  for (const playedCardId of playerZones.inPlay) {
    if (triggeringCardId !== undefined && playedCardId === triggeringCardId) {
      continue;
    }
    // why: faithful icon presence from the setup-derived boolean, not a >0 proxy;
    // a card with no cardStats row (missing entry) never shows the icon.
    const stat = G.cardStats[playedCardId as CardExtId];
    const showsIcon = icon === 'attack' ? stat?.hasAttackIcon === true : stat?.hasRecruitIcon === true;
    if (showsIcon) {
      iconCount++;
    }
  }
  return iconCount;
}

/**
 * Resolves a count source to the non-negative integer it represents.
 *
 * Pure and total: reads only `G`, never mutates or throws, and returns 0 for
 * any unrecognized source. The returned value is the count an `attack-per-count`
 * effect multiplies by its per-unit magnitude.
 *
 * @param G - Game state (read-only).
 * @param playerID - The active player whose state to read.
 * @param source - The count source to resolve.
 * @param triggeringCardId - The card whose effect is resolving, if any. Used by
 *   sources that must exclude the triggering card ("each OTHER card …");
 *   sources that read a zone the triggering card is never in (victory-bystanders)
 *   ignore it.
 * @returns A non-negative integer count (0 for an unknown source).
 */
export function resolveCountSource(
  G: LegendaryGameState,
  playerID: string,
  source: HeroCountSource,
  triggeringCardId?: CardExtId,
): number {
  switch (source) {
    case 'victory-bystanders': {
      return countVictoryBystanders(G, playerID);
    }
    case 'worthy-cards-played-this-turn': {
      return countWorthyCardsPlayedThisTurn(G, playerID, triggeringCardId);
    }
    case 'cost-four-plus-played-this-turn': {
      return countCost4PlusCardsPlayedThisTurn(G, playerID, triggeringCardId);
    }
    case 'attack-icon-played-this-turn': {
      return countIconCardsPlayedThisTurn(G, playerID, triggeringCardId, 'attack');
    }
    case 'recruit-icon-played-this-turn': {
      return countIconCardsPlayedThisTurn(G, playerID, triggeringCardId, 'recruit');
    }
    default: {
      // why: defensive — the union is closed, but an unrecognized source must
      // resolve to 0 (a skipped no-op grant) rather than throw.
      return 0;
    }
  }
}
