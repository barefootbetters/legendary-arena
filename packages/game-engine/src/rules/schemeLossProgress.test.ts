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
  computeMenace,
  isTwistLossSuppressed,
  menaceTierFor,
  resolveSchemeLossProgress,
  resolveSchemeLossThreshold,
  resolveTwistLossThreshold,
} from './schemeLossProgress.js';
import type { MenaceTier } from './schemeLossProgress.js';
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
    piles: { bystanders: [], wounds: [], officers: [], sidekicks: [] },
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
    heroDeck: [],
  } as unknown as LegendaryGameState;

  if (options.convertedVillainOrigins !== undefined) {
    (state as { convertedVillainOrigins?: Record<string, string> })
      .convertedVillainOrigins = options.convertedVillainOrigins;
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

describe('pile-depleted schemes have no denominator (D-24366 §5) — AC-9', () => {
  it('omits the threshold for Super Hero Civil War', () => {
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 3,
    });
    assert.equal(resolveSchemeLossThreshold(gameState), undefined);
  });

  it('omits the threshold for Legacy Virus', () => {
    const gameState = makeTestState({ schemeId: 'core/legacy-virus-the' });
    assert.equal(resolveSchemeLossThreshold(gameState), undefined);
  });

  it('still produces a finite menace from the twist proxy', () => {
    // why: Civil War at 3p proxies against 8 twists; 4 twists is half way.
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 3,
      twistCount: 4,
    });
    assert.equal(computeMenace(gameState), 0.5);
  });

  it('proxies against the player-count threshold, not a fixed one', () => {
    // why: at 4p the Civil War stack is 5, so 4 twists is 0.8 — not 0.5.
    const gameState = makeTestState({
      schemeId: 'core/super-hero-civil-war',
      requiredPlayers: 4,
      twistCount: 4,
    });
    assert.equal(computeMenace(gameState), 0.8);
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
