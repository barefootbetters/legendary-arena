/**
 * Tests for the effect-implementation index builder's mastermind-tactic feed
 * (WP-507 / D-24313), Master Strike feed (WP-867 / D-24810) and Scheme feed
 * (WP-879 / D-24828). Run via `node --import tsx --test` (the repo forbids
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
  readSchemes,
  classifySchemeLine,
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

describe('classifySchemeLine — the locked two-step label rule (WP-879 / D-24828)', () => {
  it('maps a plain labelled line through the closed map', () => {
    assert.equal(classifySchemeLine('Setup: 8 Twists.'), 'setup');
    assert.equal(classifySchemeLine('Special Rules: Each Villain gets +1 attack.'), 'special-rules');
    assert.equal(classifySchemeLine('Evil Wins: If the Wound stack runs out.'), 'evil-wins');
    assert.equal(classifySchemeLine('When the players win: Each player gains a card.'), 'good-wins');
  });

  it('strips a comma-list Twist number (anni Pulse Waves "Twist 1,3,5,7:")', () => {
    assert.equal(classifySchemeLine('Twist 1,3,5,7: “Negative Pulse“: This turn, Heroes in the HQ cost -1.'), 'twist');
  });

  it('strips an "and"-list Twist number (dstr Duels "Twist 1, 3, and 5:")', () => {
    assert.equal(classifySchemeLine('Twist 1, 3, and 5: “Duel of Science“: Each player reveals a Hero.'), 'twist');
    assert.equal(classifySchemeLine('Twist 7-11: “Duel of Science and Magic“: Same effect.'), 'twist');
  });

  it('strips a trailing quoted title before the number list (wpnx "Twist 7“Unleash Weapon X“:")', () => {
    assert.equal(classifySchemeLine('Twist 7“Unleash Weapon X“: For each Wolverine Hero in the HQ, gain a Wound.'), 'twist');
    assert.equal(classifySchemeLine('Twist 2,4,6“Test the Subject’s Healing Factor“: Each player discards.'), 'twist');
  });

  it('folds an unlabelled line into special-rules (dead "Nobody Eats Just One Chimichanga!")', () => {
    assert.equal(classifySchemeLine('Nobody Eats Just One Chimichanga! Whenever you play a Chimichanga, play another.'), 'special-rules');
    assert.equal(classifySchemeLine('[hc:tech] Heroes cost 1 less.'), 'special-rules');
    assert.equal(classifySchemeLine('{"points": 3}'), 'special-rules');
  });
});

describe('readSchemes — one row per (Scheme, printed line kind) (WP-879 / D-24828)', () => {
  // why: a SYNTHETIC overlay keeps the shape / default / verbatim cases hermetic; they
  // depend on the card data (deterministic) and the overlay-vs-default logic only.
  const syntheticProvenance = {
    'ca75-scheme-brainwash-the-military': {
      twist: {
        status: 'executable',
        handler: 'packages/game-engine/src/rules/schemeTwistResolvers.ts#brainwash-the-military',
        wp: 'WP-823',
        decision: 'D-24756',
      },
    },
  };
  const entries = readSchemes(syntheticProvenance);

  /**
   * Lists the sorted mechanics the scheme feed emitted for one Scheme.
   *
   * @param extId - the Scheme ext_id.
   * @returns the sorted mechanic list.
   */
  function mechanicsOf(extId: string): string[] {
    return entries
      .filter((entry) => entry.extId === extId)
      .map((entry) => entry.mechanic)
      .sort();
  }

  /**
   * Finds one emitted scheme row.
   *
   * @param extId - the Scheme ext_id.
   * @param mechanic - the line kind.
   * @returns the row, or undefined.
   */
  function rowOf(extId: string, mechanic: string) {
    return entries.find((entry) => entry.extId === extId && entry.mechanic === mechanic);
  }

  it('emits 664 rows, every one scoped "scheme", with no duplicate (extId, mechanic)', () => {
    assert.equal(entries.length, 664);
    assert.ok(entries.every((entry) => entry.scope === 'scheme'));
    const keys = new Set(entries.map((entry) => `${entry.extId}|${entry.mechanic}`));
    assert.equal(keys.size, entries.length);
  });

  it('builds a row in the locked shape: ext_id grammar, Scheme name, file-level abbr', () => {
    const row = rowOf('ca75-scheme-brainwash-the-military', 'setup');
    assert.ok(row, 'Brainwash the Military should yield a setup row');
    assert.deepEqual(Object.keys(row), ['extId', 'name', 'set', 'scope', 'mechanic', 'status', 'handler', 'wp', 'decision']);
    assert.equal(row.name, 'Brainwash the Military');
    assert.equal(row.set, 'ca75');
  });

  it('emits one row per distinct mechanic (Brainwash: 4 rows from 5 lines, two of them Twists)', () => {
    assert.deepEqual(mechanicsOf('ca75-scheme-brainwash-the-military'), ['evil-wins', 'setup', 'special-rules', 'twist']);
  });

  it('counts a loss printed on a Twist line in the twist row (Cosmic Cube has no evil-wins row)', () => {
    assert.deepEqual(mechanicsOf('core-scheme-unleash-the-power-of-the-cosmic-cube'), ['setup', 'twist']);
  });

  it('gives comma-list, and-list and quoted-title Twist Schemes no spurious special-rules row', () => {
    assert.deepEqual(mechanicsOf('anni-scheme-pulse-waves-from-the-negative-zone'), ['setup', 'twist']);
    assert.deepEqual(mechanicsOf('dstr-scheme-duels-of-science-and-magic'), ['evil-wins', 'setup', 'twist']);
    assert.deepEqual(mechanicsOf('wpnx-scheme-condition-logan-into-weapon-x'), ['setup', 'twist']);
  });

  it('folds an unlabelled printed line into a special-rules row (dead Chimichanga)', () => {
    assert.deepEqual(mechanicsOf('dead-scheme-deadpool-wants-a-chimichanga'), ['evil-wins', 'setup', 'special-rules', 'twist']);
  });

  it('applies an overlay row verbatim and defaults every other line to unmarked with blanks', () => {
    const twist = rowOf('ca75-scheme-brainwash-the-military', 'twist');
    assert.ok(twist);
    assert.equal(twist.status, 'executable');
    assert.equal(twist.handler, 'packages/game-engine/src/rules/schemeTwistResolvers.ts#brainwash-the-military');
    assert.equal(twist.wp, 'WP-823');
    assert.equal(twist.decision, 'D-24756');

    const sneakAttack = rowOf('anni-scheme-sneak-attack-the-heroes-homes', 'twist');
    assert.ok(sneakAttack, 'Sneak Attack the Heroes Homes should yield a twist row');
    assert.equal(sneakAttack.status, 'unmarked');
    assert.equal(sneakAttack.handler, '');
    assert.equal(sneakAttack.wp, '');
    assert.equal(sneakAttack.decision, '');
  });

  it('fails on an overlay key that matches no Scheme in the card data', () => {
    assert.throws(
      () => readSchemes({ 'core-scheme-no-such-scheme': { twist: { status: 'unmarked' } } }),
      /The Scheme provenance overlay row "core-scheme-no-such-scheme" matches no Scheme in the card data\./,
    );
  });

  it('fails on an overlay mechanic the Scheme does not print', () => {
    assert.throws(
      () => readSchemes({ 'core-scheme-unleash-the-power-of-the-cosmic-cube': { 'evil-wins': { status: 'unmarked' } } }),
      /"core-scheme-unleash-the-power-of-the-cosmic-cube" mechanic "evil-wins" matches no line that Scheme prints/,
    );
  });

  it('fails on an executable overlay row with a blank handler', () => {
    assert.throws(
      () =>
        readSchemes({
          'core-scheme-portals-to-the-dark-dimension': { twist: { status: 'executable', handler: ' ', wp: '', decision: '' } },
        }),
      /"core-scheme-portals-to-the-dark-dimension" mechanic "twist" is "executable" with a blank handler\./,
    );
  });

  it('tallies scheme entries into byScope.scheme', () => {
    const summary = buildSummary(entries);
    assert.equal(summary.byScope.scheme, entries.length);
    assert.equal(summary.byScope.mastermind, 0);
  });

  it('reads the committed overlay: Brainwash is executable on all four rows, each naming a handler', () => {
    // why: one real-data pass over scripts/coverage/scheme-provenance.json (resolved from this
    // file, not the cwd); readSchemes throws on an orphan or a blank executable handler.
    const overlayPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'coverage', 'scheme-provenance.json');
    const committed = JSON.parse(readFileSync(overlayPath, 'utf8')) as { schemes: Record<string, Record<string, object>> };
    const realEntries = readSchemes(committed.schemes);
    const brainwash = realEntries.filter((entry) => entry.extId === 'ca75-scheme-brainwash-the-military');
    assert.equal(brainwash.length, 4);
    assert.ok(brainwash.every((entry) => entry.status === 'executable' && entry.handler.length > 0));
  });
});
