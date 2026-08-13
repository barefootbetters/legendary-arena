/**
 * Tests for Rogue's Copy Powers (WP-535 / D-24345): the resolveCopyPowersChoice move,
 * the hasPendingCopyPowersChoice / getEligibleCopyPowersCards / selectDefaultCopyPowersCard
 * helpers, the buildCopyPowersTargets eligible-set builder, and the heroEffectCopyPowers
 * handler exercised end-to-end through executeHeroEffects.
 *
 * Covers: eligible = real in-play Heroes minus the copy-powers ext_id (ALL copies),
 * deduplicated; 0 → no-op, 1 → auto-copy, ≥2 → park; the copy RE-FIRES the chosen Hero's
 * ability (a copied draw-2 actually draws via the threaded ctx.random) and grants Copy
 * Powers the copied class via cardSizeChangingClasses; front-pop on success only; invalid
 * / stale / wrong-player targets are silent no-ops; two Copy Powers never target each
 * other (no copy-of-copy recursion).
 *
 * Uses node:test + node:assert + makeMockCtx only. No registry imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCopyPowersChoice,
  hasPendingCopyPowersChoice,
  getEligibleCopyPowersCards,
  selectDefaultCopyPowersCard,
} from './copyPowersChoice.resolve.js';
import {
  executeHeroEffects,
  buildCopyPowersTargets,
  applyCopyPowers,
  COPY_POWERS_EXT_ID,
} from '../hero/heroEffects.execute.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState, PendingCopyPowersChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';

const COPY = COPY_POWERS_EXT_ID; // 'core/rogue/copy-powers'
const GAMBIT = 'core/gambit/card-shark' as CardExtId; // a real Hero (has a heroClass)
const WOLVERINE = 'core/wolverine/keen-senses' as CardExtId; // a real Hero (draws)
const SHIELD_AGENT = 'starting-shield-agent' as CardExtId; // heroClass null (not a Hero)

/**
 * Builds a minimal LegendaryGameState exercising only the fields Copy Powers reads:
 * player zones, cardTraits (Hero-class discriminant), cardStats (bot cost), the pending
 * queue, heroAbilityHooks (for the re-fire), and the runtime dual-class map.
 */
function makeG(options: {
  inPlay0?: CardExtId[];
  deck0?: CardExtId[];
  hand0?: CardExtId[];
  pending?: PendingCopyPowersChoice[];
  cardTraits?: Record<string, { heroClass: string | null; team: string | null }>;
  cardStats?: Record<string, { cost: number }>;
  heroAbilityHooks?: HeroAbilityHook[];
  cardSizeChangingClasses?: Record<string, string[]>;
}): LegendaryGameState {
  return {
    playerZones: {
      '0': { deck: options.deck0 ?? [], hand: options.hand0 ?? [], discard: [], inPlay: options.inPlay0 ?? [], victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    ...(options.pending !== undefined ? { pendingCopyPowersChoices: options.pending } : {}),
    ...(options.cardSizeChangingClasses !== undefined ? { cardSizeChangingClasses: options.cardSizeChangingClasses } : {}),
    cardTraits: (options.cardTraits ?? {
      [COPY]: { heroClass: 'covert', team: null },
      [GAMBIT]: { heroClass: 'instinct', team: 'x-men' },
      [WOLVERINE]: { heroClass: 'instinct', team: 'x-men' },
      [SHIELD_AGENT]: { heroClass: null, team: null },
    }) as LegendaryGameState['cardTraits'],
    cardStats: (options.cardStats ?? {}) as LegendaryGameState['cardStats'],
    heroAbilityHooks: options.heroAbilityHooks ?? [],
    cardDisplayData: {},
    messages: [],
  } as unknown as LegendaryGameState;
}

const PENDING: PendingCopyPowersChoice = { choiceType: 'copy-powers', playerID: '0', sourceCardId: COPY };

describe('hasPendingCopyPowersChoice', () => {
  it('true only when the queue holds an entry', () => {
    assert.equal(hasPendingCopyPowersChoice(makeG({})), false);
    assert.equal(hasPendingCopyPowersChoice(makeG({ pending: [] })), false);
    assert.equal(hasPendingCopyPowersChoice(makeG({ pending: [PENDING] })), true);
  });
});

describe('buildCopyPowersTargets (eligible-set builder)', () => {
  it('returns the real in-play Heroes, excluding the copy-powers ext_id and non-Heroes', () => {
    const G = makeG({ inPlay0: [COPY, GAMBIT, SHIELD_AGENT, WOLVERINE] });
    assert.deepStrictEqual(
      buildCopyPowersTargets(G, '0'),
      [GAMBIT, WOLVERINE],
      'Copy Powers itself + the null-class S.H.I.E.L.D. Agent are excluded',
    );
  });

  it('deduplicates repeated Hero ext_ids (two of the same card = one choice)', () => {
    const G = makeG({ inPlay0: [GAMBIT, GAMBIT, WOLVERINE] });
    assert.deepStrictEqual(buildCopyPowersTargets(G, '0'), [GAMBIT, WOLVERINE]);
  });

  it('returns [] when only Copy Powers / non-Heroes were played', () => {
    const G = makeG({ inPlay0: [COPY, SHIELD_AGENT] });
    assert.deepStrictEqual(buildCopyPowersTargets(G, '0'), []);
  });
});

describe('getEligibleCopyPowersCards (front-gated)', () => {
  it('returns the eligible Heroes for the front chooser only', () => {
    const G = makeG({ inPlay0: [COPY, GAMBIT], pending: [PENDING] });
    assert.deepStrictEqual(getEligibleCopyPowersCards(G, '0'), [GAMBIT]);
    assert.deepStrictEqual(getEligibleCopyPowersCards(G, '1'), [], 'not the front chooser');
    assert.deepStrictEqual(getEligibleCopyPowersCards(makeG({ inPlay0: [GAMBIT] }), '0'), [], 'no pending');
  });
});

describe('selectDefaultCopyPowersCard (bot default)', () => {
  it('picks the highest-cost eligible Hero, ties → earliest played', () => {
    const G = makeG({
      inPlay0: [GAMBIT, WOLVERINE],
      pending: [PENDING],
      cardStats: { [GAMBIT]: { cost: 4 }, [WOLVERINE]: { cost: 6 } },
    });
    assert.equal(selectDefaultCopyPowersCard(G, '0'), WOLVERINE);
  });

  it('null when not the front chooser or nothing eligible', () => {
    const G = makeG({ inPlay0: [GAMBIT], pending: [PENDING] });
    assert.equal(selectDefaultCopyPowersCard(G, '1'), null);
    assert.equal(selectDefaultCopyPowersCard(makeG({ inPlay0: [COPY], pending: [PENDING] }), '0'), null);
  });
});

describe('heroEffectCopyPowers handler (via executeHeroEffects)', () => {
  const ctx = makeMockCtx();
  const copyHook: HeroAbilityHook = {
    cardId: COPY as string,
    timing: 'onPlay',
    keywords: ['copy-powers'],
    effects: [{ type: 'copy-powers' } as never],
  };

  it('0 eligible → no-op: no pending parked, no class granted', () => {
    const G = makeG({ inPlay0: [COPY, SHIELD_AGENT], heroAbilityHooks: [copyHook] });
    executeHeroEffects(G, ctx, '0', COPY);
    assert.equal(G.pendingCopyPowersChoices, undefined, 'no pending parked');
    assert.equal(G.cardSizeChangingClasses, undefined, 'no class granted');
  });

  it('1 eligible → auto-copy: grants the copied class, no pending parked', () => {
    const wolverineDrawHook: HeroAbilityHook = {
      cardId: WOLVERINE as string, timing: 'onPlay', keywords: ['draw'], effects: [{ type: 'draw', magnitude: 2 }],
    };
    const G = makeG({
      inPlay0: [COPY, WOLVERINE],
      deck0: ['d1', 'd2', 'd3'] as CardExtId[],
      hand0: [],
      heroAbilityHooks: [copyHook, wolverineDrawHook],
    });
    executeHeroEffects(G, ctx, '0', COPY);
    assert.equal(G.pendingCopyPowersChoices, undefined, 'exactly 1 eligible auto-copies, no park');
    assert.deepStrictEqual(G.cardSizeChangingClasses?.[COPY], ['instinct'], 'Copy Powers gains Wolverine’s instinct class');
    assert.deepStrictEqual(G.playerZones['0']!.hand, ['d1', 'd2'], 'the copied draw-2 actually drew');
  });

  it('≥2 eligible → parks a PendingCopyPowersChoice (no copy yet)', () => {
    const G = makeG({ inPlay0: [COPY, GAMBIT, WOLVERINE], heroAbilityHooks: [copyHook] });
    executeHeroEffects(G, ctx, '0', COPY);
    assert.equal(G.pendingCopyPowersChoices?.length, 1, 'parked one pending entry');
    assert.deepStrictEqual(G.pendingCopyPowersChoices?.[0], { choiceType: 'copy-powers', playerID: '0', sourceCardId: COPY });
    assert.equal(G.cardSizeChangingClasses, undefined, 'no class granted until resolved');
  });
});

describe('resolveCopyPowersChoice', () => {
  const wolverineDrawHook: HeroAbilityHook = {
    cardId: WOLVERINE as string, timing: 'onPlay', keywords: ['draw'], effects: [{ type: 'draw', magnitude: 2 }],
  };

  function makeContext(G: LegendaryGameState, playerID: string) {
    const mock = makeMockCtx();
    return { G, playerID, ctx: mock.ctx, random: mock.random } as never;
  }

  it('re-fires the chosen Hero’s ability, grants the copied class, and front-pops', () => {
    const G = makeG({
      inPlay0: [COPY, GAMBIT, WOLVERINE],
      deck0: ['d1', 'd2', 'd3'] as CardExtId[],
      hand0: [],
      pending: [PENDING],
      heroAbilityHooks: [wolverineDrawHook],
    });
    resolveCopyPowersChoice(makeContext(G, '0'), { cardId: WOLVERINE });
    assert.deepStrictEqual(G.playerZones['0']!.hand, ['d1', 'd2'], 'copied Wolverine draw-2 fired via ctx.random');
    assert.deepStrictEqual(G.cardSizeChangingClasses?.[COPY], ['instinct'], 'Copy Powers gained the copied class');
    assert.equal(G.pendingCopyPowersChoices?.length, 0, 'front-popped on success');
  });

  it('no-op (queue intact) when the chosen Hero is not eligible', () => {
    const G = makeG({ inPlay0: [COPY, GAMBIT, WOLVERINE], pending: [PENDING] });
    resolveCopyPowersChoice(makeContext(G, '0'), { cardId: 'core/hulk/smash' as CardExtId });
    assert.equal(G.pendingCopyPowersChoices?.length, 1, 'not-in-play target leaves the queue intact');
    assert.equal(G.cardSizeChangingClasses, undefined, 'no class granted');
  });

  it('no-op when the caller is not the front entry’s player', () => {
    const G = makeG({ inPlay0: [COPY, GAMBIT], pending: [PENDING] });
    resolveCopyPowersChoice(makeContext(G, '1'), { cardId: GAMBIT });
    assert.equal(G.pendingCopyPowersChoices?.length, 1, 'front entry belongs to player 0');
  });

  it('no-op on an empty queue and on an empty cardId', () => {
    const empty = makeG({ inPlay0: [COPY, GAMBIT] });
    assert.doesNotThrow(() => resolveCopyPowersChoice(makeContext(empty, '0'), { cardId: GAMBIT }));
    const G = makeG({ inPlay0: [COPY, GAMBIT], pending: [PENDING] });
    resolveCopyPowersChoice(makeContext(G, '0'), { cardId: '' as CardExtId });
    assert.equal(G.pendingCopyPowersChoices?.length, 1, 'empty cardId → no-op, queue intact');
  });
});

describe('two Copy Powers — no copy-of-copy recursion (Finding 5)', () => {
  it('excludes ALL copy-powers copies from the eligible set, so neither can target the other', () => {
    // Two Copy Powers copies both in play (same ext_id) alongside one real Hero.
    const G = makeG({ inPlay0: [COPY, COPY, GAMBIT] });
    assert.deepStrictEqual(
      buildCopyPowersTargets(G, '0'),
      [GAMBIT],
      'both Copy Powers copies are excluded (ext_id, not instance) — only the real Hero is copyable',
    );
  });

  it('applyCopyPowers unions a second copied class onto the same Copy Powers ext_id', () => {
    const ctx = makeMockCtx();
    const G = makeG({ inPlay0: [COPY, GAMBIT, WOLVERINE], cardSizeChangingClasses: { [COPY]: ['ranged'] } });
    applyCopyPowers(G, ctx, '0', COPY, GAMBIT);
    assert.deepStrictEqual(G.cardSizeChangingClasses?.[COPY], ['ranged', 'instinct'], 'unions, no duplicates');
    // Re-applying the same class does not duplicate it.
    applyCopyPowers(G, ctx, '0', COPY, WOLVERINE);
    assert.deepStrictEqual(G.cardSizeChangingClasses?.[COPY], ['ranged', 'instinct'], 'instinct already present, not re-added');
  });
});
