/**
 * Tests for `hashGameState` — the WP-158 `finalStateHash` oracle.
 *
 * The load-bearing contract proven here (D-24081): the top-level `messages`
 * log is EXCLUDED from the hash, while every other field — crucially
 * `notableEvents` — still participates. These tests are deliberately
 * non-vacuous and cheat-proof: alongside the message-invariance guarantee
 * they assert that a non-message change AND a `notableEvents` change DO move
 * the hash, so the exclusion cannot have silently flattened the oracle.
 *
 * No `boardgame.io` import. Test states are minimal plain objects cast to
 * `LegendaryGameState` (the hash only reads them via `JSON.stringify`); each
 * factory call returns a fresh object so no test mutates another's input.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hashGameState } from './hashGameState.js';
import type { LegendaryGameState } from '../../types.js';

/**
 * Builds a fresh minimal game-state-shaped object for hashing. Only the
 * fields these tests vary need to be present; the cast is sound because
 * `hashGameState` reads its argument solely through `JSON.stringify`.
 *
 * @param overrides - Fields to override on the base object.
 * @returns A fresh object cast to `LegendaryGameState`.
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

test('hashGameState is invariant to the messages log (D-24081)', () => {
  // why: the new contract — the human-readable log has its own dedicated
  // `messages` oracle layer in runFixture, so it must not also move the hash.
  const empty = hashGameState(makeState({ messages: [] }));
  const oneLine = hashGameState(makeState({ messages: ['Player 0 played core/x#1.'] }));
  const manyLines = hashGameState(
    makeState({ messages: ['Player 0 played core/x#1.', 'a', 'b', 'c'] }),
  );

  assert.equal(oneLine, empty, 'adding a message must not change the hash');
  assert.equal(manyLines, empty, 'adding several messages must not change the hash');
});

test('hashGameState still changes when a non-message field changes (non-vacuous guard)', () => {
  // why: proves the exclusion did not flatten the oracle — a real
  // state-placement difference (a played card, a counter) MUST move the hash.
  const baseline = hashGameState(makeState());
  const withInPlayCard = hashGameState(
    makeState({
      playerZones: { '0': { deck: [], hand: [], discard: [], inPlay: ['core/x#1'], victory: [] } },
    }),
  );
  const withCounter = hashGameState(
    makeState({ counters: { escapedVillains: 1, schemeLoss: 0, mastermindDefeated: 0 } }),
  );

  assert.notEqual(withInPlayCard, baseline, 'a played card must change the hash');
  assert.notEqual(withCounter, baseline, 'a counter change must change the hash');
});

test('hashGameState still changes when notableEvents changes (notableEvents stays hashed)', () => {
  // why: notableEvents has NO dedicated oracle layer, so the hash is its only
  // regression guard — it must remain inside the hashed serialization.
  const baseline = hashGameState(makeState({ notableEvents: [] }));
  const withEvent = hashGameState(
    makeState({ notableEvents: [{ type: 'fightResolved', playerId: '0', cardId: 'core/x#1' }] }),
  );

  assert.notEqual(withEvent, baseline, 'a notableEvents change must change the hash');
});

test('hashGameState is invariant to property insertion order (canonicality preserved)', () => {
  // why: the sort-keys replacer must still produce one canonical hash for the
  // same content regardless of how the object was assembled.
  const orderA = makeState({
    counters: { escapedVillains: 0, schemeLoss: 0, mastermindDefeated: 1 },
  });
  const orderB = makeState({
    counters: { mastermindDefeated: 1, escapedVillains: 0, schemeLoss: 0 },
  });

  assert.equal(hashGameState(orderB), hashGameState(orderA), 'key order must not change the hash');
});
