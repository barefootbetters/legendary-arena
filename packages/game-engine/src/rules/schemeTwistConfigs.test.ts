/**
 * Drift tests for scheme twist config registry (WP-182 / EC-209).
 *
 * A: Every config's resolverId exists in SCHEME_TWIST_RESOLVERS.
 * B: Every config map key equals its config.schemeId.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEME_TWIST_CONFIGS } from './schemeTwistConfigs.js';
import { SCHEME_TWIST_RESOLVERS } from './schemeTwistResolvers.js';

describe('SCHEME_TWIST_CONFIGS drift tests', () => {
  it('drift test A: every resolverId in configs exists in the resolver registry', () => {
    for (const [mapKey, config] of SCHEME_TWIST_CONFIGS) {
      assert.ok(
        SCHEME_TWIST_RESOLVERS[config.resolverId] !== undefined,
        `Config "${mapKey}" references resolverId "${config.resolverId}" which does not exist in SCHEME_TWIST_RESOLVERS.`,
      );
    }
  });

  it('drift test B: every config map key equals its config.schemeId', () => {
    for (const [mapKey, config] of SCHEME_TWIST_CONFIGS) {
      assert.equal(
        mapKey,
        config.schemeId,
        `Map key "${mapKey}" does not match config.schemeId "${config.schemeId}".`,
      );
    }
  });

  it('config registry is non-empty', () => {
    assert.ok(SCHEME_TWIST_CONFIGS.size > 0, 'SCHEME_TWIST_CONFIGS must have at least one entry');
  });

  // why: D-24178 — pin each configured scheme's loss threshold to its PRINTED
  // twist-stack size so no scheme resolves a twist early. Cosmic Cube (a true
  // twist-loss scheme, "Twist 8: Evil Wins!") was losing at the fallback 7 — the
  // reported bug. The resource-loss schemes (8-twist stacks) use the threshold as
  // a doom-clock proxy. Super Hero Civil War's stack varies by seat count.
  it('drift test C: configured schemes carry their printed twist-stack loss threshold (D-24178)', () => {
    assert.equal(SCHEME_TWIST_CONFIGS.get('core/unleash-the-power-of-the-cosmic-cube')?.lossThreshold, 8);
    assert.equal(SCHEME_TWIST_CONFIGS.get('core/midtown-bank-robbery')?.lossThreshold, 8);
    assert.equal(SCHEME_TWIST_CONFIGS.get('core/legacy-virus-the')?.lossThreshold, 8);
    assert.equal(SCHEME_TWIST_CONFIGS.get('core/negative-zone-prison-breakout')?.lossThreshold, 8);
    assert.deepEqual(
      SCHEME_TWIST_CONFIGS.get('core/super-hero-civil-war')?.lossThresholdByPlayerCount,
      { '2': 8, '3': 8, '4': 5, '5': 5 },
    );
  });

  // why: WP-539 / D-24348 — Portals to the Dark Dimension is a TRUE twist-loss
  // (printed "Twist 7: Evil Wins!"): lossThreshold 7 with NO resourceLossCondition,
  // so Evil Wins at exactly twist 7 by design (previously it lost at 7 only by the
  // MVP-fallback coincidence). Routed to the `portals` resolver.
  it('drift test D: Portals is a true twist-loss at 7 via the portals resolver (D-24348)', () => {
    const portals = SCHEME_TWIST_CONFIGS.get('core/portals-to-the-dark-dimension');
    assert.equal(portals?.resolverId, 'portals');
    assert.equal(portals?.lossThreshold, 7);
    assert.equal(portals?.resourceLossCondition, undefined);
  });
});
