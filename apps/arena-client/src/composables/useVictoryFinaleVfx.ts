/**
 * useVictoryFinaleVfx.ts
 *
 * The heroes-win victory finale's producer — the biggest positive payoff in the
 * game (the wiki's Surface 4 endgame bloom). It watches `UIState.gameOver` and
 * fires EXACTLY ONCE, on the live transition into a `heroes-win` outcome, so the
 * `VfxOverlay` can throw a gold confetti storm + bloom + the "VICTORY!" banner.
 *
 * Forward-compatible with the Final Blow rule (WP-687): the finale keys off the
 * projected win, not any particular fight. Under normal rules the win fires on the
 * fourth-Tactic defeat; once Final Blow ships, it fires on the fifth (final) blow
 * instead — this celebration lands on it automatically, no change here.
 *
 * Fire-once discipline (mirroring the `useStrikeBlockedVfx` catch-up gate, adapted
 * to a single latched outcome rather than an append-only stream):
 *
 *   - It seeds on the first valid frame: a mount / reconnect INTO an already-won
 *     match must NOT replay the finale, so if the first frame is already a win the
 *     latch is set without firing.
 *   - It fires only on the transition false → true during live play, then latches.
 *   - It ignores a `scheme-wins` loss and a `tie` (including an early-end tie,
 *     `gameOver.endedEarly === true`) — the win finale is a heroes-win-only reward.
 *
 * It emits through an injectable renderer seam (default: a module-level reactive
 * signal `VfxOverlay` consumes) — mirroring `useComboVfx` / `useWoundVfx`. Pure
 * presentation: it reads `UIState` only, never writes `G`/`ctx`, and adds zero
 * engine / determinism / replay footprint (per ARCHITECTURE.md).
 *
 * @see apps/arena-client/src/composables/useStrikeBlockedVfx.ts (the catch-up-gate sibling)
 * @see apps/arena-client/src/vfx/victoryFinaleVfxManifest.ts (the finale spec)
 * @see wiki/visual-effects.md §Surface 4 — Outcome / endgame (heroes-win)
 * @see DECISIONS.md D-24365 (the WP-556 VFX foundation + the VFX determinism exemption)
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';

/** One victory-finale event: a monotonic id (the finale carries no payload). */
export interface VictoryFinaleVfxEvent {
  /** Monotonic sequence id — 1 for the single fire; present for renderer parity. */
  readonly seq: number;
}

/** Renders a victory-finale event (the injectable seam). */
export type VictoryFinaleVfxRenderer = (event: VictoryFinaleVfxEvent) => void;

// why: module-level reactive signal — the default render target. `VfxOverlay`
// imports `useVictoryFinaleVfxSignal()` and watches it; a change fires the
// finale. One signal decouples the producer (this consumer, mounted at the
// PlayViewport root) from the renderer (the overlay), exactly as `useWoundVfx` /
// `useComboVfx` do.
const victoryFinaleVfxSignal = ref<VictoryFinaleVfxEvent | null>(null);
let sequence = 0;

/** The shared victory-finale signal `VfxOverlay` consumes. */
export function useVictoryFinaleVfxSignal(): Ref<VictoryFinaleVfxEvent | null> {
  return victoryFinaleVfxSignal;
}

/** The default renderer: publishes the event to the shared module signal. */
function publishToSignal(event: VictoryFinaleVfxEvent): void {
  victoryFinaleVfxSignal.value = event;
}

/**
 * Reads whether a UIState snapshot represents a genuine heroes-win — the outcome
 * is `heroes-win` and the match was not ended early. A null snapshot, an
 * in-progress match (no `gameOver`), a loss, or a tie all read `false`.
 *
 * @param next - the UIState snapshot (may be null before a match loads).
 * @returns true only for a settled heroes-win outcome.
 */
function isHeroesWin(next: UIState | null): boolean {
  if (next === null) return false;
  const gameOver = next.gameOver;
  if (gameOver === undefined) return false;
  // why: a genuine heroes-win only. `endedEarly` marks an abandoned match that
  // reuses the tie outcome bucket; it is never a heroes-win, but the guard keeps
  // the finale honest if the outcome string ever widens.
  return gameOver.outcome === 'heroes-win' && gameOver.endedEarly !== true;
}

/**
 * Watches a UIState snapshot ref and emits the victory finale exactly once, on the
 * live transition into a heroes-win outcome.
 *
 * @param snapshot - the arena-client UIState snapshot ref.
 * @param render - the renderer to emit through; defaults to the module signal.
 *   The parameter is an injectable seam for unit tests (a recording renderer).
 */
export function useVictoryFinaleVfx(
  snapshot: Ref<UIState | null>,
  render: VictoryFinaleVfxRenderer = publishToSignal,
): void {
  // why: catch-up latch. On the first valid frame we only SEED — a mount /
  // reconnect INTO an already-won match must replay nothing (the seed-on-first-
  // frame discipline the wound / combo consumers share). Thereafter the finale
  // fires once, on the false → true transition, then stays latched for the match.
  let caughtUp = false;
  let hasFired = false;

  watch(
    snapshot,
    (next) => {
      // why: safe-skip a null snapshot (first tick before a match loads) — no
      // throw, and the latch stays un-caught-up so a later valid frame seeds.
      if (next === null) return;
      const victory = isHeroesWin(next);

      // why: seed on the first valid frame. If the match is ALREADY won when this
      // consumer mounts (a reconnect into a finished match), latch as already-
      // fired so the finale never replays; otherwise arm for the live transition.
      if (!caughtUp) {
        caughtUp = true;
        hasFired = victory;
        return;
      }

      // why: fire once, on the transition into a heroes-win, then latch.
      if (victory && !hasFired) {
        hasFired = true;
        sequence += 1;
        render({ seq: sequence });
      }
    },
    { immediate: true, deep: false },
  );
}
