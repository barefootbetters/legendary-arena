/**
 * War Machine "Overwhelming Firepower" — onDefeat reactive reward (WP-722 / D-24543).
 *
 * "Whenever you defeat a Villain or Mastermind this turn, draw a card and rescue a
 * Bystander." This card rides the WP-656 / D-24467 `defeated-villain-or-mastermind`
 * edge-trigger infrastructure (the Emma Frost Diamond Form mechanism) — it is
 * MARKER-ONLY, no new engine handler. The `[keyword:defeated-villain-or-mastermind]`
 * marker pushes the `defeatedVillainOrMastermindThisTurn` wait-and-see condition onto
 * the ability's hook; the co-located `[keyword:draw:1]` + `[keyword:rescue:1]` markers
 * are the reward. The condition gates the reward, so draw + rescue fire once per
 * qualifying defeat this turn — NOT on play.
 *
 * These tests exercise the REAL parsed hook end-to-end: the parse test pins the
 * marker -> hook wiring (the WP's actual deliverable), and the behaviour tests drive
 * that same parsed hook through executeHeroEffects + resolveDeferredHeroGrants so the
 * fire economics cannot drift from a hand-authored hook. The fight sites that set the
 * defeat signal are covered in fightVillain.test.ts / fightMastermind.test.ts; here the
 * signal is set directly to exercise the reward resolution.
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

// why: the exact generated ability line for rvlt/war-machine/overwhelming-firepower
// after apply-hero-ability-markers.mjs runs the three curated-map entries — verified
// against data/cards/rvlt.json. The three appended tokens are the condition gate plus
// the draw + rescue reward.
const MARKED_ABILITY =
  'Whenever you defeat a Villain or Mastermind this turn, draw a card and rescue a Bystander. ' +
  '[keyword:defeated-villain-or-mastermind] [keyword:draw:1] [keyword:rescue:1]';

const CARD_ID = 'rvlt/war-machine/overwhelming-firepower#0';

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

/** A valid mock MatchSetupConfig selecting the War Machine hero deck. */
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

/** Parses the real marked ability line into the single Overwhelming Firepower hook. */
function overwhelmingFirepowerHook(): HeroAbilityHook {
  const registry = makeRegistry('rvlt', 'war-machine', [
    { slug: 'overwhelming-firepower', abilities: [MARKED_ABILITY] },
  ]);
  const hooks = buildHeroAbilityHooks(registry, makeConfig('rvlt/war-machine'));
  const hook = hooks.find((candidate) => candidate.cardId === CARD_ID);
  assert.ok(hook !== undefined, 'the overwhelming-firepower hook is built from the marked ability line');
  return hook;
}

/**
 * Minimal state with the parsed hook, a deck to draw from, a bystander supply to rescue
 * from, and Overwhelming Firepower in play for the active player.
 */
function makeState(hook: HeroAbilityHook): LegendaryGameState {
  return {
    messages: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': {
        ...makePlayerZones(),
        deck: ['wm-deck-1', 'wm-deck-2'],
        hand: [],
        inPlay: [CARD_ID],
        victory: [],
      },
    },
    piles: { ...makeGlobalPiles(), bystanders: ['bystander-a', 'bystander-b'] },
    mastermind: makeMastermindState(),
    heroAbilityHooks: [hook],
    cardTraits: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

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

describe('War Machine Overwhelming Firepower — onDefeat reward (WP-722 / D-24543)', () => {
  it('parses to the defeat condition gating a draw + rescue reward (marker -> hook)', () => {
    const hook = overwhelmingFirepowerHook();

    assert.deepEqual(
      hook.conditions,
      [{ type: 'defeatedVillainOrMastermindThisTurn', value: '1' }],
      'the [keyword:defeated-villain-or-mastermind] marker pushes the edge-triggered defeat condition',
    );
    assert.deepEqual(
      hook.effects,
      [
        { type: 'draw', magnitude: 1 },
        { type: 'rescue', magnitude: 1 },
      ],
      'the draw + rescue reward effects ride on the same hook, in text order',
    );
    // why: an unresolved marker would make this a parse-unrecognized hollow — the exact
    // deferral this WP resolves. The marker-only wiring must leave no residual hollow.
    assert.ok(
      hook.unresolvedMarkers === undefined || hook.unresolvedMarkers.length === 0,
      'no unresolved marker remains — the ability is fully recognized, not a hollow',
    );
  });

  it('NEGATIVE: playing it with no defeat draws and rescues nothing (the reward waits, it does not fire on play)', () => {
    const G = makeState(overwhelmingFirepowerHook());
    executeHeroEffects(G, mockCtx, '0', CARD_ID);

    assert.equal(G.playerZones['0']!.hand.length, 0, 'no free draw on play');
    assert.equal(G.playerZones['0']!.victory.length, 0, 'no free rescue on play');
    assert.equal(G.piles.bystanders.length, 2, 'the Bystander supply is untouched on play');
    assert.equal(G.deferredConditionalGrants?.length, 1, 'the ability is waiting, not fired');
    assert.match(G.messages[G.messages.length - 1]!.text, /is waiting/);

    // A whole turn of non-defeat resolutions still grants nothing.
    resolveDeferredHeroGrants(G, mockCtx);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 0, 'no defeat all turn -> still no draw');
    assert.equal(G.playerZones['0']!.victory.length, 0, 'no defeat all turn -> still no rescue');
  });

  it('POSITIVE: defeating one Villain draws a card and rescues a Bystander', () => {
    const G = makeState(overwhelmingFirepowerHook());
    executeHeroEffects(G, mockCtx, '0', CARD_ID);

    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);

    assert.equal(G.playerZones['0']!.hand.length, 1, 'one qualifying defeat -> drew a card');
    assert.equal(G.turnEconomy.cardsDrawn, 1, 'the realized draw is counted toward the turn total');
    assert.equal(G.playerZones['0']!.victory.length, 1, 'one qualifying defeat -> rescued a Bystander');
    assert.equal(G.piles.bystanders.length, 1, 'the rescued Bystander left the supply');
  });

  it('edge-triggered per defeat: two defeats reward twice, a non-defeat move between rewards nothing', () => {
    const G = makeState(overwhelmingFirepowerHook());
    executeHeroEffects(G, mockCtx, '0', CARD_ID);

    // Move 1: fightVillain (defeat 1)
    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 1, 'defeat 1 -> +1 draw');
    assert.equal(G.playerZones['0']!.victory.length, 1, 'defeat 1 -> +1 rescue');

    // Move 2: a non-defeat move — must NOT re-fire (edge, not sticky)
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 1, 'a non-defeat move between defeats rewards nothing');
    assert.equal(G.playerZones['0']!.victory.length, 1, 'a non-defeat move between defeats rewards nothing');

    // Move 3: fightVillain (defeat 2)
    signalDefeat(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 2, 'defeat 2 -> +1 draw (repeatable, not one-shot)');
    assert.equal(G.playerZones['0']!.victory.length, 2, 'defeat 2 -> +1 rescue (repeatable, not one-shot)');

    // Move 4: a trailing non-defeat move — must NOT re-fire
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.playerZones['0']!.hand.length, 2, 'no trailing reward after the last defeat');
    assert.equal(G.playerZones['0']!.victory.length, 2, 'no trailing reward after the last defeat');
  });
});
