/**
 * Hero Conqueror — play-time behavior (WP-886 / D-24837).
 *
 * "Bridge Conqueror 1" on a Hero means "You get +1 [Attack] if any Villain is on the Bridge"
 * (rules v23 L1157-1159), read once as the hook resolves. Every hook here is built by
 * buildHeroAbilityHooks from the COMMITTED data/cards JSON (never a hand-written hook), so a
 * card-data or parser drift fails these tests.
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
import { CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE } from './heroConditions.evaluate.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the heroPatrol.test.ts
// precedent), so the hooks come from the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

/** A card id with the strength class, played before Rock Solid to meet its gate. */
const OTHER_STRENGTH_CARD = 'test/strength-hero/punch#0' as CardExtId;

/** A card id with the instinct class, played before Volstagg to meet his Instead gate. */
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
    cardTraits: {
      [OTHER_STRENGTH_CARD]: { heroClass: 'strength', team: null },
      [OTHER_INSTINCT_CARD]: { heroClass: 'instinct', team: null },
    },
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

/** Whether some logged message contains the text. */
function hasMessage(G: LegendaryGameState, text: string): boolean {
  return messageTexts(G).some((message) => message.includes(text));
}

/** A five-space City with the named spaces each holding a Villain. */
function cityWith(...spaceNames: string[]): (string | null)[] {
  const spaceOrder = ['sewers', 'bank', 'rooftops', 'streets', 'bridge'];
  const city: (string | null)[] = [null, null, null, null, null];
  for (const spaceName of spaceNames) {
    city[spaceOrder.indexOf(spaceName)] = `villain-${spaceName}`;
  }
  return city;
}

describe('hero Conqueror at play (WP-886 / D-24837)', () => {
  const skrullHooks = buildCommittedHeroHooks('anni', 'super-skrull');
  const transparentMotives = firstCopyId(skrullHooks, 'super-skrull', 'transparent-motives');
  const rockSolid = firstCopyId(skrullHooks, 'super-skrull', 'rock-solid');
  const putToTheTorch = firstCopyId(skrullHooks, 'super-skrull', 'put-to-the-torch');
  const warriorsHooks = buildCommittedHeroHooks('asrd', 'warriors-three-the');
  const volstagg = firstCopyId(warriorsHooks, 'warriors-three-the', 'volstagg-the-valiant');
  const freedomHooks = buildCommittedHeroHooks('amwp', 'freedom-fighters');
  const steelWarrior = firstCopyId(freedomHooks, 'freedom-fighters', 'steel-warrior');
  const xolum = firstCopyId(freedomHooks, 'freedom-fighters', 'xolum');

  it('Transparent Motives gives +1 attack with a Villain in the Bank', () => {
    const G = makeState(skrullHooks, cityWith('bank'));
    play(G, transparentMotives);
    assert.equal(G.turnEconomy.attack, 1);
  });

  it('Transparent Motives gives nothing with the Bank empty and logs why', () => {
    const G = makeState(skrullHooks, cityWith('bridge'));
    play(G, transparentMotives);
    assert.equal(G.turnEconomy.attack, 0);
    assert.ok(hasMessage(G, 'no Villain is in the Bank'), `expected the blocked line, got: ${messageTexts(G).join(' | ')}`);
  });

  it('an ungated Conqueror hook is not a Synergy clause: Transparent Motives with the Bank occupied tallies 0 / 0', () => {
    const G = makeState(skrullHooks, cityWith('bank'));
    play(G, transparentMotives);
    assert.equal(G.turnEconomy.attack, 1);
    assert.deepEqual(clauseTally(G), { played: 0, assembled: 0 });
  });

  it("Volstagg's ungated base hook with the Bridge occupied tallies 0 / 0", () => {
    // why: keep only the base hook (the one without a class gate), so the tally isolates it.
    const baseHooks = warriorsHooks.filter(
      (hook) => !(hook.conditions ?? []).some((condition) => condition.type === 'heroClassMatch'),
    );
    const G = makeState(baseHooks, cityWith('bridge'));
    play(G, volstagg);
    assert.equal(G.turnEconomy.attack, 1);
    assert.deepEqual(clauseTally(G), { played: 0, assembled: 0 });
  });

  it('Put to the Torch gives +1 for each of the Bridge and Streets holding a Villain; line 2 adds nothing', () => {
    const both = makeState(skrullHooks, cityWith('bridge', 'streets', 'rooftops'));
    play(both, putToTheTorch);
    assert.equal(both.turnEconomy.attack, 2);

    const bridgeOnly = makeState(skrullHooks, cityWith('bridge'));
    play(bridgeOnly, putToTheTorch);
    assert.equal(bridgeOnly.turnEconomy.attack, 1);

    const streetsOnly = makeState(skrullHooks, cityWith('streets'));
    play(streetsOnly, putToTheTorch);
    assert.equal(streetsOnly.turnEconomy.attack, 1);

    const rooftopsOnly = makeState(skrullHooks, cityWith('rooftops'));
    play(rooftopsOnly, putToTheTorch);
    assert.equal(rooftopsOnly.turnEconomy.attack, 0, 'the Wound line never grants Rooftops Conqueror 4');
  });

  it('Volstagg gives +3 after another Instinct Hero, +1 without one, and nothing with the Bridge empty', () => {
    const upgraded = makeState(warriorsHooks, cityWith('bridge'));
    upgraded.playerZones['0']!.inPlay = [OTHER_INSTINCT_CARD];
    play(upgraded, volstagg);
    assert.equal(upgraded.turnEconomy.attack, 3);

    const base = makeState(warriorsHooks, cityWith('bridge'));
    play(base, volstagg);
    assert.equal(base.turnEconomy.attack, 1);

    const empty = makeState(warriorsHooks, cityWith('sewers'));
    empty.playerZones['0']!.inPlay = [OTHER_INSTINCT_CARD];
    play(empty, volstagg);
    assert.equal(empty.turnEconomy.attack, 0);
  });

  it('Volstagg with the Bridge empty logs "no Villain is in the Bridge" once, not once per hook', () => {
    // why: WP-886 live-verify (match 1pm4YRmtW_0) showed the line twice — the base and Instead
    // hooks both fail on the Bridge. Checked with and without another Instinct Hero played.
    const withoutInstinct = makeState(warriorsHooks, cityWith('sewers'));
    play(withoutInstinct, volstagg);
    const withInstinct = makeState(warriorsHooks, cityWith('sewers'));
    withInstinct.playerZones['0']!.inPlay = [OTHER_INSTINCT_CARD];
    play(withInstinct, volstagg);
    for (const G of [withoutInstinct, withInstinct]) {
      const bridgeLines = messageTexts(G).filter((message) => message.includes('no Villain is in the Bridge'));
      assert.equal(bridgeLines.length, 1, `expected one Bridge line, got: ${messageTexts(G).join(' | ')}`);
    }
  });

  it('Rock Solid after another Strength Hero with a Sewers Villain: +1 and 1 assembled', () => {
    const G = makeState(skrullHooks, cityWith('sewers'));
    G.playerZones['0']!.inPlay = [OTHER_STRENGTH_CARD];
    play(G, rockSolid);
    assert.equal(G.turnEconomy.attack, 1);
    assert.deepEqual(clauseTally(G), { played: 1, assembled: 1 });
  });

  it('Rock Solid after another Strength Hero with the Sewers empty: nothing, 0 / 0 (the City decided it)', () => {
    const G = makeState(skrullHooks, cityWith('bank'));
    G.playerZones['0']!.inPlay = [OTHER_STRENGTH_CARD];
    play(G, rockSolid);
    assert.equal(G.turnEconomy.attack, 0);
    assert.deepEqual(clauseTally(G), { played: 0, assembled: 0 });
  });

  it('Rock Solid with a Sewers Villain but no other Strength Hero: nothing, 1 missed', () => {
    const G = makeState(skrullHooks, cityWith('sewers'));
    play(G, rockSolid);
    assert.equal(G.turnEconomy.attack, 0);
    assert.deepEqual(clauseTally(G), { played: 1, assembled: 0 });
  });

  it('a 3-space City has no Streets or Bridge: Steel Warrior and Xolum add nothing and say so', () => {
    const steelState = makeState(freedomHooks, ['villain-sewers', 'villain-bank', 'villain-rooftops']);
    play(steelState, steelWarrior);
    assert.equal(steelState.turnEconomy.attack, 0);
    assert.ok(hasMessage(steelState, 'there is no Streets in the City'), messageTexts(steelState).join(' | '));

    const xolumState = makeState(freedomHooks, ['villain-sewers', 'villain-bank', 'villain-rooftops']);
    play(xolumState, xolum);
    assert.equal(xolumState.turnEconomy.attack, 0);
    assert.ok(hasMessage(xolumState, 'there is no Bridge in the City'), messageTexts(xolumState).join(' | '));
  });

  it('the Attack stays after the Bridge Villain leaves the same turn (no clawback)', () => {
    const G = makeState(freedomHooks, cityWith('bridge'));
    play(G, xolum);
    assert.equal(G.turnEconomy.attack, 1);
    // why: the Bridge Villain is defeated (its space cleared); a later play re-reads nothing
    // from the earlier hook.
    G.city[4] = null;
    play(G, steelWarrior);
    assert.equal(G.turnEconomy.attack, 1);
  });

  it('not wait-and-see: a Villain entering the Bank after Transparent Motives was played grants nothing', () => {
    const G = makeState(skrullHooks, cityWith('bridge'));
    play(G, transparentMotives);
    assert.equal(G.turnEconomy.attack, 0);
    G.city[1] = 'villain-bank';
    play(G, rockSolid);
    assert.equal(G.turnEconomy.attack, 0);
  });

  it('every Conqueror hook built from the committed data carries the constant condition type', () => {
    let conquerorHookCount = 0;
    for (const hook of [...skrullHooks, ...warriorsHooks, ...freedomHooks]) {
      for (const condition of hook.conditions ?? []) {
        if (condition.type === CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE) {
          conquerorHookCount += 1;
        }
      }
    }
    assert.ok(conquerorHookCount > 0, 'the data must carry Conqueror hooks');
  });
});
