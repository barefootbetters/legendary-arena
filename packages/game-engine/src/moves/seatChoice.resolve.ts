/**
 * resolveSeatChoice move + the foundational non-active / multi-seat pending-choice
 * capability (WP-684 / D-24501).
 *
 * This is the STRICT SUPERSET generalization of the shipped active-player-only
 * pending-choice model. It admits two shapes the active-only model cannot:
 *
 *   (a) a pending choice addressed to a SINGLE, possibly NON-ACTIVE, seat, and
 *   (b) a SIMULTANEOUS MULTI-SEAT choice — every addressed seat selects
 *       concurrently; turn progress is blocked (the block-all guard set) until
 *       EVERY addressed seat has submitted, then all selections apply ATOMICALLY
 *       and DETERMINISTICALLY.
 *
 * No card is wired here (WP-682 Diving Block / WP-683 Random Acts are the
 * consumers). The module owns: the predicates the block-all guards and
 * getLegalMoves read, the resolve move, the atomic multi-seat apply, the
 * deterministic disconnect/timeout default, and the boardgame.io stage-ride that
 * admits a non-active seat's move without forking the turn model.
 *
 * No registry imports. No .reduce() in the apply loop. Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
// why: WP-682 / D-24499 — the Diving-Block consumer's kind-specific apply. This module
// and divingBlock.logic form a runtime-safe import cycle (each references the other ONLY
// inside function bodies, never at module top level), so ESM resolves both bindings by
// call time.
import {
  applyDivingBlockResolvedSeatChoice,
  DIVING_BLOCK_SEAT_CHOICE_KIND,
} from './divingBlock.logic.js';
// why: WP-860 / D-24796 — Commune with the Spirit World's three kinds: applies, pre-apply readers and
// chain builders (same runtime-safe cycle; bindings are read only inside function bodies).
import {
  applyCommuneCostResolvedSeatChoice,
  applyCommuneDiscardResolvedSeatChoice,
  applyCommuneKoResolvedSeatChoice,
  chainCommuneAfterCost,
  chainCommuneAfterDiscard,
  readCommuneCostBranch,
  readCommuneDiscardsLeft,
  COMMUNE_COST_SEAT_CHOICE_KIND,
  COMMUNE_DISCARD_SEAT_CHOICE_KIND,
  COMMUNE_KO_SEAT_CHOICE_KIND,
} from './communeSpiritWorld.logic.js';
// why: WP-884 / D-24835 — Hunt for Victims' two kinds: applies, the pre-apply reader and the
// KO-a-Hero chain (same runtime-safe cycle; bindings are read only inside function bodies).
import {
  applyHuntForVictimsKoHeroResolvedSeatChoice,
  applyHuntForVictimsResolvedSeatChoice,
  chainHuntForVictimsKoHero,
  readHuntForVictimsWillKoBystander,
  HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND,
  HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND,
  // why: WP-889 / D-24841 — the Lilin villain hunt's apply, its repeat reader and chain (same
  // runtime-safe cycle).
  applyVillainHuntForVictimsResolvedSeatChoice,
  chainVillainHuntRepeats,
  readVillainHuntRepeats,
  VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND,
} from './huntForVictims.logic.js';
// why: WP-827 / D-24760 — Flying Shield Block's kind-specific apply (same runtime-safe cycle).
import {
  applyFlyingShieldBlockResolvedSeatChoice,
  FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND,
} from './flyingShieldBlock.logic.js';
// why: WP-828 / D-24761 — the Man Out of Time grant's apply (same runtime-safe cycle).
import {
  applyOutOfTimeGrantResolvedSeatChoice,
  OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND,
} from './outOfTimeGrant.logic.js';
// why: WP-870 / D-24815 — Mandarin's Rings Zero's next-hand pick apply (same runtime-safe cycle).
import {
  applyNextHandFromPlayResolvedSeatChoice,
  NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND,
} from './nextHandFromPlay.logic.js';
// why: WP-875 / D-24822 — The Mandarin's Ring-entry apply and kind. mandarin.logic.ts imports no
// boardgame.io, no registry and nothing under villainDeck/, so this edge adds no module cycle.
import {
  applyMandarinRingEntryResolvedSeatChoice,
  MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND,
} from '../mastermind/mandarin.logic.js';
// why: WP-872 / D-24817 — the Mandarin's Rings Liar / Nightbringer / Remaker pick apply, chain and
// kind guard (same runtime-safe cycle: that module imports parkSeatChoice back, and every binding
// is read only inside a function body).
import {
  applyVillainFightPickResolvedSeatChoice,
  chainVillainFightPick,
  isVillainFightPickKind,
} from './villainFightPick.logic.js';
// why: WP-863 / D-24805 — Trap Heroes in the Microverse's "choose any player to gain it" apply (same
// runtime-safe cycle: the binding is read only inside a function body).
import {
  applyMicroSizedGainResolvedSeatChoice,
  MICRO_SIZED_GAIN_SEAT_CHOICE_KIND,
} from '../rules/trapHeroesInTheMicroverse.logic.js';
// why: WP-683 / D-24500 — the two Deadpool consumers' kind-specific applies + the
// Random-Acts wound→pass chain builder.
import {
  applySeatChoiceCard,
  buildPassLeftChoice,
  RANDOM_ACTS_WOUND_KIND,
} from './seatChoiceCards.js';
// why: WP-694 / D-24511 — the two multi-seat core mastermind tactics' kind-specific
// applies + the Monarch's-discard chain builder + the mode reader. Pure module (no
// boardgame.io / parkSeatChoice import) so it never cycles with this one.
import {
  applyMonarchsDecreeMode,
  applyMonarchsDiscard,
  applyVanishingIllusionsKo,
  applyFallenIdolsDiscard,
  buildMonarchsDiscardChoice,
  readMonarchsDecreeSelectedMode,
  MONARCHS_DECREE_MODE_KIND,
  MONARCHS_DISCARD_KIND,
  VANISHING_ILLUSIONS_KO_KIND,
  FALLEN_IDOLS_DISCARD_KIND,
  // why: WP-821 / D-24754 — Arnim Zola's three seat-choice tactics: the kinds, their
  // appliers, and the Crush Pacifist Resistance chain's builder + KO reader.
  applyComputerUploadedGeniusDiscard,
  applyDominateTheWeakGain,
  applyCrushPacifistResistanceKo,
  buildCrushPacifistResistanceChoice,
  didCrushChooseKo,
  COMPUTER_UPLOADED_GENIUS_DISCARD_KIND,
  DOMINATE_THE_WEAK_GAIN_KIND,
  CRUSH_PACIFIST_RESISTANCE_KO_KIND,
  CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND,
  // why: WP-758 / D-24588 — Zarathos's five tactic kinds, their appliers, and the Demonic
  // Essence second-pick builder.
  applyZarathosEruption,
  applyZarathosCorruptedSpirit,
  applyZarathosImprison,
  applyZarathosDemonicEssence,
  buildZarathosDemonicEssenceChoice,
  // why: WP-882 / D-24833 — the Corrupted Spirit discard-down rounds: the apply, the
  // round builder and the reader of the seats that owe it.
  applyZarathosDiscardDown,
  buildZarathosDiscardDownChoice,
  readZarathosDiscardDownSeats,
  ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND,
  ZARATHOS_ERUPTION_KIND,
  ZARATHOS_CORRUPTED_SPIRIT_KIND,
  ZARATHOS_IMPRISON_KIND,
  ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND,
  ZARATHOS_DEMONIC_ESSENCE_LAST_KIND,
} from './seatChoiceTactics.js';
// why: WP-793 / D-24656 — the rulebook escape procedure's two kind-specific applies (HQ KO,
// Bystander discard). villainEscapeProcedure imports parkSeatChoice from this module, so the
// two form a runtime-safe import cycle (each references the other ONLY inside function
// bodies, never at module top level), so ESM resolves both bindings by call time.
import {
  applyEscapeBystanderDiscard,
  applyEscapeEffectCostDiscard,
  applyEscapeHqKo,
  applyVillainEffectTraitDiscard,
  ESCAPE_BYSTANDER_DISCARD_KIND,
  ESCAPE_EFFECT_COST_DISCARD_KIND,
  ESCAPE_HQ_KO_KIND,
  VILLAIN_EFFECT_TRAIT_DISCARD_KIND,
} from '../villainDeck/villainEscapeProcedure.js';
// why: WP-793 / D-24656 — a non-active seat's return-on-discard apply. resolveReturnOnDiscard
// imports parkSeatChoice from this module: the same runtime-safe cycle (function bodies only).
import {
  applyReturnOnDiscardSeatChoice,
  RETURN_ON_DISCARD_SEAT_CHOICE_KIND,
} from './resolveReturnOnDiscard.js';
import { pushLog } from '../log/logPush.js';
// why: WP-758 / D-24588 — the Demonic Essence chain re-reads "you have a Strength Hero".
// zarathos.logic imports wounds.logic, which reaches this module through divingBlock.logic:
// the same runtime-safe cycle as the imports above (function bodies only).
import { playerHasHeroOfClasses } from '../mastermind/zarathos.logic.js';

// why: WP-758 / D-24588 — Demonic Essence's second sentence: "If you have a [strength] Hero".
const ZARATHOS_DEMONIC_ESSENCE_LAST_CLASS = 'strength';
// why: WP-829 / D-24762 — the Purge apply (a runtime-safe cycle: function-body references only).
import {
  applyTimestreamPurgeResolvedSeatChoice,
  TIMESTREAM_PURGE_SEAT_CHOICE_KIND,
} from '../rules/timestreamPurge.logic.js';
// why: WP-830 / D-24763 — the Enigma peek apply (a runtime-safe cycle: function-body references only).
import {
  applyEnigmaPeekResolvedSeatChoice,
  ENIGMA_PEEK_SEAT_CHOICE_KIND,
} from '../rules/enigmaCode.logic.js';
// why: WP-845 / D-24779 — the reveal-or-gain-a-Wound apply. revealOrWoundChoice imports
// parkSeatChoice from this module: the same runtime-safe cycle (function-body references only).
import {
  applyRevealOrWoundSeatChoice,
  REVEAL_OR_WOUND_SEAT_CHOICE_KIND,
} from './revealOrWoundChoice.logic.js';
// why: WP-862 / D-24804 — the Size-Changing grant pick and Shrinking Research Budget's class pick.
// sizeChangingGrant.logic imports parkSeatChoice from this module: the same runtime-safe cycle.
import {
  applySizeChangingClassPickResolvedSeatChoice,
  applySizeChangingGrantResolvedSeatChoice,
  chainSizeChangingClassPick,
  readSizeChangingClassPickSeat,
  SHRINKING_RESEARCH_BUDGET_TACTIC_ID,
  SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND,
  SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND,
} from '../hero/sizeChangingGrant.logic.js';
// why: WP-876 / D-24823 — Revolutionary Anthem's shuffle apply and kind. heistPayloads.logic
// imports parkSeatChoice from this module: the same runtime-safe cycle (function bodies only).
import {
  applyHeistShuffleResolvedSeatChoice,
  HEIST_SHUFFLE_SEAT_CHOICE_KIND,
} from '../hero/heistPayloads.logic.js';
// why: WP-883 / D-24834 — the gain-wound-reward apply and kind. gainWoundReward.logic imports
// wounds.logic, which reaches this module through divingBlock.logic: the same runtime-safe cycle
// as the imports above (function-body references only).
import {
  applyGainWoundRewardSeatChoice,
  GAIN_WOUND_REWARD_SEAT_CHOICE_KIND,
} from '../hero/gainWoundReward.logic.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveSeatChoice move: the option index the submitting seat
 * picks from ITS OWN prompt.
 */
export interface ResolveSeatChoiceArgs {
  /** Which option (0-based index into this seat's own prompt) the seat takes. */
  optionIndex: number;
}

/**
 * The boardgame.io stage a non-active addressed seat is placed into while a seat
 * choice is open. An empty stage — its only purpose is to make the seat active so
 * the framework accepts its resolveSeatChoice move; the seat resolves via the
 * global moves bag (stage → phase → global precedence). Declared on the play
 * phase's turn.stages block in game.ts.
 */
export const SEAT_CHOICE_STAGE = 'resolvingSeatChoice';

/**
 * Minimal boardgame.io events surface this module uses. Optional so a unit test
 * (or the replay context) that dispatches resolveSeatChoice directly, without a
 * live framework, is a guarded no-op.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Whether a non-active/multi-seat seat choice is currently open.
 *
 * The single predicate the block-all action-move guards and the getLegalMoves
 * short-circuit read. Absent (undefined) means no pending seat choice.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when a PendingSeatChoice is open.
 */
export function hasPendingSeatChoice(G: LegendaryGameState): boolean {
  return G.pendingSeatChoice !== undefined;
}

/**
 * Whether the given seat is one the choice is addressed to.
 *
 * @param choice - The open pending seat choice.
 * @param seat - The seat id to test.
 * @returns true when the seat is in choice.addressedSeats.
 */
export function isSeatAddressed(choice: PendingSeatChoice, seat: string): boolean {
  return choice.addressedSeats.includes(seat);
}

/**
 * Whether the given addressed seat has already recorded a submission.
 *
 * @param choice - The open pending seat choice.
 * @param seat - The seat id to test.
 * @returns true when the seat has submitted.
 */
export function hasSeatSubmitted(choice: PendingSeatChoice, seat: string): boolean {
  return Object.prototype.hasOwnProperty.call(choice.submissions, seat);
}

/**
 * The addressed seats that have not yet submitted, in addressedSeats order.
 *
 * @param choice - The open pending seat choice.
 * @returns The still-outstanding addressed seats.
 */
export function getOutstandingSeats(choice: PendingSeatChoice): string[] {
  return choice.addressedSeats.filter((seat) => !hasSeatSubmitted(choice, seat));
}

/**
 * Whether every addressed seat has submitted (the atomic-apply trigger).
 *
 * @param choice - The open pending seat choice.
 * @returns true when no addressed seat is outstanding.
 */
export function allSeatsSubmitted(choice: PendingSeatChoice): boolean {
  return getOutstandingSeats(choice).length === 0;
}

/**
 * Builds the boardgame.io setActivePlayers `value` map that admits every
 * addressed seat into the seat-choice stage with a one-move budget.
 *
 * @param choice - The open pending seat choice.
 * @param activePlayerToSkip - The active player id (ctx.currentPlayer), omitted from
 *   the map when it is the ONLY addressed seat, so a one-seat active choice is never
 *   redundantly stage-ridden (D-24648). In a mixed ride it is admitted like any seat.
 * @returns A per-seat { stage, moveLimit } map (empty when the active player is the
 *   only addressed seat).
 */
export function buildSeatChoiceActivePlayersValue(
  choice: PendingSeatChoice,
  activePlayerToSkip?: string,
): Record<string, { stage: string; moveLimit: number }> {
  const value: Record<string, { stage: string; moveLimit: number }> = {};
  // why: D-24743 — setActivePlayers REPLACES the activePlayers map, so a ride that admits
  // only the non-active seats drops the active player out of it, and boardgame.io refuses
  // the active seat's own resolveSeatChoice (InactivePlayer) until every other seat has
  // answered. A bot answering its own active seat first never lands, and the bot-ally
  // driver faults (4p match Y1w7rCsC8Ek: a Loki Master Strike wounded Diving Block holders
  // 1 and 3 on seat 1's turn). So the D-24648 skip applies only to a one-seat choice
  // addressed to the active player; a mixed ride admits the active seat too.
  const isActiveSeatOnly =
    choice.addressedSeats.length === 1 && choice.addressedSeats[0] === activePlayerToSkip;
  for (const seat of choice.addressedSeats) {
    // why: D-24648 — never stage-ride the ACTIVE player. They are already the
    // ctx.currentPlayer of the { currentPlayer: 'playTurn' } turn, and the stages are
    // empty ({}), so every move (including resolveSeatChoice) is already accepted from
    // them — setActivePlayers is only needed to admit a NON-active seat. Riding the
    // active player adds an open→resolve→revert framework frame sequence that a client can
    // drop, which hard-froze a Diving-Block-on-your-own-turn start-stage escape wound
    // until the player reloaded (spectator-stale resync). Skipping the active seat removes
    // the unnecessary transition. Non-active seats (Random Acts / Monarch's Decree /
    // Diving Block on someone else's wound) still ride.
    if (isActiveSeatOnly) {
      continue;
    }
    value[seat] = { stage: SEAT_CHOICE_STAGE, moveLimit: 1 };
  }
  return value;
}

/**
 * Rides boardgame.io's stage mechanism to admit the addressed seats (which may be
 * NON-ACTIVE) so the framework accepts their resolveSeatChoice move.
 *
 * // why: WP-684 / D-24501 — the play phase's turn is `activePlayers: { currentPlayer:
 * 'playTurn' }`, so boardgame.io REJECTS a move from any non-current player. The
 * generalization RIDES the framework's stage mechanism (setActivePlayers) rather than
 * forking the turn model: each addressed seat is placed into the empty resolvingSeatChoice
 * stage with a one-move budget. `revert: true` + per-seat `moveLimit: 1` makes the framework
 * auto-restore the normal { currentPlayer: 'playTurn' } turn state once every addressed seat
 * has spent its single resolve move — so no explicit release is needed and the turn model is
 * untouched. Guarded so a unit/replay context without setActivePlayers is a no-op (those
 * dispatch resolveSeatChoice directly against G).
 *
 * @param events - The move/park context's boardgame.io events (may lack setActivePlayers).
 * @param choice - The pending seat choice whose seats to admit.
 * @param activePlayerToSkip - The active player id; that seat is not stage-ridden, and
 *   when it is the only addressed seat setActivePlayers is skipped entirely (D-24648).
 */
export function admitSeatsForPendingSeatChoice(
  events: SeatChoiceEvents | undefined,
  choice: PendingSeatChoice,
  activePlayerToSkip?: string,
): void {
  if (typeof events?.setActivePlayers !== 'function') {
    return;
  }
  const value = buildSeatChoiceActivePlayersValue(choice, activePlayerToSkip);
  // why: D-24648 — when every addressed seat is the active player (the common
  // Diving-Block-on-your-own-turn case), the value is empty. Skip setActivePlayers
  // entirely so no stage transition (and no revert frame) is generated — the active
  // player resolves the choice as the normal currentPlayer.
  if (Object.keys(value).length === 0) {
    return;
  }
  events.setActivePlayers({ value, revert: true });
}

/**
 * Foundational park entry for a non-active/multi-seat pending choice.
 *
 * Sets the single open seat choice and admits the addressed seats via the
 * framework stage ride. No card calls this yet — a consuming card (WP-682 /
 * WP-683) invokes it from its effect with the move's events.
 *
 * // why: WP-684 / D-24501 — foundational capability; the consumers wire in later.
 *
 * @param G - The game state to mutate.
 * @param events - The move context's boardgame.io events (for the stage ride).
 * @param choice - The pending seat choice to open.
 * @param activePlayerToSkip - The active player id (ctx.currentPlayer); that seat is not
 *   stage-ridden (D-24648). Omit when no active seat is addressed or in a unit/replay
 *   context (no stage ride is applied there).
 */
export function parkSeatChoice(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  choice: PendingSeatChoice,
  activePlayerToSkip?: string,
): void {
  G.pendingSeatChoice = choice;
  admitSeatsForPendingSeatChoice(events, choice, activePlayerToSkip);
}

/**
 * Applies a fully-submitted seat choice ATOMICALLY and DETERMINISTICALLY, then is
 * the caller's responsibility to clear G.pendingSeatChoice.
 *
 * // why: WP-684 / D-24501 — atomic + deterministic apply. The addressed seats are
 * iterated in ASCENDING id order (a stable, replay-identical order independent of the
 * order seats submitted in), so a multi-seat resolution is byte-identical regardless of
 * who submitted first — the load-bearing determinism guarantee. Runs only when EVERY
 * addressed seat has submitted, so it is atomic by construction (all-or-nothing).
 * Foundational: it records each seat's chosen option to the deterministic message log (the
 * observable apply). The card-specific effect application wires in with the consuming cards
 * (WP-682 / WP-683); no .reduce() (rules/zone-op style).
 *
 * @param G - The game state to mutate.
 * @param choice - The fully-submitted pending seat choice.
 */
export function applyResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const prompt = choice.seatPrompts[seat];
    const option = prompt?.options[submission.optionIndex];
    const label = option?.label ?? `option ${submission.optionIndex}`;
    // why: the resolution is recorded to the deterministic message log so a replay can
    // inspect each seat's choice (SKILL §Debuggability). outcome 'applied' — the selection
    // took effect. LogEntry (not a bare string): G.messages is LogEntry[].
    G.messages.push({
      text: `Seat ${seat} resolved ${choice.kind} choice: ${label}`,
      outcome: 'applied',
    });
  }
}

/**
 * Resolves one addressed seat's selection for the open seat choice.
 *
 * Sequence (moves never throw; every failure is a silent void return that leaves
 * the choice intact):
 *   1. A seat choice must be open.
 *   2. The submitting seat must be addressed and must not have already submitted.
 *   3. The optionIndex must be an integer in range of THAT seat's own prompt.
 *   4. Record the seat's submission.
 *   5. Only when EVERY addressed seat has submitted, apply atomically + clear.
 *
 * // why: WP-684 / D-24501 — a non-active addressed seat resolves its own choice while the
 * active player is blocked by the block-all guard set; the active player CANNOT resolve
 * another seat's choice (the addressed-seat gate in step 2). A multi-seat choice blocks turn
 * progress until the last seat submits, then applies all selections atomically.
 *
 * @param context - boardgame.io move context (G + the submitting playerID).
 * @param args - The chosen option index.
 */
export function resolveSeatChoice(
  { G, ctx, events, playerID, random }: MoveContext,
  args: ResolveSeatChoiceArgs,
): void {
  // Step 1: a seat choice must be open.
  const choice = G.pendingSeatChoice;
  if (choice === undefined) {
    return;
  }

  // Step 2: the submitting seat must be addressed and must not have already submitted.
  // why: this is the target-seat gate — the active player cannot resolve a seat choice
  // addressed only to another seat, and no seat may submit twice.
  if (!isSeatAddressed(choice, playerID) || hasSeatSubmitted(choice, playerID)) {
    return;
  }

  // Step 3: validate the option index against THIS seat's own prompt.
  const prompt = choice.seatPrompts[playerID];
  if (prompt === undefined) {
    return;
  }
  // why: a client may submit the move with no payload (undefined) or null; reading a field off
  // either throws a TypeError, and moves never throw — reject before any field read.
  if (args === null || typeof args !== 'object') {
    return;
  }
  const optionIndex = (args as { optionIndex?: unknown }).optionIndex;
  if (
    typeof optionIndex !== 'number'
    || !Number.isInteger(optionIndex)
    || optionIndex < 0
    || optionIndex >= prompt.options.length
  ) {
    return;
  }

  // Step 4: record this seat's submission.
  choice.submissions[playerID] = { optionIndex };

  // Step 5: apply atomically only when every addressed seat has submitted.
  if (allSeatsSubmitted(choice)) {
    const appliedKind = choice.kind;
    // why: WP-694 / D-24511 — capture the Monarch's-Decree active seat + chosen mode BEFORE
    // the apply clears the choice, so the "discard" branch can chain its multi-seat discard
    // (the mode's own submissions are gone once G.pendingSeatChoice is deleted).
    const monarchsActiveSeat =
      appliedKind === MONARCHS_DECREE_MODE_KIND ? choice.addressedSeats[0] : undefined;
    const monarchsMode =
      appliedKind === MONARCHS_DECREE_MODE_KIND
        ? readMonarchsDecreeSelectedMode(choice)
        : undefined;
    // why: WP-821 / D-24754 — capture Crush Pacifist Resistance's active seat and whether its
    // FIRST pick KO'd a Hero before the apply clears the choice, beside the Monarch's capture.
    const crushActiveSeat =
      appliedKind === CRUSH_PACIFIST_RESISTANCE_KO_KIND ? choice.addressedSeats[0] : undefined;
    const crushChoseKo =
      appliedKind === CRUSH_PACIFIST_RESISTANCE_KO_KIND && didCrushChooseKo(choice);
    // why: WP-758 / D-24588 — capture the Demonic Essence seat before the apply clears the
    // choice; the Strength line's KO chains below after an accept OR a decline of the Ranged
    // line's (each "if you have" sentence is its own optional KO), unlike Crush, which
    // chains only after a KO.
    const demonicEssenceSeat =
      appliedKind === ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND ? choice.addressedSeats[0] : undefined;
    // why: WP-860 / D-24796 — capture Commune with the Spirit World's seat, source card, chosen cost
    // branch and discards left BEFORE the apply clears the choice (the Crush capture above); the
    // readers re-check the card, so a stale option chains nothing (no KO without payment).
    const isCommuneCost = appliedKind === COMMUNE_COST_SEAT_CHOICE_KIND;
    const isCommuneDiscard = appliedKind === COMMUNE_DISCARD_SEAT_CHOICE_KIND;
    const communeSeat = isCommuneCost || isCommuneDiscard ? choice.addressedSeats[0] : undefined;
    const communeSourceCardId = choice.communeSpiritWorld?.sourceCardId;
    const communeCostBranch = isCommuneCost ? readCommuneCostBranch(G, choice) : undefined;
    const communeDiscardsLeft = isCommuneDiscard ? readCommuneDiscardsLeft(G, choice) : undefined;
    // why: WP-884 / D-24835 — capture the Hunt for Victims seat and source card, and whether the
    // chosen option will KO (or rescue) a Bystander, BEFORE the apply moves it and the delete clears
    // the choice (the Commune capture above). The reader re-checks the holder, so a capture, a
    // decline or a stale option chains no Hero pick.
    const isHuntForVictims = appliedKind === HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND;
    const huntSeat = isHuntForVictims ? choice.addressedSeats[0] : undefined;
    const huntSourceCardId = choice.huntForVictims?.sourceCardId;
    const huntWillKoBystander = isHuntForVictims && readHuntForVictimsWillKoBystander(G, choice);
    // why: WP-889 / D-24841 RS-3b — capture the hunts a villain hunt choice still owes (Blackout's
    // Moonlight repeat) BEFORE the apply and the delete clear the choice, beside the hero reader.
    const villainHuntRepeats = readVillainHuntRepeats(choice);
    // why: WP-862 / D-24804 — capture a Shrinking Research Budget class pick's seat BEFORE the
    // apply clears the choice, so the next dual-class Hero's pick chains below (the Commune shape).
    const sizeChangingClassPickSeat = readSizeChangingClassPickSeat(choice);
    // why: WP-872 / D-24817 — capture a Mandarin's Rings pick choice BEFORE the apply (which
    // writes the step's result onto its payload) and the delete, so its next step chains below.
    const villainFightPickChoice = isVillainFightPickKind(appliedKind) ? choice : undefined;
    // why: WP-882 / D-24833 — capture the seats that owe Corrupted Spirit's discard-down BEFORE
    // the apply and the delete clear the choice: after a Corrupted Spirit choice, the forced seats
    // plus the seats that chose it; after a discard-down round, the round's own seats. The chain
    // below re-reads their CURRENT hands, so a seat that reached 3 drops out.
    let zarathosDiscardDownSeats: string[] | undefined;
    if (appliedKind === ZARATHOS_CORRUPTED_SPIRIT_KIND) {
      zarathosDiscardDownSeats = readZarathosDiscardDownSeats(choice);
    } else if (appliedKind === ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND) {
      zarathosDiscardDownSeats = [...choice.addressedSeats];
    }
    // why: WP-682 / WP-683 — dispatch by kind (diving-block via its own apply; the Deadpool
    // kinds via applySeatChoiceCard; the 'generic' kind via the foundational per-seat log).
    // why: D-24732 — ctx?. because narrow test contexts omit ctx; moves never throw.
    applySeatChoiceByKind(G, choice, { random }, ctx?.currentPlayer);
    delete G.pendingSeatChoice;
    // why: WP-683 / D-24500 — Random Acts is two steps: the active-scoped optional wound
    // gain (step 1) CHAINS the simultaneous multi-seat pass-left (step 2). The chain parks
    // here (not inside the ctx-free apply) because admitting the NON-ACTIVE seats needs the
    // move's events.setActivePlayers, and "left" adjacency needs ctx.playOrder — both present
    // only in this live move context.
    if (appliedKind === RANDOM_ACTS_WOUND_KIND) {
      chainRandomActsPassLeft(G, ctx, events);
    }
    // why: WP-694 / D-24511 — Monarch's Decree "discard" branch CHAINS the simultaneous
    // multi-seat discard (each other player picks a card to discard). The chain parks here
    // (not inside the ctx-free apply) because admitting the NON-ACTIVE seats needs the move's
    // events.setActivePlayers — exactly as chainRandomActsPassLeft chains the Random Acts pass
    // (WP-683 precedent). The "draw" branch already resolved inside the mode apply and chains
    // nothing.
    if (monarchsMode === 'discard' && monarchsActiveSeat !== undefined) {
      chainMonarchsDiscard(G, monarchsActiveSeat, events);
    }
    // why: WP-821 / D-24754 — "KO up to two" is two picks; the second chains here only after
    // the first KO'd a Hero, exactly where Monarch's Decree chains its discard (D-24511). The
    // last-ko kind never chains, so at most two KOs.
    if (crushChoseKo && crushActiveSeat !== undefined) {
      chainCrushPacifistResistanceLastKo(G, crushActiveSeat, events);
    }
    // why: WP-758 / D-24588 — Demonic Essence's Strength line, built fresh from the seat's
    // current zones and re-checked there. The timeout path does not chain (D-24501), so a
    // defaulted first pick is a decline of both.
    if (demonicEssenceSeat !== undefined) {
      chainZarathosDemonicEssenceLast(G, demonicEssenceSeat, events);
    }
    // why: WP-860 / D-24796 — Commune chains its next step (discard picks, then the KO pick) here in
    // the live move context, exactly where Crush chains its second KO (D-24754).
    if (communeSeat !== undefined && communeSourceCardId !== undefined) {
      if (communeCostBranch !== undefined) {
        chainCommuneAfterCost(G, communeSeat, communeCostBranch, communeSourceCardId, events);
      } else if (communeDiscardsLeft !== undefined) {
        chainCommuneAfterDiscard(G, communeSeat, communeDiscardsLeft, communeSourceCardId, events);
      }
    }
    // why: WP-884 / D-24835 — "If it KOs a Bystander this way, you may KO a Hero": the optional Hero
    // pick chains here in the live move context, exactly where Commune chains its next step, and
    // only after a KO or rescue. The timeout path does not chain (its default is decline anyway).
    if (huntWillKoBystander && huntSeat !== undefined && huntSourceCardId !== undefined) {
      chainHuntForVictimsKoHero(G, huntSeat, huntSourceCardId);
    }
    // why: WP-889 / D-24841 RS-3b — Blackout hunts again here, after its first hunt resolved, in the
    // live move context beside the hero hunt's chain, so the second hunt sees the post-choice board
    // and may park again. The timeout path does not chain (the D-24501 residual).
    if (villainHuntRepeats !== undefined) {
      chainVillainHuntRepeats(G, villainHuntRepeats.seat, villainHuntRepeats.sourceCardId, villainHuntRepeats.repeats);
    }
    // why: WP-862 / D-24804 — Shrinking Research Budget chains its next dual-class Hero's class
    // pick here in the live move context, exactly where Commune chains its next step.
    if (sizeChangingClassPickSeat !== undefined) {
      // why: the class-pick kind carries no source field; its only source is the tactic (D-24804).
      chainSizeChangingClassPick(G, sizeChangingClassPickSeat, SHRINKING_RESEARCH_BUDGET_TACTIC_ID);
    }
    // why: WP-872 / D-24817 — Liar, Nightbringer and Remaker chain their next step here in the
    // live move context: parking Liar's decide for the NON-ACTIVE target needs the move's
    // events.setActivePlayers, and Nightbringer's Fight effect needs the turn and random. The
    // timeout path (applySeatChoiceTimeoutDefault) does not chain: the shared D-24500 / D-24501
    // residual, since that path is not wired live.
    if (villainFightPickChoice !== undefined) {
      chainVillainFightPick(G, villainFightPickChoice, ctx, events, random);
    }
    // why: WP-882 / D-24833 — Corrupted Spirit's discard-down chains its next one-card round here
    // in the live move context (the Monarch's / Crush shape): admitting the NON-ACTIVE owing
    // seats needs the move's events.setActivePlayers. The timeout path does not chain (D-24501).
    if (zarathosDiscardDownSeats !== undefined) {
      chainZarathosDiscardDown(G, zarathosDiscardDownSeats, events);
    }
  }
}

/**
 * Dispatches a fully-submitted seat choice to its kind-specific apply, or the
 * foundational log-only apply for the generic kind.
 *
 * // why: WP-682 / D-24499 — the foundational applyResolvedSeatChoice logs only; each
 * consuming card wires its effect here by kind. Diving Block undoes the resolved Wound
 * (or keeps it) and drains its FIFO. The shuffle context is threaded for the reveal draw;
 * the disconnect/timeout default supplies none (its default is decline → no draw).
 *
 * // why: WP-683 / D-24500 — the Deadpool kinds (here-hold-this / random-acts-wound /
 * random-acts-pass-left) dispatch through applySeatChoiceCard; only the foundational
 * 'generic' kind (and any unrecognized kind) reaches the per-seat message log.
 *
 * @param G - The game state to mutate.
 * @param choice - The fully-submitted pending seat choice.
 * @param shuffleContext - Deterministic reshuffle source, or undefined (timeout path).
 * @param currentPlayer - The turn's active player (ctx.currentPlayer), or undefined on the
 *   timeout path; a Diving Block draw counts toward cardsDrawn only for this seat (D-24732).
 */
function applySeatChoiceByKind(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  shuffleContext: { random: { Shuffle: <T>(deck: T[]) => T[] } } | undefined,
  currentPlayer?: string,
): void {
  if (choice.kind === DIVING_BLOCK_SEAT_CHOICE_KIND) {
    applyDivingBlockResolvedSeatChoice(G, choice, shuffleContext, currentPlayer);
    return;
  }
  // why: WP-827 / D-24760 — Flying Shield Block: a reveal returns the Wound and rescues a
  // Bystander for the revealing seat; a decline passes the Wound to the next seat that could
  // reveal. No draw, so no shuffle context.
  if (choice.kind === FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND) {
    applyFlyingShieldBlockResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-860 / D-24796 — Commune with the Spirit World: the cost, a hand-discard pick, the KO
  // pick. None draws, so none needs the shuffle context; the chain runs from resolveSeatChoice.
  if (choice.kind === COMMUNE_COST_SEAT_CHOICE_KIND) {
    applyCommuneCostResolvedSeatChoice(G, choice);
    return;
  }
  if (choice.kind === COMMUNE_DISCARD_SEAT_CHOICE_KIND) {
    applyCommuneDiscardResolvedSeatChoice(G, choice);
    return;
  }
  if (choice.kind === COMMUNE_KO_SEAT_CHOICE_KIND) {
    applyCommuneKoResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-863 / D-24805 — the chosen player gains the defeated Micro-Sized Villain as a Hero.
  if (choice.kind === MICRO_SIZED_GAIN_SEAT_CHOICE_KIND) {
    applyMicroSizedGainResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-828 / D-24761 — the chosen hand Hero gains Man Out of Time this turn.
  if (choice.kind === OUT_OF_TIME_GRANT_SEAT_CHOICE_KIND) {
    applyOutOfTimeGrantResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-870 / D-24815 — the chosen played 0-cost card is recorded for the next hand (Zero).
  // Required: without this arm the owed pick never leaves G.pendingNextHandFromPlayPicks.
  if (choice.kind === NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND) {
    applyNextHandFromPlayResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-875 / D-24822 — The Mandarin's Master Strike: each answering seat's chosen Ring is
  // recorded on its first unchosen G.pendingMandarinRingEntries entry. The apply never moves a
  // card; the next onMove opener enters it (the escape it may cause needs the turn and the map).
  if (choice.kind === MANDARIN_RING_ENTRY_SEAT_CHOICE_KIND) {
    applyMandarinRingEntryResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-872 / D-24817 — the six Mandarin's Rings pick kinds apply their step here, ctx-free
  // (so a defaulted choice still moves the card). Required BEFORE the applySeatChoiceCard /
  // generic applyResolvedSeatChoice fall-through: its public "Seat N resolved <kind> choice:
  // <label>" line would leak Liar's looked-at card from a 'liar-claim' label.
  if (isVillainFightPickKind(choice.kind)) {
    applyVillainFightPickResolvedSeatChoice(G, choice, shuffleContext);
    return;
  }
  // why: WP-694 / D-24511 — Monarch's Decree mode apply: the "draw" branch draws for each
  // other player (reshuffle-aware, so it needs the shuffle context); the "discard" branch is
  // a no-op here and chains its multi-seat discard from the live move context below.
  if (choice.kind === MONARCHS_DECREE_MODE_KIND) {
    applyMonarchsDecreeMode(G, choice, shuffleContext);
    return;
  }
  // why: WP-694 / D-24511 — the two simultaneous multi-seat tactic applies (each atomic +
  // ascending-seat-order); neither draws, so neither needs the shuffle context.
  if (choice.kind === MONARCHS_DISCARD_KIND) {
    applyMonarchsDiscard(G, choice);
    return;
  }
  if (choice.kind === VANISHING_ILLUSIONS_KO_KIND) {
    applyVanishingIllusionsKo(G, choice);
    return;
  }
  // why: WP-818 / D-24752 — Baron Zemo's Fallen Idols discard, the Monarch's discard
  // apply for the other non-Savior seats (atomic, ascending seats, no draw).
  if (choice.kind === FALLEN_IDOLS_DISCARD_KIND) {
    applyFallenIdolsDiscard(G, choice);
    return;
  }
  // why: WP-821 / D-24754 — Arnim Zola's tactics: Computer-Uploaded Genius' discard (the
  // Fallen Idols body), Dominate the Weak's gain, and both Crush Pacifist Resistance picks
  // (one applier). None draws, so none needs the shuffle context.
  if (choice.kind === COMPUTER_UPLOADED_GENIUS_DISCARD_KIND) {
    applyComputerUploadedGeniusDiscard(G, choice);
    return;
  }
  if (choice.kind === DOMINATE_THE_WEAK_GAIN_KIND) {
    applyDominateTheWeakGain(G, choice);
    return;
  }
  if (
    choice.kind === CRUSH_PACIFIST_RESISTANCE_KO_KIND ||
    choice.kind === CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND
  ) {
    applyCrushPacifistResistanceKo(G, choice);
    return;
  }
  // why: WP-758 / D-24588 — Zarathos's tactic choices. The two multi-seat kinds apply in
  // ascending seat order (no draw); Imprison draws its Villain's VP, so it takes the shuffle
  // context and the current player (cardsDrawn, D-24732); both Demonic kinds share one apply.
  if (choice.kind === ZARATHOS_ERUPTION_KIND) {
    applyZarathosEruption(G, choice);
    return;
  }
  if (choice.kind === ZARATHOS_CORRUPTED_SPIRIT_KIND) {
    applyZarathosCorruptedSpirit(G, choice);
    return;
  }
  // why: WP-882 / D-24833 — one discard-down round: each owing seat's chosen card, ascending.
  if (choice.kind === ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND) {
    applyZarathosDiscardDown(G, choice);
    return;
  }
  if (choice.kind === ZARATHOS_IMPRISON_KIND) {
    applyZarathosImprison(G, choice, shuffleContext, currentPlayer);
    return;
  }
  if (
    choice.kind === ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND ||
    choice.kind === ZARATHOS_DEMONIC_ESSENCE_LAST_KIND
  ) {
    applyZarathosDemonicEssence(G, choice);
    return;
  }
  // why: WP-793 / D-24656 — the escape procedure's HQ KO (the current player's pick) and
  // every-player Bystander discard (atomic, ascending seats, through discardFromHand), and a
  // non-active seat's return-on-discard answer. None draws, so none needs the shuffle context.
  if (choice.kind === ESCAPE_HQ_KO_KIND) {
    applyEscapeHqKo(G, choice);
    return;
  }
  // why: WP-829 / D-24762 — Go Back in Time: the chosen HQ Hero is Purged from the Timestream.
  if (choice.kind === TIMESTREAM_PURGE_SEAT_CHOICE_KIND) {
    applyTimestreamPurgeResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-830 / D-24763 — The Unbreakable Enigma Code: pay 1 Recruit and look, or decline.
  if (choice.kind === ENIGMA_PEEK_SEAT_CHOICE_KIND) {
    applyEnigmaPeekResolvedSeatChoice(G, choice);
    return;
  }
  if (choice.kind === ESCAPE_BYSTANDER_DISCARD_KIND) {
    applyEscapeBystanderDiscard(G, choice);
    return;
  }
  // why: WP-817 / D-24750 — the owed Escape-effect discard (Primus), the cost-filtered
  // sibling of the Bystander discard; applied atomically through discardFromHand.
  if (choice.kind === ESCAPE_EFFECT_COST_DISCARD_KIND) {
    applyEscapeEffectCostDiscard(G, choice);
    return;
  }
  // why: WP-837 / D-24770 — the owed every-player Hero-trait discard (co2e Mystique / Frost
  // Giant Warrior); a card goes through discardFromHand, the Wound option through the Wound
  // chokepoint, and the current player's Wound moves woundsDrawn.
  if (choice.kind === VILLAIN_EFFECT_TRAIT_DISCARD_KIND) {
    applyVillainEffectTraitDiscard(G, choice, currentPlayer);
    return;
  }
  if (choice.kind === RETURN_ON_DISCARD_SEAT_CHOICE_KIND) {
    applyReturnOnDiscardSeatChoice(G, choice);
    return;
  }
  // why: WP-845 / D-24779 — reveal or gain a Wound (rules v23 L3196-3200). The applier reads the
  // front G.pendingRevealOrWoundChoices entry for its card, current player and threat kind (the
  // timeout path passes no current player), applies the seats in ascending order, and bumps
  // woundsDrawn only for the entry's current player. No draw, so no shuffle context.
  if (choice.kind === REVEAL_OR_WOUND_SEAT_CHOICE_KIND) {
    applyRevealOrWoundSeatChoice(G, choice);
    return;
  }
  // why: WP-862 / D-24804 — the chosen HQ Hero gains Size-Changing this turn; a Shrinking
  // Research Budget class pick records that Hero's lasting grant. No draw, no shuffle context.
  if (choice.kind === SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND) {
    applySizeChangingGrantResolvedSeatChoice(G, choice);
    return;
  }
  if (choice.kind === SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND) {
    applySizeChangingClassPickResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-876 / D-24823 — Revolutionary Anthem's optional Villain Deck shuffle: Shuffle through
  // the shuffle context (ctx.random), or Leave (the default). Placed before the generic
  // fall-through so the "Seat N resolved <kind> choice" line does not also print.
  if (choice.kind === HEIST_SHUFFLE_SEAT_CHOICE_KIND) {
    applyHeistShuffleResolvedSeatChoice(G, choice, shuffleContext);
    return;
  }
  // why: WP-883 / D-24834 — "You may gain a Wound. If you do, you get +N Attack": gain through the
  // Wound chokepoint (Diving Block / Flying Shield Block then hold the reward) or decline (the
  // default, so the timeout path declines with no Wound). Placed before the generic fall-through.
  if (choice.kind === GAIN_WOUND_REWARD_SEAT_CHOICE_KIND) {
    applyGainWoundRewardSeatChoice(G, choice);
    return;
  }
  // why: WP-884 / D-24835 — Hunt for Victims: KO / rescue / capture a Bystander or decline, then the
  // optional KO-a-Hero pick. Neither draws, so neither needs the shuffle context; placed before the
  // generic fall-through so the "Seat N resolved <kind> choice" line does not also print.
  if (choice.kind === HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND) {
    applyHuntForVictimsResolvedSeatChoice(G, choice);
    return;
  }
  if (choice.kind === HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND) {
    applyHuntForVictimsKoHeroResolvedSeatChoice(G, choice);
    return;
  }
  // why: WP-889 / D-24841 — the Lilin villain hunt: KO the chosen holder's last Bystander (a stale
  // pick re-resolves at the default). No draw, so no shuffle context; placed before the generic
  // fall-through so the "Seat N resolved <kind> choice" line does not also print.
  if (choice.kind === VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND) {
    applyVillainHuntForVictimsResolvedSeatChoice(G, choice);
    return;
  }
  // why: D-24678 — the shuffle context reaches Random Acts' Diving Block draw.
  if (applySeatChoiceCard(G, choice, shuffleContext)) {
    return;
  }
  applyResolvedSeatChoice(G, choice);
}

/**
 * The subset of the boardgame.io ctx the pass-left chain reads for seat adjacency.
 */
interface SeatChoiceChainCtx {
  playOrder?: readonly string[];
}

/**
 * Chains Random Acts' simultaneous multi-seat pass-left after the active-scoped wound
 * choice resolved: builds the pass-left choice from `ctx.playOrder` and parks it
 * (admitting the addressed seats via the framework stage ride).
 *
 * // why: WP-683 / D-24500 — a solo game (or a board where no seat holds a card) has no
 * cross-seat pass, so buildPassLeftChoice returns undefined and the chain logs a no-op —
 * the optional Wound gain already captured the only observable solo effect.
 *
 * @param G - Game state (mutated: may set G.pendingSeatChoice for the pass).
 * @param ctx - The bare boardgame.io ctx (read for playOrder adjacency).
 * @param events - The move's boardgame.io events (for the stage-ride admission).
 */
function chainRandomActsPassLeft(
  G: LegendaryGameState,
  ctx: SeatChoiceChainCtx | undefined,
  events: SeatChoiceEvents | undefined,
): void {
  const playOrder = ctx?.playOrder ?? Object.keys(G.playerZones).sort();
  const passChoice = buildPassLeftChoice(G, playOrder);
  if (passChoice === undefined) {
    // why: solo (playOrder < 2) or no seat holds a card — nothing to pass.
    pushLog(G, `No card was passed for Random Acts of Unkindness — there is no other player to pass to.`, 'neutral');
    return;
  }
  parkSeatChoice(G, events, passChoice);
  pushLog(G, `Each player must choose a card to pass to the player on their left (Random Acts of Unkindness).`, 'neutral');
}

/**
 * Chains Monarch's Decree's simultaneous multi-seat discard after the active seat chose
 * the "discard" mode: builds the discard choice for every OTHER seat holding ≥1 hand card
 * and parks it (admitting the addressed seats via the framework stage ride).
 *
 * // why: WP-694 / D-24511 — parked from the live move context (not the ctx-free apply)
 * because admitting the NON-ACTIVE seats needs the move's events.setActivePlayers, mirroring
 * chainRandomActsPassLeft. "Each other player" = every seat except the active seat that chose
 * the mode. When no other seat holds a card, buildMonarchsDiscardChoice returns undefined and
 * the chain logs a no-op.
 *
 * @param G - Game state (mutated: may set G.pendingSeatChoice for the discard).
 * @param activeSeat - The seat that chose the Monarch's Decree mode (skipped — "each other").
 * @param events - The move's boardgame.io events (for the stage-ride admission).
 */
function chainMonarchsDiscard(
  G: LegendaryGameState,
  activeSeat: string,
  events: SeatChoiceEvents | undefined,
): void {
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== activeSeat)
    .sort();
  const discardChoice = buildMonarchsDiscardChoice(G, otherSeats);
  if (discardChoice === undefined) {
    // why: no other seat holds a card to discard — a clean no-op (moves never throw).
    pushLog(G, `No other player had a card to discard (Monarch's Decree).`, 'neutral');
    return;
  }
  parkSeatChoice(G, events, discardChoice);
  pushLog(G, `Each other player must choose a card to discard (Monarch's Decree).`, 'neutral');
}

/**
 * Chains Crush Pacifist Resistance's second KO pick after the first pick KO'd a Hero:
 * builds the last-ko choice from the active seat's remaining eligible Heroes and parks
 * it for that seat alone.
 *
 * // why: WP-821 / D-24754 — parked from the live move context, like chainMonarchsDiscard
 * (D-24511). The timeout path never reaches this (applySeatChoiceTimeoutDefault does not
 * chain, D-24501), and a defaulted first pick is "KO nothing" anyway.
 *
 * @param G - Game state (mutated: may set G.pendingSeatChoice for the second pick).
 * @param activeSeat - The defeating player who made the first pick.
 * @param events - The move's boardgame.io events (unused for an active-seat-only park).
 */
function chainCrushPacifistResistanceLastKo(
  G: LegendaryGameState,
  activeSeat: string,
  events: SeatChoiceEvents | undefined,
): void {
  const lastChoice = buildCrushPacifistResistanceChoice(
    G,
    activeSeat,
    CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND,
  );
  if (lastChoice === undefined) {
    pushLog(G,
      `Fight effect: Player ${activeSeat} has no other Hero with less than 2 printed Attack to KO (Crush Pacifist Resistance).`,
      'neutral',
    );
    return;
  }
  parkSeatChoice(G, events, lastChoice, activeSeat);
  pushLog(G,
    `Fight effect: Player ${activeSeat} may KO one more Hero with less than 2 printed Attack (Crush Pacifist Resistance).`,
    'neutral',
  );
}

/**
 * Chains Demonic Essence of Ghost Rider's second owed KO after the first pick resolved:
 * builds the last pick from the seat's current hand and played cards and parks it for
 * that seat alone.
 *
 * // why: WP-758 / D-24588 — parked from the live move context, like
 * chainCrushPacifistResistanceLastKo (D-24754). A seat with no Hero left logs the no-op.
 *
 * @param G - Game state (mutated: may set G.pendingSeatChoice for the second pick).
 * @param activeSeat - The defeating player who made the first pick.
 * @param events - The move's boardgame.io events (unused for an active-seat-only park).
 */
function chainZarathosDemonicEssenceLast(
  G: LegendaryGameState,
  activeSeat: string,
  events: SeatChoiceEvents | undefined,
): void {
  // why: D-24588 — "If you have a [strength] Hero" is read now, when the sentence resolves
  // (rules v23 L3443-3447): KOing the only Strength Hero with the first pick ends it here.
  if (!playerHasHeroOfClasses(G, activeSeat, [ZARATHOS_DEMONIC_ESSENCE_LAST_CLASS])) {
    pushLog(G,
      `Fight effect: Player ${activeSeat} no longer has a Strength Hero, so there is no second KO (Demonic Essence of Ghost Rider).`,
      'neutral',
    );
    return;
  }
  const lastChoice = buildZarathosDemonicEssenceChoice(
    G,
    activeSeat,
    ZARATHOS_DEMONIC_ESSENCE_LAST_KIND,
  );
  if (lastChoice === undefined) {
    pushLog(G,
      `Fight effect: Player ${activeSeat} has no other Hero to KO (Demonic Essence of Ghost Rider).`,
      'neutral',
    );
    return;
  }
  parkSeatChoice(G, events, lastChoice, activeSeat);
  pushLog(G,
    `Fight effect: Player ${activeSeat} may KO one more of their Heroes (Demonic Essence of Ghost Rider).`,
    'neutral',
  );
}

/**
 * Chains Corrupted Spirit of Vengeance's next discard-down round: builds it from the
 * owing seats' CURRENT hands and parks it for the seats still above 3 cards.
 *
 * // why: WP-882 / D-24833 — parked from the live move context, exactly where Crush chains
 * its second KO (D-24754), so parkSeatChoice stage-rides the owing NON-ACTIVE seats. No
 * active-seat skip: the defeating player is never addressed. No log line on a re-chain;
 * when every seat holds 3 the builder returns undefined and the chain ends.
 *
 * @param G - Game state (mutated: may set G.pendingSeatChoice for the next round).
 * @param seats - The seats that owe the discard-down (any order).
 * @param events - The move's boardgame.io events (for the stage ride).
 */
function chainZarathosDiscardDown(
  G: LegendaryGameState,
  seats: readonly string[],
  events: SeatChoiceEvents | undefined,
): void {
  const nextRound = buildZarathosDiscardDownChoice(G, seats);
  if (nextRound === undefined) {
    return;
  }
  parkSeatChoice(G, events, nextRound);
}

/**
 * Applies the deterministic disconnect/timeout default for the named addressed
 * seats that have not (or cannot) submit.
 *
 * // why: WP-684 / D-24501 — consistent with ARCHITECTURE.md §Disconnect & Reconnect. The
 * engine does NOT call this as a side effect of a disconnect: a play-phase disconnect PAUSES
 * the match (D-11602 = B) and the choice is PRESERVED for the seat across the pause, resolved
 * on reconnect; the hard-timeout abandonment path (D-11604 = A) forcibly ends the match. This
 * is the deterministic, replay-faithful default a governing policy caller (the future WP-116
 * reconnect/abandonment path, or an explicit forfeit) applies so an absent seat resolves to
 * choice.defaultOptionIndex — no Math.random, no wall-clock, no RNG draw. If it completes every
 * addressed seat, the choice applies atomically and clears, exactly like the last live resolve.
 * The default is clamped into the seat's option range so it always names a real option.
 *
 * @param G - The game state to mutate.
 * @param seats - The addressed seats to resolve with their default.
 */
export function applySeatChoiceTimeoutDefault(
  G: LegendaryGameState,
  seats: string[],
): void {
  const choice = G.pendingSeatChoice;
  if (choice === undefined) {
    return;
  }
  for (const seat of seats) {
    if (!isSeatAddressed(choice, seat) || hasSeatSubmitted(choice, seat)) {
      continue;
    }
    const prompt = choice.seatPrompts[seat];
    if (prompt === undefined || prompt.options.length === 0) {
      continue;
    }
    // why: clamp the declared default into this seat's real option range so the
    // default resolution always names a selectable option (deterministic).
    const clampedIndex = Math.max(
      0,
      Math.min(choice.defaultOptionIndex, prompt.options.length - 1),
    );
    choice.submissions[seat] = { optionIndex: clampedIndex };
  }
  if (allSeatsSubmitted(choice)) {
    // why: WP-682 / D-24499 — the timeout default resolves a Diving-Block choice too
    // (default = decline → keep the Wound, no draw), so it must dispatch by kind to drain
    // the diving-block FIFO; a generic log-only apply would leave the FIFO non-empty and
    // onMove would re-open the wave forever. No shuffle source on the timeout path (decline
    // never draws).
    // why: WP-683 / D-24500 — the same dispatcher resolves a DEFAULTED here-hold-this /
    // random-acts-pass-left (its real effect, not only a log). This path does NOT chain the
    // Random Acts pass after a defaulted wound choice — it has no events to admit the seats;
    // per D-24501 a play-phase disconnect PAUSES the match (this default is the not-yet-wired
    // WP-116 governing-policy path), so the live pass-left is never reached via a timeout here.
    // why: WP-883 / D-24834 — a defaulted 'gain-wound-reward' declines (no Wound, L3); a defaulted
    // Diving Block / Flying Shield Block decline on a Wound holding a gain-wound reward keeps the
    // Wound, so the reward is granted (L7) by the same dispatch.
    applySeatChoiceByKind(G, choice, undefined);
    delete G.pendingSeatChoice;
  }
}
