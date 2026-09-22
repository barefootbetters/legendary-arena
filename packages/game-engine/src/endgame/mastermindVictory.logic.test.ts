/**
 * Tests for the deferred Mastermind-victory promotion (WP-732 / D-24553).
 *
 * Covers promoteMastermindVictoryIfPending (pending → terminal at turn end,
 * idempotent, no-op when unset, drops still-parked choices) and the relocated
 * D-24518 complete-`pending*`-field drift guard (moved here from
 * fightMastermind.test.ts with the dropAllPendingPlayerChoices helper).
 *
 * Pure helper — no boardgame.io imports. Casts a minimal LegendaryGameState the
 * same way endgame.evaluate.test.ts does (the helper reads only G.counters,
 * G.messages, and the pending* fields).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { LegendaryGameState } from '../types.js';
import { ENDGAME_CONDITIONS } from './endgame.types.js';
import {
  promoteMastermindVictoryIfPending,
  dropAllPendingPlayerChoices,
} from './mastermindVictory.logic.js';

/**
 * Builds a minimal LegendaryGameState carrying only the fields the promotion
 * helper touches: counters, a messages array (so the win log line is exercised),
 * and whatever pending* fields a test seeds.
 */
function makeMinimalState(counters: Record<string, number>): LegendaryGameState {
  return { counters, messages: [] } as unknown as LegendaryGameState;
}

describe('promoteMastermindVictoryIfPending (WP-732 / D-24553)', () => {
  it('promotes the pending latch to the terminal win', () => {
    const gameState = makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING]: 1,
    });

    promoteMastermindVictoryIfPending(gameState);

    assert.equal(
      gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      1,
      'the terminal MASTERMIND_DEFEATED counter must be set at turn end',
    );
    assert.equal(
      gameState.messages.length,
      1,
      'the turn-end promotion pushes exactly one heroes-win log line',
    );
  });

  it('is a no-op when the pending latch is not set', () => {
    const gameState = makeMinimalState({});

    promoteMastermindVictoryIfPending(gameState);

    assert.equal(
      gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      undefined,
      'no pending latch means no terminal win is set',
    );
    assert.equal(gameState.messages.length, 0, 'no log line is pushed on a no-op');
  });

  it('is idempotent — a second call sets nothing and logs nothing more', () => {
    const gameState = makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING]: 1,
    });

    promoteMastermindVictoryIfPending(gameState);
    promoteMastermindVictoryIfPending(gameState);

    assert.equal(
      gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      1,
      'the terminal counter stays at 1',
    );
    assert.equal(
      gameState.messages.length,
      1,
      'the promotion logs exactly once even across repeated calls',
    );
  });

  it('drops a choice still parked at the true end of game (relocated D-24518)', () => {
    const gameState = makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING]: 1,
    });
    gameState.pendingElectromagneticBubbleChoices = [
      { sentinel: true },
    ] as unknown as LegendaryGameState['pendingElectromagneticBubbleChoices'];

    promoteMastermindVictoryIfPending(gameState);

    assert.equal(
      gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED],
      1,
      'the win resolves at turn end',
    );
    assert.equal(
      gameState.pendingElectromagneticBubbleChoices,
      undefined,
      'a choice still parked when the winning turn ends must not dangle on the victory screen',
    );
  });
});

// ---------------------------------------------------------------------------
// D-24518 (relocated by WP-732) — the complete pending*-field drift guard
// ---------------------------------------------------------------------------

// why: the audit hardening — the end-of-game drop clears EVERY pending choice,
// not just the ones a tactic parks directly, because a reactive keyword the
// winning fight triggered can park one too. This drift guard seeds a sentinel
// into every pending* field and asserts the turn-end promotion clears them all.
// ALL_PENDING_FIELDS is the complete pending* set on LegendaryGameState; if a
// field is added there, add it here and to dropAllPendingPlayerChoices, or a
// choice parked in it at the winning turn's end will dangle.
const ALL_PENDING_FIELDS = [
  'pendingCopyPowersChoices', 'pendingCountScaledChoice', 'pendingDefeatChoices',
  'pendingDiscardChoices', 'pendingDiscardToPlay', 'pendingDivingBlockWounds',
  'pendingDoOverChoices', 'pendingDrawOrEmpowered', 'pendingElectromagneticBubbleChoices',
  'pendingGiveHqHeroChoices', 'pendingHeroChoice', 'pendingKoDiscardChoices',
  'pendingKoHeroChoices', 'pendingMelterKoChoices', 'pendingOptionalKoRewards',
  'pendingOptionalPutBottomHQ', 'pendingPlayVillainTopChoices', 'pendingPutAnyNumberBottomHQ',
  'pendingPutCardsOnDeckChoices', 'pendingPutHandOnDeckTop', 'pendingReorderChoices', 'pendingReturnOnDiscard',
  'pendingReturnZeroCostDiscard', 'pendingRevealTopDispose', 'pendingRuthlessDictatorChoices', 'pendingScryKoChoices',
  'pendingSeatChoice', 'pendingSmashDiscards', 'pendingUndercoverChoice',
  'pendingVictoryPileCardPick',
] as const;
const SINGLE_VALUE_PENDING_FIELDS = new Set(['pendingHeroChoice', 'pendingSeatChoice']);

describe('dropAllPendingPlayerChoices — complete pending*-field drift guard (relocated D-24518)', () => {
  it('clears EVERY pending-choice field at the turn-end promotion', () => {
    const gameState = makeMinimalState({
      [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING]: 1,
    });

    // why: seed a non-empty sentinel into every pending field. Dynamic access is a
    // drift-test convenience only; the production helper clears each field explicitly
    // (00.6 §16.2).
    const pendingBag = gameState as unknown as Record<string, unknown>;
    for (const field of ALL_PENDING_FIELDS) {
      pendingBag[field] = SINGLE_VALUE_PENDING_FIELDS.has(field)
        ? { sentinel: true }
        : [{ sentinel: true }];
    }

    promoteMastermindVictoryIfPending(gameState);

    assert.equal(gameState.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED], 1,
      'the pending latch is promoted to the terminal win');
    for (const field of ALL_PENDING_FIELDS) {
      assert.equal(pendingBag[field], undefined,
        `${field} must be cleared at the turn-end promotion (D-24518 audit-hardened, relocated by WP-732)`);
    }
  });

  it('dropAllPendingPlayerChoices clears every seeded field directly (helper unit)', () => {
    const gameState = makeMinimalState({});
    const pendingBag = gameState as unknown as Record<string, unknown>;
    for (const field of ALL_PENDING_FIELDS) {
      pendingBag[field] = SINGLE_VALUE_PENDING_FIELDS.has(field)
        ? { sentinel: true }
        : [{ sentinel: true }];
    }

    dropAllPendingPlayerChoices(gameState);

    for (const field of ALL_PENDING_FIELDS) {
      assert.equal(pendingBag[field], undefined,
        `${field} must be cleared by dropAllPendingPlayerChoices`);
    }
  });
});
