/**
 * Hero Patrol — play-time behavior (WP-881 / D-24832).
 *
 * "[keyword:Patrol the <space>]: If it's empty, … If it's not, …" (rules v23 ~L1772-1780) fires
 * each printed branch only while that City space is empty / occupied, read as the hook resolves.
 * Every hook here is built by buildHeroAbilityHooks from the COMMITTED data/cards JSON (never a
 * hand-written hook), so a marker or parser drift fails these tests.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// nextHandExtraDraw.test.ts precedent), so the hooks come from the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

/** A card id with the instinct class, played before Axe of the Slayer to meet its gate. */
const OTHER_INSTINCT_CARD = 'test/instinct-hero/claws#0' as CardExtId;

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the hooks of one committed hero deck.
 *
 * @param setAbbr - Set abbreviation (the data/cards/<abbr>.json file).
 * @param heroSlug - Hero slug.
 * @returns The hero's hooks.
 */
function buildCommittedHeroHooks(setAbbr: string, heroSlug: string): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: [`${setAbbr}/${heroSlug}`] } as unknown as MatchConfiguration);
}

/**
 * Returns the CardExtId of the first copy of a card in a hook list.
 *
 * @param hooks - The hero's hooks.
 * @param heroSlug - Hero slug.
 * @param cardSlug - Card slug.
 * @returns The first copy's CardExtId.
 */
function firstCopyId(hooks: HeroAbilityHook[], heroSlug: string, cardSlug: string): CardExtId {
  const hook = hooks.find((candidate) => candidate.cardId.includes(`/${heroSlug}/${cardSlug}#`));
  assert.ok(hook !== undefined, `the committed data builds a hook for ${heroSlug}/${cardSlug}`);
  return hook.cardId;
}

/**
 * A minimal state for driving executeHeroEffects.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @param city - The City spaces (index 0 = Sewers).
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[], city: (string | null)[]): LegendaryGameState {
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': {
        ...makePlayerZones(),
        deck: ['deck-a', 'deck-b', 'deck-c', 'deck-d'],
        hand: ['hand-a'],
        discard: [],
        inPlay: [],
      },
    },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits: { [OTHER_INSTINCT_CARD]: { heroClass: 'instinct', team: null } },
    cardDisplayData: {},
    city: [...city],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays a hero card: puts it in play, then fires its hooks (the applyCardPlay order).
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The hero card being played.
 */
function play(G: LegendaryGameState, cardId: CardExtId): void {
  G.playerZones['0']!.inPlay = [...G.playerZones['0']!.inPlay, cardId];
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/** The player's Synergy Rate tally, or zeros when nothing was recorded. */
function clauseTally(G: LegendaryGameState): { played: number; assembled: number } {
  const entry = G.diagnostics?.conditionalClauses?.['0'];
  return { played: entry?.played ?? 0, assembled: entry?.assembled ?? 0 };
}

/** Every logged message text. */
function messageTexts(G: LegendaryGameState): string[] {
  return G.messages.map((message) => (typeof message === 'string' ? message : String((message as { text?: unknown }).text ?? message)));
}

const EMPTY_CITY: (string | null)[] = [null, null, null, null, null];

describe('hero Patrol at play (WP-881 / D-24832)', () => {
  const wongHooks = buildCommittedHeroHooks('mdns', 'wong-master-of-the-mystic-arts');
  const bridgeBetweenDimensions = firstCopyId(wongHooks, 'wong-master-of-the-mystic-arts', 'bridge-between-dimensions');
  const sealTheRift = firstCopyId(wongHooks, 'wong-master-of-the-mystic-arts', 'seal-the-rift');
  const elsaHooks = buildCommittedHeroHooks('mdns', 'elsa-bloodstone');
  const axeOfTheSlayer = firstCopyId(elsaHooks, 'elsa-bloodstone', 'axe-of-the-slayer');

  it('Bridge Between Dimensions draws a card when the Bridge is empty', () => {
    const G = makeState(wongHooks, EMPTY_CITY);
    play(G, bridgeBetweenDimensions);
    assert.deepEqual(G.playerZones['0']!.hand, ['hand-a', 'deck-a']);
  });

  it('Bridge Between Dimensions draws nothing with a Villain on the Bridge and logs the blocked line', () => {
    const G = makeState(wongHooks, [null, null, null, null, 'villain-bridge']);
    play(G, bridgeBetweenDimensions);
    assert.deepEqual(G.playerZones['0']!.hand, ['hand-a']);
    assert.ok(
      messageTexts(G).some((text) => text.includes("did not activate — there's a card in the Bridge")),
      `expected the blocked line, got: ${messageTexts(G).join(' | ')}`,
    );
  });

  it('a removed Bridge (a 3-space City) fires neither Seal the Rift branch and logs that there is no Bridge', () => {
    const G = makeState(wongHooks, [null, null, null]);
    play(G, sealTheRift);
    assert.deepEqual(G.playerZones['0']!.hand, ['hand-a']);
    assert.equal(G.turnEconomy.attack, 0);
    assert.ok(messageTexts(G).some((text) => text.includes('there is no Bridge in the City')));
  });

  it('Seal the Rift draws two with the Bridge empty, and grants no attack', () => {
    const G = makeState(wongHooks, EMPTY_CITY);
    play(G, sealTheRift);
    assert.deepEqual(G.playerZones['0']!.hand, ['hand-a', 'deck-a', 'deck-b']);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.turnEconomy.restrictedAttack, undefined);
  });

  it('Seal the Rift adds a Bridge-restricted +5 with the Bridge occupied, and draws nothing', () => {
    const G = makeState(wongHooks, [null, null, null, null, 'villain-bridge']);
    play(G, sealTheRift);
    assert.deepEqual(G.playerZones['0']!.hand, ['hand-a']);
    assert.equal(G.turnEconomy.attack, 5);
    assert.deepEqual(G.turnEconomy.restrictedAttack, [{ remaining: 5, targets: ['bridge'], sourceCardId: sealTheRift }]);
  });

  for (const streetsState of ['empty', 'occupied'] as const) {
    const city: (string | null)[] = streetsState === 'empty' ? EMPTY_CITY : [null, null, null, 'villain-streets', null];

    it(`Axe of the Slayer without another Instinct Hero, Streets ${streetsState}: one branch only, 1 Synergy miss`, () => {
      const G = makeState(elsaHooks, city);
      play(G, axeOfTheSlayer);
      if (streetsState === 'empty') {
        assert.equal(G.turnEconomy.recruit, 2);
        assert.equal(G.turnEconomy.attack, 0);
      } else {
        assert.equal(G.turnEconomy.recruit, 0);
        assert.equal(G.turnEconomy.attack, 2);
      }
      assert.deepEqual(clauseTally(G), { played: 1, assembled: 0 });
    });

    it(`Axe of the Slayer after another Instinct Hero, Streets ${streetsState}: both, 1 assembled / 0 misses`, () => {
      const G = makeState(elsaHooks, city);
      G.playerZones['0']!.inPlay = [OTHER_INSTINCT_CARD];
      play(G, axeOfTheSlayer);
      assert.equal(G.turnEconomy.recruit, 2);
      assert.equal(G.turnEconomy.attack, 2);
      assert.deepEqual(clauseTally(G), { played: 1, assembled: 1 });
    });
  }

  it('Feeding Grounds parks the optional KO only when the Streets are empty', () => {
    const hooks = buildCommittedHeroHooks('ssw2', 'captain-and-the-devil-the');
    const feedingGrounds = firstCopyId(hooks, 'captain-and-the-devil-the', 'feeding-grounds');
    const emptyStreets = makeState(hooks, EMPTY_CITY);
    play(emptyStreets, feedingGrounds);
    assert.equal(emptyStreets.pendingOptionalKoRewards?.length, 1);
    assert.deepEqual(emptyStreets.pendingOptionalKoRewards?.[0]?.koZones, ['hand', 'discard']);
    const occupiedStreets = makeState(hooks, [null, null, null, 'villain-streets', null]);
    play(occupiedStreets, feedingGrounds);
    assert.equal(occupiedStreets.pendingOptionalKoRewards, undefined);
  });

  it('Seek the Empty Mind grants nothing and records a patrol-your-discard-pile hollow', () => {
    const hooks = buildCommittedHeroHooks('ssw2', 'shang-chi');
    const seekTheEmptyMind = firstCopyId(hooks, 'shang-chi', 'seek-the-empty-mind');
    const G = makeState(hooks, EMPTY_CITY);
    play(G, seekTheEmptyMind);
    assert.equal(G.turnEconomy.attack, 0);
    assert.equal(G.turnEconomy.recruit, 0);
    const mechanics = (G.diagnostics?.hollowEffects ?? []).map((record) => record.mechanic);
    assert.deepEqual(mechanics, ['patrol-your-discard-pile']);
  });

  it('Lord of Dragons with the Rooftops occupied grants nothing and records a patrol-the-rooftops hollow', () => {
    const hooks = buildCommittedHeroHooks('ssw2', 'arkon-the-magnificent');
    const lordOfDragons = firstCopyId(hooks, 'arkon-the-magnificent', 'lord-of-dragons');
    const occupied = makeState(hooks, [null, null, 'villain-rooftops', null, null]);
    play(occupied, lordOfDragons);
    assert.equal(occupied.turnEconomy.attack, 0);
    assert.equal(occupied.turnEconomy.recruit, 0);
    const mechanics = (occupied.diagnostics?.hollowEffects ?? []).map((record) => record.mechanic);
    assert.deepEqual(mechanics, ['patrol-the-rooftops']);
    const empty = makeState(hooks, EMPTY_CITY);
    play(empty, lordOfDragons);
    assert.equal(empty.turnEconomy.attack, 4);
    assert.equal(empty.turnEconomy.recruit, 4);
    assert.equal((empty.diagnostics?.hollowEffects ?? []).length, 0);
  });
});
