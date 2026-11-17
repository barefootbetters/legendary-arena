/**
 * Mastermind logic unit tests for WP-019.
 *
 * Tests defeatTopTactic and areAllTacticsDefeated pure helpers.
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  defeatTopTactic,
  areAllTacticsDefeated,
  transformMastermind,
  countMastermindWounds,
  hasAvailableWound,
  takeWoundForMastermind,
  takeWoundFromMastermind,
  returnMastermindWounds,
} from './mastermind.logic.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { MastermindState } from './mastermind.types.js';
import { makeMastermindState } from '../test/fixtureBuilders.js';

describe('defeatTopTactic', () => {
  it('removes first card from tacticsDeck and appends to tacticsDefeated', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-a',
      baseCardId: 'mm-a-base',
      tacticsDeck: ['tactic-1', 'tactic-2', 'tactic-3'],
      tacticsDefeated: [],
    };

    const result = defeatTopTactic(state);

    assert.deepStrictEqual(result.tacticsDeck, ['tactic-2', 'tactic-3']);
    assert.deepStrictEqual(result.tacticsDefeated, ['tactic-1']);
  });

  it('on empty tacticsDeck: returns unchanged', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-b',
      baseCardId: 'mm-b-base',
      tacticsDeck: [],
      tacticsDefeated: ['already-defeated'],
    };

    const result = defeatTopTactic(state);

    assert.strictEqual(result, state, 'Must return the same object when deck is empty');
    assert.deepStrictEqual(result.tacticsDeck, []);
    assert.deepStrictEqual(result.tacticsDefeated, ['already-defeated']);
  });

  it('preserves strikePile, attachedBystanders, and gameText through a defeat', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-f',
      baseCardId: 'mm-f-base',
      tacticsDeck: ['tactic-1'],
      tacticsDefeated: [],
      strikePile: ['strike-1'],
      attachedBystanders: ['pile-bystander'],
      gameText: ['Master Strike: each player discards a card.'],
    };

    const result = defeatTopTactic(state);

    assert.deepStrictEqual(
      result.strikePile,
      ['strike-1'],
      'strikePile must survive the rebuild',
    );
    assert.deepStrictEqual(
      result.attachedBystanders,
      ['pile-bystander'],
      'attachedBystanders must survive the rebuild',
    );
    assert.deepStrictEqual(
      result.gameText,
      ['Master Strike: each player discards a card.'],
      'gameText must survive the rebuild',
    );
  });

  it('returns new object (input not mutated)', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-c',
      baseCardId: 'mm-c-base',
      tacticsDeck: ['tactic-x', 'tactic-y'],
      tacticsDefeated: [],
    };

    const result = defeatTopTactic(state);

    assert.notStrictEqual(result, state, 'Must return a new object');
    assert.deepStrictEqual(
      state.tacticsDeck,
      ['tactic-x', 'tactic-y'],
      'Original tacticsDeck must not be mutated',
    );
    assert.deepStrictEqual(
      state.tacticsDefeated,
      [],
      'Original tacticsDefeated must not be mutated',
    );
  });
});

describe('areAllTacticsDefeated', () => {
  it('returns true when deck empty and defeated non-empty', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-d',
      baseCardId: 'mm-d-base',
      tacticsDeck: [],
      tacticsDefeated: ['t1', 't2', 't3'],
    };

    assert.strictEqual(areAllTacticsDefeated(state), true);
  });

  it('returns false when deck has cards', () => {
    const state: MastermindState = { ...makeMastermindState(),
      id: 'mm-e',
      baseCardId: 'mm-e-base',
      tacticsDeck: ['remaining'],
      tacticsDefeated: ['t1'],
    };

    assert.strictEqual(areAllTacticsDefeated(state), false);
  });
});

describe('transformMastermind (WP-669 / D-24483)', () => {
  const generalRoss = 'wwhk-mastermind-general-thunderbolt-ross-general-thunderbolt-ross';
  const redHulk = 'wwhk-mastermind-general-thunderbolt-ross-red-hulk';

  /** A captured transforming mastermind, active on the General Ross face. */
  const rossState = (): MastermindState => ({ ...makeMastermindState(),
    id: 'wwhk/general-thunderbolt-ross',
    baseCardId: generalRoss,
    alternateFaceId: redHulk,
    tacticsDeck: ['t1', 't2'],
    tacticsDefeated: ['t0'],
    strikePile: ['s1'],
    gameText: ['General Ross text'],
    faceGameText: { [generalRoss]: ['General Ross text'], [redHulk]: ['Red Hulk text'] },
  });

  it('swaps baseCardId ↔ alternateFaceId and updates gameText to the new face', () => {
    const flipped = transformMastermind(rossState());
    assert.strictEqual(flipped.baseCardId, redHulk, 'the new active face is Red Hulk');
    assert.strictEqual(flipped.alternateFaceId, generalRoss, 'the now-inactive face is General Ross');
    assert.deepStrictEqual(flipped.gameText, ['Red Hulk text'], 'gameText follows the new active face');
  });

  it('preserves every unrelated field across the flip (copy-then-override)', () => {
    const flipped = transformMastermind(rossState());
    assert.deepStrictEqual(flipped.tacticsDeck, ['t1', 't2'], 'tactics survive the flip');
    assert.deepStrictEqual(flipped.tacticsDefeated, ['t0'], 'defeated tactics survive');
    assert.deepStrictEqual(flipped.strikePile, ['s1'], 'strikePile survives');
    assert.deepStrictEqual(flipped.faceGameText?.[redHulk], ['Red Hulk text'], 'faceGameText survives');
  });

  it('is bidirectional — flipping twice returns to the original face', () => {
    const there = transformMastermind(rossState());
    const back = transformMastermind(there);
    assert.strictEqual(back.baseCardId, generalRoss, 'flipping back restores General Ross');
    assert.strictEqual(back.alternateFaceId, redHulk);
    assert.deepStrictEqual(back.gameText, ['General Ross text']);
  });

  it('is a no-op for a mastermind with no alternateFaceId (non-transform)', () => {
    const plain: MastermindState = { ...makeMastermindState(),
      id: 'core/dr-doom',
      baseCardId: 'core-mastermind-dr-doom-dr-doom',
      gameText: ['Doom text'],
    };
    const result = transformMastermind(plain);
    assert.strictEqual(result, plain, 'no alternateFaceId → returns the input unchanged');
  });
});

// ---------------------------------------------------------------------------
// Generic Mastermind Wounds (WP-769 / D-24602)
// ---------------------------------------------------------------------------

describe('Mastermind Wound helpers (WP-769 / D-24602)', () => {
  const WOUND = 'pile-wound' as CardExtId;

  /** A narrow G: a Mastermind, a KO pile, a Wound Stack. */
  function makeWoundG(ko: CardExtId[], stack: CardExtId[], held?: CardExtId[]): LegendaryGameState {
    const mastermind = held === undefined ? makeMastermindState() : { ...makeMastermindState(), wounds: held };
    return { mastermind, ko, piles: { wounds: stack } } as unknown as LegendaryGameState;
  }

  it('counts held Wounds and finds an available one in the KO pile or the stack', () => {
    assert.equal(countMastermindWounds(makeMastermindState()), 0);
    assert.equal(countMastermindWounds({ ...makeMastermindState(), wounds: [WOUND, WOUND] }), 2);
    assert.equal(hasAvailableWound(makeWoundG([], [])), false);
    assert.equal(hasAvailableWound(makeWoundG(['hero' as CardExtId, WOUND], [])), true);
    assert.equal(hasAvailableWound(makeWoundG([], [WOUND])), true);
  });

  it('takeWoundForMastermind takes the KO pile first, then the stack top; never aliases; null with neither', () => {
    const G = makeWoundG(['hero' as CardExtId, WOUND], ['stack-top' as CardExtId, WOUND]);
    const koBefore = G.ko;
    const mastermindBefore = G.mastermind;
    assert.equal(takeWoundForMastermind(G), WOUND);
    assert.deepEqual(G.ko, ['hero']);
    assert.deepEqual(koBefore, ['hero', WOUND], 'the old KO array is not mutated');
    assert.equal('wounds' in mastermindBefore, false, 'the old MastermindState is not mutated');
    assert.equal(takeWoundForMastermind(G), 'stack-top');
    assert.deepEqual(G.piles.wounds, [WOUND]);
    assert.deepEqual(G.mastermind.wounds, [WOUND, 'stack-top']);
    assert.equal(takeWoundForMastermind(makeWoundG([], [])), null);
  });

  it('a KO-pile Wound from before the turn snapshot keeps "KO\'d this turn" exact (D-24568)', () => {
    // why: the Hero at index 2 was KO'd this turn (snapshot 2); the Wound at index 0 predates it.
    const G = makeWoundG([WOUND, 'old-hero' as CardExtId, 'new-hero' as CardExtId], []);
    G.koPileLengthAtTurnStart = 2;
    takeWoundForMastermind(G);
    assert.equal(G.koPileLengthAtTurnStart, 1);
    assert.deepEqual(G.ko.slice(G.koPileLengthAtTurnStart), ['new-hero'], 'the KO\'d-this-turn window still holds the Hero');

    const thisTurn = makeWoundG(['old-hero' as CardExtId, WOUND], []);
    thisTurn.koPileLengthAtTurnStart = 1;
    takeWoundForMastermind(thisTurn);
    assert.equal(thisTurn.koPileLengthAtTurnStart, 1, 'a Wound KO\'d this turn leaves the snapshot');

    const absent = makeWoundG([WOUND], []);
    takeWoundForMastermind(absent);
    assert.equal('koPileLengthAtTurnStart' in absent, false, 'the field is never created');
  });

  it('takeWoundFromMastermind removes the first; the field is deleted when empty, never []', () => {
    const G = makeWoundG([], [], [WOUND, 'second' as CardExtId]);
    const heldBefore = G.mastermind.wounds;
    assert.equal(takeWoundFromMastermind(G), WOUND);
    assert.deepEqual(G.mastermind.wounds, ['second']);
    assert.deepEqual(heldBefore, [WOUND, 'second'], 'not aliased');
    assert.equal(takeWoundFromMastermind(G), 'second');
    assert.equal('wounds' in G.mastermind, false);
    assert.equal(takeWoundFromMastermind(G), null);
  });

  it('returnMastermindWounds appends to the stack bottom and deletes the field; 0 and no change when none', () => {
    const G = makeWoundG([], ['top' as CardExtId], [WOUND, WOUND]);
    const stackBefore = G.piles.wounds;
    assert.equal(returnMastermindWounds(G), 2);
    assert.deepEqual(G.piles.wounds, ['top', WOUND, WOUND]);
    assert.deepEqual(stackBefore, ['top'], 'not aliased');
    assert.equal('wounds' in G.mastermind, false);
    const none = makeWoundG([], ['top' as CardExtId]);
    const mastermindBefore = none.mastermind;
    assert.equal(returnMastermindWounds(none), 0);
    assert.equal(none.mastermind, mastermindBefore, 'untouched');
  });
});
