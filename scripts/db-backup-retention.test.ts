// scripts/db-backup-retention.test.ts
// Unit coverage for the pure backup-retention selection (WP-416 / EC-451). No
// network, no credentials, no clock — the selection function takes an explicit
// reference date so every boundary is deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBackupsToPrune, parseBackupTimestamp } from './db-backup-retention.mjs';

/** Build a backup key for a given `YYYYMMDDTHHMMSSZ` stamp. */
function keyFor(stamp: string): string {
  return `db-backups/legendary-arena-${stamp}.dump`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

test('parseBackupTimestamp maps a known stamp to the known UTC epoch', () => {
  const epoch = parseBackupTimestamp(keyFor('20260724T091700Z'));
  assert.equal(epoch, Date.UTC(2026, 6, 24, 9, 17, 0));
});

test('a right-prefix key with a non-timestamp tail is ignored, never pruned', () => {
  const strayKey = 'db-backups/legendary-arena-latest.dump';
  assert.equal(parseBackupTimestamp(strayKey), null);
  const wellPastWindow = new Date(Date.UTC(2030, 0, 1));
  assert.deepEqual(selectBackupsToPrune([strayKey], wellPastWindow), []);
});

test('an out-of-range date (month 13) is ignored, not Date.UTC-rolled-over', () => {
  assert.equal(parseBackupTimestamp(keyFor('20261301T091700Z')), null);
});

test('exactly 35 days old is kept; one second older is deleted', () => {
  const key = keyFor('20260101T000000Z');
  const backupEpoch = Date.UTC(2026, 0, 1, 0, 0, 0);
  const exactlyThirtyFiveDays = new Date(backupEpoch + 35 * DAY_MS);
  const oneSecondPast = new Date(backupEpoch + 35 * DAY_MS + 1000);
  assert.deepEqual(selectBackupsToPrune([key], exactlyThirtyFiveDays), []);
  assert.deepEqual(selectBackupsToPrune([key], oneSecondPast), [key]);
});

test('a backup within the window is kept', () => {
  const reference = new Date(Date.UTC(2026, 0, 10));
  assert.deepEqual(selectBackupsToPrune([keyFor('20260101T000000Z')], reference), []);
});

test('empty input yields empty output', () => {
  assert.deepEqual(selectBackupsToPrune([], new Date(Date.UTC(2026, 0, 1))), []);
});
