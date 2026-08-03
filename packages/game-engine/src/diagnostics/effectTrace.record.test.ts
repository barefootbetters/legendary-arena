/**
 * Tests for the effect-trace contract + writer (WP-488 / D-24294).
 *
 * Covers: EFFECT_TRACE_STATUSES / EFFECT_TRACE_FIRE_SITES canonical-array drift
 * (each matches its union exactly, in order, no duplicates — with a compile-time
 * exhaustiveness switch that fails if a union member is added without updating the
 * array); recordEffectTrace lazy-init (fresh + hollow-first) + cap + tracesDropped +
 * never-throw + the deliberate NO `G.messages` divergence + JSON-serializability; and
 * integration coverage that the villain (`executeVillainAbilities`) and hero
 * (`executeHeroEffects`) caller loops emit traces with the correct status / fireSite /
 * string handler and a scalar-only `params` snapshot.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EFFECT_TRACE_STATUSES,
  EFFECT_TRACE_FIRE_SITES,
  EFFECT_TRACES_CAP,
} from './hollowEffect.types.js';
import type {
  EffectTrace,
  EffectTraceStatus,
  EffectTraceFireSite,
} from './hollowEffect.types.js';
import { recordEffectTrace } from './effectTrace.record.js';
import { recordHollowEffect } from './hollowEffect.record.js';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import type { VillainAbilityHook, VillainEffectDescriptor } from '../rules/villainAbility.types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { EffectNode } from '../rules/effectPrimitive.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { LegendaryGameState } from '../types.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal G exercising only what recordEffectTrace touches (the lazy-init
 * diagnostics channel). Cast through unknown — the writer never reads the rest.
 */
function makeG(messages?: unknown): LegendaryGameState {
  return {
    messages: messages === undefined ? [] : messages,
  } as unknown as LegendaryGameState;
}

/**
 * Builds an EffectTrace with sensible defaults for writer tests.
 */
function makeTrace(overrides?: Partial<EffectTrace>): EffectTrace {
  return {
    cardId: 'core/villain/mystique#0' as CardExtId,
    scope: 'villain',
    timing: 'onFight',
    effect: 'gain-wound',
    handler: 'gain-wound',
    status: 'fired',
    fireSite: 'villain-executor',
    params: { target: 'current' },
    turn: 3,
    ...overrides,
  };
}

/** Asserts every value in a trace's params is a scalar (string | number | boolean). */
function assertScalarParams(trace: EffectTrace): void {
  for (const value of Object.values(trace.params)) {
    assert.ok(
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean',
      `params value ${String(value)} must be a scalar (string | number | boolean), got ${typeof value}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Canonical-array drift (code-style §Drift Detection)
// ---------------------------------------------------------------------------

describe('EFFECT_TRACE_STATUSES canonical-array drift (D-24294)', () => {
  it('has exactly the 4 canonical statuses, in order, no duplicates', () => {
    const expected: EffectTraceStatus[] = ['fired', 'no-op', 'no-handler', 'secondary-site'];
    assert.deepStrictEqual([...EFFECT_TRACE_STATUSES], expected);
    assert.equal(new Set(EFFECT_TRACE_STATUSES).size, EFFECT_TRACE_STATUSES.length, 'no duplicates');
  });

  // why: compile-time bidirectional guard — the exhaustive switch fails to compile if a
  // status is added to the EffectTraceStatus union without a case here, and the runtime
  // loop fails if the array carries an unknown value. Together they pin array ↔ union.
  it('classifies every array member (exhaustive switch — union ↔ array)', () => {
    for (const status of EFFECT_TRACE_STATUSES) {
      switch (status) {
        case 'fired':
        case 'no-op':
        case 'no-handler':
        case 'secondary-site':
          break;
        default: {
          const neverStatus: never = status;
          assert.fail(`unhandled status ${String(neverStatus)}`);
        }
      }
    }
  });
});

describe('EFFECT_TRACE_FIRE_SITES canonical-array drift (D-24294)', () => {
  it('has exactly the 4 canonical fire sites, in order, no duplicates', () => {
    const expected: EffectTraceFireSite[] = [
      'villain-executor',
      'hero-executor',
      'hero-primitive',
      'escape-scheme-twist',
    ];
    assert.deepStrictEqual([...EFFECT_TRACE_FIRE_SITES], expected);
    assert.equal(new Set(EFFECT_TRACE_FIRE_SITES).size, EFFECT_TRACE_FIRE_SITES.length, 'no duplicates');
  });

  it('classifies every array member (exhaustive switch — union ↔ array)', () => {
    for (const fireSite of EFFECT_TRACE_FIRE_SITES) {
      switch (fireSite) {
        case 'villain-executor':
        case 'hero-executor':
        case 'hero-primitive':
        case 'escape-scheme-twist':
          break;
        default: {
          const neverSite: never = fireSite;
          assert.fail(`unhandled fire site ${String(neverSite)}`);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// recordEffectTrace — lazy-init + cap + dropped + no-throw + no-pushLog
// ---------------------------------------------------------------------------

describe('recordEffectTrace', () => {
  it('lazy-inits G.diagnostics + traces on the first write', () => {
    const G = makeG();
    assert.equal(G.diagnostics, undefined, 'channel is absent before the first write');
    recordEffectTrace(G, makeTrace());
    assert.ok(G.diagnostics, 'channel materializes on first write');
    assert.equal(G.diagnostics!.traces!.length, 1);
    assert.equal(G.diagnostics!.tracesDropped, 0);
    // why: the writer must also seed the sibling hollow fields so the channel stays whole.
    assert.deepStrictEqual(G.diagnostics!.hollowEffects, []);
  });

  it('seeds traces when G.diagnostics was created hollow-first (recordHollowEffect)', () => {
    const G = makeG();
    // why: recordHollowEffect inits the channel WITHOUT the trace fields; recordEffectTrace
    // must seed traces onto the existing channel rather than clobber the hollow records.
    recordHollowEffect(G, {
      cardId: 'core/villain/x#0',
      cardType: 'villain',
      timing: 'onFight',
      mechanic: 'made-up',
      reason: 'no-handler',
      turn: 1,
    });
    assert.equal(G.diagnostics!.traces, undefined, 'traces absent after a hollow-only write');
    recordEffectTrace(G, makeTrace());
    assert.equal(G.diagnostics!.traces!.length, 1, 'trace appended');
    assert.equal(G.diagnostics!.hollowEffects.length, 1, 'the pre-existing hollow record is preserved');
  });

  it('does NOT push a G.messages line (the deliberate divergence from recordHollowEffect)', () => {
    const G = makeG();
    recordEffectTrace(G, makeTrace());
    recordEffectTrace(G, makeTrace({ status: 'no-op' }));
    assert.equal(
      (G.messages as unknown[]).length,
      0,
      'a trace is a machine-readable diagnostic only — no operator log line',
    );
  });

  it('stores the trace fields verbatim', () => {
    const G = makeG();
    const trace = makeTrace({
      cardId: 'core/hero/spider-man#2' as CardExtId,
      scope: 'hero',
      timing: 'onPlay',
      effect: 'draw',
      handler: 'draw',
      status: 'fired',
      fireSite: 'hero-executor',
      params: { magnitude: 2 },
      turn: 7,
    });
    recordEffectTrace(G, trace);
    assert.deepStrictEqual(G.diagnostics!.traces![0], trace);
  });

  it('caps the list at EFFECT_TRACES_CAP and counts dropped overflow', () => {
    const G = makeG();
    const overflow = 5;
    for (let i = 0; i < EFFECT_TRACES_CAP + overflow; i++) {
      recordEffectTrace(G, makeTrace({ effect: `e-${String(i)}` }));
    }
    assert.equal(G.diagnostics!.traces!.length, EFFECT_TRACES_CAP, 'the list never exceeds the cap');
    assert.equal(G.diagnostics!.tracesDropped, overflow, 'every trace past the cap is counted as dropped');
  });

  it('does not throw on a minimal G and produces a JSON-serializable channel', () => {
    const G = makeG(undefined);
    (G as { messages?: unknown }).messages = undefined; // why: narrow mock without a messages array.
    assert.doesNotThrow(() => recordEffectTrace(G, makeTrace()));
    const roundTripped = JSON.parse(JSON.stringify(G.diagnostics));
    assert.deepStrictEqual(roundTripped, G.diagnostics, 'no functions/Maps/Sets — clean JSON round-trip');
  });
});

// ---------------------------------------------------------------------------
// Villain caller-loop integration (executeVillainAbilities)
// ---------------------------------------------------------------------------

describe('executeVillainAbilities emits villain-executor traces', () => {
  const CTX = { currentPlayer: '0', turn: 4 };
  const VILLAIN = 'core/villain/x#0' as CardExtId;

  /** Builds a G exercising the villain executor for a single hook. */
  function makeVillainG(hook: VillainAbilityHook): LegendaryGameState {
    return {
      villainAbilityHooks: [hook],
      playerZones: {
        '0': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
        '1': { deck: [], hand: [], discard: [], inPlay: [], victory: [] },
      },
      piles: { bystanders: [], wounds: ['w0' as CardExtId], officers: [], sidekicks: [], horrors: [] },
      ko: [],
      attachedBystanders: {},
      cardTraits: {},
      messages: [],
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    } as unknown as LegendaryGameState;
  }

  function firstTrace(G: LegendaryGameState): EffectTrace {
    const traces = G.diagnostics?.traces ?? [];
    assert.ok(traces.length >= 1, 'at least one villain trace was emitted');
    return traces[0]!;
  }

  it('a resolved handler → fired, with the primitive as the string handler + scalar params', () => {
    const hook: VillainAbilityHook = {
      cardId: VILLAIN,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'gain-wound', target: 'current' }],
    };
    const G = makeVillainG(hook);
    executeVillainAbilities(G, CTX, VILLAIN, 'onFight');
    const trace = firstTrace(G);
    assert.equal(trace.status, 'fired');
    assert.equal(trace.fireSite, 'villain-executor');
    assert.equal(trace.effect, 'gain-wound');
    assert.equal(trace.handler, 'gain-wound', 'handler is the primitive map key (a string), never a function');
    assert.equal(typeof trace.handler, 'string');
    assert.equal(trace.scope, 'villain');
    assert.equal(trace.timing, 'onFight');
    assert.equal(trace.turn, 4, 'turn read from ctx.turn on the fight path');
    assert.deepStrictEqual(trace.params, { target: 'current' }, 'scalar param copied; undefined keys omitted');
    assertScalarParams(trace);
  });

  it('a deliberate-no-op primitive (become-scheme-twist) → no-op (by identity, not targets.length)', () => {
    const hook: VillainAbilityHook = {
      cardId: VILLAIN,
      timing: 'onEscape',
      keywords: [],
      effects: [{ primitive: 'become-scheme-twist' }],
    };
    const G = makeVillainG(hook);
    executeVillainAbilities(G, CTX, VILLAIN, 'onEscape');
    const trace = firstTrace(G);
    assert.equal(trace.status, 'no-op', 'the fixed no-op allowlist wins over any targets check');
    assert.equal(trace.effect, 'become-scheme-twist');
    assert.equal(trace.handler, 'become-scheme-twist');
  });

  it('a real-firing handler returning empty targets still reads fired (NOT no-op by targets.length)', () => {
    // why: reveal-or-wound legitimately returns { targets: [] }; it must read `fired`, not
    // `no-op` — proving the status is not keyed on targets.length. A malformed predicate
    // no-ops the mutation but the handler still ran (reachable).
    const hook: VillainAbilityHook = {
      cardId: VILLAIN,
      timing: 'onFight',
      keywords: [],
      effects: [{ primitive: 'reveal-or-wound', requireKind: 'team', requireValue: 'x-men' }],
    };
    const G = makeVillainG(hook);
    executeVillainAbilities(G, CTX, VILLAIN, 'onFight');
    const trace = firstTrace(G);
    assert.equal(trace.status, 'fired', 'a real handler that touched nothing is fired, never no-op');
    assert.equal(trace.effect, 'reveal-or-wound');
  });

  it('an unmapped primitive → no-handler (co-recorded as a hollow)', () => {
    const badDescriptor = { primitive: 'not-a-real-primitive' } as unknown as VillainEffectDescriptor;
    const hook: VillainAbilityHook = {
      cardId: VILLAIN,
      timing: 'onFight',
      keywords: [],
      effects: [badDescriptor],
    };
    const G = makeVillainG(hook);
    executeVillainAbilities(G, CTX, VILLAIN, 'onFight');
    const trace = firstTrace(G);
    assert.equal(trace.status, 'no-handler');
    assert.equal(trace.handler, '', 'no handler ran → empty-string label');
    assert.ok((G.diagnostics?.hollowEffects.length ?? 0) >= 1, 'a hollow record is co-recorded (unchanged behavior)');
  });
});

// ---------------------------------------------------------------------------
// Hero caller-loop integration (executeHeroEffects)
// ---------------------------------------------------------------------------

describe('executeHeroEffects emits hero-executor + hero-primitive traces', () => {
  const HERO = 'core/hero/spider-man#0' as CardExtId;
  // why: the FnContext WRAPPER shape executeHeroEffects reads — the turn lives on the nested ctx.
  const MOVE_CTX = {
    ctx: { turn: 6, currentPlayer: '0' },
    random: { Shuffle: <T,>(deck: T[]): T[] => [...deck].reverse() },
  };

  /** Builds a hero G exercising both hero sub-paths for a single hook. */
  function makeHeroG(hook: HeroAbilityHook): LegendaryGameState {
    return {
      heroAbilityHooks: [hook],
      playerZones: {
        '0': { deck: ['drawable#1' as CardExtId], hand: [], discard: [], inPlay: [HERO], victory: [] },
      },
      cardStats: {},
      cardDisplayData: {},
      messages: [],
      turnEconomy: { attack: 0, recruit: 0, spentAttack: 0, spentRecruit: 0, piercing: 0, woundsDrawn: 0 },
    } as unknown as LegendaryGameState;
  }

  it('a legacy hook.effects dispatch emits a hero-executor trace (fired)', () => {
    const hook = {
      cardId: HERO,
      timing: 'onPlay',
      conditions: [],
      effects: [{ type: 'draw', magnitude: 1 }],
    } as unknown as HeroAbilityHook;
    const G = makeHeroG(hook);
    executeHeroEffects(G, MOVE_CTX, '0', HERO);
    const traces = G.diagnostics?.traces ?? [];
    const executorTrace = traces.find((trace) => trace.fireSite === 'hero-executor');
    assert.ok(executorTrace, 'a hero-executor trace was emitted');
    assert.equal(executorTrace!.status, 'fired');
    assert.equal(executorTrace!.effect, 'draw');
    assert.equal(executorTrace!.handler, 'draw');
    assert.equal(executorTrace!.scope, 'hero');
    assert.equal(executorTrace!.turn, 6, 'turn read from the nested ctx.turn on the play path');
    assert.deepStrictEqual(executorTrace!.params, { magnitude: 1 }, 'scalar magnitude copied');
    assertScalarParams(executorTrace!);
  });

  it('a hook.primitiveEffects dispatch emits a hero-primitive trace (no-handler for an unknown node)', () => {
    // why: an unknown top-level node makes interpretHeroPrimitiveEffect return false (it warns
    // and defaults, never throws) → status no-handler, fireSite hero-primitive. This exercises
    // the second hero sub-path's emit without building a full valid composition AST.
    const hook = {
      cardId: HERO,
      timing: 'onPlay',
      conditions: [],
      primitiveEffects: [{ type: 'not-a-node' } as unknown as EffectNode],
    } as unknown as HeroAbilityHook;
    const G = makeHeroG(hook);
    executeHeroEffects(G, MOVE_CTX, '0', HERO);
    const traces = G.diagnostics?.traces ?? [];
    const primitiveTrace = traces.find((trace) => trace.fireSite === 'hero-primitive');
    assert.ok(primitiveTrace, 'a hero-primitive trace was emitted');
    assert.equal(primitiveTrace!.status, 'no-handler');
    assert.equal(primitiveTrace!.handler, '', 'no handler ran → empty-string label');
    assert.equal(primitiveTrace!.effect, 'not-a-node', 'effect is the node type token verbatim');
    assert.deepStrictEqual(primitiveTrace!.params, {}, 'a composition AST carries no flat scalar params');
  });
});
