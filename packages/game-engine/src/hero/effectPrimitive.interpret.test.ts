/**
 * Tests for the `max-class-count-in-zone` value-expression evaluator (WP-283 / D-24063 / D-24064).
 *
 * Covers: `classes === 'all'` oracle-max (multi-class HQ, single class, empty, all-null slots);
 * `classes: string[]` oracle-max (class present, class absent, subset of present classes);
 * missing G.hq → 0 + warn; missing G.cardTraits → 0 + warn; empty-HQ → 0 no-throw;
 * end-to-end through interpretHeroPrimitiveEffect using buildEmpoweredFreeChoiceComposition
 * and buildEmpoweredChooseOneComposition.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { interpretHeroPrimitiveEffect } from './effectPrimitive.interpret.js';
import {
  buildEmpoweredFreeChoiceComposition,
  buildEmpoweredChooseOneComposition,
  buildDynamicEmpoweredComposition,
} from '../rules/heroCompositions.js';
import type { LegendaryGameState } from '../types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Builds a minimal LegendaryGameState exposing the slice the max-class evaluator reads. */
function makeState(options: {
  hq?: (string | null)[];
  cardTraits?: Record<string, { heroClass: string | null; team: string | null }>;
  attack?: number;
  omitHq?: boolean;
  omitCardTraits?: boolean;
  omitMessages?: boolean;
}): LegendaryGameState {
  const state: Record<string, unknown> = {
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    cardStats: {},
    messages: [],
    turnEconomy: {
      attack: options.attack ?? 0,
      recruit: 0,
      spentAttack: 0,
      spentRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    },
  };
  if (!options.omitHq) {
    state.hq = options.hq ?? [];
  }
  if (!options.omitCardTraits) {
    state.cardTraits = options.cardTraits ?? {};
  }
  if (options.omitMessages) {
    delete state.messages;
  }
  return state as unknown as LegendaryGameState;
}

/** A throwaway boardgame.io ctx — the evaluator never reads it. */
const CTX = {};

// ---------------------------------------------------------------------------
// max-class-count-in-zone — classes: 'all' (oracle-max over all HQ classes)
// ---------------------------------------------------------------------------

describe('interpretHeroPrimitiveEffect — max-class-count-in-zone (classes: all)', () => {
  it('returns the highest per-class count when multiple classes are present in the HQ', () => {
    // HQ: strength×2, tech×1, covert×3 → max is 3 (covert)
    const G = makeState({
      hq: ['a', 'b', 'c', 'd', 'e'],
      cardTraits: {
        a: { heroClass: 'strength', team: null },
        b: { heroClass: 'tech', team: null },
        c: { heroClass: 'covert', team: null },
        d: { heroClass: 'strength', team: null },
        e: { heroClass: 'covert', team: null },
      },
    });
    // Inject one more covert card to reach ×3
    G.hq = ['a', 'b', 'c', 'd', 'e', 'f'] as unknown as typeof G.hq;
    (G.cardTraits as Record<string, { heroClass: string; team: null }>)['f'] = { heroClass: 'covert', team: null };

    interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredFreeChoiceComposition());

    assert.equal(G.turnEconomy!.attack, 3, 'oracle-max returns 3 (the covert count)');
  });

  it('returns the count of the sole class when only one class is present', () => {
    const G = makeState({
      hq: ['a', 'b', null, null, null],
      cardTraits: {
        a: { heroClass: 'ranged', team: null },
        b: { heroClass: 'ranged', team: null },
      },
    });

    interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredFreeChoiceComposition());

    assert.equal(G.turnEconomy!.attack, 2, 'oracle-max returns 2 for the only class present');
  });

  it('skips null HQ slots', () => {
    const G = makeState({
      hq: [null, 'a', null, null, null],
      cardTraits: { a: { heroClass: 'speed', team: null } },
    });

    interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredFreeChoiceComposition());

    assert.equal(G.turnEconomy!.attack, 1, 'one non-null slot of class speed → oracle-max is 1');
  });

  it('returns 0 when the HQ is entirely null slots', () => {
    const G = makeState({
      hq: [null, null, null, null, null],
      cardTraits: {},
    });

    interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredFreeChoiceComposition());

    assert.equal(G.turnEconomy!.attack, 0, 'all-null HQ → oracle-max is 0');
  });

  it('returns 0 and warns when G.hq is absent', () => {
    const G = makeState({ omitHq: true });

    assert.doesNotThrow(() => interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredFreeChoiceComposition()));
    assert.equal(G.turnEconomy!.attack, 0, 'absent G.hq → +0');
    assert.ok(
      (G.messages as string[]).some((message) => message.includes('no HQ zone or no card traits')),
      'a missing G.hq warns',
    );
  });

  it('returns 0 and warns when G.cardTraits is absent', () => {
    const G = makeState({ hq: ['a', 'b', null, null, null], omitCardTraits: true });

    assert.doesNotThrow(() => interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredFreeChoiceComposition()));
    assert.equal(G.turnEconomy!.attack, 0, 'absent G.cardTraits → +0');
  });
});

// ---------------------------------------------------------------------------
// max-class-count-in-zone — classes: string[] (oracle-max over enumerated candidates)
// ---------------------------------------------------------------------------

describe('interpretHeroPrimitiveEffect — max-class-count-in-zone (classes: string[])', () => {
  it('returns the highest count among the enumerated candidate classes', () => {
    // HQ: strength×1, covert×2, tech×3 — only strength and covert are candidates
    const G = makeState({
      hq: ['a', 'b', 'c', 'd', 'e'],
      cardTraits: {
        a: { heroClass: 'strength', team: null },
        b: { heroClass: 'covert', team: null },
        c: { heroClass: 'covert', team: null },
        d: { heroClass: 'tech', team: null },
        e: { heroClass: 'tech', team: null },
      },
    });
    // Add a third tech card (not in candidates).
    G.hq = ['a', 'b', 'c', 'd', 'e', 'f'] as unknown as typeof G.hq;
    (G.cardTraits as Record<string, { heroClass: string; team: null }>)['f'] = { heroClass: 'tech', team: null };

    interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredChooseOneComposition(['strength', 'covert']));

    assert.equal(
      G.turnEconomy!.attack,
      2,
      'oracle-max of strength(1) vs covert(2) is 2; tech(3) is excluded',
    );
  });

  it('returns 0 when none of the candidate classes is present in the HQ', () => {
    const G = makeState({
      hq: ['a', 'b', null, null, null],
      cardTraits: {
        a: { heroClass: 'tech', team: null },
        b: { heroClass: 'ranged', team: null },
      },
    });

    interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredChooseOneComposition(['strength', 'covert']));

    assert.equal(G.turnEconomy!.attack, 0, 'no candidate class in HQ → +0');
  });

  it('returns 0 when the HQ is empty', () => {
    const G = makeState({ hq: [], cardTraits: {} });

    assert.doesNotThrow(() => interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredChooseOneComposition(['strength', 'covert'])));
    assert.equal(G.turnEconomy!.attack, 0, 'empty HQ → +0, no throw');
  });

  it('does not alias the classes array on the caller side', () => {
    const classes = ['strength', 'covert'];
    const composition = buildEmpoweredChooseOneComposition(classes);
    // Mutate the original — the composition AST must be independent.
    classes[0] = 'tech';
    const G = makeState({
      hq: ['a'],
      cardTraits: { a: { heroClass: 'strength', team: null } },
    });

    interpretHeroPrimitiveEffect(G, CTX, '0', composition);

    // The composition still has 'strength' in its classes (the mutation was NOT propagated).
    assert.equal(G.turnEconomy!.attack, 1, 'composition classes are independent of the source array');
  });

  it('warning is best-effort when G.messages is absent', () => {
    const G = makeState({ omitHq: true, omitMessages: true });

    assert.doesNotThrow(
      () => interpretHeroPrimitiveEffect(G, CTX, '0', buildEmpoweredChooseOneComposition(['strength', 'covert'])),
      'a missing G.messages must not turn a safe default into a throw',
    );
    assert.equal(G.turnEconomy!.attack, 0, '+0 without a messages array');
  });
});

// ---------------------------------------------------------------------------
// top-deck-card-class-count-in-zone — deck-peek evaluator (WP-284 / D-24065 / D-24066)
// ---------------------------------------------------------------------------

describe('interpretHeroPrimitiveEffect — top-deck-card-class-count-in-zone (deck-peek)', () => {
  it('grants +Attack equal to the number of HQ cards sharing the top deck card class (AC-3)', () => {
    // Top deck card is 'strength'; HQ has 2 strength cards → +2.
    const G = makeState({
      cardTraits: {
        'deck-top': { heroClass: 'strength', team: null },
        'hq-a': { heroClass: 'strength', team: null },
        'hq-b': { heroClass: 'tech', team: null },
        'hq-c': { heroClass: 'strength', team: null },
      },
    });
    G.playerZones['0']!.deck = ['deck-top', 'deck-second'] as unknown as typeof G.playerZones['0']['deck'];
    G.hq = ['hq-a', 'hq-b', 'hq-c', null, null] as unknown as typeof G.hq;

    interpretHeroPrimitiveEffect(G, CTX, '0', buildDynamicEmpoweredComposition());

    assert.equal(G.turnEconomy!.attack, 2, '+Attack equals strength count in HQ (hq-a + hq-c)');
  });

  it('returns +0 when top deck card class is absent from the HQ', () => {
    const G = makeState({
      cardTraits: {
        'deck-top': { heroClass: 'covert', team: null },
        'hq-a': { heroClass: 'strength', team: null },
        'hq-b': { heroClass: 'tech', team: null },
      },
    });
    G.playerZones['0']!.deck = ['deck-top'] as unknown as typeof G.playerZones['0']['deck'];
    G.hq = ['hq-a', 'hq-b', null, null, null] as unknown as typeof G.hq;

    interpretHeroPrimitiveEffect(G, CTX, '0', buildDynamicEmpoweredComposition());

    assert.equal(G.turnEconomy!.attack, 0, 'no covert cards in HQ → +0');
  });

  it('returns +0 when the deck is empty (AC-5)', () => {
    const G = makeState({
      cardTraits: { 'hq-a': { heroClass: 'strength', team: null } },
    });
    G.playerZones['0']!.deck = [] as unknown as typeof G.playerZones['0']['deck'];
    G.hq = ['hq-a', null, null, null, null] as unknown as typeof G.hq;

    assert.doesNotThrow(() => interpretHeroPrimitiveEffect(G, CTX, '0', buildDynamicEmpoweredComposition()));
    assert.equal(G.turnEconomy!.attack, 0, 'empty deck → +0, no throw');
  });

  it('returns +0 when the top deck card has a null heroClass (AC-6)', () => {
    const G = makeState({
      cardTraits: {
        'deck-top': { heroClass: null, team: null },
        'hq-a': { heroClass: 'strength', team: null },
      },
    });
    G.playerZones['0']!.deck = ['deck-top'] as unknown as typeof G.playerZones['0']['deck'];
    G.hq = ['hq-a', null, null, null, null] as unknown as typeof G.hq;

    assert.doesNotThrow(() => interpretHeroPrimitiveEffect(G, CTX, '0', buildDynamicEmpoweredComposition()));
    assert.equal(G.turnEconomy!.attack, 0, 'null heroClass on top card → +0');
  });

  it('returns +0 when the top deck card has no cardTraits entry (AC-6 absent)', () => {
    const G = makeState({
      cardTraits: { 'hq-a': { heroClass: 'strength', team: null } },
    });
    // 'deck-top' has no entry in cardTraits
    G.playerZones['0']!.deck = ['deck-top'] as unknown as typeof G.playerZones['0']['deck'];
    G.hq = ['hq-a', null, null, null, null] as unknown as typeof G.hq;

    assert.doesNotThrow(() => interpretHeroPrimitiveEffect(G, CTX, '0', buildDynamicEmpoweredComposition()));
    assert.equal(G.turnEconomy!.attack, 0, 'missing cardTraits entry → +0');
  });

  it('deck and HQ arrays are deep-equal before and after the evaluation call (AC-12)', () => {
    const G = makeState({
      cardTraits: {
        'deck-top': { heroClass: 'ranged', team: null },
        'hq-a': { heroClass: 'ranged', team: null },
      },
    });
    G.playerZones['0']!.deck = ['deck-top', 'deck-second'] as unknown as typeof G.playerZones['0']['deck'];
    G.hq = ['hq-a', null, null, null, null] as unknown as typeof G.hq;

    const deckBefore = JSON.stringify(G.playerZones['0']!.deck);
    const hqBefore = JSON.stringify(G.hq);

    interpretHeroPrimitiveEffect(G, CTX, '0', buildDynamicEmpoweredComposition());

    assert.equal(
      JSON.stringify(G.playerZones['0']!.deck),
      deckBefore,
      'deck array is unchanged after peek — no zone mutation',
    );
    assert.equal(
      JSON.stringify(G.hq),
      hqBefore,
      'HQ array is unchanged after count — no zone mutation',
    );
    assert.equal(G.turnEconomy!.attack, 1, '+1 for the one ranged card in HQ');
  });

  it('skips null HQ slots when counting', () => {
    const G = makeState({
      cardTraits: {
        'deck-top': { heroClass: 'speed', team: null },
        'hq-a': { heroClass: 'speed', team: null },
      },
    });
    G.playerZones['0']!.deck = ['deck-top'] as unknown as typeof G.playerZones['0']['deck'];
    G.hq = [null, 'hq-a', null, null, null] as unknown as typeof G.hq;

    interpretHeroPrimitiveEffect(G, CTX, '0', buildDynamicEmpoweredComposition());

    assert.equal(G.turnEconomy!.attack, 1, 'null HQ slots skipped; only the one speed card counts');
  });
});
