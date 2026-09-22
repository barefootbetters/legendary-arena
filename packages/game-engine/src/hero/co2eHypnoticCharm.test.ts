/**
 * co2e Gambit "Hypnotic Charm" (2nd edition) — reveal each player's deck top + covert KO
 * (D-24558).
 *
 * Printed (co2e):
 *   1. "For each player, reveal the top card of their deck and you decide if that player
 *      discards it or puts it back."
 *   2. "[hc:covert]: You may KO the card you revealed from your own deck."
 *
 * The card shipped with NO effect markers, so neither ability ever fired (Jeff feedback,
 * Dr. Doom / Legacy Virus 2p, turns 20/22/26). Ability 1 now carries the WP-702 / D-24521
 * `reveal-top-dispose` + `reveal-top-dispose-others` markers (own deck + each other deck —
 * "for each player"); ability 2 carries the new `reveal-top-dispose-ko` marker, gated by the
 * free [hc:covert] heroClassMatch condition, which unlocks the optional 'ko' disposition on
 * the active player's OWN revealed top.
 *
 * These tests drive the REAL marked ability lines through buildHeroAbilityHooks →
 * executeHeroEffects → resolveRevealTopDispose so the wiring cannot drift from a
 * hand-authored hook.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects } from './heroEffects.execute.js';
import { resolveRevealTopDispose } from '../moves/revealTopDispose.resolve.js';
import type { LegendaryGameState } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: the exact co2e ability lines after the D-24558 hand edit (co2e is hand-authored and
// excluded from the cards:check regen) — verified against data/cards/co2e.json.
const REVEAL_ABILITY =
  'For each player, reveal the top card of their deck and you decide if that player discards it or puts it back. ' +
  '[keyword:reveal-top-dispose] [keyword:reveal-top-dispose-others]';
const COVERT_KO_ABILITY =
  '[hc:covert]: You may KO the card you revealed from your own deck. [keyword:reveal-top-dispose-ko]';

const CHARM_ID = 'co2e/gambit/hypnotic-charm#0';
const OTHER_COVERT_ID = 'co2e/gambit/stack-the-deck#0';
const WOUND = 'pile-wound';
const HERO_BENEATH = 'core/iron-man/repulsor-rays#0';
const P1_TOP = 'starting-shield-agent';

/** Builds a minimal getSet registry holding the co2e Gambit Hypnotic Charm card. */
function makeRegistry(): unknown {
  const cards = [
    { slug: 'hypnotic-charm', abilities: [REVEAL_ABILITY, COVERT_KO_ABILITY] },
  ];
  const setData = {
    abbr: 'co2e',
    heroes: [{ slug: 'gambit', cards, physicalCards: [{ id: 'p0', count: 1, sides: ['hypnotic-charm'] }] }],
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
    listSets: () => [{ abbr: 'co2e' }],
    getSet: (abbr: string) => (abbr === 'co2e' ? setData : undefined),
  };
}

/** A valid mock MatchSetupConfig selecting the co2e Gambit hero deck. */
function makeConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: ['co2e/gambit'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/** Parses the real marked ability lines into the Hypnotic Charm hooks. */
function hypnoticCharmHooks(): HeroAbilityHook[] {
  const hooks = buildHeroAbilityHooks(makeRegistry(), makeConfig());
  const charmHooks = hooks.filter((candidate) => candidate.cardId === CHARM_ID);
  assert.equal(charmHooks.length, 2, 'one hook per printed ability line');
  return charmHooks;
}

/**
 * Two-player state: P0 has Hypnotic Charm in play (optionally after another covert Hero),
 * a Wound on top of their deck; P1 has a S.H.I.E.L.D. Agent on top.
 *
 * @param hasOtherCovertInPlay - whether another covert Hero was played earlier this turn.
 */
function makeState(hasOtherCovertInPlay: boolean): LegendaryGameState {
  const inPlay = hasOtherCovertInPlay ? [OTHER_COVERT_ID, CHARM_ID] : [CHARM_ID];
  return {
    messages: [],
    currentStage: 'main',
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': { ...makePlayerZones(), deck: [WOUND, HERO_BENEATH], hand: [], inPlay, victory: [] },
      '1': { ...makePlayerZones(), deck: [P1_TOP], hand: [], inPlay: [], victory: [] },
    },
    piles: { ...makeGlobalPiles() },
    mastermind: makeMastermindState(),
    heroAbilityHooks: hypnoticCharmHooks(),
    cardTraits: {
      [CHARM_ID]: { heroClass: 'covert' },
      [OTHER_COVERT_ID]: { heroClass: 'covert' },
    },
    cardDisplayData: {},
    ko: [],
  } as unknown as LegendaryGameState;
}

const heroCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/** Builds a move context for resolveRevealTopDispose as the given player. */
function moveContext(G: LegendaryGameState, playerId: string): Parameters<typeof resolveRevealTopDispose>[0] {
  return {
    G,
    ctx: { numPlayers: 2, currentPlayer: playerId, phase: 'play', turn: 1, playOrder: ['0', '1'], playOrderPos: 0 },
    events: { endTurn: mock.fn(), setPhase: mock.fn() },
    random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
    playerID: playerId,
  } as unknown as Parameters<typeof resolveRevealTopDispose>[0];
}

describe('co2e Hypnotic Charm — reveal each deck top + covert KO (D-24558)', () => {
  it('parses: ability 1 reveals own + each other deck; ability 2 is covert-gated reveal-top-dispose-ko', () => {
    const [revealHook, koHook] = hypnoticCharmHooks();
    assert.deepEqual(
      revealHook!.effects.map((effect) => effect.type),
      ['reveal-top-dispose', 'reveal-top-dispose-others'],
      'own deck first, then each other deck ("for each player")',
    );
    assert.equal(revealHook!.conditions?.length ?? 0, 0, 'the reveal is unconditional');
    assert.deepEqual(koHook!.conditions, [{ type: 'heroClassMatch', value: 'covert' }]);
    assert.deepEqual(koHook!.effects.map((effect) => effect.type), ['reveal-top-dispose-ko']);
    for (const hook of [revealHook!, koHook!]) {
      assert.ok(
        hook.unresolvedMarkers === undefined || hook.unresolvedMarkers.length === 0,
        'no unresolved marker remains — the card is no longer hollow',
      );
    }
  });

  it('with no other covert Hero: reveals BOTH players\' deck tops, KO is NOT unlocked', () => {
    const G = makeState(false);
    executeHeroEffects(G, heroCtx, '0', CHARM_ID);

    const queue = G.pendingRevealTopDispose ?? [];
    assert.deepEqual(
      queue.map((choice) => choice.revealedTops),
      [[{ ownerPlayerID: '0', cardId: WOUND }], [{ ownerPlayerID: '1', cardId: P1_TOP }]],
      'own deck top and the other player\'s deck top are both revealed, neither KO-unlocked',
    );

    resolveRevealTopDispose(moveContext(G, '0'), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' });
    assert.deepEqual(G.ko, [], "'ko' is refused without the covert unlock");
    assert.equal(queue.length, 2, 'the refused KO leaves the queue intact for a legal resubmit');
  });

  it('after another covert Hero: the own revealed card may be KO\'d; the other player\'s may not', () => {
    const G = makeState(true);
    executeHeroEffects(G, heroCtx, '0', CHARM_ID);

    const queue = G.pendingRevealTopDispose ?? [];
    assert.equal(queue[0]!.revealedTops[0]!.isKoAllowed, true, 'the own revealed top is KO-unlocked');
    assert.equal(queue[1]!.revealedTops[0]!.isKoAllowed, undefined, 'the other player\'s top is never KO-unlocked');

    resolveRevealTopDispose(moveContext(G, '0'), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' });
    assert.deepEqual(G.ko, [WOUND], 'the revealed Wound was KO\'d');
    assert.deepEqual(G.playerZones['0']!.deck, [HERO_BENEATH], 'it left the top of the own deck');
    assert.deepEqual(G.playerZones['0']!.discard, [], 'a KO is not a discard');

    resolveRevealTopDispose(moveContext(G, '0'), { ownerPlayerID: '1', cardId: P1_TOP, disposition: 'ko' });
    assert.deepEqual(G.ko, [WOUND], "the other player's card cannot be KO'd");
    resolveRevealTopDispose(moveContext(G, '0'), { ownerPlayerID: '1', cardId: P1_TOP, disposition: 'discard' });
    assert.deepEqual(G.playerZones['1']!.discard, [P1_TOP], "the chooser decides the other player's discard");
    assert.equal(queue.length, 0, 'every revealed card resolved → queue empty');
  });
});
