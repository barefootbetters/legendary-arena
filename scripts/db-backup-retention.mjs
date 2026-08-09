// scripts/db-backup-retention.mjs
/**
 * Provider-independent PostgreSQL backup retention selection (WP-416 / D-24236).
 *
 * Pure selection logic for pruning old database backups from Cloudflare R2. The
 * backup workflow (.github/workflows/db-backup.yml) lists the existing backup
 * object keys and pipes them to this script's CLI; the CLI prints the keys that
 * fall outside the retention window, one per line, for the workflow to delete via
 * `aws s3 rm`.
 *
 * All network I/O (listing, deletion) lives in the workflow. This module performs
 * none, so the selection can be unit-tested without R2 credentials or a network.
 */

import { fileURLToPath } from 'node:url';
import { stdin } from 'node:process';

// why: grandfather-father-son (GFS) retention. Keep every daily backup for the
// DAILY window, then thin to one-per-week out to the WEEKLY window, then
// one-per-month out to the MONTHLY window, then delete. The daily window preserves
// the ~24h RPO for recent recovery; the weekly/monthly tiers keep long-horizon
// restore points ("the database as of three months ago") at a fraction of the
// storage of keeping every daily forever. Windows are cumulative ages measured from
// the reference date ("now"). Documented in docs/ops/DISASTER_RECOVERY.md §3.
const DAILY_RETENTION_DAYS = 35; // keep ALL backups at least this recent
const WEEKLY_RETENTION_DAYS = 84; // 12 weeks: keep one-per-week out to here
const MONTHLY_RETENTION_DAYS = 365; // 12 months: keep one-per-month out to here

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const DAILY_RETENTION_MS = DAILY_RETENTION_DAYS * DAY_MS;
const WEEKLY_RETENTION_MS = WEEKLY_RETENTION_DAYS * DAY_MS;
const MONTHLY_RETENTION_MS = MONTHLY_RETENTION_DAYS * DAY_MS;

// Matches the locked R2 key filename `legendary-arena-<YYYYMMDDTHHMMSSZ>.dump`.
const BACKUP_KEY_PATTERN =
  /legendary-arena-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.dump$/;

/**
 * Parse the UTC epoch (milliseconds) embedded in a backup object key's filename.
 *
 * The filename stamp is the compact/basic ISO form `YYYYMMDDTHHMMSSZ`, which
 * `new Date(theString)` does NOT parse in V8 (it returns Invalid Date). This
 * decomposes the digits and builds the epoch with `Date.UTC(...)`, then round-trips
 * the result to reject any out-of-range component (e.g. month 13, day 32) that
 * `Date.UTC` would otherwise silently roll over into a valid neighbouring date.
 *
 * @param {string} objectKey - a full R2 key, e.g.
 *   `db-backups/2026/07/24/legendary-arena-20260724T091700Z.dump`.
 * @returns {number | null} the UTC epoch in milliseconds, or `null` when the key
 *   carries no well-formed backup timestamp (the caller treats null as "ignore").
 */
export function parseBackupTimestamp(objectKey) {
  const match = BACKUP_KEY_PATTERN.exec(objectKey);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const epoch = Date.UTC(year, month - 1, day, hour, minute, second);
  // why: reject rollover — Date.UTC(2026, 12, ...) becomes January 2027 rather
  // than failing, so confirm the epoch reconstructs to the exact input components.
  const roundTrip = new Date(epoch);
  const componentsMatch =
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day &&
    roundTrip.getUTCHours() === hour &&
    roundTrip.getUTCMinutes() === minute &&
    roundTrip.getUTCSeconds() === second;
  if (!componentsMatch) {
    return null;
  }
  return epoch;
}

/**
 * The fixed 7-day bucket a UTC epoch falls in, counted from the Unix epoch. Two
 * backups share a bucket when they land in the same 7-day span, so "one per week"
 * means "one per bucket". Fixed-width buckets (not ISO weeks) keep this pure and
 * free of calendar edge cases; the exact week alignment does not matter for
 * retention, only that each 7-day span keeps one representative.
 *
 * @param {number} epoch - UTC epoch in milliseconds.
 * @returns {number} the bucket index.
 */
function weekBucketOf(epoch) {
  return Math.floor(epoch / WEEK_MS);
}

/**
 * The calendar-month bucket (UTC) a backup falls in, as a single comparable
 * integer `year * 12 + monthIndex`, so "one per month" means "one per bucket".
 *
 * @param {number} epoch - UTC epoch in milliseconds.
 * @returns {number} the bucket index.
 */
function monthBucketOf(epoch) {
  const date = new Date(epoch);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/**
 * Select the backup object keys to delete under a grandfather-father-son policy.
 *
 * A backup is KEPT when it satisfies any tier, measuring age against referenceDate:
 *   - Daily:   age <= DAILY_RETENTION_DAYS — every recent backup is kept.
 *   - Weekly:  age <= WEEKLY_RETENTION_DAYS AND it is the earliest backup in its
 *              7-day bucket (its week's representative).
 *   - Monthly: age <= MONTHLY_RETENTION_DAYS AND it is the earliest backup in its
 *              calendar-month bucket (its month's representative).
 * Everything else is pruned. Choosing the EARLIEST backup of each week/month as the
 * representative makes the transition seamless: the earliest backup of a period is
 * kept first as a daily, then as that period's weekly rep, then (for the first week
 * of a month) as the monthly rep, without a gap. Keys with no well-formed backup
 * timestamp are ignored (never pruned), so an unrelated object under the prefix is
 * never deleted.
 *
 * Boundaries are inclusive-keep (age exactly at a window is kept), matching the v1
 * behaviour where a backup exactly RETENTION_DAYS old survived.
 *
 * @param {string[]} objectKeys - existing backup keys under the `db-backups/` prefix.
 * @param {Date} referenceDate - "now" for the comparison. The workflow passes the
 *   current time; tests pass a fixed date so every boundary is deterministic.
 * @returns {string[]} the subset of `objectKeys` to delete.
 */
export function selectBackupsToPrune(objectKeys, referenceDate) {
  const referenceEpoch = referenceDate.getTime();

  // First pass: parse timestamps and record the earliest epoch seen in each week
  // and month bucket. The earliest backup of a bucket is its retained representative.
  const parsedBackups = [];
  const earliestEpochByWeek = new Map();
  const earliestEpochByMonth = new Map();
  for (const objectKey of objectKeys) {
    const backupEpoch = parseBackupTimestamp(objectKey);
    if (backupEpoch === null) {
      continue;
    }
    parsedBackups.push({ objectKey, backupEpoch });
    const weekBucket = weekBucketOf(backupEpoch);
    const monthBucket = monthBucketOf(backupEpoch);
    const earliestWeekEpoch = earliestEpochByWeek.get(weekBucket);
    if (earliestWeekEpoch === undefined || backupEpoch < earliestWeekEpoch) {
      earliestEpochByWeek.set(weekBucket, backupEpoch);
    }
    const earliestMonthEpoch = earliestEpochByMonth.get(monthBucket);
    if (earliestMonthEpoch === undefined || backupEpoch < earliestMonthEpoch) {
      earliestEpochByMonth.set(monthBucket, backupEpoch);
    }
  }

  // Second pass: keep each backup that satisfies any tier; prune the rest.
  const keysToPrune = [];
  for (const { objectKey, backupEpoch } of parsedBackups) {
    const ageMs = referenceEpoch - backupEpoch;
    const isWeekRepresentative =
      earliestEpochByWeek.get(weekBucketOf(backupEpoch)) === backupEpoch;
    const isMonthRepresentative =
      earliestEpochByMonth.get(monthBucketOf(backupEpoch)) === backupEpoch;
    const isKeptDaily = ageMs <= DAILY_RETENTION_MS;
    const isKeptWeekly = ageMs <= WEEKLY_RETENTION_MS && isWeekRepresentative;
    const isKeptMonthly = ageMs <= MONTHLY_RETENTION_MS && isMonthRepresentative;
    if (!isKeptDaily && !isKeptWeekly && !isKeptMonthly) {
      keysToPrune.push(objectKey);
    }
  }
  return keysToPrune;
}

/**
 * CLI entry point: read backup keys from stdin (one per line), print the keys to
 * prune (one per line). The workflow pipes `aws s3 ls` output through this.
 *
 * @returns {Promise<void>} resolves once stdin is drained and the result is written.
 */
async function runCli() {
  let input = '';
  stdin.setEncoding('utf8');
  for await (const chunk of stdin) {
    input += chunk;
  }
  const objectKeys = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // why: the CLI is the only impure edge — it reads the current wall-clock as the
  // retention reference. The selection function stays pure so the tests need no clock.
  const keysToPrune = selectBackupsToPrune(objectKeys, new Date());
  if (keysToPrune.length > 0) {
    process.stdout.write(`${keysToPrune.join('\n')}\n`);
  }
}

// why: run the CLI only when this module is the process entry point, so importing
// it from the test does not trigger a blocking stdin read.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
