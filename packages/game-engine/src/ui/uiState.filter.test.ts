/**
 * Contract enforcement tests for filterUIStateForAudience (WP-029).
 *
 * These tests are contract enforcement tests. They are not examples,
 * not smoke tests, and not illustrative. If tests fail, the implementation
 * is incorrect by definition. Do NOT weaken assertions to make tests pass —
 * fix the implementation instead.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterUIStateForAudience } from './uiState.filter.js';
import { buildUIState } from './uiState.build.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { makeMockCtx } from '../test/mockCtx.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
// why: both names were used as type annotations throughout this file without
// ever being imported. Nothing compiled the engine's test files before WP-563,
// so each `as CardExtId` / `as LegendaryGameState[...]` silently degraded to
// `any` instead of pinning the projection contract it was written to pin.
import type { CardExtId, LegendaryGameState } from '../types.js';
import type { UIState } from './uiState.types.js';
import type { UIAudience } from './uiAudience.types.js';
import type { HollowEffectRecord } from '../diagnostics/hollowEffect.types.js';

/** Audience constants for test readability. */
const PLAYER_0: UIAudience = { kind: 'player', playerId: '0' };
const PLAYER_1: UIAudience = { kind: 'player', playerId: '1' };
const SPECTATOR: UIAudience = { kind: 'spectator' };

/**
 * Creates a valid test MatchSetupConfig.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test-scheme-001',
    mastermindId: 'test-mastermind-001',
    villainGroupIds: ['test-villain-group-001'],
    henchmanGroupIds: ['test-henchman-group-001'],
    heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

/**
 * Minimal mock registry for tests.
 */
function createMockRegistry(): CardRegistryReader {
  return { listCards: () => [] };
}

/**
 * Inline mock for UIBuildContext.
 */
const mockCtx = {
  phase: 'play' as string | null,
  turn: 1,
  currentPlayer: '0',
};

/**
 * Constructs a UIState with known hand cards for testing filter behavior.
 *
 * Player '0' gets hand cards ['hero-card-001', 'hero-card-002'].
 * Player '1' gets hand card ['hero-card-003'].
 */
function createTestUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  // why: populate hand with known cards so we can verify filter behavior.
  // After setup, hands are empty — manually add cards for testing.
  gameState.playerZones['0']!.hand.push('hero-card-001', 'hero-card-002');
  gameState.playerZones['1']!.hand.push('hero-card-003');

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience', () => {
  it('active player sees own hand card ext_ids', () => {
    const uiState = createTestUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);

    // why: player '0' is the active player and should see their own hand
    const player0 = result.players.find((player) => player.playerId === '0');
    assert.ok(player0 !== undefined, 'Player 0 must exist in filtered result');
    assert.ok(player0.handCards !== undefined, 'Active player must see own handCards');
    assert.ok(player0.handCards.includes('hero-card-001'), 'handCards must contain hero-card-001');
    assert.ok(player0.handCards.includes('hero-card-002'), 'handCards must contain hero-card-002');
    assert.equal(player0.handCount, 2, 'handCount must be 2');
  });

  it('active player does NOT see other player hand cards', () => {
    const uiState = createTestUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);

    // why: other players' hand contents are hidden — count only
    const player1 = result.players.find((player) => player.playerId === '1');
    assert.ok(player1 !== undefined, 'Player 1 must exist in filtered result');
    assert.equal(player1.handCards, undefined, 'Other player handCards must be undefined');
    assert.equal(player1.handCount, 1, 'Other player handCount must still be visible');
  });

  it('spectator sees hand counts for all players (no ext_ids)', () => {
    const uiState = createTestUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);

    // why: spectators see hand counts only — no hand card ext_ids
    for (const player of result.players) {
      assert.equal(
        player.handCards,
        undefined,
        `Spectator must not see handCards for player ${player.playerId}`,
      );
      assert.equal(
        typeof player.handCount,
        'number',
        `handCount must be a number for player ${player.playerId}`,
      );
    }
  });

  it('spectator does NOT see any player hand cards', () => {
    const uiState = createTestUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);

    // why: verify via serialization that no hand card ext_ids leak
    const json = JSON.stringify(result);
    assert.ok(!json.includes('hero-card-001'), 'hero-card-001 must not appear in spectator view');
    assert.ok(!json.includes('hero-card-002'), 'hero-card-002 must not appear in spectator view');
    assert.ok(!json.includes('hero-card-003'), 'hero-card-003 must not appear in spectator view');
  });

  it('deck order is never present in any audience view', () => {
    const uiState = createTestUIState();

    // why: deck contents/order are already hidden by buildUIState (WP-028)
    // — only deckCount exists, never a deck array
    for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      for (const player of result.players) {
        assert.ok(
          !('deckCards' in player),
          `deckCards must not exist for player ${player.playerId} in ${audience.kind} view`,
        );
        assert.ok(
          !('deck' in player),
          `deck must not exist for player ${player.playerId} in ${audience.kind} view`,
        );
        assert.equal(
          typeof player.deckCount,
          'number',
          `deckCount must be a number for player ${player.playerId}`,
        );
      }
    }
  });

  it('city and HQ are visible to all audiences', () => {
    const uiState = createTestUIState();

    for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      assert.ok(
        Array.isArray(result.city.spaces),
        `city.spaces must be an array in ${audience.kind} view`,
      );
      assert.ok(
        Array.isArray(result.hq.slots),
        `hq.slots must be an array in ${audience.kind} view`,
      );
    }
  });

  it('game log is visible to all audiences', () => {
    const uiState = createTestUIState();

    for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      assert.ok(
        Array.isArray(result.log),
        `log must be an array in ${audience.kind} view`,
      );
    }
  });

  it('filter does not mutate input UIState (deep equality check)', () => {
    const uiState = createTestUIState();
    const before = JSON.stringify(uiState);

    filterUIStateForAudience(uiState, PLAYER_0);
    filterUIStateForAudience(uiState, SPECTATOR);

    const after = JSON.stringify(uiState);
    assert.equal(before, after, 'Input UIState must not be mutated by filter');
  });

  it('filtered UIState is JSON-serializable', () => {
    const uiState = createTestUIState();

    for (const audience of [PLAYER_0, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);
      assert.deepStrictEqual(
        parsed,
        result,
        `Filtered UIState must survive JSON roundtrip for ${audience.kind} view`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// WP-128 / EC-131 — audience-filter redaction matrix for new fields
// ---------------------------------------------------------------------------

/**
 * Builds a UIState with known in-play cards, victory cards, and
 * discard-top entries for the WP-128 redaction matrix tests.
 */
function createWp128TestUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  // why: populate per-player zones with known cards so filter behavior
  // can be observed at the field level.
  gameState.playerZones['0']!.inPlay.push('inplay-0-001', 'inplay-0-002');
  gameState.playerZones['0']!.discard.push('discard-0-bottom', 'discard-0-top');
  gameState.playerZones['0']!.victory.push('victory-0-001');

  gameState.playerZones['1']!.inPlay.push('inplay-1-001');
  gameState.playerZones['1']!.discard.push('discard-1-top');
  gameState.playerZones['1']!.victory.push('victory-1-001', 'victory-1-002');

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — WP-128 redaction matrix', () => {
  it('opponent audience: inPlayCards AND inPlayDisplay redacted (=== undefined)', () => {
    // why: D-12803 — non-self audiences see counts only for in-play
    // cards. Both fields omitted, mirroring handCards / handDisplay
    // privacy posture. EC-131 §5 verifies redaction via `=== undefined`
    // assertion.
    const uiState = createWp128TestUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_1);

    const player0 = result.players.find((p) => p.playerId === '0');
    assert.ok(player0 !== undefined);
    assert.equal(player0.inPlayCards, undefined, 'opponent inPlayCards must be undefined');
    assert.equal(player0.inPlayDisplay, undefined, 'opponent inPlayDisplay must be undefined');
    assert.equal(player0.inPlayCount, 2, 'inPlayCount must remain visible');
  });

  it('spectator audience: inPlayCards/inPlayDisplay AND handCards/handDisplay all redacted', () => {
    // why: D-12803 — spectators see counts only for both hand and
    // in-play. Same omit-don't-assign pattern; verified via
    // `=== undefined` assertion.
    const uiState = createWp128TestUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);

    for (const player of result.players) {
      assert.equal(player.handCards, undefined, `spectator handCards must be undefined for ${player.playerId}`);
      assert.equal(player.handDisplay, undefined, `spectator handDisplay must be undefined for ${player.playerId}`);
      assert.equal(player.inPlayCards, undefined, `spectator inPlayCards must be undefined for ${player.playerId}`);
      assert.equal(player.inPlayDisplay, undefined, `spectator inPlayDisplay must be undefined for ${player.playerId}`);
    }
  });

  it('own player keeps inPlayCards / inPlayDisplay parallel arrays', () => {
    // why: D-12803 — viewing player sees own in-play array for gameplay.
    // Length-equality invariant with inPlayCount.
    const uiState = createWp128TestUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);

    const player0 = result.players.find((p) => p.playerId === '0');
    assert.ok(player0 !== undefined);
    assert.ok(player0.inPlayCards !== undefined, 'own inPlayCards must be present');
    assert.ok(player0.inPlayDisplay !== undefined, 'own inPlayDisplay must be present');
    assert.equal(player0.inPlayCards.length, 2);
    assert.equal(player0.inPlayCards.length, player0.inPlayDisplay.length);
  });

  it('discardTopCard / victoryCards / victoryVP visible to ALL audiences (public)', () => {
    // why: D-12803 — these are public fields. Verify each audience
    // (own / opponent / spectator) sees them. EC-131 §5 verifies
    // public-fields-not-redacted.
    const uiState = createWp128TestUIState();

    for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      for (const player of result.players) {
        assert.ok(
          player.discardTopCard !== undefined,
          `discardTopCard must be present for ${player.playerId} in ${audience.kind} view`,
        );
        assert.ok(
          player.victoryCards !== undefined,
          `victoryCards must be present for ${player.playerId} in ${audience.kind} view`,
        );
        assert.equal(
          typeof player.victoryVP,
          'number',
          `victoryVP must be a number for ${player.playerId} in ${audience.kind} view`,
        );
      }
    }
  });

  it('shared-board fields (decks/piles/koPile/mastermind/scheme/city) pass through every audience', () => {
    // why: D-12806 — shared-board projections are public. Filter must
    // produce per-entry shallow copies (no aliasing) but never redact.
    const uiState = createWp128TestUIState();

    for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      assert.equal(typeof result.decks.villainDeckCount, 'number');
      assert.equal(typeof result.piles.bystandersCount, 'number');
      assert.equal(typeof result.koPile.count, 'number');
      assert.ok(Array.isArray(result.mastermind.attachedBystanders));
      assert.ok(Array.isArray(result.mastermind.strikePile));
      assert.ok(Array.isArray(result.scheme.twistPile));
      assert.ok(Array.isArray(result.city.escapedPile));
    }
  });

  it('EC-206 shared-board text/art (scheme.display, scheme.gameText, mastermind.gameText) survives the whitelist for every audience', () => {
    // why: regression guard for the production bug where the audience filter's
    // field-by-field whitelist silently dropped the EC-206 fields (they are
    // optional in UIState, so TypeScript did not flag their omission). Symptom:
    // blank scheme art + "No rules text available for this card" on the play
    // surface. Inject known sentinels so the assertion is unambiguous
    // regardless of the mock registry's ability/scheme data.
    const uiState = createTestUIState();
    uiState.scheme.display = {
      extId: 'core-scheme-midtown-bank-robbery',
      name: 'Midtown Bank Robbery',
      imageUrl: 'https://images.legendary-arena.com/core/core-sc-midtown-bank-robbery.webp',
      cost: null,
    };
    uiState.scheme.gameText = ['Setup: 8 Twists.', 'Evil Wins: ...'];
    uiState.mastermind.gameText = ['Always Leads: Doombot Legion', 'Master Strike: ...'];

    for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      assert.equal(
        result.scheme.display?.imageUrl,
        'https://images.legendary-arena.com/core/core-sc-midtown-bank-robbery.webp',
        'scheme.display must pass through the audience whitelist',
      );
      assert.deepEqual(
        result.scheme.gameText,
        ['Setup: 8 Twists.', 'Evil Wins: ...'],
        'scheme.gameText must pass through the audience whitelist',
      );
      assert.deepEqual(
        result.mastermind.gameText,
        ['Always Leads: Doombot Legion', 'Master Strike: ...'],
        'mastermind.gameText must pass through the audience whitelist',
      );
    }

    // why: defensive-copy contract — mutating the filtered result must not
    // reach back into the source UIState (mirrors the aliasing guards the
    // WP-128 shared-board fields already hold to).
    const mutable = filterUIStateForAudience(uiState, SPECTATOR);
    mutable.scheme.display!.name = 'mutated';
    (mutable.scheme.gameText as string[])[0] = 'mutated';
    (mutable.mastermind.gameText as string[])[0] = 'mutated';
    assert.equal(uiState.scheme.display!.name, 'Midtown Bank Robbery', 'source scheme.display not aliased');
    assert.equal(uiState.scheme.gameText![0], 'Setup: 8 Twists.', 'source scheme.gameText not aliased');
    assert.equal(uiState.mastermind.gameText![0], 'Always Leads: Doombot Legion', 'source mastermind.gameText not aliased');
  });

});

// ---------------------------------------------------------------------------
// WP-243 / EC-274 — discard + pendingKoHeroChoice redaction (D-24011)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a KO choice with eligible cards
 * spanning their (private) hand + discard. The chooser's hand identities are
 * the leak vector — they must not appear in a non-chooser's UIState.
 */
function createKoChoiceUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  gameState.playerZones['0']!.hand = ['ko-hand-secret-a', 'ko-hand-secret-b'];
  gameState.playerZones['0']!.discard = ['ko-disc-secret-c'];
  gameState.playerZones['1']!.hand = ['p1-card'];
  gameState.pendingKoHeroChoices = [{ choiceType: 'ko-hero', playerID: '0' }];

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — discard redaction (WP-243)', () => {
  it('owner sees own discardCards / discardDisplay; opponent + spectator do not', () => {
    const uiState = createKoChoiceUIState();

    const owner = filterUIStateForAudience(uiState, PLAYER_0).players.find((p) => p.playerId === '0')!;
    assert.ok(owner.discardCards !== undefined, 'owner sees discardCards');
    assert.ok(owner.discardDisplay !== undefined, 'owner sees discardDisplay');

    const opponentView = filterUIStateForAudience(uiState, PLAYER_1).players.find((p) => p.playerId === '0')!;
    assert.equal(opponentView.discardCards, undefined, 'opponent does NOT see discardCards');
    assert.equal(opponentView.discardDisplay, undefined, 'opponent does NOT see discardDisplay');

    const spectatorView = filterUIStateForAudience(uiState, SPECTATOR).players.find((p) => p.playerId === '0')!;
    assert.equal(spectatorView.discardCards, undefined, 'spectator does NOT see discardCards');
    assert.equal(spectatorView.discardDisplay, undefined, 'spectator does NOT see discardDisplay');
  });
});

describe('filterUIStateForAudience — pendingKoHeroChoice redaction (D-24011)', () => {
  it('the chooser sees pendingKoHeroChoice with the full eligible list', () => {
    const uiState = createKoChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    assert.ok(result.pendingKoHeroChoice !== undefined, 'chooser sees the KO choice');
    assert.equal(result.pendingKoHeroChoice!.playerID, '0');
    assert.ok(result.pendingKoHeroChoice!.eligible.length >= 1, 'eligible list non-empty');
  });

  it('an opponent does NOT see pendingKoHeroChoice and none of the chooser hand ext_ids leak', () => {
    const uiState = createKoChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_1);
    assert.equal(result.pendingKoHeroChoice, undefined, 'opponent must not see the KO choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('ko-hand-secret-a'), false, 'no chooser hand ext_id leaks');
    assert.equal(serialized.includes('ko-hand-secret-b'), false, 'no chooser hand ext_id leaks');
  });

  it('a spectator does NOT see pendingKoHeroChoice and none of the chooser hand ext_ids leak', () => {
    const uiState = createKoChoiceUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);
    assert.equal(result.pendingKoHeroChoice, undefined, 'spectator must not see the KO choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('ko-hand-secret-a'), false, 'no chooser hand ext_id leaks');
    assert.equal(serialized.includes('ko-hand-secret-b'), false, 'no chooser hand ext_id leaks');
  });

  it('does not mutate the input UIState (pendingKoHeroChoice still present on the source)', () => {
    const uiState = createKoChoiceUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingKoHeroChoice !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// WP-470 / EC-505 — pendingScryKoChoice redaction (D-24282)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a Doombot scry-KO choice over the top
 * two cards of their OWN deck. The revealed ext_ids are the chooser's next
 * draws — private information that must not appear in a non-chooser's UIState.
 */
function createScryChoiceUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  gameState.playerZones['0']!.deck = [
    'scry-deck-secret-a' as CardExtId,
    'scry-deck-secret-b' as CardExtId,
    'scry-deck-deep' as CardExtId,
  ];
  gameState.pendingScryKoChoices = [
    {
      choiceType: 'scry-ko',
      playerID: '0',
      revealedCardIds: ['scry-deck-secret-a' as CardExtId, 'scry-deck-secret-b' as CardExtId],
    },
  ];

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingScryKoChoice redaction (D-24282)', () => {
  it('the chooser sees pendingScryKoChoice with the revealed cards', () => {
    const uiState = createScryChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    assert.ok(result.pendingScryKoChoice !== undefined, 'chooser sees the scry-KO choice');
    assert.equal(result.pendingScryKoChoice!.playerID, '0');
    assert.equal(result.pendingScryKoChoice!.revealedCards.length, 2, 'both revealed cards present');
  });

  it('an opponent does NOT see pendingScryKoChoice and no revealed deck ext_id leaks', () => {
    const uiState = createScryChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_1);
    assert.equal(result.pendingScryKoChoice, undefined, 'opponent must not see the scry-KO choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('scry-deck-secret-a'), false, 'no revealed deck ext_id leaks');
    assert.equal(serialized.includes('scry-deck-secret-b'), false, 'no revealed deck ext_id leaks');
  });

  it('a spectator does NOT see pendingScryKoChoice and no revealed deck ext_id leaks', () => {
    const uiState = createScryChoiceUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);
    assert.equal(result.pendingScryKoChoice, undefined, 'spectator must not see the scry-KO choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('scry-deck-secret-a'), false, 'no revealed deck ext_id leaks');
    assert.equal(serialized.includes('scry-deck-secret-b'), false, 'no revealed deck ext_id leaks');
  });

  it('does not mutate the input UIState (pendingScryKoChoice still present on the source)', () => {
    const uiState = createScryChoiceUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingScryKoChoice !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// WP-476 / EC-511 — pendingDiscardChoice redaction (D-24284, D-24011 analog)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a Magneto discard-to-limit choice. The
 * hand ext_ids are the cards the chooser must pick among — private information
 * that must not appear in a non-chooser's UIState.
 */
function createDiscardChoiceUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  gameState.playerZones['0']!.hand = [
    'disc-hand-secret-a' as CardExtId,
    'disc-hand-secret-b' as CardExtId,
    'disc-hand-secret-c' as CardExtId,
    'disc-hand-secret-d' as CardExtId,
    'disc-hand-secret-e' as CardExtId,
  ];
  gameState.pendingDiscardChoices = [
    { choiceType: 'discard-to-limit', playerID: '0', limit: 4 },
  ];

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingDiscardChoice redaction (D-24284)', () => {
  it('the chooser sees pendingDiscardChoice with the hand and limit', () => {
    const uiState = createDiscardChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    assert.ok(result.pendingDiscardChoice !== undefined, 'chooser sees the discard choice');
    assert.equal(result.pendingDiscardChoice!.playerID, '0');
    assert.equal(result.pendingDiscardChoice!.limit, 4);
    assert.equal(result.pendingDiscardChoice!.hand.length, 5, 'the full hand is projected to the chooser');
  });

  it('an opponent does NOT see pendingDiscardChoice and no hand ext_id leaks', () => {
    const uiState = createDiscardChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_1);
    assert.equal(result.pendingDiscardChoice, undefined, 'opponent must not see the discard choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('disc-hand-secret-a'), false, 'no hand ext_id leaks to an opponent');
  });

  it('a spectator does NOT see pendingDiscardChoice and no hand ext_id leaks', () => {
    const uiState = createDiscardChoiceUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);
    assert.equal(result.pendingDiscardChoice, undefined, 'spectator must not see the discard choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('disc-hand-secret-a'), false, 'no hand ext_id leaks to a spectator');
  });

  it('does not mutate the input UIState (pendingDiscardChoice still present on the source)', () => {
    const uiState = createDiscardChoiceUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingDiscardChoice !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// WP-538 / EC-573 — pendingPutCardsOnDeckChoice redaction (D-24347, D-24011 analog)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a core Dr. Doom put-cards-on-deck choice.
 * The hand ext_ids are the cards the chooser must pick among — private information
 * that must not appear in a non-chooser's UIState.
 */
function createPutCardsOnDeckChoiceUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  gameState.playerZones['0']!.hand = [
    'putdeck-hand-secret-a' as CardExtId,
    'putdeck-hand-secret-b' as CardExtId,
    'putdeck-hand-secret-c' as CardExtId,
    'putdeck-hand-secret-d' as CardExtId,
    'putdeck-hand-secret-e' as CardExtId,
    'putdeck-hand-secret-f' as CardExtId,
  ];
  gameState.pendingPutCardsOnDeckChoices = [
    { choiceType: 'put-cards-on-deck', playerID: '0', count: 2 },
  ];

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingPutCardsOnDeckChoice redaction (D-24347)', () => {
  it('the chooser sees pendingPutCardsOnDeckChoice with the hand and count', () => {
    const uiState = createPutCardsOnDeckChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    assert.ok(result.pendingPutCardsOnDeckChoice !== undefined, 'chooser sees the put-cards-on-deck choice');
    assert.equal(result.pendingPutCardsOnDeckChoice!.playerID, '0');
    assert.equal(result.pendingPutCardsOnDeckChoice!.count, 2);
    assert.equal(result.pendingPutCardsOnDeckChoice!.hand.length, 6, 'the full hand is projected to the chooser');
  });

  it('an opponent does NOT see pendingPutCardsOnDeckChoice and no hand ext_id leaks', () => {
    const uiState = createPutCardsOnDeckChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_1);
    assert.equal(result.pendingPutCardsOnDeckChoice, undefined, 'opponent must not see the choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('putdeck-hand-secret-a'), false, 'no hand ext_id leaks to an opponent');
  });

  it('a spectator does NOT see pendingPutCardsOnDeckChoice and no hand ext_id leaks', () => {
    const uiState = createPutCardsOnDeckChoiceUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);
    assert.equal(result.pendingPutCardsOnDeckChoice, undefined, 'spectator must not see the choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('putdeck-hand-secret-a'), false, 'no hand ext_id leaks to a spectator');
  });

  it('does not mutate the input UIState (pendingPutCardsOnDeckChoice still present on the source)', () => {
    const uiState = createPutCardsOnDeckChoiceUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingPutCardsOnDeckChoice !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// WP-249 / EC-280 — pendingOptionalKoReward redaction (D-24020, D-24011 analog)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes an optional-KO-reward choice with
 * eligible cards spanning their (private) hand + discard. Both the hand and
 * discard identities are leak vectors — they must not appear in a non-chooser's
 * UIState.
 */
function createOptionalRewardUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  // why: the discard TOP card (last index) is PUBLIC via discardTopCard (D-12803,
  // face-up at the table), so the leak assertions target the non-top index-0
  // discard card, which is private (exposed only via the redacted discardCards
  // and the chooser-only eligible list). Hand identities are fully private.
  gameState.playerZones['0']!.hand = ['okr-hand-secret-a', 'okr-hand-secret-b'];
  gameState.playerZones['0']!.discard = ['okr-disc-secret-bottom', 'okr-disc-public-top'];
  gameState.playerZones['1']!.hand = ['p1-card'];
  gameState.pendingOptionalKoRewards = [
    { playerID: '0', rewardType: 'rescue', rewardMagnitude: 1, sourceCardId: 'okr-src' },
  ];

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingOptionalKoReward redaction (D-24020)', () => {
  it('the chooser sees pendingOptionalKoReward with the full eligible hand + discard', () => {
    const uiState = createOptionalRewardUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    assert.ok(result.pendingOptionalKoReward !== undefined, 'chooser sees the optional-KO-reward choice');
    assert.equal(result.pendingOptionalKoReward!.playerID, '0');
    assert.equal(result.pendingOptionalKoReward!.rewardLabel, 'Rescue a Bystander');
    assert.equal(result.pendingOptionalKoReward!.eligibleHand.length, 2, 'eligibleHand projected for the chooser');
    assert.equal(result.pendingOptionalKoReward!.eligibleDiscard.length, 2, 'eligibleDiscard projected for the chooser');
  });

  it('an opponent does NOT see pendingOptionalKoReward and none of the chooser private hand/discard ext_ids leak', () => {
    const uiState = createOptionalRewardUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_1);
    assert.equal(result.pendingOptionalKoReward, undefined, 'opponent must not see the optional-KO-reward choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('okr-hand-secret-a'), false, 'no chooser hand ext_id leaks');
    assert.equal(serialized.includes('okr-hand-secret-b'), false, 'no chooser hand ext_id leaks');
    assert.equal(serialized.includes('okr-disc-secret-bottom'), false, 'no chooser non-top discard ext_id leaks');
  });

  it('a spectator does NOT see pendingOptionalKoReward and none of the chooser private hand/discard ext_ids leak', () => {
    const uiState = createOptionalRewardUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);
    assert.equal(result.pendingOptionalKoReward, undefined, 'spectator must not see the optional-KO-reward choice');
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('okr-hand-secret-a'), false, 'no chooser hand ext_id leaks');
    assert.equal(serialized.includes('okr-hand-secret-b'), false, 'no chooser hand ext_id leaks');
    assert.equal(serialized.includes('okr-disc-secret-bottom'), false, 'no chooser non-top discard ext_id leaks');
  });

  it('per-entry display is a defensive copy — mutating the chooser result does not affect the source', () => {
    const uiState = createOptionalRewardUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    result.pendingOptionalKoReward!.eligibleHand[0]!.display.name = 'mutated';
    assert.notEqual(
      uiState.pendingOptionalKoReward!.eligibleHand[0]!.display.name,
      'mutated',
      'source UIState eligible display untouched',
    );
  });

  it('does not mutate the input UIState (pendingOptionalKoReward still present on the source)', () => {
    const uiState = createOptionalRewardUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingOptionalKoReward !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// WP-287 / EC-319 — pendingDrawOrEmpowered redaction (D-24071, D-24011 analog)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a draw-or-empowered choice. The choice is
 * private to the chooser (the D-24011 analog) — it must not appear in a non-chooser's
 * UIState (a binary choice with no eligible-card list, so the only leak vector is the
 * existence + derived label of the choice itself).
 */
function createDrawOrEmpoweredUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  gameState.pendingDrawOrEmpowered = [{ playerID: '0', empoweredClass: 'strength' }];
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingDrawOrEmpowered redaction (D-24071)', () => {
  it('the chooser sees pendingDrawOrEmpowered with the derived empoweredLabel (AC-1)', () => {
    const uiState = createDrawOrEmpoweredUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    assert.ok(result.pendingDrawOrEmpowered !== undefined, 'chooser sees the draw-or-empowered choice');
    assert.equal(result.pendingDrawOrEmpowered!.playerID, '0');
    assert.equal(result.pendingDrawOrEmpowered!.empoweredLabel, 'Empowered by Strength');
  });

  it('an opponent does NOT see pendingDrawOrEmpowered (AC-2)', () => {
    const uiState = createDrawOrEmpoweredUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_1);
    assert.equal(result.pendingDrawOrEmpowered, undefined, 'opponent must not see the draw-or-empowered choice');
  });

  it('a spectator does NOT see pendingDrawOrEmpowered (AC-2)', () => {
    const uiState = createDrawOrEmpoweredUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);
    assert.equal(result.pendingDrawOrEmpowered, undefined, 'spectator must not see the draw-or-empowered choice');
  });

  it('does not mutate the input UIState (pendingDrawOrEmpowered still present on the source)', () => {
    const uiState = createDrawOrEmpoweredUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingDrawOrEmpowered !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// WP-313 / EC-343 — pendingVictoryPileCardPick redaction (D-24099, D-24011 analog)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a victory-pile villain pick. The pending
 * choice is chooser-scoped (only they may resolve it) — it must not appear in a
 * non-chooser's UIState. An empty victory pile is fine here: the field still
 * projects (with an empty eligibleVillains list), which is all the redaction test needs.
 */
function createVictoryPilePickUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  gameState.pendingVictoryPileCardPick = [{ playerID: '0', rewardType: 'attack' }];
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingVictoryPileCardPick redaction (D-24099)', () => {
  it('the chooser sees pendingVictoryPileCardPick', () => {
    const result = filterUIStateForAudience(createVictoryPilePickUIState(), PLAYER_0);
    assert.ok(result.pendingVictoryPileCardPick !== undefined, 'chooser sees the victory-pile pick');
    assert.equal(result.pendingVictoryPileCardPick!.playerID, '0');
  });

  it('an opponent does NOT see pendingVictoryPileCardPick', () => {
    const result = filterUIStateForAudience(createVictoryPilePickUIState(), PLAYER_1);
    assert.equal(result.pendingVictoryPileCardPick, undefined, 'opponent must not see the pick');
  });

  it('a spectator does NOT see pendingVictoryPileCardPick', () => {
    const result = filterUIStateForAudience(createVictoryPilePickUIState(), SPECTATOR);
    assert.equal(result.pendingVictoryPileCardPick, undefined, 'spectator must not see the pick');
  });

  it('does not mutate the input UIState', () => {
    const uiState = createVictoryPilePickUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingVictoryPileCardPick !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// Ionic Energy fix — pendingOptionalPutBottomHQ redaction (chooser-scoped)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes an optional-put-bottom-hq choice. The
 * pending choice is chooser-scoped (only they may resolve it) — it must not appear
 * in a non-chooser's UIState. The HQ from setup has cards, so the field projects a
 * non-empty eligibleHqCards list.
 */
function createPutBottomHQUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  gameState.pendingOptionalPutBottomHQ = [{ playerID: '0', sourceCardId: 'src' as CardExtId }];
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingOptionalPutBottomHQ redaction', () => {
  it('the chooser sees pendingOptionalPutBottomHQ', () => {
    const result = filterUIStateForAudience(createPutBottomHQUIState(), PLAYER_0);
    assert.ok(result.pendingOptionalPutBottomHQ !== undefined, 'chooser sees the put-bottom-hq choice');
    assert.equal(result.pendingOptionalPutBottomHQ!.playerID, '0');
  });

  it('an opponent does NOT see pendingOptionalPutBottomHQ', () => {
    const result = filterUIStateForAudience(createPutBottomHQUIState(), PLAYER_1);
    assert.equal(result.pendingOptionalPutBottomHQ, undefined, 'opponent must not see the choice');
  });

  it('a spectator does NOT see pendingOptionalPutBottomHQ', () => {
    const result = filterUIStateForAudience(createPutBottomHQUIState(), SPECTATOR);
    assert.equal(result.pendingOptionalPutBottomHQ, undefined, 'spectator must not see the choice');
  });

  it('does not mutate the input UIState', () => {
    const uiState = createPutBottomHQUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingOptionalPutBottomHQ !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// WP-498 / D-24301 — pendingReturnOnDiscard redaction (chooser-scoped)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes an OPTIONAL return-on-discard choice for
 * a card in their discard pile. The choice is chooser-scoped (only they may
 * resolve it) — it must not appear in a non-chooser's UIState.
 */
function createReturnOnDiscardUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  const card = gameState.playerZones['0']!.deck[0]!;
  gameState.playerZones['0']!.discard = [card];
  gameState.pendingReturnOnDiscard = [{ playerID: '0', cardId: card }];
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingReturnOnDiscard redaction', () => {
  it('the chooser sees pendingReturnOnDiscard with the returnable card', () => {
    const result = filterUIStateForAudience(createReturnOnDiscardUIState(), PLAYER_0);
    assert.ok(result.pendingReturnOnDiscard !== undefined, 'chooser sees the return-on-discard choice');
    assert.equal(result.pendingReturnOnDiscard!.playerID, '0');
    assert.equal(result.pendingReturnOnDiscard!.eligibleReturnCards.length, 1);
  });

  it('an opponent does NOT see pendingReturnOnDiscard', () => {
    const result = filterUIStateForAudience(createReturnOnDiscardUIState(), PLAYER_1);
    assert.equal(result.pendingReturnOnDiscard, undefined, 'opponent must not see the choice');
  });

  it('a spectator does NOT see pendingReturnOnDiscard', () => {
    const result = filterUIStateForAudience(createReturnOnDiscardUIState(), SPECTATOR);
    assert.equal(result.pendingReturnOnDiscard, undefined, 'spectator must not see the choice');
  });
});

// ---------------------------------------------------------------------------
// WP-532 / D-24343 — pendingGiveHqHeroChoice redaction (chooser-scoped, Paibok Fight)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where the current player '0' owes an interactive give-HQ-Hero
 * choice (Paibok Fight). The eligible list is projected from the PUBLIC G.hq, but the
 * prompt is chooser-scoped — it must not appear in a non-chooser's UIState. Exercises
 * the full Board-Visible Field round-trip: buildUIState populates it, and the audience
 * filter passes it through only for the chooser.
 */
function createGiveHqHeroUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  // why: buildInitialGameState leaves G.hq unfilled; seed two known cards (from player 0's
  // starting deck) into the HQ so the give-HQ-Hero projection has eligible Heroes to surface.
  const heroA = gameState.playerZones['0']!.deck[0]!;
  const heroB = gameState.playerZones['0']!.deck[1]!;
  gameState.hq = [heroA, heroB, null, null, null] as LegendaryGameState['hq'];
  gameState.pendingGiveHqHeroChoices = [{ choiceType: 'give-hq-hero', playerID: '0' }];
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingGiveHqHeroChoice redaction', () => {
  it('the chooser sees pendingGiveHqHeroChoice with the eligible HQ Heroes', () => {
    const result = filterUIStateForAudience(createGiveHqHeroUIState(), PLAYER_0);
    assert.ok(result.pendingGiveHqHeroChoice !== undefined, 'chooser sees the give-HQ-Hero choice');
    assert.equal(result.pendingGiveHqHeroChoice!.playerID, '0');
    assert.equal(result.pendingGiveHqHeroChoice!.choiceType, 'give-hq-hero');
    assert.ok(result.pendingGiveHqHeroChoice!.eligible.length > 0, 'projects the HQ Heroes to gain');
  });

  it('an opponent does NOT see pendingGiveHqHeroChoice', () => {
    const result = filterUIStateForAudience(createGiveHqHeroUIState(), PLAYER_1);
    assert.equal(result.pendingGiveHqHeroChoice, undefined, 'opponent must not see the choice');
  });

  it('a spectator does NOT see pendingGiveHqHeroChoice', () => {
    const result = filterUIStateForAudience(createGiveHqHeroUIState(), SPECTATOR);
    assert.equal(result.pendingGiveHqHeroChoice, undefined, 'spectator must not see the choice');
  });
});

// ---------------------------------------------------------------------------
// WP-535 / D-24345 — pendingCopyPowersChoice redaction (chooser-scoped, Rogue Copy Powers)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where the current player '0' owes an interactive Copy Powers choice
 * (Rogue). The eligible list is projected from the player's own in-play Heroes, but the
 * prompt is chooser-scoped. Exercises the full Board-Visible Field round-trip: buildUIState
 * populates it and the audience filter passes it through only for the chooser (without the
 * filter pass-through arm the built field would be silently dropped → a client freeze).
 */
function createCopyPowersUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  // why: seed two DISTINCT real Heroes into player 0's inPlay with guaranteed non-null
  // classes so buildCopyPowersTargets surfaces both as copyable (the starting S.H.I.E.L.D.
  // cards carry heroClass null and would be filtered out; two copies of one ext_id would
  // dedupe to a single choice).
  const heroA = 'core/gambit/card-shark' as CardExtId;
  const heroB = 'core/wolverine/keen-senses' as CardExtId;
  gameState.playerZones['0']!.inPlay = [heroA, heroB] as LegendaryGameState['playerZones']['0']['inPlay'];
  gameState.cardTraits[heroA] = { heroClass: 'instinct', team: null };
  gameState.cardTraits[heroB] = { heroClass: 'covert', team: null };
  gameState.pendingCopyPowersChoices = [{ choiceType: 'copy-powers', playerID: '0', sourceCardId: 'core/rogue/copy-powers' }];
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingCopyPowersChoice redaction', () => {
  it('the chooser sees pendingCopyPowersChoice with the eligible Heroes', () => {
    const result = filterUIStateForAudience(createCopyPowersUIState(), PLAYER_0);
    assert.ok(result.pendingCopyPowersChoice !== undefined, 'chooser sees the Copy Powers choice');
    assert.equal(result.pendingCopyPowersChoice!.playerID, '0');
    assert.equal(result.pendingCopyPowersChoice!.choiceType, 'copy-powers');
    assert.equal(result.pendingCopyPowersChoice!.eligible.length, 2, 'projects both in-play Heroes to copy');
  });

  it('an opponent does NOT see pendingCopyPowersChoice', () => {
    const result = filterUIStateForAudience(createCopyPowersUIState(), PLAYER_1);
    assert.equal(result.pendingCopyPowersChoice, undefined, 'opponent must not see the choice');
  });

  it('a spectator does NOT see pendingCopyPowersChoice', () => {
    const result = filterUIStateForAudience(createCopyPowersUIState(), SPECTATOR);
    assert.equal(result.pendingCopyPowersChoice, undefined, 'spectator must not see the choice');
  });
});

// ---------------------------------------------------------------------------
// D-24132 — pendingPutAnyNumberBottomHQ redaction (chooser-scoped, multi-select sibling)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a put-any-number-bottom-hq choice. The pending
 * choice is chooser-scoped (only they may resolve it) — it must not appear in a non-chooser's
 * UIState. The HQ from setup has cards, so the field projects a non-empty eligibleHqCards list.
 */
function createPutAnyNumberBottomHQUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  gameState.pendingPutAnyNumberBottomHQ = [{ playerID: '0', sourceCardId: 'src' as CardExtId }];
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingPutAnyNumberBottomHQ redaction', () => {
  it('the chooser sees pendingPutAnyNumberBottomHQ', () => {
    const result = filterUIStateForAudience(createPutAnyNumberBottomHQUIState(), PLAYER_0);
    assert.ok(result.pendingPutAnyNumberBottomHQ !== undefined, 'chooser sees the put-any-number choice');
    assert.equal(result.pendingPutAnyNumberBottomHQ!.playerID, '0');
  });

  it('an opponent does NOT see pendingPutAnyNumberBottomHQ', () => {
    const result = filterUIStateForAudience(createPutAnyNumberBottomHQUIState(), PLAYER_1);
    assert.equal(result.pendingPutAnyNumberBottomHQ, undefined, 'opponent must not see the choice');
  });

  it('a spectator does NOT see pendingPutAnyNumberBottomHQ', () => {
    const result = filterUIStateForAudience(createPutAnyNumberBottomHQUIState(), SPECTATOR);
    assert.equal(result.pendingPutAnyNumberBottomHQ, undefined, 'spectator must not see the choice');
  });

  it('does not mutate the input UIState', () => {
    const uiState = createPutAnyNumberBottomHQUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingPutAnyNumberBottomHQ !== undefined, 'source UIState unchanged');
  });
});

// ---------------------------------------------------------------------------
// WP-258 / EC-289 — hollowEffects public value-preserving pass-through (D-12803)
// ---------------------------------------------------------------------------

/**
 * Builds two sample HollowEffectRecord values for the pass-through tests.
 */
function sampleHollowEffectRecords(): HollowEffectRecord[] {
  return [
    {
      cardId: 'core/black-widow/covert-operation#0',
      cardType: 'hero',
      timing: 'onPlay',
      mechanic: 'covert-operation',
      reason: 'no-handler',
      turn: 3,
    },
    {
      cardId: 'core/doombot-legion#1',
      cardType: 'villain',
      timing: 'onAmbush',
      mechanic: 'ambush-discard',
      reason: 'unsupported-keyword',
      turn: 5,
    },
  ];
}

/**
 * Builds a UIState carrying a populated G.diagnostics.hollowEffects channel.
 */
function createHollowEffectsUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  gameState.diagnostics = {
    hollowEffects: sampleHollowEffectRecords(),
    hollowEffectsDropped: 0,
  };
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — hollowEffects public pass-through (D-12803)', () => {
  it('own-player filtered hollowEffects deep-equals the source records', () => {
    // why: D-12803 — hollowEffects is public card/mechanic data; the filter must
    // pass it through value-unchanged for the own-player audience.
    const uiState = createHollowEffectsUIState();
    const source = uiState.hollowEffects;

    const result = filterUIStateForAudience(uiState, PLAYER_0);

    assert.ok(result.hollowEffects !== undefined, 'own-player must see hollowEffects');
    assert.deepStrictEqual(
      result.hollowEffects,
      source,
      'own-player hollowEffects must deep-equal the source records',
    );
  });

  it('other-player filtered hollowEffects deep-equals the SAME source records', () => {
    // why: D-12803 — the filter redacts NOTHING for hollowEffects; an opponent
    // sees the identical record values (no redact / reorder / rewrite / drop).
    const uiState = createHollowEffectsUIState();
    const source = uiState.hollowEffects;

    const result = filterUIStateForAudience(uiState, PLAYER_1);

    assert.ok(result.hollowEffects !== undefined, 'other-player must see hollowEffects');
    assert.deepStrictEqual(
      result.hollowEffects,
      source,
      'other-player hollowEffects must deep-equal the same source records',
    );
  });

  it('spectator filtered hollowEffects deep-equals the SAME source records', () => {
    // why: D-12803 — spectators are a non-owner public audience; same value-
    // preserving pass-through as the other-player case.
    const uiState = createHollowEffectsUIState();
    const source = uiState.hollowEffects;

    const result = filterUIStateForAudience(uiState, SPECTATOR);

    assert.ok(result.hollowEffects !== undefined, 'spectator must see hollowEffects');
    assert.deepStrictEqual(result.hollowEffects, source);
  });

  it('passes through value-equal but NOT array-identical (per-record fresh copy)', () => {
    // why: aliasing defense — value equality is required, array identity is NOT
    // (a shallow/per-record copy is allowed/preferred so the filtered view does
    // not alias the input). Mutating the filtered copy must not touch the source.
    const uiState = createHollowEffectsUIState();

    const result = filterUIStateForAudience(uiState, PLAYER_0);

    assert.notStrictEqual(
      result.hollowEffects,
      uiState.hollowEffects,
      'filtered hollowEffects must be a fresh array, not the same reference',
    );
    result.hollowEffects![0]!.mechanic = 'mutated';
    assert.notEqual(
      uiState.hollowEffects![0]!.mechanic,
      'mutated',
      'source UIState hollowEffects untouched by mutating the filtered copy',
    );
  });

  it('omits hollowEffects for all audiences when the source has none', () => {
    // why: optional field — an absent source omits it for every audience (no
    // empty-array injection).
    const config = createTestConfig();
    const registry = createMockRegistry();
    const setupContext = makeMockCtx();
    const gameState = buildInitialGameState(config, registry, setupContext);
    const uiState = buildUIState(gameState, mockCtx);
    assert.equal(uiState.hollowEffects, undefined);

    for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      assert.equal(result.hollowEffects, undefined);
      assert.equal('hollowEffects' in result, false);
    }
  });
});

// ---------------------------------------------------------------------------
// D-24139 — pendingReturnZeroCostDiscard redaction (chooser-scoped)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a return-zero-cost-discard choice with one
 * eligible 0-cost card in their discard pile. The pending choice is chooser-scoped
 * (only they may resolve it) — it must not appear in a non-chooser's UIState.
 */
function createReturnZeroCostDiscardUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);
  // why: starting-shield-agent carries an explicit cost-0 cardStats entry from setup,
  // so the projection's 0-cost filter keeps it eligible.
  gameState.playerZones['0']!.discard = ['starting-shield-agent' as CardExtId];
  gameState.pendingReturnZeroCostDiscard = [{ playerID: '0', sourceCardId: 'src' as CardExtId }];
  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingReturnZeroCostDiscard redaction (D-24139)', () => {
  it('the chooser sees pendingReturnZeroCostDiscard with the eligible discard cards', () => {
    const result = filterUIStateForAudience(createReturnZeroCostDiscardUIState(), PLAYER_0);
    assert.ok(result.pendingReturnZeroCostDiscard !== undefined, 'chooser sees the return choice');
    assert.equal(result.pendingReturnZeroCostDiscard!.playerID, '0');
    assert.equal(result.pendingReturnZeroCostDiscard!.eligibleDiscardCards.length, 1,
      'eligibleDiscardCards projected for the chooser');
  });

  it('an opponent does NOT see pendingReturnZeroCostDiscard', () => {
    const result = filterUIStateForAudience(createReturnZeroCostDiscardUIState(), PLAYER_1);
    assert.equal(result.pendingReturnZeroCostDiscard, undefined, 'opponent must not see the choice');
  });

  it('a spectator does NOT see pendingReturnZeroCostDiscard', () => {
    const result = filterUIStateForAudience(createReturnZeroCostDiscardUIState(), SPECTATOR);
    assert.equal(result.pendingReturnZeroCostDiscard, undefined, 'spectator must not see the choice');
  });

  it('does not mutate the input UIState', () => {
    const uiState = createReturnZeroCostDiscardUIState();
    filterUIStateForAudience(uiState, PLAYER_1);
    assert.ok(uiState.pendingReturnZeroCostDiscard !== undefined, 'source UIState unchanged');
  });
});

describe('filterUIStateForAudience — matchCardImageUrls (WP-410 / D-24222)', () => {
  const SAMPLE_MANIFEST = [
    'https://images.legendary-arena.com/set/a.webp',
    'https://images.legendary-arena.com/set/b.webp',
  ];

  it('passes the manifest through value-equal for a player AND a spectator', () => {
    const uiState = createTestUIState();
    // why: set a known manifest so the survival check is non-vacuous. The field is
    // PUBLIC (no redaction), so it must arrive value-equal for every audience —
    // without this pass-through it is dropped at the whitelist boundary.
    uiState.matchCardImageUrls = [...SAMPLE_MANIFEST];
    for (const audience of [PLAYER_0, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      assert.deepStrictEqual(result.matchCardImageUrls, SAMPLE_MANIFEST);
    }
  });

  it('produces a fresh array copy (no aliasing with the input)', () => {
    const uiState = createTestUIState();
    uiState.matchCardImageUrls = [...SAMPLE_MANIFEST];
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    assert.notStrictEqual(
      result.matchCardImageUrls,
      uiState.matchCardImageUrls,
      'must be a fresh array, not a reference into the input UIState',
    );
    assert.deepStrictEqual(result.matchCardImageUrls, SAMPLE_MANIFEST);
  });
});

// ---------------------------------------------------------------------------
// WP-486 / EC-521 — pendingDefeatChoice redaction (D-24011)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState where player '0' owes a Silent Sniper defeat-with-a-Bystander
 * choice between a City Villain and the Mastermind. The choice is the chooser's
 * pending decision — it must not project to opponents or spectators.
 */
function createDefeatChoiceUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  gameState.pendingDefeatChoices = [
    {
      choiceType: 'defeat-with-bystander',
      playerID: '0',
      targets: [
        { kind: 'villain', cityIndex: 0, cardId: 'defeat-villain-a' },
        { kind: 'mastermind', cardId: gameState.mastermind.baseCardId },
      ],
    },
  ];

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — pendingDefeatChoice redaction (WP-486 / D-24291)', () => {
  it('the chooser sees pendingDefeatChoice with the full target list', () => {
    const uiState = createDefeatChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_0);
    assert.ok(result.pendingDefeatChoice !== undefined, 'chooser sees the defeat choice');
    assert.equal(result.pendingDefeatChoice!.playerID, '0');
    assert.equal(result.pendingDefeatChoice!.targets.length, 2, 'both parked targets survive for the chooser');
    assert.equal(result.pendingDefeatChoice!.targets[0]!.cityIndex, 0, 'the villain target keeps its cityIndex selector');
  });

  it('an opponent does NOT see pendingDefeatChoice', () => {
    const uiState = createDefeatChoiceUIState();
    const result = filterUIStateForAudience(uiState, PLAYER_1);
    assert.equal(result.pendingDefeatChoice, undefined, 'opponent must not see the defeat choice');
  });

  it('a spectator does NOT see pendingDefeatChoice', () => {
    const uiState = createDefeatChoiceUIState();
    const result = filterUIStateForAudience(uiState, SPECTATOR);
    assert.equal(result.pendingDefeatChoice, undefined, 'spectator must not see the defeat choice');
  });

  // why: WP-502 / D-24306 — the early-end gameOver is public board state (the
  // match is over for everyone), so its endedEarly marker must survive the
  // audience filter's `{ ...uiState.gameOver }` spread for players AND spectators.
  it('an early-ended gameOver.endedEarly survives the filter for every audience', () => {
    const gameState = buildInitialGameState(
      createTestConfig(),
      createMockRegistry(),
      makeMockCtx(),
    );
    gameState.counters[ENDGAME_CONDITIONS.MATCH_ENDED_EARLY] = 1;
    const uiState = buildUIState(gameState, mockCtx);
    assert.equal(uiState.gameOver?.endedEarly, true, 'precondition: build projects endedEarly');

    for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
      const result = filterUIStateForAudience(uiState, audience);
      assert.equal(result.gameOver?.endedEarly, true, 'endedEarly must survive the filter');
      assert.equal(result.gameOver?.outcome, 'tie', 'early end reuses the tie outcome');
    }
  });
});

// ---------------------------------------------------------------------------
// WP-505 — city captured-card fields survive the audience filter (public)
// ---------------------------------------------------------------------------

/**
 * Builds a UIState with a city villain holding one captured hero and two
 * captured bystanders, so the WP-505 fields are non-empty (count > 0).
 */
function createWp505CityUIState(): UIState {
  const config = createTestConfig();
  const registry = createMockRegistry();
  const setupContext = makeMockCtx();
  const gameState = buildInitialGameState(config, registry, setupContext);

  const villainExtId = 'wp505-villain-00' as CardExtId;
  const heroExtId = 'wp505-hero-00' as CardExtId;
  gameState.city[0] = villainExtId;
  gameState.villainAttachedHeroes[villainExtId] = [heroExtId];
  gameState.attachedBystanders[villainExtId] = ['wp505-bys-00', 'wp505-bys-01'] as CardExtId[];

  return buildUIState(gameState, mockCtx);
}

describe('filterUIStateForAudience — WP-505 city captured-card fields', () => {
  // why: non-vacuous — attachedBystanderCount is 2 (a 0 count is falsy and
  // would pass a truthiness check trivially) and attachedHeroDisplay has one
  // entry, asserted by EXACT equality against the pre-filter UIState for every
  // audience. Both fields are public board state and must never be redacted.
  for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
    it(`preserves attachedHeroDisplay + attachedBystanderCount for ${audience.kind}`, () => {
      const uiState = createWp505CityUIState();
      const space0 = uiState.city.spaces[0]!;
      assert.equal(space0.attachedBystanderCount, 2, 'precondition: count is non-zero');
      assert.equal(space0.attachedHeroDisplay.length, 1, 'precondition: one captured hero');

      const result = filterUIStateForAudience(uiState, audience);
      const filtered0 = result.city.spaces[0]!;

      assert.equal(
        filtered0.attachedBystanderCount,
        space0.attachedBystanderCount,
        `attachedBystanderCount must survive for ${audience.kind}`,
      );
      assert.equal(
        filtered0.attachedHeroDisplay.length,
        space0.attachedHeroDisplay.length,
        `attachedHeroDisplay length must survive for ${audience.kind}`,
      );
      assert.equal(
        filtered0.attachedHeroDisplay[0]!.extId,
        space0.attachedHeroDisplay[0]!.extId,
        `attachedHeroDisplay[0] identity must survive for ${audience.kind}`,
      );
    });
  }
});

describe('menace signal survives the audience filter (WP-557 / D-24366)', () => {
  // why: the four menace fields ride the `progress: { ...uiState.progress }`
  // spread in uiState.filter.ts, so today they pass through with no filter
  // edit. THAT SPREAD IS EXACTLY WHAT THIS TEST PINS. The shipped EC-206
  // failure was a field-by-field rebuild of a shared-board object silently
  // dropping new fields (blank scheme tile in every match, PR #1165); if a
  // future change rewrites `progress` the same way, these assertions fail
  // instead of the danger meter going quietly dead on the play surface.
  // Menace is public: it is derived from the twist count and the escaped
  // pile, both already visible on the shared board, so no audience is redacted.
  for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
    it(`preserves all four menace fields for ${audience.kind}`, () => {
      const uiState = createTestUIState();

      const result = filterUIStateForAudience(uiState, audience);

      assert.equal(
        result.progress.menace,
        uiState.progress.menace,
        `menace must survive for ${audience.kind}`,
      );
      assert.equal(
        result.progress.menaceTier,
        uiState.progress.menaceTier,
        `menaceTier must survive for ${audience.kind}`,
      );
      assert.equal(
        result.progress.schemeLossProgress,
        uiState.progress.schemeLossProgress,
        `schemeLossProgress must survive for ${audience.kind}`,
      );
      assert.equal(
        result.progress.schemeLossThreshold,
        uiState.progress.schemeLossThreshold,
        `schemeLossThreshold must survive for ${audience.kind}`,
      );
    });
  }

  it('preserves a non-zero menace rather than defaulting it away', () => {
    // why: an all-zero fixture would pass even if the filter dropped the
    // fields and the reader defaulted to 0. Drive a real value through.
    const config = createTestConfig();
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, makeMockCtx());
    gameState.counters.schemeTwistCount = 5;
    const uiState = buildUIState(gameState, makeMockCtx());

    assert.notEqual(uiState.progress.menace, 0);

    const result = filterUIStateForAudience(uiState, SPECTATOR);

    assert.equal(result.progress.menace, uiState.progress.menace);
    assert.equal(result.progress.menaceTier, 'critical');
  });
});

describe('scheme-faithful loss fields survive the audience filter (WP-562 / D-24371)', () => {
  // why: the Board-Visible Field Rule's step 3/4 pair. Both new fields are
  // OPTIONAL, which is precisely the shape that gets dropped silently at the
  // filter — a field that reaches buildUIState but not the client renders as an
  // unlabelled meter and a denominator-less twist readout, with nothing failing
  // to compile. Public data: both are derived from the scheme config and the
  // shared-board piles, so no audience is redacted.
  for (const audience of [PLAYER_0, PLAYER_1, SPECTATOR]) {
    it(`preserves schemeLossKind and schemeTwistThreshold for ${audience.kind}`, () => {
      const uiState = createTestUIState();

      const result = filterUIStateForAudience(uiState, audience);

      assert.equal(
        result.progress.schemeLossKind,
        uiState.progress.schemeLossKind,
        `schemeLossKind must survive for ${audience.kind}`,
      );
      assert.equal(
        result.progress.schemeTwistThreshold,
        uiState.progress.schemeTwistThreshold,
        `schemeTwistThreshold must survive for ${audience.kind}`,
      );
    });
  }

  it('drives a real hero-deck kind through the filter, not an absent one', () => {
    // why: an unconfigured fixture projects 'twists' and could pass even if the
    // filter dropped the field and a reader defaulted. Repoint at a
    // pile-depleted scheme with a real capture so the value is distinctive.
    const config = createTestConfig();
    const registry = createMockRegistry();
    const gameState = buildInitialGameState(config, registry, makeMockCtx());
    gameState.selection.schemeId = 'core/super-hero-civil-war';
    gameState.schemeLossPileSetupSize = 42;
    gameState.heroDeck = ['a', 'b', 'c'];
    const uiState = buildUIState(gameState, makeMockCtx());

    assert.equal(uiState.progress.schemeLossKind, 'hero-deck');

    const result = filterUIStateForAudience(uiState, SPECTATOR);

    assert.equal(result.progress.schemeLossKind, 'hero-deck');
    assert.equal(result.progress.schemeLossThreshold, 42);
    assert.equal(result.progress.schemeTwistThreshold, 8);
  });
});
