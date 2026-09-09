/**
 * Setup-parser tests for the WP-283 Empowered oracle-max paths (D-24063 / D-24064).
 *
 * Covers: free-choice form (amulet-of-avalon — "by the color of your choice") resolves
 * to a max-class-count-in-zone(all) primitiveEffect with no empowered unresolvedMarker;
 * choose-one form (fight-or-flight — "Choose one: ... by [hc:X], or ... by [hc:Y]") resolves
 * to exactly ONE max-class-count-in-zone([X,Y]) primitiveEffect with no empowered
 * unresolvedMarker; the existing core form and conditional-prefix form are unaffected
 * (Honest-Partial regression guard per D-24030).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from './heroAbility.setup.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// ---------------------------------------------------------------------------
// Mock registry — getSet-based, same shape buildHeroAbilityHooks reads.
// ---------------------------------------------------------------------------

interface MockHeroCard {
  slug: string;
  rarityLabel?: string;
  abilities: string[];
}

/** Builds a minimal getSet registry with one hero whose cards carry the supplied abilities. */
function makeRegistry(setAbbr: string, heroSlug: string, cards: MockHeroCard[]) {
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

/** A valid mock MatchSetupConfig selecting one hero deck. */
function makeConfig(heroDeckId: string): MatchSetupConfig {
  return {
    schemeId: 'test/test-scheme',
    mastermindId: 'test/test-mastermind',
    villainGroupIds: ['test/villain-001'],
    henchmanGroupIds: ['test/henchman-001'],
    heroDeckIds: [heroDeckId],
    bystandersCount: 10,
    woundsCount: 15,
    officersCount: 20,
    sidekicksCount: 5,
  };
}

// ---------------------------------------------------------------------------
// Free-choice form: "by the color of your choice" — amulet-of-avalon
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — free-choice Empowered (amulet-of-avalon)', () => {
  const AMULET_ABILITY = 'You get [keyword:Empowered] by the color of your choice.';

  it('resolves to a primitiveEffect with max-class-count-in-zone and classes: all', () => {
    const registry = makeRegistry('antm', 'black-knight', [
      { slug: 'amulet-of-avalon', abilities: [AMULET_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('antm/black-knight'));

    assert.ok(hooks.length > 0, 'at least one hook is built');
    const amuletHook = hooks.find((hook) =>
      Array.isArray(hook.primitiveEffects) && hook.primitiveEffects.length > 0,
    );
    assert.ok(amuletHook !== undefined, 'a hook with primitiveEffects exists');

    const effect = amuletHook!.primitiveEffects![0]!;
    assert.equal(effect.type, 'gain-resource', 'primitiveEffect is a gain-resource node');
    assert.equal(
      (effect as { type: string; amount: { type: string } }).amount.type,
      'max-class-count-in-zone',
      'amount.type is max-class-count-in-zone',
    );
    assert.equal(
      (effect as { type: string; amount: { classes: unknown } }).amount.classes,
      'all',
      'amount.classes is the literal string "all" (free-choice)',
    );
  });

  it('does not add empowered to unresolvedMarkers', () => {
    const registry = makeRegistry('antm', 'black-knight', [
      { slug: 'amulet-of-avalon', abilities: [AMULET_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('antm/black-knight'));

    for (const hook of hooks) {
      const unresolvedMarkers = hook.unresolvedMarkers ?? [];
      assert.ok(
        !unresolvedMarkers.includes('empowered'),
        `no hook should have empowered in unresolvedMarkers; found in hook for card ${hook.cardId}`,
      );
    }
  });

  it('records empowered in resolvedMarkers', () => {
    const registry = makeRegistry('antm', 'black-knight', [
      { slug: 'amulet-of-avalon', abilities: [AMULET_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('antm/black-knight'));

    const resolvedHook = hooks.find((hook) =>
      Array.isArray(hook.resolvedMarkers) && hook.resolvedMarkers.includes('empowered'),
    );
    assert.ok(resolvedHook !== undefined, 'empowered is in resolvedMarkers for the amulet hook');
  });
});

// ---------------------------------------------------------------------------
// Choose-one form: "Choose one: ... by [hc:X], or ... by [hc:Y]" — fight-or-flight
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — choose-one Empowered (fight-or-flight)', () => {
  const FIGHT_OR_FLIGHT_ABILITY =
    'Choose one: You get [keyword:Empowered] by [hc:strength], or you get [keyword:Empowered] by [hc:covert].';

  it('resolves to exactly ONE primitiveEffect with the two enumerated classes', () => {
    const registry = makeRegistry('wtif', 'star-lord-tchalla', [
      { slug: 'fight-or-flight', abilities: [FIGHT_OR_FLIGHT_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wtif/star-lord-tchalla'));

    assert.ok(hooks.length > 0, 'at least one hook is built');
    const fightHook = hooks.find((hook) =>
      Array.isArray(hook.primitiveEffects) && hook.primitiveEffects.length > 0,
    );
    assert.ok(fightHook !== undefined, 'a hook with primitiveEffects exists');

    // Must have exactly ONE primitiveEffect (not two — one per marker).
    assert.equal(fightHook!.primitiveEffects!.length, 1, 'exactly ONE primitiveEffect for the whole choose-one line');

    const effect = fightHook!.primitiveEffects![0]!;
    assert.equal(effect.type, 'gain-resource', 'primitiveEffect is a gain-resource node');

    const amount = (effect as { type: string; amount: { type: string; classes: unknown } }).amount;
    assert.equal(amount.type, 'max-class-count-in-zone', 'amount.type is max-class-count-in-zone');
    assert.ok(Array.isArray(amount.classes), 'amount.classes is an array');
    assert.deepStrictEqual(
      [...(amount.classes as string[])].sort(),
      ['covert', 'strength'],
      'amount.classes contains strength and covert',
    );
  });

  it('does not add empowered to unresolvedMarkers', () => {
    const registry = makeRegistry('wtif', 'star-lord-tchalla', [
      { slug: 'fight-or-flight', abilities: [FIGHT_OR_FLIGHT_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wtif/star-lord-tchalla'));

    for (const hook of hooks) {
      const unresolvedMarkers = hook.unresolvedMarkers ?? [];
      assert.ok(
        !unresolvedMarkers.includes('empowered'),
        `no hook should have empowered in unresolvedMarkers; found in hook for card ${hook.cardId}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Dynamic form: "by the Hero Classes of the card you revealed this way" — cross-the-multiverse
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — dynamic Empowered (cross-the-multiverse, WP-284 / D-24065)', () => {
  const CROSS_ABILITY =
    '[keyword:What If...?]: You get [keyword:Empowered] by the Hero Classes of the card you revealed this way.';

  it('resolves to a primitiveEffect with top-deck-card-class-count-in-zone (AC-4)', () => {
    const registry = makeRegistry('wtif', 'star-lord-tchalla', [
      { slug: 'cross-the-multiverse', abilities: [CROSS_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wtif/star-lord-tchalla'));

    assert.ok(hooks.length > 0, 'at least one hook is built');
    const crossHook = hooks.find((hook) =>
      Array.isArray(hook.primitiveEffects) && hook.primitiveEffects.length > 0,
    );
    assert.ok(crossHook !== undefined, 'a hook with primitiveEffects exists');

    const effect = crossHook!.primitiveEffects![0]!;
    assert.equal(effect.type, 'gain-resource', 'primitiveEffect is a gain-resource node');
    assert.equal(
      (effect as { type: string; amount: { type: string } }).amount.type,
      'top-deck-card-class-count-in-zone',
      'amount.type is top-deck-card-class-count-in-zone (AC-4)',
    );
    assert.equal(
      (effect as { type: string; amount: { zone: string } }).amount.zone,
      'hq',
      'amount.zone is hq',
    );
  });

  it('does not add empowered to unresolvedMarkers (AC-4)', () => {
    const registry = makeRegistry('wtif', 'star-lord-tchalla', [
      { slug: 'cross-the-multiverse', abilities: [CROSS_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wtif/star-lord-tchalla'));

    for (const hook of hooks) {
      const unresolvedMarkers = hook.unresolvedMarkers ?? [];
      assert.ok(
        !unresolvedMarkers.includes('empowered'),
        `no hook should have empowered in unresolvedMarkers; found in hook for card ${hook.cardId}`,
      );
    }
  });

  it('records empowered in resolvedMarkers', () => {
    const registry = makeRegistry('wtif', 'star-lord-tchalla', [
      { slug: 'cross-the-multiverse', abilities: [CROSS_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wtif/star-lord-tchalla'));

    const resolvedHook = hooks.find((hook) =>
      Array.isArray(hook.resolvedMarkers) && hook.resolvedMarkers.includes('empowered'),
    );
    assert.ok(resolvedHook !== undefined, 'empowered is in resolvedMarkers for the cross hook');
  });
});

// ---------------------------------------------------------------------------
// Negative fixtures: dynamic resolver does NOT fire on existing empowered forms (AC-8 / AC-11)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — tryResolveEmpoweredDynamic negative fixtures (AC-11)', () => {
  it('core form still uses count-cards-by-class-in-zone, not top-deck-card-class-count-in-zone', () => {
    const registry = makeRegistry('test', 'hero-a', [
      { slug: 'core-card', abilities: ['You get [keyword:Empowered] by [hc:strength].'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('test/hero-a'));
    const coreHook = hooks.find((hook) =>
      Array.isArray(hook.primitiveEffects) && hook.primitiveEffects.length > 0,
    );
    assert.ok(coreHook !== undefined, 'core form builds a hook');
    assert.equal(
      (coreHook!.primitiveEffects![0]! as { type: string; amount: { type: string } }).amount.type,
      'count-cards-by-class-in-zone',
      'core form uses count-cards-by-class-in-zone (not dynamic)',
    );
  });

  it('free-choice form still uses max-class-count-in-zone, not top-deck-card-class-count-in-zone', () => {
    const registry = makeRegistry('antm', 'hero-b', [
      { slug: 'free-card', abilities: ['You get [keyword:Empowered] by the color of your choice.'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('antm/hero-b'));
    const freeHook = hooks.find((hook) =>
      Array.isArray(hook.primitiveEffects) && hook.primitiveEffects.length > 0,
    );
    assert.ok(freeHook !== undefined, 'free-choice form builds a hook');
    assert.equal(
      (freeHook!.primitiveEffects![0]! as { type: string; amount: { type: string } }).amount.type,
      'max-class-count-in-zone',
      'free-choice form uses max-class-count-in-zone (not dynamic)',
    );
  });

  it('choose-one form still uses max-class-count-in-zone, not top-deck-card-class-count-in-zone', () => {
    const registry = makeRegistry('wtif', 'hero-c', [
      {
        slug: 'choose-card',
        abilities: [
          'Choose one: You get [keyword:Empowered] by [hc:strength], or you get [keyword:Empowered] by [hc:covert].',
        ],
      },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wtif/hero-c'));
    const chooseHook = hooks.find((hook) =>
      Array.isArray(hook.primitiveEffects) && hook.primitiveEffects.length > 0,
    );
    assert.ok(chooseHook !== undefined, 'choose-one form builds a hook');
    assert.equal(
      (chooseHook!.primitiveEffects![0]! as { type: string; amount: { type: string } }).amount.type,
      'max-class-count-in-zone',
      'choose-one form uses max-class-count-in-zone (not dynamic)',
    );
  });

  it('conditional-prefix form still uses count-cards-by-class-in-zone, not dynamic', () => {
    const registry = makeRegistry('test', 'hero-d', [
      {
        slug: 'conditional-card',
        abilities: ['[hc:strength]: You get [keyword:Empowered] by [hc:tech].'],
      },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('test/hero-d'));
    const condHook = hooks.find((hook) =>
      Array.isArray(hook.primitiveEffects) && hook.primitiveEffects.length > 0,
    );
    assert.ok(condHook !== undefined, 'conditional-prefix form builds a hook');
    assert.equal(
      (condHook!.primitiveEffects![0]! as { type: string; amount: { type: string } }).amount.type,
      'count-cards-by-class-in-zone',
      'conditional-prefix form uses count-cards-by-class-in-zone (not dynamic)',
    );
  });
});

// ---------------------------------------------------------------------------
// Regression: core Empowered form still resolves (Honest-Partial Invariant, AC-7)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — core Empowered form regression (D-24030 / AC-7)', () => {
  const CORE_ABILITY = 'You get [keyword:Empowered] by [hc:strength].';

  it('core form still resolves to count-cards-by-class-in-zone (unchanged behavior)', () => {
    const registry = makeRegistry('test', 'one-hit-wonder', [
      { slug: 'power-card', abilities: [CORE_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('test/one-hit-wonder'));

    const coreHook = hooks.find((hook) =>
      Array.isArray(hook.primitiveEffects) && hook.primitiveEffects.length > 0,
    );
    assert.ok(coreHook !== undefined, 'core form still builds a primitiveEffects hook');

    const amount = (coreHook!.primitiveEffects![0]! as {
      type: string;
      amount: { type: string; heroClass?: string };
    }).amount;
    assert.equal(
      amount.type,
      'count-cards-by-class-in-zone',
      'core form uses count-cards-by-class-in-zone (not max-class-count-in-zone)',
    );
    assert.equal(amount.heroClass, 'strength', 'core form has the parsed heroClass');

    const unresolvedMarkers = coreHook!.unresolvedMarkers ?? [];
    assert.ok(!unresolvedMarkers.includes('empowered'), 'core form has no empowered unresolvedMarker');
  });
});

// ---------------------------------------------------------------------------
// gain-wound-self / gain-wound-each — plain "gain a Wound" family (WP-364 / D-24156)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — gain-wound-self / gain-wound-each (WP-364 / D-24156)', () => {
  it('parses [keyword:gain-wound-each] to a { type: "gain-wound-each" } effect (no magnitude)', () => {
    const registry = makeRegistry('core', 'hulk', [
      { slug: 'crazed-rampage', abilities: ['Each player gains a Wound. [keyword:gain-wound-each]'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('core/hulk'));
    const effect = hooks.flatMap((hook) => hook.effects ?? []).find((entry) => entry.type === 'gain-wound-each');
    assert.ok(effect !== undefined, 'a gain-wound-each effect is emitted');
    assert.equal(effect!.magnitude, undefined, 'single-segment keyword carries no magnitude');
  });

  it('parses [keyword:gain-wound-self] to a { type: "gain-wound-self" } effect', () => {
    const registry = makeRegistry('ff04', 'human-torch', [
      { slug: 'hothead', abilities: ['You gain a Wound. [keyword:gain-wound-self]'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('ff04/human-torch'));
    const effect = hooks.flatMap((hook) => hook.effects ?? []).find((entry) => entry.type === 'gain-wound-self');
    assert.ok(effect !== undefined, 'a gain-wound-self effect is emitted');
  });

  it('does not leak the gain-wound marker into unresolvedMarkers or other keywords', () => {
    const registry = makeRegistry('core', 'hulk', [
      { slug: 'crazed-rampage', abilities: ['Each player gains a Wound. [keyword:gain-wound-each]'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('core/hulk'));
    const allUnresolved = hooks.flatMap((hook) => hook.unresolvedMarkers ?? []);
    assert.ok(!allUnresolved.includes('gain-wound-each'), 'gain-wound-each is resolved, not an unresolved marker');
  });
});

// ---------------------------------------------------------------------------
// Copy Powers — the descriptive [hc:covert] is NOT a play gate (WP-535 fix-forward)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — copy-powers descriptive [hc:X] is not a condition', () => {
  // why: Rogue's Copy Powers text carries a MID-SENTENCE [hc:covert] ("This card is both
  // [hc:covert] and the color you copy") that describes what the card BECOMES, not a play
  // gate. The generic Step-1a [hc:X] extraction would wrongly emit a heroClassMatch:covert
  // condition, gating the copy behind "another covert card played this turn" — the live bug
  // observed in Jeff's Secret Invasion game. On a copy-powers line the [hc:X] must be
  // suppressed (mirroring the size-changing exclusion), so the copy always fires.
  const COPY_POWERS_ABILITY =
    'Play this card as a copy of another Hero you played this turn. This card is both [hc:covert] and the color you copy. [keyword:copy-powers]';

  it('builds the copy-powers hook with NO heroClassMatch condition', () => {
    const registry = makeRegistry('core', 'rogue', [
      { slug: 'copy-powers', abilities: [COPY_POWERS_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('core/rogue'));
    const copyHook = hooks.find((hook) => (hook.keywords ?? []).includes('copy-powers'));
    assert.ok(copyHook !== undefined, 'the copy-powers hook is built');
    const classConditions = (copyHook!.conditions ?? []).filter(
      (condition) => condition.type === 'heroClassMatch',
    );
    assert.equal(
      classConditions.length,
      0,
      'Copy Powers must not be gated by a hero-class condition — the [hc:covert] in its text is descriptive, not a play gate',
    );
  });
});

// ---------------------------------------------------------------------------
// recruit-threshold marker → recruitMadeThisTurnAtLeast condition
// (WP-545 / D-24354 — Thor Surge of Power). Mirrors the D-24055 Spectrum
// marker→condition precedent: a [keyword:…] token that pushes a game-state
// CONDITION onto the same hook that carries the line's printed effects.
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — recruit-threshold marker → condition (Surge of Power)', () => {
  const SURGE_ABILITY =
    'If you made 8 or more [icon:recruit] this turn, you get +3[icon:attack]. [keyword:recruit-threshold:8]';

  it('attaches a recruitMadeThisTurnAtLeast:8 condition to Surge\'s +3 attack hook', () => {
    const registry = makeRegistry('core', 'thor', [
      { slug: 'surge-of-power', abilities: [SURGE_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('core/thor'));

    const surgeHook = hooks.find((hook) =>
      (hook.effects ?? []).some((effect) => effect.type === 'attack' && effect.magnitude === 3),
    );
    assert.ok(surgeHook !== undefined, 'the Surge of Power hook carrying the +3 attack effect is built');

    const recruitConditions = (surgeHook!.conditions ?? []).filter(
      (condition) => condition.type === 'recruitMadeThisTurnAtLeast',
    );
    assert.equal(recruitConditions.length, 1,
      'exactly one recruitMadeThisTurnAtLeast condition is attached to the same hook as the +3 attack');
    assert.equal(recruitConditions[0]!.value, '8',
      'the parsed threshold is 8 (from [keyword:recruit-threshold:8])');
  });

  it('records NO unresolved marker for the recruit-threshold token (registered, never a parse-unrecognized hollow)', () => {
    const registry = makeRegistry('core', 'thor', [
      { slug: 'surge-of-power', abilities: [SURGE_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('core/thor'));

    const surgeHook = hooks.find((hook) =>
      (hook.effects ?? []).some((effect) => effect.type === 'attack' && effect.magnitude === 3),
    );
    assert.ok(surgeHook !== undefined, 'the Surge of Power hook is built');
    const unresolved = surgeHook!.unresolvedMarkers ?? [];
    assert.ok(
      !unresolved.includes('recruit-threshold'),
      'recruit-threshold must be recognized before the unresolved-marker fallback (no parse-unrecognized hollow)',
    );
  });
});

// ---------------------------------------------------------------------------
// smash marker → smash keyword + magnitude (WP-676 / D-24492). The [keyword:smash:N]
// token parses to a smash effect carrying the +N Attack magnitude; two separate
// abilities[] entries yield two hooks (Hurl Trucks); a bare magnitude-less
// [keyword:Smash] verb parses to a magnitude-less smash effect (safe-skips downstream).
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — smash marker (WP-676 / D-24492)', () => {
  it('parses [keyword:smash:4] into a smash effect carrying magnitude 4', () => {
    const registry = makeRegistry('wwhk', 'bruce-banner', [
      { slug: 'savage-hulk-unleashed', abilities: ['[keyword:Smash 4] [keyword:smash:4]'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wwhk/bruce-banner'));
    const smashHook = hooks.find((hook) => (hook.keywords ?? []).includes('smash'));
    assert.ok(smashHook !== undefined, 'a smash hook is built');
    const smashEffects = (smashHook!.effects ?? []).filter((effect) => effect.type === 'smash');
    assert.equal(smashEffects.length, 1, 'exactly one smash effect');
    assert.equal(smashEffects[0]!.magnitude, 4, 'the +4 Attack magnitude rides the effect');
  });

  it('two separate abilities[] entries yield two smash hooks (Hurl Trucks, +0/+2/+4)', () => {
    const registry = makeRegistry('wwhk', 'she-hulk', [
      { slug: 'hurl-trucks', abilities: ['[keyword:Smash 2] [keyword:smash:2]', '[keyword:Smash 2] [keyword:smash:2]'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wwhk/she-hulk'));
    const smashHooks = hooks.filter((hook) =>
      (hook.effects ?? []).some((effect) => effect.type === 'smash' && effect.magnitude === 2),
    );
    assert.equal(smashHooks.length, 2, 'two independent Smash-2 hooks (one per abilities[] entry)');
  });

  it('two smash tokens on ONE line collapse to a single smash effect (uniqueKeywords dedup)', () => {
    // why: EC-713 — a single ability line carrying two identical smash tokens is COLLAPSED
    // to one by the parser's per-keyword magnitude Map; multi-Smash cards must use separate
    // abilities[] entries (above), not one doubled line.
    const registry = makeRegistry('wwhk', 'she-hulk', [
      { slug: 'one-line-double', abilities: ['[keyword:smash:2] [keyword:smash:2]'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wwhk/she-hulk'));
    const smashHook = hooks.find((hook) => (hook.keywords ?? []).includes('smash'));
    assert.ok(smashHook !== undefined, 'a smash hook is built');
    const smashEffects = (smashHook!.effects ?? []).filter((effect) => effect.type === 'smash');
    assert.equal(smashEffects.length, 1, 'the two same-line tokens collapse to one smash effect');
  });

  it('a bare magnitude-less [keyword:Smash] verb parses to a smash effect with NO magnitude', () => {
    // why: WP-676 §Out of Scope — the co-printed conditional-KO verb `[keyword:Smash]`
    // (no magnitude) lowercases to a smash effect with undefined magnitude, which safe-skips
    // at the executeSingleEffect magnitude pre-gate (no park, no freeze) downstream.
    const registry = makeRegistry('wwhk', 'namora', [
      { slug: 'master-of-depths', abilities: ['If you [keyword:Smash] a 0-cost Hero this way, KO it.'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('wwhk/namora'));
    const smashHook = hooks.find((hook) => (hook.keywords ?? []).includes('smash'));
    assert.ok(smashHook !== undefined, 'the bare verb still lowercases to a recognized smash keyword');
    const smashEffects = (smashHook!.effects ?? []).filter((effect) => effect.type === 'smash');
    assert.equal(smashEffects.length, 1, 'one smash effect');
    assert.equal(smashEffects[0]!.magnitude, undefined, 'no magnitude (the bare verb grants nothing → safe-skip)');
  });
});

// ---------------------------------------------------------------------------
// recruit-threshold gates the co2e/ssw1 "made at least N recruit" attack grants
// (WP-661 / D-24472). WP-660 removed the phantom +N recruit these condition
// clauses emitted, but left the REAL attack grant UNGATED — a pre-existing
// condition-modeling gap. Adding [keyword:recruit-threshold:N] to each card
// (via hero-ability-markers.json) reuses the already-shipped
// recruitMadeThisTurnAtLeast condition (WP-545 / D-24354) to gate the grant on
// the same hook. The ability strings below are the exact marked lines now in
// data/cards/{co2e,ssw1}.json.
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — recruit-threshold gates the co2e/ssw1 attack grants (WP-661)', () => {
  const GATED_ATTACK_CARDS = [
    {
      setAbbr: 'co2e',
      heroSlug: 'thor',
      cardSlug: 'glory-of-asgard',
      threshold: '8',
      attackMagnitude: 3,
      ability:
        'Once this turn, if you made at least 8[icon:recruit] this turn, you get +3[icon:attack]. [keyword:recruit-threshold:8]',
    },
    {
      setAbbr: 'co2e',
      heroSlug: 'thor',
      cardSlug: 'spark-of-the-divine',
      threshold: '8',
      attackMagnitude: 3,
      ability:
        'Once this turn, if you made at least 8[icon:recruit] this turn, you may KO a card from your hand or discard pile. If you do, you get +3[icon:attack]. [keyword:recruit-threshold:8]',
    },
    {
      setAbbr: 'ssw1',
      heroSlug: 'lady-thor',
      cardSlug: 'chosen-by-asgard',
      threshold: '6',
      attackMagnitude: 2,
      ability:
        'Once per turn, if you made at least 6[icon:recruit] this turn, you get +2[icon:attack]. [keyword:recruit-threshold:6]',
    },
    {
      setAbbr: 'ssw1',
      heroSlug: 'lady-thor',
      cardSlug: 'living-thunderstorm',
      threshold: '6',
      attackMagnitude: 6,
      ability:
        'Once per turn, if you made at least 6[icon:recruit] this turn, you get +6[icon:attack]. [keyword:recruit-threshold:6]',
    },
  ];

  for (const gatedCard of GATED_ATTACK_CARDS) {
    it(`gates ${gatedCard.cardSlug}'s +${gatedCard.attackMagnitude} attack on recruitMadeThisTurnAtLeast:${gatedCard.threshold}`, () => {
      const registry = makeRegistry(gatedCard.setAbbr, gatedCard.heroSlug, [
        { slug: gatedCard.cardSlug, abilities: [gatedCard.ability] },
      ]);
      const hooks = buildHeroAbilityHooks(
        registry,
        makeConfig(`${gatedCard.setAbbr}/${gatedCard.heroSlug}`),
      );

      const attackHook = hooks.find((hook) =>
        (hook.effects ?? []).some(
          (effect) => effect.type === 'attack' && effect.magnitude === gatedCard.attackMagnitude,
        ),
      );
      assert.ok(
        attackHook !== undefined,
        `the ${gatedCard.cardSlug} hook carrying the +${gatedCard.attackMagnitude} attack effect is built`,
      );

      const recruitConditions = (attackHook!.conditions ?? []).filter(
        (condition) => condition.type === 'recruitMadeThisTurnAtLeast',
      );
      assert.equal(
        recruitConditions.length,
        1,
        `exactly one recruitMadeThisTurnAtLeast condition gates ${gatedCard.cardSlug}'s attack grant`,
      );
      assert.equal(
        recruitConditions[0]!.value,
        gatedCard.threshold,
        `the parsed threshold is ${gatedCard.threshold}`,
      );
      assert.ok(
        !(attackHook!.unresolvedMarkers ?? []).includes('recruit-threshold'),
        'recruit-threshold is recognized before the unresolved-marker fallback (no parse-unrecognized hollow)',
      );
    });
  }

  it('control: WITHOUT the marker glory-of-asgard grants +3 attack UNGATED (the WP-660 baseline — proves the marker is load-bearing)', () => {
    // why: the un-marked line is the state WP-660 left these cards in — the +3
    // attack is emitted with NO gate. If this ever grows a recruit-threshold
    // condition on its own, the gating test above would pass vacuously.
    const unmarkedAbility =
      'Once this turn, if you made at least 8[icon:recruit] this turn, you get +3[icon:attack].';
    const registry = makeRegistry('co2e', 'thor', [
      { slug: 'glory-of-asgard', abilities: [unmarkedAbility] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('co2e/thor'));

    const attackHook = hooks.find((hook) =>
      (hook.effects ?? []).some((effect) => effect.type === 'attack' && effect.magnitude === 3),
    );
    assert.ok(attackHook !== undefined, 'the +3 attack hook is still built without the marker');
    const recruitConditions = (attackHook!.conditions ?? []).filter(
      (condition) => condition.type === 'recruitMadeThisTurnAtLeast',
    );
    assert.equal(
      recruitConditions.length,
      0,
      'without [keyword:recruit-threshold:N] there is no gate — the grant fires ungated (the follow-up bug this WP closes)',
    );
  });

  it('mysterious-origin: the recruit-threshold gate attaches even though the "draw a card" grant is unmodeled (honest hollow, properly gated)', () => {
    // why: mysterious-origin prints "draw a card" as plain English with no draw
    // marker, so the parser emits no draw effect — an honest hollow. Adding the
    // recruit-threshold marker attaches the real gate without fabricating an
    // effect: the draw stays unmodeled, but the condition is correctly recorded.
    const ability =
      'Once per turn, if you made at least 6[icon:recruit] this turn, draw a card. [keyword:recruit-threshold:6]';
    const registry = makeRegistry('ssw1', 'lady-thor', [
      { slug: 'mysterious-origin', abilities: [ability] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('ssw1/lady-thor'));

    const gatedHook = hooks.find((hook) =>
      (hook.conditions ?? []).some((condition) => condition.type === 'recruitMadeThisTurnAtLeast'),
    );
    assert.ok(gatedHook !== undefined, 'the mysterious-origin hook carries the recruit-threshold gate');
    const recruitCondition = (gatedHook!.conditions ?? []).find(
      (condition) => condition.type === 'recruitMadeThisTurnAtLeast',
    );
    assert.equal(recruitCondition!.value, '6', 'the parsed threshold is 6');
    assert.equal(
      (gatedHook!.effects ?? []).length,
      0,
      'no effect is fabricated — the unmarked "draw a card" stays an honest hollow',
    );
    assert.ok(
      !(gatedHook!.unresolvedMarkers ?? []).includes('recruit-threshold'),
      'recruit-threshold is recognized, not a parse-unrecognized hollow',
    );
  });
});

// ---------------------------------------------------------------------------
// Negative-magnitude icon suppression (D-24486)
//
// A negative attack/recruit icon ("gets -N[icon:attack]", "cost -N[icon:recruit]") is an
// Adversary debuff or a cost reduction — never a player grant. The sign-dropping Step 2b/3
// extractors used to promote it to a phantom +N SELF-grant. Live bug: Royal Decree's team
// ability granted Player 0 a real +1 attack every activation.
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — negative-magnitude icon suppression (D-24486)', () => {
  // why: the exact printed text from data/cards/asrd.json → thor → royal-decree.
  const ROYAL_DECREE_ABILITY =
    "[team:heroes-of-asgard]: Each player who is [keyword:Worthy] draws a card. "
    + "Each Villain that isn't worth at least 5VP gets -1[icon:attack] this turn.";

  it('Royal Decree: the "-1[icon:attack]" villain debuff emits NO player attack keyword or effect', () => {
    const registry = makeRegistry('asrd', 'thor', [
      { slug: 'royal-decree', abilities: [ROYAL_DECREE_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('asrd/thor'));
    assert.ok(hooks.length > 0, 'a hook is built for Royal Decree');
    assert.ok(
      hooks.every((hook) => !hook.keywords.includes('attack')),
      'the -1[icon:attack] villain debuff must not promote to an attack keyword',
    );
    assert.ok(
      hooks.every((hook) => (hook.effects ?? []).every((effect) => effect.type !== 'attack')),
      'the -1[icon:attack] villain debuff must not emit a phantom player attack effect',
    );
  });

  it('positional guard: a real +3[icon:attack] self-grant is KEPT while the same-line -2[icon:attack] debuff is suppressed', () => {
    // why: proves the suppression is POSITIONAL (keyed on the "-"), not line-level — a genuine
    // grant on the same line as a negative debuff survives, so only one attack effect (the +3)
    // is emitted, not two and not zero.
    const registry = makeRegistry('asrd', 'thor', [
      { slug: 'test-grant-and-debuff', abilities: [
        'You get +3[icon:attack]. Each Villain gets -2[icon:attack] this turn.',
      ] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('asrd/thor'));
    const attackEffects: number[] = [];
    for (const hook of hooks) {
      for (const effect of hook.effects ?? []) {
        if (effect.type === 'attack') {
          attackEffects.push(effect.magnitude ?? 0);
        }
      }
    }
    assert.deepEqual(
      attackEffects,
      [3],
      'exactly one attack effect (the +3 self-grant) survives; the -2 debuff emits none',
    );
  });
});

// ---------------------------------------------------------------------------
// Worthy count-scaled attack — Divine Lightning (WP-673 / EC-710 / D-24488)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — worthy count-scaled attack (WP-673 / D-24488)', () => {
  // The generated line: the printed text plus the marker the markers pass appends.
  const DIVINE_LIGHTNING_ABILITY =
    'You get +1[icon:attack] for each other card you played this turn that makes you [keyword:Worthy]. [keyword:attack-per-count:worthy-cards-played-this-turn:1]';

  it('emits an attack-per-count effect with the worthy count source (per-unit 1)', () => {
    const registry = makeRegistry('asrd', 'thor', [
      { slug: 'divine-lightning', abilities: [DIVINE_LIGHTNING_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('asrd/thor'));
    const effect = hooks
      .flatMap((hook) => hook.effects ?? [])
      .find((entry) => entry.type === 'attack-per-count');

    assert.ok(effect !== undefined, 'an attack-per-count effect is emitted');
    assert.equal(effect!.magnitude, 1, 'the per-unit rate is 1');
    assert.equal(effect!.countSource, 'worthy-cards-played-this-turn',
      'the count source is worthy-cards-played-this-turn');
  });

  it('suppresses the printed +1[icon:attack] so it does not double-count as a flat grant', () => {
    const registry = makeRegistry('asrd', 'thor', [
      { slug: 'divine-lightning', abilities: [DIVINE_LIGHTNING_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('asrd/thor'));

    for (const hook of hooks) {
      assert.ok(!hook.keywords.includes('attack'),
        'the printed attack icon must be subsumed by attack-per-count (no flat attack keyword)');
      assert.ok((hook.effects ?? []).every((effect) => effect.type !== 'attack'),
        'no phantom flat attack effect is emitted alongside the count-scaled one');
    }
  });

  it('suppresses the Worthy gate — the [keyword:Worthy] token is the count criterion, not a play condition', () => {
    const registry = makeRegistry('asrd', 'thor', [
      { slug: 'divine-lightning', abilities: [DIVINE_LIGHTNING_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('asrd/thor'));
    const conditions = hooks.flatMap((hook) => hook.conditions ?? []);

    assert.ok(
      conditions.every((condition) => condition.type !== 'heroCostAtLeastInHandOrPlay'),
      'no heroCostAtLeastInHandOrPlay (Worthy) gate is emitted on the count-scaled line',
    );
  });

  it('still gates a plain Worthy line with no count-scaled marker (no over-suppression)', () => {
    const registry = makeRegistry('asrd', 'thor', [
      { slug: 'plain-worthy', abilities: ['[keyword:Worthy]: Draw a card.'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('asrd/thor'));
    const conditions = hooks.flatMap((hook) => hook.conditions ?? []);

    assert.ok(
      conditions.some((condition) => condition.type === 'heroCostAtLeastInHandOrPlay'),
      'a Worthy line without the worthy count-scaled marker keeps its gate',
    );
  });
});

// ---------------------------------------------------------------------------
// cost-four-plus count-scaled attack/recruit siblings (WP-674 / EC-711 / D-24489)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — cost-four-plus count-scaled siblings (WP-674 / D-24489)', () => {
  // The generated lines: the printed text plus the marker the markers pass appends.
  const FOLLOW_BIG_LEADS_ABILITY =
    'You get +1[icon:recruit] for each other card you played this turn that costs 4 or more. [keyword:recruit-per-count:cost-four-plus-played-this-turn:1]';
  const BEING_BIG_IS_BEST_ABILITY =
    'You get +1[icon:attack] for each other card you played this turn that costs 4 or more. [keyword:attack-per-count:cost-four-plus-played-this-turn:1]';

  it('emits a recruit-per-count effect with the cost-four-plus count source (per-unit 1)', () => {
    const registry = makeRegistry('noir', 'luke-cage-noir', [
      { slug: 'follow-big-leads', abilities: [FOLLOW_BIG_LEADS_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('noir/luke-cage-noir'));
    const effect = hooks
      .flatMap((hook) => hook.effects ?? [])
      .find((entry) => entry.type === 'recruit-per-count');

    assert.ok(effect !== undefined, 'a recruit-per-count effect is emitted');
    assert.equal(effect!.magnitude, 1, 'the per-unit rate is 1');
    assert.equal(effect!.countSource, 'cost-four-plus-played-this-turn',
      'the count source is cost-four-plus-played-this-turn');
  });

  it('suppresses the printed +1[icon:recruit] so it does not double-count as a flat grant', () => {
    const registry = makeRegistry('noir', 'luke-cage-noir', [
      { slug: 'follow-big-leads', abilities: [FOLLOW_BIG_LEADS_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('noir/luke-cage-noir'));

    for (const hook of hooks) {
      assert.ok(!hook.keywords.includes('recruit'),
        'the printed recruit icon must be subsumed by recruit-per-count (no flat recruit keyword)');
      assert.ok((hook.effects ?? []).every((effect) => effect.type !== 'recruit'),
        'no phantom flat recruit effect is emitted alongside the count-scaled one');
    }
  });

  it('emits an attack-per-count effect with the cost-four-plus source and suppresses the attack icon', () => {
    const registry = makeRegistry('cvwr', 'goliath', [
      { slug: 'being-big-is-best', abilities: [BEING_BIG_IS_BEST_ABILITY] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('cvwr/goliath'));
    const effect = hooks
      .flatMap((hook) => hook.effects ?? [])
      .find((entry) => entry.type === 'attack-per-count');

    assert.ok(effect !== undefined, 'an attack-per-count effect is emitted');
    assert.equal(effect!.countSource, 'cost-four-plus-played-this-turn',
      'the count source is cost-four-plus-played-this-turn');
    for (const hook of hooks) {
      assert.ok(!hook.keywords.includes('attack'),
        'the printed attack icon must be subsumed by attack-per-count (no flat attack keyword)');
    }
  });
});

// ---------------------------------------------------------------------------
// Count-scaled choose-one — Symbiotic Adaptation (WP-675 / EC-712 / D-24490)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — count-scaled choose-one (WP-675 / D-24490)', () => {
  // The generated card data: a standalone "Choose one:" header + two option lines, each
  // carrying the count-scaled marker the markers pass appends. buildHeroAbilityHooks coalesces
  // these three entries into one line and the pre-pass folds them into one choice.
  const SYMBIOTIC_ADAPTATION_ABILITIES = [
    'Choose one:',
    '- You get +1[icon:recruit] for each other card you played this turn with a [icon:recruit] icon. [keyword:recruit-per-count:recruit-icon-played-this-turn:1]',
    '- Or you get +1[icon:attack] for each other card you played this turn with an [icon:attack] icon. [keyword:attack-per-count:attack-icon-played-this-turn:1]',
  ];

  function buildSymbioticHooks() {
    const registry = makeRegistry('vnom', 'venom', [
      { slug: 'symbiotic-adaptation', abilities: SYMBIOTIC_ADAPTATION_ABILITIES },
    ]);
    return buildHeroAbilityHooks(registry, makeConfig('vnom/venom'));
  }

  it('emits ONE count-scaled-choose effect with two options in printed order (recruit, attack)', () => {
    const hooks = buildSymbioticHooks();
    const chooseEffects = hooks
      .flatMap((hook) => hook.effects ?? [])
      .filter((effect) => effect.type === 'count-scaled-choose');

    assert.equal(chooseEffects.length, 1, 'exactly one count-scaled-choose effect is emitted');
    const options = chooseEffects[0]!.countScaledChoiceOptions;
    assert.ok(options !== undefined && options.length === 2, 'the effect carries two options');
    assert.equal(options![0]!.resource, 'recruit', 'the first printed option is the recruit branch');
    assert.equal(options![0]!.countSource, 'recruit-icon-played-this-turn');
    assert.equal(options![1]!.resource, 'attack', 'the second printed option is the attack branch');
    assert.equal(options![1]!.countSource, 'attack-icon-played-this-turn');
  });

  it('suppresses the printed icons and the per-count keywords (no independent grants)', () => {
    const hooks = buildSymbioticHooks();
    for (const hook of hooks) {
      assert.ok(!hook.keywords.includes('attack'), 'no flat attack keyword');
      assert.ok(!hook.keywords.includes('recruit'), 'no flat recruit keyword');
      assert.ok(!hook.keywords.includes('attack-per-count'), 'no standalone attack-per-count (it is a choice option)');
      assert.ok(!hook.keywords.includes('recruit-per-count'), 'no standalone recruit-per-count (it is a choice option)');
      for (const effect of hook.effects ?? []) {
        assert.ok(
          effect.type !== 'attack' && effect.type !== 'recruit'
            && effect.type !== 'attack-per-count' && effect.type !== 'recruit-per-count',
          `no phantom grant effect (${effect.type}) alongside the choice`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Investigate keyword — static-criterion parsing (WP-564 / EC-599 / D-24373)
// ---------------------------------------------------------------------------

/** Finds the single investigate effect on the built hooks (or undefined). */
function findInvestigateEffect(hooks: ReturnType<typeof buildHeroAbilityHooks>) {
  for (const hook of hooks) {
    for (const effect of hook.effects ?? []) {
      if (effect.type === 'investigate') {
        return effect;
      }
    }
  }
  return undefined;
}

describe('buildHeroAbilityHooks — investigate static criterion (WP-564 / D-24373)', () => {
  it('parses the icon:attack criterion (Alias Investigations) with look count 2', () => {
    const registry = makeRegistry('dims', 'jessica-jones', [
      { slug: 'alias-investigations', abilities: ['[keyword:Investigate] for a card with an [icon:attack] icon.'] },
    ]);
    const effect = findInvestigateEffect(buildHeroAbilityHooks(registry, makeConfig('dims/jessica-jones')));
    assert.ok(effect !== undefined, 'an investigate effect is emitted');
    assert.equal(effect!.investigateLookCount, 2, 'the printed default look count is 2');
    assert.deepEqual(effect!.investigateCriteria, [{ kind: 'icon', icon: 'attack' }]);
  });

  it('does NOT emit a phantom attack keyword/effect for the icon criterion', () => {
    const registry = makeRegistry('dims', 'jessica-jones', [
      { slug: 'alias-investigations', abilities: ['[keyword:Investigate] for a card with an [icon:attack] icon.'] },
    ]);
    const hook = buildHeroAbilityHooks(registry, makeConfig('dims/jessica-jones'))[0]!;
    assert.ok(!hook.keywords.includes('attack'), 'the criterion [icon:attack] must not add an attack keyword');
    assert.ok(hook.keywords.includes('investigate'), 'the investigate keyword is recorded');
    assert.ok((hook.effects ?? []).every((effect) => effect.type !== 'attack'), 'no phantom attack effect is emitted');
  });

  it('parses the cost-or-less criterion (Find Tiny Friends)', () => {
    const registry = makeRegistry('dims', 'squirrel-girl', [
      { slug: 'find-tiny-friends', abilities: ['[keyword:Investigate] for a card that costs 3 or less.'] },
    ]);
    const effect = findInvestigateEffect(buildHeroAbilityHooks(registry, makeConfig('dims/squirrel-girl')));
    assert.deepEqual(effect?.investigateCriteria, [{ kind: 'cost', comparison: 'lte', value: 3 }]);
  });

  it('parses the exact-cost criterion (Uncover Family Secrets)', () => {
    const registry = makeRegistry('msmc', 'm', [
      { slug: 'uncover-family-secrets', abilities: ['[keyword:Investigate] for a card that costs 3.'] },
    ]);
    const effect = findInvestigateEffect(buildHeroAbilityHooks(registry, makeConfig('msmc/m')));
    assert.deepEqual(effect?.investigateCriteria, [{ kind: 'cost', comparison: 'eq', value: 3 }]);
  });

  it('parses the cost-or-more criterion (Private Investigations)', () => {
    const registry = makeRegistry('noir', 'luke-cage-noir', [
      { slug: 'private-investigations', abilities: ['[keyword:Investigate] for a card that costs 4 or more.'] },
    ]);
    const effect = findInvestigateEffect(buildHeroAbilityHooks(registry, makeConfig('noir/luke-cage-noir')));
    assert.deepEqual(effect?.investigateCriteria, [{ kind: 'cost', comparison: 'gte', value: 4 }]);
  });

  it('parses the leading hero-class criterion (Mechanized Plate-Mail) with no gate condition', () => {
    const registry = makeRegistry('noir', 'iron-man-noir', [
      { slug: 'mechanized-plate-mail', abilities: ['[keyword:Investigate] for a [hc:tech] card.'] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('noir/iron-man-noir'));
    assert.deepEqual(findInvestigateEffect(hooks)?.investigateCriteria, [{ kind: 'hero-class', heroClass: 'tech' }]);
    // why: the criterion [hc:tech] must NOT become a heroClassMatch play-gate.
    assert.ok(!hooks[0]!.keywords.includes('conditional'), 'the criterion [hc:tech] must not add a conditional gate');
    assert.equal(hooks[0]!.conditions, undefined, 'no gate conditions on a resolved investigate line');
  });

  it('parses the [hc] and/or [team] criterion as inclusive OR (X-Factor Investigations)', () => {
    const registry = makeRegistry('msmc', 'strong-guy', [
      { slug: 'x-factor-investigations', abilities: ["[keyword:Investigate] for a card that's [hc:strength] and/or [team:x-factor-investigations]."] },
    ]);
    const hooks = buildHeroAbilityHooks(registry, makeConfig('msmc/strong-guy'));
    assert.deepEqual(findInvestigateEffect(hooks)?.investigateCriteria, [
      { kind: 'hero-class', heroClass: 'strength' },
      { kind: 'team', team: 'x-factor-investigations' },
    ]);
    assert.equal(hooks[0]!.conditions, undefined, 'no gate conditions from the criterion tokens');
  });

  it('parses the [hc] and/or [hc] criterion as inclusive OR (Unearth Tectonic Power)', () => {
    const registry = makeRegistry('msmc', 'rictor', [
      { slug: 'unearth-tectonic-power', abilities: ["[keyword:Investigate] for a card that's [hc:ranged] and/or [hc:instinct]."] },
    ]);
    const effect = findInvestigateEffect(buildHeroAbilityHooks(registry, makeConfig('msmc/rictor')));
    assert.deepEqual(effect?.investigateCriteria, [
      { kind: 'hero-class', heroClass: 'ranged' },
      { kind: 'hero-class', heroClass: 'instinct' },
    ]);
  });

  it('resolves the criterion even behind an unrecognized prefix gate (Shared Thoughts)', () => {
    // why: [keyword:Tactical Formation] is invisible to KEYWORD_PATTERN (a space breaks the
    // token), so the investigate criterion still resolves; the gate is a separate unimplemented
    // mechanic (known limitation).
    const registry = makeRegistry('msmc', 'stepford-cuckoos', [
      { slug: 'shared-thoughts', abilities: ['[keyword:Tactical Formation] 33: [keyword:Investigate] for a card with an [icon:attack] icon.'] },
    ]);
    const effect = findInvestigateEffect(buildHeroAbilityHooks(registry, makeConfig('msmc/stepford-cuckoos')));
    assert.deepEqual(effect?.investigateCriteria, [{ kind: 'icon', icon: 'attack' }]);
  });

  it('DEFERS the choose-first form (unresolved marker, no investigate keyword)', () => {
    const registry = makeRegistry('noir', 'daredevil-noir', [
      { slug: 'listen-for-heartbeats', abilities: ['Choose a number 1 or more. [keyword:Investigate] for a card of that cost.'] },
    ]);
    const hook = buildHeroAbilityHooks(registry, makeConfig('noir/daredevil-noir'))[0]!;
    assert.ok(!hook.keywords.includes('investigate'), 'choose-first must not record the investigate keyword');
    assert.ok((hook.unresolvedMarkers ?? []).includes('investigate'), 'choose-first records the investigate marker as unresolved');
  });

  it('DEFERS the disposition + covert-gate form (Discover the Bodies — KO that card)', () => {
    // why: WP-564 defers KO-disposition investigate; the trailing "KO that card." breaks the
    // anchored cost pattern, so the criterion does not resolve and the covert gate is preserved.
    const registry = makeRegistry('noir', 'daredevil-noir', [
      { slug: 'discover-the-bodies', abilities: ['[hc:covert]: [keyword:Investigate] for a card that costs 0. KO that card.'] },
    ]);
    const hook = buildHeroAbilityHooks(registry, makeConfig('noir/daredevil-noir'))[0]!;
    assert.ok(!hook.keywords.includes('investigate'), 'the KO-disposition form must not resolve');
    assert.ok((hook.unresolvedMarkers ?? []).includes('investigate'), 'it stays unsupported via the unresolved marker');
    assert.ok((hook.conditions ?? []).some((c) => c.type === 'heroClassMatch' && c.value === 'covert'), 'the covert gate is preserved');
  });

  it('DEFERS the other-zone form (Investigate the Villain Deck …)', () => {
    const registry = makeRegistry('dims', 'jessica-jones', [
      { slug: 'uncover-hidden-evil', abilities: ['[hc:covert]: [keyword:Investigate] the Villain Deck for a Villain. You may put it into your Victory Pile and do its Fight effect. Otherwise, put it back on the top or bottom of that deck.'] },
    ]);
    const hook = buildHeroAbilityHooks(registry, makeConfig('dims/jessica-jones'))[0]!;
    assert.ok(!hook.keywords.includes('investigate'), 'the other-zone form must not resolve');
    assert.ok((hook.unresolvedMarkers ?? []).includes('investigate'), 'it stays unsupported via the unresolved marker');
  });

  it('DEFERS the draw-or-KO disposition form (Crack the Case)', () => {
    const registry = makeRegistry('dims', 'jessica-jones', [
      { slug: 'crack-the-case', abilities: ['[keyword:Investigate] for a card with an [icon:recruit] icon. You may draw that card or KO it.'] },
    ]);
    const hook = buildHeroAbilityHooks(registry, makeConfig('dims/jessica-jones'))[0]!;
    assert.ok(!hook.keywords.includes('investigate'), 'the draw-or-KO form must not resolve');
    assert.ok((hook.unresolvedMarkers ?? []).includes('investigate'), 'it stays unsupported via the unresolved marker');
  });
});

// ---------------------------------------------------------------------------
// WP-653 / D-24464 — condition-gate keywords (Outwit / Worthy / Savior / Antics)
// ---------------------------------------------------------------------------

describe('buildHeroAbilityHooks — condition-gate keywords (WP-653)', () => {
  const CASES: ReadonlyArray<{ keyword: string; type: string }> = [
    { keyword: 'Outwit', type: 'distinctHeroCostsAtLeast' },
    { keyword: 'Worthy', type: 'heroCostAtLeastInHandOrPlay' },
    { keyword: 'Savior', type: 'bystandersInVictoryAtLeast' },
    { keyword: 'Antics', type: 'cheapOrSizeChangingAtLeast' },
  ];

  for (const { keyword, type } of CASES) {
    it(`parses [keyword:${keyword}] into a ${type} condition, not an unresolved marker`, () => {
      const registry = makeRegistry('test', 'test-hero', [
        { slug: 'gate-card', abilities: [`[keyword:${keyword}]: Draw a card. [keyword:draw:1]`] },
      ]);
      const hook = buildHeroAbilityHooks(registry, makeConfig('test/test-hero'))[0]!;

      const conditions = hook.conditions ?? [];
      assert.ok(
        conditions.some((condition) => condition.type === type),
        `hook should carry a ${type} condition`,
      );
      assert.ok(
        !(hook.unresolvedMarkers ?? []).includes(keyword.toLowerCase()),
        `${keyword} must NOT be recorded as a parse-unrecognized hollow`,
      );
      // the gated draw:1 effect is present on the same hook (gated by the condition).
      assert.ok(hook.keywords.includes('draw'), 'the gated draw effect is on the hook');
    });
  }

  it('does NOT add the four keywords to hook.keywords (they are conditions, not keywords)', () => {
    const registry = makeRegistry('test', 'test-hero', [
      { slug: 'gate-card', abilities: ['[keyword:Outwit]: Draw a card. [keyword:draw:1]'] },
    ]);
    const hook = buildHeroAbilityHooks(registry, makeConfig('test/test-hero'))[0]!;
    for (const keyword of ['outwit', 'worthy', 'savior', 'antics']) {
      assert.ok(!hook.keywords.includes(keyword), `${keyword} is a condition, never a hook keyword`);
    }
  });
});
