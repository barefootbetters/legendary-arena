/**
 * Contract tests for the EffectTraceResolution sub-record (WP-706 / D-24528).
 *
 * Covers: the additive optional `resolution?` on `EffectTrace` (a base trace with
 * no resolution stays valid and omits the key), the JSON round-trip of a populated
 * resolution (scalars + the optional `countedInputs` string array), and the
 * `computedValue === magnitude × floor(count / perEach)` contract the capture site
 * upholds. This is a pure type/serialization contract — no game state, no dispatch.
 *
 * No boardgame.io imports. Uses node:test and node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EffectTrace, EffectTraceResolution } from './hollowEffect.types.js';

describe('EffectTraceResolution (WP-706 / D-24528)', () => {
  it('a base EffectTrace with no resolution is valid and omits the key', () => {
    // why: additive-optional — a non-count-scaled trace never carries `resolution`,
    // so the key must be absent (not `undefined`), matching the omit-when-absent posture.
    const trace: EffectTrace = {
      cardId: 'core/thor/surge-of-power#1',
      scope: 'hero',
      timing: 'onPlay',
      effect: 'attack',
      handler: 'attack',
      status: 'fired',
      fireSite: 'hero-executor',
      params: { magnitude: 2 },
      turn: 4,
    };
    assert.equal('resolution' in trace, false, 'a base trace omits the resolution key');
    assert.equal(trace.resolution, undefined);
  });

  it('round-trips a populated resolution (with countedInputs) through JSON', () => {
    const resolution: EffectTraceResolution = {
      countSource: 'distinct-hero-classes-played-this-turn',
      resource: 'attack',
      magnitude: 1,
      count: 3,
      perEach: 1,
      computedValue: 3,
      countedInputs: ['card-a#0', 'card-b#0', 'card-c#0'],
    };
    const trace: EffectTrace = {
      cardId: 'core/captain-america/perfect-teamwork#1',
      scope: 'hero',
      timing: 'onPlay',
      effect: 'attack-per-count',
      handler: 'attack-per-count',
      status: 'fired',
      fireSite: 'hero-executor',
      params: { magnitude: 1, countSource: 'distinct-hero-classes-played-this-turn' },
      turn: 7,
      resolution,
    };

    const roundTripped = JSON.parse(JSON.stringify(trace)) as EffectTrace;
    assert.deepStrictEqual(roundTripped.resolution, resolution, 'resolution survives a JSON round-trip verbatim');
    assert.deepStrictEqual(
      roundTripped.resolution!.countedInputs,
      ['card-a#0', 'card-b#0', 'card-c#0'],
      'the countedInputs string array survives',
    );
  });

  it('round-trips a resolution with countedInputs omitted (victory-pile source shape)', () => {
    // why: the victory-pile sources (victory-bystanders / shield-levels) carry no
    // countedInputs in this slice — the key must be absent, not an empty array.
    const resolution: EffectTraceResolution = {
      countSource: 'victory-bystanders',
      resource: 'attack',
      magnitude: 2,
      count: 3,
      perEach: 1,
      computedValue: 6,
    };
    assert.equal('countedInputs' in resolution, false, 'omitted countedInputs stays absent');
    const roundTripped = JSON.parse(JSON.stringify(resolution)) as EffectTraceResolution;
    assert.deepStrictEqual(roundTripped, resolution);
  });

  it('computedValue equals magnitude × floor(count / perEach) with a perEach divisor', () => {
    // why: pins the locked contract the capture site upholds — perEach=2, count=5 →
    // 1 × floor(5 / 2) = 2 (the "+1 for each 2 …" case).
    const magnitude = 1;
    const perEach = 2;
    const count = 5;
    const resolution: EffectTraceResolution = {
      countSource: 'shield-levels',
      resource: 'attack',
      magnitude,
      count,
      perEach,
      computedValue: magnitude * Math.floor(count / perEach),
    };
    assert.equal(resolution.computedValue, 2, 'floor(5 / 2) × 1 = 2');
  });
});
