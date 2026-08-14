/**
 * Type contract tests for the villain ability hook subsystem.
 *
 * Verifies drift-detection for VILLAIN_ABILITY_TIMINGS and
 * VILLAIN_EFFECT_KEYWORDS against their unions, getVillainHooksForCard
 * query behavior, and JSON-serializability of VillainAbilityHook.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VILLAIN_ABILITY_TIMINGS,
  VILLAIN_EFFECT_KEYWORDS,
  VILLAIN_EFFECT_PRIMITIVES,
  VILLAIN_DEFEAT_REQUIREMENT_KINDS,
  LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR,
  descriptorToLegacyKeyword,
  getVillainHooksForCard,
} from './villainAbility.types.js';
import type {
  VillainAbilityHook,
  VillainAbilityTiming,
  VillainEffectKeyword,
  VillainEffectResult,
  VillainEffectPrimitive,
  VillainEffectDescriptor,
  VillainDefeatRequirementKind,
} from './villainAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';

describe('VILLAIN_ABILITY_TIMINGS drift-detection', () => {
  // why: failure means union/array mismatch — a timing added to the union but
  // not the array (or vice versa) would silently break hook dispatch for the
  // missing timing. Same pattern as HERO_ABILITY_TIMINGS / REVEALED_CARD_TYPES.
  // WP-186 added 'onEscape' as the third entry (D-18601); the array length is
  // now 3 and the canonical order is locked.
  it('contains exactly the 3 canonical timing values in order', () => {
    const expectedTimings: VillainAbilityTiming[] = [
      'onAmbush',
      'onFight',
      'onEscape',
    ];

    assert.equal(
      VILLAIN_ABILITY_TIMINGS.length,
      3,
      'VILLAIN_ABILITY_TIMINGS must have exactly 3 entries',
    );

    assert.deepStrictEqual(
      [...VILLAIN_ABILITY_TIMINGS],
      expectedTimings,
      'VILLAIN_ABILITY_TIMINGS must match the canonical timing values in order',
    );

    const uniqueTimings = new Set(VILLAIN_ABILITY_TIMINGS);
    assert.equal(
      uniqueTimings.size,
      VILLAIN_ABILITY_TIMINGS.length,
      'VILLAIN_ABILITY_TIMINGS must have no duplicates',
    );
  });

  // why: `Overrun:` is a v1 synonym of `Escape:` and emits `onEscape` at
  // parse time (D-18602). `'onOverrun'` must never appear in the timing
  // union or canonical array — distinct overrun semantics are deferred to a
  // future scheme-text WP. This guard prevents accidental reintroduction.
  it("does not contain 'onOverrun' (D-18602 synonym lock)", () => {
    assert.equal(
      VILLAIN_ABILITY_TIMINGS.includes('onOverrun' as VillainAbilityTiming),
      false,
      "VILLAIN_ABILITY_TIMINGS must not include 'onOverrun' — Overrun: emits onEscape (D-18602)",
    );
  });
});

describe('VILLAIN_EFFECT_KEYWORDS drift-detection', () => {
  // why: failure means the locked vocabulary drifted from the union. WP-189
  // appended 'koHeroEachPlayer' at position 6 (D-18901; the incremental-
  // expansion governance clause). WP-202 appended 'koHeroEachPlayerMag2'
  // at position 7 (D-20201; closed-union-per-magnitude). WP-214 appended
  // captureHqHero* at positions 8-10 (D-21401). Positions 1-5 stay
  // byte-identical to the WP-185 array — WP-187's executed markers +
  // the apply-effect-markers.mjs local copy depend on the first-five
  // ordering. Any further addition requires a new WP + DECISIONS.md entry.
  it('contains exactly the 10 canonical effect keyword values in order', () => {
    const expectedKeywords: VillainEffectKeyword[] = [
      'gainWoundEachPlayer',
      'gainWoundCurrentPlayer',
      'koHeroCurrentPlayer',
      'heroDeckTopToEscape',
      'captureBystander',
      'koHeroEachPlayer',
      'koHeroEachPlayerMag2',
      'captureHqHeroRightmost',
      'captureHqHeroHighestCost',
      'captureHqHeroLowestCost',
    ];

    assert.equal(
      VILLAIN_EFFECT_KEYWORDS.length,
      10,
      'VILLAIN_EFFECT_KEYWORDS must have exactly 10 entries',
    );

    assert.deepStrictEqual(
      [...VILLAIN_EFFECT_KEYWORDS],
      expectedKeywords,
      'VILLAIN_EFFECT_KEYWORDS must match the canonical keyword values in order',
    );

    const uniqueKeywords = new Set(VILLAIN_EFFECT_KEYWORDS);
    assert.equal(
      uniqueKeywords.size,
      VILLAIN_EFFECT_KEYWORDS.length,
      'VILLAIN_EFFECT_KEYWORDS must have no duplicates',
    );
  });

  // why: WP-189 appended at position 6; WP-202 appended at position 7;
  // WP-214 appended at positions 8, 9, 10.
  // WP-187's executed markers + the overlay script's local copy are keyed
  // on positions 0-5 being byte-identical to the post-WP-189 array; an
  // insertion mid-array would silently break them. This guard pins
  // positions 0-5 byte-identical and asserts position 6 is the WP-202
  // append slot.
  it('preserves the post-WP-189 first-six entries at positions 0-5 (append-only invariant)', () => {
    const firstSix: VillainEffectKeyword[] = [
      'gainWoundEachPlayer',
      'gainWoundCurrentPlayer',
      'koHeroCurrentPlayer',
      'heroDeckTopToEscape',
      'captureBystander',
      'koHeroEachPlayer',
    ];
    assert.deepStrictEqual(
      VILLAIN_EFFECT_KEYWORDS.slice(0, 6),
      firstSix,
      'VILLAIN_EFFECT_KEYWORDS positions 0-5 must be byte-identical to the post-WP-189 array (WP-187/WP-190 marker compatibility)',
    );
    assert.equal(
      VILLAIN_EFFECT_KEYWORDS[6],
      'koHeroEachPlayerMag2',
      "'koHeroEachPlayerMag2' must be at position 6 (the appended slot for WP-202)",
    );
  });
});

describe('VILLAIN_DEFEAT_REQUIREMENT_KINDS drift-detection', () => {
  // why: WP-292 / D-24076 — a canonical readonly array must match its union
  // exactly (code-style §Drift Detection). A kind added to the union but not
  // the array (or vice versa) would silently break defeat-requirement parsing /
  // gating. The two kinds map from the marker tokens `team` / `hc`.
  it('contains exactly the 2 canonical kinds in order', () => {
    const expectedKinds: VillainDefeatRequirementKind[] = ['team', 'hero-class'];

    assert.equal(
      VILLAIN_DEFEAT_REQUIREMENT_KINDS.length,
      2,
      'VILLAIN_DEFEAT_REQUIREMENT_KINDS must have exactly 2 entries',
    );

    assert.deepStrictEqual(
      [...VILLAIN_DEFEAT_REQUIREMENT_KINDS],
      expectedKinds,
      'VILLAIN_DEFEAT_REQUIREMENT_KINDS must match the canonical kinds in order',
    );

    const uniqueKinds = new Set(VILLAIN_DEFEAT_REQUIREMENT_KINDS);
    assert.equal(
      uniqueKinds.size,
      VILLAIN_DEFEAT_REQUIREMENT_KINDS.length,
      'VILLAIN_DEFEAT_REQUIREMENT_KINDS must have no duplicates',
    );
  });

  // why: negative assertion — a phantom kind absent from the union must not be
  // a member, so the drift guard cannot pass vacuously.
  it('does not contain a phantom kind', () => {
    assert.equal(
      VILLAIN_DEFEAT_REQUIREMENT_KINDS.includes(
        'color' as VillainDefeatRequirementKind,
      ),
      false,
      "VILLAIN_DEFEAT_REQUIREMENT_KINDS must not include a phantom kind like 'color'",
    );
  });
});

describe('getVillainHooksForCard', () => {
  const hooks: VillainAbilityHook[] = [
    {
      cardId: 'core-villain-skrulls-super-skrull' as CardExtId,
      timing: 'onAmbush',
      keywords: ['captureBystander'],
      effects: [{ primitive: 'capture-bystander' }],
    },
    {
      cardId: 'core-villain-skrulls-super-skrull' as CardExtId,
      timing: 'onFight',
      keywords: ['koHeroCurrentPlayer'],
      effects: [{ primitive: 'ko-hero', target: 'current' }],
    },
    {
      cardId: 'henchman-doombot-legion-00' as CardExtId,
      timing: 'onFight',
      keywords: [],
      effects: [],
    },
  ];

  it('returns only hooks matching both cardId and timing', () => {
    const matched = getVillainHooksForCard(
      hooks,
      'core-villain-skrulls-super-skrull' as CardExtId,
      'onFight',
    );
    assert.equal(matched.length, 1, 'exactly one onFight hook for that card');
    assert.deepStrictEqual(matched[0]!.keywords, ['koHeroCurrentPlayer']);
    assert.deepStrictEqual(matched[0]!.effects, [
      { primitive: 'ko-hero', target: 'current' },
    ]);
  });

  it('returns an empty array when cardId is absent', () => {
    const matched = getVillainHooksForCard(
      hooks,
      'core-villain-unknown-nobody' as CardExtId,
      'onFight',
    );
    assert.deepStrictEqual(matched, []);
  });

  it('returns an empty array when the timing does not match', () => {
    const matched = getVillainHooksForCard(
      hooks,
      'henchman-doombot-legion-00' as CardExtId,
      'onAmbush',
    );
    assert.deepStrictEqual(matched, []);
  });

  it('does not return the input array reference (fresh result)', () => {
    const matched = getVillainHooksForCard(
      hooks,
      'core-villain-skrulls-super-skrull' as CardExtId,
      'onAmbush',
    );
    assert.notEqual(matched, hooks, 'result must be a fresh array');
    assert.equal(matched.length, 1);
  });
});

describe('VillainAbilityHook serialization', () => {
  it('JSON round-trips a sample hook', () => {
    const sample: VillainAbilityHook = {
      cardId: 'core-villain-hood-the-hood' as CardExtId,
      timing: 'onAmbush',
      keywords: ['captureBystander'],
      effects: [{ primitive: 'capture-bystander' }],
    };

    const serialized = JSON.stringify(sample);
    assert.ok(serialized.length > 2, 'serialized output must contain data');

    const deserialized = JSON.parse(serialized) as VillainAbilityHook;
    assert.deepStrictEqual(deserialized, sample, 'hook must survive JSON round-trip');
  });
});

describe('VillainEffectResult contract (WP-316 / D-24102)', () => {
  it('JSON round-trips a result carrying targets', () => {
    const sample: VillainEffectResult = {
      keyword: 'captureHqHeroRightmost',
      targets: ['core-hero-ironman' as CardExtId],
    };
    const deserialized = JSON.parse(JSON.stringify(sample)) as VillainEffectResult;
    assert.deepStrictEqual(deserialized, sample, 'result must survive JSON round-trip');
  });

  it('omits pending when the effect was not a parked interactive KO', () => {
    const sample: VillainEffectResult = {
      keyword: 'gainWoundEachPlayer',
      targets: [],
    };
    assert.equal('pending' in sample, false, 'pending is absent for non-parked effects');
  });

  it('results.map((result) => result.keyword) narrows to the WP-200 keyword surface', () => {
    // why: WP-316 byte-identity — the fire sites project results→keywords for the
    // fightResolved/ambushResolved appliedEffects field, which MUST stay
    // VillainEffectKeyword[]. This pins the projection type + order.
    const results: VillainEffectResult[] = [
      { keyword: 'koHeroCurrentPlayer', targets: [], pending: true },
      { keyword: 'captureBystander', targets: [] },
    ];
    const keywords: VillainEffectKeyword[] = results.map((result) => result.keyword);
    assert.deepStrictEqual(keywords, ['koHeroCurrentPlayer', 'captureBystander']);
  });
});

describe('VILLAIN_EFFECT_PRIMITIVES drift-detection', () => {
  // why: VILLAIN_EFFECT_PRIMITIVES is the canonical readonly array for the
  // parameterized vocabulary (WP-252 / D-24023). Per code-style §Drift
  // Detection a canonical array must assert it matches its union exactly —
  // adding a primitive to the union but not the array (or vice versa) would
  // silently break dispatch. The 5 primitives collapse the 10 frozen keywords;
  // WP-447 (D-24267) appended a sixth, `scry-ko-own-deck`, at position 6;
  // WP-450 (D-24270) appended a seventh, `gain-attached-hero`, at position 7;
  // WP-469 (D-24281) appended an eighth, `reveal-or-wound`, at position 8;
  // WP-481 (D-24287) appended a ninth, `become-scheme-twist`, at position 9;
  // WP-485 (D-24290) appended a tenth/eleventh/twelfth — `draw-cards-current`,
  // `ko-heroes-current-by-trait`, `rescue-bystanders-current-by-trait-count` — at
  // positions 10, 11, 12 (Tier-A auto-resolve Core villain effects); WP-494
  // (D-24299) appended a thirteenth, `gain-wound-unless-victory-villain-group`, at
  // position 13 (Viper — conditional each-player wound on a Victory-Pile group predicate);
  // WP-503 (D-24307) appended a fourteenth, `override-next-hand-size`, at position 14
  // (the core spider-foes Doctor Octopus villain Fight — draw 8 next hand, writes the
  // WP-497 `handSizeOverrides` field). WP-516 (D-24329) appended a fifteenth,
  // `ko-wounds-current-hand-and-discard`, at position 15 (Ymir, Frost Giant King
  // Fight — the current player KOs every Wound from their hand + discard). WP-519
  // (D-24332) appended a sixteenth, `ko-cullable-each-deck-top`, at position 16
  // (Melter, Masters of Evil Fight — each player reveals their deck top, KO the
  // cullable ones (Wound / basic S.H.I.E.L.D. starter), keep real Heroes). WP-521
  // (D-24334) appended a seventeenth, `capture-bystanders-plus-per-hq-hero-by-trait`,
  // at position 17 (co2e Baron Zemo Ambush — capture 1 Bystander + 1 per HQ Hero
  // matching a trait predicate).
  // why: WP-522 (D-24335) appended an eighteenth, `give-hq-hero-by-trait-to-current`,
  // at position 18 (co2e Ultron Fight — remove the highest-cost HQ Hero matching a
  // trait and give it to the current player's discard).
  // why: WP-523 (D-24336) appended a nineteenth, `swap-two-city-villains`, at position 19
  // (co2e Whirlwind Ambush — swap the lowest- and highest-index villain-occupied City
  // spaces; the first City board-position manipulation). WP-532 (D-24343) appended a
  // twentieth, `give-hq-hero-each-player`, at position 20 (Paibok — each player gains an HQ
  // Hero). WP-541 (D-24350) appended a twenty-first + twenty-second,
  // `gain-recruit-current` + `gain-officer-current`, at positions 21 + 22 (Hand Ninjas +1
  // recruit + HYDRA Kidnappers gain a S.H.I.E.L.D. Officer — the first Core villain/henchman
  // Fight-reward slice). WP-543 (D-24352) appended a twenty-third, `add-next-hand-size`, at
  // position 23 (the ADDITIVE next-hand primitive for Savage Land Mutates "draw an extra card"
  // — stacks per defeat, unlike the absolute `override-next-hand-size`).
  it('contains exactly the 23 canonical primitives in order', () => {
    const expectedPrimitives: VillainEffectPrimitive[] = [
      'ko-hero',
      'gain-wound',
      'capture-hq-hero',
      'hero-deck-top-to-escape',
      'capture-bystander',
      'scry-ko-own-deck',
      'gain-attached-hero',
      'reveal-or-wound',
      'become-scheme-twist',
      'draw-cards-current',
      'ko-heroes-current-by-trait',
      'rescue-bystanders-current-by-trait-count',
      'gain-wound-unless-victory-villain-group',
      'override-next-hand-size',
      'ko-wounds-current-hand-and-discard',
      'ko-cullable-each-deck-top',
      'capture-bystanders-plus-per-hq-hero-by-trait',
      'give-hq-hero-by-trait-to-current',
      'swap-two-city-villains',
      'give-hq-hero-each-player',
      'gain-recruit-current',
      'gain-officer-current',
      'add-next-hand-size',
    ];
    assert.equal(
      VILLAIN_EFFECT_PRIMITIVES.length,
      23,
      'VILLAIN_EFFECT_PRIMITIVES must have exactly 23 entries',
    );
    assert.deepStrictEqual(
      [...VILLAIN_EFFECT_PRIMITIVES],
      expectedPrimitives,
      'VILLAIN_EFFECT_PRIMITIVES must match the canonical primitives in order',
    );
    const uniquePrimitives = new Set(VILLAIN_EFFECT_PRIMITIVES);
    assert.equal(
      uniquePrimitives.size,
      VILLAIN_EFFECT_PRIMITIVES.length,
      'VILLAIN_EFFECT_PRIMITIVES must have no duplicates',
    );
  });
});

describe('legacy-keyword ↔ descriptor translation (WP-252 / D-24023)', () => {
  // why: the parser translates every legacy [effect:<keyword>] marker through
  // LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR, and the executor reverse-maps each
  // dispatched descriptor back to a keyword for the applied-effects
  // accumulator. The table must be total (every keyword) with valid primitives;
  // the reverse-map must round-trip (so notableEvents / EFFECT_KEYWORD_LABELS /
  // the replay hash stay keyword-identical) and be injective (10 distinct
  // descriptors — no two keywords collapse to one descriptor).
  it('maps every legacy keyword to a descriptor with a valid primitive', () => {
    const primitiveSet = new Set<string>(VILLAIN_EFFECT_PRIMITIVES);
    for (const keyword of VILLAIN_EFFECT_KEYWORDS) {
      const descriptor = LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[keyword];
      assert.ok(descriptor, `LEGACY table must have an entry for "${keyword}"`);
      assert.ok(
        primitiveSet.has(descriptor.primitive),
        `descriptor for "${keyword}" must use a canonical primitive`,
      );
    }
  });

  it('reverse-maps every legacy descriptor back to its keyword (round-trip, all 10)', () => {
    for (const keyword of VILLAIN_EFFECT_KEYWORDS) {
      const descriptor = LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[keyword];
      assert.equal(
        descriptorToLegacyKeyword(descriptor),
        keyword,
        `descriptorToLegacyKeyword must round-trip "${keyword}"`,
      );
    }
  });

  it('a zone-bearing ko-hero:each descriptor reverse-maps to koHeroEachPlayerMag2 (D-24280)', () => {
    // why: WP-463 — the load-bearing narration decision. `descriptorKey` must NOT
    // include `zone`, so a zone-restricted each-player KO shares a key with the
    // zone-less koHeroEachPlayerMag2 descriptor and reverse-maps to that keyword,
    // narrating per-target for free. If a future change adds `zone` to the key this
    // returns undefined and the KO goes silent — this test fails at the unit boundary.
    assert.equal(
      descriptorToLegacyKeyword({
        primitive: 'ko-hero',
        target: 'each',
        magnitude: 2,
        zone: 'discard',
      }),
      'koHeroEachPlayerMag2',
    );
    assert.equal(
      descriptorToLegacyKeyword({
        primitive: 'ko-hero',
        target: 'each',
        magnitude: 2,
        zone: 'hand',
      }),
      'koHeroEachPlayerMag2',
      'the hand zone reverse-maps identically — zone is invisible to the key',
    );
  });

  it('is injective — the 10 legacy descriptors are distinct', () => {
    const seen = new Set<string>();
    for (const keyword of VILLAIN_EFFECT_KEYWORDS) {
      const descriptor = LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[keyword];
      const descriptorKey = JSON.stringify([
        descriptor.primitive,
        descriptor.target ?? '',
        descriptor.magnitude ?? '',
        descriptor.selector ?? '',
      ]);
      assert.ok(
        !seen.has(descriptorKey),
        `descriptor for "${keyword}" must be unique (injective inverse)`,
      );
      seen.add(descriptorKey);
    }
    assert.equal(
      seen.size,
      VILLAIN_EFFECT_KEYWORDS.length,
      'all 10 legacy descriptors must be distinct',
    );
  });
});

describe('Tier-B descriptor additions (WP-489 / D-24295)', () => {
  // why: ADD positive coverage for the additive descriptor fields (no primitive
  // added — the count stays 12). The `each-other` target and the counted
  // `capture-bystander` MUST be keyword-less (no legacy reverse-map entry) so
  // they self-narrate; a legacy reverse-map would double-log with the generic
  // "Fight effect:" line.
  it("reverse-maps a gain-wound:each-other descriptor to undefined (keyword-less)", () => {
    assert.equal(
      descriptorToLegacyKeyword({ primitive: 'gain-wound', target: 'each-other', magnitude: 1 }),
      undefined,
      'each-other is not a legacy keyword — it must self-narrate',
    );
  });

  it('reverse-maps a counted capture-bystander:N descriptor to undefined (keyword-less)', () => {
    // why: descriptorKey includes magnitude, so { capture-bystander, magnitude: 3 }
    // has NO legacy entry (the legacy captureBystander is magnitude-less) — it must
    // self-narrate. The un-counted capture-bystander stays keyworded (below).
    assert.equal(
      descriptorToLegacyKeyword({ primitive: 'capture-bystander', magnitude: 3 }),
      undefined,
      'the counted capture-bystander must self-narrate, not reverse-map',
    );
    assert.equal(
      descriptorToLegacyKeyword({ primitive: 'capture-bystander' }),
      'captureBystander',
      'the un-counted capture-bystander keeps its legacy keyword (generic narration)',
    );
  });

  it('JSON round-trips a descriptor carrying requireCitySpaces', () => {
    const descriptor: VillainEffectDescriptor = {
      primitive: 'capture-bystander',
      magnitude: 3,
      requireCitySpaces: ['streets', 'bridge'],
    };
    const deserialized = JSON.parse(JSON.stringify(descriptor)) as VillainEffectDescriptor;
    assert.deepStrictEqual(deserialized, descriptor, 'the location-gate field must survive JSON round-trip');
  });
});

describe('Tier-D descriptor additions (WP-494 / D-24299)', () => {
  it('a gain-wound-unless-victory-villain-group descriptor is keyword-less (self-narrates)', () => {
    assert.equal(
      descriptorToLegacyKeyword({
        primitive: 'gain-wound-unless-victory-villain-group',
        victoryVillainGroup: 'hydra',
      }),
      undefined,
      'Viper is not a legacy keyword — it must self-narrate',
    );
  });

  it('JSON round-trips a descriptor carrying victoryVillainGroup', () => {
    const descriptor: VillainEffectDescriptor = {
      primitive: 'gain-wound-unless-victory-villain-group',
      victoryVillainGroup: 'hydra',
    };
    const deserialized = JSON.parse(JSON.stringify(descriptor)) as VillainEffectDescriptor;
    assert.deepStrictEqual(deserialized, descriptor, 'the victory-group field must survive JSON round-trip');
  });
});
