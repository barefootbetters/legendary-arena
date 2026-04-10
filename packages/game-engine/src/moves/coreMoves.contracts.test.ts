/**
 * Contract tests for core move types, gating, and validators.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 * Tests verify locked contract values and drift-detection invariants.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CORE_MOVE_NAMES } from './coreMoves.types.js';
import type { CoreMoveName } from './coreMoves.types.js';
import { MOVE_ALLOWED_STAGES, isMoveAllowedInStage } from './coreMoves.gating.js';
import {
  validateDrawCardsArgs,
  validatePlayCardArgs,
  validateEndTurnArgs,
  validateMoveAllowedInStage,
} from './coreMoves.validate.js';

describe('coreMoves contracts', () => {
  describe('validateDrawCardsArgs', () => {
    it('accepts valid count', () => {
      const result = validateDrawCardsArgs({ count: 5 });
      assert.deepStrictEqual(result, { ok: true });
    });

    it('rejects negative count', () => {
      const result = validateDrawCardsArgs({ count: -1 });
      assert.strictEqual(result.ok, false);
    });

    it('rejects non-integer count', () => {
      const result = validateDrawCardsArgs({ count: 1.5 });
      assert.strictEqual(result.ok, false);
    });
  });

  describe('validatePlayCardArgs', () => {
    it('accepts valid cardId', () => {
      const result = validatePlayCardArgs({ cardId: 'some-ext-id' });
      assert.deepStrictEqual(result, { ok: true });
    });

    it('rejects empty cardId', () => {
      const result = validatePlayCardArgs({ cardId: '' });
      assert.strictEqual(result.ok, false);
    });
  });

  describe('isMoveAllowedInStage', () => {
    it('rejects playCard in start stage', () => {
      const result = isMoveAllowedInStage('playCard', 'start');
      assert.strictEqual(result, false);
    });

    it('allows drawCards in main stage', () => {
      const result = isMoveAllowedInStage('drawCards', 'main');
      assert.strictEqual(result, true);
    });

    it('allows endTurn in cleanup stage', () => {
      const result = isMoveAllowedInStage('endTurn', 'cleanup');
      assert.strictEqual(result, true);
    });
  });

  describe('drift detection', () => {
    // why: Failure here means a move name was added to the CoreMoveName union
    // type but not the CORE_MOVE_NAMES canonical array (or vice versa).
    it('CORE_MOVE_NAMES contains exactly the expected move names', () => {
      assert.deepStrictEqual(
        [...CORE_MOVE_NAMES],
        ['drawCards', 'playCard', 'endTurn'],
      );
    });

    // why: Failure here means a CoreMoveName was added without a corresponding
    // entry in MOVE_ALLOWED_STAGES. Every move must have stage gating defined.
    it('every CoreMoveName has a corresponding MOVE_ALLOWED_STAGES entry', () => {
      for (const moveName of CORE_MOVE_NAMES) {
        const stages = MOVE_ALLOWED_STAGES[moveName];
        assert.ok(
          Array.isArray(stages) && stages.length > 0,
          `MOVE_ALLOWED_STAGES is missing or empty for move "${moveName}".`,
        );
      }
    });
  });

  describe('validateMoveAllowedInStage', () => {
    it('rejects an unknown move name', () => {
      const result = validateMoveAllowedInStage('unknownMove', 'main');
      assert.strictEqual(result.ok, false);
    });

    it('rejects an unknown stage', () => {
      const result = validateMoveAllowedInStage('drawCards', 'unknownStage');
      assert.strictEqual(result.ok, false);
    });
  });

  describe('validateEndTurnArgs', () => {
    it('always returns ok: true', () => {
      const result = validateEndTurnArgs({});
      assert.deepStrictEqual(result, { ok: true });
    });
  });
});
