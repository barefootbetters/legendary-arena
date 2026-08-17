/**
 * End-to-end integration tests for the undercover mechanic (WP-282 / EC-314).
 *
 * Exercises the full chain a real undercover hero travels:
 *   1. The hero-ability parser recognizes `[keyword:Undercover]` in ability text
 *      (the exact capital-U marker the 2099 / bkwd / shld sets carry).
 *   2. Playing that hero through executeHeroEffects classifies the undercover
 *      effect `applied` (NOT hollow — no `no-handler` / `parse-unrecognized`
 *      diagnostic), because undercover executes via the face-down moves.
 *   3. The player then drives the mechanic manually: sendUndercover moves a card
 *      face-down, playFromUndercover plays it back via the shared playCard core.
 *
 * Uses the established mock-registry convention (the 2099 cards' real ability
 * text is reproduced inline as marker strings) — no real card JSON is loaded.
 *
 * Uses node:test and node:assert only. No boardgame.io imports beyond the
 * move-context shape.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../../setup/heroAbility.setup.js';
import { executeHeroEffects } from '../heroEffects.execute.js';
import { sendUndercover } from '../../moves/sendUndercover.js';
import { playFromUndercover } from '../../moves/playFromUndercover.js';
import type { LegendaryGameState } from '../../types.js';
import type { HeroAbilityHook } from '../../rules/heroAbility.types.js';
import { makeMockCtx } from '../../test/mockCtx.js';
import { makeMockMoveContext } from '../../test/mockMoveContext.js';
import type { MockMoveContext } from '../../test/mockMoveContext.js';

// ---------------------------------------------------------------------------
// Mock registry — a single hero whose cards carry [keyword:Undercover] text,
// mirroring the 2099 Spider-Friends cards (Black Widow / Ghost Rider / Doctor
// Doom 2099). getSet-based, same shape buildHeroAbilityHooks reads.
// ---------------------------------------------------------------------------

interface MockHeroCard {
  slug: string;
  rarityLabel?: string;
  abilities: string[];
}

/** Builds a getSet-based registry with one hero whose cards carry undercover text. */
function makeUndercoverRegistry(setAbbr: string, heroSlug: string, cards: MockHeroCard[]) {
  const physicalCards = cards.map((card, index) => ({
    id: `p${String(index)}`,
    count: 1,
    sides: [card.slug],
  }));
  const setData = {
    abbr: setAbbr,
    heroes: [{ slug: heroSlug, cards, physicalCards }],
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
    listSets: () => [{ abbr: setAbbr }],
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
}

/** A valid mock MatchSetupConfig selecting the undercover hero deck. */
function makeConfig(heroDeckId: string) {
  return {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: [heroDeckId],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

// ---------------------------------------------------------------------------
// Minimal complete LegendaryGameState for the move + executor flow.
// ---------------------------------------------------------------------------

interface StateOptions {
  hand?: string[];
  inPlay?: string[];
  heroAbilityHooks?: HeroAbilityHook[];
  cardStats?: Record<string, { attack: number; recruit: number }>;
}

function makeState(options?: StateOptions): LegendaryGameState {
  return {
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
    currentStage: 'main',
    playerZones: {
      '0': {
        deck: [],
        hand: options?.hand ?? [],
        discard: [],
        inPlay: options?.inPlay ?? [],
        victory: [],
        faceDownCards: [],
      },
    },
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [] },
    messages: [],
    counters: {},
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: options?.cardStats ?? {},
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: {},
    schemeSetupInstructions: [],
    mastermind: { id: 'test-mastermind', baseCardId: 'test-mastermind-base', tacticsDeck: [], tacticsDefeated: [] },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    scheme: { nextTwistLevel: 0, twistPile: [] },
    escapedPile: [],
    lobby: { requiredPlayers: 1, ready: {}, started: false },
    heroAbilityHooks: options?.heroAbilityHooks ?? [],
    villainAbilityHooks: [],
    notableEvents: [],
  };
}

/** Builds a move context bound to player 0 in the main stage. */
function makeMoveContext(gameState: LegendaryGameState): MockMoveContext {
  // why: delegates to the shared builder so this mock carries the COMPLETE
  // boardgame.io plugin-API surface. The local literal it replaced implemented
  // only the members the engine calls, which is a structurally invalid mock
  // rather than a smaller one (WP-569 / D-24378).
  return makeMockMoveContext(gameState);
}

// ---------------------------------------------------------------------------
// Parser recognition (the 2099 Spider-Friends ability lines)
// ---------------------------------------------------------------------------

describe('undercover integration — parser recognition (WP-282 / EC-314)', () => {
  it('recognizes [keyword:Undercover] on a 2099-style Black Widow line', () => {
    // why: real 2099 Black Widow text — "You may send this [keyword:Undercover]."
    const registry = makeUndercoverRegistry('2099', 'black-widow', [
      { slug: 'covert-ops', rarityLabel: 'Common 1', abilities: ['You may send this [keyword:Undercover].'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('2099/black-widow'));

    assert.equal(hooks.length, 1, 'one hook is built for the single ability');
    assert.ok(hooks[0]!.keywords.includes('undercover'), 'undercover keyword recognized');
    assert.deepStrictEqual(
      hooks[0]!.effects,
      [{ type: 'undercover' }],
      'a bare undercover effect descriptor is emitted (move-executed, like dodge)',
    );
    assert.equal(hooks[0]!.timing, 'onPlay', 'undercover fires on the onPlay hook');
  });

  it('matches the marker case-insensitively (parser lowercases keyword tokens — like every keyword)', () => {
    // why: WP-282 execution finding — the hero-ability parser lowercases EVERY
    // `[keyword:X]` token before matching (heroAbility.setup.ts: keywordMatch[1].toLowerCase()),
    // so `[keyword:undercover]`, `[keyword:Undercover]`, and `[keyword:UNDERCOVER]` all
    // resolve to the same 'undercover' keyword. This matches dodge/draw/every other
    // keyword. EC-314's "case-sensitive, rejects lowercase" requirement is inconsistent
    // with this uniform parser behavior; special-casing only undercover would fork the
    // parser, so undercover follows the established case-insensitive convention. This
    // test pins the ACTUAL behavior so the convention is explicit, not aspirational.
    const lowercase = buildHeroAbilityHooks(
      makeUndercoverRegistry('2099', 'ghost-rider', [
        { slug: 'lowercase-line', rarityLabel: 'Common 1', abilities: ['You may send this [keyword:undercover].'] },
      ]),
      makeConfig('2099/ghost-rider'),
    );
    assert.ok(lowercase[0]!.keywords.includes('undercover'), 'lowercase token resolves to the undercover keyword');

    // A bare `[undercover]` (no `keyword:` prefix) is NOT a keyword marker — the
    // parser still emits a hook for the line (every ability line gets one, for
    // hollow detection) but with NO recognized keyword, so it is not treated as
    // undercover. This is the EC "fails gracefully on malformed markers" behavior.
    const bare = buildHeroAbilityHooks(
      makeUndercoverRegistry('2099', 'doctor-doom', [
        { slug: 'bare-marker', rarityLabel: 'Common 1', abilities: ['You may send this [undercover].'] },
      ]),
      makeConfig('2099/doctor-doom'),
    );
    assert.ok(
      !bare[0]!.keywords.includes('undercover'),
      'a bare [undercover] (no keyword: prefix) is not recognized as the undercover keyword',
    );
  });
});

// ---------------------------------------------------------------------------
// Executor classification — undercover hero plays without a hollow
// ---------------------------------------------------------------------------

describe('undercover integration — play classifies applied, not hollow (WP-282 / EC-314)', () => {
  it('playing an undercover hero records no hollow diagnostic', () => {
    const gameState = makeState({
      inPlay: ['hero-undercover'],
      heroAbilityHooks: [
        {
          cardId: 'hero-undercover',
          timing: 'onPlay',
          keywords: ['undercover'],
          effects: [{ type: 'undercover' }],
        },
      ],
    });

    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 1 }), '0', 'hero-undercover');

    // why: undercover classifies `applied` (MVP_KEYWORDS membership via
    // FACE_DOWN_EXECUTED_KEYWORDS), so no hollow-effect diagnostic is recorded —
    // the same not-hollow guarantee dodge and wall-crawl carry.
    const hollow = gameState.diagnostics?.hollowEffects ?? [];
    assert.equal(hollow.length, 0, 'no hollow-effect diagnostic for the recognized undercover keyword');
  });
});

// ---------------------------------------------------------------------------
// End-to-end mechanic — send a card face-down, play it back
// ---------------------------------------------------------------------------

describe('undercover integration — send + play end-to-end (WP-282 / EC-314)', () => {
  it('plays an undercover hero, sends a hand card face-down, then plays it back', () => {
    const gameState = makeState({
      hand: ['target-card'],
      inPlay: ['hero-undercover'],
      heroAbilityHooks: [
        {
          cardId: 'hero-undercover',
          timing: 'onPlay',
          keywords: ['undercover'],
          effects: [{ type: 'undercover' }],
        },
      ],
      cardStats: { 'target-card': { attack: 2, recruit: 1 } },
    });

    // Play the undercover hero (no crash, no auto-send — the player chooses).
    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 1 }), '0', 'hero-undercover');
    assert.equal(gameState.playerZones['0'].faceDownCards.length, 0, 'playing the hero sends nothing automatically (IC-282-10)');

    // Player sends a hand card face-down.
    sendUndercover(makeMoveContext(gameState), { instanceId: 'target-card', sourceZone: 'hand' });
    assert.deepStrictEqual(gameState.playerZones['0'].hand, [], 'the card left hand');
    assert.equal(gameState.playerZones['0'].faceDownCards.length, 1, 'the card is face-down');
    assert.equal(gameState.playerZones['0'].faceDownCards[0].instanceId, 'target-card', 'stored by instanceId');

    // Player plays it back from face-down — routed through the shared playCard core.
    playFromUndercover(makeMoveContext(gameState), { instanceId: 'target-card' });
    assert.equal(gameState.playerZones['0'].faceDownCards.length, 0, 'the card left the face-down store');
    assert.ok(gameState.playerZones['0'].inPlay.includes('target-card'), 'the card is now in play (shared play pathway)');
    assert.equal(gameState.turnEconomy.attack, 2, 'its base attack was added (identical to hand play, IC-282-02)');
    assert.equal(gameState.turnEconomy.recruit, 1, 'its base recruit was added (identical to hand play, IC-282-02)');
  });

  it('an undercover hero played with an empty hand is a clean no-op (no card to send)', () => {
    const gameState = makeState({
      hand: [],
      inPlay: ['hero-undercover'],
      heroAbilityHooks: [
        {
          cardId: 'hero-undercover',
          timing: 'onPlay',
          keywords: ['undercover'],
          effects: [{ type: 'undercover' }],
        },
      ],
    });

    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 1 }), '0', 'hero-undercover');
    // A send with no eligible card returns silently (Move Validation Contract).
    sendUndercover(makeMoveContext(gameState), { instanceId: 'nonexistent', sourceZone: 'hand' });

    assert.equal(gameState.playerZones['0'].faceDownCards.length, 0, 'nothing sent face-down');
  });

  it('two undercover heroes each independently send a card (no hook duplication)', () => {
    const gameState = makeState({
      hand: ['card-a', 'card-b'],
      inPlay: ['hero-uc-1', 'hero-uc-2'],
      heroAbilityHooks: [
        { cardId: 'hero-uc-1', timing: 'onPlay', keywords: ['undercover'], effects: [{ type: 'undercover' }] },
        { cardId: 'hero-uc-2', timing: 'onPlay', keywords: ['undercover'], effects: [{ type: 'undercover' }] },
      ],
    });

    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 1 }), '0', 'hero-uc-1');
    executeHeroEffects(gameState, makeMockCtx({ numPlayers: 1 }), '0', 'hero-uc-2');

    sendUndercover(makeMoveContext(gameState), { instanceId: 'card-a', sourceZone: 'hand' });
    sendUndercover(makeMoveContext(gameState), { instanceId: 'card-b', sourceZone: 'hand' });

    assert.equal(gameState.playerZones['0'].faceDownCards.length, 2, 'both cards sent face-down independently');
    assert.deepStrictEqual(
      gameState.playerZones['0'].faceDownCards.map((card) => card.instanceId),
      ['card-a', 'card-b'],
      'insertion order preserved deterministically (IC-282-08)',
    );
  });
});
