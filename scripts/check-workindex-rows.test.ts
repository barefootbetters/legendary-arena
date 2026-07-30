/**
 * Tests for the local WORK_INDEX row-pattern check (WP-455 / EC-490).
 *
 * The pure helpers are data-injected — every case passes strings in, so the
 * test needs no file I/O and never imports/runs the generator or the check's
 * `main()` (which is guarded behind `isRunDirectly()`). Covers: extraction finds
 * the literal; extraction throws on a renamed constant; a conforming body yields
 * no offenders; the exact WP-453 `Drafted …; not yet executed` regression is
 * flagged; and a prose line that merely mentions a WP is not flagged.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractCanonicalPattern,
  findUnparsedWpRows,
} from './check-workindex-rows.mjs';

// A faithful copy of the generator's single-line declaration, used to prove the
// extractor pulls the exact regex body. (The production check reads this from
// the real generator source at runtime.)
const GENERATOR_SOURCE_SAMPLE = [
  '// preamble',
  'const WORK_INDEX_ROW_PATTERN = /^- \\[(x| )\\] WP-(\\d{3}) — (.+?)\\s+\\*\\*(Draft|Done|Ready|Blocked)(?:\\*\\* | )(\\d{4}-\\d{2}-\\d{2})?/;',
  'const OTHER = 1;',
].join('\n');

test('extractCanonicalPattern rebuilds the canonical regex from the generator source', () => {
  const pattern = extractCanonicalPattern(GENERATOR_SOURCE_SAMPLE);
  // A canonical inside-bold-date row parses, and the capture groups are intact.
  const match = pattern.exec(
    '- [x] WP-328 — Turn.Step.Action Log Numbering (Game Engine) — **Done 2026-07-08** (EC-358 impl).',
  );
  assert.notEqual(match, null);
  assert.equal(match?.[2], '328', 'group 2 = WP number');
  assert.equal(match?.[4], 'Done', 'group 4 = status');
  assert.equal(match?.[5], '2026-07-08', 'group 5 = date');
});

test('extractCanonicalPattern throws a full-sentence error when the declaration is renamed', () => {
  const renamed = GENERATOR_SOURCE_SAMPLE.replace(
    'WORK_INDEX_ROW_PATTERN',
    'WORK_INDEX_ROW_REGEX',
  );
  assert.throws(
    () => extractCanonicalPattern(renamed),
    /Could not find the WORK_INDEX_ROW_PATTERN declaration/,
  );
});

test('findUnparsedWpRows returns no offenders for a fully conforming body', () => {
  const pattern = extractCanonicalPattern(GENERATOR_SOURCE_SAMPLE);
  const content = [
    '# WORK_INDEX',
    '- [x] WP-215 — Hero Rescue (Engine). **Done** 2026-06-05 (EC-241 impl).',
    '- [x] WP-328 — Log Numbering (Engine) — **Done 2026-07-08** (EC-358 impl).',
    '- [ ] WP-455 — Local WORK_INDEX Row-Pattern Check — **Draft 2026-07-29** (EC-490).',
  ].join('\r\n');
  assert.deepEqual(findUnparsedWpRows(content, pattern), []);
});

test('findUnparsedWpRows flags the WP-453 Drafted-row regression', () => {
  const pattern = extractCanonicalPattern(GENERATOR_SOURCE_SAMPLE);
  const badRow =
    '- [ ] WP-453 — Gauntlet Loadout Qualification Guard — **Drafted 2026-07-29; not yet executed** (EC-488).';
  const content = ['# WORK_INDEX', badRow].join('\r\n');
  const offenders = findUnparsedWpRows(content, pattern);
  assert.equal(offenders.length, 1, 'the drifted row must be flagged');
  assert.ok(
    offenders[0]?.startsWith('- [ ] WP-453 — Gauntlet Loadout Qualification Guard'),
    'the offender is the WP-453 row',
  );
});

test('findUnparsedWpRows does not flag prose that merely mentions a WP', () => {
  const pattern = extractCanonicalPattern(GENERATOR_SOURCE_SAMPLE);
  const content = [
    'This paragraph discusses WP-100 and the **Done** milestone in prose.',
    '### WP-328 / EC-358 Executed — a STATUS.md heading, not a WORK_INDEX row.',
  ].join('\r\n');
  assert.deepEqual(findUnparsedWpRows(content, pattern), []);
});
