/**
 * Unit tests for the pure builders + atomic appliers of the two multi-seat "each
 * other player chooses" core mastermind tactics (WP-694 / EC-731 / D-24511):
 *
 *   - Monarch's Decree (Dr. Doom) — the active draw-vs-discard mode choice, the
 *     deterministic each-other-draws apply, and the multi-seat discard build/apply.
 *   - Vanishing Illusions (Loki) — the multi-seat KO-a-Victory-Pile-Villain build/apply.
 *
 * Covers the built shapes (kinds, addressed seats, options, defaults), skip-self, the
 * empty-hand / no-villain no-address, the bystander-villain-deck exclusion, atomic
 * ascending-order apply (byte-identical regardless of submission order), and the
 * reshuffle-aware draw. node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
import {
  buildMonarchsDecreeModeChoice,
  readMonarchsDecreeSelectedMode,
  applyMonarchsDecreeMode,
  buildMonarchsDiscardChoice,
  applyMonarchsDiscard,
  buildVanishingIllusionsChoice,
  applyVanishingIllusionsKo,
  MONARCHS_DECREE_MODE_KIND,
  MONARCHS_DISCARD_KIND,
  VANISHING_ILLUSIONS_KO_KIND,
} from './seatChoiceTactics.js';

// why: a real reversing ShuffleProvider (the makeMockCtx idiom) — reversing proves the
// reshuffle ran when a draw exhausts the deck and pulls the discard back in.
const SHUFFLE = { random: { Shuffle: <T,>(items: T[]): T[] => [...items].reverse() } };

/** Minimal G carrying only the fields these tactic builders/appliers touch. */
function makeState(zonesBySeat: Record<string, {
  deck?: string[];
  hand?: string[];
  discard?: string[];
  victory?: string[];
}>): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(zonesBySeat)) {
    const z = zonesBySeat[seat]!;
    playerZones[seat] = {
      deck: [...(z.deck ?? [])],
      hand: [...(z.hand ?? [])],
      discard: [...(z.discard ?? [])],
      inPlay: [],
      victory: [...(z.victory ?? [])],
    };
  }
  return {
    playerZones,
    ko: [],
    cardDisplayData: {},
    messages: [],
  } as unknown as LegendaryGameState;
}

/** Records a submission onto a choice (the seat's chosen option index). */
function submit(choice: PendingSeatChoice, seat: string, optionIndex: number): void {
  choice.submissions[seat] = { optionIndex };
}

// ---------------------------------------------------------------------------
// Monarch's Decree — mode choice
// ---------------------------------------------------------------------------

describe('buildMonarchsDecreeModeChoice (WP-694 / D-24511)', () => {
  it('is an active single-seat choice with two options in the locked order and default 0', () => {
    const choice = buildMonarchsDecreeModeChoice('2');
    assert.equal(choice.kind, MONARCHS_DECREE_MODE_KIND);
    assert.deepEqual(choice.addressedSeats, ['2'], 'addressed to the defeating player only');
    assert.equal(choice.seatPrompts['2']!.options.length, 2);
    assert.match(choice.seatPrompts['2']!.options[0]!.label, /draws a card/);
    assert.match(choice.seatPrompts['2']!.options[1]!.label, /discards a card/);
    assert.equal(choice.defaultOptionIndex, 0, 'default = draw');
  });
});

describe('readMonarchsDecreeSelectedMode (WP-694 / D-24511)', () => {
  it('maps option 0 → draw, option 1 → discard, and no submission → undefined', () => {
    const choice = buildMonarchsDecreeModeChoice('0');
    assert.equal(readMonarchsDecreeSelectedMode(choice), undefined, 'nothing submitted yet');
    submit(choice, '0', 0);
    assert.equal(readMonarchsDecreeSelectedMode(choice), 'draw');
    submit(choice, '0', 1);
    assert.equal(readMonarchsDecreeSelectedMode(choice), 'discard');
  });
});

describe('applyMonarchsDecreeMode — draw branch (WP-694 / D-24511)', () => {
  it('each OTHER player draws exactly one card; the defeating player draws nothing', () => {
    const G = makeState({
      '0': { deck: ['a0', 'a1'] },
      '1': { deck: ['b0', 'b1'] },
      '2': { deck: ['c0', 'c1'] },
    });
    const choice = buildMonarchsDecreeModeChoice('0');
    submit(choice, '0', 0); // draw
    applyMonarchsDecreeMode(G, choice, SHUFFLE);
    assert.deepEqual(G.playerZones['0']!.hand, [], 'the defeating player did not draw');
    assert.deepEqual(G.playerZones['1']!.hand, ['b0'], 'other player 1 drew one');
    assert.deepEqual(G.playerZones['2']!.hand, ['c0'], 'other player 2 drew one');
  });

  it('the discard branch draws nothing here (the chained multi-seat discard applies it)', () => {
    const G = makeState({ '0': { deck: ['a0'] }, '1': { deck: ['b0'] } });
    const choice = buildMonarchsDecreeModeChoice('0');
    submit(choice, '0', 1); // discard
    applyMonarchsDecreeMode(G, choice, SHUFFLE);
    assert.deepEqual(G.playerZones['1']!.hand, [], 'no draw on the discard branch');
  });

  it('the draw is reshuffle-aware — an empty deck pulls the discard back in', () => {
    const G = makeState({ '0': { deck: ['a0'] }, '1': { deck: [], discard: ['d0'] } });
    const choice = buildMonarchsDecreeModeChoice('0');
    submit(choice, '0', 0);
    applyMonarchsDecreeMode(G, choice, SHUFFLE);
    assert.deepEqual(G.playerZones['1']!.hand, ['d0'], 'reshuffled the discard and drew it');
    assert.deepEqual(G.playerZones['1']!.discard, [], 'discard reshuffled into deck');
  });
});

// ---------------------------------------------------------------------------
// Monarch's Decree — multi-seat discard
// ---------------------------------------------------------------------------

describe('buildMonarchsDiscardChoice (WP-694 / D-24511)', () => {
  it('addresses only OTHER seats that hold a card, one option per hand card', () => {
    const G = makeState({
      '1': { hand: ['h1a', 'h1b'] },
      '2': { hand: [] }, // empty hand → not addressed
      '3': { hand: ['h3a'] },
    });
    const choice = buildMonarchsDiscardChoice(G, ['1', '2', '3']);
    assert.ok(choice !== undefined);
    assert.deepEqual(choice!.addressedSeats, ['1', '3'], 'the empty-hand seat is not addressed');
    assert.equal(choice!.kind, MONARCHS_DISCARD_KIND);
    assert.equal(choice!.seatPrompts['1']!.options.length, 2);
    assert.equal(choice!.seatPrompts['1']!.options[0]!.cardId, 'h1a', 'option carries the hand instance');
    assert.equal(choice!.defaultOptionIndex, 0);
  });

  it('returns undefined when no other seat holds a card', () => {
    const G = makeState({ '1': { hand: [] }, '2': { hand: [] } });
    assert.equal(buildMonarchsDiscardChoice(G, ['1', '2']), undefined);
  });
});

describe('applyMonarchsDiscard — atomic multi-seat (WP-694 / D-24511)', () => {
  it('each addressed seat discards its chosen card to its own discard pile', () => {
    const G = makeState({
      '1': { hand: ['h1a', 'h1b'] },
      '2': { hand: ['h2a'] },
    });
    const choice = buildMonarchsDiscardChoice(G, ['1', '2'])!;
    submit(choice, '1', 1); // discard h1b
    submit(choice, '2', 0); // discard h2a
    applyMonarchsDiscard(G, choice);
    assert.deepEqual(G.playerZones['1']!.hand, ['h1a'], 'seat 1 discarded its chosen card');
    assert.deepEqual(G.playerZones['1']!.discard, ['h1b']);
    assert.deepEqual(G.playerZones['2']!.hand, []);
    assert.deepEqual(G.playerZones['2']!.discard, ['h2a']);
  });

  it('is byte-identical regardless of submission order (ascending-seat apply)', () => {
    const build = () => {
      const G = makeState({ '1': { hand: ['h1a'] }, '2': { hand: ['h2a'] } });
      const choice = buildMonarchsDiscardChoice(G, ['1', '2'])!;
      return { G, choice };
    };
    const forward = build();
    submit(forward.choice, '1', 0);
    submit(forward.choice, '2', 0);
    applyMonarchsDiscard(forward.G, forward.choice);

    const reverse = build();
    submit(reverse.choice, '2', 0);
    submit(reverse.choice, '1', 0);
    applyMonarchsDiscard(reverse.G, reverse.choice);

    assert.deepEqual(forward.G.playerZones, reverse.G.playerZones);
  });
});

// ---------------------------------------------------------------------------
// Vanishing Illusions — multi-seat KO
// ---------------------------------------------------------------------------

describe('buildVanishingIllusionsChoice (WP-694 / D-24511)', () => {
  it('addresses only OTHER seats holding a Victory-Pile Villain, one option per Villain', () => {
    const G = makeState({
      '1': { victory: ['core-villain-hydra-elite-a#0', 'core-villain-hydra-elite-b#0'] },
      '2': { victory: [] }, // no villain → not addressed
      '3': { victory: ['core-villain-brotherhood-c#0'] },
    });
    const choice = buildVanishingIllusionsChoice(G, ['1', '2', '3']);
    assert.ok(choice !== undefined);
    assert.equal(choice!.kind, VANISHING_ILLUSIONS_KO_KIND);
    assert.deepEqual(choice!.addressedSeats, ['1', '3']);
    assert.equal(choice!.seatPrompts['1']!.options.length, 2);
    assert.equal(choice!.seatPrompts['1']!.options[0]!.cardId, 'core-villain-hydra-elite-a#0');
    assert.equal(choice!.defaultOptionIndex, 0);
  });

  it('excludes rescued Bystanders (bystander-villain-deck-NN) and non-villain victory cards', () => {
    const G = makeState({
      '1': {
        victory: [
          'bystander-villain-deck-05', // contains "-villain-" but is a Bystander
          'core-henchman-doombot-a#0', // henchman, not a villain
          'core-mastermind-dr-doom-monarchs-decree', // a defeated tactic
        ],
      },
    });
    // No real Villain present → no seat qualifies → nothing to park.
    assert.equal(buildVanishingIllusionsChoice(G, ['1']), undefined);
  });

  it('returns undefined when no other seat has a Victory-Pile Villain', () => {
    const G = makeState({ '1': { victory: [] } });
    assert.equal(buildVanishingIllusionsChoice(G, ['1']), undefined);
  });
});

describe('applyVanishingIllusionsKo — atomic multi-seat (WP-694 / D-24511)', () => {
  it('moves each addressed seat\'s chosen Villain from its Victory Pile to the top-level G.ko', () => {
    const G = makeState({
      '1': { victory: ['core-villain-hydra-a#0', 'core-villain-hydra-b#0'] },
      '2': { victory: ['core-villain-brotherhood-c#0'] },
    });
    const choice = buildVanishingIllusionsChoice(G, ['1', '2'])!;
    submit(choice, '1', 1); // KO hydra-b
    submit(choice, '2', 0); // KO brotherhood-c
    applyVanishingIllusionsKo(G, choice);
    assert.deepEqual(G.playerZones['1']!.victory, ['core-villain-hydra-a#0'], 'chosen villain removed');
    assert.deepEqual(G.playerZones['2']!.victory, []);
    assert.deepEqual(G.ko, ['core-villain-hydra-b#0', 'core-villain-brotherhood-c#0'], 'both KO to G.ko');
  });

  it('is byte-identical regardless of submission order (ascending-seat apply)', () => {
    const build = () => {
      const G = makeState({
        '1': { victory: ['core-villain-hydra-a#0'] },
        '2': { victory: ['core-villain-brotherhood-c#0'] },
      });
      const choice = buildVanishingIllusionsChoice(G, ['1', '2'])!;
      return { G, choice };
    };
    const forward = build();
    submit(forward.choice, '1', 0);
    submit(forward.choice, '2', 0);
    applyVanishingIllusionsKo(forward.G, forward.choice);

    const reverse = build();
    submit(reverse.choice, '2', 0);
    submit(reverse.choice, '1', 0);
    applyVanishingIllusionsKo(reverse.G, reverse.choice);

    assert.deepEqual(forward.G.ko, reverse.G.ko, 'KO order is ascending-seat, not submission order');
    assert.deepEqual(forward.G.playerZones, reverse.G.playerZones);
  });
});
