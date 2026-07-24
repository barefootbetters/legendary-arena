/**
 * Tests for the boardgame.io Postgres match store (WP-309 / EC-339).
 *
 * Two pure tests always run: the `type()` async-discriminant and the
 * full-sentence error messages the adapter throws on a forced DB failure
 * (both exercise the adapter against a stub pool, no database needed).
 *
 * The DB-backed tests (round-trip, restart-survival, wipe, listMatches,
 * bgio-schema-only) use node:test's non-silent `{ skip: 'requires test
 * database' }` when `process.env.TEST_DATABASE_URL` is unset, matching the
 * established `apps/server` DB-suite pattern. They require the
 * `data/migrations/023_create_bgio_match_store.sql` migration to have been
 * applied to the test database.
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import pg from 'pg';

import { createBgioPgStore } from './bgioPgStore.js';

const { Pool } = pg;

const hasTestDatabase = process.env.TEST_DATABASE_URL !== undefined;
const dbSkip = hasTestDatabase ? false : 'requires test database (set TEST_DATABASE_URL)';

/**
 * A minimal boardgame.io match state fixture. The adapter treats this as an
 * opaque blob; the nested `G`/`ctx` shape only needs to round-trip through
 * jsonb intact.
 */
const sampleState = {
  G: { deck: ['sr_cyclops', 'sr_wolverine'], score: 3 },
  ctx: { turn: 2, currentPlayer: '0', phase: 'main' },
  _stateID: 5,
  plugins: {},
};

/**
 * A minimal boardgame.io match metadata fixture.
 */
const sampleMetadata = {
  gameName: 'legendary-arena',
  players: { 0: { id: 0, name: 'alice' }, 1: { id: 1, name: 'bob' } },
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_500,
};

describe('bgioPgStore — pure (no database)', () => {
  test('type() returns 1 (boardgame.io Type.ASYNC)', () => {
    const store = createBgioPgStore(/** @type {never} */ ({}));
    assert.equal(store.type(), 1);
  });

  test('each method throws a full-sentence error naming the operation on DB failure', async () => {
    // why: a stub pool whose query always rejects forces every method down its
    // catch branch so we can assert the wrapped, operation-named error message.
    const failingPool = {
      async query() {
        throw new Error('connection refused');
      },
    };
    const store = createBgioPgStore(/** @type {never} */ (failingPool));

    await assert.rejects(
      () => store.createMatch('m1', { initialState: sampleState, metadata: sampleMetadata }),
      /bgioPgStore\.createMatch failed to insert match "m1".*connection refused/s,
    );
    await assert.rejects(
      () => store.setState('m1', sampleState, []),
      /bgioPgStore\.setState failed to persist state for match "m1".*connection refused/s,
    );
    await assert.rejects(
      () => store.setMetadata('m1', sampleMetadata),
      /bgioPgStore\.setMetadata failed to persist metadata for match "m1".*connection refused/s,
    );
    await assert.rejects(
      () => store.fetch('m1', { state: true }),
      /bgioPgStore\.fetch failed to read match "m1".*connection refused/s,
    );
    await assert.rejects(
      () => store.wipe('m1'),
      /bgioPgStore\.wipe failed to delete match "m1".*connection refused/s,
    );
    await assert.rejects(
      () => store.listMatches(),
      /bgioPgStore\.listMatches failed to read match ids.*connection refused/s,
    );
  });
});

describe('bgioPgStore — transient write tolerance (no database)', () => {
  /** Builds an Error carrying a pg SQLSTATE (or Node socket) code. */
  function codedError(message: string, code: string): Error {
    const error = new Error(message) as Error & { code: string };
    error.code = code;
    return error;
  }

  test('setMetadata swallows a persistent transient (read-only) error instead of throwing', async () => {
    // why: bgio calls setMetadata from an UNGUARDED async socket handler
    // (Master.onConnectionChange), so a thrown error crashes the whole server.
    // A transient read-only window (observed 2026-07-23, SQLSTATE 25006) must be
    // logged + swallowed after retries — never rethrown into the crash path.
    let calls = 0;
    const readOnlyPool = {
      async query() {
        calls += 1;
        throw codedError('cannot execute UPDATE in a read-only transaction', '25006');
      },
    };
    const store = createBgioPgStore(readOnlyPool as never);

    await assert.doesNotReject(() => store.setMetadata('m1', sampleMetadata));
    assert.ok(calls > 1, 'it retried the transient error before swallowing');
  });

  test('setState swallows a persistent transient (recovery-mode) error instead of throwing', async () => {
    const recoveryPool = {
      async query() {
        throw codedError('the database system is in recovery mode', '57P03');
      },
    };
    const store = createBgioPgStore(recoveryPool as never);

    await assert.doesNotReject(() => store.setState('m1', sampleState, []));
  });

  test('a transient write that clears mid-retry resolves without throwing (no data dropped)', async () => {
    let calls = 0;
    const flakyPool = {
      async query() {
        calls += 1;
        if (calls === 1) {
          throw codedError('cannot execute UPDATE in a read-only transaction', '25006');
        }
        return { rows: [], rowCount: 1 };
      },
    };
    const store = createBgioPgStore(flakyPool as never);

    await assert.doesNotReject(() => store.setMetadata('m1', sampleMetadata));
    assert.equal(calls, 2, 'it recovered on the first retry — the write was not dropped');
  });

  test('a NON-transient coded error still throws the wrapped message (real bugs surface, not swallowed)', async () => {
    const missingTablePool = {
      async query() {
        throw codedError('relation "bgio.matches" does not exist', '42P01');
      },
    };
    const store = createBgioPgStore(missingTablePool as never);

    await assert.rejects(
      () => store.setMetadata('m1', sampleMetadata),
      /bgioPgStore\.setMetadata failed to persist metadata for match "m1".*does not exist/s,
    );
    await assert.rejects(
      () => store.setState('m1', sampleState, []),
      /bgioPgStore\.setState failed to persist state for match "m1".*does not exist/s,
    );
  });
});

describe('bgioPgStore — transient read tolerance (no database)', () => {
  // why: the READ-path mirror of the write-tolerance suite. bgio calls `fetch`
  // from an UNGUARDED `Master.onSync` socket handler; a thrown transient read
  // crashed the WHOLE server when the DB was briefly unreachable (ECONNREFUSED,
  // observed 2026-07-24). fetch must retry a transient error and then return the
  // missing-row shape (`{}`) instead of throwing.
  function codedError(message: string, code: string): Error {
    const error = new Error(message) as Error & { code: string };
    error.code = code;
    return error;
  }

  test('fetch swallows a persistent transient (ECONNREFUSED) error and returns the missing-row shape', async () => {
    let calls = 0;
    const downPool = {
      async query() {
        calls += 1;
        throw codedError('connect ECONNREFUSED 10.0.0.1:5432', 'ECONNREFUSED');
      },
    };
    const store = createBgioPgStore(downPool as never);
    let result: unknown;
    await assert.doesNotReject(async () => {
      result = await store.fetch('m1', { state: true });
    });
    assert.deepEqual(result, {}, 'returns the empty not-found shape, never throws into onSync');
    assert.ok(calls > 1, 'it retried the transient error before giving up');
  });

  test('listMatches swallows a persistent transient (recovery-mode) error and returns an empty list', async () => {
    const downPool = {
      async query() {
        throw codedError('the database system is in recovery mode', '57P03');
      },
    };
    const store = createBgioPgStore(downPool as never);
    let ids: unknown;
    await assert.doesNotReject(async () => {
      ids = await store.listMatches();
    });
    assert.deepEqual(ids, []);
  });

  test('a transient read that clears mid-retry returns the real row (no data lost)', async () => {
    let calls = 0;
    const flakyPool = {
      async query() {
        calls += 1;
        if (calls === 1) {
          throw codedError('connect ECONNREFUSED 10.0.0.1:5432', 'ECONNREFUSED');
        }
        return {
          rows: [
            { state: sampleState, initial_state: sampleState, metadata: sampleMetadata, log: [] },
          ],
        };
      },
    };
    const store = createBgioPgStore(flakyPool as never);
    const result = await store.fetch('m1', { state: true });
    assert.deepEqual(result, { state: sampleState });
    assert.ok(calls > 1, 'it retried past the first transient failure');
  });

  test('a NON-transient coded read error still throws the wrapped message (real bugs surface)', async () => {
    const missingTablePool = {
      async query() {
        throw codedError('relation "bgio.matches" does not exist', '42P01');
      },
    };
    const store = createBgioPgStore(missingTablePool as never);
    await assert.rejects(
      () => store.fetch('m1', { state: true }),
      /bgioPgStore\.fetch failed to read match "m1".*does not exist/s,
    );
  });
});

describe('bgioPgStore — database-backed (WP-309 / EC-339)', () => {
  let testPool: pg.Pool | null = null;
  let store: ReturnType<typeof createBgioPgStore> | null = null;

  before(async () => {
    if (hasTestDatabase) {
      testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
      store = createBgioPgStore(testPool);
    }
  });

  after(async () => {
    if (testPool !== null) {
      await testPool.end();
      testPool = null;
      store = null;
    }
  });

  beforeEach(async () => {
    if (testPool !== null) {
      await testPool.query('DELETE FROM bgio.matches');
    }
  });

  test('createMatch then fetch returns the written state and metadata', { skip: dbSkip }, async () => {
    await store!.createMatch('match-round-trip', {
      initialState: sampleState,
      metadata: sampleMetadata,
    });

    const fetched = await store!.fetch('match-round-trip', {
      state: true,
      metadata: true,
      initialState: true,
      log: true,
    });

    assert.deepEqual(fetched.state, sampleState);
    assert.deepEqual(fetched.metadata, sampleMetadata);
    assert.deepEqual(fetched.initialState, sampleState);
    assert.deepEqual(fetched.log, []);
  });

  test('fetch returns only the requested fields', { skip: dbSkip }, async () => {
    await store!.createMatch('match-partial', {
      initialState: sampleState,
      metadata: sampleMetadata,
    });

    const fetched = await store!.fetch('match-partial', { metadata: true });
    assert.deepEqual(Object.keys(fetched), ['metadata']);
    assert.deepEqual(fetched.metadata, sampleMetadata);
  });

  test(
    'setState survives a simulated restart (fresh pool + fresh adapter reads it back)',
    { skip: dbSkip },
    async () => {
      await store!.createMatch('match-restart', {
        initialState: sampleState,
        metadata: sampleMetadata,
      });

      const advancedState = {
        ...sampleState,
        _stateID: 9,
        G: { deck: ['sr_wolverine'], score: 7 },
      };
      await store!.setState('match-restart', advancedState, [
        { action: { type: 'MAKE_MOVE' }, _stateID: 6, turn: 2, phase: 'main' },
      ]);

      // why: a brand-new Pool + a brand-new adapter instance model the process
      // being restarted — the reader shares nothing in memory with the writer,
      // so an equal fetch proves the state came from Postgres, not process
      // memory. This is the durability guarantee the packet ships.
      const restartedPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
      try {
        const restartedStore = createBgioPgStore(restartedPool);
        const fetched = await restartedStore.fetch('match-restart', {
          state: true,
          log: true,
        });
        assert.deepEqual(fetched.state, advancedState);
        assert.equal(Array.isArray(fetched.log), true);
        assert.equal(fetched.log.length, 1);
      } finally {
        await restartedPool.end();
      }
    },
  );

  test('setState appends deltalog entries across calls', { skip: dbSkip }, async () => {
    await store!.createMatch('match-log', {
      initialState: sampleState,
      metadata: sampleMetadata,
    });
    await store!.setState('match-log', sampleState, [{ _stateID: 1 }]);
    await store!.setState('match-log', sampleState, [{ _stateID: 2 }]);

    const fetched = await store!.fetch('match-log', { log: true });
    assert.equal(fetched.log.length, 2);
    assert.deepEqual(fetched.log, [{ _stateID: 1 }, { _stateID: 2 }]);
  });

  test('wipe deletes the row; fetch afterwards returns empty', { skip: dbSkip }, async () => {
    await store!.createMatch('match-wipe', {
      initialState: sampleState,
      metadata: sampleMetadata,
    });
    await store!.wipe('match-wipe');

    const fetched = await store!.fetch('match-wipe', { state: true, metadata: true });
    assert.deepEqual(fetched, {});
  });

  test('listMatches returns created match ids and honours the gameName filter', { skip: dbSkip }, async () => {
    await store!.createMatch('match-a', { initialState: sampleState, metadata: sampleMetadata });
    await store!.createMatch('match-b', { initialState: sampleState, metadata: sampleMetadata });
    await store!.createMatch('match-other-game', {
      initialState: sampleState,
      metadata: { ...sampleMetadata, gameName: 'some-other-game' },
    });

    const all = await store!.listMatches();
    assert.deepEqual([...all].sort(), ['match-a', 'match-b', 'match-other-game']);

    const legendaryOnly = await store!.listMatches({ gameName: 'legendary-arena' });
    assert.deepEqual([...legendaryOnly].sort(), ['match-a', 'match-b']);
  });

  test('the adapter writes to the bgio schema, not legendary.*', { skip: dbSkip }, async () => {
    await store!.createMatch('match-schema', {
      initialState: sampleState,
      metadata: sampleMetadata,
    });

    // why: reading the row directly from the schema-qualified bgio.matches
    // proves the write landed in the dedicated framework schema. A companion
    // Select-String check in the WP verification confirms the source contains
    // no `legendary.` qualifier.
    const direct = await testPool!.query(
      'SELECT match_id FROM bgio.matches WHERE match_id = $1',
      ['match-schema'],
    );
    assert.equal(direct.rows.length, 1);
    assert.equal(direct.rows[0].match_id, 'match-schema');
  });
});
