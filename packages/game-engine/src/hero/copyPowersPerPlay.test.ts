/**
 * Copy Powers' copied class and team last for one play of the card (D-24730).
 *
 * Live match L3yPdfS179l: Copy Powers #0 copied Crazed Rampage (Strength) on turn 6, then
 * copied Silent Sniper (Covert, Avengers) on turn 16, yet on turn 16 Borrowed Brawn's
 * "Strength: +3 attack" fired off it and Maestro counted it as "granted strength". The
 * copy was written into per-instance maps that nothing cleared. These tests run the real
 * chain — applyCopyPowers, applyEndOfTurnCleanup, then the class / team readers — across
 * two turns, and check that a Size-Changing setup grant survives the same cleanup.
 *
 * Uses node:test + node:assert + makeMockCtx only. No registry imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyCopyPowers } from './heroEffects.execute.js';
import { cardHasClassWhenPlayed } from './sizeChanging.logic.js';
import { cardHasTeamWhenPlayed } from './effectiveTeams.logic.js';
import { evaluateCondition } from './heroConditions.evaluate.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroCondition } from '../rules/heroAbility.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';

const COPY_POWERS = 'core/rogue/copy-powers#0' as CardExtId;
const CRAZED_RAMPAGE = 'core/hulk/crazed-rampage#0' as CardExtId;
const SILENT_SNIPER = 'core/black-widow/silent-sniper#0' as CardExtId;
const KEEN_SENSES = 'core/wolverine/keen-senses#0' as CardExtId;
const BORROWED_BRAWN = 'core/rogue/borrowed-brawn#0' as CardExtId;
const A_DAY = 'core/captain-america/a-day-unlike-any-other#0' as CardExtId;
const SIZE_CHANGER = 'test/size-changer#0' as CardExtId;

const TRAITS: Record<string, { heroClass: string | null; team: string | null }> = {
  [COPY_POWERS]: { heroClass: 'covert', team: 'x-men' },
  [CRAZED_RAMPAGE]: { heroClass: 'strength', team: 'avengers' },
  [SILENT_SNIPER]: { heroClass: 'covert', team: 'avengers' },
  [KEEN_SENSES]: { heroClass: 'instinct', team: 'x-men' },
  [BORROWED_BRAWN]: { heroClass: 'strength', team: 'x-men' },
  [A_DAY]: { heroClass: 'covert', team: 'avengers' },
  [SIZE_CHANGER]: { heroClass: 'tech', team: 'avengers' },
};

const DISPLAY: Record<string, { name: string }> = {
  [COPY_POWERS]: { name: 'Copy Powers' },
  [CRAZED_RAMPAGE]: { name: 'Crazed Rampage' },
  [SILENT_SNIPER]: { name: 'Silent Sniper' },
  [KEEN_SENSES]: { name: 'Keen Senses' },
  [BORROWED_BRAWN]: { name: 'Borrowed Brawn' },
  [A_DAY]: { name: 'A Day Unlike Any Other' },
  [SIZE_CHANGER]: { name: 'Size Changer' },
};

// why: Borrowed Brawn's "[hc:strength]: +3 attack" gate — another Strength Hero played this turn.
const STRENGTH_GATE: HeroCondition = { type: 'heroClassMatch', value: 'strength' } as HeroCondition;

const MAESTRO_HOOK: VillainAbilityHook = {
  cardId: 'v-maestro' as CardExtId,
  timing: 'onFight',
  keywords: [],
  effects: [{ primitive: 'ko-heroes-current-count-by-trait', requireKind: 'hero-class', requireValue: 'strength' }],
};

const ZEMO_HOOK: VillainAbilityHook = {
  cardId: 'v-zemo' as CardExtId,
  timing: 'onFight',
  keywords: [],
  effects: [{ primitive: 'rescue-bystanders-current-by-trait-count', requireKind: 'team', requireValue: 'avengers' }],
};

/** A ShuffleProvider for the cleanup draw (no reshuffle matters here). */
const SHUFFLE = { random: { Shuffle: <T>(deck: T[]): T[] => [...deck] } };

/**
 * Builds a two-seat state with player 0's in-play cards, the trait / display maps, and
 * the villain hooks the Maestro and Zemo checks dispatch. Cast through unknown because
 * only the fields these paths read are supplied.
 */
function makeG(inPlay: CardExtId[]): LegendaryGameState {
  return {
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay, victory: [] },
      '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    cardTraits: TRAITS,
    cardStats: {},
    cardDisplayData: DISPLAY,
    heroAbilityHooks: [],
    villainAbilityHooks: [MAESTRO_HOOK, ZEMO_HOOK],
    piles: { bystanders: ['bys0', 'bys1', 'bys2'], wounds: [], officers: [], sidekicks: [], horrors: [] },
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    notableEvents: [],
    messages: [],
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
  } as unknown as LegendaryGameState;
}

/**
 * Starts player 0's next turn with the given cards in play, as if drawn and played again.
 *
 * @param G - Game state, mutated in place.
 * @param inPlay - The cards player 0 has played this turn.
 */
function startNextTurn(G: LegendaryGameState, inPlay: CardExtId[]): void {
  G.playerZones['0'] = { deck: [], hand: [], discard: [], inPlay, victory: [] };
}

describe('Copy Powers copies last for one play of the card (D-24730, live L3yPdfS179l)', () => {
  const ctx = makeMockCtx();

  it('end-of-turn cleanup deletes both copy maps and keeps the Size-Changing setup grant', () => {
    const G = makeG([COPY_POWERS, CRAZED_RAMPAGE]);
    G.cardSizeChangingClasses = { [SIZE_CHANGER]: ['strength'] };
    applyCopyPowers(G, ctx, '0', COPY_POWERS, CRAZED_RAMPAGE);
    assert.deepStrictEqual(G.cardCopiedClasses, { [COPY_POWERS]: ['strength'] });
    assert.deepStrictEqual(G.cardCopiedTeams, { [COPY_POWERS]: ['avengers'] });
    assert.deepStrictEqual(G.cardSizeChangingClasses, { [SIZE_CHANGER]: ['strength'] }, 'the copy no longer writes the Size-Changing map');

    applyEndOfTurnCleanup(G, '0', SHUFFLE);
    assert.equal('cardCopiedClasses' in G, false, 'copied classes deleted (omit-when-empty)');
    assert.equal('cardCopiedTeams' in G, false, 'copied teams deleted (omit-when-empty)');
    assert.deepStrictEqual(G.cardSizeChangingClasses, { [SIZE_CHANGER]: ['strength'] }, 'the printed Size-Changing grant stays');
  });

  it('a Strength copy on one turn, then a Covert copy on a later turn, counts as Covert only', () => {
    // Turn 6: Copy Powers copies Crazed Rampage (Strength).
    const G = makeG([CRAZED_RAMPAGE, COPY_POWERS]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, CRAZED_RAMPAGE);
    assert.equal(cardHasClassWhenPlayed(G, COPY_POWERS, 'strength'), true, 'turn 6: Copy Powers is Strength');
    applyEndOfTurnCleanup(G, '0', SHUFFLE);

    // Turn 16: the same Copy Powers copies Silent Sniper (Covert, Avengers).
    startNextTurn(G, [SILENT_SNIPER, COPY_POWERS, BORROWED_BRAWN]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, SILENT_SNIPER);
    assert.equal(cardHasClassWhenPlayed(G, COPY_POWERS, 'strength'), false, 'turn 16: the turn-6 Strength copy is gone');
    assert.equal(cardHasClassWhenPlayed(G, COPY_POWERS, 'covert'), true);
    assert.deepStrictEqual(G.cardCopiedClasses, { [COPY_POWERS]: ['covert'] });
  });

  it('Borrowed Brawn’s Strength bonus does not fire off a Copy Powers that copied Strength on an earlier turn', () => {
    const G = makeG([CRAZED_RAMPAGE, COPY_POWERS]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, CRAZED_RAMPAGE);
    applyEndOfTurnCleanup(G, '0', SHUFFLE);

    startNextTurn(G, [SILENT_SNIPER, COPY_POWERS, BORROWED_BRAWN]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, SILENT_SNIPER);
    assert.equal(
      evaluateCondition(G, '0', STRENGTH_GATE, BORROWED_BRAWN),
      false,
      'no other Strength Hero this turn: Silent Sniper is Covert and Copy Powers copied it',
    );
  });

  it('a same-turn Strength copy still satisfies Borrowed Brawn', () => {
    const G = makeG([CRAZED_RAMPAGE, COPY_POWERS, BORROWED_BRAWN]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, CRAZED_RAMPAGE);
    assert.equal(evaluateCondition(G, '0', STRENGTH_GATE, BORROWED_BRAWN), true);
  });

  it('Maestro does not count a Copy Powers that copied Strength on an earlier turn', () => {
    const G = makeG([CRAZED_RAMPAGE, COPY_POWERS]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, CRAZED_RAMPAGE);
    applyEndOfTurnCleanup(G, '0', SHUFFLE);

    startNextTurn(G, [SILENT_SNIPER, COPY_POWERS, BORROWED_BRAWN]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, SILENT_SNIPER);
    G.messages = [];
    executeVillainAbilities(G, { currentPlayer: '0' }, 'v-maestro' as CardExtId, 'onFight');
    assert.deepStrictEqual(
      G.pendingKoHeroChoices,
      [{ choiceType: 'ko-hero', playerID: '0' }],
      'owed = 1: Borrowed Brawn only',
    );
    assert.equal(
      G.messages.at(-1)!.text,
      'Fight effect: KO 1 of your Heroes (one per your strength Hero: Borrowed Brawn (played)) — choose which.',
    );
  });

  it('Baron Zemo does not count a Copy Powers that copied an Avenger on an earlier turn', () => {
    // Turn A: Copy Powers copies Crazed Rampage (Avengers).
    const G = makeG([CRAZED_RAMPAGE, COPY_POWERS]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, CRAZED_RAMPAGE);
    assert.equal(cardHasTeamWhenPlayed(G, COPY_POWERS, 'avengers'), true, 'turn A: Copy Powers is an Avenger');
    applyEndOfTurnCleanup(G, '0', SHUFFLE);

    // Turn B: it copies Keen Senses (X-Men); one printed Avenger is also played.
    startNextTurn(G, [KEEN_SENSES, COPY_POWERS, A_DAY]);
    applyCopyPowers(G, ctx, '0', COPY_POWERS, KEEN_SENSES);
    assert.equal(cardHasTeamWhenPlayed(G, COPY_POWERS, 'avengers'), false, 'turn B: the turn-A Avengers copy is gone');
    G.messages = [];
    executeVillainAbilities(G, { currentPlayer: '0' }, 'v-zemo' as CardExtId, 'onFight');
    assert.equal(G.playerZones['0']!.victory.length, 1, 'one Avenger: A Day Unlike Any Other');
    assert.equal(
      G.messages[0]!.text,
      'Fight effect: rescued 1 Bystander(s) (one per your avengers Hero: A Day Unlike Any Other (played)).',
    );
  });

  it('a Copy Powers copy is not Size-Changing for a cheap-or-Size-Changing count', () => {
    // why: before D-24730 the copied class sat in cardSizeChangingClasses, so a 5-cost Copy
    // Powers that copied anything read as a Size-Changing card.
    const G = makeG([CRAZED_RAMPAGE, COPY_POWERS]);
    G.cardStats = { [COPY_POWERS]: { cost: 5 }, [CRAZED_RAMPAGE]: { cost: 5 } } as LegendaryGameState['cardStats'];
    applyCopyPowers(G, ctx, '0', COPY_POWERS, CRAZED_RAMPAGE);
    const cheapOrSizeChanging = { type: 'cheapOrSizeChangingAtLeast', value: '1' } as HeroCondition;
    assert.equal(evaluateCondition(G, '0', cheapOrSizeChanging), false, 'neither card is cheap or Size-Changing');
    G.cardSizeChangingClasses = { [CRAZED_RAMPAGE]: ['ranged'] };
    assert.equal(evaluateCondition(G, '0', cheapOrSizeChanging), true, 'control: a real Size-Changing grant counts');
  });

  it('a Size-Changing card’s setup grant applies on every play, across cleanups', () => {
    const G = makeG([SIZE_CHANGER]);
    G.cardSizeChangingClasses = { [SIZE_CHANGER]: ['strength'] };
    assert.equal(cardHasClassWhenPlayed(G, SIZE_CHANGER, 'strength'), true, 'first play');
    applyEndOfTurnCleanup(G, '0', SHUFFLE);
    startNextTurn(G, [SIZE_CHANGER, BORROWED_BRAWN]);
    assert.equal(cardHasClassWhenPlayed(G, SIZE_CHANGER, 'strength'), true, 'second play');
    assert.equal(evaluateCondition(G, '0', STRENGTH_GATE, BORROWED_BRAWN), true, 'still a Strength Hero for Borrowed Brawn');
  });
});
