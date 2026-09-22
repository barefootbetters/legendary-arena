/**
 * Tests for the coach model-routing shim (model-independence).
 *
 * Proves the shim delivers the core claim: swapping the coach's model is a config
 * change (COACH_MODEL), not a code edit, and each registered model keeps its own
 * quirk row. The registry is an allowlist (D-24559): an unregistered model, even a
 * prototype key, falls back to the default model and its quirks instead of being
 * sent to the API. Pure function over an injected environment; no I/O.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCoachModelConfig,
  lookupCoachModelQuirks,
  DEFAULT_COACH_MODEL,
} from './coachModelConfig.js';

/** The models seeded in the quirk registry at the time of writing. */
const SEEDED_MODELS = ['claude-sonnet-5', 'claude-opus-5', 'claude-sonnet-4-6'];

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

test('pre-seeds Opus 5 with low effort and thinking left ON (no disabled directive)', () => {
  // Opus 5 keeps thinking on (disabling it is discouraged and 400s at high effort
  // levels); the quirk is low effort + a roomier cap, NOT a disabled-thinking row.
  const config = resolveCoachModelConfig({ COACH_MODEL: 'claude-opus-5' });
  assert.equal(config.model, 'claude-opus-5');
  assert.equal(config.quirks.thinking, undefined);
  assert.equal(config.quirks.effort, 'low');
  assert.equal(config.quirks.maxOutputTokens, 4096);
});

test('pre-seeds Sonnet 4.6 with no thinking directive (off by default on 4.6)', () => {
  const config = resolveCoachModelConfig({ COACH_MODEL: 'claude-sonnet-4-6' });
  assert.equal(config.model, 'claude-sonnet-4-6');
  assert.equal(config.quirks.thinking, undefined);
  assert.equal(config.quirks.effort, undefined);
  assert.equal(config.quirks.maxOutputTokens, 2048);
});

test('an unregistered model falls back to the default model and its quirks, naming the refused id', () => {
  // D-24559: the registry is an allowlist. An unregistered model is never sent to
  // the API with no thinking directive (the EC-629 empty-response failure class);
  // the coach stays up on the known-good default and the refused id is carried
  // so the server can warn about it.
  const config = resolveCoachModelConfig({ COACH_MODEL: 'claude-unregistered-test-model' });
  assert.equal(config.model, DEFAULT_COACH_MODEL);
  assert.deepEqual(config.quirks, lookupCoachModelQuirks(DEFAULT_COACH_MODEL));
  assert.deepEqual(config.quirks.thinking, { type: 'disabled' });
  assert.equal(config.fallbackFromModel, 'claude-unregistered-test-model');
});

test('registered, unset and empty resolutions carry no fallbackFromModel', () => {
  for (const model of SEEDED_MODELS) {
    const config = resolveCoachModelConfig({ COACH_MODEL: model });
    assert.equal(config.model, model);
    assert.equal(config.fallbackFromModel, undefined);
    assert.equal(Object.hasOwn(config, 'fallbackFromModel'), false);
  }
  const unsetConfig = resolveCoachModelConfig({});
  assert.equal(Object.hasOwn(unsetConfig, 'fallbackFromModel'), false);
  const emptyConfig = resolveCoachModelConfig({ COACH_MODEL: '' });
  assert.equal(Object.hasOwn(emptyConfig, 'fallbackFromModel'), false);
});

test('a prototype key as COACH_MODEL falls back instead of resolving a function as quirks', () => {
  for (const prototypeKey of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const config = resolveCoachModelConfig({ COACH_MODEL: prototypeKey });
    assert.equal(config.model, DEFAULT_COACH_MODEL);
    assert.equal(typeof config.quirks, 'object');
    assert.equal(config.quirks.maxOutputTokens, 2048);
    assert.equal(config.fallbackFromModel, prototypeKey);
  }
});

test('lookupCoachModelQuirks returns the row for each seeded model', () => {
  for (const model of SEEDED_MODELS) {
    const quirks = lookupCoachModelQuirks(model);
    assert.notEqual(quirks, undefined);
    assert.deepEqual(quirks, resolveCoachModelConfig({ COACH_MODEL: model }).quirks);
  }
});

test('lookupCoachModelQuirks returns undefined for an unknown id and for prototype keys', () => {
  assert.equal(lookupCoachModelQuirks('claude-unregistered-test-model'), undefined);
  assert.equal(lookupCoachModelQuirks('toString'), undefined);
  assert.equal(lookupCoachModelQuirks('constructor'), undefined);
  assert.equal(lookupCoachModelQuirks(''), undefined);
});

test('every registry row has a positive output-token cap', () => {
  for (const model of SEEDED_MODELS) {
    const quirks = lookupCoachModelQuirks(model);
    assert.ok(quirks !== undefined && quirks.maxOutputTokens > 0, `${model} needs a positive maxOutputTokens.`);
  }
});
