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
 *   - zarathos-eruption: discard the cheapest Covert / Ranged Hero (the builder orders by
 *     cost); the alternative is a Wound (D-24833).
 *   - zarathos-imprison: decline. A KO gives up the Villain's VP (RawScore weighs VP x10)
 *     for that many draws, a strategy call with no engine value model (the Dominate the
 *     Weak keep-default precedent, D-24754; D-24833).
 *
 * here-hold-this and random-acts-pass-left answers were added by D-24745.
 * gain-wound-reward, and the Diving Block / Flying Shield Block decline on a Wound gained on
 * purpose for a reward, were added by WP-883 / D-24834.
 * hunt-for-victims (rescue from the Escape Pile, else KO from it, else another rescue, else
 * decline) and hunt-for-victims-ko-hero (a 0-cost Hero, else decline) were added by WP-884 /
 * D-24835.
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
  ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND,
  ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT,
  ZARATHOS_CORRUPTED_SPIRIT_KIND,
  ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND,
  ZARATHOS_DEMONIC_ESSENCE_LAST_KIND,
} from '../moves/seatChoiceTactics.js';
import {
  ESCAPE_BYSTANDER_DISCARD_KIND,
  ESCAPE_EFFECT_COST_DISCARD_KIND,
  VILLAIN_EFFECT_TRAIT_DISCARD_KIND,
} from '../villainDeck/villainEscapeProcedure.js';
import { hasSeatSubmitted, isSeatAddressed } from '../moves/seatChoice.resolve.js';
import { TIMESTREAM_PURGE_SEAT_CHOICE_KIND } from '../rules/timestreamPurge.logic.js';
import { ENIGMA_PEEK_SEAT_CHOICE_KIND } from '../rules/enigmaCode.logic.js';
import { HEIST_SHUFFLE_SEAT_CHOICE_KIND } from '../hero/heistPayloads.logic.js';
import {
  GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX,
  GAIN_WOUND_REWARD_GAIN_OPTION_INDEX,
  GAIN_WOUND_REWARD_SEAT_CHOICE_KIND,
} from '../hero/gainWoundReward.logic.js';
import { addResources } from '../economy/economy.logic.js';
import {
  HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND,
  HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND,
} from '../moves/huntForVictims.logic.js';

// why: WP-876 / D-24823 — the shuffle prompt's "Leave the Villain Deck as it is" option.
/** The option index of Revolutionary Anthem's leave option. */
const HEIST_LEAVE_OPTION_INDEX = 1;
import { victoryPointValueForCard } from '../economy/bloodFrenzy.logic.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { resolveFightPrice } from '../economy/economy.resolve.js';
import { getPatrolModifier } from '../board/boardKeywords.logic.js';
import { getLegalMoves } from './ai.legalMoves.js';
// why: WP-893 / D-24850 — the hero condition evaluator imports no simulation module and none of
// heroEffects.execute.ts, divingBlock.logic.ts, flyingShieldBlock.logic.ts or
// seatChoice.resolve.ts, so reading the Rooftops Conqueror condition here adds no cycle.
import {
  CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE,
  evaluateCondition,
} from '../hero/heroConditions.evaluate.js';

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
    // why: WP-883 / D-24834 — a Wound taken on purpose for a reward is declined (the reveal
    // would forfeit the reward). The entry is the seat's FIRST one, as the apply looks it up.
    const divingBlockEntry = (G.pendingDivingBlockWounds ?? []).find((entry) => entry.playerID === seat);
    if (divingBlockEntry?.gainWoundReward !== undefined) {
      return choice.defaultOptionIndex;
    }
    // why: D-24499 — revealing prevents the Wound and draws a card; it never costs
    // anything (Diving Block stays in hand), so a present player always reveals.
    return DIVING_BLOCK_REVEAL_OPTION_INDEX;
  }
  if (choice.kind === FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND) {
    // why: WP-883 / D-24834 — declined on a Wound taken on purpose for a reward, its own or a
    // teammate's (the teammate keeps the +N; the bot gives up a Bystander rescue). The entry is
    // the one stamped for this seat, as the apply looks it up.
    const flyingShieldBlockEntry = (G.pendingFlyingShieldBlockWounds ?? []).find((entry) => entry.addressedSeat === seat);
    if (flyingShieldBlockEntry?.gainWoundReward !== undefined) {
      return choice.defaultOptionIndex;
    }
    // why: WP-827 / D-24760 — revealing prevents a Wound (any player's) and rescues a
    // Bystander for the bot; the card stays put, so a present bot always reveals.
    return FLYING_SHIELD_BLOCK_REVEAL_OPTION_INDEX;
  }
  if (choice.kind === GAIN_WOUND_REWARD_SEAT_CHOICE_KIND) {
    return chooseGainWoundRewardOption(G, choice, seat);
  }
  if (choice.kind === OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND) {
    // why: WP-828 / D-24761 — the granted Hero is played again next turn, so the bot grants the
    // highest-cost listed Hero (first listed on a tie).
    return chooseHighestCostOption(G, options);
  }
  if (choice.kind === HEIST_SHUFFLE_SEAT_CHOICE_KIND) {
    // why: WP-876 / D-24823 — Revolutionary Anthem's optional shuffle: the bot leaves the Villain
    // Deck as it is (option 1, also the default; belt-and-braces). Reached now that bots attempt a
    // Heist (WP-878 / D-24826): a bot's won Heist with Revolutionary Anthem readied opens it.
    return HEIST_LEAVE_OPTION_INDEX;
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
  // why: WP-837 / D-24770 — the trait discard lists eligible Heroes (and Frost Giant
  // Warrior's Wound option, which has no cardId and is skipped), so the bot discards its
  // cheapest listed Hero.
  // why: WP-829 / D-24762 — the bot Purges the least valuable HQ Hero (its whole Hero Name leaves
  // the HQ for the match), the same pick it makes for a discard.
  // why: WP-882 / D-24833 — each Corrupted Spirit discard-down round drops a Wound first, else
  // the cheapest card (the default is the selector's cheapest, which may be a Hero over a Wound).
  if (
    choice.kind === TIMESTREAM_PURGE_SEAT_CHOICE_KIND ||
    choice.kind === MONARCHS_DISCARD_KIND ||
    choice.kind === ESCAPE_BYSTANDER_DISCARD_KIND ||
    choice.kind === ESCAPE_EFFECT_COST_DISCARD_KIND ||
    choice.kind === VILLAIN_EFFECT_TRAIT_DISCARD_KIND ||
    choice.kind === FALLEN_IDOLS_DISCARD_KIND ||
    choice.kind === COMPUTER_UPLOADED_GENIUS_DISCARD_KIND ||
    choice.kind === ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND
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
  // why: WP-884 / D-24835 — the KO-a-Hero pick after Hunt for Victims is optional; the bot-ally
  // thins a 0-cost Hero (deck thinning, the Crush arm above) or declines.
  if (choice.kind === HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND) {
    return indexOfZeroCostKoOption(G, options);
  }
  if (choice.kind === HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND) {
    return indexOfHuntForVictimsOption(options);
  }
  // why: WP-882 / D-24833 — Demonic Essence of Ghost Rider is optional; the bot-ally thins a
  // 0-cost Hero, one it already played first (D-24754 sibling).
  if (
    choice.kind === ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND ||
    choice.kind === ZARATHOS_DEMONIC_ESSENCE_LAST_KIND
  ) {
    return indexOfPlayedFirstZeroCostKoOption(G, options);
  }
  if (choice.kind === ZARATHOS_CORRUPTED_SPIRIT_KIND) {
    return indexOfZarathosCorruptedSpiritOption(G, seat, options);
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
 * Picks the Hunt for Victims option a playing bot takes: rescue from the Escape Pile, else KO from
 * it, else the first other rescue, else null (the decline default).
 *
 * // why: WP-884 / D-24835, WP-887 / D-24839 — a rescue from the Escape Pile removes that Bystander
 * from bystanderLost and adds its VP. A KO from the Escape Pile is now neutral to bystanderLost (it
 * moves the Bystander from the escaped count to the KO'd-from-play count, D-24839); the answer
 * order is kept unchanged here, and whether another rescue should now outrank it is a follow-up. A
 * KO from a Villain or the Mastermind would add a loss (and removes the VP it would rescue by
 * fighting), so the bot never takes one, nor a capture.
 *
 * @param options - The seat's options; each carries huntAction / huntSource, the decline neither.
 * @returns The chosen option index, or null to keep the decline.
 */
function indexOfHuntForVictimsOption(options: readonly SeatChoiceOption[]): number | null {
  let escapePileKoIndex: number | null = null;
  let firstOtherRescueIndex: number | null = null;
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    const option = options[optionIndex]!;
    if (option.huntSource === 'escape-pile' && option.huntAction === 'rescue') {
      return optionIndex;
    }
    if (option.huntSource === 'escape-pile' && option.huntAction === 'ko' && escapePileKoIndex === null) {
      escapePileKoIndex = optionIndex;
    } else if (option.huntAction === 'rescue' && firstOtherRescueIndex === null) {
      firstOtherRescueIndex = optionIndex;
    }
  }
  if (escapePileKoIndex !== null) {
    return escapePileKoIndex;
  }
  return firstOtherRescueIndex;
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
 * The bot's answer to "You may gain a Wound. If you do, <reward>". For +N Attack: gain only when
 * the +N newly enables a fight (a City Villain or the Mastermind) right now; otherwise decline.
 * Berserk declines; the KO and Transform rewards have their own answers (WP-885 / D-24836).
 *
 * // why: WP-883 / D-24834 — a Wound is a dead card for the rest of the game, so it is worth
 * taking only for a fight the bot could not make without the +N. getLegalMoves is the single
 * mirror of the fight guards; it is asked about two shallow local copies (the open choice set
 * aside, then also the +N added). G is never written.
 *
 * @param G - The game state (read only).
 * @param choice - The open 'gain-wound-reward' choice.
 * @param seat - The addressed seat (the active player).
 * @returns The gain option when it opens a fight, else the decline option.
 */
function chooseGainWoundRewardOption(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  seat: string,
): number {
  const reward = choice.gainWoundReward;
  if (reward === undefined) {
    return GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX;
  }
  switch (reward.rewardType) {
    case 'berserk': {
      // why: WP-885 / D-24836 — Berserk's payoff is the hidden top card of the deck. The bot must
      // not read it to decide, so it declines (the default).
      return choice.defaultOptionIndex;
    }
    case 'optional-ko-hand-discard': {
      return chooseGainWoundForKoOption(G, seat, reward.magnitude);
    }
    case 'transform': {
      return chooseGainWoundForTransformOption(G, seat, reward.sourceCardId);
    }
    case 'rooftops-conqueror': {
      // why: WP-893 / D-24850 — Rooftops Conqueror N pays only while a Villain is in the
      // Rooftops, so with the Rooftops empty (or missing) the Wound buys nothing: decline. With a
      // Villain there it is +N Attack, so fall through to the Attack fight-count rule.
      const condition = { type: CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE, value: 'rooftops' };
      if (!evaluateCondition(G, seat, condition)) {
        return GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX;
      }
      break;
    }
    case 'attack': {
      break;
    }
  }
  const stateWithoutSeatChoice = { ...G, pendingSeatChoice: undefined } as LegendaryGameState;
  const stateWithReward = {
    ...G,
    pendingSeatChoice: undefined,
    turnEconomy: addResources(G.turnEconomy, reward.magnitude, 0),
  } as LegendaryGameState;
  if (countLegalFights(stateWithReward, seat) > countLegalFights(stateWithoutSeatChoice, seat)) {
    return GAIN_WOUND_REWARD_GAIN_OPTION_INDEX;
  }
  return GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX;
}

/**
 * The bot's answer to "You may gain a Wound. If you do, KO up to N other cards from your hand
 * and/or discard pile": gain only when it already holds N cards worth thinning.
 *
 * // why: WP-885 / D-24836 — a Wound is a dead card; trading one for N KOs pays off only when
 * there are at least N cost-0 cards (Wounds and the starting S.H.I.E.L.D. cards) to KO, counted
 * before the gain. Cost reads G.cardStats the way selectDefaultOptionalKoTarget does. G is never
 * written.
 *
 * @param G - The game state (read only).
 * @param seat - The addressed seat (the active player).
 * @param magnitude - How many cards the reward may KO.
 * @returns The gain option when enough cost-0 cards exist, else the decline option.
 */
function chooseGainWoundForKoOption(G: LegendaryGameState, seat: string, magnitude: number): number {
  const zones = G.playerZones[seat];
  if (!zones) {
    return GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX;
  }
  let costZeroCount = 0;
  for (const cardId of zones.hand) {
    if ((G.cardStats[cardId]?.cost ?? 0) === 0) {
      costZeroCount += 1;
    }
  }
  for (const cardId of zones.discard) {
    if ((G.cardStats[cardId]?.cost ?? 0) === 0) {
      costZeroCount += 1;
    }
  }
  if (costZeroCount >= magnitude) {
    return GAIN_WOUND_REWARD_GAIN_OPTION_INDEX;
  }
  return GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX;
}

/**
 * The bot's answer to "You may gain a Wound. If you do, Transform this into <second form>": gain
 * only when the Transform can happen.
 *
 * // why: WP-885 / D-24836 — the second form is a permanent deck upgrade, worth a Wound, but only
 * when the base card is still in play and a second-form copy remains in the transform side deck
 * (otherwise the Wound buys nothing). G is never written.
 *
 * @param G - The game state (read only).
 * @param seat - The addressed seat (the active player).
 * @param sourceCardId - The played base card.
 * @returns The gain option when the Transform can resolve, else the decline option.
 */
function chooseGainWoundForTransformOption(G: LegendaryGameState, seat: string, sourceCardId: string): number {
  const zones = G.playerZones[seat];
  if (!zones || !zones.inPlay.includes(sourceCardId) || !G.transformTargets || !G.transformDeck) {
    return GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX;
  }
  const hashIndex = sourceCardId.indexOf('#');
  let baseKey = sourceCardId;
  if (hashIndex !== -1) {
    baseKey = sourceCardId.slice(0, hashIndex);
  }
  const targetKey = G.transformTargets[baseKey];
  if (targetKey === undefined) {
    return GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX;
  }
  const targetPrefix = `${targetKey}#`;
  for (const sideDeckId of G.transformDeck) {
    if (sideDeckId.startsWith(targetPrefix)) {
      return GAIN_WOUND_REWARD_GAIN_OPTION_INDEX;
    }
  }
  return GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX;
}

/**
 * Counts the seat's legal fightVillain + fightMastermind moves in the given state.
 *
 * @param state - The state to ask getLegalMoves about (read only).
 * @param seat - The seat whose fights are counted.
 * @returns The number of legal fight moves.
 */
function countLegalFights(state: LegendaryGameState, seat: string): number {
  const legalMoves = getLegalMoves(state, {
    phase: 'play',
    turn: 0,
    currentPlayer: seat,
    numPlayers: Object.keys(state.playerZones).length,
  });
  let fights = 0;
  for (const legalMove of legalMoves) {
    if (legalMove.name === 'fightVillain' || legalMove.name === 'fightMastermind') {
      fights++;
    }
  }
  return fights;
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
    // why: D-24802 — the price the seat would pay, Size-Changing included (fightVillain's read).
    const fightCost =
      Math.max(0, resolveFightPrice(G, villainCardId, seat)) + getPatrolModifier(villainCardId, G.cardKeywords ?? {});
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
 * Picks the first 0-cost Hero the seat already played, else the first 0-cost Hero in
 * hand, else the last option ("Don't KO").
 *
 * // why: WP-882 / D-24833 — a played S.H.I.E.L.D. starter has already given its +1 this
 * turn, so KOing it costs nothing now, while a hand starter could still be played. The
 * Demonic Essence options list the hand first, so indexOfZeroCostKoOption would pick the
 * hand copy; that helper and the Crush arm stay as they are (duplicate first, 00.6).
 *
 * @param G - The game state (read for cardStats).
 * @param options - The seat's options; KO options carry cardId and sourceZone, the last is the decline.
 * @returns The chosen option index.
 */
function indexOfPlayedFirstZeroCostKoOption(
  G: LegendaryGameState,
  options: readonly SeatChoiceOption[],
): number {
  for (const sourceZone of ['inPlay', 'hand'] as const) {
    for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
      const option = options[optionIndex]!;
      if (option.cardId === undefined || option.sourceZone !== sourceZone) {
        continue;
      }
      if ((G.cardStats[option.cardId]?.cost ?? 0) === 0) {
        return optionIndex;
      }
    }
  }
  return options.length - 1;
}

/**
 * Picks Corrupted Spirit of Vengeance's discard-down option when discarding down would
 * cost only Wounds, else keeps the default (discard the cheapest matching Hero).
 *
 * // why: WP-882 / D-24833 — the cards owed (hand size - 3) are no more than the Wounds in
 * hand, so every card dropped can be a Wound (the bot's own discard-down rounds drop
 * Wounds first), which beats losing a Hero. Otherwise discarding down costs at least one
 * real card more than the single Hero discard.
 *
 * @param G - The game state (read for the seat's hand).
 * @param seat - The addressed seat.
 * @param options - The seat's options; the discard-down option carries no cardId.
 * @returns The discard-down option index, or null to keep the default.
 */
function indexOfZarathosCorruptedSpiritOption(
  G: LegendaryGameState,
  seat: string,
  options: readonly SeatChoiceOption[],
): number | null {
  const hand = G.playerZones[seat]?.hand ?? [];
  const cardsOwed = hand.length - ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT;
  let woundsInHand = 0;
  for (const cardId of hand) {
    if (cardId === WOUND_EXT_ID) {
      woundsInHand += 1;
    }
  }
  if (cardsOwed > woundsInHand) {
    return null;
  }
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    if (options[optionIndex]!.cardId === undefined) {
      return optionIndex;
    }
  }
  return null;
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
