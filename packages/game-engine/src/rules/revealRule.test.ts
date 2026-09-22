/**
 * Tests for the parameterized reveal contracts + legacy-keyword translation seam
 * (WP-253 / D-24024).
 *
 * Covers: predicate/action canonical-array drift; per-keyword translation parity for
 * all 8 legacy reveal keywords; the two magnitude tiers (valid {reveal, reveal-min}
 * no-op only on INVALID magnitude — M=0 is valid; positive {reveal-ko-or-draw,
 * reveal-attack-choose, reveal-ko-attack} no-op on invalid OR < 1; no-magnitude
 * {reveal-ko, reveal-odd-draw, reveal-cost-attack} always translate); and the
 * no-reverse-map claim (the parser keeps writing the legacy keyword on hook.keywords).
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVEAL_PREDICATE_KINDS,
  REVEAL_ACTION_KINDS,
  REVEAL_KEYWORDS,
  REVEAL_KEYWORDS_REQUIRING_MAGNITUDE,
  revealRulesForLegacyKeyword,
} from './revealRule.js';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

// ---------------------------------------------------------------------------
// Canonical-array drift (code-style §Drift Detection)
// ---------------------------------------------------------------------------

describe('reveal predicate/action canonical-array drift (D-24024)', () => {
  it('REVEAL_PREDICATE_KINDS has exactly the 7 canonical kinds, in order, no duplicates', () => {
    // why: WP-729 / D-24550 — the trait predicates 'team' + 'hero-class' join the five
    // cost predicates. Union ↔ array ↔ this assertion ↔ D-24550 move together.
    assert.deepStrictEqual(
      [...REVEAL_PREDICATE_KINDS],
      ['always', 'cost-lte', 'cost-gte', 'cost-zero', 'cost-odd', 'team', 'hero-class'],
      'REVEAL_PREDICATE_KINDS must match the canonical predicate kinds in order',
    );
    assert.equal(new Set(REVEAL_PREDICATE_KINDS).size, REVEAL_PREDICATE_KINDS.length, 'no duplicate predicate kinds');
  });

  it('REVEAL_ACTION_KINDS has exactly the 5 canonical kinds, in order, no duplicates', () => {
    assert.deepStrictEqual(
      [...REVEAL_ACTION_KINDS],
      ['draw', 'ko', 'attack-by-cost', 'attack-fixed', 'choose-discard-or-return'],
      'REVEAL_ACTION_KINDS must match the canonical action kinds in order',
    );
    assert.equal(new Set(REVEAL_ACTION_KINDS).size, REVEAL_ACTION_KINDS.length, 'no duplicate action kinds');
  });

  it('REVEAL_KEYWORDS holds the 8 legacy reveal keywords; REQUIRING_MAGNITUDE holds the 5 magnitude tiers', () => {
    assert.deepStrictEqual(
      [...REVEAL_KEYWORDS],
      ['reveal', 'reveal-ko', 'reveal-min', 'reveal-ko-or-draw', 'reveal-cost-attack', 'reveal-odd-draw', 'reveal-attack-choose', 'reveal-ko-attack'],
      'REVEAL_KEYWORDS must hold the 8 frozen legacy reveal keywords',
    );
    assert.deepStrictEqual(
      [...REVEAL_KEYWORDS_REQUIRING_MAGNITUDE].sort(),
      ['reveal', 'reveal-attack-choose', 'reveal-ko-attack', 'reveal-ko-or-draw', 'reveal-min'].sort(),
      'the 5 magnitude-requiring reveal keywords',
    );
  });
});

// ---------------------------------------------------------------------------
// Per-keyword translation parity (all 8)
// ---------------------------------------------------------------------------

describe('revealRulesForLegacyKeyword translation parity (D-24024)', () => {
  it('reveal (M=2) → cost-lte 2 → draw', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal', 2), [
      { predicate: { kind: 'cost-lte', threshold: 2 }, actions: [{ kind: 'draw' }] },
    ]);
  });

  it('reveal-min (M=3) → cost-gte 3 → draw', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-min', 3), [
      { predicate: { kind: 'cost-gte', threshold: 3 }, actions: [{ kind: 'draw' }] },
    ]);
  });

  it('reveal-odd-draw → cost-odd → draw (magnitude ignored)', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-odd-draw', undefined), [
      { predicate: { kind: 'cost-odd' }, actions: [{ kind: 'draw' }] },
    ]);
  });

  it('reveal-ko → cost-zero → ko (magnitude ignored)', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-ko', undefined), [
      { predicate: { kind: 'cost-zero' }, actions: [{ kind: 'ko' }] },
    ]);
  });

  it('reveal-ko-or-draw (M=2) → cost-zero→ko THEN cost-lte 2→draw (first-match, no continue)', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-ko-or-draw', 2), [
      { predicate: { kind: 'cost-zero' }, actions: [{ kind: 'ko' }] },
      { predicate: { kind: 'cost-lte', threshold: 2 }, actions: [{ kind: 'draw' }] },
    ]);
  });

  it('reveal-cost-attack → always → attack-by-cost (magnitude ignored)', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-cost-attack', undefined), [
      { predicate: { kind: 'always' }, actions: [{ kind: 'attack-by-cost' }] },
    ]);
  });

  it('reveal-attack-choose (M=4) → cost-lte 4→attack-by-cost (continue) THEN always→choose', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-attack-choose', 4), [
      { predicate: { kind: 'cost-lte', threshold: 4 }, actions: [{ kind: 'attack-by-cost' }], continue: true },
      { predicate: { kind: 'always' }, actions: [{ kind: 'choose-discard-or-return' }] },
    ]);
  });

  it('reveal-ko-attack (M=1) → cost-zero → [ko, attack-fixed 1] (atomic)', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-ko-attack', 1), [
      { predicate: { kind: 'cost-zero' }, actions: [{ kind: 'ko' }, { kind: 'attack-fixed', amount: 1 }] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Magnitude tiers
// ---------------------------------------------------------------------------

describe('revealRulesForLegacyKeyword magnitude tiers (D-24024 / RESIDUAL-1)', () => {
  const INVALID_MAGNITUDES: Array<number | undefined> = [undefined, -1, 1.5, NaN, Infinity];

  it('valid tier {reveal, reveal-min}: M=0 is VALID and produces a draw rule (must NOT no-op)', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal', 0), [
      { predicate: { kind: 'cost-lte', threshold: 0 }, actions: [{ kind: 'draw' }] },
    ], 'reveal M=0 → cost-lte 0 → draw (draws a cost-0 card)');
    assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-min', 0), [
      { predicate: { kind: 'cost-gte', threshold: 0 }, actions: [{ kind: 'draw' }] },
    ], 'reveal-min M=0 → cost-gte 0 → draw (draws every card)');
  });

  it('valid tier {reveal, reveal-min}: an INVALID magnitude yields empty rules', () => {
    for (const magnitude of INVALID_MAGNITUDES) {
      assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal', magnitude), [], `reveal ${String(magnitude)} → []`);
      assert.deepStrictEqual(revealRulesForLegacyKeyword('reveal-min', magnitude), [], `reveal-min ${String(magnitude)} → []`);
    }
  });

  it('positive tier {reveal-ko-or-draw, reveal-attack-choose, reveal-ko-attack}: M=0 and invalid yield empty rules', () => {
    const positiveTier = ['reveal-ko-or-draw', 'reveal-attack-choose', 'reveal-ko-attack'] as const;
    for (const keyword of positiveTier) {
      assert.deepStrictEqual(revealRulesForLegacyKeyword(keyword, 0), [], `${keyword} M=0 → [] (< 1 self-guard)`);
      for (const magnitude of INVALID_MAGNITUDES) {
        assert.deepStrictEqual(revealRulesForLegacyKeyword(keyword, magnitude), [], `${keyword} ${String(magnitude)} → []`);
      }
      // M=1 is the first valid positive magnitude — must produce rules.
      assert.ok(revealRulesForLegacyKeyword(keyword, 1).length > 0, `${keyword} M=1 → non-empty`);
    }
  });

  it('no-magnitude tier {reveal-ko, reveal-odd-draw, reveal-cost-attack}: undefined still translates', () => {
    assert.ok(revealRulesForLegacyKeyword('reveal-ko', undefined).length > 0);
    assert.ok(revealRulesForLegacyKeyword('reveal-odd-draw', undefined).length > 0);
    assert.ok(revealRulesForLegacyKeyword('reveal-cost-attack', undefined).length > 0);
  });

  it('a non-reveal keyword returns empty rules (defensive)', () => {
    assert.deepStrictEqual(revealRulesForLegacyKeyword('attack', 2), []);
  });
});

// ---------------------------------------------------------------------------
// No reverse-map: the parser keeps the legacy keyword on hook.keywords
// ---------------------------------------------------------------------------

describe('reveal narrative identity — no reverse-map needed (D-24024 / Q2)', () => {
  // why: WP-252's villain hook needed a descriptor→keyword reverse-map because its
  // `effects` was retyped and fed the narrative. The hero hook records `keywords`
  // INDEPENDENTLY of `effects`, so translating reveal-* effects to type 'reveal'
  // leaves the legacy keyword on hook.keywords with zero extra machinery — this is
  // what keeps notableEvents / arena-client / the replay hash byte-identical.
  function makeRevealRegistry(abilityText: string) {
    const setData = {
      abbr: 'core',
      heroes: [{ slug: 'reveal-hero', cards: [{ slug: 'reveal-card', rarityLabel: 'Common 1', abilities: [abilityText] }], physicalCards: [{ id: 'p0', count: 1, sides: ['reveal-card'] }] }],
      villains: [], henchmen: [], schemes: [], masterminds: [],
    };
    return {
      listCards: () => [],
      listSets: () => [{ abbr: 'core' }],
      getSet: (abbr: string) => (abbr === 'core' ? setData : undefined),
    };
  }

  it('a [keyword:reveal-ko] hook records the legacy keyword while its effect is type reveal', () => {
    const config: MatchSetupConfig = {
      schemeId: 'test/s', mastermindId: 'test/m', villainGroupIds: ['test/v'], henchmanGroupIds: ['test/h'],
      heroDeckIds: ['core/reveal-hero'], bystandersCount: 10, woundsCount: 15, officersCount: 20, sidekicksCount: 5,
    };
    const hooks = buildHeroAbilityHooks(makeRevealRegistry('[keyword:reveal-ko]'), config);
    const hook = hooks[0]!;
    assert.ok(hook.keywords.includes('reveal-ko'), 'the legacy reveal-ko keyword stays on hook.keywords (narrative identity)');
    const revealEffect = hook.effects?.find((e) => e.type === 'reveal');
    assert.ok(revealEffect !== undefined, 'the effect collapsed to type reveal');
    assert.deepStrictEqual(
      revealEffect!.revealRules,
      [{ predicate: { kind: 'cost-zero' }, actions: [{ kind: 'ko' }] }],
      'the translated branch-list reproduces reveal-ko',
    );
  });
});
