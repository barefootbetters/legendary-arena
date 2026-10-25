/**
 * Playing-seat answers for an open pending seat choice (D-24744).
 *
 * `getLegalMoves` offers an outstanding addressed seat exactly one
 * `resolveSeatChoice`, at `choice.defaultOptionIndex`. That default is the
 * ABSENT-seat answer — what a disconnected or timed-out seat gets (WP-684 /
 * D-24501) — and for some kinds it is deliberately the losing one: Diving Block
 * defaults to DECLINE so an absent seat never gets a phantom free draw (WP-682 /
 * D-24499). A bot ally is a seat that is actually playing, so it answers here
 * instead: the option a present player would take.
 *
 * Kinds whose default already is the present-player answer, or whose best answer
 * is a strategy call this helper does not make, return the default unchanged:
 *   - monarchs-decree-mode: "each other player draws" — the co-op answer.
 *   - escape-hq-ko: the cheapest eligible Hero (the builder orders by cost).
 *   - return-on-discard: return the card to hand.
 *
 * here-hold-this and random-acts-pass-left answers were added by D-24745.
 *
 * The absent-seat default and getLegalMoves are untouched, so autoplay, the
 * simulation runner and PAR keep their D-24590 / D-24573 behaviour (D-24745
 * records why they stay on it).
 *
 * Pure: reads G, never mutates it, never throws, no RNG. No boardgame.io
 * imports. No registry imports. No .reduce().
 */

import type { LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import {
  DIVING_BLOCK_REVEAL_OPTION_INDEX,
  DIVING_BLOCK_SEAT_CHOICE_KIND,
} from '../moves/divingBlock.logic.js';
import { OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND } from '../moves/outOfTimeGrant.logic.js';
import {
  FLYING_SHIELD_BLOCK_REVEAL_OPTION_INDEX,
  FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND,
} from '../moves/flyingShieldBlock.logic.js';
import {
  HERE_HOLD_THIS_KIND,
  RANDOM_ACTS_DIVING_BLOCK_OPTION_INDEX,
  RANDOM_ACTS_PASS_LEFT_KIND,
  RANDOM_ACTS_WOUND_KIND,
} from '../moves/seatChoiceCards.js';
import {
  MONARCHS_DISCARD_KIND,
  VANISHING_ILLUSIONS_KO_KIND,
  FALLEN_IDOLS_DISCARD_KIND,
  COMPUTER_UPLOADED_GENIUS_DISCARD_KIND,
  CRUSH_PACIFIST_RESISTANCE_KO_KIND,
  CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND,
} from '../moves/seatChoiceTactics.js';
import {
  ESCAPE_BYSTANDER_DISCARD_KIND,
  ESCAPE_EFFECT_COST_DISCARD_KIND,
} from '../villainDeck/villainEscapeProcedure.js';
import { hasSeatSubmitted, isSeatAddressed } from '../moves/seatChoice.resolve.js';
import { TIMESTREAM_PURGE_SEAT_CHOICE_KIND } from '../rules/timestreamPurge.logic.js';
import { ENIGMA_PEEK_SEAT_CHOICE_KIND } from '../rules/enigmaCode.logic.js';
import { victoryPointValueForCard } from '../economy/bloodFrenzy.logic.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { resolveFightCost } from '../economy/economy.resolve.js';
import { getPatrolModifier } from '../board/boardKeywords.logic.js';
import { getLegalMoves } from './ai.legalMoves.js';

/**
 * Returns the option index a PLAYING seat submits for the open seat choice, or
 * null when no choice is open or the seat owes no submission.
 *
 * @param G - The game state (read only).
 * @param seat - The addressed seat that owes a submission.
 * @returns The option index to submit, or null when the seat owes nothing.
 */
export function choosePlayingSeatChoiceOption(
  G: LegendaryGameState,
  seat: string,
): number | null {
  const choice = G.pendingSeatChoice;
  if (choice === undefined) {
    return null;
  }
  if (!isSeatAddressed(choice, seat) || hasSeatSubmitted(choice, seat)) {
    return null;
  }
  const options = choice.seatPrompts[seat]?.options;
  if (options === undefined || options.length === 0) {
    return null;
  }
  const chosen = chooseByKind(G, choice, seat, options);
  if (chosen === null || chosen < 0 || chosen >= options.length) {
    return clampDefault(choice, options);
  }
  return chosen;
}

/**
 * Dispatches to the kind's playing-seat answer, or null to keep the default.
 *
 * @param G - The game state (read only).
 * @param choice - The open seat choice.
 * @param seat - The addressed seat.
 * @param options - That seat's own prompt options (non-empty).
 * @returns The chosen option index, or null to fall back to the default.
 */
function chooseByKind(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  seat: string,
  options: readonly SeatChoiceOption[],
): number | null {
  if (choice.kind === DIVING_BLOCK_SEAT_CHOICE_KIND) {
    // why: D-24499 — revealing prevents the Wound and draws a card; it never costs
    // anything (Diving Block stays in hand), so a present player always reveals.
    return DIVING_BLOCK_REVEAL_OPTION_INDEX;
  }
  if (choice.kind === FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND) {
    // why: WP-827 / D-24760 — revealing prevents a Wound (any player's) and rescues a
    // Bystander for the bot; the card stays put, so a present bot always reveals.
    return FLYING_SHIELD_BLOCK_REVEAL_OPTION_INDEX;
  }
  if (choice.kind === OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND) {
    // why: WP-828 / D-24761 — the granted Hero is played again next turn, so the bot grants the
    // highest-cost listed Hero (first listed on a tie).
    return chooseHighestCostOption(G, options);
  }
  if (choice.kind === ENIGMA_PEEK_SEAT_CHOICE_KIND) {
    // why: WP-830 / D-24763 — a seen Enigma card is a right guess later, worth the 1 Recruit; the
    // bot looks at the first unseen card (the offer lists only those, the decline last).
    return 0;
  }
  if (choice.kind === RANDOM_ACTS_WOUND_KIND) {
    // why: D-24678 — the Diving Block option exists only when the seat can reveal it,
    // and "draw a card instead" beats the decline default; without it, keep decline.
    if (options.length > RANDOM_ACTS_DIVING_BLOCK_OPTION_INDEX) {
      return RANDOM_ACTS_DIVING_BLOCK_OPTION_INDEX;
    }
    return null;
  }
  // why: WP-817 / D-24750 — the Primus Escape discard lists only eligible cards, so the
  // bot-ally discards its cheapest one (autoplay / sim / PAR take defaultOptionIndex 0).
  // WP-818 / D-24752: Fallen Idols is the same any-hand-card discard as Monarch's.
  // WP-821 / D-24754: so is Computer-Uploaded Genius.
  // why: WP-829 / D-24762 — the bot Purges the least valuable HQ Hero (its whole Hero Name leaves
  // the HQ for the match), the same pick it makes for a discard.
  if (
    choice.kind === TIMESTREAM_PURGE_SEAT_CHOICE_KIND ||
    choice.kind === MONARCHS_DISCARD_KIND ||
    choice.kind === ESCAPE_BYSTANDER_DISCARD_KIND ||
    choice.kind === ESCAPE_EFFECT_COST_DISCARD_KIND ||
    choice.kind === FALLEN_IDOLS_DISCARD_KIND ||
    choice.kind === COMPUTER_UPLOADED_GENIUS_DISCARD_KIND
  ) {
    return indexOfLeastValuableCard(G, options);
  }
  // why: WP-821 / D-24754 — Crush Pacifist Resistance is optional; the bot-ally KOs a
  // 0-cost Hero (deck thinning) or declines. Dominate the Weak keeps its default (you gain
  // the highest-cost eligible Hero, D-24343).
  if (
    choice.kind === CRUSH_PACIFIST_RESISTANCE_KO_KIND ||
    choice.kind === CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND
  ) {
    return indexOfZeroCostKoOption(G, options);
  }
  if (choice.kind === VANISHING_ILLUSIONS_KO_KIND) {
    return indexOfLowestVictoryPointCard(G, seat, options);
  }
  if (choice.kind === HERE_HOLD_THIS_KIND) {
    return indexOfHereHoldThisTarget(G, seat, options);
  }
  if (choice.kind === RANDOM_ACTS_PASS_LEFT_KIND) {
    // why: D-24745 — passing a Wound is the card's point (step 1 gains one to the hand
    // so it can be passed). A Wound is dead in any hand, so passing it costs the team
    // nothing; otherwise the cheapest card leaves, where the default passes the FIRST
    // hand card, which may be the best one.
    return indexOfLeastValuableCard(G, options);
  }
  return null;
}

/**
 * Picks the City Villain that captures Here, Hold This's Bystander: the one the
 * seat is most likely to fight, so it rescues the Bystander back (+1 VP).
 *
 * // why: D-24745 — rules v23 "A Villain Might Escape" step 2: a Villain that escapes
 * with a Bystander makes EVERY player discard a card. So the pick avoids the Villain
 * that escapes on the next reveal unless the seat can fight it now.
 *   1. A Villain the seat can fight now (getLegalMoves' own fightVillain set): the
 *      escape-edge one first, because the competent policy fights it first (+800)
 *      and the Bystander rides a fight it was making anyway; else the cheapest,
 *      which leaves the most attack for other fights.
 *   2. Nothing affordable: the cheapest Villain that does not escape on the next
 *      reveal, so a teammate is likeliest to fight it first. Ties keep the earliest
 *      option, the lowest City index, which is the farthest from escape.
 *
 * @param G - The game state (read only).
 * @param seat - The acting seat (here-hold-this is active-scoped).
 * @param options - The seat's options; each carries its City space in cityIndex.
 * @returns The chosen option index, or null when no option names a City space.
 */
function indexOfHereHoldThisTarget(
  G: LegendaryGameState,
  seat: string,
  options: readonly SeatChoiceOption[],
): number | null {
  const fightableCityIndices = readFightableCityIndices(G, seat);
  const escapeEdgeIndex = G.city.length - 1;
  if (fightableCityIndices.has(escapeEdgeIndex)) {
    for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
      if (options[optionIndex]!.cityIndex === escapeEdgeIndex) {
        return optionIndex;
      }
    }
  }
  const cheapestFightable = indexOfCheapestCityTarget(G, seat, options, fightableCityIndices);
  if (cheapestFightable !== null) {
    return cheapestFightable;
  }
  const safeCityIndices = new Set<number>();
  for (let cityIndex = 0; cityIndex < G.city.length; cityIndex++) {
    if (!isNextRevealEscape(G, cityIndex)) {
      safeCityIndices.add(cityIndex);
    }
  }
  return indexOfCheapestCityTarget(G, seat, options, safeCityIndices);
}

/**
 * The City spaces the seat could fight right now, read from getLegalMoves with the
 * open seat choice set aside.
 *
 * // why: getLegalMoves is the single mirror of the fightVillain guard (Guard,
 * defeat requirements, resolved and Patrol cost, restricted attack). While the seat
 * choice is open it offers only resolveSeatChoice, so it is asked about the same
 * state without the choice. The copy is shallow and local; G is never written.
 *
 * @param G - The game state (read only).
 * @param seat - The seat whose fights are enumerated.
 * @returns The City indices with a legal fightVillain.
 */
function readFightableCityIndices(G: LegendaryGameState, seat: string): Set<number> {
  const stateWithoutSeatChoice = { ...G, pendingSeatChoice: undefined } as LegendaryGameState;
  const legalMoves = getLegalMoves(stateWithoutSeatChoice, {
    phase: 'play',
    turn: 0,
    currentPlayer: seat,
    numPlayers: Object.keys(G.playerZones).length,
  });
  const fightableCityIndices = new Set<number>();
  for (const legalMove of legalMoves) {
    const cityIndex = (legalMove.args as { cityIndex?: number } | undefined)?.cityIndex;
    if (legalMove.name === 'fightVillain' && cityIndex !== undefined) {
      fightableCityIndices.add(cityIndex);
    }
  }
  return fightableCityIndices;
}

/**
 * Picks the option whose City Villain costs the least to fight, among the allowed
 * City spaces. Ties keep the earliest option.
 *
 * @param G - The game state (read for fight costs).
 * @param seat - The seat whose fight cost is resolved (Blood Frenzy reads the fighter).
 * @param options - The seat's options; each carries its City space in cityIndex.
 * @param allowedCityIndices - The City spaces that may be picked.
 * @returns The option index of the cheapest allowed Villain, or null when none is allowed.
 */
function indexOfCheapestCityTarget(
  G: LegendaryGameState,
  seat: string,
  options: readonly SeatChoiceOption[],
  allowedCityIndices: ReadonlySet<number>,
): number | null {
  let bestIndex: number | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const cityIndex = options[optionIndex]!.cityIndex;
    if (cityIndex === undefined || !allowedCityIndices.has(cityIndex)) {
      continue;
    }
    const villainCardId = G.city[cityIndex];
    if (villainCardId === null || villainCardId === undefined) {
      continue;
    }
    const fightCost =
      resolveFightCost(G, villainCardId, seat) + getPatrolModifier(villainCardId, G.cardKeywords ?? {});
    if (fightCost < bestCost) {
      bestCost = fightCost;
      bestIndex = optionIndex;
    }
  }
  return bestIndex;
}

/**
 * Whether the Villain at a City space escapes on the next Villain-Deck reveal: it
 * sits on the escape edge and every space is occupied, so the entering Villain's
 * push reaches it (rules v23 "Push Other Villains Forward if Necessary").
 *
 * @param G - The game state (read for the City).
 * @param cityIndex - The City space to test.
 * @returns True when that space's Villain escapes on the next reveal.
 */
function isNextRevealEscape(G: LegendaryGameState, cityIndex: number): boolean {
  if (cityIndex !== G.city.length - 1) {
    return false;
  }
  for (const occupant of G.city) {
    if (occupant === null || occupant === undefined) {
      return false;
    }
  }
  return true;
}

/**
 * Picks the card a player would rather lose from hand: a Wound first, otherwise
 * the lowest printed recruit cost. Ties keep the earliest option.
 *
 * // why: the default discards the FIRST hand card, which may be the best card in
 * hand. Cost is the engine's only per-card value signal outside a turn; starting
 * S.H.I.E.L.D. cards cost 0, so they go before any recruited Hero.
 *
 * @param G - The game state (read for cardStats).
 * @param options - The seat's options; each carries the hand instance in cardId.
 * @returns The option index of the least valuable card, or null when none carries a card.
 */
function indexOfLeastValuableCard(
  G: LegendaryGameState,
  options: readonly SeatChoiceOption[],
): number | null {
  let bestIndex: number | null = null;
  let bestValue = Number.POSITIVE_INFINITY;
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const cardId = options[optionIndex]!.cardId;
    if (cardId === undefined) {
      continue;
    }
    if (cardId === WOUND_EXT_ID) {
      return optionIndex;
    }
    const cost = G.cardStats[cardId]?.cost ?? 0;
    if (cost < bestValue) {
      bestValue = cost;
      bestIndex = optionIndex;
    }
  }
  return bestIndex;
}

/**
 * Picks the first KO option whose card costs 0, else the last option ("KO nothing").
 *
 * // why: a 0-cost Hero is a S.H.I.E.L.D. starter (seeded cost 0,
 * buildInitialGameState.ts ~L526); KOing one thins the deck, the classic good KO. Any
 * other weak Hero is worth keeping, so the bot declines.
 *
 * @param G - The game state (read for cardStats).
 * @param options - The seat's options; KO options carry the card in cardId, the last is the decline.
 * @returns The chosen option index.
 */
function indexOfZeroCostKoOption(
  G: LegendaryGameState,
  options: readonly SeatChoiceOption[],
): number {
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const cardId = options[optionIndex]!.cardId;
    if (cardId === undefined) {
      continue;
    }
    if ((G.cardStats[cardId]?.cost ?? 0) === 0) {
      return optionIndex;
    }
  }
  return options.length - 1;
}

/**
 * Picks the Victory-Pile card worth the fewest Victory Points (scoring's own
 * per-card value). Ties keep the earliest option.
 *
 * // why: the default KOs the FIRST Victory-Pile Villain, which may be the highest
 * scoring one; the KO'd card's VP leaves the final score.
 *
 * @param G - The game state (read for victory points).
 * @param seat - The seat whose Victory Pile holds the cards.
 * @param options - The seat's options; each carries the Villain in cardId.
 * @returns The option index of the lowest-VP card, or null when none carries a card.
 */
function indexOfLowestVictoryPointCard(
  G: LegendaryGameState,
  seat: string,
  options: readonly SeatChoiceOption[],
): number | null {
  let bestIndex: number | null = null;
  let bestValue = Number.POSITIVE_INFINITY;
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const cardId = options[optionIndex]!.cardId;
    if (cardId === undefined) {
      continue;
    }
    const victoryPoints = victoryPointValueForCard(G, seat, cardId) ?? 0;
    if (victoryPoints < bestValue) {
      bestValue = victoryPoints;
      bestIndex = optionIndex;
    }
  }
  return bestIndex;
}

/**
 * The choice's default option, clamped into the seat's option range (the same
 * clamp the timeout path applies).
 *
 * @param choice - The open seat choice.
 * @param options - The seat's options (non-empty).
 * @returns An in-range option index.
 */
function clampDefault(choice: PendingSeatChoice, options: readonly SeatChoiceOption[]): number {
  return Math.max(0, Math.min(choice.defaultOptionIndex, options.length - 1));
}

/**
 * The index of the option whose `cardId` has the highest printed cost (first on a tie).
 *
 * @param G - The game state (read only; cardStats).
 * @param options - The seat's options, each carrying a `cardId`.
 * @returns The chosen option index (0 when no option carries a card).
 */
function chooseHighestCostOption(
  G: LegendaryGameState,
  options: readonly SeatChoiceOption[],
): number {
  let bestIndex = 0;
  let bestCost = Number.NEGATIVE_INFINITY;
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const cardId = options[optionIndex]!.cardId;
    if (cardId === undefined) {
      continue;
    }
    const cost = G.cardStats?.[cardId]?.cost ?? 0;
    if (cost > bestCost) {
      bestCost = cost;
      bestIndex = optionIndex;
    }
  }
  return bestIndex;
}
