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

/**
 * Minimal G carrying only the fields these tactic builders/appliers touch.
 * `villainDeckCardTypes` is the setup-time type map Vanishing Illusions reads to tell a
 * Villain or Henchman from a Bystander or Tactic (D-24742); `convertedVillainOrigins`
 * marks a converted Killbot.
 */
function makeState(zonesBySeat: Record<string, {
  deck?: string[];
  hand?: string[];
  discard?: string[];
  victory?: string[];
}>, villainDeckCardTypes: Record<string, string> = {},
convertedVillainOrigins?: Record<string, string>): LegendaryGameState {
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
    villainDeckCardTypes: { ...villainDeckCardTypes },
    convertedVillainOrigins,
  } as unknown as LegendaryGameState;
}

/** Types each id the way setup's villainDeckCardTypes map would (all one type). */
function typeAll(cardType: string, ids: string[]): Record<string, string> {
  const types: Record<string, string> = {};
  for (const id of ids) {
    types[id] = cardType;
  }
  return types;
}

/** The Villain ids the Vanishing Illusions tests below place in Victory Piles. */
const VILLAIN_TYPES = typeAll('villain', [
  'core-villain-hydra-elite-a#0',
  'core-villain-hydra-elite-b#0',
  'core-villain-hydra-a#0',
  'core-villain-hydra-b#0',
  'core-villain-brotherhood-c#0',
]);

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
    }, VILLAIN_TYPES);
    const choice = buildVanishingIllusionsChoice(G, ['1', '2', '3']);
    assert.ok(choice !== undefined);
    assert.equal(choice!.kind, VANISHING_ILLUSIONS_KO_KIND);
    assert.deepEqual(choice!.addressedSeats, ['1', '3']);
    assert.equal(choice!.seatPrompts['1']!.options.length, 2);
    assert.equal(choice!.seatPrompts['1']!.options[0]!.cardId, 'core-villain-hydra-elite-a#0');
    assert.equal(choice!.defaultOptionIndex, 0);
  });

  it('D-24742: a seat whose Victory Pile holds only Henchmen is addressed and KOs one', () => {
    // why: Henchmen are Villains (rules v23 "Henchmen Are Villains"; D-24603 / D-24608).
    // Live match Y1w7rCsC8Ek skipped a seat holding only Sentinels and Hand Ninjas.
    const G = makeState({
      '1': { victory: ['henchman-sentinel-03', 'henchman-hand-ninjas-04', 'henchman-sentinel-09'] },
    }, typeAll('henchman', ['henchman-sentinel-03', 'henchman-hand-ninjas-04', 'henchman-sentinel-09']));
    const choice = buildVanishingIllusionsChoice(G, ['1']);
    assert.ok(choice !== undefined, 'the Henchmen-only seat qualifies');
    assert.deepEqual(choice!.addressedSeats, ['1']);
    assert.deepEqual(
      choice!.seatPrompts['1']!.options.map((option) => option.cardId),
      ['henchman-sentinel-03', 'henchman-hand-ninjas-04', 'henchman-sentinel-09'],
    );
    submit(choice!, '1', 1); // KO hand-ninjas-04
    applyVanishingIllusionsKo(G, choice!);
    assert.deepEqual(G.playerZones['1']!.victory, ['henchman-sentinel-03', 'henchman-sentinel-09']);
    assert.deepEqual(G.ko, ['henchman-hand-ninjas-04'], 'the Henchman KOs to G.ko');
  });

  it('still excludes rescued Bystanders, a converted Killbot, and Mastermind Tactics', () => {
    const G = makeState({
      '1': {
        victory: [
          'bystander-villain-deck-05', // contains "-villain-" but is a Bystander
          'bystander', // a supply Bystander (never in the villain-deck map)
          'bystander-villain-deck-07', // a defeated Killbot: typed 'villain', counts as a Bystander
          'core-mastermind-dr-doom-monarchs-decree', // a defeated tactic (never in the map)
          'core-mastermind-loki', // the mastermind itself (never in the map)
        ],
      },
    }, {
      'bystander-villain-deck-05': 'bystander',
      'bystander-villain-deck-07': 'villain',
    }, { 'bystander-villain-deck-07': 'killbot' });
    // No Villain or Henchman present → no seat qualifies → nothing to park.
    assert.equal(buildVanishingIllusionsChoice(G, ['1']), undefined);
  });

  it('offers only the Villains and Henchmen from a mixed Victory Pile', () => {
    const G = makeState({
      '1': {
        victory: [
          'bystander-villain-deck-05',
          'henchman-sentinel-03',
          'core-mastermind-loki-cruel-ruler',
          'core-villain-hydra-a#0',
        ],
      },
    }, { ...VILLAIN_TYPES, 'henchman-sentinel-03': 'henchman', 'bystander-villain-deck-05': 'bystander' });
    const choice = buildVanishingIllusionsChoice(G, ['1']);
    assert.deepEqual(
      choice!.seatPrompts['1']!.options.map((option) => option.cardId),
      ['henchman-sentinel-03', 'core-villain-hydra-a#0'],
    );
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
    }, VILLAIN_TYPES);
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
      }, VILLAIN_TYPES);
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

import { applyFallenIdolsDiscard, buildFallenIdolsDiscardChoice } from './seatChoiceTactics.js';

describe('WP-818 applyFallenIdolsDiscard — atomic multi-seat (D-24752)', () => {
  it('T14: seats 1 and 3 each discard their chosen card in ascending seat order', () => {
    const G = makeState({
      '1': { hand: ['h1a', 'h1b'] },
      '3': { hand: ['h3a'] },
    });
    const choice = buildFallenIdolsDiscardChoice(G, ['1', '3'])!;
    assert.equal(choice.seatPrompts['1']!.options[1]!.label, 'Discard h1b');
    submit(choice, '3', 0);
    submit(choice, '1', 1);
    applyFallenIdolsDiscard(G, choice);
    assert.deepEqual(G.playerZones['1']!.hand, ['h1a']);
    assert.deepEqual(G.playerZones['1']!.discard, ['h1b']);
    assert.deepEqual(G.playerZones['3']!.hand, []);
    assert.deepEqual(G.playerZones['3']!.discard, ['h3a']);
    assert.deepEqual(
      G.messages.map((entry) => ({ text: entry.text, outcome: entry.outcome })),
      [
        { text: 'Player 1 discarded h1b (Fallen Idols).', outcome: 'applied' },
        { text: 'Player 3 discarded h3a (Fallen Idols).', outcome: 'applied' },
      ],
    );
  });

  it('T14: builds nothing when no given seat holds a card', () => {
    const G = makeState({ '1': { hand: [] } });
    assert.equal(buildFallenIdolsDiscardChoice(G, ['1']), undefined);
  });
});

// ---------------------------------------------------------------------------
// WP-821 / D-24754 — Arnim Zola's seat-choice appliers
// ---------------------------------------------------------------------------

import {
  applyComputerUploadedGeniusDiscard,
  applyCrushPacifistResistanceKo,
  applyDominateTheWeakGain,
  buildComputerUploadedGeniusDiscardChoice,
  buildCrushPacifistResistanceChoice,
  buildDominateTheWeakChoice,
  CRUSH_PACIFIST_RESISTANCE_KO_KIND,
} from './seatChoiceTactics.js';
import { resolveCardName } from '../log/logDisplay.js';

/**
 * Builds a Zola apply state: per-seat hands and played cards, an HQ and Hero Deck,
 * 4 Recruit, and the stats / names of the test cards.
 *
 * @param zonesBySeat - Each seat's hand and played cards.
 * @param board - The HQ and Hero Deck.
 * @returns A LegendaryGameState carrying only the fields the appliers read.
 */
function makeZolaApplyState(
  zonesBySeat: Record<string, { hand?: string[]; inPlay?: string[] }>,
  board: { hq?: (string | null)[]; heroDeck?: string[] } = {},
): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(zonesBySeat)) {
    const zones = zonesBySeat[seat]!;
    playerZones[seat] = {
      deck: [],
      hand: [...(zones.hand ?? [])],
      discard: [],
      inPlay: [...(zones.inPlay ?? [])],
      victory: [],
    };
  }
  return {
    playerZones,
    hq: [...(board.hq ?? [null, null, null, null, null])],
    heroDeck: [...(board.heroDeck ?? [])],
    ko: [],
    turnEconomy: { attack: 0, recruit: 4, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    cardStats: {
      hA: { attack: 1, cost: 3 },
      hB: { attack: 0, cost: 5 },
      'starting-shield-trooper': { attack: 1, cost: 0 },
    },
    cardDisplayData: { hA: { name: 'Hero Alpha' }, hB: { name: 'Hero Bravo' }, 'card-a': { name: 'Alpha' } },
    messages: [],
  } as unknown as LegendaryGameState;
}

describe('WP-821 Arnim Zola seat-choice appliers (D-24754)', () => {
  it('T11: the chosen recipient gains the HQ Hero to their discard, the slot refills, and no Recruit is spent', () => {
    const G = makeZolaApplyState(
      { '0': {}, '1': {}, '2': {} },
      { hq: ['hA', 'hB', 'hC', null, 'hD'], heroDeck: ['d1'] },
    );
    const choice = buildDominateTheWeakChoice(G, '1', [0, 1]);
    assert.equal(choice.seatPrompts['1']!.options[1]!.label, `Player 1 gains ${resolveCardName(G.cardDisplayData, 'hA')}`);
    choice.submissions['1'] = { optionIndex: 1 };

    applyDominateTheWeakGain(G, choice);

    assert.equal(G.hq[0], 'd1', 'hA left slot 0 and the slot refilled');
    assert.deepEqual(G.heroDeck, []);
    assert.deepEqual(G.playerZones['1']!.discard, ['hA']);
    assert.equal(G.turnEconomy.recruit, 4, 'no Recruit is spent');
    assert.deepEqual(G.messages, [
      { text: `Player 1 gained ${resolveCardName(G.cardDisplayData, 'hA')} from the HQ (Dominate the Weak).`, outcome: 'applied' },
    ]);
  });

  it('T12: each addressed seat discards its pick through discardFromHand, in ascending seat order', () => {
    const G = makeZolaApplyState({
      '0': {},
      '2': { hand: ['card-a', 'card-b'] },
      '4': { hand: ['card-c'] },
    });
    const choice = buildComputerUploadedGeniusDiscardChoice(G, ['2', '4'])!;
    choice.submissions['4'] = { optionIndex: 0 };
    choice.submissions['2'] = { optionIndex: 1 };

    applyComputerUploadedGeniusDiscard(G, choice);

    assert.deepEqual(G.playerZones['2']!.hand, ['card-a']);
    assert.deepEqual(G.playerZones['2']!.discard, ['card-b']);
    assert.deepEqual(G.playerZones['4']!.hand, []);
    assert.deepEqual(G.playerZones['4']!.discard, ['card-c']);
    assert.deepEqual(G.messages.map((entry) => entry.text), [
      `Player 2 discarded ${resolveCardName(G.cardDisplayData, 'card-b')} (Computer-Uploaded Genius).`,
      `Player 4 discarded ${resolveCardName(G.cardDisplayData, 'card-c')} (Computer-Uploaded Genius).`,
    ]);
  });

  it('T13: a KO reads the option\'s zone exactly, and "KO nothing" moves nothing', () => {
    const G = makeZolaApplyState({
      '0': { hand: ['starting-shield-trooper'], inPlay: ['starting-shield-trooper'] },
    });
    const choice = buildCrushPacifistResistanceChoice(G, '0', CRUSH_PACIFIST_RESISTANCE_KO_KIND)!;
    const inPlayIndex = choice.seatPrompts['0']!.options.findIndex((option) => option.sourceZone === 'inPlay');
    choice.submissions['0'] = { optionIndex: inPlayIndex };

    applyCrushPacifistResistanceKo(G, choice);

    assert.deepEqual(G.playerZones['0']!.inPlay, [], 'the played copy is KOd');
    assert.deepEqual(G.playerZones['0']!.hand, ['starting-shield-trooper'], 'the hand copy is kept');
    assert.deepEqual(G.ko, ['starting-shield-trooper']);
    assert.deepEqual(G.messages, [
      {
        text: `Player 0 KO'd ${resolveCardName(G.cardDisplayData, 'starting-shield-trooper')} from the cards they played this turn (Crush Pacifist Resistance).`,
        outcome: 'applied',
      },
    ]);

    const declined = buildCrushPacifistResistanceChoice(G, '0', CRUSH_PACIFIST_RESISTANCE_KO_KIND)!;
    declined.submissions['0'] = { optionIndex: declined.seatPrompts['0']!.options.length - 1 };
    applyCrushPacifistResistanceKo(G, declined);

    assert.deepEqual(G.playerZones['0']!.hand, ['starting-shield-trooper'], 'nothing moves on a decline');
    assert.deepEqual(G.ko, ['starting-shield-trooper']);
    assert.deepEqual(G.messages[1], {
      text: 'Player 0 chose not to KO a Hero (Crush Pacifist Resistance).',
      outcome: 'neutral',
    });
  });
});

// ---------------------------------------------------------------------------
// WP-758 / D-24588 — Zarathos builders
// ---------------------------------------------------------------------------

import {
  buildZarathosCorruptedSpiritChoice,
  buildZarathosDemonicEssenceChoice,
  buildZarathosEruptionChoice,
  buildZarathosImprisonChoice,
  listZarathosHandHeroesByCost,
  ZARATHOS_DEMONIC_ESSENCE_LAST_KIND,
} from './seatChoiceTactics.js';

/** A one- or two-seat G with the test Heroes' stats, traits and Villain types. */
function makeZarathosBuilderState(
  zonesBySeat: Record<string, { hand?: string[]; inPlay?: string[]; victory?: string[] }>,
): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const seat of Object.keys(zonesBySeat)) {
    const zones = zonesBySeat[seat]!;
    playerZones[seat] = {
      deck: [],
      hand: [...(zones.hand ?? [])],
      discard: [],
      inPlay: [...(zones.inPlay ?? [])],
      victory: [...(zones.victory ?? [])],
    };
  }
  return {
    playerZones,
    piles: { bystanders: [], wounds: ['pile-wound'] },
    messages: [],
    mastermind: { tacticsDefeated: [], baseCardId: 'mdns-mastermind-zarathos-zarathos' },
    villainDeckCardTypes: { villainA: 'villain', killbotA: 'villain' },
    convertedVillainOrigins: { killbotA: 'killbot' },
    cardStats: { covertA: { attack: 1, cost: 5 }, covertB: { attack: 1, cost: 2 }, techA: { attack: 1, cost: 1 } },
    cardTraits: {
      covertA: { heroClass: 'covert', team: null },
      covertB: { heroClass: 'covert', team: null },
      techA: { heroClass: 'tech', team: null },
    },
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

describe('WP-758 Zarathos seat-choice builders (D-24588)', () => {
  it('lists matching hand Heroes ascending by cost, hand order on a tie, each id once', () => {
    const G = makeZarathosBuilderState({ '0': { hand: ['covertA', 'techA', 'covertB', 'covertA'] } });
    assert.deepEqual(listZarathosHandHeroesByCost(G, '0', ['covert', 'ranged']), ['covertB', 'covertA']);
  });

  it('the multi-seat builders return undefined when no seat holds a matching Hero', () => {
    const G = makeZarathosBuilderState({ '0': { hand: ['techA'] }, '1': { hand: ['techA', 'techA', 'techA', 'techA'] } });
    assert.equal(buildZarathosEruptionChoice(G, ['0', '1'], ['covert', 'ranged']), undefined);
    assert.equal(buildZarathosCorruptedSpiritChoice(G, ['0', '1'], ['instinct', 'covert']), undefined);
  });

  it('Imprison excludes a defeated Killbot (a Bystander in the Victory Pile)', () => {
    const G = makeZarathosBuilderState({ '0': { victory: ['killbotA', 'villainA'] } });
    const choice = buildZarathosImprisonChoice(G, '0') as PendingSeatChoice;
    assert.deepEqual(choice.seatPrompts['0']!.options.map((option) => option.cardId), ['villainA', undefined]);
  });

  it('Demonic lists each (zone, id) once and skips Wounds and Bystanders; nothing to KO → undefined', () => {
    const G = makeZarathosBuilderState({
      '0': { hand: ['covertA', 'covertA', 'pile-wound', 'pile-bystander'], inPlay: ['covertA'] },
    });
    const choice = buildZarathosDemonicEssenceChoice(G, '0', ZARATHOS_DEMONIC_ESSENCE_LAST_KIND) as PendingSeatChoice;
    assert.deepEqual(
      choice.seatPrompts['0']!.options.map((option) => [option.cardId, option.sourceZone]),
      [['covertA', 'hand'], ['covertA', 'inPlay'], [undefined, undefined]],
    );
    const empty = makeZarathosBuilderState({ '0': { hand: ['pile-wound'] } });
    assert.equal(buildZarathosDemonicEssenceChoice(empty, '0', ZARATHOS_DEMONIC_ESSENCE_LAST_KIND), undefined);
  });
});

// ---------------------------------------------------------------------------
// WP-882 / D-24833 — Corrupted Spirit's discard-down builder, payload and reader
// ---------------------------------------------------------------------------

import {
  buildZarathosDiscardDownChoice,
  readZarathosDiscardDownSeats,
  ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND,
} from './seatChoiceTactics.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { buildUIState } from '../ui/uiState.build.js';
import { filterUIStateForAudience } from '../ui/uiState.filter.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';
import type { UIAudience } from '../ui/uiAudience.types.js';

/** The card ids a seat's options name, in option order. */
function optionCardIds(choice: PendingSeatChoice, seat: string): (string | undefined)[] {
  const cardIds: (string | undefined)[] = [];
  for (const option of choice.seatPrompts[seat]?.options ?? []) {
    cardIds.push(option.cardId);
  }
  return cardIds;
}

describe('WP-882 Corrupted Spirit discard-down builder (D-24833)', () => {
  it('lists the hand in selectDiscardToLimitCards order, one option per distinct id; a Wound and a starter read cost 0; default 0', () => {
    const G = makeZarathosBuilderState({
      '1': { hand: ['covertA', 'techA', 'pile-wound', 'covertB', 'starter', 'covertA', 'techA'] },
    });
    const choice = buildZarathosDiscardDownChoice(G, ['1']) as PendingSeatChoice;
    assert.equal(choice.kind, ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND);
    assert.deepEqual(choice.addressedSeats, ['1']);
    assert.deepEqual(optionCardIds(choice, '1'), ['pile-wound', 'starter', 'techA', 'covertB', 'covertA']);
    assert.equal(choice.seatPrompts['1']!.options[0]!.label, 'Discard pile-wound');
    assert.equal(choice.defaultOptionIndex, 0);
  });

  it('leaves out seats with 3 or fewer cards, addresses the rest ascending, and is undefined when none remains', () => {
    const G = makeZarathosBuilderState({
      '1': { hand: ['techA', 'techA', 'techA'] },
      '2': { hand: ['techA', 'techA', 'techA', 'techA'] },
      '3': { hand: ['covertA', 'covertA', 'covertA', 'covertA', 'covertA'] },
    });
    assert.deepEqual(buildZarathosDiscardDownChoice(G, ['3', '1', '2'])!.addressedSeats, ['2', '3']);
    assert.equal(buildZarathosDiscardDownChoice(G, ['1']), undefined);
    assert.equal(buildZarathosDiscardDownChoice(G, []), undefined);
  });

  it('the Corrupted Spirit payload is absent with no forced seat, sorted when present, and never stamped on an undefined choice', () => {
    const G = makeZarathosBuilderState({
      '1': { hand: ['covertA', 'techA', 'techA', 'techA'] },
      '2': { hand: ['techA', 'techA', 'techA', 'techA'] },
    });
    const plain = buildZarathosCorruptedSpiritChoice(G, ['1'], ['instinct', 'covert']) as PendingSeatChoice;
    assert.equal('zarathosDiscardDownSeats' in plain, false, 'no key at all (AC-4)');
    const emptyList = buildZarathosCorruptedSpiritChoice(G, ['1'], ['instinct', 'covert'], []) as PendingSeatChoice;
    assert.equal('zarathosDiscardDownSeats' in emptyList, false);
    const carried = buildZarathosCorruptedSpiritChoice(G, ['1'], ['instinct', 'covert'], ['3', '2']) as PendingSeatChoice;
    assert.deepEqual(carried.zarathosDiscardDownSeats, ['2', '3']);
    assert.equal(buildZarathosCorruptedSpiritChoice(G, ['2'], ['instinct', 'covert'], ['3']), undefined, 'no chooser → undefined');
  });

  it('the reader returns the payload plus the seats that chose discard-down, deduped and sorted; a Hero-discarder is excluded', () => {
    const G = makeZarathosBuilderState({
      '1': { hand: ['covertA', 'techA', 'techA', 'techA', 'techA'] },
      '2': { hand: ['covertB', 'techA', 'techA', 'techA'] },
      '3': { hand: ['covertA', 'techA', 'techA', 'techA'] },
    });
    const choice = buildZarathosCorruptedSpiritChoice(G, ['1', '2', '3'], ['instinct', 'covert'], ['4', '3']) as PendingSeatChoice;
    choice.submissions['1'] = { optionIndex: 0 };
    choice.submissions['2'] = { optionIndex: 1 };
    choice.submissions['3'] = { optionIndex: 1 };
    assert.deepEqual(readZarathosDiscardDownSeats(choice), ['2', '3', '4']);
  });

  it('AC-4: zarathosDiscardDownSeats never appears in any audience\'s UIState', () => {
    const gameState = buildInitialGameState(
      {
        schemeId: 'test-scheme-001',
        mastermindId: 'test-mastermind-001',
        villainGroupIds: ['test-villain-group-001'],
        henchmanGroupIds: ['test-henchman-group-001'],
        heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
        bystandersCount: 10,
        woundsCount: 15,
        officersCount: 20,
        sidekicksCount: 5,
      },
      { ...makeCardRegistryReader(), listCards: () => [] },
      makeMockCtx(),
    );
    gameState.pendingSeatChoice = {
      kind: 'zarathos-corrupted-spirit',
      addressedSeats: ['0'],
      seatPrompts: { '0': { options: [{ label: 'Discard Covert Hero', cardId: 'covertA' }, { label: 'Discard down to 3 cards' }] } },
      submissions: {},
      defaultOptionIndex: 0,
      zarathosDiscardDownSeats: ['1'],
    };
    const uiState = buildUIState(gameState, { phase: 'play', turn: 1, currentPlayer: '0' });
    const audiences: UIAudience[] = [
      { kind: 'player', playerId: '0' },
      { kind: 'player', playerId: '1' },
      { kind: 'spectator' },
    ];
    for (const audience of audiences) {
      const projected = JSON.stringify(filterUIStateForAudience(uiState, audience));
      assert.equal(projected.includes('zarathosDiscardDownSeats'), false, `audience ${JSON.stringify(audience)}`);
    }
    assert.ok(JSON.stringify(uiState).includes('zarathos-corrupted-spirit'), 'the choice itself is projected (the test is live)');
  });
});
