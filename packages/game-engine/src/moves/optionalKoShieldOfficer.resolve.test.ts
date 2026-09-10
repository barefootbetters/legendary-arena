/**
 * Tests for Nick Fury's Battlefield Promotion (WP-681 / D-24498) — the
 * optional-ko-shield-officer keyword resolved through resolveOptionalKoReward with a
 * koTeamFilter 'shield' + a gain-officer-hand reward.
 *
 * Covers: KO a S.H.I.E.L.D. Hero from hand → auto-gain an Officer to HAND; KO from discard;
 * the S.H.I.E.L.D. Officer token itself is a valid KO target; a non-S.H.I.E.L.D. target is
 * rejected (no-op, queue intact); decline → no KO, no Officer; empty Officer supply → the KO
 * happens but no Officer is gained (reward no-ops). Uses node:test + node:assert only.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOptionalKoReward } from './optionalKoReward.resolve.js';
import { SHIELD_OFFICER_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState, PendingOptionalKoReward } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';

function makeTestGameState(
  overrides: {
    hand?: CardExtId[];
    discard?: CardExtId[];
    officers?: CardExtId[];
    cardTraits?: Record<string, { heroClass: string | null; team: string | null }>;
    pendingOptionalKoRewards?: PendingOptionalKoReward[];
  } = {},
): LegendaryGameState {
  const state = {
    matchConfiguration: {
      schemeId: 's', mastermindId: 'm', villainGroupIds: [], henchmanGroupIds: [],
      heroDeckIds: [], bystandersCount: 0, woundsCount: 0, officersCount: 0, sidekicksCount: 0,
    },
    selection: {
      schemeId: 's', mastermindId: 'm', villainGroupIds: [], henchmanGroupIds: [], heroDeckIds: [],
    },
    currentStage: 'main',
    playerZones: {
      '0': {
        deck: [], hand: overrides.hand ?? [], discard: overrides.discard ?? [],
        inPlay: [], victory: [],
      },
    },
    piles: {
      bystanders: [], wounds: [], officers: overrides.officers ?? [], sidekicks: [], horrors: [],
    },
    messages: [], counters: {}, hookRegistry: [], villainAbilityHooks: [],
    villainDeck: { deck: [], discard: [] }, villainDeckCardTypes: {},
    ko: [], attachedBystanders: {}, villainAttachedHeroes: {},
    turnEconomy: {
      attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0, cardsDrawn: 0,
    },
    cardStats: {}, cardKeywords: {}, heroDeck: [], escapedPile: [],
    mastermind: {
      id: 'm', baseCardId: 'mb', tacticsDeck: ['tactic-0'] as CardExtId[],
      tacticsDefeated: [], strikePile: [], attachedBystanders: [],
    },
    scheme: { twistPile: [] }, notableEvents: [],
    city: [null, null, null, null, null], hq: [null, null, null, null, null],
    cardDisplayData: {}, cardTraits: overrides.cardTraits ?? {},
    schemeSetupInstructions: [], heroAbilityHooks: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
  } as unknown as LegendaryGameState;
  if (overrides.pendingOptionalKoRewards !== undefined) {
    state.pendingOptionalKoRewards = overrides.pendingOptionalKoRewards;
  }
  return state;
}

function makeMoveContext(
  gameState: LegendaryGameState,
  playerId: string = '0',
): Parameters<typeof resolveOptionalKoReward>[0] {
  return {
    G: gameState,
    ctx: {
      numPlayers: 1, currentPlayer: playerId, phase: 'play', turn: 1,
      playOrder: [playerId], playOrderPos: 0, activePlayers: null,
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
  } as unknown as Parameters<typeof resolveOptionalKoReward>[0];
}

/** A Battlefield Promotion pending entry (shield-filtered KO + gain-officer-hand reward). */
const bpPending = (playerID = '0'): PendingOptionalKoReward => ({
  playerID,
  rewardType: 'gain-officer-hand',
  rewardMagnitude: 0,
  sourceCardId: 'battlefield-promotion' as CardExtId,
  koZones: ['hand', 'discard'],
  koTeamFilter: 'shield',
});

describe('Battlefield Promotion — KO a S.H.I.E.L.D. Hero → gain an Officer to hand (WP-681)', () => {
  it('KOs a S.H.I.E.L.D. Hero from hand and gains an Officer to HAND (not discard)', () => {
    const gameState = makeTestGameState({
      hand: ['shield-hero'] as CardExtId[],
      officers: [SHIELD_OFFICER_EXT_ID],
      cardTraits: { 'shield-hero': { heroClass: null, team: 'shield' } },
      pendingOptionalKoRewards: [bpPending()],
    });
    resolveOptionalKoReward(makeMoveContext(gameState), { zone: 'hand', cardId: 'shield-hero' as CardExtId });
    const zones = gameState.playerZones['0']!;
    assert.ok(gameState.ko.includes('shield-hero' as CardExtId), 'KO pile holds the shield hero');
    assert.ok(zones.hand.includes(SHIELD_OFFICER_EXT_ID), 'the Officer landed in HAND');
    assert.ok(!zones.discard.includes(SHIELD_OFFICER_EXT_ID), 'the Officer is NOT in discard');
    assert.equal(gameState.piles.officers.length, 0, 'the Officer supply shrank by one');
    assert.equal(gameState.pendingOptionalKoRewards?.length ?? 0, 0, 'queue front-popped');
  });

  it('KOs a S.H.I.E.L.D. Hero from discard', () => {
    const gameState = makeTestGameState({
      discard: ['shield-hero'] as CardExtId[],
      officers: [SHIELD_OFFICER_EXT_ID],
      cardTraits: { 'shield-hero': { heroClass: null, team: 'shield' } },
      pendingOptionalKoRewards: [bpPending()],
    });
    resolveOptionalKoReward(makeMoveContext(gameState), { zone: 'discard', cardId: 'shield-hero' as CardExtId });
    assert.ok(gameState.ko.includes('shield-hero' as CardExtId));
    assert.ok(gameState.playerZones['0']!.hand.includes(SHIELD_OFFICER_EXT_ID));
  });

  it('the S.H.I.E.L.D. Officer token itself is a valid KO target (counts as a S.H.I.E.L.D. Hero)', () => {
    const gameState = makeTestGameState({
      hand: [SHIELD_OFFICER_EXT_ID],
      officers: [SHIELD_OFFICER_EXT_ID],
      pendingOptionalKoRewards: [bpPending()],
    });
    resolveOptionalKoReward(makeMoveContext(gameState), { zone: 'hand', cardId: SHIELD_OFFICER_EXT_ID });
    assert.ok(gameState.ko.includes(SHIELD_OFFICER_EXT_ID), 'the KO pile holds the KO\'d Officer token');
  });

  it('rejects a non-S.H.I.E.L.D. KO target as a no-op (queue intact)', () => {
    const gameState = makeTestGameState({
      hand: ['plain-hero'] as CardExtId[],
      officers: [SHIELD_OFFICER_EXT_ID],
      cardTraits: { 'plain-hero': { heroClass: 'tech', team: null } },
      pendingOptionalKoRewards: [bpPending()],
    });
    resolveOptionalKoReward(makeMoveContext(gameState), { zone: 'hand', cardId: 'plain-hero' as CardExtId });
    assert.equal(gameState.ko.length, 0, 'nothing was KO\'d');
    assert.ok(gameState.playerZones['0']!.hand.includes('plain-hero' as CardExtId), 'the hero stays in hand');
    assert.equal(gameState.pendingOptionalKoRewards?.length, 1, 'queue intact for resubmit');
  });

  it('decline → no KO, no Officer, queue pops', () => {
    const gameState = makeTestGameState({
      hand: ['shield-hero'] as CardExtId[],
      officers: [SHIELD_OFFICER_EXT_ID],
      cardTraits: { 'shield-hero': { heroClass: null, team: 'shield' } },
      pendingOptionalKoRewards: [bpPending()],
    });
    resolveOptionalKoReward(makeMoveContext(gameState), { decline: true });
    assert.equal(gameState.ko.length, 0);
    assert.equal(gameState.piles.officers.length, 1, 'the Officer supply is untouched');
    assert.equal(gameState.pendingOptionalKoRewards?.length ?? 0, 0, 'queue popped');
  });

  it('empty Officer supply → the KO happens but no Officer is gained', () => {
    const gameState = makeTestGameState({
      hand: ['shield-hero'] as CardExtId[],
      officers: [],
      cardTraits: { 'shield-hero': { heroClass: null, team: 'shield' } },
      pendingOptionalKoRewards: [bpPending()],
    });
    resolveOptionalKoReward(makeMoveContext(gameState), { zone: 'hand', cardId: 'shield-hero' as CardExtId });
    assert.ok(gameState.ko.includes('shield-hero' as CardExtId), 'the KO still happened');
    assert.ok(!gameState.playerZones['0']!.hand.includes(SHIELD_OFFICER_EXT_ID), 'no Officer gained');
    assert.equal(gameState.pendingOptionalKoRewards?.length ?? 0, 0, 'queue popped');
  });
});
