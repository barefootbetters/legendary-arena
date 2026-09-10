/**
 * Turn loop advancement helper for the play phase.
 *
 * Advances G.currentStage through the canonical turn stage cycle
 * (start -> main -> cleanup -> turn ends). All ordering derives from
 * getNextTurnStage in turnPhases.logic.ts — no hardcoded stage strings.
 *
 * No boardgame.io imports. No .reduce(). No side effects beyond G mutation
 * and ctx.events.endTurn().
 */

import type { TurnStage } from './turnPhases.types.js';
import { getNextTurnStage } from './turnPhases.logic.js';

/**
 * Minimal context interface for turn loop operations.
 *
 * Captures what advanceTurnStage needs from the boardgame.io move context.
 * Defined locally to avoid importing boardgame.io in this pure helper.
 */
export interface TurnLoopContext {
  // why: WP-696 / D-24513 — the extra-turn primitive needs the acting seat's id
  // to grant that SAME seat another turn (`events.endTurn({ next: currentPlayer })`).
  // Carried on the context so advanceTurnStage never rotates the player manually.
  currentPlayer: string;
  events: {
    // why: WP-696 / D-24513 — widened to accept boardgame.io 0.50.x's optional
    // `{ next }` argument (EventsAPI.endTurn). Passing `{ next: currentPlayer }`
    // ends the current turn and begins that same seat's next turn (fires
    // onEnd -> onBegin) instead of rotating to the default next seat.
    endTurn: (opts?: { next: string }) => void;
  };
}

/**
 * Minimal game state interface for turn loop operations.
 *
 * Captures the slice of LegendaryGameState that advanceTurnStage reads
 * and writes. Using a narrow interface keeps this file decoupled from
 * the full LegendaryGameState type.
 */
export interface TurnLoopState {
  currentStage: TurnStage;
  // why: WP-328 — advanceTurnStage resets the per-step action counter when the stage
  // advances. Optional + narrow (only the field this file writes) to stay decoupled from
  // the full LegendaryGameState / logMeta shape.
  logMeta?: { actionInStep: number };
  // why: WP-696 / D-24513 — the extra-turn counter (see LegendaryGameState.extraTurns).
  // Narrow + optional (absent by default) so this decoupled interface, and the
  // bgio-bypassing harnesses that reuse consumeExtraTurn, all read the same field.
  extraTurns?: Record<string, number>;
}

/**
 * Consumes one queued extra turn for a player, if any is owed.
 *
 * The extra-turn primitive (WP-696 / D-24513): `state.extraTurns` is a lazy,
 * per-player counter of additional full turns a player has earned (Dr. Doom's
 * "Secrets of Time Travel" tactic). When the player has one or more queued, this
 * decrements the counter and returns `true`, signalling the caller to grant the
 * SAME seat another turn — on the live boardgame.io path by calling
 * `events.endTurn({ next: currentPlayer })`, and on the framework-bypassing sim /
 * PAR / replay harnesses by NOT rotating away from that seat. When nothing is
 * owed it returns `false` and the caller ends the turn / rotates normally.
 *
 * // why: a SINGLE shared consumption keeps every production turn-rotation site
 * // (advanceTurnStage, the endTurn move, and the three bgio-bypassing harnesses
 * // that observe the forwarded `{ next }` signal) draining the counter IDENTICALLY
 * // — the arc's foundational lockstep. A divergent private copy would desync
 * // live-vs-harness turn counts (reference_simulation_harness_bypasses_bgio).
 * // why: decrement-to-delete — a spent counter leaves NO key, so a game that used
 * // up its extra turns serializes identically to one that never had any (the
 * // lazy-omit hash pattern that keeps PRE_WP080 + sentinel oracles byte-identical).
 *
 * @param state - Any state carrying the optional `extraTurns` counter map.
 * @param currentPlayer - The seat whose queued extra turn is being consumed.
 * @returns True if an extra turn was owed (and one was consumed); false otherwise.
 */
export function consumeExtraTurn(
  state: { extraTurns?: Record<string, number> },
  currentPlayer: string,
): boolean {
  const queued = state.extraTurns?.[currentPlayer] ?? 0;
  if (queued <= 0) {
    return false;
  }
  const remaining = queued - 1;
  if (remaining === 0) {
    // why: delete the key (not just zero it) so a fully-spent counter leaves the
    // map exactly as a never-triggered game would — no residual `{ "0": 0 }` that
    // would perturb the hashed G.
    delete state.extraTurns![currentPlayer];
  } else {
    state.extraTurns![currentPlayer] = remaining;
  }
  return true;
}

/**
 * Advances the turn stage to the next stage in the canonical sequence.
 *
 * If the current stage has a successor (start -> main, main -> cleanup),
 * sets G.currentStage to the next stage. If the current stage is the last
 * one (cleanup), calls ctx.events.endTurn() to end the turn and let
 * boardgame.io advance to the next player.
 *
 * // why: currentStage is stored in G (not ctx) because boardgame.io's ctx
 * // does not expose the inner turn stage in a form that move functions can
 * // read. Storing it in G makes it observable to moves (for stage gating)
 * // and JSON-serializable (for replay and snapshots).
 *
 * @param gameState - The current game state (must have currentStage).
 * @param context - The boardgame.io move context (must have events.endTurn).
 */
export function advanceTurnStage(gameState: TurnLoopState, context: TurnLoopContext): void {
  const nextStage = getNextTurnStage(gameState.currentStage);

  if (nextStage !== null) {
    gameState.currentStage = nextStage;
    // why: WP-328 — restart the per-step action counter when the stage advances so the
    // {turn}.{step}.{action} numbering resets per step.
    if (gameState.logMeta !== undefined) {
      gameState.logMeta.actionInStep = 0;
    }
    return;
  }

  // why: WP-696 / D-24513 — honor any queued extra turn for the acting seat. When
  // the player defeated Dr. Doom's "Secrets of Time Travel" tactic this turn, they
  // "take another turn after this one": end the current turn but begin the SAME
  // seat's next turn via boardgame.io's documented `events.endTurn({ next })`
  // primitive (fires onEnd -> onBegin — a full fresh turn), never a manual player
  // rotation (forbidden by the game-engine SKILL / .claude/rules/architecture.md).
  // consumeExtraTurn decrements-to-delete so normal turns stay byte-identical.
  if (consumeExtraTurn(gameState, context.currentPlayer)) {
    context.events.endTurn({ next: context.currentPlayer });
    return;
  }

  // why: boardgame.io manages player rotation internally. Calling
  // ctx.events.endTurn() is the correct pattern for stage-based turn flow.
  // Manual player index rotation is forbidden — boardgame.io advances to
  // the next player and fires onTurnEnd triggers automatically.
  context.events.endTurn();
}
