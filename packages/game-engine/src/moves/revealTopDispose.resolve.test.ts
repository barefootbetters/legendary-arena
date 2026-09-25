/**
 * Tests for the resolveRevealTopDispose move (WP-702 / D-24521), the
 * hasPendingRevealTopDispose block-all predicate, and the selectDefaultRevealTopDisposition
 * bot default.
 *
 * Covers: 'discard' moves the targeted card from ITS OWNER's deck top to that owner's discard
 * pile; 'top' is a no-op (the card stays); each decision drops one revealedTops entry and the
 * queue front-pops when it empties; a shared starter ext_id is disambiguated by ownerPlayerID;
 * a 'discard' whose card is no longer the owner's live deck top is a no-op (queue intact); a
 * wrong owner+card / a wrong playerID / an empty queue / invalid args are silent no-ops;
 * hasPendingRevealTopDispose; block-all no-op on an action move while pending; the bot default
 * discards cullable cards and keeps the rest.
 *
 * Uses node:test + node:assert only. No boardgame.io testing imports.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRevealTopDispose,
  hasPendingRevealTopDispose,
  selectDefaultRevealTopDisposition,
} from './revealTopDispose.resolve.js';
import { playCard } from './coreMoves.impl.js';
import type { LegendaryGameState, PendingRevealTopDispose, RevealedTopEntry } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

const WOUND = 'pile-wound' as CardExtId;
const AGENT = 'starting-shield-agent' as CardExtId;
const HERO_A = 'core/spider-man/spider-man#0' as CardExtId;
const HERO_B = 'core/iron-man/iron-man#0' as CardExtId;

/**
 * Creates a minimal multi-player LegendaryGameState for testing the reveal-top dispose
 * flow. Each key of `decks` becomes a player zone with that deck.
 *
 * @param overrides - player decks, the pending reveal-top queue, and current stage.
 */
function makeTestGameState(
  overrides: {
    decks?: Record<string, CardExtId[]>;
    hand?: CardExtId[];
    pendingRevealTopDispose?: PendingRevealTopDispose[];
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

  if (overrides.pendingRevealTopDispose !== undefined) {
    state.pendingRevealTopDispose = overrides.pendingRevealTopDispose;
  }
  return state;
}

/** Builds a move context for the move under test. */
function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveRevealTopDispose>[0] {
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
  } as unknown as Parameters<typeof resolveRevealTopDispose>[0];
}

function revealChoice(revealedTops: RevealedTopEntry[]): PendingRevealTopDispose {
  return { choiceType: 'reveal-top-dispose', playerID: '0', revealedTops };
}

describe('resolveRevealTopDispose (WP-702 / D-24521)', () => {
  it('discards the targeted card from ITS OWNER deck to that owner discard, dropping that entry', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND, HERO_A], '1': [HERO_B] },
      pendingRevealTopDispose: [revealChoice([
        { ownerPlayerID: '0', cardId: WOUND },
        { ownerPlayerID: '1', cardId: HERO_B },
      ])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'discard' });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A], 'removed from P0 deck top; Hero beneath stays');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [WOUND], 'the discarded card went to P0 discard');
    assert.deepStrictEqual(G.ko, [], 'discard is NOT a KO');
    assert.deepStrictEqual(G.playerZones['1']!.deck, [HERO_B], 'P1 deck untouched');
    assert.equal(G.pendingRevealTopDispose?.length, 1, 'queue NOT popped — one revealed card remains');
    assert.deepStrictEqual(
      G.pendingRevealTopDispose![0]!.revealedTops,
      [{ ownerPlayerID: '1', cardId: HERO_B }],
      'the resolved entry was dropped',
    );
  });

  it("'top' is a no-op that drops the entry (the card stays on top)", () => {
    const G = makeTestGameState({
      decks: { '0': [HERO_A] },
      pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: HERO_A }])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: HERO_A, disposition: 'top' });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A], 'the card stays on top');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], "'top' discards nothing");
    assert.equal(G.pendingRevealTopDispose?.length, 0, 'the last entry resolved → queue front-popped');
  });

  it('front-pops the queue only after every revealed card is resolved', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND], '1': [AGENT] },
      pendingRevealTopDispose: [revealChoice([
        { ownerPlayerID: '0', cardId: WOUND },
        { ownerPlayerID: '1', cardId: AGENT },
      ])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'discard' });
    assert.equal(G.pendingRevealTopDispose?.length, 1, 'still pending after the first resolve');
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '1', cardId: AGENT, disposition: 'discard' });
    assert.deepStrictEqual(G.playerZones['0']!.discard, [WOUND], 'P0 discard got its card');
    assert.deepStrictEqual(G.playerZones['1']!.discard, [AGENT], 'P1 discard got its card');
    assert.equal(G.pendingRevealTopDispose?.length, 0, 'queue front-popped after the last resolve');
  });

  it('disambiguates a shared starter ext_id by ownerPlayerID', () => {
    // why: `starting-shield-agent` is on BOTH players' deck tops. Keying only on cardId
    // would be ambiguous — the owner selects which deck the discard hits.
    const G = makeTestGameState({
      decks: { '0': [AGENT, HERO_A], '1': [AGENT, HERO_B] },
      pendingRevealTopDispose: [revealChoice([
        { ownerPlayerID: '0', cardId: AGENT },
        { ownerPlayerID: '1', cardId: AGENT },
      ])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '1', cardId: AGENT, disposition: 'discard' });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [AGENT, HERO_A], 'P0 Agent untouched');
    assert.deepStrictEqual(G.playerZones['1']!.deck, [HERO_B], 'only P1 Agent discarded');
    assert.deepStrictEqual(G.playerZones['1']!.discard, [AGENT]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'P0 discard untouched');
  });

  it("discard on a card a co-effect already moved off the top clears the choice gracefully (no re-loop, no wrong removal)", () => {
    // why: a same-play sibling ability (e.g. Beast's Berserk) can move the revealed card off the
    // deck top before the player decides. The resolve re-confirms `cardId === deck[0]`: it is NOT,
    // so nothing is removed (never a deeper copy of a shared ext_id), and the entry is dropped so
    // the bot never loops on an unresolvable move (the WP-702 soft-lock fix).
    const G = makeTestGameState({
      decks: { '0': [HERO_A, WOUND] }, // WOUND is snapshotted but sits BENEATH HERO_A now
      pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'discard' });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A, WOUND], 'nothing removed — WOUND is not deck[0]');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'no discard — the disposition is moot');
    assert.equal(G.pendingRevealTopDispose?.length, 0, 'the choice cleared gracefully (no re-loop)');
  });

  it('is a silent no-op when the { owner, card } is NOT in revealedTops (queue intact)', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND], '1': [HERO_B] },
      pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '1', cardId: HERO_B, disposition: 'discard' });
    assert.deepStrictEqual(G.playerZones['1']!.deck, [HERO_B], 'nothing discarded — not a snapshot entry');
    assert.equal(G.pendingRevealTopDispose?.length, 1, 'queue intact for resubmit');
  });

  it('is a silent no-op on a wrong playerID (only the active player may resolve)', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND], '1': [HERO_B] },
      pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveRevealTopDispose(makeMoveContext(G, '1'), { ownerPlayerID: '0', cardId: WOUND, disposition: 'discard' });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [WOUND], 'unchanged');
    assert.equal(G.pendingRevealTopDispose?.length, 1, 'front.playerID mismatch leaves the queue intact');
  });

  it('is a silent no-op on an empty queue / invalid args', () => {
    const empty = makeTestGameState({ decks: { '0': [WOUND] }, pendingRevealTopDispose: [] });
    resolveRevealTopDispose(makeMoveContext(empty), { ownerPlayerID: '0', cardId: WOUND, disposition: 'discard' });
    assert.deepStrictEqual(empty.playerZones['0']!.deck, [WOUND]);

    const bad = makeTestGameState({
      decks: { '0': [WOUND] },
      pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveRevealTopDispose(makeMoveContext(bad), { ownerPlayerID: '', cardId: WOUND, disposition: 'discard' });
    resolveRevealTopDispose(makeMoveContext(bad), { ownerPlayerID: '0', cardId: '' as CardExtId, disposition: 'discard' });
    resolveRevealTopDispose(makeMoveContext(bad), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' as never });
    assert.equal(bad.pendingRevealTopDispose?.length, 1, 'invalid args rejected before any mutation');
    assert.deepStrictEqual(bad.playerZones['0']!.deck, [WOUND]);
  });

  it('hasPendingRevealTopDispose reflects the queue state', () => {
    assert.equal(hasPendingRevealTopDispose(makeTestGameState()), false, 'undefined queue → false');
    assert.equal(hasPendingRevealTopDispose(makeTestGameState({ pendingRevealTopDispose: [] })), false, 'empty → false');
    assert.equal(
      hasPendingRevealTopDispose(makeTestGameState({
        pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
      })),
      true,
      'non-empty → true',
    );
  });

  it('block-all: an action move (playCard) is a no-op while a reveal-top choice is pending', () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND] },
      hand: [HERO_A],
      pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    playCard(makeMoveContext(G) as never, { cardId: HERO_A } as never);
    assert.deepStrictEqual(G.playerZones['0']!.hand, [HERO_A], 'hand unchanged — playCard was blocked');
    assert.equal(G.pendingRevealTopDispose?.length, 1, 'the pending choice is untouched');
  });
});

describe('selectDefaultRevealTopDisposition (WP-702 / D-24521)', () => {
  it("discards a Wound or a basic S.H.I.E.L.D. starter, keeps a recruited Hero", () => {
    assert.equal(selectDefaultRevealTopDisposition(WOUND, false), 'discard', 'Wound is thinned');
    assert.equal(selectDefaultRevealTopDisposition(AGENT, false), 'discard', 'basic S.H.I.E.L.D. starter is thinned');
    assert.equal(selectDefaultRevealTopDisposition(HERO_A, false), 'top', 'a recruited Hero is kept on top');
  });

  it("D-24558: KOs a cullable card when the entry is KO-unlocked, still keeps a recruited Hero", () => {
    assert.equal(selectDefaultRevealTopDisposition(WOUND, true), 'ko', 'a KO-unlocked Wound is KOed');
    assert.equal(selectDefaultRevealTopDisposition(AGENT, true), 'ko', 'a KO-unlocked starter is KOed');
    assert.equal(selectDefaultRevealTopDisposition(HERO_A, true), 'top', 'a recruited Hero is kept even when KO is allowed');
  });
});

describe("resolveRevealTopDispose 'ko' disposition (D-24558)", () => {
  it("KOs a KO-unlocked own revealed top (deck top → G.ko), dropping the entry", () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND, HERO_A] },
      pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: WOUND, isKoAllowed: true }])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' });
    assert.deepStrictEqual(G.ko, [WOUND], 'the card went to the KO pile');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A], 'removed from the deck top');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'a KO is not a discard');
    assert.equal(G.pendingRevealTopDispose?.length, 0, 'resolved → queue front-popped');
  });

  it("'ko' on an entry that is NOT KO-unlocked is a silent no-op (queue intact)", () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND] },
      pendingRevealTopDispose: [revealChoice([{ ownerPlayerID: '0', cardId: WOUND }])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' });
    assert.deepStrictEqual(G.ko, [], 'nothing KOed');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [WOUND], 'deck untouched');
    assert.equal(G.pendingRevealTopDispose![0]!.revealedTops.length, 1, 'the entry is still pending');
  });
});

// ---------------------------------------------------------------------------
// WP-754 / D-24581 — KO-or-keep entries (reveal-top-may-ko) on the reveal-top queue
// ---------------------------------------------------------------------------

/** A KO-or-keep entry (isKoAllowed: true, isDiscardAllowed: false) for player "0". */
function koOrKeep(cardId: CardExtId): RevealedTopEntry {
  return { ownerPlayerID: '0', cardId, isKoAllowed: true, isDiscardAllowed: false };
}

describe('resolveRevealTopDispose — KO-or-keep entries (WP-754 / D-24581)', () => {
  it("'ko' KOs the revealed top of a KO-or-keep entry", () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND, HERO_A] },
      pendingRevealTopDispose: [revealChoice([koOrKeep(WOUND)])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' });
    assert.deepStrictEqual(G.ko, [WOUND]);
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A]);
    assert.equal(G.pendingRevealTopDispose!.length, 0, 'resolved → queue front-popped');
  });

  it("'top' keeps the revealed card on top", () => {
    const G = makeTestGameState({
      decks: { '0': [HERO_A, HERO_B] },
      pendingRevealTopDispose: [revealChoice([koOrKeep(HERO_A)])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: HERO_A, disposition: 'top' });
    assert.deepStrictEqual(G.playerZones['0']!.deck, [HERO_A, HERO_B], 'the card stays on top');
    assert.deepStrictEqual(G.ko, []);
    assert.equal(G.pendingRevealTopDispose!.length, 0);
  });

  it("'discard' on a KO-or-keep entry is a silent no-op that leaves the queue byte-identical", () => {
    const G = makeTestGameState({
      decks: { '0': [WOUND, HERO_A] },
      pendingRevealTopDispose: [revealChoice([koOrKeep(WOUND)])],
    });
    const queueBefore = JSON.stringify(G.pendingRevealTopDispose);
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'discard' });
    assert.equal(JSON.stringify(G.pendingRevealTopDispose), queueBefore, 'queue byte-identical');
    assert.deepStrictEqual(G.playerZones['0']!.deck, [WOUND, HERO_A], 'deck untouched');
    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'nothing discarded');
    assert.equal(G.messages.length, 0, 'silent');
  });

  it('two KO-or-keep reveals of the same top: after the first KO, the second shows the new top', () => {
    // why: two Gruesome Feasts fired in one fight snapshot the SAME deck top (D-24521 §6).
    const G = makeTestGameState({
      decks: { '0': [WOUND, HERO_A] },
      pendingRevealTopDispose: [revealChoice([koOrKeep(WOUND)]), revealChoice([koOrKeep(WOUND)])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' });
    assert.equal(G.pendingRevealTopDispose!.length, 1, 'the second choice is still pending');
    assert.deepStrictEqual(G.pendingRevealTopDispose![0]!.revealedTops, [koOrKeep(HERO_A)],
      'the second choice was re-revealed to the new top, not left stale');
    assert.ok(
      G.messages.some((line) => line.text.includes('reveals the new top card of their deck') && line.text.includes(HERO_A)),
      'the re-reveal is logged',
    );

    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: HERO_A, disposition: 'ko' });
    assert.deepStrictEqual(G.ko, [WOUND, HERO_A], 'the second KO took the new top');
    assert.equal(G.pendingRevealTopDispose!.length, 0);
  });

  it('the refresh chains past a KO-or-keep entry with nothing left to reveal and stops at a shipped entry', () => {
    const shipped: RevealedTopEntry = { ownerPlayerID: '1', cardId: HERO_B };
    const G = makeTestGameState({
      decks: { '0': [WOUND], '1': [HERO_B] },
      pendingRevealTopDispose: [
        revealChoice([koOrKeep(WOUND)]),
        revealChoice([koOrKeep(WOUND)]),
        revealChoice([shipped]),
      ],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' });
    assert.equal(G.pendingRevealTopDispose!.length, 1, 'the exhausted KO-or-keep choice was dropped');
    assert.deepStrictEqual(G.pendingRevealTopDispose![0]!.revealedTops, [shipped], 'the shipped entry is untouched');
    assert.ok(
      G.messages.some((line) => line.text.includes('has no card left to reveal')),
      'the drop is logged',
    );
  });

  it('never re-reveals a shipped (discard-allowed) entry whose card left the top', () => {
    const staleShipped: RevealedTopEntry = { ownerPlayerID: '0', cardId: HERO_B };
    const G = makeTestGameState({
      decks: { '0': [WOUND, HERO_A] },
      pendingRevealTopDispose: [revealChoice([koOrKeep(WOUND)]), revealChoice([staleShipped])],
    });
    resolveRevealTopDispose(makeMoveContext(G), { ownerPlayerID: '0', cardId: WOUND, disposition: 'ko' });
    assert.deepStrictEqual(G.pendingRevealTopDispose![0]!.revealedTops, [staleShipped],
      'the shipped entry keeps its snapshot (it still clears as moot on resolve, as before)');
  });
});
