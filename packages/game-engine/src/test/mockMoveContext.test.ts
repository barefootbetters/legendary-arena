/**
 * Contract tests for the shared mock move context (WP-569 / EC-604 / D-24378).
 *
 * These exist because AC-2 requires the forbidden-call stubs be PROVEN, not
 * asserted. A stub nobody executes is exactly the undemonstrated gate WP-563
 * was written to end: the engine's `satisfies` drift pins sat uncompiled for
 * months while their comments promised compile-time enforcement.
 *
 * Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeMockMoveContext } from './mockMoveContext.js';
import { makeMockCtx } from './mockCtx.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { LegendaryGameState } from '../types.js';

/** Minimal but COMPLETE registry reader — a partial one silently skips builders. */
function createMockRegistry(): CardRegistryReader {
  return { listCards: () => [], listSets: () => [], getSet: () => undefined };
}

/** Minimal valid match configuration for a built state. */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
}

/** Builds a real game state for the context under test. */
function createGameState(): LegendaryGameState {
  return buildInitialGameState(createTestConfig(), createMockRegistry(), makeMockCtx({ numPlayers: 1 }));
}

describe('makeMockMoveContext — the permitted plugin-API surface', () => {
  it('exposes the three events the engine is allowed to fire, as no-ops', () => {
    const context = makeMockMoveContext(createGameState());

    assert.doesNotThrow(() => context.events.endTurn());
    assert.doesNotThrow(() => context.events.setPhase('play'));
    assert.doesNotThrow(() => context.events.endGame());
  });

  it('inherits the reverse-shuffle from makeMockCtx so the shuffle path stays provable', () => {
    // why: an identity shuffle would let a test pass even if the shuffle step
    // were skipped entirely. The reversal is the proof that it ran.
    const context = makeMockMoveContext(createGameState());

    assert.deepStrictEqual(context.random.Shuffle(['a', 'b', 'c']), ['c', 'b', 'a']);
  });

  it('honours the seat and player-count overrides', () => {
    const context = makeMockMoveContext(createGameState(), { numPlayers: 2, playerID: '1' });

    assert.equal(context.playerID, '1');
    assert.equal(context.ctx.numPlayers, 2);
    assert.deepStrictEqual(context.ctx.playOrder, ['0', '1']);
    assert.equal(context.ctx.currentPlayer, '1');
  });
});

describe('makeMockMoveContext — the forbidden calls THROW (AC-2)', () => {
  // why: these five EventsAPI members are exactly the ones
  // `.claude/rules/architecture.md` §Phase & Turn Transitions forbids — phase
  // changes go through setPhase, turn changes through endTurn, and the turn
  // stage lives in G.currentStage rather than boardgame.io stages. A no-op stub
  // would complete the type surface while letting a real violation pass
  // silently; throwing turns the mock into a live assertion of the rule.
  it('throws for every EventsAPI member the engine must never call', () => {
    const context = makeMockMoveContext(createGameState());

    assert.throws(() => context.events.endPhase(), /events\.endPhase/);
    assert.throws(() => context.events.endStage(), /events\.endStage/);
    assert.throws(() => context.events.pass(), /events\.pass/);
    assert.throws(() => context.events.setActivePlayers({}), /events\.setActivePlayers/);
    assert.throws(() => context.events.setStage('any'), /events\.setStage/);
  });

  // why: §Determinism routes all randomness through ctx.random.*, and the
  // engine's only use is Shuffle (65 call sites at WP-569 drafting; zero dice).
  it('throws for every RandomAPI member the engine must never call', () => {
    const context = makeMockMoveContext(createGameState());

    assert.throws(() => context.random.D4(), /random\.D4/);
    assert.throws(() => context.random.D6(), /random\.D6/);
    assert.throws(() => context.random.D10(), /random\.D10/);
    assert.throws(() => context.random.D12(), /random\.D12/);
    assert.throws(() => context.random.D20(), /random\.D20/);
    assert.throws(() => context.random.Die(), /random\.Die/);
    assert.throws(() => context.random.Number(), /random\.Number/);
  });

  it('names the member and the reason, so a failure is actionable', () => {
    // why: a bare "not implemented" would tell a future contributor nothing
    // about WHY the call is forbidden or what to do instead.
    const context = makeMockMoveContext(createGameState());

    assert.throws(
      () => context.events.setStage('main'),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /must never call it/);
        assert.match(error.message, /G\.currentStage/);
        assert.match(error.message, /ARCHITECTURE\.md/);
        return true;
      },
    );
  });
});
