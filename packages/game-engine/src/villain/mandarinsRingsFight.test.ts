/**
 * Mandarin's Rings own-deck Fight lines (WP-870 / D-24815).
 *
 * Lightning, The Electro-Blast (and antm Daystar) — "Reveal the top card of your deck. You may KO
 * it." — parks the WP-754 KO-or-keep entry. Spin, The Vortex Beam — "Reveal the top six cards of
 * your deck. Discard all of them that cost 0, then put the rest back in any order." — discards the
 * cost-0 cards and parks the WP-479 reorder. Zero, The Ice Blast — "Choose a card you played this
 * turn that costs 0. When you draw a new hand of cards at the end of this turn, add that card to
 * your hand as an extra card." — queues a pick the onMove opener resolves into
 * G.deferredHandInjections. resolveReorderChoice now drops a drifted front (T16).
 *
 * Parser cases build the real hooks from the committed card data; handler cases dispatch through
 * executeVillainAbilities. T17 alone drives boardgame.io's own reducer (the WP-411 / D-24223
 * exception); no other case touches boardgame.io. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// why: WP-411 / D-24223 — T17 drives a REAL boardgame.io match through the framework's own
// reducer to prove the game.ts turn.onMove opener is wired (the game.test.ts precedent, also
// divingBlock.multiSeatWave.test.ts). The deep dist entry is the same one the server-layer replay
// / competition tests use (matchReplay.logic.test.ts, competition.logic.test.ts); it exposes
// InitializeGame + CreateGameReducer and carries no types (cast below). This is the ONLY vehicle
// that exercises the boardgame.io wiring — the engine-runner simulation harness re-implements the
// turn loop.
import * as boardgameInternal from 'boardgame.io/dist/cjs/internal.js';
import { LegendaryGame } from '../game.js';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { executeVillainAbilities } from './villainEffects.execute.js';
import { resolveRevealTopDispose } from '../moves/revealTopDispose.resolve.js';
import { resolveReorderChoice } from '../moves/reorderChoice.resolve.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import { moveCardFromZone } from '../moves/zoneOps.js';
import {
  NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND,
  openNextHandFromPlaySeatChoiceIfNeeded,
} from '../moves/nextHandFromPlay.logic.js';
import { applyOnBeginParity } from '../simulation/onBeginParity.js';
import { SHIELD_AGENT_EXT_ID, SHIELD_TROOPER_EXT_ID, WOUND_EXT_ID } from '../setup/pilesInit.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';

// why: the deep dist entry carries no types; cast to the minimal shape T17 uses — mirrors the
// game.test.ts precedent.
const { InitializeGame, CreateGameReducer } = boardgameInternal as unknown as {
  InitializeGame(config: { game: unknown; numPlayers: number; setupData: unknown }): {
    G: unknown;
    ctx: { currentPlayer: unknown };
  };
  CreateGameReducer(config: { game: unknown; isClient: boolean }): (
    state: unknown,
    action: { type: string; payload: unknown },
  ) => { G: unknown; ctx: { currentPlayer: unknown } };
};

// why: resolve the repo-root data directory from this test's own location (the
// koFromDiscardMandatory.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const LIGHTNING = 'henchman-mandarins-rings-04' as CardExtId;
const SPIN = 'henchman-mandarins-rings-08' as CardExtId;
const ZERO = 'henchman-mandarins-rings-09' as CardExtId;
const AGENT = SHIELD_AGENT_EXT_ID as CardExtId;
const TROOPER = SHIELD_TROOPER_EXT_ID as CardExtId;
const WOUND = WOUND_EXT_ID as CardExtId;
const HERO_A = 'test/hero/hero-a#0' as CardExtId;
const HERO_B = 'test/hero/hero-b#0' as CardExtId;
const HERO_C = 'test/hero/hero-c#0' as CardExtId;
const HERO_D = 'test/hero/hero-d#0' as CardExtId;
const HERO_E = 'test/hero/hero-e#0' as CardExtId;
const HERO_F = 'test/hero/hero-f#0' as CardExtId;
const VILLAIN_CTX = { currentPlayer: '0', turn: 1 };
/** A ShuffleProvider whose Shuffle reverses (proves a reshuffle ran deterministically). */
const REVERSE_SHUFFLE: ShuffleProvider = { random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() } };

/**
 * Builds every hook one villain or henchman group produces from committed card data.
 *
 * @param setAbbr - The set whose committed JSON to read.
 * @param groupId - The set-qualified group id.
 * @param kind - Whether the group is a villain or a henchman group.
 * @returns The group's hooks.
 */
function buildGroupHooks(setAbbr: string, groupId: string, kind: 'villain' | 'henchman'): VillainAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  const registry = { getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
  const config = {
    villainGroupIds: kind === 'villain' ? [groupId] : [],
    henchmanGroupIds: kind === 'henchman' ? [groupId] : [],
  } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, config);
}

const RINGS_HOOKS = buildGroupHooks('rvlt', 'rvlt/mandarins-rings', 'henchman');

/**
 * The onFight hooks one card id carries.
 *
 * @param hooks - The hooks to search.
 * @param cardId - The card.
 * @returns Its onFight hooks.
 */
function fightHooksFor(hooks: readonly VillainAbilityHook[], cardId: CardExtId): VillainAbilityHook[] {
  return hooks.filter((hook) => hook.cardId === cardId && hook.timing === 'onFight');
}

/**
 * A real initial game state with the Mandarin's Rings hooks and the given zones for player 0.
 *
 * @param zones - Player 0's deck, discard and cards in play.
 * @returns A LegendaryGameState for the executor, the resolve moves, the opener and the cleanup.
 */
function makeState(zones: { deck?: CardExtId[]; discard?: CardExtId[]; inPlay?: CardExtId[] }): LegendaryGameState {
  const gameState = buildInitialGameState(
    {
      schemeId: 'test-scheme', mastermindId: 'test-mastermind', villainGroupIds: [], henchmanGroupIds: [],
      heroDeckIds: [], bystandersCount: 0, woundsCount: 0, officersCount: 0, sidekicksCount: 0,
    },
    {},
    makeMockCtx(),
  );
  gameState.villainAbilityHooks = RINGS_HOOKS;
  gameState.currentStage = 'main';
  gameState.messages = [];
  gameState.playerZones['0'] = {
    deck: [...(zones.deck ?? [])],
    hand: [],
    discard: [...(zones.discard ?? [])],
    inPlay: [...(zones.inPlay ?? [])],
    victory: [],
  };
  const heroStats = { attack: 0, recruit: 0, cost: 3, fightCost: 0 };
  gameState.cardStats = {
    ...gameState.cardStats,
    [HERO_A]: heroStats, [HERO_B]: heroStats, [HERO_C]: heroStats,
    [HERO_D]: heroStats, [HERO_E]: heroStats, [HERO_F]: heroStats,
  } as LegendaryGameState['cardStats'];
  gameState.cardDisplayData = {
    ...gameState.cardDisplayData,
    [AGENT]: { name: 'S.H.I.E.L.D. Agent', imageUrl: '', cost: 0 },
    [TROOPER]: { name: 'S.H.I.E.L.D. Trooper', imageUrl: '', cost: 0 },
    [WOUND]: { name: 'Wound', imageUrl: '', cost: 0 },
    [HERO_A]: { name: 'Hero A', imageUrl: '', cost: 3 },
    [ZERO]: { name: 'Zero, The Ice Blast', imageUrl: '', cost: 0 },
  } as LegendaryGameState['cardDisplayData'];
  return gameState;
}

/**
 * The log entries whose text is `text`, with or without the {turn}.{step}.{action} prefix.
 *
 * @param G - The game state.
 * @param text - The unprefixed log text.
 * @returns The matching entries.
 */
function logsWithText(G: LegendaryGameState, text: string): { text: string; outcome?: string }[] {
  return G.messages.filter((entry) => entry.text === text || entry.text.endsWith(` ${text}`));
}

/**
 * Asserts exactly one log entry has the text and the outcome.
 *
 * @param G - The game state.
 * @param text - The unprefixed log text.
 * @param outcome - The expected outcome.
 */
function assertLoggedOnce(G: LegendaryGameState, text: string, outcome: string): void {
  const matches = logsWithText(G, text);
  assert.equal(matches.length, 1, `expected one log line: ${text}`);
  assert.equal(matches[0]!.outcome, outcome, `outcome of: ${text}`);
}

/**
 * Fires one Mandarin's Rings copy's Fight through the real executor.
 *
 * @param G - The game state.
 * @param cardId - The defeated copy.
 */
function fight(G: LegendaryGameState, cardId: CardExtId): void {
  executeVillainAbilities(G, VILLAIN_CTX, cardId, 'onFight', REVERSE_SHUFFLE);
}

/**
 * Answers the open seat choice for player 0 through the real resolveSeatChoice move.
 *
 * @param G - The game state.
 * @param optionIndex - The chosen option.
 */
function answerSeatChoice(G: LegendaryGameState, optionIndex: number): void {
  resolveSeatChoice(makeMockMoveContext(G), { optionIndex });
}

const AGENT_ADDED = `S.H.I.E.L.D. Agent (${AGENT}) was added to Player 0's hand as an extra card.`;

describe('WP-870 Mandarin\'s Rings parser (D-24815)', () => {
  it('T1: Lightning, Spin and Zero parse from the committed rvlt data; malformed Spin tokens are unresolved', () => {
    assert.deepStrictEqual(fightHooksFor(RINGS_HOOKS, LIGHTNING).map((hook) => hook.effects), [[{ primitive: 'reveal-top-may-ko-current' }]]);
    assert.deepStrictEqual(fightHooksFor(RINGS_HOOKS, SPIN).map((hook) => hook.effects), [[{ primitive: 'reveal-top-discard-zero-cost-current', magnitude: 6 }]]);
    assert.deepStrictEqual(fightHooksFor(RINGS_HOOKS, ZERO).map((hook) => hook.effects), [[{ primitive: 'next-hand-from-play-zero-cost-current' }]]);
    for (const cardId of [LIGHTNING, SPIN, ZERO]) {
      assert.deepStrictEqual(fightHooksFor(RINGS_HOOKS, cardId)[0]!.unresolvedMarkers ?? [], [], `${cardId} has no unresolved marker`);
    }
    const malformedTokens = [
      'reveal-top-discard-zero-cost-current',
      'reveal-top-discard-zero-cost-current:0',
      'reveal-top-discard-zero-cost-current:x',
      'reveal-top-discard-zero-cost-current:6:x',
    ];
    const abilities: string[] = [];
    for (const token of malformedTokens) {
      abilities.push(`Fight: Malformed. [effect:${token}]`);
    }
    const setData = { villains: [{ slug: 'malformed-group', cards: [{ slug: 'malformed-card', abilities }] }] };
    const registry = { getSet: (abbr: string) => (abbr === 'test' ? setData : undefined) };
    const config = { villainGroupIds: ['test/malformed-group'], henchmanGroupIds: [] } as unknown as MatchSetupConfig;
    const hooks = buildVillainAbilityHooks(registry, config);
    const firstCopyId = hooks[0]?.cardId;
    assert.ok(firstCopyId !== undefined, 'the malformed card builds hooks');
    const copyHooks = hooks.filter((hook) => hook.cardId === firstCopyId);
    assert.equal(copyHooks.length, malformedTokens.length, 'one hook per malformed line');
    for (let lineIndex = 0; lineIndex < copyHooks.length; lineIndex++) {
      assert.deepStrictEqual(copyHooks[lineIndex]!.effects, [], `${malformedTokens[lineIndex]} yields no descriptor`);
      assert.equal(copyHooks[lineIndex]!.unresolvedMarkers?.length, 1, `${malformedTokens[lineIndex]} is unresolved`);
    }
  });

  // why: WP-872 / D-24817 — an intentional behavior change: WP-870 left these three unmarked, and
  // WP-872 now marks them with their own primitives (each exercised in
  // mandarinsRingsCrossPlayerFight.test.ts).
  it('T2: Liar (-03), Nightbringer (-05) and Remaker (-06) carry the WP-872 primitives, not WP-870\'s', () => {
    const expectedPrimitives: Record<string, string> = {
      '03': 'look-other-player-deck-top-claim-current',
      '05': 'reveal-villain-deck-defeat-low-vp-current',
      '06': 'give-card-to-right-player-current',
    };
    for (const suffix of ['03', '05', '06']) {
      const cardId = `henchman-mandarins-rings-${suffix}` as CardExtId;
      const hooks = fightHooksFor(RINGS_HOOKS, cardId);
      assert.equal(hooks.length, 1, `${cardId} builds one onFight hook`);
      assert.deepStrictEqual(hooks[0]!.effects, [{ primitive: expectedPrimitives[suffix] }], `${cardId} carries its WP-872 primitive`);
    }
  });

  it('T3: antm Daystar parses to the KO-or-keep reveal', () => {
    const hooks = buildGroupHooks('antm', 'antm/queens-vengeance', 'villain');
    const daystarHooks = hooks.filter(
      (hook) => hook.cardId.startsWith('antm-villain-queens-vengeance-daystar') && hook.timing === 'onFight',
    );
    assert.ok(daystarHooks.length > 0, 'Daystar builds an onFight hook');
    for (const hook of daystarHooks) {
      assert.deepStrictEqual(hook.effects, [{ primitive: 'reveal-top-may-ko-current' }]);
    }
  });
});

describe('WP-870 Lightning: reveal the top card, you may KO it (D-24815)', () => {
  it('T4: parks one KO-or-keep entry for the deck top and logs the reveal', () => {
    const G = makeState({ deck: [HERO_A, HERO_B] });
    fight(G, LIGHTNING);
    assert.deepStrictEqual(G.pendingRevealTopDispose, [{
      choiceType: 'reveal-top-dispose',
      playerID: '0',
      revealedTops: [{ ownerPlayerID: '0', cardId: HERO_A, isKoAllowed: true, isDiscardAllowed: false }],
    }]);
    assertLoggedOnce(G, `Player 0 revealed Hero A (${HERO_A}) from the top of their deck — KO it or keep it (reveal-top).`, 'neutral');
  });

  it('T5: the shipped resolve move accepts ko and top, and refuses discard', () => {
    const koState = makeState({ deck: [HERO_A, HERO_B] });
    fight(koState, LIGHTNING);
    resolveRevealTopDispose(makeMockMoveContext(koState), { ownerPlayerID: '0', cardId: HERO_A, disposition: 'ko' });
    assert.ok(koState.ko.includes(HERO_A), 'KO puts the card in the KO pile');
    assert.deepStrictEqual(koState.playerZones['0']!.deck, [HERO_B]);

    const keepState = makeState({ deck: [HERO_A, HERO_B] });
    fight(keepState, LIGHTNING);
    resolveRevealTopDispose(makeMockMoveContext(keepState), { ownerPlayerID: '0', cardId: HERO_A, disposition: 'top' });
    assert.deepStrictEqual(keepState.playerZones['0']!.deck, [HERO_A, HERO_B], 'Keep leaves it on top');
    assert.equal((keepState.pendingRevealTopDispose ?? []).length, 0, 'the choice resolved');

    const discardState = makeState({ deck: [HERO_A, HERO_B] });
    fight(discardState, LIGHTNING);
    resolveRevealTopDispose(makeMockMoveContext(discardState), { ownerPlayerID: '0', cardId: HERO_A, disposition: 'discard' });
    assert.deepStrictEqual(discardState.playerZones['0']!.deck, [HERO_A, HERO_B], 'discard is refused');
    assert.deepStrictEqual(discardState.playerZones['0']!.discard, []);
    assert.equal(discardState.pendingRevealTopDispose?.length, 1, 'the entry is still pending');
  });

  it('T6: an empty deck and discard parks nothing and logs the blocked line', () => {
    const G = makeState({});
    assert.doesNotThrow(() => fight(G, LIGHTNING));
    assert.equal(G.pendingRevealTopDispose, undefined);
    assertLoggedOnce(G, 'Player 0 had no card to reveal on top of their deck (reveal-top).', 'blocked');
  });
});

describe('WP-870 Spin: discard the cost-0 cards of the top six, reorder the rest (D-24815)', () => {
  it('T7: only the top six are looked at; Agent, Wound and Trooper are discarded; three survivors reorder', () => {
    const G = makeState({ deck: [AGENT, HERO_A, WOUND, TROOPER, HERO_B, HERO_C, HERO_D, AGENT] });
    fight(G, SPIN);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [AGENT, WOUND, TROOPER]);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A, HERO_B, HERO_C, HERO_D, AGENT], 'the Agent below the window stays');
    assert.deepStrictEqual(G.pendingReorderChoices, [{ choiceType: 'reorder-deck-top', playerID: '0', cardIds: [HERO_A, HERO_B, HERO_C] }]);
    assertLoggedOnce(G, `Player 0 discarded S.H.I.E.L.D. Agent (${AGENT}) from the top of their deck (cost 0).`, 'applied');
    assertLoggedOnce(G, `Player 0 discarded Wound (${WOUND}) from the top of their deck (cost 0).`, 'applied');
    assertLoggedOnce(G, `Player 0 discarded S.H.I.E.L.D. Trooper (${TROOPER}) from the top of their deck (cost 0).`, 'applied');
    assertLoggedOnce(G, 'Player 0 puts the other 3 revealed cards back in any order.', 'neutral');
  });

  it('T8: a short deck takes in the shuffled discard first, then six are looked at', () => {
    const G = makeState({ deck: [HERO_A, HERO_B, HERO_C], discard: [HERO_D, AGENT, HERO_E, TROOPER, HERO_F] });
    fight(G, SPIN);
    // The reverse shuffle appends [HERO_F, TROOPER, HERO_E, AGENT, HERO_D] below the deck; the six
    // looked at are HERO_A..HERO_C, HERO_F, TROOPER, HERO_E, so only the Trooper is discarded.
    assert.deepStrictEqual(G.playerZones['0']!.discard, [TROOPER]);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A, HERO_B, HERO_C, HERO_F, HERO_E, AGENT, HERO_D]);
    assert.deepStrictEqual(G.pendingReorderChoices?.[0]?.cardIds, [HERO_A, HERO_B, HERO_C, HERO_F, HERO_E]);
  });

  it('T9: five cost-0 cards of six are discarded and one survivor parks no reorder', () => {
    const G = makeState({ deck: [AGENT, AGENT, TROOPER, HERO_A, WOUND, TROOPER] });
    fight(G, SPIN);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [AGENT, AGENT, TROOPER, WOUND, TROOPER]);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A]);
    assert.equal(G.pendingReorderChoices, undefined, 'no reorder for one survivor');
  });

  it('T16: a reorder overtaken in the same move is dropped, never left blocking the turn', () => {
    const G = makeState({ deck: [HERO_A, AGENT, HERO_B, HERO_C, HERO_D, HERO_E, HERO_F] });
    fight(G, SPIN);
    const parkedOrder = [HERO_A, HERO_B, HERO_C, HERO_D, HERO_E];
    assert.deepStrictEqual(G.pendingReorderChoices?.[0]?.cardIds, parkedOrder);
    // The Excessive Violence draw: the parked top card leaves the deck before the reorder resolves.
    const zones = G.playerZones['0']!;
    const drawn = moveCardFromZone(zones.deck, zones.hand, HERO_A);
    zones.deck = drawn.from;
    zones.hand = drawn.to;
    resolveReorderChoice(makeMockMoveContext(G), { orderedCardIds: parkedOrder });
    assert.equal(G.pendingReorderChoices, undefined, 'the drifted front is dropped');
    assert.deepStrictEqual(zones.deck, [HERO_B, HERO_C, HERO_D, HERO_E, HERO_F], 'the deck is not scrambled');
    const driftLine = "Player 0's revealed cards are no longer all on top of their deck; nothing to put back in order.";
    assertLoggedOnce(G, driftLine, 'neutral');

    const shortDeck = makeState({ deck: [HERO_A, HERO_B] });
    shortDeck.pendingReorderChoices = [{ choiceType: 'reorder-deck-top', playerID: '0', cardIds: [HERO_A, HERO_B, HERO_C] }];
    resolveReorderChoice(makeMockMoveContext(shortDeck), { orderedCardIds: [HERO_C, HERO_B, HERO_A] });
    assert.equal(shortDeck.pendingReorderChoices, undefined, 'the short-deck drift is dropped too');
    assert.deepStrictEqual(shortDeck.playerZones['0']!.deck, [HERO_A, HERO_B]);
    assertLoggedOnce(shortDeck, driftLine, 'neutral');
  });
});

describe('WP-870 Zero: add a 0-cost card you played to your next hand (D-24815)', () => {
  it('T10: one distinct 0-cost name in play is auto-picked', () => {
    const G = makeState({ inPlay: [AGENT, AGENT, HERO_A] });
    fight(G, ZERO);
    assert.equal(G.pendingNextHandFromPlayPicks?.length, 1, 'the handler only queues the pick');
    openNextHandFromPlaySeatChoiceIfNeeded(G, undefined, '0');
    assert.deepStrictEqual(G.deferredHandInjections?.['0'], [AGENT]);
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.pendingNextHandFromPlayPicks, undefined);
    assert.deepStrictEqual(G.playerZones['0']!.inPlay, [AGENT, AGENT, HERO_A], 'the card stays in play');
    assertLoggedOnce(G, `Player 0 will add S.H.I.E.L.D. Agent (${AGENT}) to their next hand as an extra card (Zero, The Ice Blast (${ZERO})).`, 'applied');
  });

  it('T11: two distinct 0-cost names open a seat choice, and the answer is recorded', () => {
    const G = makeState({ inPlay: [AGENT, TROOPER] });
    fight(G, ZERO);
    openNextHandFromPlaySeatChoiceIfNeeded(G, undefined, '0');
    const choice = G.pendingSeatChoice;
    assert.equal(choice?.kind, NEXT_HAND_FROM_PLAY_SEAT_CHOICE_KIND);
    assert.equal(choice?.kind, 'next-hand-from-play');
    assert.deepStrictEqual(choice?.addressedSeats, ['0']);
    assert.deepStrictEqual(choice?.seatPrompts['0']?.options.map((option) => option.label), ['S.H.I.E.L.D. Agent', 'S.H.I.E.L.D. Trooper']);
    assert.equal(choice?.defaultOptionIndex, 0);
    answerSeatChoice(G, 1);
    assert.deepStrictEqual(G.deferredHandInjections?.['0'], [TROOPER]);
    assert.equal(G.pendingNextHandFromPlayPicks, undefined);
    assert.equal(G.pendingSeatChoice, undefined);
  });

  it('T12: no 0-cost card in play is a logged no-op', () => {
    const G = makeState({ inPlay: [HERO_A] });
    fight(G, ZERO);
    openNextHandFromPlaySeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.deferredHandInjections?.['0'], undefined);
    assert.equal(G.pendingNextHandFromPlayPicks, undefined);
    assertLoggedOnce(G, `Player 0 played no 0-cost card to add to their next hand (Zero, The Ice Blast (${ZERO})).`, 'blocked');
  });

  it('T13: the end-of-turn cleanup returns the picked card as a seventh card', () => {
    const deck = [HERO_A, HERO_B, HERO_C, HERO_D, HERO_E, HERO_F, HERO_A, HERO_B, HERO_C, HERO_D];
    const G = makeState({ inPlay: [AGENT, AGENT, HERO_A], deck });
    fight(G, ZERO);
    openNextHandFromPlaySeatChoiceIfNeeded(G, undefined, '0');
    applyEndOfTurnCleanup(G, '0', REVERSE_SHUFFLE);
    const hand = G.playerZones['0']!.hand;
    assert.equal(hand.length, 7, 'six drawn plus the extra card');
    assert.ok(hand.includes(AGENT), 'the Agent is in the new hand');
    assert.equal(G.deferredHandInjections?.['0'], undefined, 'the injection is consumed');
    assertLoggedOnce(G, AGENT_ADDED, 'applied');
    assert.ok(!G.messages.some((entry) => entry.text.includes('Electromagnetic Bubble')), 'the consume line is source-neutral');
  });

  it('T14: a second pick excludes the recorded card and auto-picks the other', () => {
    const G = makeState({ inPlay: [AGENT, TROOPER] });
    fight(G, ZERO);
    fight(G, ZERO);
    openNextHandFromPlaySeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice?.kind, 'next-hand-from-play', 'the first pick has two names');
    answerSeatChoice(G, 0);
    assert.deepStrictEqual(G.deferredHandInjections?.['0'], [AGENT]);
    assert.equal(G.pendingNextHandFromPlayPicks?.length, 1, 'the second pick is still owed');
    openNextHandFromPlaySeatChoiceIfNeeded(G, undefined, '0');
    assert.deepStrictEqual(G.deferredHandInjections?.['0'], [AGENT, TROOPER], 'the second pick took the Trooper');
    assert.equal(G.pendingSeatChoice, undefined);
    assert.equal(G.pendingNextHandFromPlayPicks, undefined);
  });

  it('T15: two Zeros with three Agents in play give two extra Agents (copies counted)', () => {
    const deck = [HERO_A, HERO_B, HERO_C, HERO_D, HERO_E, HERO_F, HERO_A, HERO_B, HERO_C, HERO_D];
    const G = makeState({ inPlay: [AGENT, AGENT, AGENT], deck });
    fight(G, ZERO);
    fight(G, ZERO);
    openNextHandFromPlaySeatChoiceIfNeeded(G, undefined, '0');
    assert.deepStrictEqual(G.deferredHandInjections?.['0'], [AGENT, AGENT]);
    assert.equal(G.pendingSeatChoice, undefined);
    const pickLine = `Player 0 will add S.H.I.E.L.D. Agent (${AGENT}) to their next hand as an extra card (Zero, The Ice Blast (${ZERO})).`;
    assert.equal(logsWithText(G, pickLine).length, 2, 'two applied pick lines');
    applyEndOfTurnCleanup(G, '0', REVERSE_SHUFFLE);
    const hand = G.playerZones['0']!.hand;
    assert.equal(hand.length, 8, 'six drawn plus two extra cards');
    assert.equal(hand.filter((cardId) => cardId === AGENT).length, 2, 'two extra Agents');
    assert.equal(logsWithText(G, AGENT_ADDED).length, 2, 'two source-neutral consume lines');
  });
});

/** A started two-seat match through the real reducer. */
interface ReducerMatch {
  state: { G: unknown; ctx: { currentPlayer: unknown } };
  makeMove: (state: unknown, moveName: string, args: unknown[], playerID: string) => { G: unknown; ctx: { currentPlayer: unknown } };
  activeSeat: string;
}

/**
 * The game.test.ts mock match configuration (set-qualified test ids).
 *
 * @returns A MatchConfiguration the setup accepts.
 */
function createMockMatchConfiguration(): MatchConfiguration {
  return {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001', 'test/test-villain-group-002'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['test/test-hero-deck-001', 'test/test-hero-deck-002', 'test/test-hero-deck-003'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 0,
  };
}

/**
 * Starts a real two-seat match (the game.test.ts WP-845 pattern).
 *
 * @returns The started match and its active seat.
 */
function startReducerMatch(): ReducerMatch {
  const reducer = CreateGameReducer({ game: LegendaryGame, isClient: false });
  const makeMove: ReducerMatch['makeMove'] = (state, moveName, args, playerID) =>
    reducer(state, { type: 'MAKE_MOVE', payload: { type: moveName, args, playerID } });
  const initialState = InitializeGame({ game: LegendaryGame, numPlayers: 2, setupData: createMockMatchConfiguration() });
  let state = makeMove(initialState, 'setPlayerReady', [{ ready: true }], '0');
  state = makeMove(state, 'setPlayerReady', [{ ready: true }], '1');
  state = makeMove(state, 'startMatchIfReady', [], '0');
  return { state, makeMove, activeSeat: String(state.ctx.currentPlayer) };
}

describe('WP-870 wiring (D-24815)', () => {
  it('T17: real reducer — fighting Zero opens the pick from onMove, and the answer is recorded', () => {
    const match = startReducerMatch();
    const { makeMove, activeSeat } = match;
    const injectedG = structuredClone(match.state.G) as LegendaryGameState;
    injectedG.city[0] = ZERO;
    injectedG.villainDeckCardTypes = { ...injectedG.villainDeckCardTypes, [ZERO]: 'henchman' };
    injectedG.villainAbilityHooks = [
      ...injectedG.villainAbilityHooks,
      { cardId: ZERO, timing: 'onFight', keywords: [], effects: [{ primitive: 'next-hand-from-play-zero-cost-current' }] },
    ];
    injectedG.cardStats = {
      ...injectedG.cardStats,
      [ZERO]: { attack: 0, recruit: 0, cost: 0, fightCost: 0 },
    } as LegendaryGameState['cardStats'];
    injectedG.playerZones[activeSeat]!.inPlay = [AGENT, TROOPER];
    injectedG.turnEconomy.attack = 10;
    injectedG.currentStage = 'main';

    let state = makeMove({ ...match.state, G: injectedG }, 'fightVillain', [{ cityIndex: 0 }], activeSeat);
    const foughtG = state.G as LegendaryGameState;
    assert.equal(foughtG.city[0], null, 'Zero was defeated');
    assert.equal(foughtG.pendingSeatChoice?.kind, 'next-hand-from-play', 'onMove opened the pick after the fight');

    state = makeMove(state, 'resolveSeatChoice', [{ optionIndex: 1 }], activeSeat);
    const answeredG = state.G as LegendaryGameState;
    assert.deepStrictEqual(answeredG.deferredHandInjections?.[activeSeat], [TROOPER]);
    assert.equal(answeredG.pendingNextHandFromPlayPicks, undefined);
    assert.equal(answeredG.pendingSeatChoice, undefined);
  });

  it('T18: applyOnBeginParity deletes an owed pick, and a fresh state never seeds the field', () => {
    const match = startReducerMatch();
    const freshG = match.state.G as LegendaryGameState;
    assert.equal(Object.hasOwn(freshG, 'pendingNextHandFromPlayPicks'), false, 'never seeded');
    const G = structuredClone(freshG);
    G.pendingNextHandFromPlayPicks = [{ playerID: match.activeSeat, sourceCardId: ZERO }];
    applyOnBeginParity(G, match.activeSeat);
    assert.equal(Object.hasOwn(G, 'pendingNextHandFromPlayPicks'), false, 'deleted at turn start');
  });
});
