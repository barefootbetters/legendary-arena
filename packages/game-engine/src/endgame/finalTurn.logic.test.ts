import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { LegendaryGameState } from '../types.js';
import {
  latchFinalTurnIfDeckExhausted,
  resolveFinalTurnTieIfUnresolved,
} from './finalTurn.logic.js';
import { ENDGAME_CONDITIONS } from './endgame.types.js';
import { evaluateEndgame } from './endgame.evaluate.js';
import { applyPileDepletionResourceLoss } from '../rules/schemeResourceLoss.js';

/**
 * Builds a minimal LegendaryGameState carrying only the fields the final-turn
 * helpers read: counters, the two shared decks, and the messages log. The
 * helpers are pure over these fields, so a narrow cast avoids coupling to
 * buildInitialGameState (mirrors endgame.evaluate.test.ts).
 */
function makeState(options: {
  villainDeck?: string[];
  heroDeck?: string[];
  counters?: Record<string, number>;
}): LegendaryGameState {
  return {
    counters: options.counters ?? {},
    villainDeck: { deck: options.villainDeck ?? ['v-1'], discard: [] },
    heroDeck: options.heroDeck ?? ['h-1'],
    messages: [],
  } as unknown as LegendaryGameState;
}

describe('latchFinalTurnIfDeckExhausted (WP-367 / D-24159)', () => {
  it('does nothing while both decks still have cards', () => {
    const state = makeState({ villainDeck: ['v-1'], heroDeck: ['h-1'] });
    latchFinalTurnIfDeckExhausted(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED], undefined);
    assert.equal(state.messages.length, 0);
  });

  it('latches when the villain deck is empty', () => {
    const state = makeState({ villainDeck: [], heroDeck: ['h-1'] });
    latchFinalTurnIfDeckExhausted(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED], 1);
    assert.equal(state.messages.length, 1);
    assert.match(state.messages[0]!.text, /villain deck is empty/);
  });

  it('latches when the hero deck is empty', () => {
    const state = makeState({ villainDeck: ['v-1'], heroDeck: [] });
    latchFinalTurnIfDeckExhausted(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED], 1);
    assert.match(state.messages[0]!.text, /hero deck is empty/);
  });

  // why: the core of Jeff's bug report — once a deck reaches zero the final turn
  // is latched, and a later refill (deck non-empty again) must NOT un-latch it.
  it('is sticky: an already-latched game is not re-latched and does not re-log even if the deck refilled', () => {
    const state = makeState({
      villainDeck: ['refilled-1', 'refilled-2'],
      heroDeck: ['h-1'],
      counters: { [ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED]: 1 },
    });
    latchFinalTurnIfDeckExhausted(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED], 1);
    assert.equal(state.messages.length, 0, 'no duplicate latch log on an already-latched game');
  });

  it('is idempotent: two calls on a fresh exhaustion latch and log exactly once', () => {
    const state = makeState({ villainDeck: [], heroDeck: ['h-1'] });
    latchFinalTurnIfDeckExhausted(state);
    latchFinalTurnIfDeckExhausted(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED], 1);
    assert.equal(state.messages.length, 1);
  });
});

describe('resolveFinalTurnTieIfUnresolved (WP-367 / D-24159)', () => {
  it('does nothing when the final turn was never latched', () => {
    const state = makeState({});
    resolveFinalTurnTieIfUnresolved(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE], undefined);
    assert.equal(state.messages.length, 0);
  });

  it('resolves a tie when latched and no win/loss has fired', () => {
    const state = makeState({
      counters: { [ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED]: 1 },
    });
    resolveFinalTurnTieIfUnresolved(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE], 1);
    assert.match(state.messages[0]!.text, /tie between good and evil/);
  });

  // why: "you can finish the current turn as a final chance to win" — a win that
  // landed during the final turn must NOT be overwritten by a tie.
  it('does NOT tie when a win fired during the final turn', () => {
    const state = makeState({
      counters: {
        [ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED]: 1,
        [ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]: 1,
      },
    });
    resolveFinalTurnTieIfUnresolved(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE], undefined);
  });

  it('does NOT tie when a loss fired during the final turn', () => {
    const state = makeState({
      counters: {
        [ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED]: 1,
        [ENDGAME_CONDITIONS.SCHEME_LOSS]: 1,
      },
    });
    resolveFinalTurnTieIfUnresolved(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE], undefined);
  });

  it('is idempotent: a resolved tie is not re-logged', () => {
    const state = makeState({
      counters: {
        [ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED]: 1,
        [ENDGAME_CONDITIONS.FINAL_TURN_TIE]: 1,
      },
    });
    resolveFinalTurnTieIfUnresolved(state);
    assert.equal(state.messages.length, 0);
  });

  // why: end-to-end proof of the "even if a card puts cards back" rule at the
  // logic layer — the deck refilled after latching, yet the turn still ties.
  it('ties even when the deck was refilled after the latch (sticky latch honored)', () => {
    const state = makeState({
      villainDeck: ['put-back-1', 'put-back-2'],
      heroDeck: ['h-1'],
      counters: { [ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED]: 1 },
    });
    resolveFinalTurnTieIfUnresolved(state);
    assert.equal(state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE], 1);
  });
});

describe('D-24319 — Civil War hero-deck depletion pre-empts the deck-exhaustion tie (WP-510)', () => {
  /** A Super Hero Civil War state with an empty hero deck (villain deck intact). */
  function civilWarHeroDeckEmpty(): LegendaryGameState {
    return {
      selection: {
        schemeId: 'core/super-hero-civil-war',
        mastermindId: 'test-mastermind',
        villainGroupIds: [],
        henchmanGroupIds: [],
        heroDeckIds: [],
      },
      counters: {},
      villainDeck: { deck: ['v-1'], discard: [] },
      heroDeck: [],
      messages: [],
    } as unknown as LegendaryGameState;
  }

  // why: the full override chain, not a hand-set SCHEME_LOSS. The empty hero deck
  // latches the final turn AND triggers the pile-depletion scheme loss on the same
  // move; the loss must pre-empt the tie purely by precedence (SCHEME_LOSS before
  // FINAL_TURN_TIE in evaluateEndgame + the tie-resolution guard) — no change to
  // finalTurn.logic.ts.
  it('an empty hero deck sets SCHEME_LOSS, latches the final turn, and the tie never resolves → scheme-wins', () => {
    const state = civilWarHeroDeckEmpty();

    // The two turn.onMove siblings, in wiring order (game.ts).
    latchFinalTurnIfDeckExhausted(state);
    applyPileDepletionResourceLoss(state);

    assert.equal(
      state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TRIGGERED],
      1,
      'the empty hero deck must still latch the final turn',
    );
    assert.equal(
      state.counters[ENDGAME_CONDITIONS.SCHEME_LOSS],
      1,
      'hero-deck depletion must set the scheme loss',
    );

    // The tie resolution (turn.onEnd) must be a no-op — the scheme loss won.
    resolveFinalTurnTieIfUnresolved(state);
    assert.equal(
      state.counters[ENDGAME_CONDITIONS.FINAL_TURN_TIE],
      undefined,
      'the tie must NOT resolve once the scheme loss is latched',
    );

    const result = evaluateEndgame(state);
    assert.ok(result, 'endgame must have resolved');
    assert.equal(result!.outcome, 'scheme-wins', 'evil wins by hero-deck depletion, not a tie');
  });
});
