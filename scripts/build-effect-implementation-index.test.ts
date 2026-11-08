/**
 * Tests for the effect-implementation index builder's mastermind-tactic feed
 * (WP-507 / D-24313) and Master Strike feed (WP-867 / D-24810). Run via `node --import tsx --test` (the repo forbids
 * `.test.mjs`); mirrors scripts/roadmap-counts.test.ts.
 *
 * The generator's CLI is guarded behind `isRunDirectly()`, so importing these
 * exported helpers runs no side effect (reads/writes nothing until called).
 */

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeTactic,
  readMastermindTactics,
  readMastermindStrikes,
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

describe('readMastermindStrikes — one Master Strike row per Mastermind (WP-867 / D-24810)', () => {
  // why: a SYNTHETIC provenance map keeps the shape / default / verbatim cases hermetic —
  // they depend on the card data (deterministic) and the overlay-vs-default logic only.
  const syntheticProvenance = {
    'core-mastermind-magneto-master-strike': {
      status: 'executable',
      handler: 'packages/game-engine/src/rules/mastermindHandlers.ts#resolveMagnetoStrike',
      wp: 'WP-476',
      decision: 'D-24284',
    },
  };
  const tacticEntries = readMastermindTactics({});
  const syntheticEntries = readMastermindStrikes(syntheticProvenance, tacticEntries);
  const syntheticByExtId = new Map(syntheticEntries.map((entry) => [entry.extId, entry]));

  it('builds a strike row in the locked shape: mastermind scope, master-strike mechanic, "<name> Master Strike"', () => {
    const doom = syntheticByExtId.get('core-mastermind-dr-doom-master-strike');
    assert.ok(doom, 'Dr. Doom should yield a Master Strike row from core card data');
    assert.deepEqual(Object.keys(doom), [
      'extId',
      'name',
      'set',
      'scope',
      'mechanic',
      'status',
      'handler',
      'wp',
      'decision',
    ]);
    assert.equal(doom.name, 'Dr. Doom Master Strike');
    assert.equal(doom.set, 'core');
    assert.equal(doom.scope, 'mastermind');
    assert.equal(doom.mechanic, 'master-strike');
  });

  it('emits one row per Mastermind, every one scoped "mastermind" with mechanic "master-strike"', () => {
    assert.ok(syntheticEntries.length >= 100, `expected a row per Mastermind, got ${syntheticEntries.length}`);
    assert.ok(syntheticEntries.every((entry) => entry.scope === 'mastermind' && entry.mechanic === 'master-strike'));
    assert.equal(syntheticByExtId.size, syntheticEntries.length, 'every strike extId must be unique');
  });

  it('defaults a Mastermind absent from the overlay to unmarked with blank handler/wp/decision', () => {
    const doom = syntheticByExtId.get('core-mastermind-dr-doom-master-strike');
    assert.ok(doom);
    assert.equal(doom.status, 'unmarked');
    assert.equal(doom.handler, '');
    assert.equal(doom.wp, '');
    assert.equal(doom.decision, '');
  });

  it('applies an overlay row verbatim', () => {
    const magneto = syntheticByExtId.get('core-mastermind-magneto-master-strike');
    assert.ok(magneto);
    assert.equal(magneto.status, 'executable');
    assert.equal(magneto.handler, 'packages/game-engine/src/rules/mastermindHandlers.ts#resolveMagnetoStrike');
    assert.equal(magneto.wp, 'WP-476');
    assert.equal(magneto.decision, 'D-24284');
  });

  it('fails on an overlay key that matches no Mastermind in the card data', () => {
    assert.throws(
      () =>
        readMastermindStrikes(
          { 'core-mastermind-no-such-mastermind-master-strike': { status: 'executable' } },
          tacticEntries,
        ),
      /The Master Strike provenance overlay row "core-mastermind-no-such-mastermind-master-strike" matches no Mastermind in the card data\./,
    );
  });

  it('fails when a strike extId is also a mastermind tactic extId (same-scope ids would merge silently)', () => {
    const collidingTactic = normalizeTactic(
      'core-mastermind-magneto-master-strike',
      'Synthetic Colliding Tactic',
      'core',
      'master-strike',
      undefined,
    );
    assert.throws(
      () => readMastermindStrikes({}, [collidingTactic]),
      /The Master Strike ext_id "core-mastermind-magneto-master-strike" from .* is also a mastermind tactic ext_id\./,
    );
  });

  it('reads the committed overlay: core Magneto is executable, an unmapped Mastermind is unmarked', () => {
    // why: one real-data row per status, read from the committed
    // scripts/coverage/strike-provenance.json (resolved from this file, not the cwd).
    const overlayPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'coverage', 'strike-provenance.json');
    const committed = JSON.parse(readFileSync(overlayPath, 'utf8')) as { strikes: Record<string, object> };
    const realEntries = readMastermindStrikes(committed.strikes, readMastermindTactics({}));
    const realByExtId = new Map(realEntries.map((entry) => [entry.extId, entry]));

    const magneto = realByExtId.get('core-mastermind-magneto-master-strike');
    assert.ok(magneto);
    assert.equal(magneto.status, 'executable');
    assert.equal(magneto.handler, 'packages/game-engine/src/rules/mastermindHandlers.ts#resolveMagnetoStrike');

    const darrenCross = realByExtId.get('amwp-mastermind-darren-cross-master-strike');
    assert.ok(darrenCross, 'Darren Cross should yield a Master Strike row from amwp card data');
    assert.equal(darrenCross.status, 'unmarked');
    assert.equal(darrenCross.handler, '');
  });
});
