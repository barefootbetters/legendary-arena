/**
 * Psychic Link reveal-from-hand → draw (WP-659 / D-24470).
 *
 * `core/emma-frost/psychic-link` prints "Each player may reveal another X-Men Hero. Each
 * player who does draws a card." The mid-sentence `[team:x-men]` token used to be mis-parsed
 * as a `requiresTeam` play-gate (the card blocked "needs another x-men Hero played this
 * turn"), and the reveal-from-hand → draw mechanic was unimplemented. These tests pin the
 * fix: the parser captures the token as a reveal criterion (no spurious gate), and the
 * handler draws for each player holding a criterion-matching Hero.
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

const PSYCHIC_LINK_LINE =
  'Each player may reveal another [team:x-men] Hero. Each player who does draws a card. [keyword:reveal-from-hand]';

/** Minimal registry exposing getSet, mirroring the setup-test harness. */
function makeEmmaFrostRegistry(abilityLine: string) {
  const setData = {
    abbr: 'core',
    heroes: [
      {
        slug: 'emma-frost',
        cards: [{ slug: 'psychic-link', rarityLabel: 'Uncommon', abilities: [abilityLine] }],
        physicalCards: [{ id: 'p0', count: 1, sides: ['psychic-link'] }],
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

/** A game state with the given player hands + one X-Men card trait, for handler tests. */
function makeHandState(hands: Record<string, string[]>, decks: Record<string, string[]>): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const playerId of Object.keys(hands)) {
    playerZones[playerId] = { ...makePlayerZones(), hand: hands[playerId], deck: decks[playerId] ?? [] };
  }
  return {
    messages: [],
    turnEconomy: makeTurnEconomy(),
    playerZones,
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    // why: the x-men team trait is what the reveal criterion matches; a non-x-men card has
    // team 'shield' and never matches.
    cardTraits: {
      'xmen-card': { team: 'x-men', heroClass: 'instinct' },
      'shield-card': { team: 'shield', heroClass: null },
    },
    cardStats: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

const REVEAL_EFFECT: HeroEffectDescriptor = {
  type: 'reveal-from-hand',
  revealCriterion: { kind: 'team', team: 'x-men' },
};

describe('Psychic Link parser (WP-659 / D-24470)', () => {
  it('AC-4: emits a reveal-from-hand effect with the team criterion and NO requiresTeam gate', () => {
    const hooks = buildHeroAbilityHooks(makeEmmaFrostRegistry(PSYCHIC_LINK_LINE), makeConfig());
    const psychicHook = hooks.find((hook) => hook.cardId.includes('psychic-link'));
    assert.ok(psychicHook !== undefined, 'a psychic-link hook must exist');

    // why: AC-4 — the criterion must be present AND correctly shaped (the descriptor field is
    // optional-by-shape, so a bare type check could miss a dropped criterion).
    assert.deepStrictEqual(
      psychicHook!.effects,
      [{ type: 'reveal-from-hand', revealCriterion: { kind: 'team', team: 'x-men' } }],
    );

    // why: AC-2 NEGATIVE — the spurious requiresTeam gate is gone. The mid-sentence [team:x-men]
    // is the reveal criterion, not a play-gate, so no requiresTeam condition is emitted.
    const conditions = psychicHook!.conditions ?? [];
    assert.equal(
      conditions.some((condition) => condition.type === 'requiresTeam'),
      false,
      'no requiresTeam gate — the mid-sentence [team:x-men] is a criterion, not a play-gate',
    );
  });
});

describe('Psychic Link handler (WP-659 / D-24470)', () => {
  it('AC-1: a player holding an X-Men Hero in hand draws one card', () => {
    const G = makeHandState({ '0': ['xmen-card'] }, { '0': ['deck-a', 'deck-b'] });
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['0']!.deck.length, 1, 'one card drawn from the deck');
    assert.equal(G.playerZones['0']!.hand.length, 2, 'the hand gained the drawn card');
  });

  it('AC-2: a player with no X-Men Hero draws nothing', () => {
    const G = makeHandState({ '0': ['shield-card'] }, { '0': ['deck-a', 'deck-b'] });
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['0']!.deck.length, 2, 'no draw — no qualifying Hero in hand');
    assert.equal(G.playerZones['0']!.hand.length, 1, 'hand unchanged');
  });

  it('AC-3: each player holding a match draws; a player with none does not (seat order)', () => {
    const G = makeHandState(
      { '0': ['xmen-card'], '1': ['xmen-card'], '2': ['shield-card'] },
      { '0': ['d0a', 'd0b'], '1': ['d1a', 'd1b'], '2': ['d2a', 'd2b'] },
    );
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['0']!.deck.length, 1, 'player 0 (X-Men in hand) drew');
    assert.equal(G.playerZones['1']!.deck.length, 1, 'player 1 (X-Men in hand) drew');
    assert.equal(G.playerZones['2']!.deck.length, 2, 'player 2 (no X-Men) did not draw');
  });

  it('AC-6: never throws on an empty hand or a card with no trait entry', () => {
    const emptyHand = makeHandState({ '0': [] }, { '0': ['deck-a'] });
    assert.doesNotThrow(() => executeSingleEffect(emptyHand, mockCtx, '0', 'psychic-link', REVEAL_EFFECT));
    assert.equal(emptyHand.playerZones['0']!.deck.length, 1, 'empty hand -> no draw');

    // a hand card with no cardTraits entry projects team undefined -> no match -> no draw
    const untypedHand = makeHandState({ '0': ['mystery-card'] }, { '0': ['deck-a'] });
    assert.doesNotThrow(() => executeSingleEffect(untypedHand, mockCtx, '0', 'psychic-link', REVEAL_EFFECT));
    assert.equal(untypedHand.playerZones['0']!.deck.length, 1, 'untyped hand card -> no match -> no draw');
  });
});
