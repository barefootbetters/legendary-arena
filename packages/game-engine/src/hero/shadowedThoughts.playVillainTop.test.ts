/**
 * Shadowed Thoughts optional-play-villain-top → +2 Attack (WP-663 / D-24474).
 *
 * `core/emma-frost/shadowed-thoughts` prints "[hc:covert]: You may play the top card of the
 * Villain Deck. If you do, you get +2 Attack." The mechanic was unimplemented — the player
 * was never offered the choice (the diagnostics showed a hollow ability). These tests pin
 * the fix end-to-end: the parser emits ONE optional-play-villain-top effect carrying the
 * +2 magnitude (the `+2[icon:attack]` is subsumed, not an independent immediate Attack
 * grant), keeps the faithful `[hc:covert]` class-synergy gate, and the handler parks a
 * PendingPlayVillainTopChoice the human resolves via the resolvePlayVillainTopChoice move.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeSingleEffect } from './heroEffects.execute.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const mockCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

// why: the post-marker line — the `[keyword:optional-play-villain-top:2]` token is appended
// by the apply-hero-ability-markers pass (hero-ability-markers.json), exactly as the printed
// text feeds the parser at setup time. The `+2[icon:attack]` is the printed reward; it must
// be subsumed by the keyword, never emitted as a second, immediate Attack grant.
const SHADOWED_THOUGHTS_LINE =
  '[hc:covert]: You may play the top card of the Villain Deck. If you do, you get +2[icon:attack]. [keyword:optional-play-villain-top:2]';

/** Minimal registry exposing getSet, mirroring the setup-test harness. */
function makeEmmaFrostRegistry(abilityLine: string) {
  const setData = {
    abbr: 'core',
    heroes: [
      {
        slug: 'emma-frost',
        cards: [{ slug: 'shadowed-thoughts', rarityLabel: 'Common 2', abilities: [abilityLine] }],
        physicalCards: [{ id: 'p0', count: 1, sides: ['shadowed-thoughts'] }],
      },
    ],
    villains: [], henchmen: [], schemes: [], masterminds: [], bystanders: [], wounds: [], other: [],
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'core' }],
    getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
  };
}

function makeConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/scheme', mastermindId: 'test/mm',
    villainGroupIds: ['test/vg'], henchmanGroupIds: ['test/hg'],
    heroDeckIds: ['core/emma-frost'],
    bystandersCount: 10, woundsCount: 15, officersCount: 20, sidekicksCount: 5,
  };
}

/** A minimal game state for handler tests (the handler only reads/writes the pending queue). */
function makeHandlerState(): LegendaryGameState {
  return {
    messages: [],
    turnEconomy: makeTurnEconomy(),
    playerZones: { '0': { ...makePlayerZones() } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    cardTraits: {},
    cardStats: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

const PLAY_VILLAIN_TOP_EFFECT: HeroEffectDescriptor = {
  type: 'optional-play-villain-top',
  magnitude: 2,
};

describe('Shadowed Thoughts parser (WP-663 / D-24474)', () => {
  it('AC-1: emits ONE optional-play-villain-top effect carrying the +2 magnitude', () => {
    const hooks = buildHeroAbilityHooks(makeEmmaFrostRegistry(SHADOWED_THOUGHTS_LINE), makeConfig());
    const hook = hooks.find((h) => h.cardId.includes('shadowed-thoughts'));
    assert.ok(hook !== undefined, 'a shadowed-thoughts hook must exist');

    // why: AC-1 — exactly one effect, and it is the play-villain-top keyword with magnitude 2.
    // The `+2[icon:attack]` must NOT survive as a separate plain 'attack' effect (that would
    // double-count the reward: once on the park, once immediately). Deep-equal is the pin.
    assert.deepStrictEqual(hook!.effects, [{ type: 'optional-play-villain-top', magnitude: 2 }]);
  });

  it('AC-2: keeps the faithful [hc:covert] class-synergy gate (not dropped by the icon suppression)', () => {
    const hooks = buildHeroAbilityHooks(makeEmmaFrostRegistry(SHADOWED_THOUGHTS_LINE), makeConfig());
    const hook = hooks.find((h) => h.cardId.includes('shadowed-thoughts'));
    const conditions = hook!.conditions ?? [];
    assert.ok(
      conditions.some((condition) => condition.type === 'heroClassMatch' && condition.value === 'covert'),
      'the [hc:covert] gate survives — the ability is a Covert class-synergy bonus',
    );
  });
});

describe('Shadowed Thoughts handler (WP-663 / D-24474)', () => {
  it('AC-3: parks a PendingPlayVillainTopChoice for the acting player with the +2 Attack reward', () => {
    const G = makeHandlerState();
    executeSingleEffect(G, mockCtx, '0', 'shadowed-thoughts', PLAY_VILLAIN_TOP_EFFECT);

    assert.ok(G.pendingPlayVillainTopChoices !== undefined, 'the pending queue was lazily created');
    assert.equal(G.pendingPlayVillainTopChoices!.length, 1, 'exactly one choice parked');
    assert.deepStrictEqual(G.pendingPlayVillainTopChoices![0], {
      playerID: '0',
      cardId: 'shadowed-thoughts',
      attackReward: 2,
    });
  });

  it('AC-4: the park is silent (no immediate Attack, no log line) — the resolve move logs the outcome', () => {
    const G = makeHandlerState();
    const attackBefore = G.turnEconomy.attack;
    executeSingleEffect(G, mockCtx, '0', 'shadowed-thoughts', PLAY_VILLAIN_TOP_EFFECT);

    assert.equal(G.turnEconomy.attack, attackBefore, 'no immediate Attack on the park — the reward is granted on accept');
    assert.deepStrictEqual(G.messages, [], 'the park is silent');
  });

  it('AC-5: never throws; a second play parks a second choice (FIFO)', () => {
    const G = makeHandlerState();
    assert.doesNotThrow(() => {
      executeSingleEffect(G, mockCtx, '0', 'shadowed-thoughts', PLAY_VILLAIN_TOP_EFFECT);
      executeSingleEffect(G, mockCtx, '0', 'shadowed-thoughts', PLAY_VILLAIN_TOP_EFFECT);
    });
    assert.equal(G.pendingPlayVillainTopChoices!.length, 2, 'two plays park two choices');
  });
});
