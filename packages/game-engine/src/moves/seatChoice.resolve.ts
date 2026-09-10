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
 * @returns A per-seat { stage, moveLimit } map.
 */
export function buildSeatChoiceActivePlayersValue(
  choice: PendingSeatChoice,
): Record<string, { stage: string; moveLimit: number }> {
  const value: Record<string, { stage: string; moveLimit: number }> = {};
  for (const seat of choice.addressedSeats) {
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
 */
export function admitSeatsForPendingSeatChoice(
  events: SeatChoiceEvents | undefined,
  choice: PendingSeatChoice,
): void {
  if (typeof events?.setActivePlayers === 'function') {
    events.setActivePlayers({
      value: buildSeatChoiceActivePlayersValue(choice),
      revert: true,
    });
  }
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
 */
export function parkSeatChoice(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  choice: PendingSeatChoice,
): void {
  G.pendingSeatChoice = choice;
  admitSeatsForPendingSeatChoice(events, choice);
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
  { G, playerID }: MoveContext,
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
    applyResolvedSeatChoice(G, choice);
    delete G.pendingSeatChoice;
  }
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
    applyResolvedSeatChoice(G, choice);
    delete G.pendingSeatChoice;
  }
}
