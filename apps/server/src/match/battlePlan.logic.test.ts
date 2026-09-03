/**
 * Tests for the Battle Plan pure logic (WP-635 / EC-670).
 *
 * Pure: no database, no HTTP, no boardgame.io. Covers the update-input validator
 * (accept + each reject branch, including the empty-string-clears case and the
 * length cap), the BATTLE_PLAN_PHASES drift assertion (array ⇔ union, forward +
 * backward + length), the closed-set phase→column map, and the view projection
 * (strips the audit-only updatedByExtId + createdAt).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BATTLE_PLAN_PHASE_MAX_LENGTH,
  phaseColumnFor,
  toBattlePlanView,
  validateUpdateBattlePlanInput,
} from './battlePlan.logic.js';
import {
  BATTLE_PLAN_PHASES,
  type BattlePlanPhase,
  type BattlePlanRecord,
} from './battlePlan.types.js';

describe('validateUpdateBattlePlanInput (WP-635)', () => {
  test('accepts a well-formed body for every phase', () => {
    for (const phase of BATTLE_PLAN_PHASES) {
      const result = validateUpdateBattlePlanInput({ phase, text: 'go for the win' });
      assert.ok(result.ok === true, phase);
      assert.deepEqual(result.value, { phase, text: 'go for the win' });
    }
  });

  test('accepts an empty string (clears the phase) — does NOT trim', () => {
    const result = validateUpdateBattlePlanInput({ phase: 'pre_battle', text: '' });
    assert.ok(result.ok === true);
    assert.equal(result.value.text, '');
  });

  test('preserves leading/trailing whitespace (no trim)', () => {
    const result = validateUpdateBattlePlanInput({
      phase: 'post_battle',
      text: '  keep my spacing  ',
    });
    assert.ok(result.ok === true);
    assert.equal(result.value.text, '  keep my spacing  ');
  });

  test('rejects a non-object body with invalid_request', () => {
    for (const body of [null, undefined, 'string', 42, []]) {
      const result = validateUpdateBattlePlanInput(body);
      assert.ok(result.ok === false, String(body));
      assert.equal(result.code, 'invalid_request');
    }
  });

  test('rejects an unknown / missing phase with unknown_phase', () => {
    for (const phase of [undefined, 'PRE_BATTLE', 'debrief', 42, null]) {
      const result = validateUpdateBattlePlanInput({ phase, text: 'x' });
      assert.ok(result.ok === false, String(phase));
      assert.equal(result.code, 'unknown_phase');
    }
  });

  test('rejects a non-string text with invalid_request', () => {
    for (const text of [undefined, 42, null, {}, []]) {
      const result = validateUpdateBattlePlanInput({ phase: 'pre_battle', text });
      assert.ok(result.ok === false, String(text));
      assert.equal(result.code, 'invalid_request');
    }
  });

  test('accepts text at the exact length bound', () => {
    const result = validateUpdateBattlePlanInput({
      phase: 'battle_adjustments',
      text: 'x'.repeat(BATTLE_PLAN_PHASE_MAX_LENGTH),
    });
    assert.ok(result.ok === true);
  });

  test('rejects text one over the length bound with text_too_long', () => {
    const result = validateUpdateBattlePlanInput({
      phase: 'battle_adjustments',
      text: 'x'.repeat(BATTLE_PLAN_PHASE_MAX_LENGTH + 1),
    });
    assert.ok(result.ok === false);
    assert.equal(result.code, 'text_too_long');
  });
});

describe('BATTLE_PLAN_PHASES drift (WP-635)', () => {
  // why: an exhaustive switch fails at type-check time if a union member is added
  // without a case; the array-membership + length checks fail at runtime if the
  // array and union diverge. Both directions must hold (code-style §Drift Detection).
  function assertPhaseExhaustive(value: BattlePlanPhase): void {
    switch (value) {
      case 'pre_battle':
      case 'battle_adjustments':
      case 'post_battle':
        return;
      default: {
        const unhandled: never = value;
        throw new Error(`Drift: unhandled BattlePlanPhase ${String(unhandled)}`);
      }
    }
  }

  test('BATTLE_PLAN_PHASES matches the BattlePlanPhase union exactly', () => {
    BATTLE_PLAN_PHASES.forEach(assertPhaseExhaustive);
    assert.deepEqual(
      [...BATTLE_PLAN_PHASES],
      ['pre_battle', 'battle_adjustments', 'post_battle'],
    );
    assert.equal(BATTLE_PLAN_PHASES.length, 3);
  });
});

describe('phaseColumnFor (WP-635)', () => {
  test('maps each phase to its identically-named column via the closed-set switch', () => {
    assert.equal(phaseColumnFor('pre_battle'), 'pre_battle');
    assert.equal(phaseColumnFor('battle_adjustments'), 'battle_adjustments');
    assert.equal(phaseColumnFor('post_battle'), 'post_battle');
  });

  test('resolves every phase in the canonical array', () => {
    for (const phase of BATTLE_PLAN_PHASES) {
      assert.equal(phaseColumnFor(phase), phase);
    }
  });
});

describe('toBattlePlanView (WP-635)', () => {
  const RECORD: BattlePlanRecord = {
    matchId: 'match-abc',
    preBattle: 'read the mastermind',
    battleAdjustments: 'shift to KO focus',
    postBattle: null,
    updatedByExtId: '4f2219e4-secret-account',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T01:00:00.000Z',
  };

  test('projects the client fields and preserves null phases', () => {
    const view = toBattlePlanView(RECORD);
    assert.deepEqual(view, {
      matchId: 'match-abc',
      preBattle: 'read the mastermind',
      battleAdjustments: 'shift to KO focus',
      postBattle: null,
      updatedAt: '2026-09-02T01:00:00.000Z',
    });
  });

  test('never carries the audit-only updatedByExtId or createdAt across the boundary', () => {
    const view = toBattlePlanView(RECORD) as Record<string, unknown>;
    assert.equal('updatedByExtId' in view, false);
    assert.equal('createdAt' in view, false);
  });
});
