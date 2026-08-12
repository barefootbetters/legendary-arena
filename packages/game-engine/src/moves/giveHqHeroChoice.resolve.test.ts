/**
 * Tests for the resolveGiveHqHeroChoice move (WP-532 / D-24343), the
 * hasPendingGiveHqHeroChoice predicate, and the getEligibleGiveHqHeroCards /
 * selectDefaultGiveHqHeroCard helpers shared by the UIState projection + bot default.
 *
 * Covers: resolve a chosen HQ Hero into the chooser's discard + HQ refill + front-pop;
 * invalid / stale / wrong-player targets are silent no-ops with the queue intact;
 * eligibility gated on the front chooser; the highest-cost (rightmost tie) bot default.
 *
 * Uses node:test + node:assert only. No registry imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveGiveHqHeroChoice,
  hasPendingGiveHqHeroChoice,
  getEligibleGiveHqHeroCards,
  selectDefaultGiveHqHeroCard,
} from './giveHqHeroChoice.resolve.js';
import type { LegendaryGameState, PendingGiveHqHeroChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

/**
 * Builds a minimal LegendaryGameState exercising only the fields the move + helpers
 * read (pending queue, HQ, heroDeck, player zones, display/messages).
 */
function makeG(options: {
  hq?: (CardExtId | null)[];
  heroDeck?: CardExtId[];
  pending?: PendingGiveHqHeroChoice[];
  discard0?: CardExtId[];
  cardStats?: Record<string, { cost: number }>;
}): LegendaryGameState {
  return {
    hq: (options.hq ?? [null, null, null, null, null]) as LegendaryGameState['hq'],
    heroDeck: options.heroDeck ?? [],
    ...(options.pending !== undefined ? { pendingGiveHqHeroChoices: options.pending } : {}),
    playerZones: {
      '0': { deck: [], hand: [], discard: options.discard0 ?? [], inPlay: [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    cardStats: options.cardStats ?? {},
    cardDisplayData: {},
    messages: [],
  } as unknown as LegendaryGameState;
}

const CHOICE: PendingGiveHqHeroChoice = { choiceType: 'give-hq-hero', playerID: '0' };

describe('hasPendingGiveHqHeroChoice', () => {
  it('true only when the queue holds an entry', () => {
    assert.equal(hasPendingGiveHqHeroChoice(makeG({})), false);
    assert.equal(hasPendingGiveHqHeroChoice(makeG({ pending: [] })), false);
    assert.equal(hasPendingGiveHqHeroChoice(makeG({ pending: [CHOICE] })), true);
  });
});

describe('getEligibleGiveHqHeroCards', () => {
  it('returns the non-null HQ occupants in slot order for the front chooser', () => {
    const G = makeG({ hq: ['h0', null, 'h2', null, 'h4'] as CardExtId[], pending: [CHOICE] });
    assert.deepStrictEqual(getEligibleGiveHqHeroCards(G, '0'), ['h0', 'h2', 'h4']);
  });

  it('returns [] when it is not this player’s choice or nothing is pending', () => {
    const G = makeG({ hq: ['h0'] as CardExtId[], pending: [CHOICE] });
    assert.deepStrictEqual(getEligibleGiveHqHeroCards(G, '1'), [], 'not the front chooser');
    assert.deepStrictEqual(getEligibleGiveHqHeroCards(makeG({ hq: ['h0'] as CardExtId[] }), '0'), [], 'no pending');
  });
});

describe('selectDefaultGiveHqHeroCard (bot default)', () => {
  it('picks the highest-cost HQ Hero, ties → rightmost', () => {
    const G = makeG({
      hq: ['h0', 'h1', 'h2', null, 'h4'] as CardExtId[],
      pending: [CHOICE],
      cardStats: { h0: { cost: 5 }, h1: { cost: 7 }, h2: { cost: 7 }, h4: { cost: 2 } },
    });
    // h1 and h2 tie at 7 → rightmost is h2 (index 2).
    assert.equal(selectDefaultGiveHqHeroCard(G, '0'), 'h2');
  });

  it('null when not the front chooser or the HQ is empty', () => {
    const G = makeG({ hq: ['h0'] as CardExtId[], pending: [CHOICE], cardStats: { h0: { cost: 1 } } });
    assert.equal(selectDefaultGiveHqHeroCard(G, '1'), null);
    assert.equal(selectDefaultGiveHqHeroCard(makeG({ pending: [CHOICE] }), '0'), null);
  });
});

describe('resolveGiveHqHeroChoice', () => {
  it('moves the chosen HQ Hero into the chooser’s discard, refills the slot, and front-pops', () => {
    const G = makeG({
      hq: ['h0', 'h1', null, null, null] as CardExtId[],
      heroDeck: ['r0'] as CardExtId[],
      pending: [CHOICE],
    });
    resolveGiveHqHeroChoice({ G, playerID: '0' } as never, { cardId: 'h1' as CardExtId });
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['h1'], 'chosen Hero gained to discard (D-24327)');
    assert.deepStrictEqual(G.playerZones['0']!.victory, [], 'never the victory pile');
    assert.equal(G.hq[1], 'r0', 'vacated slot refilled from heroDeck');
    assert.deepStrictEqual(G.heroDeck, [], 'heroDeck reservoir popped');
    assert.equal(G.pendingGiveHqHeroChoices?.length, 0, 'front-popped (each entry owes one Hero)');
  });

  it('leaves the slot null when the heroDeck reservoir is empty', () => {
    const G = makeG({ hq: [null, null, 'h2', null, null] as CardExtId[], heroDeck: [], pending: [CHOICE] });
    resolveGiveHqHeroChoice({ G, playerID: '0' } as never, { cardId: 'h2' as CardExtId });
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['h2']);
    assert.equal(G.hq[2], null, 'empty reservoir leaves the slot null');
    assert.equal(G.pendingGiveHqHeroChoices?.length, 0);
  });

  it('no-op (queue intact) when the chosen cardId is not in the HQ', () => {
    const G = makeG({ hq: ['h0', null, null, null, null] as CardExtId[], pending: [CHOICE] });
    resolveGiveHqHeroChoice({ G, playerID: '0' } as never, { cardId: 'not-in-hq' as CardExtId });
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'no gain');
    assert.equal(G.hq[0], 'h0', 'HQ unchanged');
    assert.equal(G.pendingGiveHqHeroChoices?.length, 1, 'queue intact so the player can resubmit');
  });

  it('no-op when the caller is not the front entry’s player', () => {
    const G = makeG({ hq: ['h0', null, null, null, null] as CardExtId[], pending: [CHOICE] });
    resolveGiveHqHeroChoice({ G, playerID: '1' } as never, { cardId: 'h0' as CardExtId });
    assert.equal(G.hq[0], 'h0', 'HQ unchanged');
    assert.equal(G.pendingGiveHqHeroChoices?.length, 1, 'front entry belongs to player 0');
  });

  it('no-op on an empty queue and on an empty cardId', () => {
    const empty = makeG({ hq: ['h0', null, null, null, null] as CardExtId[] });
    assert.doesNotThrow(() => resolveGiveHqHeroChoice({ G: empty, playerID: '0' } as never, { cardId: 'h0' as CardExtId }));
    assert.equal(empty.hq[0], 'h0', 'no queue → no-op');
    const G = makeG({ hq: ['h0', null, null, null, null] as CardExtId[], pending: [CHOICE] });
    resolveGiveHqHeroChoice({ G, playerID: '0' } as never, { cardId: '' as CardExtId });
    assert.equal(G.pendingGiveHqHeroChoices?.length, 1, 'empty cardId → no-op, queue intact');
  });
});
