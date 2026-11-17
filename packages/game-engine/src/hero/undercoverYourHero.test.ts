/**
 * "You may send one of your (other) Heroes Undercover" plays as printed (WP-901 / D-24858).
 *
 * Three bkwd lines parsed to a bare, handler-less [keyword:Undercover] (an honest hollow):
 * - Black Widow, Weave a Web of Spies, line 1: "If you drew any cards this turn, you may send one
 *   of your other Heroes Undercover." (draw-gated, wait-and-see);
 * - Black Widow, Infiltrate the Conspiracy, line 0: "You may send one of your Heroes Undercover.";
 * - Red Guardian, Death Was Only a Ruse, line 2: "[hc:covert]: You may send one of your other
 *   Heroes Undercover."
 *
 * These tests build the REAL hooks from the committed data/cards/bkwd.json, drive
 * executeHeroEffects / resolveDeferredHeroGrants, then resolve the parked pick through
 * resolveUndercoverChoice (and the bot through getLegalMoves), so they pin the parse, the park,
 * the resolve and the bot together.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeHeroEffects, executeSingleEffect, resolveDeferredHeroGrants } from './heroEffects.execute.js';
import { clearDeferredConditionalGrants } from './deferredConditionalGrants.js';
import {
  resolveUndercoverChoice,
  selectDefaultUndercoverYourHeroTarget,
} from '../moves/undercover.resolve.js';
import { getLegalMoves } from '../simulation/ai.legalMoves.js';
import { computeFinalScores } from '../scoring/scoring.logic.js';
import { buildUIState } from '../ui/uiState.build.js';
import { filterUIStateForAudience } from '../ui/uiState.filter.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import {
  BYSTANDER_EXT_ID,
  SHIELD_AGENT_EXT_ID,
  SHIELD_TROOPER_EXT_ID,
  WOUND_EXT_ID,
} from '../setup/pilesInit.js';
import type { LegendaryGameState, MatchConfiguration, PendingUndercoverChoice } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  makeCardRegistryReader,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// ca75OptionalKoShield.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const WEAVE_0 = 'bkwd/black-widow/weave-a-web-of-spies#0' as CardExtId;
const WEAVE_1 = 'bkwd/black-widow/weave-a-web-of-spies#1' as CardExtId;
const INFILTRATE = 'bkwd/black-widow/infiltrate-the-conspiracy#0' as CardExtId;
const RUSE = 'bkwd/red-guardian/death-was-only-a-ruse#0' as CardExtId;
const AGENT = SHIELD_AGENT_EXT_ID;
const TROOPER = SHIELD_TROOPER_EXT_ID;
const STRONG_HERO = 'test/strong-hero/big-punch#0' as CardExtId;
const COVERT_HERO = 'test/covert-hero/sneak#0' as CardExtId;
const RAW_LOG_WEAVE_WAITING = 'is waiting — it needs 1 or more cards drawn this turn — you have drawn 0.';

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

const LEGAL_MOVES_CONTEXT = { phase: 'play', turn: 1, currentPlayer: '0', numPlayers: 1 };

/**
 * Builds the real hooks for the two bkwd heroes from the committed card data.
 *
 * @returns Every hook Black Widow and Red Guardian produce.
 */
function buildBkwdHooks(): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'bkwd.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'bkwd' ? setData : undefined) };
  return buildHeroAbilityHooks(
    registry,
    { heroDeckIds: ['bkwd/black-widow', 'bkwd/red-guardian'] } as unknown as MatchConfiguration,
  );
}

const HOOKS = buildBkwdHooks();

/**
 * Returns a card copy's hooks, one per printed ability line.
 *
 * @param cardId - The per-copy card id.
 * @returns The hooks in printed order.
 */
function hooksOf(cardId: CardExtId): HeroAbilityHook[] {
  return HOOKS.filter((hook) => hook.cardId === cardId);
}

/**
 * Minimal state for driving the handlers, the resolve and the bot.
 *
 * @param zones - The player's hand and in-play cards.
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(zones: { hand: CardExtId[]; inPlay?: CardExtId[] }): LegendaryGameState {
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: {
      '0': { ...makePlayerZones(), hand: [...zones.hand], discard: [], inPlay: [...(zones.inPlay ?? [])], victory: [], undercover: [] },
    },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits: {
      [COVERT_HERO]: { team: 'avengers', heroClass: 'covert' },
      [STRONG_HERO]: { team: 'avengers', heroClass: 'strength' },
      [RUSE]: { team: null, heroClass: 'strength' },
    },
    cardDisplayData: {
      [AGENT]: { extId: AGENT, name: 'S.H.I.E.L.D. Agent', imageUrl: '', cost: 0 },
      [STRONG_HERO]: { extId: STRONG_HERO, name: 'Big Punch', imageUrl: '', cost: 6 },
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: HOOKS,
    villainAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays a card: puts it into play, then fires its hooks (the applyCardPlay order).
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The card being played.
 */
function play(G: LegendaryGameState, cardId: CardExtId): void {
  const zones = G.playerZones['0']!;
  zones.hand = zones.hand.filter((handCardId) => handCardId !== cardId);
  zones.inPlay = [...zones.inPlay, cardId];
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * Submits resolveUndercoverChoice for player 0.
 *
 * @param G - The game state, mutated in place.
 * @param args - The move payload.
 */
function resolve(G: LegendaryGameState, args: unknown): void {
  resolveUndercoverChoice({ G, playerID: '0', ...mockCtx } as never, args as never);
}

/**
 * The number of parked Undercover picks (read through a function so an earlier `undefined`
 * assertion does not narrow the field for the rest of the test).
 *
 * @param G - The game state.
 * @returns The queue length (0 when absent).
 */
function pendingCount(G: LegendaryGameState): number {
  return G.pendingUndercoverChoice?.length ?? 0;
}

/**
 * The texts of the log lines.
 *
 * @param G - The game state.
 * @returns Every message text in order.
 */
function logTexts(G: LegendaryGameState): string[] {
  return G.messages.map((line) => (typeof line === 'string' ? line : line.text));
}

describe('WP-901 parse — the three lines carry the source keyword, never the bare undercover', () => {
  it('Weave line 1: undercover-your-other-hero, gated on one draw this turn, no unresolved marker', () => {
    const line = hooksOf(WEAVE_0)[1]!;
    assert.ok(line.keywords.includes('undercover-your-other-hero'));
    assert.ok(!line.keywords.includes('undercover'), 'the bare token is descriptive here');
    assert.deepEqual(line.conditions, [{ type: 'cardsDrawnThisTurnAtLeast', value: '1' }]);
    assert.deepEqual(line.effects, [{ type: 'undercover-your-other-hero' }]);
    assert.equal(line.unresolvedMarkers, undefined);
  });

  it('Infiltrate line 0: undercover-your-hero, no condition', () => {
    const line = hooksOf(INFILTRATE)[0]!;
    assert.deepEqual(line.keywords, ['undercover-your-hero']);
    assert.equal(line.conditions, undefined);
    assert.deepEqual(line.effects, [{ type: 'undercover-your-hero' }]);
  });

  it('Ruse line 2: undercover-your-other-hero, keeps its covert gate', () => {
    const line = hooksOf(RUSE)[2]!;
    assert.ok(line.keywords.includes('undercover-your-other-hero'));
    assert.ok(!line.keywords.includes('undercover'));
    assert.deepEqual(line.conditions, [{ type: 'heroClassMatch', value: 'covert' }]);
    assert.equal(line.unresolvedMarkers, undefined);
  });
});

describe('WP-901 play — Weave waits for a draw; Infiltrate and Ruse park on play', () => {
  it('Weave with no draw parks nothing and logs the waiting line; a later draw parks one entry', () => {
    const G = makeState({ hand: [AGENT] });
    play(G, WEAVE_0);
    assert.equal(G.pendingUndercoverChoice, undefined, 'no draw yet → nothing parked');
    assert.ok(logTexts(G).some((text) => text.includes(RAW_LOG_WEAVE_WAITING)), 'the waiting line is logged');
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingUndercoverChoice, undefined, 'still no draw');
    G.turnEconomy.cardsDrawn = 1;
    resolveDeferredHeroGrants(G, mockCtx);
    assert.deepEqual(G.pendingUndercoverChoice, [{
      playerID: '0', cardId: WEAVE_0, source: 'your-hero',
      eligibleTargets: [AGENT], eligibleInPlayTargets: [], canDecline: true,
    }]);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(pendingCount(G), 1, 'the grant parks once, not on every later move');
  });

  it('Weave after a draw parks on play', () => {
    const G = makeState({ hand: [AGENT] });
    G.turnEconomy.cardsDrawn = 1;
    play(G, WEAVE_0);
    assert.equal(G.pendingUndercoverChoice!.length, 1);
  });

  it('Weave with no draw all turn never parks, and the grant is gone at turn end', () => {
    const G = makeState({ hand: [AGENT] });
    play(G, WEAVE_0);
    resolveDeferredHeroGrants(G, mockCtx);
    clearDeferredConditionalGrants(G);
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingUndercoverChoice, undefined);
  });

  it('Infiltrate parks with no gate, itself included', () => {
    const G = makeState({ hand: [AGENT], inPlay: [TROOPER] });
    play(G, INFILTRATE);
    const front = G.pendingUndercoverChoice![0]!;
    assert.deepEqual(front.eligibleTargets, [AGENT]);
    assert.deepEqual(front.eligibleInPlayTargets, [TROOPER, INFILTRATE], '"your Heroes" includes the card itself');
  });

  it('Ruse parks only with another Covert Hero played, and leaves itself out', () => {
    const noCovert = makeState({ hand: [AGENT], inPlay: [STRONG_HERO] });
    play(noCovert, RUSE);
    assert.equal(noCovert.pendingUndercoverChoice, undefined, 'no Covert Hero played → no pick');
    const withCovert = makeState({ hand: [AGENT], inPlay: [COVERT_HERO] });
    play(withCovert, RUSE);
    const front = withCovert.pendingUndercoverChoice![0]!;
    assert.equal(front.cardId, RUSE);
    assert.deepEqual(front.eligibleInPlayTargets, [COVERT_HERO], '"other" leaves out Ruse itself');
  });
});

describe('WP-901 eligibility — hand + in play Heroes only', () => {
  it('lists hand and in-play Heroes, leaves out Weave itself, never a Wound or a Bystander', () => {
    const G = makeState({ hand: [AGENT, WOUND_EXT_ID, BYSTANDER_EXT_ID, STRONG_HERO], inPlay: [TROOPER, WOUND_EXT_ID] });
    G.turnEconomy.cardsDrawn = 1;
    play(G, WEAVE_0);
    const front = G.pendingUndercoverChoice![0]!;
    assert.deepEqual(front.eligibleTargets, [AGENT, STRONG_HERO]);
    assert.deepEqual(front.eligibleInPlayTargets, [TROOPER]);
  });

  it('a second Weave copy stays eligible for the first (per-copy id)', () => {
    const G = makeState({ hand: [], inPlay: [WEAVE_1] });
    G.turnEconomy.cardsDrawn = 1;
    play(G, WEAVE_0);
    assert.deepEqual(G.pendingUndercoverChoice![0]!.eligibleInPlayTargets, [WEAVE_1]);
  });

  it('0 eligible parks nothing and logs why', () => {
    const other = makeState({ hand: [WOUND_EXT_ID] });
    other.turnEconomy.cardsDrawn = 1;
    play(other, WEAVE_0);
    assert.equal(other.pendingUndercoverChoice, undefined);
    assert.ok(logTexts(other).some((text) => text.startsWith('Player 0 had no other Hero to send Undercover for ')));
    const self = makeState({ hand: [] });
    executeSingleEffect(self, mockCtx, '0', INFILTRATE, { type: 'undercover-your-hero' } as never);
    assert.equal(self.pendingUndercoverChoice, undefined);
    assert.ok(logTexts(self).some((text) => text.startsWith('Player 0 had no Hero to send Undercover for ')));
  });
});

describe('WP-901 resolve — send from hand or play, decline, stale targets', () => {
  it('a hand send moves the card to the Victory Pile + tracker, names it in the log, pops; +1 VP', () => {
    const G = makeState({ hand: [AGENT], inPlay: [TROOPER] });
    play(G, INFILTRATE);
    resolve(G, { targetExtId: AGENT });
    const zones = G.playerZones['0']!;
    assert.deepEqual(zones.hand, []);
    assert.deepEqual(zones.victory, [AGENT]);
    assert.deepEqual(zones.undercover, [AGENT]);
    assert.deepEqual(G.pendingUndercoverChoice, []);
    assert.ok(logTexts(G).includes(`Player 0 sent S.H.I.E.L.D. Agent (${AGENT}) Undercover (into the Victory Pile, +1 VP).`));
    assert.equal(computeFinalScores(G).players[0]!.undercoverVP, 1);
    assert.equal('leftPlayPlayedCardIds' in G.turnEconomy, false, 'a hand send is not a left-play exit');
  });

  it('an in-play send leaves play, is recorded as played this turn (WP-899), and pops', () => {
    const G = makeState({ hand: [], inPlay: [TROOPER] });
    play(G, INFILTRATE);
    resolve(G, { targetExtId: TROOPER, zone: 'inPlay' });
    const zones = G.playerZones['0']!;
    assert.deepEqual(zones.inPlay, [INFILTRATE]);
    assert.deepEqual(zones.victory, [TROOPER]);
    assert.deepEqual(zones.undercover, [TROOPER]);
    assert.deepEqual(G.turnEconomy.leftPlayPlayedCardIds, [TROOPER]);
    assert.deepEqual(G.pendingUndercoverChoice, []);
  });

  it('decline pops, changes no zone, and logs it', () => {
    const G = makeState({ hand: [AGENT], inPlay: [TROOPER] });
    play(G, INFILTRATE);
    resolve(G, { decline: true });
    const zones = G.playerZones['0']!;
    assert.deepEqual(zones.hand, [AGENT]);
    assert.deepEqual(zones.inPlay, [TROOPER, INFILTRATE]);
    assert.deepEqual(zones.victory, []);
    assert.deepEqual(G.pendingUndercoverChoice, []);
    assert.ok(logTexts(G).includes('Player 0 chose not to send a Hero Undercover.'));
  });

  it('a payload with both decline and targetExtId is refused without popping', () => {
    const G = makeState({ hand: [AGENT] });
    play(G, INFILTRATE);
    resolve(G, { decline: true, targetExtId: AGENT });
    assert.equal(G.pendingUndercoverChoice!.length, 1);
    assert.deepEqual(G.playerZones['0']!.victory, []);
  });

  it('a target outside its zone snapshot, or a bad zone, is refused without popping', () => {
    const G = makeState({ hand: [AGENT], inPlay: [TROOPER] });
    play(G, INFILTRATE);
    resolve(G, { targetExtId: AGENT, zone: 'inPlay' });
    resolve(G, { targetExtId: TROOPER });
    resolve(G, { targetExtId: AGENT, zone: 'deck' });
    assert.equal(G.pendingUndercoverChoice!.length, 1);
    assert.deepEqual(G.playerZones['0']!.victory, []);
  });

  it('a stale your-hero target (moved away) returns without popping', () => {
    const G = makeState({ hand: [AGENT], inPlay: [TROOPER] });
    play(G, INFILTRATE);
    G.playerZones['0']!.hand = [];
    resolve(G, { targetExtId: AGENT });
    assert.equal(G.pendingUndercoverChoice!.length, 1, 'the pick stays open');
    assert.deepEqual(G.playerZones['0']!.victory, []);
  });

  it('a hand-shield entry keeps today\'s path: a stale target still pops; decline and inPlay are refused', () => {
    const handShield: PendingUndercoverChoice = {
      playerID: '0', cardId: 'test/coulson#0', source: 'hand-shield-hero', eligibleTargets: [AGENT, TROOPER],
    };
    const G = makeState({ hand: [AGENT], inPlay: [TROOPER] });
    G.pendingUndercoverChoice = [{ ...handShield, eligibleTargets: [...handShield.eligibleTargets] }];
    resolve(G, { decline: true });
    resolve(G, { targetExtId: TROOPER, zone: 'inPlay' });
    assert.equal(G.pendingUndercoverChoice.length, 1, 'decline / inPlay refused on a hand-shield entry');
    resolve(G, { targetExtId: TROOPER });
    assert.deepEqual(G.pendingUndercoverChoice, [], 'a stale hand-shield target still pops (no freeze)');
    assert.deepEqual(G.playerZones['0']!.victory, [], 'the stale send is a no-op');
  });

  it('a hand-shield send logs the raw id exactly as before', () => {
    const G = makeState({ hand: [AGENT, TROOPER] });
    G.pendingUndercoverChoice = [{
      playerID: '0', cardId: 'test/coulson#0', source: 'hand-shield-hero', eligibleTargets: [AGENT, TROOPER],
    }];
    resolve(G, { targetExtId: AGENT });
    assert.deepEqual(logTexts(G), [`Player 0 sent ${AGENT} Undercover (into the Victory Pile, +1 VP).`]);
  });
});

describe('WP-901 bot — a played Agent / Trooper, then one in hand, else decline', () => {
  it('an Agent in play beats an Agent in hand', () => {
    const G = makeState({ hand: [AGENT], inPlay: [STRONG_HERO, TROOPER] });
    play(G, INFILTRATE);
    assert.deepEqual(getLegalMoves(G, LEGAL_MOVES_CONTEXT), [
      { name: 'resolveUndercoverChoice', args: { targetExtId: TROOPER, zone: 'inPlay' } },
    ]);
  });

  it('an Agent in hand beats a decline', () => {
    const G = makeState({ hand: [STRONG_HERO, AGENT], inPlay: [STRONG_HERO] });
    play(G, INFILTRATE);
    assert.deepEqual(getLegalMoves(G, LEGAL_MOVES_CONTEXT), [
      { name: 'resolveUndercoverChoice', args: { targetExtId: AGENT, zone: 'hand' } },
    ]);
  });

  it('a strong-Hero-only set declines', () => {
    const G = makeState({ hand: [STRONG_HERO] });
    play(G, INFILTRATE);
    assert.deepEqual(getLegalMoves(G, LEGAL_MOVES_CONTEXT), [
      { name: 'resolveUndercoverChoice', args: { decline: true } },
    ]);
  });

  it('a stale snapshot Agent is skipped (next Agent, or decline)', () => {
    const front: PendingUndercoverChoice = {
      playerID: '0', cardId: INFILTRATE, source: 'your-hero',
      eligibleTargets: [AGENT], eligibleInPlayTargets: [TROOPER], canDecline: true,
    };
    assert.deepEqual(selectDefaultUndercoverYourHeroTarget(front, { hand: [AGENT], inPlay: [] }), { zone: 'hand', targetExtId: AGENT });
    assert.equal(selectDefaultUndercoverYourHeroTarget(front, { hand: [], inPlay: [] }), null);
  });

  it('the bot answer always resolves (no getLegalMoves loop)', () => {
    const G = makeState({ hand: [AGENT], inPlay: [TROOPER] });
    play(G, INFILTRATE);
    const [move] = getLegalMoves(G, LEGAL_MOVES_CONTEXT);
    resolve(G, move!.args);
    assert.deepEqual(G.pendingUndercoverChoice, []);
  });
});

describe('WP-901 multi-entry queue — two deferred Weave grants, one draw', () => {
  it('parks two entries; the second never offers the card the first sent', () => {
    const G = makeState({ hand: [AGENT] });
    play(G, WEAVE_0);
    play(G, WEAVE_1);
    assert.equal(G.pendingUndercoverChoice, undefined, 'both wait for a draw');
    G.turnEconomy.cardsDrawn = 1;
    resolveDeferredHeroGrants(G, mockCtx);
    assert.equal(G.pendingUndercoverChoice!.length, 2);
    assert.deepEqual(G.pendingUndercoverChoice![0]!.eligibleInPlayTargets, [WEAVE_1]);
    assert.deepEqual(G.pendingUndercoverChoice![1]!.eligibleInPlayTargets, [WEAVE_0]);

    resolve(G, { targetExtId: AGENT });
    assert.equal(G.pendingUndercoverChoice!.length, 1);
    const second = G.pendingUndercoverChoice![0]!;
    assert.deepEqual(second.eligibleTargets, [AGENT], 'the snapshot still names the sent card');

    resolve(G, { targetExtId: AGENT });
    assert.equal(G.pendingUndercoverChoice!.length, 1, 'the resolve refuses the sent card without popping');

    assert.deepEqual(getLegalMoves(G, LEGAL_MOVES_CONTEXT), [
      { name: 'resolveUndercoverChoice', args: { decline: true } },
    ], 'the bot does not offer the sent card');

    const projected = projectUndercoverPick(G);
    assert.deepEqual(projected.eligibleHand, [], 'the projection omits the sent card');
    assert.deepEqual(projected.eligibleInPlay.map((entry) => entry.cardId), [WEAVE_0]);
  });
});

/**
 * Projects G's Undercover pick through buildUIState + filterUIStateForAudience for the chooser,
 * by grafting the test state's zones and queue onto a full initial state.
 *
 * @param G - The test state carrying the pick.
 * @returns The chooser's named targets.
 */
function projectUndercoverPick(G: LegendaryGameState): { eligibleHand: { cardId: string }[]; eligibleInPlay: { cardId: string }[] } {
  const config: MatchSetupConfig = {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 0,
  };
  const full = buildInitialGameState(config, makeCardRegistryReader(), makeMockCtx());
  full.playerZones['0']!.hand = [...G.playerZones['0']!.hand];
  full.playerZones['0']!.inPlay = [...G.playerZones['0']!.inPlay];
  full.pendingUndercoverChoice = G.pendingUndercoverChoice;
  const filtered = filterUIStateForAudience(buildUIState(full, mockCtx as never), { kind: 'player', playerId: '0' });
  const pending = filtered.pendingUndercoverChoice!;
  assert.equal(pending.canDecline, true);
  return { eligibleHand: pending.eligibleHand!, eligibleInPlay: pending.eligibleInPlay! };
}
