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

/** A game state with the given player hands, decks and play areas, for handler tests. */
function makeHandState(
  hands: Record<string, string[]>,
  decks: Record<string, string[]>,
  inPlay: Record<string, string[]> = {},
): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const playerId of Object.keys(hands)) {
    playerZones[playerId] = {
      ...makePlayerZones(),
      hand: hands[playerId],
      deck: decks[playerId] ?? [],
      inPlay: inPlay[playerId] ?? [],
    };
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
      // why: Psychic Link is itself an X-Men Hero, so the "another" exclusion is load-bearing.
      'psychic-link': { team: 'x-men', heroClass: 'covert' },
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

  it('D-24668: when no player holds a match, one blocked line says no one drew', () => {
    const G = makeHandState(
      { '0': ['shield-card'], '1': ['shield-card'] },
      { '0': ['d0a'], '1': ['d1a'] },
    );
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    const noRevealLines = G.messages.filter((entry) =>
      /No player had a matching Hero to reveal for .*psychic-link.*, so no one drew\./.test(entry.text));
    assert.equal(noRevealLines.length, 1, 'exactly one no-reveal line');
    assert.equal(noRevealLines[0]!.outcome, 'blocked');
  });

  it('D-24668: no no-reveal line when at least one player revealed', () => {
    const G = makeHandState(
      { '0': ['shield-card'], '1': ['xmen-card'] },
      { '0': ['d0a'], '1': ['d1a'] },
    );
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.ok(!G.messages.some((entry) => entry.text.startsWith('No player had a matching Hero')));
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

// why: D-24731 — rules v23 "Revealing a Card" (L3186-3190): "You can reveal a card from your
// hand or you can reveal a card in front of you that you have already played this turn." The
// handler used to scan the hand only, so an X-Men Hero played before Psychic Link drew nothing.
describe('Psychic Link reveals a card played this turn (D-24731)', () => {
  it('the playing player with a played X-Men Hero and no X-Men in hand draws', () => {
    const G = makeHandState(
      { '0': ['shield-card'] },
      { '0': ['deck-a', 'deck-b'] },
      { '0': ['xmen-card', 'psychic-link'] },
    );
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['0']!.deck.length, 1, 'one card drawn from the deck');
    assert.equal(G.playerZones['0']!.hand.length, 2, 'the hand gained the drawn card');
    assert.deepStrictEqual(G.playerZones['0']!.inPlay, ['xmen-card', 'psychic-link'], 'the reveal moves nothing');
    assert.ok(!G.messages.some((entry) => entry.text.startsWith('No player had a matching Hero')));
  });

  it('Psychic Link alone in play does not reveal itself ("another")', () => {
    const G = makeHandState(
      { '0': ['shield-card'] },
      { '0': ['deck-a', 'deck-b'] },
      { '0': ['psychic-link'] },
    );
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['0']!.deck.length, 2, 'no draw — the only X-Men in play is the card itself');
    const noRevealLines = G.messages.filter((entry) => entry.text.startsWith('No player had a matching Hero'));
    assert.equal(noRevealLines.length, 1, 'the D-24668 no-reveal line still fires');
  });

  it('another player with an X-Men Hero in hand still draws', () => {
    const G = makeHandState(
      { '0': ['shield-card'], '1': ['xmen-card'] },
      { '0': ['d0a', 'd0b'], '1': ['d1a', 'd1b'] },
      { '0': ['psychic-link'] },
    );
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['0']!.deck.length, 2, 'player 0 has only Psychic Link in play — no draw');
    assert.equal(G.playerZones['1']!.deck.length, 1, 'player 1 (X-Men in hand) drew');
  });

  it('another player reveals from hand only, never from their play area', () => {
    const G = makeHandState(
      { '0': ['xmen-card'], '1': ['shield-card'] },
      { '0': ['d0a', 'd0b'], '1': ['d1a', 'd1b'] },
      { '0': ['psychic-link'], '1': ['xmen-card'] },
    );
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['1']!.deck.length, 2, 'player 1 has played nothing this turn — no draw');
  });

  it('a played card that left play (Out of Time) does not count', () => {
    const G = makeHandState(
      { '0': ['shield-card'] },
      { '0': ['xmen-card', 'deck-a', 'deck-b'] },
      { '0': ['psychic-link'] },
    );
    // why: D-24692 — the X-Men Hero was played this turn, then moved to the deck; the Out of
    // Time ledger still lists it as played, but it is no longer in front of the player.
    G.turnEconomy = { ...G.turnEconomy, outOfTimePlayedCardIds: ['xmen-card'] };
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['0']!.deck.length, 3, 'no draw — the played X-Men Hero is no longer in play');
  });

  it('a played Copy Powers card that copied an X-Men team counts', () => {
    const G = makeHandState(
      { '0': ['shield-card'] },
      { '0': ['deck-a', 'deck-b'] },
      { '0': ['copy-card', 'psychic-link'] },
    );
    // why: D-24391 / D-24726 — the copied team is the card's team for this play.
    G.cardTraits['copy-card'] = { team: 'avengers', heroClass: 'covert' };
    G.cardCopiedTeams = { 'copy-card': ['x-men'] };
    executeSingleEffect(G, mockCtx, '0', 'psychic-link', REVEAL_EFFECT);

    assert.equal(G.playerZones['0']!.deck.length, 1, 'the copy counts as an X-Men Hero in play');
  });
});
