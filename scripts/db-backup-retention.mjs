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

// why: v1 keeps 35 daily backups; the weekly/monthly grandfather-father-son tiers
// named in docs/ops/DISASTER_RECOVERY.md are a deferred enhancement (WP-416 Out of
// Scope). One age-based window keeps the selection simple and testable.
const RETENTION_DAYS = 35;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

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
 * Select the backup object keys that fall outside the retention window.
 *
 * A key is pruned when its embedded timestamp is strictly older than
 * RETENTION_DAYS before the reference date. A backup exactly at the boundary is
 * kept. Keys with no well-formed backup timestamp are ignored (never pruned), so an
 * unrelated object under the prefix is never deleted.
 *
 * @param {string[]} objectKeys - existing backup keys under the `db-backups/` prefix.
 * @param {Date} referenceDate - "now" for the comparison. The workflow passes the
 *   current time; tests pass a fixed date so the boundary is deterministic.
 * @returns {string[]} the subset of `objectKeys` to delete.
 */
export function selectBackupsToPrune(objectKeys, referenceDate) {
  const referenceEpoch = referenceDate.getTime();
  const keysToPrune = [];
  for (const objectKey of objectKeys) {
    const backupEpoch = parseBackupTimestamp(objectKey);
    if (backupEpoch === null) {
      continue;
    }
    const ageMs = referenceEpoch - backupEpoch;
    if (ageMs > RETENTION_MS) {
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
