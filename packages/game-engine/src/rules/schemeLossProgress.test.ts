/**
 * Tests for the shared scheme loss-progress derivation (WP-557 / D-24366).
 *
 * Covers the four-rung denominator resolution order, the condition-aware
 * numerator, the clamped menace scalar, the tier boundaries, and the
 * `pile-depleted` no-denominator fallback.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MENACE_TIERS,
  MVP_SCHEME_TWIST_THRESHOLD,
  SCHEME_LOSS_KINDS,
  computeMenace,
  isTwistLossSuppressed,
  menaceTierFor,
  resolveSchemeLossKind,
  resolveSchemeLossPileSetupSize,
  resolveSchemeLossProgress,
  resolveSchemeLossThreshold,
  resolveTwistLossThreshold,
} from './schemeLossProgress.js';
import type { MenaceTier, SchemeLossKind } from './schemeLossProgress.js';
import type { LegendaryGameState } from '../types.js';

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

interface TestStateOptions {
  schemeId: string;
  requiredPlayers?: number;
  twistCount?: number;
  escapedPile?: string[];
  villainDeckCardTypes?: Record<string, string>;
  convertedVillainOrigins?: Record<string, string>;
  // why: WP-562 — the three fields the depletion derivation reads. Omitting
  // schemeLossPileSetupSize models a pre-WP-562 recorded state, which is the
  // legacy fallback path asserted further down.
  schemeLossPileSetupSize?: number;
  heroDeckRemaining?: number;
  woundsRemaining?: number;
}

/**
 * Builds an array of placeholder card ids of a given length.
 *
 * The derivation reads only `.length` on these piles, so the ids are filler.
 *
 * @param count - How many placeholder entries to produce.
 * @returns An array of that many distinct id strings.
 */
function makeCardIds(count: number): string[] {
  const ids: string[] = [];
  for (let index = 0; index < count; index = index + 1) {
    ids.push(`card-${index}`);
  }
  return ids;
}

/**
 * Creates a minimal LegendaryGameState for loss-progress testing.
 *
 * @param options - Scheme identity plus the counters/zones the derivation reads.
 * @returns A minimal LegendaryGameState.
 */
function makeTestState(options: TestStateOptions): LegendaryGameState {
  const state = {
    matchConfiguration: {
      schemeId: options.schemeId,
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
      schemeId: options.schemeId,
      mastermindId: 'test-mastermind',
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    currentStage: 'main',
    playerZones: {
      '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
    },
    piles: {
      bystanders: [],
      wounds: makeCardIds(options.woundsRemaining ?? 0),
      officers: [],
      sidekicks: [],
    },
    messages: [],
    notableEvents: [],
    counters: { schemeTwistCount: options.twistCount ?? 0 },
    hookRegistry: [],
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: options.villainDeckCardTypes ?? {},
    ko: [],
    attachedBystanders: {},
    turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0 },
    cardStats: {},
    mastermind: {
      id: 'test-mastermind',
      baseCardId: 'test-mastermind-base',
      tacticsDeck: [],
      tacticsDefeated: [],
      strikePile: [],
      attachedBystanders: [],
    },
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    lobby: { requiredPlayers: options.requiredPlayers ?? 2, ready: {}, started: false },
    heroAbilityHooks: [],
    scheme: { twistPile: [] },
    escapedPile: options.escapedPile ?? [],
    heroDeck: makeCardIds(options.heroDeckRemaining ?? 0),
  } as unknown as LegendaryGameState;

  if (options.convertedVillainOrigins !== undefined) {
    (state as { convertedVillainOrigins?: Record<string, string> })
      .convertedVillainOrigins = options.convertedVillainOrigins;
  }

  // why: assigned conditionally so an omitted option leaves the key ABSENT
  // rather than present-and-undefined — absence is what a pre-WP-562 recorded
  // state carries, and the fallback branch keys on it.
  if (options.schemeLossPileSetupSize !== undefined) {
    (state as { schemeLossPileSetupSize?: number }).schemeLossPileSetupSize =
      options.schemeLossPileSetupSize;
  }

  return state;
}

// ---------------------------------------------------------------------------
// Denominator resolution order (D-24366 §1) — AC-1
// ---------------------------------------------------------------------------

describe('resolveSchemeLossThreshold — the four-rung order (WP-557 / D-24366 §1)', () => {
  it('rung 1: a resourceLossCondition threshold wins outright', () => {
    // why: Negative Zone declares escaped-pile-count / villain / 12. D-24315
    // suppresses its twist proxy, so 12 — not its lossThreshold of 8 — is the
    // denominator. This is the rung most easily lost by reusing the twist order.
    const gameState = makeTestState({ schemeId: 'core/negative-zone-prison-breakout' });
    assert.equal(resolveSchemeLossThreshold(gameState), 12);
  });

  it('rung 1: an escaped-converted-count threshold also wins', () => {
    const gameState = makeTestState({
      schemeId: 'core/secret-invasion-of-the-skrull-shapeshifters',
    });
    assert.equal(resolveSchemeLossThreshold(gameState), 6);
  });

  it('rung 2: a per-player-count override resolves by seat count', () => {
    // why: Super Hero Civil War is the only config with a player-count map
    // (8 at 2-3p, 5 at 4-5p). It is ALSO pile-depleted, so the threshold field
    // is omitted — the player-count rung is asserted via the twist resolver.
    const threePlayer = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 3,
    });
    const fourPlayer = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 4,
    });
    assert.equal(resolveTwistLossThreshold(threePlayer), 8);
    assert.equal(resolveTwistLossThreshold(fourPlayer), 5);
  });

  it('rung 3: a scalar lossThreshold resolves when no condition or map applies', () => {
    // why: Cosmic Cube is a true twist-loss scheme with a printed 8-twist
    // stack — it must NOT fall through to the arbitrary 7 fallback.
    const gameState = makeTestState({
      schemeId: 'core/unleash-the-power-of-the-cosmic-cube',
    });
    assert.equal(resolveSchemeLossThreshold(gameState), 8);
  });

  it('rung 4: an unconfigured scheme falls back to the MVP threshold of 7', () => {
    const gameState = makeTestState({ schemeId: 'not-a-real-scheme' });
    assert.equal(resolveSchemeLossThreshold(gameState), MVP_SCHEME_TWIST_THRESHOLD);
    assert.equal(MVP_SCHEME_TWIST_THRESHOLD, 7);
  });

  it('the fallback is 7, never 8 — 8 is a per-scheme value, not a default', () => {
    // why: pins the exact off-by-one the arena-client HUD shipped (a hardcoded
    // /8 denominator). If this ever reads 8, the fallback has been "corrected"
    // to match the client's bug rather than the engine's rule.
    assert.notEqual(MVP_SCHEME_TWIST_THRESHOLD, 8);
  });
});

describe('isTwistLossSuppressed (D-24315)', () => {
  it('is true for a scheme declaring a resourceLossCondition', () => {
    const gameState = makeTestState({ schemeId: 'core/super-hero-civil-war' });
    assert.equal(isTwistLossSuppressed(gameState), true);
  });

  it('is false for a true twist-loss scheme', () => {
    const gameState = makeTestState({
      schemeId: 'core/portals-to-the-dark-dimension',
    });
    assert.equal(isTwistLossSuppressed(gameState), false);
  });
});

// ---------------------------------------------------------------------------
// Condition-aware numerator — AC-3
// ---------------------------------------------------------------------------

describe('resolveSchemeLossProgress — the condition-aware numerator', () => {
  it('counts matching escaped-pile entries for an escaped-pile-count scheme', () => {
    // why: Negative Zone counts VILLAINS in the escaped pile, so the bystander
    // entry must not be counted.
    const gameState = makeTestState({
      schemeId: 'core/negative-zone-prison-breakout',
      escapedPile: ['villain-a', 'villain-b', 'bystander-a'],
      villainDeckCardTypes: {
        'villain-a': 'villain',
        'villain-b': 'villain',
        'bystander-a': 'bystander',
      },
    });
    assert.equal(resolveSchemeLossProgress(gameState), 2);
  });

  it('counts converted-origin entries for an escaped-converted-count scheme', () => {
    // why: Secret Invasion counts escaped SKRULLS. A converted card is typed
    // 'villain' for routing, so counting by type would over-count here.
    const gameState = makeTestState({
      schemeId: 'core/secret-invasion-of-the-skrull-shapeshifters',
      escapedPile: ['skrull-a', 'skrull-b', 'villain-real'],
      villainDeckCardTypes: {
        'skrull-a': 'villain',
        'skrull-b': 'villain',
        'villain-real': 'villain',
      },
      convertedVillainOrigins: { 'skrull-a': 'skrull', 'skrull-b': 'skrull' },
    });
    assert.equal(resolveSchemeLossProgress(gameState), 2);
  });

  it('counts resolved twists for a twist-loss scheme', () => {
    const gameState = makeTestState({
      schemeId: 'core/unleash-the-power-of-the-cosmic-cube',
      twistCount: 3,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 3);
  });

  it('reads the loss-bearing counter, not the twist pile length', () => {
    // why: G.counters.schemeTwistCount is the value the loss check compares
    // against the threshold; G.scheme.twistPile is a zone that can differ
    // mid-resolution. Menace must track the value the rules actually turn on.
    const gameState = makeTestState({
      schemeId: 'core/unleash-the-power-of-the-cosmic-cube',
      twistCount: 4,
    });
    gameState.scheme.twistPile = ['t1', 't2'];
    assert.equal(resolveSchemeLossProgress(gameState), 4);
  });
});

// ---------------------------------------------------------------------------
// Menace scalar — AC-4, AC-9
// ---------------------------------------------------------------------------

describe('computeMenace — normalized, clamped 0..1', () => {
  it('is 0 at the start of a match', () => {
    const gameState = makeTestState({
      schemeId: 'core/unleash-the-power-of-the-cosmic-cube',
    });
    assert.equal(computeMenace(gameState), 0);
  });

  it('reports the ratio partway through', () => {
    const gameState = makeTestState({
      schemeId: 'core/unleash-the-power-of-the-cosmic-cube',
      twistCount: 4,
    });
    assert.equal(computeMenace(gameState), 0.5);
  });

  it('clamps to exactly 1 at the threshold and never exceeds it', () => {
    const atThreshold = makeTestState({
      schemeId: 'core/unleash-the-power-of-the-cosmic-cube',
      twistCount: 8,
    });
    const pastThreshold = makeTestState({
      schemeId: 'core/unleash-the-power-of-the-cosmic-cube',
      twistCount: 40,
    });
    assert.equal(computeMenace(atThreshold), 1);
    assert.equal(computeMenace(pastThreshold), 1);
  });

  it('never produces NaN or Infinity for any configured scheme', () => {
    // why: this projection feeds a meter and a music channel — a NaN there
    // renders as a broken UI, not a safe state. Guardrail 6.
    const schemeIds = [
      'core/midtown-bank-robbery',
      'core/legacy-virus-the',
      'core/negative-zone-prison-breakout',
      'core/unleash-the-power-of-the-cosmic-cube',
      'core/super-hero-civil-war',
      'core/replace-earths-leaders-with-killbots',
      'core/secret-invasion-of-the-skrull-shapeshifters',
      'core/portals-to-the-dark-dimension',
      'not-a-real-scheme',
    ];
    for (const schemeId of schemeIds) {
      const menace = computeMenace(makeTestState({ schemeId, twistCount: 3 }));
      assert.equal(Number.isFinite(menace), true, `${schemeId} produced ${menace}`);
      assert.equal(menace >= 0 && menace <= 1, true, `${schemeId} produced ${menace}`);
    }
  });
});

// ---------------------------------------------------------------------------
// pile-depleted measures DEPLETION (WP-562 / D-24371 §1) — AC-1, AC-3
// ---------------------------------------------------------------------------

describe('pile-depleted schemes measure their own pile (WP-562 / D-24371 §1)', () => {
  it('AC-1: Civil War measures the hero deck against its setup size', () => {
    // why: THE reported defect. This exact state — 42 hero cards built, 11 left —
    // rendered `3/7 twists` live at gitSha 8eb8b0c, for a scheme whose printed
    // Evil Wins is "If the Hero Deck runs out". It must now read 31/42.
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 1,
      twistCount: 3,
      schemeLossPileSetupSize: 42,
      heroDeckRemaining: 11,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 31);
    assert.equal(resolveSchemeLossThreshold(gameState), 42);
    assert.equal(computeMenace(gameState), 31 / 42);
    // why: pins that the numerator is NOT the twist count. 3 is the value the
    // superseded D-24366 §5 fallback returned for this state.
    assert.notEqual(resolveSchemeLossProgress(gameState), 3);
  });

  it('AC-3: Legacy Virus measures the wound stack against its setup size', () => {
    const gameState = makeTestState({
      schemeId: 'core/legacy-virus-the',
      twistCount: 2,
      schemeLossPileSetupSize: 12,
      woundsRemaining: 9,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 3);
    assert.equal(resolveSchemeLossThreshold(gameState), 12);
    assert.equal(computeMenace(gameState), 0.25);
  });

  it('reads zero depletion at setup, when the pile is still full', () => {
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      schemeLossPileSetupSize: 42,
      heroDeckRemaining: 42,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 0);
    assert.equal(computeMenace(gameState), 0);
  });

  it('reads full depletion — and menace 1 — when the pile is empty', () => {
    // why: an empty pile IS the loss for these schemes, so the meter must be
    // pegged rather than one short of it.
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      schemeLossPileSetupSize: 42,
      heroDeckRemaining: 0,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 42);
    assert.equal(computeMenace(gameState), 1);
  });

  it('clamps at 0 when the pile grew above its setup size', () => {
    // why: cards can return to the hero deck, and a negative numerator would
    // render as the villains losing ground — a reading no rule supports.
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      schemeLossPileSetupSize: 42,
      heroDeckRemaining: 45,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 0);
  });

  it('measures the NAMED pile — a full wound stack does not mask a drained hero deck', () => {
    // why: both piles are populated here. Civil War names heroDeck, so the
    // untouched wound stack must not enter the reading at all.
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      schemeLossPileSetupSize: 42,
      heroDeckRemaining: 11,
      woundsRemaining: 30,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 31);
  });
});

describe('the absent-capture fallback (a pre-WP-562 recorded state)', () => {
  it('omits the threshold when no setup size was captured', () => {
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 3,
    });
    assert.equal(resolveSchemeLossThreshold(gameState), undefined);
  });

  it('falls back to the twist proxy for BOTH numerator and denominator', () => {
    // why: the fallback pair must stay coherent. Civil War at 3p proxies against
    // 8 twists, so 4 twists is half way — the pre-WP-562 reading, preserved for
    // states that predate the capture rather than reinvented.
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 3,
      twistCount: 4,
      heroDeckRemaining: 11,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 4);
    assert.equal(computeMenace(gameState), 0.5);
  });

  it('treats a zero setup size as absent rather than dividing by zero', () => {
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 3,
      twistCount: 4,
      schemeLossPileSetupSize: 0,
    });
    assert.equal(resolveSchemeLossKind(gameState), 'twists');
    assert.equal(computeMenace(gameState), 0.5);
  });
});

// ---------------------------------------------------------------------------
// Unchanged conditions — AC-4, AC-5 regression guard
// ---------------------------------------------------------------------------

describe('the conditions WP-562 did NOT change (AC-4 / AC-5 regression guard)', () => {
  it('AC-4: Negative Zone still counts escaped villains against 12', () => {
    const gameState = makeTestState({
      schemeId: 'core/negative-zone-prison-breakout',
      twistCount: 3,
      escapedPile: ['villain-a', 'villain-b', 'villain-c'],
      villainDeckCardTypes: {
        'villain-a': 'villain',
        'villain-b': 'villain',
        'villain-c': 'villain',
      },
    });
    assert.equal(resolveSchemeLossProgress(gameState), 3);
    assert.equal(resolveSchemeLossThreshold(gameState), 12);
    assert.equal(resolveSchemeLossKind(gameState), 'escaped-pile');
  });

  it('AC-5: Portals still counts twists against its printed 7', () => {
    const gameState = makeTestState({
      schemeId: 'core/portals-to-the-dark-dimension',
      twistCount: 3,
    });
    assert.equal(resolveSchemeLossProgress(gameState), 3);
    assert.equal(resolveSchemeLossThreshold(gameState), 7);
    assert.equal(resolveSchemeLossKind(gameState), 'twists');
  });

  it('Killbots still counts converted escapees against 5', () => {
    const gameState = makeTestState({
      schemeId: 'core/replace-earths-leaders-with-killbots',
      escapedPile: ['bot-a', 'bot-b'],
      villainDeckCardTypes: { 'bot-a': 'villain', 'bot-b': 'villain' },
      convertedVillainOrigins: { 'bot-a': 'killbot', 'bot-b': 'killbot' },
    });
    assert.equal(resolveSchemeLossProgress(gameState), 2);
    assert.equal(resolveSchemeLossThreshold(gameState), 5);
    assert.equal(resolveSchemeLossKind(gameState), 'escaped-converted');
  });
});

// ---------------------------------------------------------------------------
// SchemeLossKind (D-24371 §3)
// ---------------------------------------------------------------------------

describe('resolveSchemeLossKind — the enum the client labels from (D-24371 §3)', () => {
  it('distinguishes the two pile-depleted piles', () => {
    const civilWar = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      schemeLossPileSetupSize: 42,
      heroDeckRemaining: 42,
    });
    const legacyVirus = makeTestState({
      schemeId: 'core/legacy-virus-the',
      schemeLossPileSetupSize: 12,
      woundsRemaining: 12,
    });
    assert.equal(resolveSchemeLossKind(civilWar), 'hero-deck');
    assert.equal(resolveSchemeLossKind(legacyVirus), 'wound-stack');
  });

  it('reports what is MEASURED, not what the config declares', () => {
    // why: without a capture the derivation is counting twists, so the kind must
    // say 'twists'. If it reported 'hero-deck' here the client would print
    // "Heroes 4" over a twist count — a label lying about its own numbers.
    const gameState = makeTestState({ schemeId: 'core/super-hero-civil-war', twistCount: 4 });
    assert.equal(resolveSchemeLossKind(gameState), 'twists');
  });

  it('falls back to twists for an unconfigured scheme', () => {
    assert.equal(resolveSchemeLossKind(makeTestState({ schemeId: 'not-a-real-scheme' })), 'twists');
  });

  it('SCHEME_LOSS_KINDS matches the SchemeLossKind union exactly', () => {
    // why: canonical-array drift pin per .claude/rules/code-style.md.
    const everyKind = [
      'hero-deck',
      'wound-stack',
      'escaped-pile',
      'escaped-bystander',
      'escaped-converted',
      'twists',
    ] satisfies SchemeLossKind[];
    assert.deepStrictEqual([...SCHEME_LOSS_KINDS], everyKind);
  });

  it('splits the escaped-pile kind by counted card type (WP-612)', () => {
    // why: a bystander-counting escaped-pile scheme (Midtown Bank Robbery) must
    // resolve to 'escaped-bystander' so the client labels it "Bystanders", not
    // "Escaped"; a villain-counting one (Negative Zone) stays 'escaped-pile'.
    assert.equal(
      resolveSchemeLossKind(makeTestState({ schemeId: 'core/midtown-bank-robbery' })),
      'escaped-bystander',
    );
    assert.equal(
      resolveSchemeLossKind(
        makeTestState({ schemeId: 'core/negative-zone-prison-breakout' }),
      ),
      'escaped-pile',
    );
  });

  it('every configured scheme resolves to a member of the canonical array', () => {
    const schemeIds = [
      'core/midtown-bank-robbery',
      'core/legacy-virus-the',
      'core/negative-zone-prison-breakout',
      'core/unleash-the-power-of-the-cosmic-cube',
      'core/super-hero-civil-war',
      'core/replace-earths-leaders-with-killbots',
      'core/secret-invasion-of-the-skrull-shapeshifters',
      'core/portals-to-the-dark-dimension',
      'not-a-real-scheme',
    ];
    for (const schemeId of schemeIds) {
      const kind = resolveSchemeLossKind(
        makeTestState({ schemeId, schemeLossPileSetupSize: 10 }),
      );
      assert.equal(SCHEME_LOSS_KINDS.includes(kind), true, `${schemeId} produced ${kind}`);
    }
  });
});

// ---------------------------------------------------------------------------
// The lazy setup capture (D-24371 §2) — AC-8
// ---------------------------------------------------------------------------

describe('resolveSchemeLossPileSetupSize — the lazy capture (D-24371 §2) — AC-8', () => {
  it('returns the hero-deck size for Civil War', () => {
    assert.equal(resolveSchemeLossPileSetupSize('core/super-hero-civil-war', 42, 12), 42);
  });

  it('returns the wound-stack size for Legacy Virus', () => {
    assert.equal(resolveSchemeLossPileSetupSize('core/legacy-virus-the', 42, 12), 12);
  });

  it('AC-8: returns undefined for every scheme that is NOT pile-depleted', () => {
    // why: undefined is what makes the G field LAZY at the setup call site, and
    // laziness is what keeps PRE_WP080_HASH and every non-pile-depleted game's
    // hash unchanged. A scheme leaking into this list would re-pin oracles the
    // packet declares must not move.
    const notPileDepleted = [
      'core/midtown-bank-robbery',
      'core/negative-zone-prison-breakout',
      'core/unleash-the-power-of-the-cosmic-cube',
      'core/replace-earths-leaders-with-killbots',
      'core/secret-invasion-of-the-skrull-shapeshifters',
      'core/portals-to-the-dark-dimension',
      'not-a-real-scheme',
      '',
    ];
    for (const schemeId of notPileDepleted) {
      assert.equal(
        resolveSchemeLossPileSetupSize(schemeId, 42, 12),
        undefined,
        `${schemeId} unexpectedly captured a setup size`,
      );
    }
  });

  it('exactly two configured schemes capture a size', () => {
    // why: a census rather than a spot check — the lazy field's blast radius is
    // "which schemes re-pin", so the count is the thing worth pinning.
    const everyConfiguredScheme = [
      'core/midtown-bank-robbery',
      'core/legacy-virus-the',
      'core/negative-zone-prison-breakout',
      'core/unleash-the-power-of-the-cosmic-cube',
      'core/super-hero-civil-war',
      'core/replace-earths-leaders-with-killbots',
      'core/secret-invasion-of-the-skrull-shapeshifters',
      'core/portals-to-the-dark-dimension',
    ];
    const capturing = everyConfiguredScheme.filter(
      (schemeId) => resolveSchemeLossPileSetupSize(schemeId, 42, 12) !== undefined,
    );
    assert.deepStrictEqual(capturing, ['core/legacy-virus-the', 'core/super-hero-civil-war']);
  });
});

// ---------------------------------------------------------------------------
// Solo threshold gap (D-24371 §6) — AC-7
// ---------------------------------------------------------------------------

describe('the solo twist threshold (WP-562 / D-24371 §6) — AC-7', () => {
  it('AC-7: solo Civil War resolves to 8, not the MVP fallback 7', () => {
    // why: the '1' key was missing, so a 1-player game silently took
    // MVP_SCHEME_TWIST_THRESHOLD — the arbitrary unconfigured default — and
    // reported 3/7 in a real match. Solo mirrors 2-player.
    const solo = makeTestState({ schemeId: 'core/super-hero-civil-war', requiredPlayers: 1 });
    assert.equal(resolveTwistLossThreshold(solo), 8);
    assert.notEqual(resolveTwistLossThreshold(solo), MVP_SCHEME_TWIST_THRESHOLD);
  });

  it('the MVP fallback itself is untouched at 7', () => {
    // why: the fix is the missing key, NOT a change to the fallback, which stays
    // correct for a genuinely unconfigured scheme.
    assert.equal(MVP_SCHEME_TWIST_THRESHOLD, 7);
    assert.equal(resolveTwistLossThreshold(makeTestState({ schemeId: 'not-a-real-scheme' })), 7);
  });

  it('every seat count 1-5 resolves Civil War to a printed stack size', () => {
    const expectedBySeatCount = new Map([[1, 8], [2, 8], [3, 8], [4, 5], [5, 5]]);
    for (const [seatCount, expected] of expectedBySeatCount) {
      const gameState = makeTestState({
        schemeId: 'core/super-hero-civil-war',
        requiredPlayers: seatCount,
      });
      assert.equal(resolveTwistLossThreshold(gameState), expected, `at ${seatCount} players`);
    }
  });
});

// ---------------------------------------------------------------------------
// Tier bands — AC-5
// ---------------------------------------------------------------------------

describe('menaceTierFor — locked band boundaries (D-24366 §3)', () => {
  it('maps each locked boundary to its tier', () => {
    // why: half-open on the lower bound — 0.34 is rising, 0.67 is critical.
    // These exact numbers are the shared contract both future consumers
    // inherit, so each boundary is pinned on both sides.
    assert.equal(menaceTierFor(0), 'calm');
    assert.equal(menaceTierFor(0.33), 'calm');
    assert.equal(menaceTierFor(0.34), 'rising');
    assert.equal(menaceTierFor(0.66), 'rising');
    assert.equal(menaceTierFor(0.67), 'critical');
    assert.equal(menaceTierFor(1), 'critical');
  });

  it('MENACE_TIERS matches the MenaceTier union exactly and in ascending order', () => {
    // why: canonical-array drift pin per .claude/rules/code-style.md — the
    // `satisfies` check fails at compile time if the union gains a member the
    // array lacks; the deepStrictEqual pins order and membership at runtime.
    const everyTier = ['calm', 'rising', 'critical'] satisfies MenaceTier[];
    assert.deepStrictEqual([...MENACE_TIERS], everyTier);
  });

  it('every MENACE_TIERS entry is reachable from some menace value', () => {
    // why: a tier in the array that no scalar can produce would be a dead
    // contract member — the band table and the array must stay in sync.
    const produced = new Set<MenaceTier>();
    for (let step = 0; step <= 100; step = step + 1) {
      produced.add(menaceTierFor(step / 100));
    }
    assert.deepStrictEqual([...produced].sort(), [...MENACE_TIERS].sort());
  });
});
