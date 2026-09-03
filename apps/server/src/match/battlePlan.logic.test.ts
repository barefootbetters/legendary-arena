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
  guestEditorId,
  phaseColumnFor,
  toBattlePlanView,
  validateUpdateBattlePlanInput,
  verifyGuestSeatCredential,
} from './battlePlan.logic.js';
import {
  BATTLE_PLAN_PHASES,
  GUEST_EDITOR_ID_PREFIX,
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

describe('verifyGuestSeatCredential (WP-638)', () => {
  const SEAT_CREDENTIALS = { '0': 'host-cred-aaaa', '1': 'guest-cred-bbbb' };

  test('true only when the supplied credential matches the seat exactly', () => {
    assert.equal(
      verifyGuestSeatCredential(SEAT_CREDENTIALS, '1', 'guest-cred-bbbb'),
      true,
    );
  });

  test('false for a wrong credential of the same length', () => {
    // why: same length as the stored credential, so the length precheck passes and
    // the timingSafeEqual byte compare is what rejects it — the real constant-time path.
    assert.equal(
      verifyGuestSeatCredential(SEAT_CREDENTIALS, '1', 'guest-cred-XXXX'),
      false,
    );
  });

  test('false for a wrong credential of a different length (length guard, no throw)', () => {
    // why: timingSafeEqual throws on unequal-length buffers; a false here (not a throw)
    // proves the length precheck guards it.
    assert.equal(verifyGuestSeatCredential(SEAT_CREDENTIALS, '1', 'short'), false);
    assert.equal(
      verifyGuestSeatCredential(SEAT_CREDENTIALS, '1', 'guest-cred-bbbb-and-then-some'),
      false,
    );
  });

  test('false for a seat absent from the map (no seat-existence oracle)', () => {
    // why: an absent seat returns the SAME false a wrong credential returns, so the
    // caller cannot distinguish "no such seat" from "wrong credential".
    assert.equal(verifyGuestSeatCredential(SEAT_CREDENTIALS, '9', 'anything'), false);
    assert.equal(verifyGuestSeatCredential({}, '1', 'guest-cred-bbbb'), false);
  });

  test('false against an empty supplied credential', () => {
    assert.equal(verifyGuestSeatCredential(SEAT_CREDENTIALS, '1', ''), false);
  });
});

describe('guestEditorId (WP-638)', () => {
  test('formats the audit id as guest:<playerId> with the locked prefix', () => {
    assert.equal(guestEditorId('1'), 'guest:1');
    assert.equal(guestEditorId('0'), 'guest:0');
    assert.equal(GUEST_EDITOR_ID_PREFIX, 'guest:');
    assert.ok(guestEditorId('3').startsWith(GUEST_EDITOR_ID_PREFIX));
  });
});
