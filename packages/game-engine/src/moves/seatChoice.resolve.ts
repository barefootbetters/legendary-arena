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
} from './seatChoiceTactics.js';
// why: WP-793 / D-24656 — the rulebook escape procedure's two kind-specific applies (HQ KO,
// Bystander discard). villainEscapeProcedure imports parkSeatChoice from this module, so the
// two form a runtime-safe import cycle (each references the other ONLY inside function
// bodies, never at module top level), so ESM resolves both bindings by call time.
import {
  applyEscapeBystanderDiscard,
  applyEscapeEffectCostDiscard,
  applyEscapeHqKo,
  ESCAPE_BYSTANDER_DISCARD_KIND,
  ESCAPE_EFFECT_COST_DISCARD_KIND,
  ESCAPE_HQ_KO_KIND,
} from '../villainDeck/villainEscapeProcedure.js';
// why: WP-793 / D-24656 — a non-active seat's return-on-discard apply. resolveReturnOnDiscard
// imports parkSeatChoice from this module: the same runtime-safe cycle (function bodies only).
import {
  applyReturnOnDiscardSeatChoice,
  RETURN_ON_DISCARD_SEAT_CHOICE_KIND,
} from './resolveReturnOnDiscard.js';
import { pushLog } from '../log/logPush.js';

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
  // why: WP-793 / D-24656 — the escape procedure's HQ KO (the current player's pick) and
  // every-player Bystander discard (atomic, ascending seats, through discardFromHand), and a
  // non-active seat's return-on-discard answer. None draws, so none needs the shuffle context.
  if (choice.kind === ESCAPE_HQ_KO_KIND) {
    applyEscapeHqKo(G, choice);
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
  if (choice.kind === RETURN_ON_DISCARD_SEAT_CHOICE_KIND) {
    applyReturnOnDiscardSeatChoice(G, choice);
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
    applySeatChoiceByKind(G, choice, undefined);
    delete G.pendingSeatChoice;
  }
}
