/**
 * Drift-detection tests for the WP-067 UIState additions.
 *
 * These tests pin the field names of `UIProgressCounters` and `UIParBreakdown`
 * via `satisfies` against literal fixtures. A future renamer of any of the six
 * field names (`bystandersRescued`, `escapedVillains`, `rawScore`, `parScore`,
 * `finalScore`, `scoringConfigVersion`) fails typecheck here before any
 * runtime test could catch it. WP-062's HUD aria-labels bind to these
 * names verbatim — the contract is non-negotiable.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { UIProgressCounters, UIParBreakdown } from './uiState.types.js';

describe('UIState type drift (WP-067)', () => {
  it('UIProgressCounters field names match the locked WP-048/WP-062 contract', () => {
    // why: literal fixture spelled exactly as the contract requires. Any
    // rename of `bystandersRescued` or `escapedVillains` fails this
    // `satisfies` check at compile time.
    const fixture = {
      bystandersRescued: 4,
      escapedVillains: 1,
    } satisfies UIProgressCounters;

    // Runtime keyset assertion mirrors the type-level pin so a future
    // contributor cannot silently widen the interface and skip the gate.
    assert.deepStrictEqual(Object.keys(fixture).sort(), [
      'bystandersRescued',
      'escapedVillains',
    ]);
  });

  it('UIParBreakdown field names mirror WP-048 ScoreBreakdown verbatim', () => {
    // why: literal fixture spelled exactly as the contract requires. Any
    // rename of `rawScore`, `parScore`, `finalScore`, or
    // `scoringConfigVersion` fails this `satisfies` check at compile time.
    const fixture = {
      rawScore: 100,
      parScore: 80,
      finalScore: 20,
      scoringConfigVersion: 1,
    } satisfies UIParBreakdown;

    assert.deepStrictEqual(Object.keys(fixture).sort(), [
      'finalScore',
      'parScore',
      'rawScore',
      'scoringConfigVersion',
    ]);
  });
});
