/**
 * Tests for the effect-implementation index builder's mastermind-tactic feed
 * (WP-507 / D-24313). Run via `node --import tsx --test` (the repo forbids
 * `.test.mjs`); mirrors scripts/roadmap-counts.test.ts.
 *
 * The generator's CLI is guarded behind `isRunDirectly()`, so importing these
 * exported helpers runs no side effect (reads/writes nothing until called).
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  normalizeTactic,
  readMastermindTactics,
  buildSummary,
} from './build-effect-implementation-index.mjs';

describe('normalizeTactic — provenance overlay vs unmarked default (WP-507)', () => {
  it('applies a provenance overlay verbatim (executable + handler/wp/decision)', () => {
    const entry = normalizeTactic(
      'core-mastermind-magneto-crushing-shockwave',
      'Crushing Shockwave',
      'core',
      'crushing-shockwave',
      {
        status: 'executable',
        handler: 'packages/game-engine/src/rules/tacticHandlers.ts#resolveCrushingShockwave',
        wp: 'WP-506',
        decision: 'D-24312',
      },
    );
    assert.equal(entry.scope, 'mastermind');
    assert.equal(entry.mechanic, 'crushing-shockwave'); // mechanic = the tactic slug
    assert.equal(entry.set, 'core');
    assert.equal(entry.status, 'executable');
    assert.equal(entry.handler, 'packages/game-engine/src/rules/tacticHandlers.ts#resolveCrushingShockwave');
    assert.equal(entry.wp, 'WP-506');
    assert.equal(entry.decision, 'D-24312');
  });

  it('defaults an unmapped tactic to unmarked with blank handler/wp/decision (no fabrication)', () => {
    const entry = normalizeTactic(
      'core-mastermind-magneto-electromagnetic-bubble',
      'Electromagnetic Bubble',
      'core',
      'electromagnetic-bubble',
      undefined,
    );
    assert.equal(entry.scope, 'mastermind');
    assert.equal(entry.status, 'unmarked');
    assert.equal(entry.handler, '');
    assert.equal(entry.wp, '');
    assert.equal(entry.decision, '');
  });

  it('treats a malformed overlay (no status) as unmarked rather than trusting it', () => {
    const entry = normalizeTactic('x-mastermind-y-z', 'Z', 'x', 'z', { handler: 'h' });
    assert.equal(entry.status, 'unmarked');
  });
});

describe('readMastermindTactics — card-data enumeration + overlay resolution (WP-507)', () => {
  // why: a SYNTHETIC provenance map keeps the test hermetic — it does not depend on
  // the committed scripts/coverage/tactic-provenance.json, only on the card data
  // (deterministic) and the overlay-vs-default logic.
  const provenance = {
    'core-mastermind-magneto-crushing-shockwave': {
      status: 'executable',
      handler: 'packages/game-engine/src/rules/tacticHandlers.ts#resolveCrushingShockwave',
      wp: 'WP-506',
      decision: 'D-24312',
    },
  };
  const entries = readMastermindTactics(provenance);
  const byExtId = new Map(entries.map((entry) => [entry.extId, entry]));

  it('emits at least one mastermind tactic entry, every one scoped "mastermind"', () => {
    assert.ok(entries.length > 0, 'expected the card data to yield mastermind tactic entries');
    assert.ok(entries.every((entry) => entry.scope === 'mastermind'));
  });

  it('marks a provenance-mapped tactic executable with its handler', () => {
    const shockwave = byExtId.get('core-mastermind-magneto-crushing-shockwave');
    assert.ok(shockwave, 'Crushing Shockwave tactic should be enumerated from core card data');
    assert.equal(shockwave.status, 'executable');
    assert.equal(shockwave.wp, 'WP-506');
    assert.equal(shockwave.mechanic, 'crushing-shockwave');
  });

  it('marks a tactic absent from the overlay unmarked with blanks', () => {
    const bubble = byExtId.get('core-mastermind-magneto-electromagnetic-bubble');
    assert.ok(bubble, 'Electromagnetic Bubble tactic should be enumerated from core card data');
    assert.equal(bubble.status, 'unmarked');
    assert.equal(bubble.handler, '');
    assert.equal(bubble.wp, '');
    assert.equal(bubble.decision, '');
  });
});

describe('buildSummary — byScope.mastermind tally (WP-507)', () => {
  it('tallies mastermind entries into byScope.mastermind', () => {
    const summary = buildSummary([
      { extId: 'a', scope: 'hero', status: 'executable' },
      { extId: 'b', scope: 'mastermind', status: 'executable' },
      { extId: 'c', scope: 'mastermind', status: 'unmarked' },
    ]);
    assert.equal(summary.byScope.hero, 1);
    assert.equal(summary.byScope.villain, 0);
    assert.equal(summary.byScope.mastermind, 2);
    assert.equal(summary.totalEntries, 3);
  });
});
