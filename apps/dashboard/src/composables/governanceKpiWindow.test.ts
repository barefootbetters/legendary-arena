import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

// why: this test guards `scripts/build-governance-snapshot.mjs`, which is a
// plain `.mjs` run by `node` (never tsx) and executes `main()` at import time.
// Importing it here would run the generator as a side effect and would also
// trip `vue-tsc` (a `.mjs` with no declaration file). Instead the test reads
// the generator source as text, extracts the KPI functions and constants it
// needs, and evaluates them in an isolated context — so the assertions run
// against the SAME code the generator ships, not a copy that could drift.
const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_DIR = resolve(TEST_FILE_DIR, '..', '..');
const GENERATOR_PATH = resolve(DASHBOARD_DIR, 'scripts/build-governance-snapshot.mjs');

interface KpiRow {
  readonly status: string;
  readonly date: string;
}

interface GovernanceKpiValues {
  readonly daysSinceLastDoneFlip: number;
  readonly openDrafts: number;
  readonly wpsDoneThisWeek: number;
}

type ComputeGovernanceKpis = (
  rows: readonly KpiRow[],
  headCommitIso: string,
) => GovernanceKpiValues;

/**
 * Return the source text of the top-level `const NAME = ...;` line in the
 * generator. Fails loudly when the constant is missing so a rename surfaces
 * here instead of as an undefined reference at evaluation time.
 */
function extractConstant(source: string, name: string): string {
  const match = new RegExp(`^const ${name} = .*;$`, 'm').exec(source);
  assert.ok(
    match,
    `The generator no longer declares the constant ${name}; update this test's extraction list.`,
  );
  return match[0];
}

/**
 * Return the source text of the top-level `function NAME(...) { ... }` in the
 * generator, from its `function` keyword through the first closing brace at
 * column zero.
 */
function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`\nfunction ${name}(`);
  assert.ok(
    start >= 0,
    `The generator no longer declares the function ${name}; update this test's extraction list.`,
  );
  const end = source.indexOf('\n}\n', start);
  assert.ok(end > start, `Could not find the closing brace of the generator function ${name}.`);
  return source.slice(start + 1, end + 2);
}

/**
 * Build `computeGovernanceKpis` from the generator source together with the
 * helpers and constants it calls.
 */
function loadComputeGovernanceKpis(): ComputeGovernanceKpis {
  const source = readFileSync(GENERATOR_PATH, 'utf-8').replace(/\r\n/g, '\n');
  const parts = [
    extractConstant(source, 'MILLIS_PER_DAY'),
    extractConstant(source, 'KPI_WINDOW_DAYS'),
    extractFunction(source, 'formatUtcDateString'),
    extractFunction(source, 'computeRollingWindowRange'),
    extractFunction(source, 'computeGovernanceKpis'),
    'computeGovernanceKpis;',
  ];
  return runInNewContext(parts.join('\n')) as ComputeGovernanceKpis;
}

const computeGovernanceKpis = loadComputeGovernanceKpis();

/**
 * Build `count` Done rows all dated `date`.
 */
function doneRows(date: string, count: number): KpiRow[] {
  const rows: KpiRow[] = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({ status: 'Done', date });
  }
  return rows;
}

test('Monday after a weekend counts the weekend done flips (D-24799 regression)', () => {
  // Live case: the 2026-11-02 (Mon) snapshot read 0 while WP-855/857/859/861
  // flipped Done on 2026-11-01 (Sun) under the Monday-anchored ISO week.
  const kpis = computeGovernanceKpis(doneRows('2026-11-01', 4), '2026-11-02T09:00:00-08:00');
  assert.equal(kpis.wpsDoneThisWeek, 4);
  assert.equal(kpis.daysSinceLastDoneFlip, 1);
});

test('the window is the HEAD day plus the six days before it, inclusive', () => {
  const rows = [
    ...doneRows('2026-10-26', 1),
    ...doneRows('2026-10-27', 1),
    ...doneRows('2026-11-02', 1),
    ...doneRows('2026-11-03', 1),
  ];
  const kpis = computeGovernanceKpis(rows, '2026-11-02T12:00:00Z');
  assert.equal(
    kpis.wpsDoneThisWeek,
    2,
    'only 2026-10-27 and 2026-11-02 fall inside 2026-10-27..2026-11-02',
  );
});

test('the window crosses a year boundary', () => {
  const rows = [
    ...doneRows('2025-12-27', 1),
    ...doneRows('2025-12-28', 1),
    ...doneRows('2026-01-03', 1),
  ];
  const kpis = computeGovernanceKpis(rows, '2026-01-03T12:00:00Z');
  assert.equal(kpis.wpsDoneThisWeek, 2, 'the window is 2025-12-28..2026-01-03');
});

test('the window ends on the HEAD commit UTC day, not its local day', () => {
  // 2026-11-01T20:00-08:00 is 2026-11-02T04:00Z, so the window is 10-27..11-02.
  const rows = [...doneRows('2026-10-26', 1), ...doneRows('2026-11-02', 1)];
  const kpis = computeGovernanceKpis(rows, '2026-11-01T20:00:00-08:00');
  assert.equal(kpis.wpsDoneThisWeek, 1);
});

test('drafts and undated Done rows stay out of the done count', () => {
  const rows: KpiRow[] = [
    { status: 'Draft', date: '2026-11-02' },
    { status: 'Done', date: '' },
    { status: 'Ready', date: '2026-11-02' },
    ...doneRows('2026-11-02', 1),
  ];
  const kpis = computeGovernanceKpis(rows, '2026-11-02T12:00:00Z');
  assert.deepEqual({ ...kpis }, { daysSinceLastDoneFlip: 0, openDrafts: 1, wpsDoneThisWeek: 1 });
});
