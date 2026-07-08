import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// why: this test guards `scripts/build-governance-snapshot.mjs`, which is a
// plain `.mjs` run by `node` (never tsx) and executes `main()` at import time.
// Importing it here would run the generator as a side effect and would also
// trip `vue-tsc` (a `.mjs` with no declaration file). Instead the test reads
// the generator source as text, extracts the canonical WORK_INDEX_ROW_PATTERN
// literal, and reconstructs it — so the assertions run against the SAME regex
// the generator ships, not a copy that could silently drift from it.
const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = resolve(TEST_FILE_DIR, '..', '..');
const REPO_ROOT = resolve(DASHBOARD_DIR, '..', '..');
const GENERATOR_PATH = resolve(DASHBOARD_DIR, 'scripts/build-governance-snapshot.mjs');
const WORK_INDEX_PATH = resolve(REPO_ROOT, 'docs/ai/work-packets/WORK_INDEX.md');

// A deliberately loose, format-agnostic detector for "this line is a WORK_INDEX
// WP status row." It recognizes the checkbox + `WP-NNN` prefix and the presence
// of a bold status token anywhere after it, WITHOUT caring how the connector or
// date are formatted. Every line this matches MUST also parse under the canonical
// pattern — that equality is the drift guard.
const LOOSE_WP_ROW_PATTERN = /^- \[(?:x| )\] WP-\d{3} — .*\*\*(?:Draft|Done|Ready|Blocked)/;

/**
 * Strip a leading UTF-8 byte-order mark (U+FEFF) if present, mirroring the
 * generator's own `stripBom`. Using a char-code check rather than a literal
 * BOM in a regex keeps this source free of the irregular whitespace the
 * no-irregular-whitespace lint rule rejects.
 */
function stripLeadingBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Extract the canonical WORK_INDEX_ROW_PATTERN from the generator source and
 * rebuild it as a live RegExp. Throws a full-sentence error if the declaration
 * cannot be found, so a rename of the constant fails loudly here rather than
 * silently skipping the drift assertions.
 */
function loadCanonicalPattern(): RegExp {
  const source = readFileSync(GENERATOR_PATH, 'utf-8');
  const declarationMatch = source.match(/^const WORK_INDEX_ROW_PATTERN = \/(.*)\/;\s*$/m);
  if (declarationMatch === null) {
    throw new Error(
      `Could not find the WORK_INDEX_ROW_PATTERN declaration in ${GENERATOR_PATH}; if the constant was renamed or reformatted, update workIndexRowPattern.test.ts to match.`,
    );
  }
  const patternBody = declarationMatch[1];
  if (patternBody === undefined) {
    throw new Error(
      `Found the WORK_INDEX_ROW_PATTERN declaration in ${GENERATOR_PATH} but could not capture the regex body; check the extraction pattern in workIndexRowPattern.test.ts.`,
    );
  }
  return new RegExp(patternBody);
}

const canonicalPattern = loadCanonicalPattern();

/**
 * Run the canonical pattern against a line and fail the test (rather than return
 * null) when it does not match. The return type is narrowed to a non-null match
 * so callers can read capture groups without a non-null assertion.
 */
function matchOrFail(line: string, context: string): RegExpExecArray {
  const match = canonicalPattern.exec(line);
  if (match === null) {
    assert.fail(
      `Expected the canonical WORK_INDEX_ROW_PATTERN to match ${context}, but it did not.`,
    );
  }
  return match;
}

interface PatternCase {
  readonly description: string;
  readonly line: string;
  readonly expectedStatus: string;
  readonly expectedDate: string | undefined;
}

// The three connector variants (`. `, ` — `, ` — ✅ `) crossed with the two date
// placements (outside vs inside the bold), plus a date-less draft row. These are
// the exact shapes observed across the real WORK_INDEX corpus.
const MATCHING_CASES: readonly PatternCase[] = [
  {
    description: 'the original form (period connector, date OUTSIDE the bold)',
    line: '- [x] WP-215 — Hero Rescue and Reveal-Draw Effects (Engine). **Done** 2026-06-05 (EC-241 impl).',
    expectedStatus: 'Done',
    expectedDate: '2026-06-05',
  },
  {
    description: 'the drifted form (em-dash connector, date INSIDE the bold)',
    line: '- [x] WP-328 — Turn.Step.Action Log Numbering (Game Engine + arena-client) — **Done 2026-07-08** (EC-358 impl).',
    expectedStatus: 'Done',
    expectedDate: '2026-07-08',
  },
  {
    description: 'the drifted form (em-dash + check-mark connector, date INSIDE the bold)',
    line: '- [x] WP-257 — Hollow Effect Detector (Engine Runtime Invariant) — ✅ **Done 2026-06-16** (EC-289 impl).',
    expectedStatus: 'Done',
    expectedDate: '2026-06-16',
  },
  {
    description: 'a date-less draft row (period connector, no date)',
    line: '- [ ] WP-400 — Some Future Feature (Engine). **Draft** Hard-deps: WP-1 ✅.',
    expectedStatus: 'Draft',
    expectedDate: undefined,
  },
];

test('canonical pattern parses every connector + date-placement variant', () => {
  for (const patternCase of MATCHING_CASES) {
    const match = matchOrFail(patternCase.line, patternCase.description);
    assert.equal(
      match[4],
      patternCase.expectedStatus,
      `status mismatch for ${patternCase.description}`,
    );
    assert.equal(
      match[5],
      patternCase.expectedDate,
      `date mismatch for ${patternCase.description}`,
    );
  }
});

test('canonical pattern preserves its five capture groups in order', () => {
  const match = matchOrFail(
    '- [x] WP-328 — Turn.Step.Action Log Numbering (Game Engine + arena-client) — **Done 2026-07-08** (EC-358 impl).',
    'the sample drifted row',
  );
  // Group order is a hard contract: parseWorkIndexRow reads match[2..5].
  const title = match[3] ?? '';
  assert.equal(match[1], 'x', 'group 1 = checkbox');
  assert.equal(match[2], '328', 'group 2 = WP number');
  assert.ok(title.startsWith('Turn.Step.Action'), 'group 3 = title');
  assert.equal(match[4], 'Done', 'group 4 = status');
  assert.equal(match[5], '2026-07-08', 'group 5 = date');
});

test('canonical pattern rejects prose lines that merely mention a WP', () => {
  const nonRows = [
    'This paragraph discusses WP-100 and the **Done** milestone in prose.',
    '- [x] WP-9 — too few digits in the number. **Done** 2026-01-01',
    '### WP-328 / EC-358 Executed — a STATUS.md heading, not a WORK_INDEX row (2026-07-08)',
  ];
  for (const line of nonRows) {
    assert.equal(canonicalPattern.exec(line), null, `expected no match for non-row: ${line}`);
  }
});

test('drift guard: every real WORK_INDEX WP row parses under the canonical pattern', () => {
  const content = stripLeadingBom(readFileSync(WORK_INDEX_PATH, 'utf-8'));
  const lines = content.split(/\r?\n/);

  const looseRows: string[] = [];
  const unparsedRows: string[] = [];
  let outsideBoldDateCount = 0;
  let insideBoldDateCount = 0;

  for (const line of lines) {
    if (!LOOSE_WP_ROW_PATTERN.test(line)) {
      continue;
    }
    looseRows.push(line);
    const match = canonicalPattern.exec(line);
    if (match === null) {
      unparsedRows.push(line.slice(0, 100));
      continue;
    }
    // Tally which date placement each parsed row used, so the corpus is proven
    // to exercise BOTH branches of the `(?:\*\* | )` date separator — not just
    // whichever one happens to dominate today.
    if (/\*\*(?:Draft|Done|Ready|Blocked)\*\* \d{4}-\d{2}-\d{2}/.test(line)) {
      outsideBoldDateCount += 1;
    } else if (/\*\*(?:Draft|Done|Ready|Blocked) \d{4}-\d{2}-\d{2}\*\*/.test(line)) {
      insideBoldDateCount += 1;
    }
  }

  assert.ok(
    looseRows.length > 100,
    `expected the real WORK_INDEX to hold >100 WP rows; found ${looseRows.length}`,
  );
  assert.deepEqual(
    unparsedRows,
    [],
    `every WORK_INDEX WP status row must parse under the canonical pattern, but ${unparsedRows.length} did not — the row format has drifted from the regex again. First offenders: ${unparsedRows.slice(0, 5).join(' | ')}`,
  );
  assert.ok(
    outsideBoldDateCount > 0,
    'expected at least one outside-bold-date row in the corpus to exercise that branch',
  );
  assert.ok(
    insideBoldDateCount > 0,
    'expected at least one inside-bold-date row in the corpus to exercise that branch',
  );
});
