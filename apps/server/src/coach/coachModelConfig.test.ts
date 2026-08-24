/**
 * Tests for the coach model-routing shim (model-independence).
 *
 * Proves the shim delivers the core claim: swapping the coach's model is a config
 * change (COACH_MODEL), not a code edit, and a swapped-in model does NOT inherit
 * another model's per-model quirks — Sonnet 5's disabled-thinking workaround stays
 * scoped to Sonnet 5. Pure function over an injected environment; no I/O.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCoachModelConfig,
  DEFAULT_COACH_MODEL,
} from './coachModelConfig.js';

test('defaults to Sonnet 5 with its disabled-thinking quirk when COACH_MODEL is unset', () => {
  const config = resolveCoachModelConfig({});
  assert.equal(config.model, DEFAULT_COACH_MODEL);
  assert.equal(config.model, 'claude-sonnet-5');
  assert.deepEqual(config.quirks.thinking, { type: 'disabled' });
  assert.equal(config.quirks.maxOutputTokens, 2048);
});

test('treats an empty COACH_MODEL as unset (falls back to the default model)', () => {
  const config = resolveCoachModelConfig({ COACH_MODEL: '' });
  assert.equal(config.model, 'claude-sonnet-5');
  assert.deepEqual(config.quirks.thinking, { type: 'disabled' });
});

test('a registered model selected via COACH_MODEL keeps its own quirks', () => {
  const config = resolveCoachModelConfig({ COACH_MODEL: 'claude-sonnet-5' });
  assert.equal(config.model, 'claude-sonnet-5');
  assert.deepEqual(config.quirks.thinking, { type: 'disabled' });
});

test('an unregistered model swaps in by config alone with default quirks and NO thinking directive', () => {
  // the model-independence proof: a new model is selected by config, and it does
  // not re-inherit Sonnet 5's disabled-thinking workaround — its thinking is
  // undefined (the client then sends no directive and uses the model's default).
  const config = resolveCoachModelConfig({ COACH_MODEL: 'claude-opus-5' });
  assert.equal(config.model, 'claude-opus-5');
  assert.equal(config.quirks.thinking, undefined);
  assert.equal(config.quirks.maxOutputTokens, 2048);
});
