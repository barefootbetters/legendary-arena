import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatBuildStamp, formatReadableTimestamp } from './buildStamp';

/**
 * Tests for the footer build stamp. The time zone is pinned to UTC so the
 * formatted strings do not depend on the machine running the suite.
 */

test('formatReadableTimestamp — date, time and zone name a player can read', () => {
  assert.equal(
    formatReadableTimestamp('2026-10-29T13:57:10.000Z', 'UTC'),
    'Oct 29, 2026, 1:57 PM UTC',
  );
});

test('formatReadableTimestamp — an unparseable timestamp formats as empty', () => {
  assert.equal(formatReadableTimestamp('not a time', 'UTC'), '');
  assert.equal(formatReadableTimestamp('', 'UTC'), '');
});

test('formatBuildStamp — the version and update time are visible; the sha is tooltip-only', () => {
  const stamp = formatBuildStamp('0.1.0', '2026-10-29T13:57:10.000Z', 'bf7150b8', 'UTC');
  assert.deepEqual(stamp, {
    versionLabel: 'v0.1.0',
    updatedLabel: 'Oct 29, 2026, 1:57 PM UTC',
    updatedIso: '2026-10-29T13:57:10.000Z',
    tooltip: 'Build bf7150b8, built 2026-10-29T13:57:10.000Z',
  });
  assert.equal(stamp.versionLabel.includes('bf7150b8'), false);
  assert.equal(stamp.updatedLabel.includes('bf7150b8'), false);
});

test('formatBuildStamp — an unreadable build time drops the update label, keeps the sha', () => {
  const stamp = formatBuildStamp('0.1.0', 'garbage', 'abc1234', 'UTC');
  assert.equal(stamp.updatedLabel, '');
  assert.equal(stamp.updatedIso, '');
  assert.equal(stamp.tooltip, 'Build abc1234');
});
