// scripts/db-backup-retention.test.ts
// Unit coverage for the pure backup-retention selection (WP-416 / EC-451, GFS
// tiers). No network, no credentials, no clock — the selection function takes an
// explicit reference date so every boundary is deterministic. All fixture stamps
// use 12:00/13:00 times so a same-day pair is guaranteed to share both the 7-day
// bucket (boundaries fall at midnight) and the calendar-month bucket.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBackupsToPrune, parseBackupTimestamp } from './db-backup-retention.mjs';

/** Build a backup key for a given `YYYYMMDDTHHMMSSZ` stamp. */
function keyFor(stamp: string): string {
  return `db-backups/legendary-arena-${stamp}.dump`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Fixed "now" for every age-based assertion below.
const REFERENCE = new Date(Date.UTC(2027, 0, 1, 0, 0, 0)); // 2027-01-01T00:00:00Z

// --- timestamp parsing (behaviour unchanged by GFS) ---

test('parseBackupTimestamp maps a known stamp to the known UTC epoch', () => {
  const epoch = parseBackupTimestamp(keyFor('20260724T091700Z'));
  assert.equal(epoch, Date.UTC(2026, 6, 24, 9, 17, 0));
});

test('a right-prefix key with a non-timestamp tail is ignored, never pruned', () => {
  const strayKey = 'db-backups/legendary-arena-latest.dump';
  assert.equal(parseBackupTimestamp(strayKey), null);
  assert.deepEqual(selectBackupsToPrune([strayKey], REFERENCE), []);
});

test('an out-of-range date (month 13) is ignored, not Date.UTC-rolled-over', () => {
  assert.equal(parseBackupTimestamp(keyFor('20261301T091700Z')), null);
});

test('empty input yields empty output', () => {
  assert.deepEqual(selectBackupsToPrune([], REFERENCE), []);
});

// --- daily tier ---

test('daily tier: every backup within 35 days is kept, even multiple per day', () => {
  const keys = [
    keyFor('20261215T120000Z'), // 17 days old
    keyFor('20261216T000000Z'), // 16 days old
    keyFor('20261216T120000Z'), // 15.5 days old (a second same-day backup)
  ];
  assert.deepEqual(selectBackupsToPrune(keys, REFERENCE), []);
});

test('daily boundary: a backup exactly 35 days old is kept (inclusive)', () => {
  const backupEpoch = Date.UTC(2026, 0, 1, 0, 0, 0);
  const key = keyFor('20260101T000000Z');
  const exactlyThirtyFive = new Date(backupEpoch + 35 * DAY_MS);
  assert.deepEqual(selectBackupsToPrune([key], exactlyThirtyFive), []);
});

// --- weekly tier ---

test('weekly tier: past 35 days, only the earliest backup of the week survives', () => {
  // ~52 days old, same UTC day => same 7-day + month bucket, one hour apart.
  const earliest = keyFor('20261110T120000Z');
  const later = keyFor('20261110T130000Z');
  assert.deepEqual(selectBackupsToPrune([earliest, later], REFERENCE), [later]);
});

test('a lone backup just past 35 days is kept as its week representative (GFS change)', () => {
  // Under the old flat 35-day window this was pruned; GFS keeps it as the sole
  // representative of its week (age <= 84 days).
  const key = keyFor('20261120T120000Z'); // ~42 days old
  assert.deepEqual(selectBackupsToPrune([key], REFERENCE), []);
});

// --- monthly tier ---

test('monthly tier: past 84 days, only the earliest backup of the month survives', () => {
  // ~139 days old, same UTC day => same month bucket, one hour apart.
  const earliest = keyFor('20260815T120000Z');
  const later = keyFor('20260815T130000Z');
  assert.deepEqual(selectBackupsToPrune([earliest, later], REFERENCE), [later]);
});

test('beyond the monthly window a backup is pruned even as its month representative', () => {
  const key = keyFor('20251101T120000Z'); // ~426 days old (> 365)
  assert.deepEqual(selectBackupsToPrune([key], REFERENCE), [key]);
});

// --- integration ---

test('integration: mixed ages partition into the correct keep/prune sets', () => {
  const daily = keyFor('20261220T120000Z'); //  12 days -> keep (daily)
  const weekRep = keyFor('20261110T120000Z'); //  52 days -> keep (week rep)
  const weekExtra = keyFor('20261110T130000Z'); //  52 days -> prune (not rep)
  const monthRep = keyFor('20260815T120000Z'); // 139 days -> keep (month rep)
  const monthExtra = keyFor('20260815T130000Z'); // 139 days -> prune (not rep)
  const tooOld = keyFor('20251101T120000Z'); // 426 days -> prune (beyond monthly)
  const pruned = selectBackupsToPrune(
    [daily, weekRep, weekExtra, monthRep, monthExtra, tooOld],
    REFERENCE,
  );
  assert.deepEqual(pruned.sort(), [weekExtra, monthExtra, tooOld].sort());
});
