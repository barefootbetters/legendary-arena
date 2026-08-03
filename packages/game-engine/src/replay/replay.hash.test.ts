/**
 * Tests for `computeStateHash` — the djb2 replay/determinism oracle
 * (`PRE_WP080_HASH` layer), WP-488 / D-24294.
 *
 * The load-bearing contract proven here: the runtime-only `G.diagnostics` channel is
 * EXCLUDED from `computeStateHash`, completing the D-24271-deferred second oracle so a
 * per-dispatch effect trace (which materializes on EVERY dispatch) never shifts the
 * replay hash. The exclusion is `diagnostics`-ONLY — `messages` STAYS hashed by
 * `computeStateHash` (unlike `hashGameState`), so this file also asserts that a
 * non-diagnostics change DOES move the hash (the exclusion did not over-strip and did
 * not flatten the oracle).
 *
 * Test states are minimal plain objects cast to `LegendaryGameState` (the hash only
 * reads them via `JSON.stringify` + a top-level `diagnostics` destructure). No
 * boardgame.io import.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeStateHash } from './replay.hash.js';
import type { LegendaryGameState } from '../types.js';
import type { EffectTrace } from '../diagnostics/hollowEffect.types.js';

/**
 * Builds a fresh minimal game-state-shaped object for hashing. Only the fields these
 * tests vary need to be present; the cast is sound because `computeStateHash` reads its
 * argument via `JSON.stringify` and a top-level `diagnostics` destructure.
 */
function makeState(overrides: Record<string, unknown> = {}): LegendaryGameState {
  const base: Record<string, unknown> = {
    messages: [],
    notableEvents: [],
    counters: { escapedVillains: 0, schemeLoss: 0, mastermindDefeated: 0 },
    playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] } },
    currentStage: 'main',
  };
  return { ...base, ...overrides } as unknown as LegendaryGameState;
}

/** Two genuinely-populated effect traces to prove non-vacuous invariance. */
const POPULATED_TRACES: EffectTrace[] = [
  { cardId: 'core/villain/mystique#0', scope: 'villain', timing: 'onEscape', effect: 'become-scheme-twist', handler: 'onSchemeTwistRevealed', status: 'secondary-site', fireSite: 'escape-scheme-twist', params: {}, turn: 5 },
  { cardId: 'core/hero/spider-man#1', scope: 'hero', timing: 'onPlay', effect: 'draw', handler: 'draw', status: 'fired', fireSite: 'hero-executor', params: { magnitude: 2 }, turn: 5 },
];

test('computeStateHash excludes G.diagnostics — populated traces do not shift the hash (WP-488 / D-24294)', () => {
  // why: AC-7 — this is the ONLY test that catches a forgotten exclusion. It appends REAL
  // EffectTraces before the second hash: an empty-vs-empty compare would prove nothing (and
  // PRE_WP080 is an empty replay that passes regardless). If the diagnostics exclusion is
  // dropped from computeStateHash, these two hashes diverge and this test fails.
  const absent = computeStateHash(makeState());
  const emptyChannel = computeStateHash(
    makeState({ diagnostics: { hollowEffects: [], hollowEffectsDropped: 0, traces: [], tracesDropped: 0 } }),
  );
  const withTraces = computeStateHash(
    makeState({
      diagnostics: {
        hollowEffects: [{ cardId: 'v#0', cardType: 'villain', timing: 'onFight', mechanic: 'made-up', reason: 'no-handler', turn: 5 }],
        hollowEffectsDropped: 1,
        traces: POPULATED_TRACES,
        tracesDropped: 7,
      },
    }),
  );

  assert.equal(emptyChannel, absent, 'an empty diagnostics channel must not change the replay hash');
  assert.equal(withTraces, absent, 'a genuinely populated diagnostics.traces list must not change the replay hash');
});

test('computeStateHash still hashes messages — the exclusion is diagnostics-only (WP-488)', () => {
  // why: unlike hashGameState, computeStateHash KEEPS messages/logMeta/lastPlayEffectsFired
  // hashed (removing them would shift PRE_WP080_HASH). Assert a messages change still moves
  // the hash, proving the WP excluded ONLY diagnostics and did not over-strip.
  const baseline = computeStateHash(makeState({ messages: [] }));
  const withMessage = computeStateHash(makeState({ messages: ['Player 0 played core/x#1.'] }));
  assert.notEqual(withMessage, baseline, 'a messages change must still move the replay hash (messages stays hashed)');
});

test('computeStateHash still changes when a non-diagnostics field changes (non-vacuous guard)', () => {
  // why: proves the exclusion did not flatten the oracle — a real state-placement
  // difference (a played card) MUST still move the hash.
  const baseline = computeStateHash(makeState());
  const withInPlayCard = computeStateHash(
    makeState({ playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: ['core/x#1'], victory: [] } } }),
  );
  assert.notEqual(withInPlayCard, baseline, 'a played card must change the replay hash');
});
