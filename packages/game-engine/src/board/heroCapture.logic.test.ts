/**
 * Tests for hero capture helpers (WP-214).
 *
 * Covers captureHeroFromHq (all three selectors), awardAttachedHeroes,
 * and moveAttachedHeroesToEscapedPile. Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import {
  captureHeroFromHq,
  awardAttachedHeroes,
  moveAttachedHeroesToEscapedPile,
  attachCapturedHero,
  captureHeroFromHqSlot,
  selectCapturedHeroToGain,
  awardOneAttachedHeroRestToBottom,
} from './heroCapture.logic.js';

/**
 * Builds a minimal G suitable for heroCapture.logic tests.
 * Only the fields read by the capture helpers are populated.
 */
function makeG(options: {
  hq?: (CardExtId | null)[];
  heroDeck?: CardExtId[];
  cardStats?: Record<string, { cost: number }>;
  villainAttachedHeroes?: Record<string, CardExtId[]>;
  playerZones?: Record<string, { discard: CardExtId[] }>;
  ko?: CardExtId[];
  escapedPile?: CardExtId[];
}): LegendaryGameState {
  const hqSlots = options.hq ?? [null, null, null, null, null];
  return {
    hq: hqSlots as LegendaryGameState['hq'],
    heroDeck: options.heroDeck ?? [],
    cardStats: options.cardStats ?? {},
    villainAttachedHeroes: options.villainAttachedHeroes ?? {},
    playerZones: options.playerZones ?? {},
    ko: options.ko ?? [],
    escapedPile: options.escapedPile ?? [],
  } as unknown as LegendaryGameState;
}

// ---------------------------------------------------------------------------
// captureHeroFromHq — rightmost selector
// ---------------------------------------------------------------------------

describe('captureHeroFromHq — rightmost selector', () => {
  it('returns null when all HQ slots are null (safe no-op)', () => {
    const G = makeG({ hq: [null, null, null, null, null] });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    assert.equal(result, null);
    assert.deepStrictEqual(G.villainAttachedHeroes, {});
  });

  it('captures the rightmost non-null slot', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, null, 'h2' as CardExtId, null, 'h4' as CardExtId],
      heroDeck: [],
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    assert.ok(result !== null);
    assert.equal(result.capturedHeroId, 'h4');
    assert.equal(result.hqIndex, 4);
    assert.equal(G.villainAttachedHeroes['villain-a']?.[0], 'h4');
    assert.equal(G.hq[4], null);
  });

  it('skips null gaps — captures rightmost non-null with gaps', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, null, 'h2' as CardExtId, null, null],
      heroDeck: [],
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    assert.ok(result !== null);
    assert.equal(result.capturedHeroId, 'h2');
    assert.equal(result.hqIndex, 2);
  });

  it('captures single hero from HQ regardless of selector', () => {
    const G = makeG({
      hq: [null, null, 'h2' as CardExtId, null, null],
      heroDeck: [],
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    assert.ok(result !== null);
    assert.equal(result.capturedHeroId, 'h2');
  });

  it('refills the HQ slot from the hero deck', () => {
    const G = makeG({
      hq: [null, null, null, null, 'h4' as CardExtId],
      heroDeck: ['refill-hero' as CardExtId, 'extra' as CardExtId],
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    assert.ok(result !== null);
    assert.equal(result.refilledHeroId, 'refill-hero');
    assert.equal(G.hq[4], 'refill-hero');
    assert.deepStrictEqual(G.heroDeck, ['extra']);
  });

  it('leaves HQ slot null when hero deck is empty', () => {
    const G = makeG({
      hq: [null, null, null, null, 'h4' as CardExtId],
      heroDeck: [],
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    assert.ok(result !== null);
    assert.equal(result.refilledHeroId, null);
    assert.equal(G.hq[4], null);
  });

  it('appends to existing villain attachment list', () => {
    const G = makeG({
      hq: [null, null, null, null, 'h4' as CardExtId],
      heroDeck: [],
      villainAttachedHeroes: { 'villain-a': ['h-existing' as CardExtId] },
    });
    captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    assert.deepStrictEqual(G.villainAttachedHeroes['villain-a'], ['h-existing', 'h4']);
  });
});

// ---------------------------------------------------------------------------
// captureHeroFromHq — highestCost selector
// ---------------------------------------------------------------------------

describe('captureHeroFromHq — highestCost selector', () => {
  it('captures the highest-cost hero', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, 'h1' as CardExtId, 'h2' as CardExtId, null, null],
      heroDeck: [],
      cardStats: {
        h0: { cost: 3 },
        h1: { cost: 7 },
        h2: { cost: 2 },
      },
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'highestCost');
    assert.ok(result !== null);
    assert.equal(result.capturedHeroId, 'h1');
    assert.equal(result.hqIndex, 1);
  });

  it('ties broken by rightmost index — both same cost → rightmost wins', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, 'h1' as CardExtId, 'h2' as CardExtId, null, null],
      heroDeck: [],
      cardStats: {
        h0: { cost: 5 },
        h1: { cost: 5 },
        h2: { cost: 5 },
      },
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'highestCost');
    assert.ok(result !== null);
    assert.equal(result.capturedHeroId, 'h2');
    assert.equal(result.hqIndex, 2);
  });

  it('treats missing cardStats as cost 0', () => {
    const G = makeG({
      hq: ['h-nocost' as CardExtId, 'h-costed' as CardExtId, null, null, null],
      heroDeck: [],
      cardStats: { 'h-costed': { cost: 4 } },
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'highestCost');
    assert.ok(result !== null);
    assert.equal(result.capturedHeroId, 'h-costed');
  });
});

// ---------------------------------------------------------------------------
// captureHeroFromHq — lowestCost selector
// ---------------------------------------------------------------------------

describe('captureHeroFromHq — lowestCost selector', () => {
  it('captures the lowest-cost hero', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, 'h1' as CardExtId, 'h2' as CardExtId, null, null],
      heroDeck: [],
      cardStats: {
        h0: { cost: 3 },
        h1: { cost: 7 },
        h2: { cost: 1 },
      },
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'lowestCost');
    assert.ok(result !== null);
    assert.equal(result.capturedHeroId, 'h2');
    assert.equal(result.hqIndex, 2);
  });

  it('ties broken by rightmost index — both same cost → rightmost wins', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, null, 'h2' as CardExtId, null, null],
      heroDeck: [],
      cardStats: {
        h0: { cost: 2 },
        h2: { cost: 2 },
      },
    });
    const result = captureHeroFromHq(G, 'villain-a' as CardExtId, 'lowestCost');
    assert.ok(result !== null);
    assert.equal(result.capturedHeroId, 'h2');
    assert.equal(result.hqIndex, 2);
  });
});

// ---------------------------------------------------------------------------
// State integrity after capture
// ---------------------------------------------------------------------------

describe('captureHeroFromHq — state integrity', () => {
  it('captured hero is removed from G.hq before refill', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, null, null, null, null],
      heroDeck: [],
    });
    captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    // Slot 0 should be null (refill with empty deck)
    assert.equal(G.hq[0], null);
    // Hero should be in attached heroes
    assert.deepStrictEqual(G.villainAttachedHeroes['villain-a'], ['h0']);
  });

  it('captured hero appears in villainAttachedHeroes for the correct villain', () => {
    const G = makeG({
      hq: [null, null, null, null, 'h4' as CardExtId],
      heroDeck: [],
    });
    captureHeroFromHq(G, 'villain-b' as CardExtId, 'rightmost');
    assert.deepStrictEqual(G.villainAttachedHeroes['villain-b'], ['h4']);
    assert.equal(G.villainAttachedHeroes['villain-a'], undefined);
  });

  it('no duplicate ext_ids across hq + villainAttachedHeroes + heroDeck after capture', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, null, null, null, 'h4' as CardExtId],
      heroDeck: ['deck-top' as CardExtId],
    });
    captureHeroFromHq(G, 'villain-a' as CardExtId, 'rightmost');
    // h4 captured → in villainAttachedHeroes, not in hq
    // deck-top → refilled into hq[4]
    const allHqIds = G.hq.filter(Boolean);
    const attachedIds = G.villainAttachedHeroes['villain-a'] ?? [];
    const deckIds = G.heroDeck;
    const allIds = [...allHqIds, ...attachedIds, ...deckIds];
    const unique = new Set(allIds);
    assert.equal(allIds.length, unique.size, 'no duplicate ext_ids');
  });
});

// ---------------------------------------------------------------------------
// awardAttachedHeroes — fight lifecycle
// ---------------------------------------------------------------------------

describe('awardAttachedHeroes — fight lifecycle', () => {
  it('moves captured heroes to player discard pile', () => {
    const G = makeG({
      villainAttachedHeroes: { 'villain-a': ['h1' as CardExtId, 'h2' as CardExtId] },
      playerZones: { '0': { discard: [] } },
    });
    awardAttachedHeroes(G, 'villain-a' as CardExtId, '0');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['h1', 'h2']);
  });

  it('deletes the villain entry after awarding (not set to [])', () => {
    const G = makeG({
      villainAttachedHeroes: { 'villain-a': ['h1' as CardExtId] },
      playerZones: { '0': { discard: [] } },
    });
    awardAttachedHeroes(G, 'villain-a' as CardExtId, '0');
    assert.equal(G.villainAttachedHeroes['villain-a'], undefined);
  });

  it('awards multiple heroes to player discard in order', () => {
    const G = makeG({
      villainAttachedHeroes: { 'villain-a': ['h1' as CardExtId, 'h2' as CardExtId, 'h3' as CardExtId] },
      playerZones: { '0': { discard: ['existing' as CardExtId] } },
    });
    awardAttachedHeroes(G, 'villain-a' as CardExtId, '0');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['existing', 'h1', 'h2', 'h3']);
  });

  it('no-op when villain has no attached heroes (backward compatible)', () => {
    const G = makeG({ playerZones: { '0': { discard: [] } } });
    awardAttachedHeroes(G, 'villain-a' as CardExtId, '0');
    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assert.deepStrictEqual(G.villainAttachedHeroes, {});
  });

  it('no-op when player zones are missing', () => {
    const G = makeG({
      villainAttachedHeroes: { 'villain-a': ['h1' as CardExtId] },
    });
    // Should not throw even without playerZones
    awardAttachedHeroes(G, 'villain-a' as CardExtId, 'nonexistent');
    // Hero remains attached (no zones to move to)
    assert.deepStrictEqual(G.villainAttachedHeroes['villain-a'], ['h1']);
  });
});

// ---------------------------------------------------------------------------
// moveAttachedHeroesToEscapedPile — escape lifecycle
// ---------------------------------------------------------------------------

describe('moveAttachedHeroesToEscapedPile — escape lifecycle', () => {
  // why: D-24657 — behavior intentionally changed. Rules v23 "Villains Escaping with
  // Captured Heroes": the captured Heroes stay in the Escape Pile; they are NOT KO'd.
  it('moves captured heroes to the Escaped Villains pile, not the KO pile', () => {
    const G = makeG({
      villainAttachedHeroes: { 'villain-a': ['h1' as CardExtId, 'h2' as CardExtId] },
    });
    moveAttachedHeroesToEscapedPile(G, 'villain-a' as CardExtId);
    assert.deepStrictEqual(G.escapedPile, ['h1', 'h2']);
    assert.deepStrictEqual(G.ko, [], 'nothing is KO\'d');
  });

  it('deletes the villain entry after the move (not set to [])', () => {
    const G = makeG({
      villainAttachedHeroes: { 'villain-a': ['h1' as CardExtId] },
    });
    moveAttachedHeroesToEscapedPile(G, 'villain-a' as CardExtId);
    assert.equal(G.villainAttachedHeroes['villain-a'], undefined);
  });

  it('no-op when villain has no attached heroes (backward compatible)', () => {
    const G = makeG({ ko: ['existing-ko' as CardExtId], escapedPile: ['villain-a' as CardExtId] });
    moveAttachedHeroesToEscapedPile(G, 'villain-a' as CardExtId);
    assert.deepStrictEqual(G.ko, ['existing-ko']);
    assert.deepStrictEqual(G.escapedPile, ['villain-a']);
  });

  it('appends after the escaped villain already in the pile, leaving the KO pile untouched', () => {
    const G = makeG({
      villainAttachedHeroes: { 'villain-a': ['h1' as CardExtId] },
      ko: ['pre-existing-ko' as CardExtId],
      escapedPile: ['villain-a' as CardExtId],
    });
    moveAttachedHeroesToEscapedPile(G, 'villain-a' as CardExtId);
    assert.deepStrictEqual(G.escapedPile, ['villain-a', 'h1']);
    assert.deepStrictEqual(G.ko, ['pre-existing-ko']);
  });
});

// ---------------------------------------------------------------------------
// WP-838 / D-24771 — attach, per-slot capture and Venom's split award (T19-T21)
// ---------------------------------------------------------------------------

describe('WP-838 capture helpers (D-24771)', () => {
  const COSTS: Record<string, { cost: number }> = {
    'h-cost1': { cost: 1 },
    'h-cost2a': { cost: 2 },
    'h-cost2b': { cost: 2 },
    'pile-sidekick': { cost: 2 },
    'pile-shield-officer': { cost: 3 },
  };

  /**
   * A G with the supply piles the split award writes.
   */
  function makeSplitG(attached: CardExtId[] | undefined): LegendaryGameState {
    const G = makeG({
      cardStats: COSTS,
      heroDeck: ['deck-a' as CardExtId],
      villainAttachedHeroes: attached === undefined ? {} : { 'venom-01': attached },
      playerZones: { '0': { discard: [] } },
    });
    (G as unknown as { piles: { sidekicks: CardExtId[]; officers: CardExtId[] } }).piles = {
      sidekicks: ['pile-sidekick' as CardExtId],
      officers: [],
    };
    return G;
  }

  it('T19: captureHeroFromHqSlot captures and refills an occupied slot; an empty or out-of-range slot is null', () => {
    const G = makeG({
      hq: ['h0' as CardExtId, null, 'h2' as CardExtId, null, null],
      heroDeck: ['refill-1' as CardExtId],
    });
    const result = captureHeroFromHqSlot(G, 'venom-01' as CardExtId, 2);
    assert.deepStrictEqual(result, { capturedHeroId: 'h2', hqIndex: 2, refilledHeroId: 'refill-1' });
    assert.deepStrictEqual(G.villainAttachedHeroes['venom-01'], ['h2']);
    assert.deepStrictEqual(G.hq, ['h0', null, 'refill-1', null, null]);
    assert.equal(captureHeroFromHqSlot(G, 'venom-01' as CardExtId, 1), null);
    assert.equal(captureHeroFromHqSlot(G, 'venom-01' as CardExtId, 9), null);
    assert.deepStrictEqual(G.villainAttachedHeroes['venom-01'], ['h2'], 'null results write nothing');
  });

  it('T19: attachCapturedHero creates the entry, then appends', () => {
    const G = makeG({});
    attachCapturedHero(G, 'kid-01' as CardExtId, 'pile-shield-officer' as CardExtId);
    attachCapturedHero(G, 'kid-01' as CardExtId, 'pile-sidekick' as CardExtId);
    assert.deepStrictEqual(G.villainAttachedHeroes['kid-01'], ['pile-shield-officer', 'pile-sidekick']);
  });

  it('T20: selectCapturedHeroToGain ranks by cost, a Hero winning a tie with the Sidekick', () => {
    const G = makeG({ cardStats: COSTS });
    assert.equal(selectCapturedHeroToGain(G, ['pile-sidekick', 'h-cost2a', 'h-cost1'] as CardExtId[]), 1);
    assert.equal(selectCapturedHeroToGain(G, ['pile-sidekick', 'h-cost1'] as CardExtId[]), 0);
    assert.equal(selectCapturedHeroToGain(G, ['h-cost2a', 'h-cost2b'] as CardExtId[]), 0);
    assert.equal(selectCapturedHeroToGain(G, ['pile-sidekick'] as CardExtId[]), 0);
    assert.equal(selectCapturedHeroToGain(G, []), -1);
  });

  it('T21: awardOneAttachedHeroRestToBottom gains one and bottoms the rest in capture order', () => {
    const G = makeSplitG(['pile-sidekick', 'h-cost2a', 'h-cost1'] as CardExtId[]);
    const outcome = awardOneAttachedHeroRestToBottom(G, 'venom-01' as CardExtId, '0');
    assert.deepStrictEqual(outcome, {
      gainedHeroId: 'h-cost2a',
      returnedToBottom: [
        { heroId: 'pile-sidekick', deck: 'sidekick-deck' },
        { heroId: 'h-cost1', deck: 'hero-deck' },
      ],
    });
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['h-cost2a']);
    assert.deepStrictEqual(G.heroDeck, ['deck-a', 'h-cost1']);
    assert.deepStrictEqual(G.piles.sidekicks, ['pile-sidekick', 'pile-sidekick']);
    assert.equal(Object.hasOwn(G.villainAttachedHeroes, 'venom-01'), false, 'the entry is deleted (D-21401)');
  });

  it('T21: an Officer returns to the Officer Deck; no entry writes nothing', () => {
    const G = makeSplitG(['pile-shield-officer', 'h-cost1'] as CardExtId[]);
    const outcome = awardOneAttachedHeroRestToBottom(G, 'venom-01' as CardExtId, '0');
    assert.equal(outcome.gainedHeroId, 'pile-shield-officer');
    assert.deepStrictEqual(G.heroDeck, ['deck-a', 'h-cost1']);

    const emptyG = makeSplitG(undefined);
    const before = structuredClone(emptyG);
    assert.deepStrictEqual(awardOneAttachedHeroRestToBottom(emptyG, 'venom-01' as CardExtId, '0'), {
      gainedHeroId: null,
      returnedToBottom: [],
    });
    assert.deepStrictEqual(emptyG, before);
  });
});
