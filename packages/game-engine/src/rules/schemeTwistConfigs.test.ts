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
    // why: WP-562 / D-24371 §6 — the '1' key. Solo mirrors 2-player; without it a
    // 1-player game fell through to MVP_SCHEME_TWIST_THRESHOLD (7) and reported a
    // 3/7 meter in a live match. Pinned here so the key cannot be dropped again
    // silently — its absence produced a plausible-looking wrong number, not an error.
    assert.deepEqual(
      SCHEME_TWIST_CONFIGS.get('core/super-hero-civil-war')?.lossThresholdByPlayerCount,
      { '1': 8, '2': 8, '3': 8, '4': 5, '5': 5 },
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

  // why: WP-540 / D-24349 — Super Hero Civil War KOs ALL the Heroes in the HQ
  // (koAll), and Unleash the Cosmic Cube deals the printed escalation (1 Wound on
  // twists 5-6, 3 on twist 7). Both fixes are param-only on the existing resolvers;
  // both LOSS configs (Civil War hero-deck-empty; Cosmic Cube twist-8) are unchanged.
  it('drift test E: Civil War uses koAll and Cosmic Cube uses the escalation schedule (WP-540)', () => {
    const civilWar = SCHEME_TWIST_CONFIGS.get('core/super-hero-civil-war');
    assert.equal(civilWar?.resolverId, 'ko-from-hq');
    assert.deepEqual(civilWar?.params, { koAll: true });
    // loss config unchanged (WP-510 hero-deck-empty, per-seat stack sizing)
    assert.deepEqual(civilWar?.lossThresholdByPlayerCount, { '1': 8, '2': 8, '3': 8, '4': 5, '5': 5 });
    assert.deepEqual(civilWar?.resourceLossCondition, { kind: 'pile-depleted', pile: 'heroDeck' });

    const cosmicCube = SCHEME_TWIST_CONFIGS.get('core/unleash-the-power-of-the-cosmic-cube');
    assert.equal(cosmicCube?.resolverId, 'wound-all');
    assert.deepEqual(cosmicCube?.params, {
      escalation: [
        { atOrAfterTwist: 5, woundCount: 1 },
        { atOrAfterTwist: 7, woundCount: 3 },
      ],
    });
    // loss config unchanged (true twist-loss at 8, no resource condition)
    assert.equal(cosmicCube?.lossThreshold, 8);
    assert.equal(cosmicCube?.resourceLossCondition, undefined);
  });
});

// ---------------------------------------------------------------------------
// WP-763 / D-24595 — the §Audit configuration, verbatim
// ---------------------------------------------------------------------------

// why: the WP-763 §Audit tables ARE the configuration. Re-stated here as data so a
// dropped, duplicated or mis-bucketed entry fails loudly rather than silently
// falling back to the approximate last-twist rule.
const AUDIT_PRINTED_THRESHOLDS: Record<number, readonly string[]> = {
  6: [
    'anni/sneak-attack-the-heroes-homes',
    'ca75/unbreakable-enigma-code-the',
    'vnom/paralyzing-venom',
    'xmen/horror-of-horrors',
  ],
  7: [
    '2099/pull-reality-into-cyberspace',
    'bkwd/corrupt-the-spy-agencies',
    'co2e/portals-to-the-dark-dimension',
    'ff04/invincible-force-field',
    'ff04/pull-reality-into-the-negative-zone',
    'msp1/invade-asgard',
    'pttr/weave-a-web-of-lies',
    'ssw1/dark-alliance',
    'wwhk/mutating-gamma-rays',
  ],
  8: [
    'co2e/unleash-the-power-of-the-cosmic-cube',
    'msp1/unleash-the-power-of-the-cosmic-cube',
    'cvwr/avengers-vs-x-men',
    'mgtg/inescapable-kyln-space-prison',
    'rvlt/korvac-saga-the',
    'ssw2/god-emperor-of-battleworld-the',
    'ssw2/secret-wars',
    'wpnx/condition-logan-into-weapon-x',
  ],
  9: ['anni/pulse-waves-from-the-negative-zone', 'wwhk/world-war-hulk'],
  10: ['msis/the-time-heist', 'rlmk/tornado-of-terrigen-mists', 'shld/hail-hydra'],
  11: ['vnom/symbiotic-absorption'],
};

const AUDIT_PURE_PILES: ReadonlyArray<[readonly string[], readonly string[]]> = [
  [
    ['heroDeck'],
    [
      'ca75/go-back-in-time-to-slay-heroes-ancestors',
      'co2e/super-hero-civil-war',
      'cvwr/epic-super-hero-civil-war',
      'dead/deadpool-kills-the-marvel-universe',
      'msp1/super-hero-civil-war',
      'wpnx/go-after-heroes-loved-ones',
    ],
  ],
  [
    ['wounds'],
    [
      'msp1/radioactive-palladium-poisoning',
      'ssw1/pan-dimensional-plague',
      'wwhk/fall-of-the-hulks',
    ],
  ],
  [
    ['wounds', 'villainDeck'],
    [
      'bkpt/poison-lakes-with-nanite-microbots',
      'co2e/the-legacy-virus',
      'xmen/anti-mutant-hatred',
      'xmen/televised-deathtraps-of-mojoworld',
    ],
  ],
  [['heroDeck', 'villainDeck'], ['mdns/midnight-massacre', 'msis/halve-all-life-in-the-universe']],
];

const AUDIT_COMPOUND_PILES: ReadonlyArray<[readonly string[], readonly string[]]> = [
  [
    ['villainDeck'],
    [
      'antm/trap-heroes-in-the-microverse',
      'bkwd/train-black-widows-in-the-red-room',
      'co2e/negative-zone-prison-outbreak',
      'dstr/war-for-the-dream-dimension',
      'rlmk/devolve-with-xerogen-crystals',
      'rvlt/earthquake-drains-the-ocean',
      'smhc/scavenge-alien-weaponry',
      'wtif/marvel-zombies',
      'wwhk/gladiator-pits-of-sakaar',
      'pttr/clone-saga-the',
      'pttr/splice-humans-with-spider-dna',
      'vnom/invasion-of-the-venom-symbiotes',
      'bkpt/plunder-wakandas-vibranium',
      'co2e/bank-robbery-hostage-crisis',
      'co2e/enshrouded-identity',
      'cosm/annihilation-conquest',
      'dstr/cursed-pages-of-the-darkhold-tome',
      'mdns/sire-vampires-at-the-blood-bank',
      'msmc/control-the-mutant-messiah',
      'msmc/open-rifts-to-future-timelines',
    ],
  ],
  [
    ['villainDeck', 'heroDeck'],
    ['msmc/reveal-the-heroes-evil-clones', 'msmc/unleash-an-anti-mutant-bioweapon'],
  ],
  [['heroDeck'], ['2099/befoul-earth-into-a-polluted-wasteland', 'dkcy/detonate-the-helicarrier']],
  [['wounds'], ['vnom/maximum-carnage']],
];

/**
 * Lists a config's depletion piles, whichever form it declares.
 *
 * @param schemeId - The scheme to read.
 * @returns The named piles, or an empty list when not pile-depleted.
 */
function configPiles(schemeId: string): readonly string[] {
  const condition = SCHEME_TWIST_CONFIGS.get(schemeId)?.resourceLossCondition;
  if (condition?.kind !== 'pile-depleted') {
    return [];
  }
  if (condition.piles !== undefined) {
    return condition.piles;
  }
  return [condition.pile];
}

describe('WP-763 §Audit configuration (D-24595)', () => {
  it('A: 27 printed twist-count schemes carry exactly their printed N', () => {
    let entryCount = 0;
    for (const [threshold, schemeIds] of Object.entries(AUDIT_PRINTED_THRESHOLDS)) {
      for (const schemeId of schemeIds) {
        const config = SCHEME_TWIST_CONFIGS.get(schemeId);
        assert.equal(config?.lossThreshold, Number(threshold), schemeId);
        assert.equal(config?.resolverId, 'counter-only', schemeId);
        assert.equal(config?.resourceLossCondition, undefined, schemeId);
        assert.equal(config?.twistFallbackWithResourceLoss, undefined, schemeId);
        entryCount = entryCount + 1;
      }
    }
    assert.equal(entryCount, 27);
  });

  it('D-pure: 15 pile-runout schemes declare their piles and suppress the twist proxy', () => {
    let entryCount = 0;
    for (const [piles, schemeIds] of AUDIT_PURE_PILES) {
      for (const schemeId of schemeIds) {
        const config = SCHEME_TWIST_CONFIGS.get(schemeId);
        assert.deepEqual(configPiles(schemeId), piles, schemeId);
        assert.equal(config?.resolverId, 'counter-only', schemeId);
        assert.equal(config?.lossThreshold, undefined, schemeId);
        assert.equal(config?.twistFallbackWithResourceLoss, undefined, schemeId);
        entryCount = entryCount + 1;
      }
    }
    assert.equal(entryCount, 15);
  });

  it('D-compound: 25 schemes declare their piles AND keep the twist fallback', () => {
    let entryCount = 0;
    for (const [piles, schemeIds] of AUDIT_COMPOUND_PILES) {
      for (const schemeId of schemeIds) {
        const config = SCHEME_TWIST_CONFIGS.get(schemeId);
        assert.deepEqual(configPiles(schemeId), piles, schemeId);
        assert.equal(config?.resolverId, 'counter-only', schemeId);
        assert.equal(config?.lossThreshold, undefined, schemeId);
        assert.equal(config?.twistFallbackWithResourceLoss, true, schemeId);
        entryCount = entryCount + 1;
      }
    }
    assert.equal(entryCount, 25);
  });

  it('the registry holds exactly the 8 core entries plus the 67 audit entries', () => {
    assert.equal(SCHEME_TWIST_CONFIGS.size, 8 + 67);
    let coreCount = 0;
    for (const schemeId of SCHEME_TWIST_CONFIGS.keys()) {
      if (schemeId.startsWith('core/')) {
        coreCount = coreCount + 1;
      }
    }
    assert.equal(coreCount, 8);
  });

  it('no pile-depleted entry names both the hero deck and the wound stack', () => {
    // why: G.schemeLossPileSetupSize holds ONE size for the hero-deck / wound
    // pile; a scheme naming both would measure one of them against the other's
    // setup size. None does today — this pin makes adding one a loud decision.
    for (const schemeId of SCHEME_TWIST_CONFIGS.keys()) {
      const piles = configPiles(schemeId);
      assert.equal(
        piles.includes('heroDeck') && piles.includes('wounds'),
        false,
        schemeId,
      );
    }
  });

  it('the Excluded schemes stay unconfigured (they use the last-twist fallback)', () => {
    const excluded = [
      'chmp/clash-of-the-monsters-unleashed',
      'chmp/divide-and-conquer',
      'noir/five-families-of-crime',
      'rvlt/secret-hydra-corruption',
      'wwhk/shoot-hulk-into-space',
      'gotg/unite-the-shards',
    ];
    for (const schemeId of excluded) {
      assert.equal(SCHEME_TWIST_CONFIGS.has(schemeId), false, schemeId);
    }
  });
});
