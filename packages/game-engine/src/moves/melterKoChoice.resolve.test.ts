/**
 * Tests for the resolveMelterKoChoice move (WP-603 / D-24413) and the
 * hasPendingMelterKoChoice block-all predicate.
 *
 * Covers: KO removes the targeted card from ITS OWNER's deck top; keep is a no-op;
 * each decision drops one revealedTops entry and the queue front-pops when it empties;
 * a shared starter ext_id is disambiguated by ownerPlayerID; a wrong owner+card / a
 * wrong playerID / an empty queue / invalid args / a KO of a card absent from the deck
 * are silent no-ops that leave the queue intact; hasPendingMelterKoChoice; block-all
 * no-op on an action move while pending.
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveMelterKoChoice,
  hasPendingMelterKoChoice,
} from './melterKoChoice.resolve.js';
import { playCard } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingMelterKoChoice, MelterRevealedTop } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const WOUND = 'pile-wound' as CardExtId;
const AGENT = 'starting-shield-agent' as CardExtId;
const HERO_A = 'core/spider-man/spider-man#0' as CardExtId;
const HERO_B = 'core/iron-man/iron-man#0' as CardExtId;

/**
 * Creates a minimal multi-player LegendaryGameState for testing the Melter KO/keep
 * flow. Each key of `decks` becomes a player zone with that deck.
 *
 * @param overrides - player decks, the pending Melter queue, and current stage.
 */
function makeTestGameState(
  overrides: {
    decks?: Record<string, CardExtId[]>;
    hand?: CardExtId[];
    pendingMelterKoChoices?: PendingMelterKoChoice[];
    currentStage?: LegendaryGameState['currentStage'];
  } = {},
): LegendaryGameState {
  const decks = overrides.decks ?? { '0': [], '1': [] };
  const playerZones: Record<string, unknown> = {};
  for (const playerId of Object.keys(decks)) {
    playerZones[playerId] = {
      deck: decks[playerId] ?? [],
      hand: playerId === '0' ? overrides.hand ?? [] : [],
      discard: [],
      inPlay: [],
      victory: [],
    };
  }
  const state = {
    matchConfiguration: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
      bystandersCount: 0,
      woundsCount: 0,
      officersCount: 0,
      sidekicksCount: 0,
    },
    selection: {
      schemeId: 'test-scheme',
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: overrides.currentStage ?? 'main',
    playerZones,
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [], horrors: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainAbilityHooks: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: { attack: 10, recruit: 10, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    cardStats: {},
    cardKeywords: {},
    heroDeck: [],
    escapedPile: [],
    mastermind: {
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: ['tactic-0'] as CardExtId[],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [],
    },
    scheme: { twistPile: [] },
    notableEvents: [],
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    cardDisplayData: {},
    cardTraits: {},
    schemeSetupInstructions: [],
    heroAbilityHooks: [],
    lobby: { requiredPlayers: 2, ready: {}, started: false },
  } as unknown as LegendaryGameState;

  if (overrides.pendingMelterKoChoices !== undefined) {
    state.pendingMelterKoChoices = overrides.pendingMelterKoChoices;
  }
  return state;
}

/** Builds a move context for the move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveMelterKoChoice>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 2,
      currentPlayer: playerId,
      phase: 'play',
      turn: 1,
      playOrder: ['0', '1'],
      playOrderPos: 0,
      activePlayers: null,
    },
    events: {
      endTurn: mock.fn(), setPhase: mock.fn(), endPhase: mock.fn(),
      setStage: mock.fn(), endStage: mock.fn(), pass: mock.fn(), endGame: mock.fn(),
    },
    random: {
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
      D4: mock.fn(), D6: mock.fn(), D10: mock.fn(), D12: mock.fn(), D20: mock.fn(),
      Die: mock.fn(), Number: mock.fn(),
    },
    playerID: playerId,
    log: { setMetadata: mock.fn() },
  } as unknown as Parameters<typeof resolveMelterKoChoice>[0];
}

function melterChoice(revealedTops: MelterRevealedTop[]): PendingMelterKoChoice {
  return { choiceType: 'melter-ko', playerID: '0', revealedTops };
}

describe('resolveMelterKoChoice (WP-603 / D-24413)', () => {
  it('KOs the targeted card from ITS OWNER deck and drops that entry, leaving others', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND, HERO_A], '1': [HERO_B] },
      pendingMelterKoChoices: [melterChoice([
        { ownerPlayerID: '0', cardId: WOUND },
        { ownerPlayerID: '1', cardId: HERO_B },
      ])],
    });
    resolveMelterKoChoice(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, keep: false });
    assert.deepStrictEqual(G.ko, [WOUND], 'the KO’d card went to G.ko');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A], 'removed from P0 deck top; Hero beneath stays');
    assert.deepStrictEqual(G.playerZones['1']!.deck, [HERO_B], 'P1 deck untouched');
    assert.equal(G.pendingMelterKoChoices?.length, 1, 'queue NOT popped — one revealed card remains');
    assert.deepStrictEqual(
      G.pendingMelterKoChoices![0]!.revealedTops,
      [{ ownerPlayerID: '1', cardId: HERO_B }],
      'the resolved entry was dropped',
    );
  });

  it('keep is a no-op that drops the entry (the card stays on top)', () => {
    const G = makeTestGameState({
      decks: { '0': [HERO_A] },
      pendingMelterKoChoices: [melterChoice([{ ownerPlayerID: '0', cardId: HERO_A }])],
    });
    resolveMelterKoChoice(makeMoveContext(G), { ownerPlayerID: '0', cardId: HERO_A, keep: true });
    assert.deepStrictEqual(G.ko, [], 'keep KOs nothing');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A], 'the card stays on top');
    assert.equal(G.pendingMelterKoChoices?.length, 0, 'the last entry resolved → queue front-popped');
  });

  it('front-pops the queue only after every revealed card is resolved', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND], '1': [AGENT] },
      pendingMelterKoChoices: [melterChoice([
        { ownerPlayerID: '0', cardId: WOUND },
        { ownerPlayerID: '1', cardId: AGENT },
      ])],
    });
    resolveMelterKoChoice(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, keep: false });
    assert.equal(G.pendingMelterKoChoices?.length, 1, 'still pending after the first resolve');
    resolveMelterKoChoice(makeMoveContext(G), { ownerPlayerID: '1', cardId: AGENT, keep: false });
    assert.deepStrictEqual(G.ko, [WOUND, AGENT], 'both KO’d, in resolution order');
    assert.equal(G.pendingMelterKoChoices?.length, 0, 'queue front-popped after the last resolve');
  });

  it('disambiguates a shared starter ext_id by ownerPlayerID', () => {
    // why: `starting-shield-agent` is on BOTH players' deck tops. Keying only on cardId
    // would be ambiguous — the owner selects which deck the KO hits.
    const G = makeTestGameState({
      decks: { '0': [AGENT, HERO_A], '1': [AGENT, HERO_B] },
      pendingMelterKoChoices: [melterChoice([
        { ownerPlayerID: '0', cardId: AGENT },
        { ownerPlayerID: '1', cardId: AGENT },
      ])],
    });
    resolveMelterKoChoice(makeMoveContext(G), { ownerPlayerID: '1', cardId: AGENT, keep: false });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [AGENT, HERO_A], 'P0 Agent untouched');
    assert.deepStrictEqual(G.playerZones['1']!.deck, [HERO_B], 'only P1 Agent KO’d');
    assert.deepStrictEqual(G.ko, [AGENT]);
    assert.deepStrictEqual(
      G.pendingMelterKoChoices![0]!.revealedTops,
      [{ ownerPlayerID: '0', cardId: AGENT }],
      'only the P1 entry was resolved',
    );
  });

  it('is a silent no-op when the { owner, card } is NOT in revealedTops (queue intact)', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND], '1': [HERO_B] },
      pendingMelterKoChoices: [melterChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveMelterKoChoice(makeMoveContext(G), { ownerPlayerID: '1', cardId: HERO_B, keep: false });
    assert.deepStrictEqual(G.ko, [], 'nothing KO’d — not a snapshot entry');
    assert.equal(G.pendingMelterKoChoices?.length, 1, 'queue intact for resubmit');
  });

  it('is a silent no-op on a wrong playerID (only the fighting player may resolve)', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND], '1': [HERO_B] },
      pendingMelterKoChoices: [melterChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveMelterKoChoice(makeMoveContext(G, '1'), { ownerPlayerID: '0', cardId: WOUND, keep: false });
    assert.deepStrictEqual(G.ko, []);
    assert.equal(G.pendingMelterKoChoices?.length, 1, 'front.playerID mismatch leaves the queue intact');
  });

  it('is a silent no-op on an empty queue / invalid args', () => {
    const empty = makeTestGameState({ decks: { '0': [WOUND] }, pendingMelterKoChoices: [] });
    resolveMelterKoChoice(makeMoveContext(empty), { ownerPlayerID: '0', cardId: WOUND, keep: false });
    assert.deepStrictEqual(empty.ko, []);

    const bad = makeTestGameState({
      decks: { '0': [WOUND] },
      pendingMelterKoChoices: [melterChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveMelterKoChoice(makeMoveContext(bad), { ownerPlayerID: '', cardId: WOUND, keep: false });
    resolveMelterKoChoice(makeMoveContext(bad), { ownerPlayerID: '0', cardId: '' as CardExtId, keep: false });
    assert.equal(bad.pendingMelterKoChoices?.length, 1, 'invalid ids rejected before any mutation');
    assert.deepStrictEqual(bad.ko, []);
  });

  it('is a silent no-op when the KO target is absent from the owner deck (queue intact)', () => {
    // why: defensive — the block-all guard freezes the deck, so unreachable in practice,
    // but the move must no-op safely rather than throw or corrupt state.
    const G = makeTestGameState({
      decks: { '0': [HERO_A] },
      pendingMelterKoChoices: [melterChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveMelterKoChoice(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, keep: false });
    assert.deepStrictEqual(G.ko, [], 'WOUND is not in P0 deck → no-op');
    assert.equal(G.pendingMelterKoChoices?.length, 1, 'queue intact');
  });

  it('hasPendingMelterKoChoice reflects the queue state', () => {
    assert.equal(hasPendingMelterKoChoice(makeTestGameState()), false, 'undefined queue → false');
    assert.equal(hasPendingMelterKoChoice(makeTestGameState({ pendingMelterKoChoices: [] })), false, 'empty → false');
    assert.equal(
      hasPendingMelterKoChoice(makeTestGameState({
        pendingMelterKoChoices: [melterChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
      })),
      true,
      'non-empty → true',
    );
  });

  it('block-all: an action move (playCard) is a no-op while a Melter choice is pending', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND] },
      hand: [HERO_A],
      pendingMelterKoChoices: [melterChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    playCard(makeMoveContext(G) as never, { cardId: HERO_A } as never);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [HERO_A], 'hand unchanged — playCard was blocked');
    assert.equal(G.pendingMelterKoChoices?.length, 1, 'the pending choice is untouched');
  });
});
