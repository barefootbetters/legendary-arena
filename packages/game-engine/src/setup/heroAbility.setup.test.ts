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
