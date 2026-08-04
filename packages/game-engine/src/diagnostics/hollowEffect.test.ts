/**
 * Tests for the hollow-effect contract + writer (WP-257 / D-24033 + D-24034).
 *
 * Covers: EFFECT_EXECUTION_REASONS canonical-array drift (matches its union
 * exactly, in order, no duplicates); isHollowReason flags exactly the three
 * hollow reasons; recordHollowEffect lazy-init + cap + hollowEffectsDropped;
 * non-array G.messages is a guarded no-op (no throw); JSON-serializability.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EFFECT_EXECUTION_REASONS,
  isHollowReason,
  HOLLOW_EFFECTS_CAP,
  DEFERRED_BY_DESIGN_MECHANICS,
} from './hollowEffect.types.js';
import type {
  EffectExecutionReason,
  HollowEffectRecord,
} from './hollowEffect.types.js';
import { recordHollowEffect } from './hollowEffect.record.js';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import type { LegendaryGameState } from '../types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal G exercising only the fields recordHollowEffect touches
 * (messages + the lazy-init diagnostics channel). Cast through unknown because
 * the writer never reads the rest.
 */
function makeG(messages?: unknown): LegendaryGameState {
  return {
    messages: messages === undefined ? [] : messages,
  } as unknown as LegendaryGameState;
}

/**
 * Builds a HollowEffectRecord with sensible defaults for writer tests.
 */
function makeRecord(overrides?: Partial<HollowEffectRecord>): HollowEffectRecord {
  return {
    cardId: 'core/spider-man/astonishing-strength#0',
    cardType: 'hero',
    timing: 'onPlay',
    mechanic: 'made-up-keyword',
    reason: 'no-handler',
    turn: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Canonical-array drift (code-style §Drift Detection)
// ---------------------------------------------------------------------------

describe('EFFECT_EXECUTION_REASONS canonical-array drift (D-24033)', () => {
  // why: the union has no runtime presence, so this asserts the array matches the
  // exact 7-member union in the locked order. A reason added to the union but not
  // the array (or vice versa) fails here — same drift contract as REVEAL_ACTION_KINDS.
  it('has exactly the 7 canonical reasons, in order, no duplicates', () => {
    const expected: EffectExecutionReason[] = [
      'applied',
      'handler-noop',
      'condition-failed',
      'deferred',
      'no-handler',
      'unsupported-keyword',
      'parse-unrecognized',
    ];
    assert.deepStrictEqual(
      [...EFFECT_EXECUTION_REASONS],
      expected,
      'EFFECT_EXECUTION_REASONS must match the canonical reasons in order',
    );
    assert.equal(
      new Set(EFFECT_EXECUTION_REASONS).size,
      EFFECT_EXECUTION_REASONS.length,
      'no duplicate reasons',
    );
  });
});

// ---------------------------------------------------------------------------
// isHollowReason predicate
// ---------------------------------------------------------------------------

describe('isHollowReason', () => {
  it('flags exactly the three hollow reasons and no others', () => {
    const hollow: EffectExecutionReason[] = [
      'parse-unrecognized',
      'no-handler',
      'unsupported-keyword',
    ];
    const reachable: EffectExecutionReason[] = [
      'applied',
      'handler-noop',
      'condition-failed',
      'deferred',
    ];
    for (const reason of hollow) {
      assert.equal(isHollowReason(reason), true, `${reason} must be hollow`);
    }
    for (const reason of reachable) {
      assert.equal(isHollowReason(reason), false, `${reason} must NOT be hollow`);
    }
  });

  // why: every member of the canonical array is classified by the predicate —
  // exactly 3 true, 4 false — so a future reason cannot be silently un-classified.
  it('classifies every reason in the canonical array (3 hollow, 4 reachable)', () => {
    let hollowCount = 0;
    for (const reason of EFFECT_EXECUTION_REASONS) {
      if (isHollowReason(reason)) {
        hollowCount += 1;
      }
    }
    assert.equal(hollowCount, 3, 'exactly 3 of the 7 reasons are hollow');
  });
});

// ---------------------------------------------------------------------------
// DEFERRED_BY_DESIGN_MECHANICS allowlist
// ---------------------------------------------------------------------------

describe('DEFERRED_BY_DESIGN_MECHANICS', () => {
  it('contains wound and conditional (the no-handler-but-deferred mechanics)', () => {
    assert.equal(DEFERRED_BY_DESIGN_MECHANICS.has('wound'), true);
    assert.equal(DEFERRED_BY_DESIGN_MECHANICS.has('conditional'), true);
  });

  it('does not list any executable MVP keyword', () => {
    assert.equal(DEFERRED_BY_DESIGN_MECHANICS.has('draw'), false);
    assert.equal(DEFERRED_BY_DESIGN_MECHANICS.has('rescue'), false);
    assert.equal(DEFERRED_BY_DESIGN_MECHANICS.has('reveal'), false);
  });
});

// ---------------------------------------------------------------------------
// recordHollowEffect — lazy-init + cap + dropped + no-throw
// ---------------------------------------------------------------------------

describe('recordHollowEffect', () => {
  it('lazy-inits G.diagnostics on the first write', () => {
    const G = makeG();
    assert.equal(G.diagnostics, undefined, 'channel is absent before the first write');
    recordHollowEffect(G, makeRecord());
    assert.ok(G.diagnostics, 'channel materializes on first write');
    assert.equal(G.diagnostics!.hollowEffects.length, 1);
    assert.equal(G.diagnostics!.hollowEffectsDropped, 0);
  });

  it('appends a full-sentence G.messages line for a retained record', () => {
    const G = makeG();
    recordHollowEffect(G, makeRecord({ mechanic: 'phantom', timing: 'onPlay' }));
    assert.equal(G.messages.length, 1);
    assert.match(G.messages[0]!.text, /Unhandled effect observed/);
    assert.match(G.messages[0]!.text, /phantom/);
  });

  it('stores the record fields verbatim (the machine-readable contract)', () => {
    const G = makeG();
    const record = makeRecord({
      cardId: 'core/v/skrull#3',
      cardType: 'villain',
      timing: 'onAmbush',
      mechanic: 'mind-control',
      reason: 'parse-unrecognized',
      turn: 7,
    });
    recordHollowEffect(G, record);
    assert.deepStrictEqual(G.diagnostics!.hollowEffects[0], record);
  });

  it('caps the list at HOLLOW_EFFECTS_CAP and counts dropped overflow', () => {
    const G = makeG();
    const overflow = 5;
    for (let i = 0; i < HOLLOW_EFFECTS_CAP + overflow; i++) {
      recordHollowEffect(G, makeRecord({ mechanic: `m-${String(i)}` }));
    }
    assert.equal(
      G.diagnostics!.hollowEffects.length,
      HOLLOW_EFFECTS_CAP,
      'the list never exceeds the cap',
    );
    assert.equal(
      G.diagnostics!.hollowEffectsDropped,
      overflow,
      'every record past the cap is counted as dropped',
    );
  });

  it('does NOT append a G.messages line for a dropped (over-cap) record', () => {
    const G = makeG();
    for (let i = 0; i < HOLLOW_EFFECTS_CAP; i++) {
      recordHollowEffect(G, makeRecord());
    }
    const messagesAtCap = G.messages.length;
    recordHollowEffect(G, makeRecord({ mechanic: 'over-cap' }));
    assert.equal(G.messages.length, messagesAtCap, 'no message line for a dropped record');
    assert.equal(G.diagnostics!.hollowEffectsDropped, 1);
  });

  it('does not throw when G.messages is not an array (guarded no-op)', () => {
    const G = makeG(undefined as unknown);
    // why: simulate an older/narrow test mock that built G without a messages array.
    (G as { messages?: unknown }).messages = undefined;
    assert.doesNotThrow(() => recordHollowEffect(G, makeRecord()));
    assert.equal(G.diagnostics!.hollowEffects.length, 1, 'record still stored');
  });

  it('does not throw when G.messages is a non-array object', () => {
    const G = makeG({ notAnArray: true });
    assert.doesNotThrow(() => recordHollowEffect(G, makeRecord()));
    assert.equal(G.diagnostics!.hollowEffects.length, 1, 'record still stored');
  });

  it('produces a JSON-serializable channel (no functions/Maps/Sets)', () => {
    const G = makeG();
    recordHollowEffect(G, makeRecord());
    recordHollowEffect(G, makeRecord({ reason: 'unsupported-keyword' }));
    const roundTripped = JSON.parse(JSON.stringify(G.diagnostics));
    assert.deepStrictEqual(roundTripped, G.diagnostics);
  });

  it('is deterministic — identical writes produce identical channel state', () => {
    const buildAndWrite = (): LegendaryGameState => {
      const G = makeG();
      recordHollowEffect(G, makeRecord({ mechanic: 'a' }));
      recordHollowEffect(G, makeRecord({ mechanic: 'b', reason: 'parse-unrecognized' }));
      return G;
    };
    const first = buildAndWrite();
    const second = buildAndWrite();
    assert.deepStrictEqual(first.diagnostics, second.diagnostics);
  });
});

// ---------------------------------------------------------------------------
// WP-485 / D-24290 — the three Tier-A Core villain Fight abilities, once marked
// with their new auto-resolve primitives, no longer record an `unmarked-ability`
// hollow breadcrumb (D-24266). The handler runs; the marked hook carries a
// descriptor, so detectVillainUnmarkedTimingLine short-circuits.
// ---------------------------------------------------------------------------

describe('WP-485 Tier-A abilities record no unmarked-ability breadcrumb', () => {
  const CTX = { currentPlayer: '0' };
  const AVENGER = 'core/avengers/cap#0' as CardExtId;
  const SHIELD = 'core/shield/agent#0' as CardExtId;

  /** Builds a G exercising only the fields the three Tier-A handlers read. */
  function makeVillainG(hook: VillainAbilityHook): LegendaryGameState {
    return {
      villainAbilityHooks: [hook],
      playerZones: {
        '0': { deck: [AVENGER], hand: [SHIELD, AVENGER], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      piles: { bystanders: ['bys0' as CardExtId], wounds: [], officers: [], sidekicks: [], horrors: [] },
      ko: [],
      attachedBystanders: {},
      cardTraits: {
        [SHIELD]: { heroClass: 'covert', team: 'shield' },
        [AVENGER]: { heroClass: 'strength', team: 'avengers' },
      },
      messages: [],
      turnEconomy: {
        attack: 0,
        recruit: 0,
        spentAttack: 0,
        spentRecruit: 0,
        piercing: 0,
        woundsDrawn: 0,
      },
    } as unknown as LegendaryGameState;
  }

  const reverseShuffle: ShuffleProvider = {
    random: { Shuffle: <T>(deck: T[]): T[] => [...deck].reverse() },
  };

  const cases: Array<{ label: string; hook: VillainAbilityHook }> = [
    {
      label: 'draw-cards-current (Enchantress)',
      hook: {
        cardId: 'v-enchantress' as CardExtId,
        timing: 'onFight',
        keywords: [],
        effects: [{ primitive: 'draw-cards-current', drawCount: 3 }],
      },
    },
    {
      label: 'ko-heroes-current-by-trait (Destroyer)',
      hook: {
        cardId: 'v-destroyer' as CardExtId,
        timing: 'onFight',
        keywords: [],
        effects: [
          { primitive: 'ko-heroes-current-by-trait', requireKind: 'team', requireValue: 'shield' },
        ],
      },
    },
    {
      label: 'rescue-bystanders-current-by-trait-count (Baron Zemo)',
      hook: {
        cardId: 'v-zemo' as CardExtId,
        timing: 'onFight',
        keywords: [],
        effects: [
          {
            primitive: 'rescue-bystanders-current-by-trait-count',
            requireKind: 'team',
            requireValue: 'avengers',
          },
        ],
      },
    },
  ];

  for (const { label, hook } of cases) {
    it(`${label} records no hollow breadcrumb`, () => {
      const G = makeVillainG(hook);
      executeVillainAbilities(G, CTX, hook.cardId, 'onFight', reverseShuffle);
      assert.equal(
        G.diagnostics?.hollowEffects?.length ?? 0,
        0,
        `${label} is handled — no unmarked-ability / no-handler record`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// WP-489 / D-24295 — Abomination + the Lizard, once marked with their
// location-gated Tier-B effects, no longer record an `unmarked-ability` hollow
// breadcrumb (D-24266) — whether the gate passes (effect fires) or fails (self-
// narrated no-effect). The marked hook carries a descriptor, so
// detectVillainUnmarkedTimingLine short-circuits regardless of the gate outcome.
// ---------------------------------------------------------------------------

describe('WP-489 Tier-B abilities record no unmarked-ability breadcrumb', () => {
  const CTX = { currentPlayer: '0' };
  const BYSTANDER = 'bys0' as CardExtId;

  /** Builds a G exercising only the fields the two Tier-B handlers read. */
  function makeVillainG(hook: VillainAbilityHook): LegendaryGameState {
    return {
      villainAbilityHooks: [hook],
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      piles: { bystanders: [BYSTANDER], wounds: ['w0' as CardExtId], officers: [], sidekicks: [], horrors: [] },
      ko: [],
      attachedBystanders: {},
      messages: [],
      turnEconomy: {
        attack: 0,
        recruit: 0,
        spentAttack: 0,
        spentRecruit: 0,
        piercing: 0,
        woundsDrawn: 0,
      },
    } as unknown as LegendaryGameState;
  }

  const abomination: VillainAbilityHook = {
    cardId: 'v-abomination' as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'capture-bystander', magnitude: 3, requireCitySpaces: ['streets', 'bridge'] }],
  };
  const lizard: VillainAbilityHook = {
    cardId: 'v-lizard' as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [{ primitive: 'gain-wound', target: 'each-other', magnitude: 1, requireCitySpaces: ['sewers'] }],
  };

  // why: WP-492 / D-24298 — Whirlwind's magnitude-2 location-gated current-player KO
  // (keyword-less) must also record no `unmarked-ability` breadcrumb, whether the
  // gate passes (a reachable no-op here, since the test G holds no heroes) or fails.
  const whirlwind: VillainAbilityHook = {
    cardId: 'v-whirlwind' as CardExtId,
    timing: 'onFight',
    keywords: [],
    effects: [
      { primitive: 'ko-hero', target: 'current', magnitude: 2, requireCitySpaces: ['rooftops', 'bridge'] },
    ],
  };

  const cases: Array<{ label: string; hook: VillainAbilityHook; cityIndex: number }> = [
    { label: 'Abomination gate-pass (Streets)', hook: abomination, cityIndex: 3 },
    { label: 'Abomination gate-fail (Sewers)', hook: abomination, cityIndex: 0 },
    { label: 'the Lizard gate-pass (Sewers)', hook: lizard, cityIndex: 0 },
    { label: 'the Lizard gate-fail (Bridge)', hook: lizard, cityIndex: 4 },
    { label: 'Whirlwind gate-pass (Rooftops)', hook: whirlwind, cityIndex: 2 },
    { label: 'Whirlwind gate-fail (Sewers)', hook: whirlwind, cityIndex: 0 },
  ];

  for (const { label, hook, cityIndex } of cases) {
    it(`${label} records no hollow breadcrumb`, () => {
      const G = makeVillainG(hook);
      executeVillainAbilities(G, CTX, hook.cardId, 'onFight', undefined, cityIndex);
      assert.equal(
        G.diagnostics?.hollowEffects?.length ?? 0,
        0,
        `${label} is handled — no unmarked-ability / no-handler record`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// WP-494 / D-24299 — Viper's conditional victory-pile-gated each-player wound
// records no `unmarked-ability` breadcrumb at either the Fight or Escape timing.
// ---------------------------------------------------------------------------

describe('WP-494 Viper records no unmarked-ability breadcrumb', () => {
  const CTX = { currentPlayer: '0' };
  const VIPER = 'core-villain-hydra-viper-00' as CardExtId;

  /** Builds a G exercising only the fields the Viper handler reads. */
  function makeVillainG(timing: 'onFight' | 'onEscape'): LegendaryGameState {
    return {
      villainAbilityHooks: [
        {
          cardId: VIPER,
          timing,
          keywords: [],
          effects: [{ primitive: 'gain-wound-unless-victory-villain-group', victoryVillainGroup: 'hydra' }],
        },
      ],
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [VIPER] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      piles: { bystanders: [], wounds: ['w0' as CardExtId], officers: [], sidekicks: [], horrors: [] },
      ko: [],
      attachedBystanders: {},
      messages: [],
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    } as unknown as LegendaryGameState;
  }

  for (const timing of ['onFight', 'onEscape'] as const) {
    it(`records no hollow breadcrumb at ${timing}`, () => {
      const G = makeVillainG(timing);
      executeVillainAbilities(G, CTX, VIPER, timing);
      assert.equal(
        G.diagnostics?.hollowEffects?.length ?? 0,
        0,
        `Viper is handled at ${timing} — no unmarked-ability record`,
      );
    });
  }
});
