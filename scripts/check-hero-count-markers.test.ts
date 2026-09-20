/**
 * Tests for the per-hero-class count-marker gap gate (WP-711 / D-24534 follow-up).
 *
 * The pure helpers are data-injected — the classification cases pass strings in,
 * so they need no file I/O and never run the guarded `main()`. A final case runs
 * the real corpus scan and asserts there is no unmarked, non-deferred per-class
 * count line (and no stale deferred entry) — the same assertion the CI `--check`
 * gate enforces, exercised in the normal test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCountClauseClass,
  markerPresentFor,
  evaluateLine,
  scanCorpus,
  findGaps,
  findStaleDeferred,
} from './check-hero-count-markers.mjs';

test('parseCountClauseClass matches every real spacing/noun variant and captures the class', () => {
  // Arc Reactor: "other[hc:tech]" (no space), noun "Hero".
  assert.equal(
    parseCountClauseClass('[hc:tech]: You get +1[icon:attack] for each other[hc:tech] Hero you played this turn.'),
    'tech',
  );
  // Overloaded Unibeam: "other [hc:tech]" (space), noun "Hero".
  assert.equal(
    parseCountClauseClass('[hc:tech]: You get +1[icon:attack] for each other [hc:tech] Hero you played this turn.'),
    'tech',
  );
  // It's Clobberin' Time!: "[hc:strength]card" (no space), noun "card".
  assert.equal(
    parseCountClauseClass('[hc:strength]: You get +3[icon:attack]for each other [hc:strength]card you played this turn.'),
    'strength',
  );
  // Absorb Energies: capital "For", "you have played this turn".
  assert.equal(
    parseCountClauseClass('[hc:ranged]: For each other [hc:ranged] Hero you have played this turn, you get+1[icon:recruit].'),
    'ranged',
  );
  // Villains-set "Ally" flavor still matches (it is a per-class count clause).
  assert.equal(
    parseCountClauseClass('[hc:tech]: You get +1[icon:attack] for each other [hc:tech] Ally you played this turn.'),
    'tech',
  );
});

test('parseCountClauseClass returns null for non-per-class count families and plain lines', () => {
  // color/distinct-hero-classes family — no [hc:X] noun clause.
  assert.equal(parseCountClauseClass('You get +1[icon:attack] for each color of Hero you have.'), null);
  // team family — "Avenger", no [hc:X].
  assert.equal(parseCountClauseClass('You get +3[icon:attack] for each other Avenger you played this turn.'), null);
  // a plain non-count ability.
  assert.equal(parseCountClauseClass('Draw a card. [keyword:draw:1]'), null);
});

test('markerPresentFor recognizes the attack and recruit markers for the matching class only', () => {
  const attackLine =
    '[hc:tech]: You get +1[icon:attack] for each other[hc:tech] Hero you played this turn. [keyword:attack-per-count:tech-heroes-played-this-turn:1]';
  assert.equal(markerPresentFor(attackLine, 'tech'), true);
  // Wrong class → not satisfied (guards against a mismatched marker).
  assert.equal(markerPresentFor(attackLine, 'ranged'), false);

  const recruitLine =
    '[hc:ranged]: For each other [hc:ranged] Hero you have played this turn, you get+1[icon:recruit]. [keyword:recruit-per-count:ranged-heroes-played-this-turn:1]';
  assert.equal(markerPresentFor(recruitLine, 'ranged'), true);

  // why: WP-714 / D-24537 — the kidnap-per-count marker (Genetic Experimentation)
  // satisfies a per-class count clause exactly as the attack/recruit markers do.
  const kidnapLine =
    '[hc:tech]: Kidnap a Bystander for each other [hc:tech] Ally you played this turn. [keyword:kidnap-per-count:tech-heroes-played-this-turn:1]';
  assert.equal(markerPresentFor(kidnapLine, 'tech'), true);
  assert.equal(markerPresentFor(kidnapLine, 'ranged'), false);
});

test('evaluateLine flags an unmarked count line and clears a marked one', () => {
  const unmarked = '[hc:strength]: You get +3[icon:attack]for each other [hc:strength]card you played this turn.';
  assert.deepEqual(evaluateLine(unmarked), { isCountLine: true, heroClass: 'strength', marked: false });

  const marked = `${unmarked} [keyword:attack-per-count:strength-heroes-played-this-turn:3]`;
  assert.deepEqual(evaluateLine(marked), { isCountLine: true, heroClass: 'strength', marked: true });
});

test('the committed corpus has no unmarked, non-deferred per-class count line', () => {
  const scanned = scanCorpus();
  // Sanity: the scanner actually found the family (guards against a silent regex break).
  assert.ok(scanned.length > 0, 'the scan should find at least one per-class count line');

  const gaps = findGaps(scanned);
  assert.equal(
    gaps.length,
    0,
    `unmarked per-class count line(s): ${gaps.map((g) => `${g.set}/${g.hero}/${g.card}[${g.abilityIndex}]`).join(', ')}`,
  );

  const stale = findStaleDeferred(scanned);
  assert.equal(
    stale.length,
    0,
    `stale deferred entry(ies): ${stale.map((d) => `${d.set}/${d.hero}/${d.card}[${d.abilityIndex}]`).join(', ')}`,
  );
});
