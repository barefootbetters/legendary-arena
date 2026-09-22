/**
 * Hawkeye "Impossible Trick Shot" — onDefeat reactive rescue (D-24565).
 *
 * "Whenever you defeat a Villain or Mastermind this turn, rescue three Bystanders."
 * Live-observed hollow (Dr. Doom / The Legacy Virus 2p): played on four turns, each
 * with a Villain or Mastermind-tactic defeat, and never rescued a Bystander — the line
 * carried no marker at all. Like War Machine's Overwhelming Firepower (D-24543) it is
 * MARKER-ONLY on the WP-656 / D-24467 `defeated-villain-or-mastermind` edge-trigger
 * infrastructure: the condition marker gates a `[keyword:rescue:3]` reward that fires
 * once per qualifying defeat this turn — NOT on play.
 *
 * The parse test pins the marker -> hook wiring; the behaviour tests drive that same
 * parsed hook through executeHeroEffects + resolveDeferredHeroGrants. The fight sites
 * that set the defeat signal are covered in fightVillain.test.ts / fightMastermind.test.ts.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, resolveDeferredHeroGrants } from './heroEffects.execute.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: the exact generated ability line for core/hawkeye/impossible-trick-shot (and its
// msp1 reprint) after apply-hero-ability-markers.mjs runs the two curated-map entries —
// verified against data/cards/core.json and data/cards/msp1.json.
const MARKED_ABILITY =
  'Whenever you defeat a Villain or Mastermind this turn, rescue three Bystanders. ' +
  '[keyword:defeated-villain-or-mastermind] [keyword:rescue:3]';

const CARD_ID = 'core/hawkeye/impossible-trick-shot#0';

interface MockHeroCard {
  slug: string;
  abilities: string[];
}

/** Builds a minimal getSet registry with one hero whose cards carry the supplied abilities. */
function makeRegistry(setAbbr: string, heroSlug: string, cards: MockHeroCard[]): unknown {
  const physicalCards = cards.map((card, index) => ({
    id: `p${String(index)}`,
    count: 1,
    sides: [card.slug],
  }));
  const setData = {
    abbr: setAbbr,
    heroes: [{ slug: heroSlug, cards, physicalCards }],
    villains: [],
    henchmen: [],
    schemes: [],
    masterminds: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: setAbbr }],
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
}

/** A valid mock MatchSetupConfig selecting the Hawkeye hero deck. */
function makeConfig(heroDeckId: string): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: [heroDeckId],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/** Parses the real marked ability line into the single Impossible Trick Shot hook. */
function impossibleTrickShotHook(): HeroAbilityHook {
  const registry = makeRegistry('core', 'hawkeye', [
    { slug: 'impossible-trick-shot', abilities: [MARKED_ABILITY] },
  ]);
  const hooks = buildHeroAbilityHooks(registry, makeConfig('core/hawkeye'));
  const hook = hooks.find((candidate) => candidate.cardId === CARD_ID);
  assert.ok(hook !== undefined, 'the impossible-trick-shot hook is built from the marked ability line');
  return hook;
}

/** Minimal state with the parsed hook in play and the supplied Bystander supply. */
function makeState(hook: HeroAbilityHook, bystanders: string[]): LegendaryGameState {
  return {
    messages: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': {
        ...makePlayerZones(),
        deck: [],
        hand: [],
        inPlay: [CARD_ID],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(), bystanders: [...bystanders] },
    mastermind: makeMastermindState(),
    heroAbilityHooks: [hook],
    cardTraits: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

const SEVEN_BYSTANDERS = ['by-1', 'by-2', 'by-3', 'by-4', 'by-5', 'by-6', 'by-7'];

const mockCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/** Simulates a fight-site defeat: sets the edge flag gated on a pending grant. */
function signalDefeat(G: LegendaryGameState): void {
  if (G.deferredConditionalGrants !== undefined && G.deferredConditionalGrants.length > 0) {
    G.villainOrMastermindDefeatedSinceResolve = true;
  }
}

describe('Hawkeye Impossible Trick Shot — onDefeat rescue three (D-24565)', () => {
  it('parses to the defeat condition gating a rescue-3 reward (marker -> hook)', () => {
    const hook = impossibleTrickShotHook();

    assert.deepEqual(
      hook.conditions,
      [{ type: 'defeatedVillainOrMastermindThisTurn', value: '1' }],
      'the [keyword:defeated-villain-or-mastermind] marker pushes the edge-triggered defeat condition',
    );
    assert.deepEqual(
      hook.effects,
      [{ type: 'rescue', magnitude: 3 }],
      'the rescue-three reward rides on the same hook',
    );
    assert.ok(
      hook.unresolvedMarkers === undefined || hook.unresolvedMarkers.length === 0,
      'no unresolved marker remains — the ability is fully recognized, not a hollow',
    );
  });

  it('NEGATIVE: playing it with no defeat rescues nothing (the reward waits)', () => {
    const G = makeState(impossibleTrickShotHook(), SEVEN_BYSTANDERS);
    executeHeroEffects(G, mockCtx, '0', CARD_ID);
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.playerZones['0']!.victory.length, 0, 'no free rescue on play or on a non-defeat move');
    assert.equal(G.piles.bystanders.length, 7, 'the Bystander supply is untouched');
    assert.equal(G.deferredConditionalGrants?.length, 1, 'the ability is waiting, not fired');
  });

  it('POSITIVE: each defeat rescues three Bystanders; a non-defeat move between rescues none', () => {
    const G = makeState(impossibleTrickShotHook(), SEVEN_BYSTANDERS);
    executeHeroEffects(G, mockCtx, '0', CARD_ID);

    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.victory.length, 3, 'defeat 1 -> three Bystanders rescued');

    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.victory.length, 3, 'a non-defeat move rescues nothing (edge, not sticky)');

    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.victory.length, 6, 'defeat 2 -> three more (repeatable, not one-shot)');
    assert.equal(G.piles.bystanders.length, 1, 'six Bystanders left the supply');
  });

  it('a short supply rescues what remains without throwing', () => {
    const G = makeState(impossibleTrickShotHook(), ['by-1', 'by-2']);
    executeHeroEffects(G, mockCtx, '0', CARD_ID);

    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.victory.length, 2, 'rescues the two available Bystanders');
    assert.equal(G.piles.bystanders.length, 0, 'the supply is emptied, not overdrawn');
  });
});
