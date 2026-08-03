/**
 * Effect-trace record writer for the Legendary Arena game engine
 * (WP-488 / D-24294).
 *
 * `recordEffectTrace` is the single seam the effect caller loops call to append one
 * per-dispatch `EffectTrace` to the runtime-only `G.diagnostics.traces` channel. It
 * mirrors `recordHollowEffect`'s DISCIPLINE — lazy-init `G.diagnostics` (never in
 * `Game.setup()`), append, bound by `EFFECT_TRACES_CAP` with a dropped-counter, never
 * throw, never read as gameplay input — with ONE deliberate divergence: it does NOT
 * `pushLog` a `G.messages` line. A trace fires on every dispatch (high volume), and
 * `G.messages` is a hashed field the `record-game-fixture` sentinels cover, so pushing
 * per-dispatch would both spam the log and churn those fixtures. This writer touches
 * ONLY `G.diagnostics`.
 *
 * No boardgame.io imports. No registry imports. No I/O. No randomness.
 */

import type { LegendaryGameState } from '../types.js';
import type { EffectTrace } from './hollowEffect.types.js';
import { EFFECT_TRACES_CAP } from './hollowEffect.types.js';

// ---------------------------------------------------------------------------
// recordEffectTrace — the single trace write seam (WP-488)
// ---------------------------------------------------------------------------

/**
 * Records one per-dispatch `EffectTrace` into the runtime-only `G.diagnostics.traces`
 * channel.
 *
 * Lazy-inits the channel and the trace list on first write, appends while under
 * `EFFECT_TRACES_CAP`, and past the cap drops the trace and increments `tracesDropped`.
 * Unlike `recordHollowEffect`, it writes NO `G.messages` line — the trace is a
 * machine-readable diagnostic only. Nothing here reads back gameplay state, and no
 * move / rule / `endIf` / bot / scoring path may ever consume `G.diagnostics.traces`
 * (never gameplay input — the load-bearing persistence/serialization boundary rule).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param trace - The effect trace to store.
 */
export function recordEffectTrace(G: LegendaryGameState, trace: EffectTrace): void {
  // why: lazy-init the runtime-only channel at the writer — NEVER in Game.setup
  // (mirrors recordHollowEffect / pendingOptionalKoRewards); a fresh match keeps
  // G.diagnostics absent so both hash oracles stay stable, and the channel
  // materializes only once an effect actually dispatches.
  if (!G.diagnostics) {
    G.diagnostics = {
      hollowEffects: [],
      hollowEffectsDropped: 0,
      traces: [],
      tracesDropped: 0,
    };
  }

  // why: recordHollowEffect predates this writer and inits G.diagnostics WITHOUT the
  // trace fields, so a hollow-first dispatch leaves `traces` absent. Seed it here on
  // the first trace write rather than editing the untouched hollow writer (the optional
  // GameDiagnostics.traces field exists precisely to keep that writer's behavior frozen).
  if (G.diagnostics.traces === undefined) {
    G.diagnostics.traces = [];
    G.diagnostics.tracesDropped = 0;
  }

  // why: bounded channel — a trace fires on EVERY dispatch (unlike the rare hollow), so
  // a long match is high-volume; once the cap is reached, drop the trace and count it
  // instead of pushing, so a pathological match cannot grow G without limit. The cap is
  // observation hygiene only; the channel is never gameplay input.
  if (G.diagnostics.traces.length >= EFFECT_TRACES_CAP) {
    G.diagnostics.tracesDropped = (G.diagnostics.tracesDropped ?? 0) + 1;
    return;
  }

  G.diagnostics.traces.push(trace);
}
