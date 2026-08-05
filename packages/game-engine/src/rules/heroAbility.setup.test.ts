/**
 * Tests for hero ability hook builder, keyword taxonomy, and timing taxonomy.
 *
 * WP-191 — hooks now key by the canonical-face slash instance ext_id
 * (`{setAbbr}/{heroSlug}/{cardSlug}#{copyIndex}`, D-18705) resolved via the
 * shared heroCardInstanceExtIds emitter, and ability text is read from the
 * hero entry's `cards[]` (canonical face = `physicalCards[].sides[0]`). The
 * mocks therefore expose `getSet` (hero entries with cards + physicalCards)
 * rather than a dash-keyed FlatCard `listCards` array.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 * No modifications to shared test helpers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { HERO_KEYWORDS, HERO_ABILITY_TIMINGS } from './heroKeywords.js';
import { HERO_COMPOSITION_MARKERS } from './heroCompositions.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// ---------------------------------------------------------------------------
// Mock registry (getSet-based — hero entries with cards + physicalCards)
// ---------------------------------------------------------------------------

interface MockHeroCard {
  slug: string;
  rarityLabel?: string;
  abilities: string[];
}

/**
 * Builds a registry exposing getSet (the source buildHeroAbilityHooks reads)
 * and a listCards stub (satisfies the isHeroAbilityRegistryReader guard,
 * which checks only that listCards is a function). Each hero card becomes a
 * single-copy physical card whose canonical face (sides[0]) is the card slug,
 * so hooks key by `{setAbbr}/{heroSlug}/{cardSlug}#0`.
 */
function makeHeroRegistry(
  setAbbr: string,
  heroSlug: string,
  cards: MockHeroCard[],
) {
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

/**
 * Creates the canonical spider-man mock registry used by the core suite.
 */
function createMockRegistry() {
  return makeHeroRegistry('core', 'spider-man', [
    { slug: 'astonishing-strength', rarityLabel: 'Common 1', abilities: ['You get +1[icon:attack].'] },
    { slug: 'web-shooters', rarityLabel: 'Common 2', abilities: ['[hc:tech]: You get +2[icon:recruit].'] },
    { slug: 'spider-sense', rarityLabel: 'Uncommon', abilities: ['[keyword:rescue] a Bystander.'] },
    {
      slug: 'great-responsibility',
      rarityLabel: 'Rare',
      abilities: [
        '[icon:attack] for each hero you played.',
        '[icon:recruit] for each villain in the city.',
      ],
    },
  ]);
}

/**
 * Creates a valid mock MatchSetupConfig for tests.
 */
function createTestConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme-001',
    mastermindId: 'test/test-mastermind-001',
    villainGroupIds: ['test/test-villain-group-001'],
    henchmanGroupIds: ['test/test-henchman-group-001'],
    heroDeckIds: ['core/spider-man'],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks', () => {
  it('produces a non-empty array for valid hero decks', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();

    const hooks = buildHeroAbilityHooks(registry, config);

    assert.ok(Array.isArray(hooks), 'result must be an array');
    assert.ok(hooks.length > 0, 'result must be non-empty for valid hero decks');
  });

  it('every hook has a slash-format instance cardId (D-18705)', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();

    const hooks = buildHeroAbilityHooks(registry, config);

    for (const hook of hooks) {
      assert.equal(typeof hook.cardId, 'string', 'cardId must be a string');
      assert.ok(hook.cardId.length > 0, 'cardId must be non-empty');
      // why: WP-191 — hooks key by the canonical-face slash instance id
      // `{setAbbr}/{heroSlug}/{cardSlug}#{copyIndex}` (contains both '/' and
      // '#'), never the dash/slot FlatCard key.
      assert.ok(hook.cardId.includes('/'), `cardId '${hook.cardId}' must contain a slash`);
      assert.ok(hook.cardId.includes('#'), `cardId '${hook.cardId}' must contain a '#' copy suffix`);
      assert.ok(
        !hook.cardId.includes('-hero-'),
        `cardId '${hook.cardId}' must not be a dash/slot FlatCard key`,
      );
    }
  });

  it('every hook has a valid timing value from HERO_ABILITY_TIMINGS', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();

    const hooks = buildHeroAbilityHooks(registry, config);

    const validTimings = new Set(HERO_ABILITY_TIMINGS);
    for (const hook of hooks) {
      assert.ok(
        validTimings.has(hook.timing),
        `timing "${hook.timing}" must be a member of HERO_ABILITY_TIMINGS`,
      );
    }
  });

  it('every hook keyword is from the HeroKeyword union', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();

    const hooks = buildHeroAbilityHooks(registry, config);

    const validKeywords = new Set(HERO_KEYWORDS);
    for (const hook of hooks) {
      for (const keyword of hook.keywords) {
        assert.ok(
          validKeywords.has(keyword),
          `keyword "${keyword}" must be a member of HERO_KEYWORDS`,
        );
      }
    }
  });

  it('JSON.stringify succeeds for all hooks (fully serializable)', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();

    const hooks = buildHeroAbilityHooks(registry, config);

    const serialized = JSON.stringify(hooks);
    assert.ok(serialized, 'JSON.stringify(hooks) must produce a non-empty string');
    assert.ok(serialized.length > 2, 'serialized output must contain data');
  });

  it('resolves ability text from the canonical face (sides[0]) only', () => {
    // why: WP-191 / D-18705 — for a split physical card, only the canonical
    // face (sides[0]) is keyed; the back side's ability text is out of scope
    // (safe-skip). Here the back side 'venom-symbiote' carries an ability, but
    // no hook is emitted for it because it is never a canonical face.
    const setData = {
      abbr: 'core',
      heroes: [
        {
          slug: 'spider-man',
          cards: [
            { slug: 'front-face', rarityLabel: 'Common 1', abilities: ['You get +1[icon:attack].'] },
            { slug: 'venom-symbiote', rarityLabel: 'Common 1', abilities: ['[keyword:ko] this card.'] },
          ],
          physicalCards: [{ id: 'p0', count: 2, sides: ['front-face', 'venom-symbiote'] }],
        },
      ],
      villains: [],
      henchmen: [],
      schemes: [],
      masterminds: [],
    };
    const registry = {
      listCards: () => [],
      listSets: () => [{ abbr: 'core' }],
      getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
    };
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/spider-man'] };

    const hooks = buildHeroAbilityHooks(registry, config);

    for (const hook of hooks) {
      assert.ok(
        hook.cardId.startsWith('core/spider-man/front-face#'),
        `only the canonical face is keyed; got '${hook.cardId}'`,
      );
    }
    // Two physical copies of the canonical face → two hooks (one per copy).
    assert.equal(hooks.length, 2, 'both copies of the canonical face are keyed');
  });

  it('returns an empty array when the registry exposes no getSet (narrow mock)', () => {
    // why: WP-191 — hook keys derive from hero entries read via getSet. A
    // narrow listCards-only mock satisfies the isHeroAbilityRegistryReader
    // guard but cannot supply hero entries, so no hooks are built (no throw).
    const narrowRegistry = { listCards: () => [] };
    const hooks = buildHeroAbilityHooks(narrowRegistry, createTestConfig());
    assert.deepStrictEqual(hooks, []);
  });
});

describe('HERO_KEYWORDS drift-detection', () => {
  // why: prevents union/array divergence — same pattern as
  // REVEALED_CARD_TYPES drift detection
  it('contains exactly the 34 canonical keyword values', () => {
    const expectedKeywords = [
      'draw',
      'attack',
      'recruit',
      'ko',
      'rescue',
      'wound',
      'reveal',
      'reveal-ko',
      'reveal-min',
      'reveal-ko-or-draw',
      'reveal-cost-attack',
      'reveal-odd-draw',
      'reveal-attack-choose',
      'reveal-ko-attack',
      'attack-per-count',
      'optional-ko-reward',
      'ko-wound-reward', // why: WP-382 / D-24183 — Wound-restricted auto-resolving variant of optional-ko-reward
      'wall-crawl', // why: D-24049 — recruit-time-executed keyword
      'dodge', // why: D-24051 — hand-action-executed keyword (the dodgeCard move)
      'undercover', // why: D-24060 / WP-282 — face-down-send-and-play keyword
      'conditional',
      'victory-villain-attack', // why: D-24068 / WP-285 — victory-pile villain-pick mechanic
      'draw-or-empowered', // why: D-24069 / WP-286 — draw-or-empowered choose-one mechanic
      'size-changing', // why: D-24074 / WP-290 — class-grant-on-play keyword
      'optional-put-bottom-hq', // why: Ionic Energy — optional put-a-HQ-card-on-bottom-of-Hero-Deck mechanic
      'put-any-number-bottom-hq', // why: D-24132 — multi-select put-any-number-of-HQ-cards-on-bottom-of-Hero-Deck mechanic
      'put-bottom-hq-icon-reward', // why: D-24133 — mandatory single-card put-bottom + recruit/attack icon reward (Absorb Ambient Power)
      'return-zero-cost-discard', // why: D-24139 — mandatory return-a-0-cost-discard-card-to-hand mechanic (Defend the Weak)
      'gain-wound-self', // why: D-24156 / WP-364 — "You gain a Wound." (active player)
      'gain-wound-each', // why: D-24156 / WP-364 — "Each player gains a Wound." (Crazed Rampage)
      'shuffle-discard-empty-reward', // why: D-24148 / WP-356 — mandatory empty-discard-reward-or-shuffle (Reprocess / Electromagnetic Eyebeams)
      'discard-to-play', // why: WP-383 / D-24184 — mandatory play COST "discard a card to play this card" (Cyclops Determination/Optic Blast + siblings)
      'defeat-with-bystander', // why: WP-486 / D-24291 — Silent Sniper "Defeat a Villain or Mastermind that has a Bystander."
      'return-on-discard', // why: WP-498 / D-24301 — Cyclops Unending Energy "If a card effect makes you discard this card, you may return this card to your hand."
    ];

    assert.equal(
      HERO_KEYWORDS.length,
      34,
      'HERO_KEYWORDS must have exactly 34 entries',
    );

    assert.deepStrictEqual(
      [...HERO_KEYWORDS],
      expectedKeywords,
      'HERO_KEYWORDS must match the canonical keyword values in order',
    );

    // why: D-24051 — explicit membership assertion so the keyword cannot silently
    // drop out of the union/array while the count stays correct via a swap.
    assert.ok(HERO_KEYWORDS.includes('dodge'), 'HERO_KEYWORDS must contain dodge');

    // why: D-24060 / WP-282 — explicit assertion for undercover keyword
    assert.ok(HERO_KEYWORDS.includes('undercover'), 'HERO_KEYWORDS must contain undercover');

    // Verify no duplicates
    const uniqueKeywords = new Set(HERO_KEYWORDS);
    assert.equal(
      uniqueKeywords.size,
      HERO_KEYWORDS.length,
      'HERO_KEYWORDS must have no duplicates',
    );
  });
});

describe('buildHeroAbilityHooks determinism', () => {
  // why: protects replay, snapshot tests, and leaderboards
  it('identical input produces identical output', () => {
    const registry = createMockRegistry();
    const config = createTestConfig();

    const result1 = buildHeroAbilityHooks(registry, config);
    const result2 = buildHeroAbilityHooks(registry, config);

    assert.equal(
      JSON.stringify(result1),
      JSON.stringify(result2),
      'two calls with same input must produce JSON-identical output',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-215 — [keyword:X:N] magnitude extraction tests (AC-9, AC-10, AC-11)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks [keyword:X:N] magnitude extraction (WP-215)', () => {
  it('[keyword:rescue:1] produces effects[0] with magnitude 1 (AC-9)', () => {
    const registry = makeHeroRegistry('core', 'spider-man', [
      { slug: 'web-shooters', rarityLabel: 'Uncommon', abilities: ['Rescue a Bystander. [keyword:rescue:1]'] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/spider-man'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(Array.isArray(hook.effects) && hook.effects!.length > 0, 'effects must be present');
    const rescueEffect = hook.effects!.find(e => e.type === 'rescue');
    assert.ok(rescueEffect !== undefined, 'rescue effect must be present');
    assert.equal(rescueEffect!.magnitude, 1, 'rescue magnitude must be 1');
  });

  it('[keyword:rescue] without suffix produces rescue effect with no magnitude (AC-10)', () => {
    const registry = makeHeroRegistry('core', 'spider-man', [
      { slug: 'web-shooters', rarityLabel: 'Uncommon', abilities: ['[keyword:rescue] a Bystander.'] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/spider-man'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(Array.isArray(hook.effects) && hook.effects!.length > 0, 'effects must be present');
    const rescueEffect = hook.effects!.find(e => e.type === 'rescue');
    assert.ok(rescueEffect !== undefined, 'rescue effect must be present');
    assert.equal(rescueEffect!.magnitude, undefined, 'rescue effect must have no magnitude');
  });

  it('[keyword:put-any-number-bottom-hq:1] with a trailing multi-class Empowered captures the classes onto the effect and suppresses the standalone primitive (D-24132)', () => {
    // why: the real, marker-applied antm/wonder-man/8th-wonder-of-the-world line. The Empowered
    // classes must ride the put-any-number effect (applied AFTER the moves at resolve time), NOT
    // a standalone play-time primitiveEffect, and the [hc:] tokens must not add a 'conditional'
    // gate (they are the Empowered count parameters, not play conditions).
    const registry = makeHeroRegistry('antm', 'wonder-man', [
      {
        slug: '8th-wonder-of-the-world',
        rarityLabel: 'Rare',
        abilities: [
          'Choose any number of cards from the HQ. Put them on the bottom of the Hero Deck. Then you get [keyword:Empowered] by [hc:ranged] and [hc:strength]. [keyword:put-any-number-bottom-hq:1]',
        ],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['antm/wonder-man'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    const effect = hook.effects!.find(e => e.type === 'put-any-number-bottom-hq');
    assert.ok(effect !== undefined, 'put-any-number-bottom-hq effect must be present');
    assert.equal(effect!.magnitude, 1, 'magnitude must be 1');
    assert.deepStrictEqual(
      effect!.empoweredClasses,
      ['ranged', 'strength'],
      'the trailing Empowered classes must ride the effect in printed order',
    );
    assert.ok(
      !(hook.keywords ?? []).includes('conditional'),
      'the Empowered count params must NOT add a conditional gate',
    );
    assert.equal(
      (hook.primitiveEffects ?? []).length,
      0,
      'the standalone play-time Empowered primitive must be suppressed (grant applies at resolve time)',
    );
  });

  it('[keyword:put-any-number-bottom-hq:1] with no Empowered tail emits the bare effect (Empyreal Force / Colliding Dreams) (D-24132)', () => {
    const registry = makeHeroRegistry('nmut', 'sunspot', [
      {
        slug: 'empyreal-force',
        rarityLabel: 'Rare',
        abilities: [
          'Choose any number of Heroes in the HQ. Put them on the bottom of the Hero Deck. [keyword:put-any-number-bottom-hq:1]',
        ],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['nmut/sunspot'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    const effect = hook.effects!.find(e => e.type === 'put-any-number-bottom-hq');
    assert.ok(effect !== undefined, 'put-any-number-bottom-hq effect must be present');
    assert.equal(effect!.magnitude, 1, 'magnitude must be 1');
    assert.equal(effect!.empoweredClasses, undefined, 'no empoweredClasses when the line has no Empowered tail');
    assert.ok(
      !(hook.keywords ?? []).includes('conditional'),
      'a bare put-any-number line adds no conditional gate',
    );
  });

  it('[keyword:reveal] with VP-cost pattern translates to a cost-lte branch-list (AC-11)', () => {
    const registry = makeHeroRegistry('core', 'spider-man', [
      {
        slug: 'web-shooters',
        rarityLabel: 'Uncommon',
        abilities: ['Reveal the top card of your deck. If that card costs 2[icon:vp] or less, draw it. [keyword:reveal]'],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/spider-man'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(Array.isArray(hook.effects) && hook.effects!.length > 0, 'effects must be present');
    const revealEffect = hook.effects!.find(e => e.type === 'reveal');
    assert.ok(revealEffect !== undefined, 'reveal effect must be present');
    // why: WP-253 / D-24024 — the top-level magnitude is dropped for the collapsed
    // reveal; the VP-cost threshold (2) now lives in the cost-lte predicate of the
    // translated branch-list.
    assert.equal(revealEffect!.magnitude, undefined, 'top-level magnitude is dropped for the collapsed reveal');
    assert.equal(revealEffect!.revealCount, 1, 'a translated legacy reveal carries revealCount 1');
    assert.deepStrictEqual(
      revealEffect!.revealRules,
      [{ predicate: { kind: 'cost-lte', threshold: 2 }, actions: [{ kind: 'draw' }] }],
      'the VP-cost threshold 2 lives in the cost-lte predicate of the reveal branch-list',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-215 — icon-adjacent magnitude extraction tests (AC-12)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks icon-adjacent magnitude extraction (WP-215)', () => {
  it('+2[icon:attack] sets attack effect magnitude to 2 (AC-12)', () => {
    const registry = makeHeroRegistry('core', 'hero-a', [
      { slug: 'power-fist', rarityLabel: 'Common 1', abilities: ['You get +2[icon:attack].'] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/hero-a'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(Array.isArray(hook.effects) && hook.effects!.length > 0, 'effects must be present');
    const attackEffect = hook.effects!.find(e => e.type === 'attack');
    assert.ok(attackEffect !== undefined, 'attack effect must be present');
    assert.equal(attackEffect!.magnitude, 2, 'attack magnitude must be 2 from icon-adjacent extraction');
  });

  it('+3[icon:recruit] sets recruit effect magnitude to 3 (AC-12)', () => {
    const registry = makeHeroRegistry('core', 'hero-b', [
      { slug: 'rally', rarityLabel: 'Common 1', abilities: ['You get +3[icon:recruit].'] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/hero-b'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(Array.isArray(hook.effects) && hook.effects!.length > 0, 'effects must be present');
    const recruitEffect = hook.effects!.find(e => e.type === 'recruit');
    assert.ok(recruitEffect !== undefined, 'recruit effect must be present');
    assert.equal(recruitEffect!.magnitude, 3, 'recruit magnitude must be 3 from icon-adjacent extraction');
  });

  it('bare N[icon:vp] without "or less" does not extract reveal magnitude', () => {
    // why: VP icon is used for both cost-threshold (with "or less") and
    // victory-points values (bare). Pattern must not match bare usage.
    const registry = makeHeroRegistry('core', 'hero-c', [
      { slug: 'victory', rarityLabel: 'Common 1', abilities: ['Gain 2[icon:vp]. [keyword:reveal]'] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/hero-c'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(Array.isArray(hook.effects) && hook.effects!.length > 0, 'effects must be present');
    const revealEffect = hook.effects!.find(e => e.type === 'reveal');
    assert.ok(revealEffect !== undefined, 'reveal effect must be present');
    // why: WP-253 / D-24024 — a bare VP icon yields no reveal threshold, so the
    // legacy translation produces empty revealRules (a no-op reveal), reproducing the
    // old undefined-magnitude skip while still emitting one effect.
    assert.equal(revealEffect!.magnitude, undefined, 'top-level magnitude is dropped for the collapsed reveal');
    assert.deepStrictEqual(revealEffect!.revealRules, [], 'a bare VP icon yields empty reveal rules (no draw threshold)');
  });
});

// ---------------------------------------------------------------------------
// WP-247 — count-scaled attack parse + icon-suppression (D-24016)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks count-scaled attack (WP-247)', () => {
  it('marked covert-operation line yields one attack-per-count effect and suppresses the attack icon', () => {
    // why: the printed "+1[icon:attack]" would otherwise emit a flat 'attack'
    // effect AND the count-scaled effect (double-count); the parser must drop the
    // plain 'attack' keyword on a line carrying an 'attack-per-count' effect.
    const registry = makeHeroRegistry('core', 'black-widow', [
      {
        slug: 'covert-operation',
        rarityLabel: 'Uncommon',
        abilities: [
          'You get +1[icon:attack] for each Bystander in your Victory Pile. [keyword:attack-per-count:victory-bystanders:1]',
        ],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/black-widow'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');

    // Keywords EXCLUDE the plain 'attack' icon (icon-suppression proven).
    assert.ok(
      !hook.keywords.includes('attack'),
      'the plain attack keyword must be suppressed on a count-scaled line',
    );
    assert.ok(
      hook.keywords.includes('attack-per-count'),
      'the count-scaled keyword must be present',
    );

    // Exactly one effect, fully specified.
    assert.ok(Array.isArray(hook.effects), 'effects must be present');
    assert.equal(hook.effects!.length, 1, 'exactly one effect must be emitted (no flat attack)');
    assert.deepStrictEqual(
      hook.effects![0],
      { type: 'attack-per-count', magnitude: 1, countSource: 'victory-bystanders' },
      'the single effect must be the count-scaled attack with magnitude 1 and victory-bystanders',
    );
  });

  it('ignores a count-scaled token with an unrecognized source (no attack-per-count effect)', () => {
    // why: only sources in HERO_COUNT_SOURCES emit an effect; an unknown source
    // produces no 'attack-per-count' effect, so the icon-suppression does not fire.
    const registry = makeHeroRegistry('core', 'black-widow', [
      {
        slug: 'covert-operation',
        rarityLabel: 'Uncommon',
        abilities: ['You get +1[icon:attack]. [keyword:attack-per-count:made-up-source:1]'],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/black-widow'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(
      !hook.keywords.includes('attack-per-count'),
      'an unrecognized source must not emit a count-scaled keyword',
    );
    // The printed attack icon is NOT suppressed (no count-scaled effect present).
    const attackEffect = (hook.effects ?? []).find((effect) => effect.type === 'attack');
    assert.ok(attackEffect !== undefined, 'the plain attack effect remains when no count-scaled effect is emitted');
    assert.equal(attackEffect!.magnitude, 1, 'the plain attack magnitude is the icon-adjacent value');
  });
});

// ---------------------------------------------------------------------------
// WP-248 — optional-KO-reward parse (D-24019)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks optional-KO-reward (WP-248)', () => {
  it('marked dangerous-rescue line yields one optional-ko-reward effect plus the conditional keyword (AC-3)', () => {
    // why: the parser must emit exactly { type:'optional-ko-reward',
    // rewardType:'rescue', magnitude:1 } from the three-segment token, plus the
    // 'conditional' keyword from the [hc:covert] condition.
    const registry = makeHeroRegistry('core', 'black-widow', [
      {
        slug: 'dangerous-rescue',
        rarityLabel: 'Common 2',
        abilities: [
          '[hc:covert]: You may KO a card from your hand or discard pile. If you do, rescue a Bystander. [keyword:optional-ko-reward:rescue:1]',
        ],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/black-widow'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');

    assert.ok(
      hook.keywords.includes('optional-ko-reward'),
      'the optional-ko-reward keyword must be present',
    );
    assert.ok(
      hook.keywords.includes('conditional'),
      'the [hc:covert] condition adds the conditional keyword',
    );

    // Exactly one effect (the conditional keyword never becomes an effect).
    assert.ok(Array.isArray(hook.effects), 'effects must be present');
    assert.equal(hook.effects!.length, 1, 'exactly one effect must be emitted');
    assert.deepStrictEqual(
      hook.effects![0],
      { type: 'optional-ko-reward', magnitude: 1, rewardType: 'rescue' },
      'the single effect must carry rewardType rescue and magnitude 1',
    );
  });

  it('ignores an optional-ko-reward token with an unseeded reward (no effect emitted)', () => {
    // why: only the seeded reward set (rescue/draw/attack/recruit) is dispatchable;
    // an unseeded reward (e.g. a not-yet-built gain-shard) emits no descriptor, so
    // such a marker can never reach the pending queue.
    const registry = makeHeroRegistry('core', 'black-widow', [
      {
        slug: 'dangerous-rescue',
        rarityLabel: 'Common 2',
        abilities: ['You may KO a card. [keyword:optional-ko-reward:gain-shard:1]'],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/black-widow'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(
      !hook.keywords.includes('optional-ko-reward'),
      'an unseeded reward must not emit an optional-ko-reward keyword',
    );
    assert.equal(
      (hook.effects ?? []).length,
      0,
      'no effect is emitted for an unseeded reward',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-253 — reveal token parsing → collapsed branch-list (D-24024)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks reveal collapse parsing (WP-253)', () => {
  /** Builds a single-ability reveal hook and returns its hook + reveal effect. */
  function revealEffectFor(abilityText: string) {
    const registry = makeHeroRegistry('core', 'reveal-hero', [
      { slug: 'reveal-card', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/reveal-hero'] };
    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0]!;
    return { hook, effect: hook.effects?.find((e) => e.type === 'reveal') };
  }

  it('a legacy [keyword:reveal-ko] token translates to cost-zero→ko and keeps the keyword on the hook', () => {
    const { hook, effect } = revealEffectFor('KO the revealed cost-0 card. [keyword:reveal-ko]');
    assert.ok(effect !== undefined, 'a reveal effect must be emitted');
    assert.equal(effect!.type, 'reveal', 'the effect is the collapsed reveal type');
    assert.equal(effect!.revealCount, 1, 'a legacy reveal carries revealCount 1');
    assert.deepStrictEqual(
      effect!.revealRules,
      [{ predicate: { kind: 'cost-zero' }, actions: [{ kind: 'ko' }] }],
      'reveal-ko translates to cost-zero → ko',
    );
    // why: D-24024 — narrative identity, no reverse-map: the LEGACY keyword stays on
    // hook.keywords even though the effect collapsed to type 'reveal'.
    assert.ok(hook.keywords.includes('reveal-ko'), 'the legacy reveal-ko keyword stays on hook.keywords');
    assert.ok(!hook.keywords.includes('reveal'), 'a legacy token does not also record the base reveal keyword');
  });

  it('a legacy [keyword:reveal-ko-attack:2] token translates to an atomic ko + attack-fixed(2) rule', () => {
    const { effect } = revealEffectFor('Reveal the top card. [keyword:reveal-ko-attack:2]');
    assert.deepStrictEqual(
      effect!.revealRules,
      [{ predicate: { kind: 'cost-zero' }, actions: [{ kind: 'ko' }, { kind: 'attack-fixed', amount: 2 }] }],
      'reveal-ko-attack:2 translates to cost-zero → [ko, attack-fixed 2]',
    );
  });

  it('a parameterized [keyword:reveal:cost-zero:ko] token parses to the same descriptor as legacy reveal-ko (dual-grammar)', () => {
    const legacy = revealEffectFor('[keyword:reveal-ko]');
    const parameterized = revealEffectFor('[keyword:reveal:cost-zero:ko]');
    assert.ok(parameterized.effect !== undefined, 'the parameterized token must emit a reveal effect');
    assert.deepStrictEqual(
      parameterized.effect!.revealRules,
      legacy.effect!.revealRules,
      'the parameterized form and its legacy equivalent yield identical reveal rules',
    );
    assert.equal(parameterized.effect!.revealCount, legacy.effect!.revealCount, 'both carry revealCount 1');
    // why: the parameterized grammar records the base 'reveal' keyword (forward-compat).
    assert.ok(parameterized.hook.keywords.includes('reveal'), 'the parameterized token records the base reveal keyword');
  });

  it('a parameterized reveal token parses a threshold predicate, action, and continue flag', () => {
    const { effect } = revealEffectFor('[keyword:reveal:cost-lte-3:attack-by-cost:continue]');
    assert.deepStrictEqual(
      effect!.revealRules,
      [{ predicate: { kind: 'cost-lte', threshold: 3 }, actions: [{ kind: 'attack-by-cost' }], continue: true }],
      'the predicate threshold, action, and continue flag all parse from one token',
    );
  });

  it('two parameterized reveal tokens accumulate into one descriptor in source order (reveal-attack-choose shape)', () => {
    const { effect } = revealEffectFor(
      '[keyword:reveal:cost-lte-4:attack-by-cost:continue][keyword:reveal:always:choose-discard-or-return]',
    );
    assert.deepStrictEqual(
      effect!.revealRules,
      [
        { predicate: { kind: 'cost-lte', threshold: 4 }, actions: [{ kind: 'attack-by-cost' }], continue: true },
        { predicate: { kind: 'always' }, actions: [{ kind: 'choose-discard-or-return' }] },
      ],
      'two reveal-rule tokens build the reveal-attack-choose branch-list directly',
    );
  });

  it('a malformed parameterized reveal token is safe-skipped (no reveal effect, no throw)', () => {
    const { hook, effect } = revealEffectFor('[keyword:reveal:bogus-predicate:draw]');
    assert.equal(effect, undefined, 'a malformed predicate voids the rule, so no reveal effect is emitted');
    assert.ok(!hook.keywords.includes('reveal'), 'no reveal keyword is recorded for a fully-malformed reveal token');
  });

  // -------------------------------------------------------------------------
  // WP-255 / D-24027 — reveal-count modifier marker
  // -------------------------------------------------------------------------

  it('a [keyword:reveal-count:3] modifier sets revealCount 3 on the reveal descriptor (D-24027)', () => {
    const { effect } = revealEffectFor('[keyword:reveal:cost-lte-2:draw][keyword:reveal-count:3]');
    assert.ok(effect !== undefined, 'a reveal effect must be emitted');
    assert.equal(effect!.revealCount, 3, 'the reveal-count modifier sets revealCount on the descriptor');
    assert.deepStrictEqual(
      effect!.revealRules,
      [{ predicate: { kind: 'cost-lte', threshold: 2 }, actions: [{ kind: 'draw' }] }],
      'the parameterized reveal rule is unaffected by the reveal-count modifier',
    );
  });

  it('an absent reveal-count modifier leaves the WP-253 default revealCount 1', () => {
    const { effect } = revealEffectFor('[keyword:reveal:cost-lte-2:draw]');
    assert.ok(effect !== undefined, 'a reveal effect must be emitted');
    assert.equal(effect!.revealCount, 1, 'no reveal-count marker ⇒ the descriptor keeps revealCount 1');
  });

  // -------------------------------------------------------------------------
  // WP-479 / D-24286 — reveal-reorder modifier marker
  // -------------------------------------------------------------------------

  it('a [keyword:reveal-reorder] modifier sets reorderRemainder on the reveal descriptor (D-24286)', () => {
    const { effect } = revealEffectFor('[keyword:reveal:cost-lte-2:draw][keyword:reveal-count:3][keyword:reveal-reorder]');
    assert.ok(effect !== undefined, 'a reveal effect must be emitted');
    assert.equal(effect!.reorderRemainder, true, 'the reveal-reorder modifier sets reorderRemainder');
    assert.equal(effect!.revealCount, 3, 'reveal-count is unaffected by the reveal-reorder modifier');
  });

  it('an absent reveal-reorder modifier leaves reorderRemainder undefined', () => {
    const { effect } = revealEffectFor('[keyword:reveal:cost-lte-2:draw][keyword:reveal-count:3]');
    assert.ok(effect !== undefined, 'a reveal effect must be emitted');
    assert.equal(effect!.reorderRemainder, undefined, 'no reveal-reorder marker ⇒ the field is omitted');
  });

  it('the "The Amazing Spider-Man"-shaped line parses to revealCount 3 + cost-lte 2 → draw (WP-255)', () => {
    const { hook, effect } = revealEffectFor(
      'Reveal the top three cards of your deck. Put any that cost 2[icon:vp] or less into your hand. Put the rest back in any order. [keyword:reveal:cost-lte-2:draw][keyword:reveal-count:3]',
    );
    assert.ok(effect !== undefined, 'the marked Spider-Man line emits a reveal effect');
    assert.equal(effect!.type, 'reveal', 'the effect is the collapsed reveal type');
    assert.equal(effect!.revealCount, 3, 'reveal-count 3 → the handler peeks the top three cards');
    assert.deepStrictEqual(
      effect!.revealRules,
      [{ predicate: { kind: 'cost-lte', threshold: 2 }, actions: [{ kind: 'draw' }] }],
      'the parameterized [keyword:reveal:cost-lte-2:draw] marker builds a single cost-lte 2 → draw rule',
    );
    assert.equal(effect!.magnitude, undefined, 'the top-level magnitude is dropped for the collapsed reveal');
    assert.ok(hook.keywords.includes('reveal'), 'the parameterized reveal records the base reveal keyword');
    // why: D-24027 — reveal-count is a modifier marker, never a HeroKeyword (so it never
    // lands on hook.keywords and the 17-entry HERO_KEYWORDS drift test stays untouched).
    assert.ok(!(hook.keywords as string[]).includes('reveal-count'),
      'reveal-count is a modifier, never recorded as a keyword');
  });
});

describe('buildHeroAbilityHooks composition-marker parsing (WP-256 / D-24031)', () => {
  /** Builds a single-ability hook from one Berserk-bearing ability line. */
  function berserkHookFor(abilityText: string) {
    const registry = makeHeroRegistry('core', 'berserk-hero', [
      { slug: 'berserk-card', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/berserk-hero'] };
    const hooks = buildHeroAbilityHooks(registry, config);
    return hooks[0]!;
  }

  it('a [keyword:Berserk] token attaches the Berserk composition to hook.primitiveEffects', () => {
    const hook = berserkHookFor(
      'Discard the top card of your deck. You get +Attack equal to its printed Attack. [keyword:Berserk]',
    );
    assert.ok(hook.primitiveEffects !== undefined, 'primitiveEffects must be present for a Berserk line');
    assert.equal(hook.primitiveEffects!.length, 1, 'exactly one composition attaches');
    assert.deepStrictEqual(
      hook.primitiveEffects![0],
      HERO_COMPOSITION_MARKERS['berserk'],
      'the attached AST equals the seeded Berserk composition',
    );
  });

  it('berserk attaches to primitiveEffects, NEVER to hook.keywords (it is not a HeroKeyword)', () => {
    const hook = berserkHookFor('[keyword:Berserk]');
    // why: D-24031 — berserk is a composition marker, never a HeroKeyword, so the parser
    // records no keyword for it (the 17-entry HERO_KEYWORDS drift test stays untouched).
    assert.ok(!(hook.keywords as string[]).includes('berserk'), 'berserk must not appear on hook.keywords');
    assert.equal(hook.keywords.length, 0, 'a Berserk-only line records no hero keywords');
  });

  it('the parsed hook owns a DEEP COPY — mutating it does not mutate the shared registry const', () => {
    const before = JSON.stringify(HERO_COMPOSITION_MARKERS['berserk']);
    const hook = berserkHookFor('[keyword:Berserk]');
    // Mutate the parsed hook's primitive AST in place.
    (hook.primitiveEffects![0] as { type: string }).type = 'mutated';
    (hook.primitiveEffects![0] as { steps?: unknown[] }).steps = [];
    assert.equal(
      JSON.stringify(HERO_COMPOSITION_MARKERS['berserk']),
      before,
      'mutating a parsed hook primitive effect must not mutate HERO_COMPOSITION_MARKERS[berserk]',
    );
  });

  it('an ability line with no composition marker leaves primitiveEffects absent', () => {
    const hook = berserkHookFor('You get +1[icon:attack].');
    assert.equal(hook.primitiveEffects, undefined, 'no composition marker ⇒ primitiveEffects is not assigned');
  });
});

describe('buildHeroAbilityHooks Empowered parameterized composition (WP-267 / D-24044)', () => {
  /** Builds a single-ability hook from one Empowered-bearing ability line. */
  function empoweredHookFor(abilityText: string) {
    const registry = makeHeroRegistry('core', 'empowered-hero', [
      { slug: 'empowered-card', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/empowered-hero'] };
    const hooks = buildHeroAbilityHooks(registry, config);
    return hooks[0]!;
  }

  it('core form "Empowered by [hc:strength]" → built count composition; param suppressed from conditions', () => {
    const hook = empoweredHookFor('You get [keyword:Empowered] by [hc:strength].');
    assert.ok(hook.primitiveEffects !== undefined, 'primitiveEffects must be present for the core form');
    assert.equal(hook.primitiveEffects!.length, 1, 'exactly one built composition');
    assert.deepStrictEqual(
      hook.primitiveEffects![0],
      {
        type: 'gain-resource',
        resource: 'attack',
        amount: { type: 'count-cards-by-class-in-zone', heroClass: 'strength', zone: 'hq' },
      },
      'the built composition counts strength HQ cards into +Attack',
    );
    // why: the consumed [hc:strength] is the count PARAMETER, not a gating condition — it is
    // suppressed, so the hook has no conditions and no 'conditional' keyword (fires unconditionally).
    assert.equal(hook.conditions, undefined, 'the consumed [hc:strength] is suppressed → no conditions');
    assert.ok(!(hook.keywords as string[]).includes('empowered'), 'empowered is never a hook keyword');
    assert.ok(!(hook.keywords as string[]).includes('conditional'), 'no conditional keyword (param suppressed)');
    assert.equal(hook.unresolvedMarkers, undefined, 'a resolved core form records no unresolved marker');
  });

  it('no anchored tail ("Empowered. Then by [hc:strength]") → deferred, no broad forward scan', () => {
    const hook = empoweredHookFor('You get [keyword:Empowered]. Then by [hc:strength] draw a card.');
    assert.equal(hook.primitiveEffects, undefined, 'no composition — the [hc:strength] is not the anchored tail');
    assert.ok(
      (hook.unresolvedMarkers ?? []).includes('empowered'),
      'a deferred Empowered records an unresolved marker (Honest-Partial)',
    );
  });

  it('conditional-prefix ("[hc:strength]: ...Empowered by [hc:tech]") → resolves, prefix gate retained (WP-272 / D-24047 lifted the deferral)', () => {
    // why: WP-272 / D-24047 lifted D-24044's conditional-prefix deferral for the class-gated
    // case. The leading [hc:strength]: gate is RETAINED; only the consumed count param [hc:tech]
    // is suppressed. Full structural-gate coverage is in the WP-272 describe block below.
    const hook = empoweredHookFor('[hc:strength]: You get [keyword:Empowered] by [hc:tech].');
    assert.ok(hook.primitiveEffects !== undefined, 'the conditional-prefix form now resolves');
    assert.deepStrictEqual(
      hook.primitiveEffects![0],
      {
        type: 'gain-resource',
        resource: 'attack',
        amount: { type: 'count-cards-by-class-in-zone', heroClass: 'tech', zone: 'hq' },
      },
      'the built composition counts tech HQ cards (the count color Y)',
    );
    assert.deepStrictEqual(
      hook.conditions,
      [{ type: 'heroClassMatch', value: 'strength' }],
      'the [hc:strength] prefix gate is retained; only the [hc:tech] count param is suppressed',
    );
    assert.equal(hook.unresolvedMarkers, undefined, 'a resolved conditional-prefix records no unresolved marker');
  });

  it('[keyword:Double Empowered] is not the bare empowered marker → no composition', () => {
    const hook = empoweredHookFor('You get [keyword:Double Empowered] by [hc:strength].');
    assert.equal(hook.primitiveEffects, undefined, 'Double Empowered is not the parameterized empowered marker');
  });

  it('multi-class ("Empowered by [hc:ranged] and [hc:strength]") → one composition per class, printed order (WP-310 / D-24098)', () => {
    // why: WP-310 lifted the D-24044 multi-class deferral — the unconditional multi-class form now
    // resolves to ONE gain-resource composition per parsed class (the sum), reusing the WP-256
    // substrate. No new keyword/value-expression/node type.
    const hook = empoweredHookFor('You get [keyword:Empowered] by [hc:ranged] and [hc:strength].');
    assert.ok(hook.primitiveEffects !== undefined, 'the multi-class form now resolves');
    assert.deepStrictEqual(
      hook.primitiveEffects,
      [
        {
          type: 'gain-resource',
          resource: 'attack',
          amount: { type: 'count-cards-by-class-in-zone', heroClass: 'ranged', zone: 'hq' },
        },
        {
          type: 'gain-resource',
          resource: 'attack',
          amount: { type: 'count-cards-by-class-in-zone', heroClass: 'strength', zone: 'hq' },
        },
      ],
      'one composition per parsed class, in printed order (ranged then strength) — the sum',
    );
    // why: WP-310 — both [hc:X] tokens are consumed count params (the line's sole conditions),
    // so they are cleared; no residual conditions, no 'conditional' keyword.
    assert.equal(hook.conditions, undefined, 'both consumed count params suppressed → no conditions');
    assert.equal(hook.unresolvedMarkers, undefined, 'a resolved multi-class records no unresolved marker');
  });

  it('single-class ("Empowered by [hc:strength]") is unchanged — one composition via the core path (WP-310 regression)', () => {
    // why: WP-310 — the multi-class pre-pass requires an `and [hc:…]` continuation, so a
    // single-class line NEVER matches it and still routes through tryResolveEmpoweredCore.
    const hook = empoweredHookFor('You get [keyword:Empowered] by [hc:strength].');
    assert.ok(hook.primitiveEffects !== undefined, 'the single-class core form still resolves');
    assert.equal(hook.primitiveEffects!.length, 1, 'exactly one composition (not captured by the multi-class pre-pass)');
    assert.deepStrictEqual(hook.primitiveEffects![0], {
      type: 'gain-resource',
      resource: 'attack',
      amount: { type: 'count-cards-by-class-in-zone', heroClass: 'strength', zone: 'hq' },
    });
  });

  it('8th-wonder compound clause: the multi-class Empowered resolves; the HQ-choose prose stays unimplemented (honest-partial, WP-310)', () => {
    // why: WP-310 honest-partial — the printed clause "Choose any number of cards from the HQ.
    // Put them on the bottom of the Hero Deck. Then you get [keyword:Empowered] by [hc:ranged] and
    // [hc:strength]." resolves ONLY the Empowered tail. The HQ-choose prefix is UNMARKED prose
    // (no [keyword:X]), so it emits no primitive and is deliberately left unimplemented (a named
    // follow-up) — never silently mis-resolved into an effect.
    const hook = empoweredHookFor(
      'Choose any number of cards from the HQ. Put them on the bottom of the Hero Deck. Then you get [keyword:Empowered] by [hc:ranged] and [hc:strength].',
    );
    assert.deepStrictEqual(
      hook.primitiveEffects,
      [
        {
          type: 'gain-resource',
          resource: 'attack',
          amount: { type: 'count-cards-by-class-in-zone', heroClass: 'ranged', zone: 'hq' },
        },
        {
          type: 'gain-resource',
          resource: 'attack',
          amount: { type: 'count-cards-by-class-in-zone', heroClass: 'strength', zone: 'hq' },
        },
      ],
      'only the Empowered multi-class tail resolves (2 compositions); the HQ-choose prose adds nothing',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-272 — Empowered conditional-prefix class-gated core form (D-24047)
//
// The parser resolves `[hc:X]: ... [keyword:Empowered] by [hc:Y]` as the WP-267
// gain-resource composition, RETAINED behind the leading [hc:X]: class gate: the
// consumed count param [hc:Y] is suppressed, the prefix gate is kept so the
// WP-256 executor fires the effect only when that gate passes. The structural
// resolve gate (single marker + leading [hc:X]: + anchored fixed-color tail + no
// `and [hc:Z]` continuation + no [team:...]) keeps every still-deferred Empowered
// variant a parse-unrecognized hollow — the Honest-Partial Invariant.
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks Empowered conditional-prefix class-gated form (WP-272 / D-24047)', () => {
  /** Builds a single-ability hook from one Empowered-bearing ability line. */
  function empoweredHookFor(abilityText: string) {
    const registry = makeHeroRegistry('core', 'empowered-prefix-hero', [
      { slug: 'empowered-prefix-card', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/empowered-prefix-hero'] };
    const hooks = buildHeroAbilityHooks(registry, config);
    return hooks[0]!;
  }

  it('same-class "[hc:ranged]: ...Empowered by [hc:ranged]" → resolves; exactly one ranged gate retained', () => {
    const hook = empoweredHookFor('[hc:ranged]: You get [keyword:Empowered] by [hc:ranged].');
    assert.ok(hook.primitiveEffects !== undefined, 'the conditional-prefix form resolves');
    assert.equal(hook.primitiveEffects!.length, 1, 'exactly one built composition');
    assert.deepStrictEqual(
      hook.primitiveEffects![0],
      {
        type: 'gain-resource',
        resource: 'attack',
        amount: { type: 'count-cards-by-class-in-zone', heroClass: 'ranged', zone: 'hq' },
      },
      'the built composition counts ranged HQ cards into +Attack',
    );
    // why: same-class case — Step 1a extracted two heroClassMatch('ranged') (prefix + tail);
    // suppressing exactly one leaves exactly one as the retained gate.
    assert.deepStrictEqual(
      hook.conditions,
      [{ type: 'heroClassMatch', value: 'ranged' }],
      'exactly one heroClassMatch(ranged) gate is retained',
    );
    assert.deepStrictEqual(hook.resolvedMarkers, ['empowered'], 'empowered is recorded resolved by-hook');
    assert.ok(!(hook.keywords as string[]).includes('empowered'), 'empowered is never a hook keyword');
    assert.equal(hook.unresolvedMarkers, undefined, 'a resolved conditional-prefix records no unresolved marker');
  });

  it('different-class "[hc:strength]: ...Empowered by [hc:tech]" → builds tech count; only the tech param suppressed', () => {
    const hook = empoweredHookFor('[hc:strength]: You get [keyword:Empowered] by [hc:tech].');
    assert.deepStrictEqual(
      hook.primitiveEffects![0],
      {
        type: 'gain-resource',
        resource: 'attack',
        amount: { type: 'count-cards-by-class-in-zone', heroClass: 'tech', zone: 'hq' },
      },
      'the built composition counts the count color Y (tech) HQ cards',
    );
    // why: the prefix gate X (strength) is retained; only the consumed count param Y (tech) is removed.
    assert.deepStrictEqual(
      hook.conditions,
      [{ type: 'heroClassMatch', value: 'strength' }],
      'the strength prefix gate is retained; the tech count param is suppressed',
    );
    assert.deepStrictEqual(hook.resolvedMarkers, ['empowered'], 'empowered recorded resolved by-hook');
  });

  it('two-marker choose-one (fight-or-flight shape) → resolves via WP-283 choose-one pre-pass', () => {
    // why: WP-283 / D-24063 — the choose-one pre-pass runs before the per-token loop and emits
    // ONE max-class-count-in-zone composition for the whole line; both [keyword:Empowered] tokens
    // are then suppressed by processedAsChooseOne=true. This test updated from the pre-WP-283
    // hollow expectation.
    const hook = empoweredHookFor(
      'Choose one: You get [keyword:Empowered] by [hc:strength], or you get [keyword:Empowered] by [hc:covert].',
    );
    assert.ok(hook.primitiveEffects !== undefined, 'the choose-one pre-pass emits a primitiveEffect');
    assert.equal(hook.primitiveEffects!.length, 1, 'exactly ONE primitiveEffect for the whole choose-one line');
    const amount = (hook.primitiveEffects![0] as { type: string; amount: { type: string; classes: unknown } }).amount;
    assert.equal(amount.type, 'max-class-count-in-zone', 'amount.type is max-class-count-in-zone');
    assert.ok(Array.isArray(amount.classes), 'amount.classes is an array');
    assert.deepStrictEqual(
      [...(amount.classes as string[])].sort(),
      ['covert', 'strength'],
      'amount.classes contains strength and covert',
    );
    assert.ok(
      !(hook.unresolvedMarkers ?? []).includes('empowered'),
      'empowered is NOT in unresolvedMarkers after the choose-one pre-pass resolves it',
    );
  });

  it('prefixed multi-class "[hc:tech]: ...Empowered by [hc:ranged] and [hc:strength]" → unresolved (and-continuation guard)', () => {
    const hook = empoweredHookFor('[hc:tech]: You get [keyword:Empowered] by [hc:ranged] and [hc:strength].');
    assert.equal(hook.primitiveEffects, undefined, 'an `and [hc:...]` continuation after the tail defers (gate #5)');
    assert.ok(
      (hook.unresolvedMarkers ?? []).includes('empowered'),
      'a multi-class Empowered stays a hollow even behind a valid class prefix',
    );
  });

  it('prefixed color-of-choice "[hc:strength]: ...Empowered by the color of your choice" → unresolved (anchored-tail miss)', () => {
    const hook = empoweredHookFor('[hc:strength]: You get [keyword:Empowered] by the color of your choice.');
    assert.equal(hook.primitiveEffects, undefined, 'no anchored `by [hc:Y]` tail → defer (gate #4)');
    assert.ok(
      (hook.unresolvedMarkers ?? []).includes('empowered'),
      'a color-of-choice Empowered stays a hollow',
    );
  });

  it('team-gated / non-class-leading-gate "[team:x-men]: ...Empowered by [hc:ranged]" → unresolved', () => {
    // why: the leading gate is [team:x-men]:, not [hc:X]: (gate #3 miss), and the line carries a
    // [team:...] token (gate #6) — either guard defers it. Doubles as the non-class-leading-gate case.
    const hook = empoweredHookFor('[team:x-men]: You get [keyword:Empowered] by [hc:ranged].');
    assert.equal(hook.primitiveEffects, undefined, 'a [team:...]-gated / non-[hc:X]:-leading Empowered defers');
    assert.ok(
      (hook.unresolvedMarkers ?? []).includes('empowered'),
      'a team-gated Empowered stays a hollow',
    );
  });

  it('regression: bare core "Empowered by [hc:strength]" (no prefix) still resolves via the unchanged core path', () => {
    const hook = empoweredHookFor('You get [keyword:Empowered] by [hc:strength].');
    assert.ok(hook.primitiveEffects !== undefined, 'the unconditional core form still resolves');
    // why: the bare core has NO leading [hc:X]: prefix, so the count param is its SOLE condition
    // and the core path clears all conditions — it is NOT the conditional-prefix path (no gate retained).
    assert.equal(hook.conditions, undefined, 'the sole-condition core path clears all conditions (unchanged)');
  });

  it('regression: one-hit-wonder corrected "Choose one: Draw a card, or ...Empowered by [hc:strength]" → draw-or-empowered (WP-286)', () => {
    // why: WP-286 / D-24069 fixed the "Chose"→"Choose" typo in the card data, which lets the line
    // clear the EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN gate; the draw-or-empowered pre-pass then claims
    // it ("Choose one:" + "Draw a card" + exactly one [keyword:Empowered] by [hc:X]) and suppresses
    // the core empowered path. The line now emits ONE draw-or-empowered effect carrying the parsed
    // class — NOT the WP-267 core count composition the typo'd text used to over-resolve to.
    const hook = empoweredHookFor('Choose one: Draw a card, or you get [keyword:Empowered] by [hc:strength].');
    assert.equal(hook.primitiveEffects, undefined, 'no core empowered composition — the pre-pass claimed the line');
    assert.deepStrictEqual(
      hook.effects,
      [{ type: 'draw-or-empowered', empoweredClass: 'strength' }],
      'one draw-or-empowered effect carrying the parsed empowered class',
    );
    assert.ok(!(hook.unresolvedMarkers ?? []).includes('empowered'), 'no empowered unresolved marker for the claimed line');
    assert.equal(hook.conditions, undefined, 'the [hc:strength] count param is suppressed → no conditions');
  });
});

// ---------------------------------------------------------------------------
// WP-286 — draw-or-empowered choose-one form (D-24069)
//
// One-Hit Wonder's printed "Choose one: Draw a card, or you get Empowered by [class]"
// is claimed by a dedicated pre-pass (prefix + "Draw a card" + exactly one Empowered
// marker) that emits a single draw-or-empowered effect carrying the empowered class and
// suppresses the core empowered path. The pre-pass is gated strictly so it never claims
// the WP-283 two-empowered choose-one (two markers) or the core empowered path (no prefix).
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks draw-or-empowered (WP-286 / D-24069)', () => {
  /** Builds a single-ability hook from one draw-or-empowered ability line. */
  function drawOrEmpoweredHookFor(abilityText: string) {
    const registry = makeHeroRegistry('core', 'draw-or-empowered-hero', [
      { slug: 'draw-or-empowered-card', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/draw-or-empowered-hero'] };
    const hooks = buildHeroAbilityHooks(registry, config);
    return hooks[0]!;
  }

  it('AC-3: corrected One-Hit Wonder text → one draw-or-empowered effect (empoweredClass strength), no core composition, no unresolved marker', () => {
    const hook = drawOrEmpoweredHookFor('Choose one: Draw a card, or you get [keyword:Empowered] by [hc:strength].');
    assert.deepStrictEqual(
      hook.effects,
      [{ type: 'draw-or-empowered', empoweredClass: 'strength' }],
      'exactly one draw-or-empowered effect carrying empoweredClass strength',
    );
    assert.equal(hook.primitiveEffects, undefined, 'no core empowered primitiveEffects entry for the claimed line');
    assert.ok(!(hook.unresolvedMarkers ?? []).includes('empowered'), 'no empowered unresolved marker');
    assert.ok((hook.keywords as string[]).includes('draw-or-empowered'), 'the draw-or-empowered keyword is on the hook');
    assert.ok(!(hook.keywords as string[]).includes('conditional'), 'the count param is suppressed → no conditional keyword');
  });

  it('AC-4 baseline pin: the synthetic core form "You get Empowered by [hc:strength]" still resolves to the core count composition, unchanged', () => {
    const hook = drawOrEmpoweredHookFor('You get [keyword:Empowered] by [hc:strength].');
    assert.ok(hook.primitiveEffects !== undefined, 'the core empowered form still resolves to a composition');
    assert.deepStrictEqual(
      hook.primitiveEffects![0],
      {
        type: 'gain-resource',
        resource: 'attack',
        amount: { type: 'count-cards-by-class-in-zone', heroClass: 'strength', zone: 'hq' },
      },
      'the core path is unchanged (count-cards-by-class-in-zone)',
    );
    assert.ok(!(hook.keywords as string[]).includes('draw-or-empowered'), 'the core form is not a draw-or-empowered effect');
  });

  it('AC-4 baseline pin: the WP-283 two-empowered choose-one (fight-or-flight) still resolves via the choose-one pre-pass, not draw-or-empowered', () => {
    const hook = drawOrEmpoweredHookFor(
      'Choose one: You get [keyword:Empowered] by [hc:strength], or you get [keyword:Empowered] by [hc:covert].',
    );
    assert.ok(hook.primitiveEffects !== undefined, 'the two-empowered choose-one still emits a primitiveEffect');
    const amount = (hook.primitiveEffects![0] as { amount: { type: string } }).amount;
    assert.equal(amount.type, 'max-class-count-in-zone', 'still the WP-283 oracle-max composition');
    assert.ok(
      !((hook.effects ?? []) as { type: string }[]).some((effect) => effect.type === 'draw-or-empowered'),
      'a two-empowered line is NOT claimed by the draw-or-empowered pre-pass (no draw option + two markers)',
    );
  });

  it('the typo\'d "Chose one" form is NOT claimed (the prefix gate misses) — falls through to the core path', () => {
    // why: documents WHY the typo was the bug — the pre-pass prefix gate requires "Choose one",
    // so the misspelled "Chose one" never reaches the draw-or-empowered path and the line silently
    // applies the core empowered default. The card-data fix (Chose→Choose) is load-bearing.
    const hook = drawOrEmpoweredHookFor('Chose one: Draw a card, or you get [keyword:Empowered] by [hc:strength].');
    assert.ok(
      !((hook.effects ?? []) as { type: string }[]).some((effect) => effect.type === 'draw-or-empowered'),
      'the typo\'d prefix is not claimed by the draw-or-empowered pre-pass',
    );
    assert.ok(hook.primitiveEffects !== undefined, 'the typo\'d line falls through to the core empowered composition');
  });
});

// ---------------------------------------------------------------------------
// WP-290 — Size-Changing class-grant parsing (D-24074)
//
// On a `[keyword:Size-Changing]` line the same-line `[hc:...]` tokens are the GRANTED
// classes the card gains when played (onto hook.sizeChangingClasses), NOT heroClassMatch
// play-conditions, and the recognized keyword emits no unresolved marker. An `[hc:X]` on a
// DIFFERENT ability line stays an ordinary condition; a Size-Changing line with no `[hc:X]`
// parses to no grant (recognized, no hollow, no throw).
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — Size-Changing class-grant (WP-290 / D-24074)', () => {
  /** Builds all hooks for a hero whose card carries the given ability line(s). */
  function sizeChangingHooksFor(abilities: string[]) {
    const registry = makeHeroRegistry('antm', 'size-changing-hero', [
      { slug: 'size-changing-card', rarityLabel: 'Common 1', abilities },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['antm/size-changing-hero'] };
    return buildHeroAbilityHooks(registry, config);
  }

  it('AC-2: "[keyword:Size-Changing] [hc:tech]" → sizeChangingClasses [tech], no heroClassMatch condition, no unresolved marker', () => {
    const hook = sizeChangingHooksFor(['[keyword:Size-Changing] [hc:tech]'])[0]!;
    assert.deepStrictEqual(hook.sizeChangingClasses, ['tech'], 'tech is the granted class');
    assert.ok((hook.keywords as string[]).includes('size-changing'), 'size-changing keyword is on the hook');
    const conditions = hook.conditions ?? [];
    assert.ok(
      !conditions.some((condition) => condition.type === 'heroClassMatch'),
      'the same-line [hc:tech] is the grant, NOT a heroClassMatch condition',
    );
    assert.ok(!(hook.keywords as string[]).includes('conditional'), 'no conditional keyword (the grant is not a condition)');
    assert.ok(!(hook.unresolvedMarkers ?? []).includes('size-changing'), 'no unresolved marker for the recognized keyword');
    assert.equal(hook.timing, 'onPlay', 'Size-Changing fires at onPlay (when you play this card)');
  });

  it('AC-2: extracts ALL same-line [hc:...] tokens (dual-class grant)', () => {
    const hook = sizeChangingHooksFor(['[keyword:Size-Changing] [hc:strength] [hc:tech]'])[0]!;
    assert.deepStrictEqual(hook.sizeChangingClasses, ['strength', 'tech'], 'both granted classes extracted in order');
  });

  it('AC-3 isolation: an [hc:X] on a DIFFERENT ability line stays an ordinary heroClassMatch condition', () => {
    // why: holographic-image-inducer-shaped two-liner — line 1 grants tech (Size-Changing);
    // line 2 is an ordinary class-gated draw whose [hc:strength] is a real condition.
    const hooks = sizeChangingHooksFor([
      '[keyword:Size-Changing] [hc:tech]',
      '[hc:strength]: Draw two cards. [keyword:draw:2]',
    ]);
    const grantHook = hooks.find((hook) => (hook.keywords as string[]).includes('size-changing'))!;
    const drawHook = hooks.find((hook) => (hook.keywords as string[]).includes('draw'))!;

    assert.deepStrictEqual(grantHook.sizeChangingClasses, ['tech'], 'line 1 grants tech');
    assert.equal(grantHook.conditions, undefined, 'the grant line carries no conditions');

    assert.equal(drawHook.sizeChangingClasses, undefined, 'the draw line carries no grant');
    assert.ok(
      (drawHook.conditions ?? []).some(
        (condition) => condition.type === 'heroClassMatch' && condition.value === 'strength',
      ),
      'line 2 [hc:strength] is an ordinary heroClassMatch condition',
    );
    // why: AC-4 — the second line still draws two cards (the real card behavior is preserved).
    assert.deepStrictEqual(drawHook.effects, [{ type: 'draw', magnitude: 2 }], 'line 2 still draws 2');
  });

  it('AC-3 graceful empty: a "[keyword:Size-Changing]" line with no [hc:X] → no grant, recognized, no unresolved marker', () => {
    const hook = sizeChangingHooksFor(['[keyword:Size-Changing] grants no class here.'])[0]!;
    assert.ok((hook.keywords as string[]).includes('size-changing'), 'keyword still recognized');
    assert.equal(hook.sizeChangingClasses, undefined, 'no grant assigned (empty list omitted)');
    assert.ok(!(hook.unresolvedMarkers ?? []).includes('size-changing'), 'no unresolved marker, no hollow');
  });
});

// ---------------------------------------------------------------------------
// WP-268 — resolvedMarkers: by-hook composition provenance (D-24045)
//
// The parser records a composition marker that RESOLVED (a primitive attached)
// onto hook.resolvedMarkers — the positive symmetric record of unresolvedMarkers.
// The mechanic ledger reads it to classify composition-marker status by-hook
// (per-card), so /coverage By-card stops over-claiming deferred-variant cards
// (resolves the WP-267 / D-24044 by-name limitation).
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — resolved composition markers (WP-268 / D-24045)', () => {
  /** Builds a single-ability hook from one composition-bearing ability line. */
  function resolvedMarkersHookFor(abilityText: string) {
    const registry = makeHeroRegistry('core', 'resolved-hero', [
      { slug: 'resolved-card', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['core/resolved-hero'] };
    const hooks = buildHeroAbilityHooks(registry, config);
    return hooks[0]!;
  }

  it('a resolved static composition (Berserk) records the marker on hook.resolvedMarkers', () => {
    const hook = resolvedMarkersHookFor('[keyword:Berserk]');
    assert.deepStrictEqual(hook.resolvedMarkers, ['berserk'], 'a resolved berserk is recorded by-hook');
    // why: D-24045 — a resolved marker is never simultaneously unresolved (the two records
    // are mutually exclusive per ability line — the Honest-Partial symmetry).
    assert.equal(hook.unresolvedMarkers, undefined, 'a resolved marker is never also unresolved');
  });

  it('a resolved Empowered core form records empowered on hook.resolvedMarkers', () => {
    const hook = resolvedMarkersHookFor('You get [keyword:Empowered] by [hc:strength].');
    assert.deepStrictEqual(hook.resolvedMarkers, ['empowered'], 'a resolved empowered core is recorded by-hook');
    assert.equal(hook.unresolvedMarkers, undefined, 'the resolved core records no unresolved marker');
  });

  it('a resolved conditional-prefix Empowered records empowered on resolvedMarkers, not unresolved (WP-272 / D-24047)', () => {
    // why: WP-272 / D-24047 — the conditional-prefix class-gated form now resolves by-hook, so
    // it carries empowered on resolvedMarkers (the executable-by-hook signal) and NOT on
    // unresolvedMarkers — the Honest-Partial symmetry, updated for the lifted deferral.
    const hook = resolvedMarkersHookFor('[hc:strength]: You get [keyword:Empowered] by [hc:tech].');
    assert.ok(
      (hook.resolvedMarkers ?? []).includes('empowered'),
      'a resolved conditional-prefix records empowered as resolved (executable by-hook)',
    );
    assert.equal(hook.unresolvedMarkers, undefined, 'a resolved conditional-prefix records no unresolved marker');
  });

  it('a resolved Empowered multi-class variant records empowered in resolvedMarkers and NOT unresolved (WP-310)', () => {
    // why: D-24045 — the unconditional multi-class form now resolves (WP-310 / D-24098), so it
    // carries the SAME by-hook provenance signal as the core / conditional-prefix paths: recorded
    // resolved, never flagged unresolved. (A PREFIX-GATED multi-class still stays hollow — the
    // Honest-Partial guard for that lives in the WP-272 describe block.)
    const hook = resolvedMarkersHookFor('You get [keyword:Empowered] by [hc:ranged] and [hc:strength].');
    assert.ok(
      (hook.resolvedMarkers ?? []).includes('empowered'),
      'a resolved multi-class records empowered as resolved (executable by-hook)',
    );
    assert.equal(hook.unresolvedMarkers, undefined, 'a resolved multi-class records no unresolved marker');
  });

  it('a non-composition keyword line records NO resolvedMarkers (absent)', () => {
    const hook = resolvedMarkersHookFor('[keyword:rescue] a Bystander.');
    // why: D-24045 — only the two composition-resolve branches push; legacy keywords
    // (rescue) carry their identity on hook.keywords, never on resolvedMarkers.
    assert.equal(hook.resolvedMarkers, undefined, 'only composition markers are recorded as resolved');
  });
});

describe('HERO_ABILITY_TIMINGS drift-detection', () => {
  // why: same pattern as HERO_KEYWORDS drift detection
  it('contains exactly the 6 canonical timing values', () => {
    const expectedTimings = [
      'onPlay',
      'onFight',
      'onRecruit',
      'onKO',
      'onReveal',
      'onDiscard', // why: WP-498 / D-24301 — the first reactive timing
    ];

    assert.equal(
      HERO_ABILITY_TIMINGS.length,
      6,
      'HERO_ABILITY_TIMINGS must have exactly 6 entries',
    );

    assert.deepStrictEqual(
      [...HERO_ABILITY_TIMINGS],
      expectedTimings,
      'HERO_ABILITY_TIMINGS must match the canonical timing values in order',
    );

    // Verify no duplicates
    const uniqueTimings = new Set(HERO_ABILITY_TIMINGS);
    assert.equal(
      uniqueTimings.size,
      HERO_ABILITY_TIMINGS.length,
      'HERO_ABILITY_TIMINGS must have no duplicates',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-179 — [team:X] markup parsing tests
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks [team:X] markup (WP-179)', () => {
  it('[team:avengers] markup produces requiresTeam condition with value avengers', () => {
    const registry = makeHeroRegistry('core', 'cap', [
      { slug: 'shield-bash', rarityLabel: 'Common 1', abilities: ['[team:avengers]: +2[icon:attack].'] },
    ]);
    const config: MatchSetupConfig = {
      ...createTestConfig(),
      heroDeckIds: ['core/cap'],
    };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined);
    assert.ok(hook.conditions !== undefined);

    let foundTeamCondition = false;
    for (const condition of hook.conditions!) {
      if (condition.type === 'requiresTeam') {
        assert.equal(condition.value, 'avengers');
        foundTeamCondition = true;
      }
    }
    assert.ok(foundTeamCondition, 'requiresTeam condition must be present');
  });

  it('mixed markup [hc:tech][team:avengers] emits both in stable order (heroClassMatch first)', () => {
    const registry = makeHeroRegistry('core', 'iron-man', [
      { slug: 'repulsor', rarityLabel: 'Common 1', abilities: ['[hc:tech][team:avengers]: Draw 2 cards.'] },
    ]);
    const config: MatchSetupConfig = {
      ...createTestConfig(),
      heroDeckIds: ['core/iron-man'],
    };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined);
    assert.ok(hook.conditions !== undefined);
    assert.equal(hook.conditions!.length, 2);
    assert.equal(hook.conditions![0]!.type, 'heroClassMatch');
    assert.equal(hook.conditions![0]!.value, 'tech');
    assert.equal(hook.conditions![1]!.type, 'requiresTeam');
    assert.equal(hook.conditions![1]!.value, 'avengers');
  });

  it('mixed-case parsing: [hc:Tech] normalizes to condition value tech', () => {
    const registry = makeHeroRegistry('core', 'hero-x', [
      { slug: 'tech-card', rarityLabel: 'Common 1', abilities: ['[hc:Tech]: You get +1[icon:attack].'] },
    ]);
    const config: MatchSetupConfig = {
      ...createTestConfig(),
      heroDeckIds: ['core/hero-x'],
    };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined);
    assert.ok(hook.conditions !== undefined);
    assert.equal(hook.conditions![0]!.value, 'tech');
  });

  it('whitespace parsing: [team: Avengers ] normalizes to condition value avengers', () => {
    const registry = makeHeroRegistry('core', 'cap', [
      { slug: 'shield-throw', rarityLabel: 'Common 1', abilities: ['[team: Avengers ]: +3 attack.'] },
    ]);
    const config: MatchSetupConfig = {
      ...createTestConfig(),
      heroDeckIds: ['core/cap'],
    };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined);
    assert.ok(hook.conditions !== undefined);
    assert.equal(hook.conditions![0]!.value, 'avengers');
  });

  it('team markup tokens are removed from ability text after extraction (conditional keyword added)', () => {
    const registry = makeHeroRegistry('core', 'cap', [
      { slug: 'rally', rarityLabel: 'Common 1', abilities: ['[team:avengers]: You get +2[icon:attack].'] },
    ]);
    const config: MatchSetupConfig = {
      ...createTestConfig(),
      heroDeckIds: ['core/cap'],
    };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined);
    let hasConditional = false;
    for (const keyword of hook.keywords) {
      if (keyword === 'conditional') {
        hasConditional = true;
      }
    }
    assert.ok(hasConditional, 'conditional keyword should be added when team conditions are present');
  });
});

// ---------------------------------------------------------------------------
// WP-257 — unresolved-marker surfacing (D-24034)
//
// The parser records a `[keyword:X]` token that resolves to no keyword,
// composition, or recognized modifier onto hook.unresolvedMarkers, so the
// runtime hollow detector can flag `parse-unrecognized` — while a pure
// flavor-text line (no marker token) surfaces an empty/absent field.
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — unresolved markers (WP-257)', () => {
  /** Builds a single-hero, single-ability registry + matching config. */
  function buildSingleAbility(abilityText: string) {
    const registry = makeHeroRegistry('core', 'spider-man', [
      { slug: 'astonishing-strength', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    const config = createTestConfig();
    return buildHeroAbilityHooks(registry, config);
  }

  it('surfaces an unrecognized [keyword:X] token on hook.unresolvedMarkers', () => {
    const hooks = buildSingleAbility('[keyword:mind-swap] a card.');
    assert.equal(hooks.length, 1);
    assert.deepStrictEqual(hooks[0]!.unresolvedMarkers, ['mind-swap']);
  });

  it('a pure flavor-text line surfaces NO unresolvedMarkers (absent or empty)', () => {
    const hooks = buildSingleAbility('Spider-Man swings into action.');
    assert.equal(hooks.length, 1);
    // why: absent field is the encoding for "no unresolved marker" — flavor text
    // must not flag hollow at runtime.
    assert.equal(hooks[0]!.unresolvedMarkers, undefined);
  });

  it('a recognized reveal-count modifier does NOT flag as an unresolved marker', () => {
    // why: `reveal-count` is a recognized modifier consumed by REVEAL_COUNT_PATTERN
    // but its bare-word form also matches KEYWORD_PATTERN; it must be excluded from
    // the unresolved-marker scan (RECOGNIZED_NON_KEYWORD_MARKERS).
    const hooks = buildSingleAbility('[keyword:reveal:always:draw][keyword:reveal-count:2]');
    assert.equal(hooks.length, 1);
    assert.equal(hooks[0]!.unresolvedMarkers, undefined, 'reveal-count is not unresolved');
  });

  it('a valid keyword does NOT flag as an unresolved marker', () => {
    const hooks = buildSingleAbility('[keyword:rescue] a Bystander.');
    assert.equal(hooks.length, 1);
    assert.equal(hooks[0]!.unresolvedMarkers, undefined, 'a valid keyword is not unresolved');
  });

  it('a composition marker (berserk) does NOT flag as an unresolved marker', () => {
    const hooks = buildSingleAbility('[keyword:berserk]');
    assert.equal(hooks.length, 1);
    assert.equal(hooks[0]!.unresolvedMarkers, undefined, 'a composition marker is not unresolved');
  });
});

describe('buildHeroAbilityHooks Wall-Crawl onRecruit keyword (WP-273 / D-24049)', () => {
  /** Builds a single-hero, single-ability registry + matching config. */
  function buildSingleAbility(abilityText: string) {
    const registry = makeHeroRegistry('core', 'spider-man', [
      { slug: 'astonishing-strength', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    return buildHeroAbilityHooks(registry, createTestConfig());
  }

  it('[keyword:Wall-Crawl] resolves to a recognized wall-crawl keyword on an onRecruit hook', () => {
    const hooks = buildSingleAbility('[keyword:Wall-Crawl]');
    assert.equal(hooks.length, 1);
    // why: D-24049 — the case-insensitive parse lands the printed "Wall-Crawl" marker
    // on a recognized `wall-crawl` keyword (not unresolvedMarkers) at onRecruit timing.
    assert.equal(hooks[0]!.timing, 'onRecruit', 'wall-crawl defaults to onRecruit timing');
    assert.deepStrictEqual(hooks[0]!.keywords, ['wall-crawl'], 'keyword is recognized');
  });

  it('the wall-crawl hook has NO unresolvedMarkers (the parse-unrecognized hollow is gone)', () => {
    const hooks = buildSingleAbility('[keyword:Wall-Crawl]');
    assert.equal(hooks.length, 1);
    assert.equal(
      hooks[0]!.unresolvedMarkers,
      undefined,
      'a recognized keyword does not surface as an unresolved marker',
    );
  });

  it('the wall-crawl hook auto-emits a no-magnitude { type: "wall-crawl" } effect descriptor', () => {
    const hooks = buildSingleAbility('[keyword:Wall-Crawl]');
    assert.equal(hooks.length, 1);
    // why: D-24049 — [keyword:Wall-Crawl] carries no :N magnitude, so the parser emits a
    // bare descriptor; executeSingleEffect no-ops on the missing magnitude at play time.
    assert.deepStrictEqual(hooks[0]!.effects, [{ type: 'wall-crawl' }]);
  });

  it('an explicit [timing:onPlay] marker still overrides the wall-crawl onRecruit default', () => {
    const hooks = buildSingleAbility('[keyword:Wall-Crawl][timing:onPlay]');
    assert.equal(hooks.length, 1);
    // why: D-24049 — KEYWORD_TIMING_DEFAULTS sets the default; an explicit [timing:X]
    // marker is applied afterward and wins.
    assert.equal(hooks[0]!.timing, 'onPlay', 'explicit timing markup overrides the keyword default');
  });
});

describe('buildHeroAbilityHooks Dodge keyword (WP-275 / D-24051)', () => {
  /** Builds a single-hero, single-ability registry + matching config. */
  function buildSingleAbility(abilityText: string) {
    const registry = makeHeroRegistry('core', 'spider-man', [
      { slug: 'astonishing-strength', rarityLabel: 'Common 1', abilities: [abilityText] },
    ]);
    return buildHeroAbilityHooks(registry, createTestConfig());
  }

  it('[keyword:Dodge] resolves to a recognized dodge keyword on an onPlay hook', () => {
    const hooks = buildSingleAbility('[keyword:Dodge]');
    assert.equal(hooks.length, 1);
    // why: D-24051 — the case-insensitive parse lands the printed "Dodge" marker on a
    // recognized `dodge` keyword (not unresolvedMarkers) at the default onPlay timing
    // (dodge is NOT in KEYWORD_TIMING_DEFAULTS; it fires from the dodgeCard move).
    assert.equal(hooks[0]!.timing, 'onPlay', 'dodge keeps the default onPlay timing');
    assert.deepStrictEqual(hooks[0]!.keywords, ['dodge'], 'keyword is recognized');
  });

  it('the dodge hook has NO unresolvedMarkers (the parse-unrecognized hollow is gone)', () => {
    const hooks = buildSingleAbility('[keyword:Dodge]');
    assert.equal(hooks.length, 1);
    assert.equal(
      hooks[0]!.unresolvedMarkers,
      undefined,
      'a recognized keyword does not surface as an unresolved marker',
    );
  });

  it('the dodge hook auto-emits a no-magnitude { type: "dodge" } effect descriptor', () => {
    const hooks = buildSingleAbility('[keyword:Dodge]');
    assert.equal(hooks.length, 1);
    // why: D-24051 — [keyword:Dodge] carries no :N magnitude, so the parser emits a bare
    // descriptor; executeSingleEffect no-ops on the missing magnitude at play time.
    assert.deepStrictEqual(hooks[0]!.effects, [{ type: 'dodge' }]);
  });

  it('an entangled dodge + unleash + undercover rider line records dodge and undercover as keywords and unleash as an unresolved marker', () => {
    // why: D-24051 honest-partial + D-24060 (WP-282) — the Twilight Ops rider line declares
    // dodge (D-24051) and undercover (D-24060, now recognized) plus still-unsupported
    // unleash. dodge and undercover each become a keyword + a bare effect descriptor; only
    // unleash surfaces as an unresolvedMarker. The mixed hook is NOT hollow at runtime (≥1
    // reachable mechanic), and the remaining unleash gap is preserved here.
    const hooks = buildSingleAbility(
      'When you [keyword:Dodge] with this card, you may [keyword:Unleash] one of your Heroes from [keyword:Undercover].',
    );
    assert.equal(hooks.length, 1);
    assert.deepStrictEqual(
      hooks[0]!.keywords,
      ['dodge', 'undercover'],
      'dodge and undercover are recognized keywords',
    );
    assert.deepStrictEqual(
      hooks[0]!.effects,
      [{ type: 'dodge' }, { type: 'undercover' }],
      'a bare dodge effect and a bare undercover effect are emitted',
    );
    assert.deepStrictEqual(
      hooks[0]!.unresolvedMarkers,
      ['unleash'],
      'only unleash stays unresolved (not implemented by this WP)',
    );
  });
});

// ---------------------------------------------------------------------------
// WP-280 — Spectrum: ≥3-class conditional keyword (D-24055)
//
// [keyword:Spectrum] (and case-insensitive variants) parses to a
// distinctHeroClassesAtLeast condition (not a keyword, not an
// unresolvedMarker). The Spectrum gate is a condition that gates
// the printed effects so they act only with ≥3 distinct hero classes.
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks Spectrum conditional keyword (WP-280 / D-24055)', () => {
  /** Builds a single-hero, single-ability registry + matching config. */
  function buildSingleAbility(abilityText: string) {
    const registry = makeHeroRegistry('core', 'spider-man', [
      { slug: 'spectrum-test', rarityLabel: 'Common', abilities: [abilityText] },
    ]);
    const config = createTestConfig();
    return buildHeroAbilityHooks(registry, config);
  }

  it('[keyword:Spectrum] parses to distinctHeroClassesAtLeast condition (case-insensitive)', () => {
    const hooks = buildSingleAbility('[keyword:Spectrum]: Draw a card. [keyword:draw:1]');
    assert.equal(hooks.length, 1);
    const hook = hooks[0];
    assert.ok(hook !== undefined);

    // Spectrum is a condition, not a keyword
    assert.ok(hook.keywords !== undefined, 'keywords should be defined');
    assert(!hook.keywords.includes('spectrum'), 'spectrum should NOT be in keywords');
    // The 'conditional' keyword is added because conditions are present
    assert(hook.keywords.includes('conditional'), 'conditional keyword added when conditions present');
    assert(hook.keywords.includes('draw'), 'draw keyword added from effect markup');

    // The condition is distinctHeroClassesAtLeast with value 3
    assert.ok(hook.conditions !== undefined, 'conditions should be defined');
    assert.equal(hook.conditions.length, 1, 'one condition should be present');
    const condition = hook.conditions[0];
    assert.ok(condition !== undefined);
    assert.equal(condition.type, 'distinctHeroClassesAtLeast',
      'condition type is distinctHeroClassesAtLeast');
    assert.equal(condition.value, '3',
      'condition value is "3" (the rulebook threshold)');

    // No unresolvedMarkers — Spectrum is recognized
    // If unresolvedMarkers is defined, it should not contain 'spectrum'
    if (hook.unresolvedMarkers !== undefined && hook.unresolvedMarkers.length > 0) {
      assert(!hook.unresolvedMarkers.includes('spectrum'),
        'spectrum should NOT be in unresolvedMarkers');
    }
    // If unresolvedMarkers is undefined or empty, that's also correct (no unresolved markers)
  });

  it('[keyword:spectrum] lowercase parses identically to uppercase', () => {
    const hooksUpper = buildSingleAbility('[keyword:Spectrum]: Draw a card. [keyword:draw:1]');
    const hooksLower = buildSingleAbility('[keyword:spectrum]: Draw a card. [keyword:draw:1]');

    assert.equal(hooksUpper.length, 1);
    assert.equal(hooksLower.length, 1);
    const hookUpper = hooksUpper[0];
    const hookLower = hooksLower[0];
    assert.ok(hookUpper !== undefined);
    assert.ok(hookLower !== undefined);

    assert.deepStrictEqual(hookUpper.conditions, hookLower.conditions,
      'uppercase and lowercase Spectrum parse to identical conditions');
    // lowercase spectrum is recognized (not an unresolvedMarker)
    if (hookLower.unresolvedMarkers !== undefined && hookLower.unresolvedMarkers.length > 0) {
      assert(!hookLower.unresolvedMarkers.includes('spectrum'),
        'lowercase spectrum is also recognized (not marked unresolved)');
    }
  });

  it('Spectrum condition coexists with other conditions (e.g. heroClassMatch)', () => {
    const hooks = buildSingleAbility(
      '[hc:tech] [keyword:Spectrum]: If you have a Scientist, draw a card. [keyword:draw:1]',
    );
    assert.equal(hooks.length, 1);
    const hook = hooks[0];
    assert.ok(hook !== undefined);
    assert.ok(hook.conditions !== undefined);

    // Two conditions: heroClassMatch (tech) + distinctHeroClassesAtLeast
    assert.equal(hook.conditions.length, 2, 'two conditions present (heroClassMatch + Spectrum)');
    const heroClassCond = hook.conditions[0];
    const spectrumCond = hook.conditions[1];
    assert.ok(heroClassCond !== undefined);
    assert.ok(spectrumCond !== undefined);

    assert.equal(heroClassCond.type, 'heroClassMatch');
    assert.equal(heroClassCond.value, 'tech');
    assert.equal(spectrumCond.type, 'distinctHeroClassesAtLeast');
    assert.equal(spectrumCond.value, '3');

    // Both conditions are AND-gated by the 'conditional' keyword
    assert.ok(hook.keywords !== undefined);
    assert(hook.keywords.includes('conditional'), 'conditional keyword for AND logic');
  });

  it('No unresolvedMarker for Spectrum even without effect markup', () => {
    // Spectrum alone, no effect markup — a bare condition gate
    const hooks = buildSingleAbility('[keyword:Spectrum]: Something incredible.');
    assert.equal(hooks.length, 1);
    const hook = hooks[0];
    assert.ok(hook !== undefined);
    assert.ok(hook.conditions !== undefined);

    assert.equal(hook.conditions.length, 1);
    const condition = hook.conditions[0];
    assert.ok(condition !== undefined);
    assert.equal(condition.type, 'distinctHeroClassesAtLeast');
    // Spectrum is recognized as a condition, never marked unresolved
    if (hook.unresolvedMarkers !== undefined && hook.unresolvedMarkers.length > 0) {
      assert(!hook.unresolvedMarkers.includes('spectrum'),
        'Spectrum should not be in unresolvedMarkers');
    }
  });
});

// ---------------------------------------------------------------------------
// WP-356 — shuffle-discard-empty-reward parse (D-24148)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks shuffle-discard-empty-reward (WP-356)', () => {
  it('marked Reprocess line yields exactly one recruit-variant effect', () => {
    // why: the parser must emit exactly { type:'shuffle-discard-empty-reward',
    // magnitude:2, rewardType:'recruit' } from the three-segment token; the
    // icon-adjacent "+2[icon:recruit]" fills the magnitudes map only and must
    // not emit a bare recruit effect.
    const registry = makeHeroRegistry('antm', 'jocasta', [
      {
        slug: 'reprocess',
        rarityLabel: 'Common 2',
        abilities: [
          'If your discard pile is empty, you get +2[icon:recruit]. Otherwise, shuffle your discard pile into your deck. [keyword:shuffle-discard-empty-reward:recruit:2]',
        ],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['antm/jocasta'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(
      hook.keywords.includes('shuffle-discard-empty-reward'),
      'the shuffle-discard-empty-reward keyword must be present',
    );
    assert.ok(Array.isArray(hook.effects), 'effects must be present');
    assert.equal(hook.effects!.length, 1, 'exactly one effect must be emitted');
    assert.deepStrictEqual(
      hook.effects![0],
      { type: 'shuffle-discard-empty-reward', magnitude: 2, rewardType: 'recruit' },
      'the single effect must carry rewardType recruit and magnitude 2',
    );
  });

  it('marked Electromagnetic Eyebeams line yields the attack variant', () => {
    const registry = makeHeroRegistry('antm', 'jocasta', [
      {
        slug: 'electromagnetic-eyebeams',
        rarityLabel: 'Common 2',
        abilities: [
          'If your discard pile is empty, you get +2[icon:attack]. Otherwise shuffle your discard pile into your deck. [keyword:shuffle-discard-empty-reward:attack:2]',
        ],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['antm/jocasta'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    // why: the icon-suppression must subsume the printed "+2[icon:attack]" —
    // exactly one (conditional) effect, never a flat unconditional grant.
    assert.equal((hook.effects ?? []).length, 1, 'exactly one effect must be emitted');
    const shuffleEffect = (hook.effects ?? []).find(
      (effect) => effect.type === 'shuffle-discard-empty-reward',
    );
    assert.deepStrictEqual(
      shuffleEffect,
      { type: 'shuffle-discard-empty-reward', magnitude: 2, rewardType: 'attack' },
      'the effect must carry rewardType attack and magnitude 2',
    );
  });

  it('ignores a token with an unseeded reward (no keyword, no effect)', () => {
    // why: only recruit and attack are seeded for this keyword (D-24148) —
    // narrower than the optional-KO set; rescue must NOT pass the gate here.
    const registry = makeHeroRegistry('antm', 'jocasta', [
      {
        slug: 'reprocess',
        rarityLabel: 'Common 2',
        abilities: ['Shuffle text. [keyword:shuffle-discard-empty-reward:rescue:2]'],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['antm/jocasta'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.ok(
      !hook.keywords.includes('shuffle-discard-empty-reward'),
      'an unseeded reward must not emit the keyword',
    );
    assert.equal((hook.effects ?? []).length, 0, 'no effect is emitted for an unseeded reward');
  });

  it('ignores a token with a zero magnitude (no effect)', () => {
    const registry = makeHeroRegistry('antm', 'jocasta', [
      {
        slug: 'reprocess',
        rarityLabel: 'Common 2',
        abilities: ['Shuffle text. [keyword:shuffle-discard-empty-reward:recruit:0]'],
      },
    ]);
    const config: MatchSetupConfig = { ...createTestConfig(), heroDeckIds: ['antm/jocasta'] };

    const hooks = buildHeroAbilityHooks(registry, config);
    const hook = hooks[0];
    assert.ok(hook !== undefined, 'hook must be built');
    assert.equal(
      (hook.effects ?? []).length,
      0,
      'a zero-magnitude token must not emit an effect',
    );
  });
});
