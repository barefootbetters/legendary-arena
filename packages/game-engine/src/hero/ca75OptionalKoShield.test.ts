/**
 * Cap 75th optional-KO S.H.I.E.L.D. family plays as printed (WP-826 / D-24759).
 *
 * Two ca75 lines did nothing before this packet (their only parse was a gate):
 * - Mobilize for War (Agent X-13), line 0: "KO up to two [team:shield] Heroes from your hand and/or
 *   discard pile." — and line 1, "[keyword:Savior]: For each card KO'd this way, you get
 *   +1[icon:attack].", was a FLAT +1 under the Savior gate, KO or no KO;
 * - Reassign to Civilian Duty (Steve Rogers), "[team:shield][team:shield][team:shield]: You may KO a
 *   [team:shield] Hero that you played this turn. If you do, rescue a Bystander."
 *
 * These tests build the REAL hooks from the committed data/cards/ca75.json (the markers pass output),
 * drive executeHeroEffects, then resolve the parked choices through resolveOptionalKoReward, so they
 * pin the parse, the park and the reward together.
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
import { resolveOptionalKoReward } from '../moves/optionalKoReward.resolve.js';
import { WAIT_AND_SEE_CONDITION_TYPES } from './deferredConditionalGrants.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// doubledSuperpowerIcon.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const BYSTANDER = 'pile-bystander';
const SHIELD_AGENT = 'starting-shield-agent';
const SHIELD_TROOPER = 'starting-shield-trooper';
const SHIELD_OFFICER = 'pile-shield-officer';
const AVENGER = 'test/avenger/punch#0';

const mockCtx = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds the real hooks for one ca75 hero deck from the committed card data.
 *
 * @param heroSlug - The ca75 hero slug.
 * @returns Every hook the hero deck produces.
 */
function buildCa75HeroHooks(heroSlug: string): HeroAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'ca75.json'), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'ca75' ? setData : undefined) };
  return buildHeroAbilityHooks(registry, { heroDeckIds: [`ca75/${heroSlug}`] } as unknown as MatchConfiguration);
}

/**
 * Returns the hooks of the first copy of a card.
 *
 * @param hooks - The hero deck's hooks.
 * @param cardSlug - The card slug.
 * @returns The first copy's card id and its hooks (one per printed ability line).
 */
function firstCopyHooks(hooks: HeroAbilityHook[], cardSlug: string): { cardId: CardExtId; cardHooks: HeroAbilityHook[] } {
  const firstHook = hooks.find((hook) => hook.cardId.includes(`/${cardSlug}#`));
  assert.ok(firstHook !== undefined, `the ca75 data builds a hook for ${cardSlug}`);
  const cardId = firstHook.cardId;
  return { cardId, cardHooks: hooks.filter((hook) => hook.cardId === cardId) };
}

/**
 * Minimal state for driving executeHeroEffects and resolveOptionalKoReward.
 *
 * @param hooks - The hero ability hooks the match carries.
 * @param shieldCardIds - Card ids whose printed team is S.H.I.E.L.D. (the tokens need no row).
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(hooks: HeroAbilityHook[], shieldCardIds: string[]): LegendaryGameState {
  const cardTraits: Record<string, object> = { [AVENGER]: { team: 'avengers', heroClass: 'strength' } };
  for (const shieldCardId of shieldCardIds) {
    cardTraits[shieldCardId] = { team: 'shield', heroClass: 'instinct' };
  }
  const piles = makeGlobalPiles();
  piles.bystanders = [BYSTANDER as CardExtId, BYSTANDER as CardExtId, BYSTANDER as CardExtId];
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), hand: [], discard: [], inPlay: [], victory: [] } },
    piles,
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits,
    cardDisplayData: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays a card after the given cards, with the given hand, discard pile and Victory Pile.
 *
 * @param G - The game state, mutated in place.
 * @param setup - Cards played earlier this turn, hand, discard pile and Victory Pile.
 * @param cardId - The card being played now.
 */
function play(
  G: LegendaryGameState,
  setup: { playedBefore: string[]; hand: string[]; discard: string[]; victory: string[] },
  cardId: CardExtId,
): void {
  const playerZones = G.playerZones['0']!;
  playerZones.inPlay = [...(setup.playedBefore as CardExtId[]), cardId];
  playerZones.hand = [...(setup.hand as CardExtId[])];
  playerZones.discard = [...(setup.discard as CardExtId[])];
  playerZones.victory = [...(setup.victory as CardExtId[])];
  executeHeroEffects(G, mockCtx, '0', cardId);
}

/**
 * Resolves the front optional-KO choice for player 0.
 *
 * @param G - The game state, mutated in place.
 * @param args - The decline flag or the { zone, cardId } to KO.
 */
function resolve(
  G: LegendaryGameState,
  args: { decline: true } | { zone: 'hand' | 'discard' | 'inPlay'; cardId: string },
): void {
  resolveOptionalKoReward({ G, playerID: '0', ...mockCtx } as never, args as never);
}

const SAVIOR_VICTORY = [BYSTANDER, BYSTANDER, BYSTANDER];

describe('ca75 Mobilize for War — KO up to two S.H.I.E.L.D. Heroes; Savior: +1 Attack per card KO\'d (WP-826)', () => {
  const hooks = buildCa75HeroHooks('agent-x-13');
  const { cardId, cardHooks } = firstCopyHooks(hooks, 'mobilize-for-war');

  it('T1 parses line 0 to an ungated KO-up-to-two and line 1 to a Savior-gated per-KO attack with no flat attack', () => {
    assert.equal(cardHooks.length, 2, 'one hook per printed ability line');
    assert.deepEqual(cardHooks[0]!.conditions ?? [], [], 'the descriptive [team:shield] is not a play gate');
    assert.deepEqual(cardHooks[0]!.effects, [{ type: 'ko-up-to-shield-hand-discard', magnitude: 2 }]);
    assert.deepEqual(cardHooks[1]!.conditions, [{ type: 'bystandersInVictoryAtLeast', value: '3' }]);
    assert.deepEqual(cardHooks[1]!.effects, [{ type: 'attack-per-ko-this-way', magnitude: 1 }]);
    // why: D-24759 — the upgrade relies on the Savior gate being judged at play, right after line 0
    // parks; a wait-and-see Savior would re-fire later against an empty queue.
    assert.ok(!WAIT_AND_SEE_CONDITION_TYPES.includes('bystandersInVictoryAtLeast'), 'Savior is evaluated at play');
  });

  it('T2 parks two shield-only hand / discard entries; without Savior they carry no reward and play grants no Attack', () => {
    const G = makeState(hooks, []);
    play(G, { playedBefore: [], hand: [SHIELD_AGENT, AVENGER], discard: [SHIELD_OFFICER], victory: [] }, cardId);
    assert.equal(G.turnEconomy.attack, 0, 'no flat Attack at play time');
    assert.deepEqual(G.pendingOptionalKoRewards, [
      { playerID: '0', rewardType: 'none', rewardMagnitude: 0, sourceCardId: cardId, koZones: ['hand', 'discard'], koTeamFilter: 'shield' },
      { playerID: '0', rewardType: 'none', rewardMagnitude: 0, sourceCardId: cardId, koZones: ['hand', 'discard'], koTeamFilter: 'shield' },
    ]);
    resolve(G, { zone: 'hand', cardId: SHIELD_AGENT });
    resolve(G, { zone: 'discard', cardId: SHIELD_OFFICER });
    assert.equal(G.turnEconomy.attack, 0, 'a non-Savior KO grants nothing');
    assert.deepEqual(G.ko, [SHIELD_AGENT, SHIELD_OFFICER]);
    assert.deepEqual(G.pendingOptionalKoRewards, []);
  });

  it('T3 as a Savior, KOing two S.H.I.E.L.D. Heroes grants +2 Attack (one per card KO\'d)', () => {
    const G = makeState(hooks, []);
    play(G, { playedBefore: [], hand: [SHIELD_AGENT], discard: [SHIELD_TROOPER], victory: SAVIOR_VICTORY }, cardId);
    assert.equal(G.turnEconomy.attack, 0, 'the Attack waits for the KOs');
    assert.equal(G.pendingOptionalKoRewards!.length, 2);
    for (const entry of G.pendingOptionalKoRewards!) {
      assert.equal(entry.rewardType, 'attack');
      assert.equal(entry.rewardMagnitude, 1);
    }
    resolve(G, { zone: 'discard', cardId: SHIELD_TROOPER });
    assert.equal(G.turnEconomy.attack, 1);
    resolve(G, { zone: 'hand', cardId: SHIELD_AGENT });
    assert.equal(G.turnEconomy.attack, 2);
  });

  it('T4 as a Savior, KOing one then declining the second grants +1 Attack', () => {
    const G = makeState(hooks, []);
    play(G, { playedBefore: [], hand: [SHIELD_AGENT, SHIELD_TROOPER], discard: [], victory: SAVIOR_VICTORY }, cardId);
    resolve(G, { zone: 'hand', cardId: SHIELD_AGENT });
    resolve(G, { decline: true });
    assert.equal(G.turnEconomy.attack, 1);
    assert.deepEqual(G.playerZones['0']!.hand, [SHIELD_TROOPER]);
  });

  it('T5 with one eligible S.H.I.E.L.D. Hero only one choice parks', () => {
    const G = makeState(hooks, []);
    play(G, { playedBefore: [], hand: [AVENGER], discard: [SHIELD_AGENT], victory: SAVIOR_VICTORY }, cardId);
    assert.equal(G.pendingOptionalKoRewards!.length, 1);
    resolve(G, { zone: 'discard', cardId: SHIELD_AGENT });
    assert.equal(G.turnEconomy.attack, 1);
  });

  it('T6 a non-S.H.I.E.L.D. target is rejected and leaves the choice open', () => {
    const G = makeState(hooks, []);
    play(G, { playedBefore: [], hand: [AVENGER, SHIELD_AGENT], discard: [], victory: SAVIOR_VICTORY }, cardId);
    resolve(G, { zone: 'hand', cardId: AVENGER });
    assert.deepEqual(G.ko, [], 'the Avenger is not KO\'d');
    assert.equal(G.pendingOptionalKoRewards!.length, 1, 'the one eligible choice is still pending');
  });

  it('T15 the Savior upgrade leaves an entry from another card untouched', () => {
    const G = makeState(hooks, []);
    G.pendingOptionalKoRewards = [
      { playerID: '0', rewardType: 'none', rewardMagnitude: 0, sourceCardId: 'other#0' as CardExtId },
    ];
    play(G, { playedBefore: [], hand: [SHIELD_AGENT, SHIELD_TROOPER], discard: [], victory: SAVIOR_VICTORY }, cardId);
    assert.equal(G.pendingOptionalKoRewards!.length, 3);
    assert.deepEqual(G.pendingOptionalKoRewards![0], { playerID: '0', rewardType: 'none', rewardMagnitude: 0, sourceCardId: 'other#0' });
    assert.equal(G.pendingOptionalKoRewards![1]!.rewardType, 'attack');
    assert.equal(G.pendingOptionalKoRewards![2]!.rewardType, 'attack');
  });

  it('T7 with no S.H.I.E.L.D. Hero in hand or discard nothing parks and both lines log why', () => {
    const G = makeState(hooks, []);
    play(G, { playedBefore: [], hand: [AVENGER], discard: [], victory: SAVIOR_VICTORY }, cardId);
    assert.equal(G.pendingOptionalKoRewards ?? undefined, undefined, 'nothing parks');
    assert.equal(G.turnEconomy.attack, 0);
    assert.ok(G.messages.some((line) => line.text.includes('could not KO a S.H.I.E.L.D. Hero')));
    assert.ok(G.messages.some((line) => line.text.includes("for each card KO'd this way")));
  });
});

describe('ca75 Reassign to Civilian Duty — KO a S.H.I.E.L.D. Hero you played this turn, then rescue (WP-826)', () => {
  const hooks = buildCa75HeroHooks('steve-rogers-director-of-shield');
  const { cardId, cardHooks } = firstCopyHooks(hooks, 'reassign-to-civilian-duty');

  it('T8 parses to the triple S.H.I.E.L.D. gate and the played-this-turn KO-then-rescue', () => {
    assert.equal(cardHooks.length, 1);
    assert.deepEqual(cardHooks[0]!.conditions, [{ type: 'requiresTeam', value: 'shield', requiredMatches: 3 }]);
    assert.deepEqual(cardHooks[0]!.effects, [{ type: 'optional-ko-shield-played-rescue', magnitude: 1 }]);
  });

  it('T9 after three other S.H.I.E.L.D. Heroes it parks one played-this-turn entry; KOing one rescues a Bystander', () => {
    const G = makeState(hooks, [cardId]);
    play(G, { playedBefore: [SHIELD_AGENT, SHIELD_TROOPER, SHIELD_OFFICER, AVENGER], hand: [SHIELD_AGENT], discard: [], victory: [] }, cardId);
    assert.deepEqual(G.pendingOptionalKoRewards, [
      { playerID: '0', rewardType: 'rescue', rewardMagnitude: 1, sourceCardId: cardId, koZones: ['inPlay'], koTeamFilter: 'shield' },
    ]);
    resolve(G, { zone: 'inPlay', cardId: SHIELD_TROOPER });
    assert.deepEqual(G.ko, [SHIELD_TROOPER]);
    assert.deepEqual(G.playerZones['0']!.victory, [BYSTANDER], 'the Bystander is rescued');
    assert.equal(G.piles.bystanders.length, 2);
  });

  it('T10 a hand S.H.I.E.L.D. Hero or a played non-S.H.I.E.L.D. Hero is rejected; the card itself is a legal target', () => {
    const G = makeState(hooks, [cardId]);
    play(G, { playedBefore: [SHIELD_AGENT, SHIELD_TROOPER, SHIELD_OFFICER, AVENGER], hand: [SHIELD_AGENT], discard: [], victory: [] }, cardId);
    resolve(G, { zone: 'hand', cardId: SHIELD_AGENT });
    resolve(G, { zone: 'inPlay', cardId: AVENGER });
    assert.deepEqual(G.ko, [], 'neither rejected target is KO\'d');
    assert.equal(G.pendingOptionalKoRewards!.length, 1, 'the choice is still pending');
    resolve(G, { zone: 'inPlay', cardId });
    assert.deepEqual(G.ko, [cardId], 'Reassign may KO itself (a S.H.I.E.L.D. Hero played this turn)');
    assert.deepEqual(G.playerZones['0']!.victory, [BYSTANDER]);
  });

  it('T11 declining KOs nothing and rescues nothing', () => {
    const G = makeState(hooks, [cardId]);
    play(G, { playedBefore: [SHIELD_AGENT, SHIELD_TROOPER, SHIELD_OFFICER], hand: [], discard: [], victory: [] }, cardId);
    resolve(G, { decline: true });
    assert.deepEqual(G.ko, []);
    assert.deepEqual(G.playerZones['0']!.victory, []);
    assert.deepEqual(G.pendingOptionalKoRewards, []);
  });

  it('T12 with only two other S.H.I.E.L.D. Heroes the gate fails and nothing parks', () => {
    const G = makeState(hooks, [cardId]);
    play(G, { playedBefore: [SHIELD_AGENT, SHIELD_TROOPER, AVENGER], hand: [], discard: [], victory: [] }, cardId);
    assert.equal(G.pendingOptionalKoRewards ?? undefined, undefined);
  });
});
