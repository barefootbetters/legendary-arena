/**
 * Tests for the feedback persistence layer (WP-604 / EC-639).
 *
 * DB-gated: every test needs a real Postgres, so each is non-silently skipped when
 * `process.env.TEST_DATABASE_URL` is unset (the WP-052 §3.1 pattern; mirrors
 * `entitlements.logic.test.ts`). Run serialized (`--test-concurrency=1`) against a
 * shared local Postgres so this file does not race other DB-gated suites
 * (reference: db-gated-test-serialization).
 *
 * Each test provisions its own unique rows (a per-run id namespace, no shared
 * fixtures), so the tests are order-independent and never collide across repeated
 * runs. `feedback_item.author_ext_id` and `feedback_vote.account_ext_id` are plain
 * text with no FK to `legendary.players`, so synthetic ext_ids are sufficient — no
 * account provisioning required.
 *
 * Covers: insert → list round-trip, the one-vote-per-account UNIQUE enforcement,
 * the default list excludes 'under_review', the public list is 'enhancement'-only,
 * viewerHasVoted, remove/no-op, no_such_item, and that status is never mutated.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  addVote,
  countVotesForItem,
  insertFeedbackItem,
  listAllFeedbackItems,
  listPublicEnhancements,
  removeVote,
  updateFeedbackItemStatus,
} from './feedback.persistence.js';
import type { DatabaseClient } from '../identity/identity.types.js';
import type { OperatorFeedbackItem, PublicFeedbackItem } from './feedback.types.js';

import pg from 'pg';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;

// why: a per-run id namespace guarantees row uniqueness across repeated test runs
// without a beforeEach cleanup — the shared-local-Postgres pattern. Date.now() is a
// server test file (not engine code), so wall-clock use is permitted here.
const RUN_ID = `wp604-${Date.now()}`;
const AUTHOR_EXT_ID = `${RUN_ID}-author`;
const VOTER_A = `${RUN_ID}-voter-a`;
const VOTER_B = `${RUN_ID}-voter-b`;

/** Find a specific item by id in a public list (other runs' rows are also present). */
function findById(
  items: readonly PublicFeedbackItem[],
  id: number,
): PublicFeedbackItem | undefined {
  return items.find((item) => item.id === id);
}

describe('feedback persistence (WP-604)', () => {
  let testPool: pg.Pool | null = null;

  before(() => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
  });

  after(async () => {
    if (testPool !== null) {
      await testPool.end();
      testPool = null;
    }
  });

  test(
    'inserts with status under_review and lists it under a matching status filter',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const record = await insertFeedbackItem(
        database,
        { type: 'enhancement', title: `${RUN_ID} dark mode`, description: 'please' },
        AUTHOR_EXT_ID,
      );
      assert.equal(record.status, 'under_review');
      assert.equal(record.feedbackType, 'enhancement');
      assert.equal(typeof record.id, 'number');

      // why: this packet only ever writes 'under_review', so the round-trip list must
      // pass an explicit statusFilter to see the freshly-inserted item.
      const items = await listPublicEnhancements(database, {
        statusFilter: ['under_review'],
      });
      const mine = findById(items, record.id);
      assert.ok(mine, 'the inserted item appears under the under_review filter');
      assert.equal(mine?.voteCount, 0);
      assert.equal(mine?.viewerHasVoted, false);
      assert.equal('authorExtId' in (mine as Record<string, unknown>), false);
    },
  );

  test(
    'enforces one vote per account and projects the tally',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const record = await insertFeedbackItem(
        database,
        { type: 'enhancement', title: `${RUN_ID} votes`, description: 'x' },
        AUTHOR_EXT_ID,
      );

      assert.equal(await addVote(database, record.id, VOTER_A), 'added');
      assert.equal(await countVotesForItem(database, record.id), 1);

      // A repeat vote by the same account is idempotent (the UNIQUE constraint).
      assert.equal(await addVote(database, record.id, VOTER_A), 'already_voted');
      assert.equal(await countVotesForItem(database, record.id), 1);

      // A second account bumps the count to 2.
      assert.equal(await addVote(database, record.id, VOTER_B), 'added');
      assert.equal(await countVotesForItem(database, record.id), 2);

      // viewerHasVoted reflects the identified viewer.
      const asVoterA = await listPublicEnhancements(database, {
        statusFilter: ['under_review'],
        viewerExtId: VOTER_A,
      });
      assert.equal(findById(asVoterA, record.id)?.viewerHasVoted, true);
      assert.equal(findById(asVoterA, record.id)?.voteCount, 2);

      const asGuest = await listPublicEnhancements(database, {
        statusFilter: ['under_review'],
      });
      assert.equal(findById(asGuest, record.id)?.viewerHasVoted, false);

      // Remove one vote → count drops; a second remove is a no-op.
      assert.equal(await removeVote(database, record.id, VOTER_A), 'removed');
      assert.equal(await countVotesForItem(database, record.id), 1);
      assert.equal(await removeVote(database, record.id, VOTER_A), 'not_voted');
      assert.equal(await countVotesForItem(database, record.id), 1);
    },
  );

  test(
    'addVote returns no_such_item for a non-existent item id',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      // why: a bigserial id this large is never assigned in a test run, so the FK
      // constraint fails and the helper reports no_such_item rather than throwing.
      const outcome = await addVote(database, Number.MAX_SAFE_INTEGER, VOTER_A);
      assert.equal(outcome, 'no_such_item');
    },
  );

  test(
    'the default list hides under_review and the public list is enhancement-only',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const enhancement = await insertFeedbackItem(
        database,
        { type: 'enhancement', title: `${RUN_ID} hidden`, description: 'x' },
        AUTHOR_EXT_ID,
      );
      const bug = await insertFeedbackItem(
        database,
        { type: 'bug', title: `${RUN_ID} a bug`, description: 'x' },
        AUTHOR_EXT_ID,
      );

      // Default (no statusFilter) = the public roadmap set → excludes under_review.
      const defaultList = await listPublicEnhancements(database);
      assert.equal(findById(defaultList, enhancement.id), undefined);

      // Even with an under_review filter, a 'bug' row never surfaces on the public
      // enhancement list.
      const underReview = await listPublicEnhancements(database, {
        statusFilter: ['under_review'],
      });
      assert.ok(findById(underReview, enhancement.id));
      assert.equal(findById(underReview, bug.id), undefined);
    },
  );

  test(
    'status is never mutated by any persistence path',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const record = await insertFeedbackItem(
        database,
        { type: 'enhancement', title: `${RUN_ID} status`, description: 'x' },
        AUTHOR_EXT_ID,
      );
      await addVote(database, record.id, VOTER_A);
      await removeVote(database, record.id, VOTER_A);

      const check = await testPool.query(
        'SELECT status FROM legendary.feedback_item WHERE id = $1',
        [record.id],
      );
      assert.equal(check.rows[0]?.status, 'under_review');
    },
  );
});

/** Find a specific item by id in an operator list (other runs' rows are present). */
function findOperatorById(
  items: readonly OperatorFeedbackItem[],
  id: number,
): OperatorFeedbackItem | undefined {
  return items.find((item) => item.id === id);
}

const TRIAGE_AUTHOR = `${RUN_ID}-triage-author`;

describe('feedback triage persistence (WP-605)', () => {
  let testPool: pg.Pool | null = null;

  before(() => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    }
  });

  after(async () => {
    if (testPool !== null) {
      await testPool.end();
      testPool = null;
    }
  });

  test(
    'listAllFeedbackItems returns every type + status with a projected voteCount',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const bug = await insertFeedbackItem(
        database,
        { type: 'bug', title: `${RUN_ID} triage bug`, description: 'x' },
        TRIAGE_AUTHOR,
      );
      const enhancement = await insertFeedbackItem(
        database,
        { type: 'enhancement', title: `${RUN_ID} triage enh`, description: 'x' },
        TRIAGE_AUTHOR,
      );
      await addVote(database, enhancement.id, `${RUN_ID}-tv-a`);
      await addVote(database, enhancement.id, `${RUN_ID}-tv-b`);

      const items = await listAllFeedbackItems(database);
      // why: bug rows never surface on the PUBLIC list, but the operator list must
      // include every type — that is the whole point of the triage read.
      const foundBug = findOperatorById(items, bug.id);
      const foundEnhancement = findOperatorById(items, enhancement.id);
      assert.ok(foundBug, 'a bug row is present on the operator list');
      assert.equal(foundBug?.feedbackType, 'bug');
      assert.equal(foundBug?.authorExtId, TRIAGE_AUTHOR);
      assert.equal(foundBug?.voteCount, 0);
      assert.equal(foundEnhancement?.voteCount, 2);
    },
  );

  test(
    'updateFeedbackItemStatus writes status, sets/clears resolution_reason, advances updated_at',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const item = await insertFeedbackItem(
        database,
        { type: 'enhancement', title: `${RUN_ID} triage status`, description: 'x' },
        TRIAGE_AUTHOR,
      );
      assert.equal(item.status, 'under_review');
      assert.equal(item.resolutionReason, null);

      const planned = await updateFeedbackItemStatus(database, item.id, 'planned', null);
      assert.ok(planned);
      assert.equal(planned?.status, 'planned');
      assert.equal(planned?.resolutionReason, null);
      assert.ok(
        new Date(planned!.updatedAt).getTime() >= new Date(item.createdAt).getTime(),
        'updated_at advances',
      );

      const declined = await updateFeedbackItemStatus(
        database,
        item.id,
        'declined',
        'out of scope',
      );
      assert.equal(declined?.status, 'declined');
      assert.equal(declined?.resolutionReason, 'out of scope');

      // A move off Declined clears the stored reason (the route passes null).
      const shipped = await updateFeedbackItemStatus(database, item.id, 'shipped', null);
      assert.equal(shipped?.status, 'shipped');
      assert.equal(shipped?.resolutionReason, null);
    },
  );

  test(
    'updateFeedbackItemStatus returns null for an unknown id',
    hasTestDatabase ? {} : { skip: 'requires test database' },
    async () => {
      assert.ok(testPool !== null);
      const database = testPool as unknown as DatabaseClient;
      const result = await updateFeedbackItemStatus(
        database,
        Number.MAX_SAFE_INTEGER,
        'planned',
        null,
      );
      assert.equal(result, null);
    },
  );
});
