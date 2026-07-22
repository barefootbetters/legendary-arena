/**
 * Tests for the autoplay bot loop's transient-DB read retry (resilientFetch).
 *
 * Root cause it fixes: Render's managed Postgres briefly returns "the database
 * system is in recovery mode" during a restart/failover, so `bgioPgStore.fetch`
 * throws. A live bot-ALLY match survives (its driver polls and retries next
 * tick); the autoplay loop is a linear sequence with no retry, so a single
 * transient throw aborted the whole spectator match with the generic
 * "The bot loop stopped after an unexpected server error." resilientFetch adds
 * a bounded read retry so a short recovery window is bridged instead of fatal.
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resilientFetch } from './autoplay.mjs';

/** A recovery-mode read failure, matching the wrapped bgioPgStore.fetch message. */
function recoveryError(): Error {
  return new Error(
    'bgioPgStore.fetch failed to read match "m1" from bgio.matches. ' +
      'Error: the database system is in recovery mode',
  );
}

/** A fake db.fetch that throws for the first `failCount` calls, then resolves. */
function makeFlakyDb(failCount: number, result: unknown) {
  let calls = 0;
  return {
    calls: () => calls,
    db: {
      fetch: async () => {
        calls += 1;
        if (calls <= failCount) {
          throw recoveryError();
        }
        return result;
      },
    },
  };
}

const FAST = { baseDelayMs: 1 };

test('retries a transient read failure and returns the state once the DB recovers', async () => {
  const { db, calls } = makeFlakyDb(3, { state: { _stateID: 7 } });

  const outcome = await resilientFetch(db as never, 'm1', { state: true }, FAST);

  assert.deepEqual(outcome, { state: { _stateID: 7 } }, 'the recovered read is returned');
  assert.equal(calls(), 4, 'it retried the three failures then succeeded on the fourth attempt');
});

test('returns on the first attempt when the read succeeds immediately (no retry)', async () => {
  const { db, calls } = makeFlakyDb(0, { state: { _stateID: 1 } });

  const outcome = await resilientFetch(db as never, 'm1', { state: true }, FAST);

  assert.deepEqual(outcome, { state: { _stateID: 1 } });
  assert.equal(calls(), 1, 'a healthy read is not retried');
});

test('an absent match returns { state: undefined } without throwing or retrying', async () => {
  // why: a genuine deploy-wipe / missing match returns undefined WITHOUT
  // throwing, so it must not be retried — it falls through to the vanished path.
  let calls = 0;
  const db = {
    fetch: async () => {
      calls += 1;
      return { state: undefined };
    },
  };

  const outcome = await resilientFetch(db as never, 'gone', { state: true }, FAST);

  assert.deepEqual(outcome, { state: undefined }, 'the absent-match result passes through');
  assert.equal(calls, 1, 'an absent match is not retried (it did not throw)');
});

test('rethrows the last error after exhausting the retry budget', async () => {
  const { db, calls } = makeFlakyDb(99, { state: { _stateID: 1 } });

  await assert.rejects(
    () => resilientFetch(db as never, 'm1', { state: true }, { attempts: 3, baseDelayMs: 1 }),
    /the database system is in recovery mode/,
    'a DB down beyond the retry budget still aborts (with the raw detail, logged not surfaced)',
  );
  assert.equal(calls(), 3, 'it tried exactly the configured number of attempts');
});
