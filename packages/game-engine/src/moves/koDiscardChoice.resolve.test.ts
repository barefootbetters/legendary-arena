/**
 * Tests for the KO-from-discard vertical (WP-693 / EC-730 / D-24510): the
 * eligibility predicate, hasPendingKoDiscardChoice, and the resolveKoDiscardChoice
 * move (0/3/4/over-cap/repeated-id multiset/absent/wrong-player/empty-queue).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEligibleKoDiscardCards,
  hasPendingKoDiscardChoice,
  resolveKoDiscardChoice,
} from './koDiscardChoice.resolve.js';
import type { LegendaryGameState, PendingKoDiscardChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

interface MockGOptions {
  discard?: CardExtId[];
  ko?: CardExtId[];
  pending?: PendingKoDiscardChoice[];
}

/** Minimal state: resolveKoDiscardChoice reads only playerZones[pid].discard, G.ko, the queue, messages. */
function makeG(options?: MockGOptions): LegendaryGameState {
  return {
    messages: [],
    ko: [...(options?.ko ?? [])],
    playerZones: {
      '0': { deck: [], hand: [], discard: [...(options?.discard ?? [])], inPlay: [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    ...(options?.pending ? { pendingKoDiscardChoices: options.pending } : {}),
  } as unknown as LegendaryGameState;
}

/** A move context carrying only what resolveKoDiscardChoice reads (G + playerID). */
function makeContext(gameState: LegendaryGameState, playerID = '0') {
  return { G: gameState, playerID } as never;
}

/** A parked KO-from-discard choice for player 0 with cap 4. */
function parked(): PendingKoDiscardChoice[] {
  return [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 4 }];
}

describe('hasPendingKoDiscardChoice (WP-693 / D-24510)', () => {
  it('reflects the queue: undefined → false, empty → false, non-empty → true', () => {
    assert.equal(hasPendingKoDiscardChoice(makeG()), false);
    assert.equal(hasPendingKoDiscardChoice(makeG({ pending: [] })), false);
    assert.equal(hasPendingKoDiscardChoice(makeG({ pending: parked() })), true);
  });
});

describe('getEligibleKoDiscardCards (WP-693 / D-24510)', () => {
  it('returns the player discard in order, and a fresh copy (not the live array)', () => {
    const G = makeG({ discard: ['a', 'b', 'c'] });
    const eligible = getEligibleKoDiscardCards(G, '0');
    assert.deepStrictEqual(eligible, ['a', 'b', 'c']);
    eligible.push('x');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b', 'c'], 'the live discard is not mutated by the returned copy');
  });

  it('returns [] for an unknown player', () => {
    assert.deepStrictEqual(getEligibleKoDiscardCards(makeG(), '9'), []);
  });
});

describe('resolveKoDiscardChoice (WP-693 / D-24510)', () => {
  it('KO 0 (empty selection) is the legal "KO nothing" choice — pops the queue, KOs nothing', () => {
    const G = makeG({ discard: ['a', 'b'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: [] });
    assert.equal(hasPendingKoDiscardChoice(G), false, 'the empty selection still front-pops');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b'], 'nothing left the discard');
    assert.deepStrictEqual(G.ko, [], 'nothing was KO\'d');
  });

  it('KO 3 removes the chosen cards from discard and appends them to G.ko', () => {
    const G = makeG({ discard: ['a', 'b', 'c', 'd'], ko: ['pre'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'c', 'd'] });
    assert.equal(hasPendingKoDiscardChoice(G), false);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['b'], 'only unselected cards remain in discard');
    assert.deepStrictEqual(G.ko, ['pre', 'a', 'c', 'd'], 'the KO pile gains the chosen cards after any prior entry');
  });

  it('KO 4 (exactly the cap) is allowed', () => {
    const G = makeG({ discard: ['a', 'b', 'c', 'd', 'e'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'b', 'c', 'd'] });
    assert.equal(hasPendingKoDiscardChoice(G), false);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['e']);
    assert.deepStrictEqual(G.ko, ['a', 'b', 'c', 'd']);
  });

  it('OVER-CAP (5 > 4) is a silent no-op with the queue intact', () => {
    const G = makeG({ discard: ['a', 'b', 'c', 'd', 'e'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'b', 'c', 'd', 'e'] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'over-cap leaves the queue intact');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b', 'c', 'd', 'e'], 'discard untouched');
    assert.deepStrictEqual(G.ko, []);
  });

  it('D-24682: a repeated id KOs one copy per occurrence (two S.H.I.E.L.D. Agents share one id)', () => {
    // why: live report 2026-10-10 — Maniacal Tyrant let Jeff pick only one of several
    // S.H.I.E.L.D. Agents, because basic S.H.I.E.L.D. cards share one ext_id (D-24183) and the
    // old distinct-set rule (D-24510) rejected the id twice.
    const agent = 'starting-shield-agent' as CardExtId;
    const G = makeG({ discard: [agent, 'b', agent, agent], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: [agent, agent, 'b'] });
    assert.equal(hasPendingKoDiscardChoice(G), false, 'the multi-copy selection resolves');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [agent], 'one Agent stays; two Agents and b were KO\'d');
    assert.deepStrictEqual(G.ko, [agent, agent, 'b']);
  });

  it('D-24682: repeating an id more times than the discard holds copies is a silent no-op', () => {
    const G = makeG({ discard: ['a', 'b'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'a'] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'only one copy of a is held, so the queue stays intact');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b'], 'discard untouched');
    assert.deepStrictEqual(G.ko, []);
  });

  it('an ABSENT id (not in the discard) is a silent no-op with the queue and discard intact', () => {
    const G = makeG({ discard: ['a', 'b'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'zzz'] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'an absent id leaves the queue intact');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b'], 'discard fully restored on the invalid submission');
    assert.deepStrictEqual(G.ko, []);
  });

  it('a WRONG-PLAYER resolve (front.playerID !== playerID) is a silent no-op', () => {
    const G = makeG({ discard: ['a'], pending: parked() });
    resolveKoDiscardChoice(makeContext(G, '1'), { cardIds: ['a'] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'a non-owner resolve leaves the queue intact');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a']);
  });

  it('an EMPTY queue is a silent no-op (no throw)', () => {
    const G = makeG({ discard: ['a'] });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a'] });
    assert.equal(hasPendingKoDiscardChoice(G), false);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a'], 'nothing was KO\'d against an empty queue');
  });

  it('a non-array / non-string payload is a silent no-op', () => {
    const badArray = makeG({ discard: ['a'], pending: parked() });
    resolveKoDiscardChoice(makeContext(badArray), { cardIds: 'a' as never });
    assert.equal(hasPendingKoDiscardChoice(badArray), true, 'non-array cardIds leaves the queue intact');

    const badElement = makeG({ discard: ['a'], pending: parked() });
    resolveKoDiscardChoice(makeContext(badElement), { cardIds: [123 as never] });
    assert.equal(hasPendingKoDiscardChoice(badElement), true, 'a non-string element leaves the queue intact');
  });

  it('argless (undefined) and null submissions → no-op, never throw, queue intact', () => {
    const G = makeG({ discard: ['a', 'b'], pending: parked() });
    for (const badArgs of [undefined, null]) {
      assert.doesNotThrow(() => resolveKoDiscardChoice(makeContext(G), badArgs as never));
    }
    assert.equal(G.pendingKoDiscardChoices?.length, 1, 'the queue entry is still parked');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['a', 'b'], 'discard unchanged');
    assert.deepStrictEqual(G.ko, [], 'nothing KO\'d');
  });
});

// ---------------------------------------------------------------------------
// WP-760 / D-24589 — the resolve log names the parking card via sourceCardId
// ---------------------------------------------------------------------------

describe('resolveKoDiscardChoice — source naming (WP-760 / D-24589)', () => {
  it('names the source card from cardDisplayData when the entry carries sourceCardId (Salomé)', () => {
    const salome = 'mdns-villain-fallen-salom-sorceress-supreme-00' as CardExtId;
    const G = makeG({
      discard: ['a', 'b', 'c'] as CardExtId[],
      pending: [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 2, sourceCardId: salome }],
    });
    (G as { cardDisplayData?: unknown }).cardDisplayData = { [salome]: { name: 'Salomé, Sorceress Supreme' } };
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'c'] });
    assert.deepStrictEqual(G.ko, ['a', 'c']);
    const lastMessage = G.messages![G.messages!.length - 1]!;
    // why: D-24783 — the line names each KO'd card (no display entry → the raw ext-id).
    assert.equal(lastMessage.text, "Player 0 KO'd a (a), c (c) from their discard pile (Salomé, Sorceress Supreme).");
  });

  it('names Maniacal Tyrant as the source when no sourceCardId is set', () => {
    const G = makeG({ discard: ['a', 'b'] as CardExtId[], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a'] });
    const lastMessage = G.messages![G.messages!.length - 1]!;
    assert.equal(lastMessage.text, "Player 0 KO'd a (a) from their discard pile (Maniacal Tyrant).");
  });

  it('D-24783: an empty selection says "no cards"', () => {
    const G = makeG({ discard: ['a', 'b'] as CardExtId[], pending: parked() });
    resolveKoDiscardChoice(makeContext(G), { cardIds: [] });
    const lastMessage = G.messages![G.messages!.length - 1]!;
    assert.equal(lastMessage.text, "Player 0 KO'd no cards from their discard pile (Maniacal Tyrant).");
  });

  it('enforces the Salomé cap of 2 (a 3-card selection is rejected, queue intact)', () => {
    const salome = 'mdns-villain-fallen-salom-sorceress-supreme-00' as CardExtId;
    const G = makeG({
      discard: ['a', 'b', 'c'] as CardExtId[],
      pending: [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 2, sourceCardId: salome }],
    });
    resolveKoDiscardChoice(makeContext(G), { cardIds: ['a', 'b', 'c'] });
    assert.equal(hasPendingKoDiscardChoice(G), true);
    assert.deepStrictEqual(G.ko, []);
  });
});

describe('resolveKoDiscardChoice — WP-836 grey-Hero filter (D-24769)', () => {
  const AGENT = 'starting-shield-agent' as CardExtId;
  const OFFICER = 'pile-shield-officer' as CardExtId;
  const WOUND = 'pile-wound' as CardExtId;

  /** A grey-filtered choice (cap 2) over a discard holding a Wound, a classed Hero and grey Heroes. */
  function greyG(): LegendaryGameState {
    const G = makeG({
      discard: [WOUND, 'tech-a' as CardExtId, AGENT, AGENT, OFFICER],
      pending: [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 2, greyFilter: 'grey' }],
    });
    G.cardTraits = { 'tech-a': { heroClass: 'tech', team: null } } as LegendaryGameState['cardTraits'];
    return G;
  }

  it('T17: a Wound or a classed Hero is refused with the queue intact', () => {
    for (const cardIds of [[WOUND], ['tech-a' as CardExtId]]) {
      const G = greyG();
      const before = structuredClone(G);
      resolveKoDiscardChoice(makeContext(G), { cardIds });
      assert.deepStrictEqual(G, before, `${cardIds.join(',')} must be refused`);
    }
  });

  it('T17: two grey Agents are KOd and the entry pops; an empty pick pops too', () => {
    const G = greyG();
    resolveKoDiscardChoice(makeContext(G), { cardIds: [AGENT, AGENT] });
    assert.deepStrictEqual(G.ko, [AGENT, AGENT]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [WOUND, 'tech-a', OFFICER]);
    assert.equal(hasPendingKoDiscardChoice(G), false);
    const emptyG = greyG();
    resolveKoDiscardChoice(makeContext(emptyG), { cardIds: [] });
    assert.equal(hasPendingKoDiscardChoice(emptyG), false);
  });

  it("D-24783: the grey KO line names each KO'd card and the source", () => {
    const ymir = 'co2e-villain-enemies-of-asgard-ymir-frost-giant-king-00' as CardExtId;
    const G = greyG();
    G.pendingKoDiscardChoices![0]!.sourceCardId = ymir;
    (G as { cardDisplayData?: unknown }).cardDisplayData = {
      [AGENT]: { name: 'S.H.I.E.L.D. Agent' },
      [OFFICER]: { name: 'S.H.I.E.L.D. Officer' },
      [ymir]: { name: 'Ymir, Frost Giant King' },
    };
    resolveKoDiscardChoice(makeContext(G), { cardIds: [AGENT, OFFICER] });
    const lastMessage = G.messages![G.messages!.length - 1]!;
    assert.equal(
      lastMessage.text,
      "Player 0 KO'd S.H.I.E.L.D. Agent (starting-shield-agent), S.H.I.E.L.D. Officer (pile-shield-officer) from their discard pile (Ymir, Frost Giant King).",
    );
  });

  it('T17: the filtered eligible list keeps discard order and duplicates; unfiltered stays whole', () => {
    const G = greyG();
    assert.deepStrictEqual(getEligibleKoDiscardCards(G, '0', 'grey'), [AGENT, AGENT, OFFICER]);
    assert.deepStrictEqual(getEligibleKoDiscardCards(G, '0'), [WOUND, 'tech-a', AGENT, AGENT, OFFICER]);
  });

  it('T18 (WP-850 / D-24786): a card-instance filter is a multiset over the live discard', () => {
    const G = greyG();
    // why: one Agent named, two in the discard → one kept; an id absent from the discard
    // (missing) is never invented; the grey filter still applies on top (tech-a is not grey).
    const filter = [AGENT, 'tech-a' as CardExtId, 'missing' as CardExtId];
    assert.deepStrictEqual(getEligibleKoDiscardCards(G, '0', undefined, filter), ['tech-a', AGENT]);
    assert.deepStrictEqual(getEligibleKoDiscardCards(G, '0', 'grey', filter), [AGENT]);
    assert.deepStrictEqual(getEligibleKoDiscardCards(G, '0', undefined, [AGENT, AGENT, AGENT]), [AGENT, AGENT],
      'never more copies than the discard holds');
  });
});