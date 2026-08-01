/**
 * Gauntlet Run API Client — tests (WP-449 / EC-484).
 *
 * Exercises the four gauntlet-run wrappers against a stubbed `globalThis.fetch`:
 * the Bearer header is attached on every call (and omitted when the token is
 * null); the success paths return `{ ok: true, value }` (or `{ ok: true }` for
 * delete's 204); the POST accepts BOTH 201 (new) and 200 (idempotent attach); a
 * `{ error: code }` body surfaces the code verbatim; and a network throw maps to
 * `{ ok: false, status: 0, code: null }`. Pure `node:test` + `node:assert`; no
 * boardgame.io, no network, no DB.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deleteGauntletRun,
  importGauntletRun,
  listGauntletRuns,
  updateLegPicks,
} from './gauntletRunApi';

interface CapturedRequest {
  readonly url: string;
  readonly init: RequestInit;
}

/**
 * Install a `globalThis.fetch` stub that records every call and resolves to a
 * minimal Response-like object with the given status and JSON body. Returns the
 * recorded calls plus a `restore` to put the original back.
 */
function installFetchStub(
  status: number,
  jsonBody: unknown,
): { calls: CapturedRequest[]; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const calls: CapturedRequest[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { status, json: async () => jsonBody } as Response;
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/**
 * Install a `globalThis.fetch` stub that throws, simulating a network failure.
 * Returns a `restore` to put the original back.
 */
function installThrowingFetchStub(): { restore: () => void } {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('Simulated network failure for the gauntlet-run API test.');
  }) as typeof globalThis.fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/** Read the `Authorization` header off a captured request's init. */
function authorizationHeader(call: CapturedRequest): string | undefined {
  const headers = (call.init.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

const RAW_VIEW = {
  id: 'run-1',
  setAbbr: 'core',
  mastermindSlug: 'magneto',
  division: 'fixed',
  playerCount: 1,
  legPicks: {},
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  firstCompletedAt: null,
};

const PROGRESS_VIEW = {
  ...RAW_VIEW,
  status: 'needs-heroes',
  pool: [],
  budgetHeadroom: 5,
  heroCount: 3,
  budget: 5,
  isChampion: false,
  legs: [
    {
      schemeId: 'super-hero-registration-act',
      schemeName: 'Super Hero Registration Act',
      cleared: false,
      hasFullPicks: false,
      lastPlayedAt: null,
    },
  ],
  launch: {
    mastermindId: 'core/magneto',
    villainGroupIds: ['core/brotherhood'],
    henchmanGroupIds: ['core/sentinel'],
    bystandersCount: 30,
    woundsCount: 30,
    officersCount: 30,
    sidekicksCount: 15,
    // why: WP-475 / D-24283 — the additive per-leg launch overlay the client
    // mirror now carries; the round-trip assertion below proves it is parsed
    // verbatim, and `playLeg` selects `legLaunch[leg.schemeId]` for the match.
    legLaunch: {
      'super-hero-registration-act': {
        villainGroupIds: ['core/skrulls'],
        henchmanGroupIds: ['core/sentinel'],
      },
    },
  },
};

test('importGauntletRun returns ok on 201 and POSTs the pack verbatim with the Bearer header', async () => {
  const stub = installFetchStub(201, RAW_VIEW);
  const pack = { pack_version: 1, gauntlet: { setAbbr: 'core' } };
  try {
    const result = await importGauntletRun('token-abc', pack);
    assert.deepEqual(result, { ok: true, value: RAW_VIEW });

    assert.equal(stub.calls.length, 1);
    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/gauntlet-runs'));
    assert.equal(call.init.method, 'POST');
    assert.equal(authorizationHeader(call), 'Bearer token-abc');
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal(headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(String(call.init.body)), pack);
  } finally {
    stub.restore();
  }
});

test('importGauntletRun treats a 200 idempotent attach as success', async () => {
  const stub = installFetchStub(200, RAW_VIEW);
  try {
    const result = await importGauntletRun('token-abc', { pack_version: 1 });
    assert.deepEqual(result, { ok: true, value: RAW_VIEW });
  } finally {
    stub.restore();
  }
});

test('importGauntletRun surfaces a typed error code from the { error } body', async () => {
  const stub = installFetchStub(400, { error: 'invalid_pack' });
  try {
    const result = await importGauntletRun('token-abc', { bad: true });
    assert.deepEqual(result, { ok: false, status: 400, code: 'invalid_pack' });
  } finally {
    stub.restore();
  }
});

test('importGauntletRun maps a thrown fetch to status 0 / code null', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await importGauntletRun('token-abc', {});
    assert.deepEqual(result, { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});

test('listGauntletRuns returns the derived runs on 200 and attaches the Bearer header', async () => {
  const stub = installFetchStub(200, { runs: [PROGRESS_VIEW] });
  try {
    const result = await listGauntletRuns('token-abc');
    assert.deepEqual(result, { ok: true, value: { runs: [PROGRESS_VIEW] } });

    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/gauntlet-runs'));
    assert.equal(call.init.method, 'GET');
    assert.equal(authorizationHeader(call), 'Bearer token-abc');
  } finally {
    stub.restore();
  }
});

test('listGauntletRuns omits the Authorization header when the token is null', async () => {
  const stub = installFetchStub(200, { runs: [] });
  try {
    await listGauntletRuns(null);
    const [call] = stub.calls;
    assert.ok(call);
    const headers = (call.init.headers ?? {}) as Record<string, string>;
    assert.equal('Authorization' in headers, false);
  } finally {
    stub.restore();
  }
});

test('listGauntletRuns surfaces a typed unauthorized on 401', async () => {
  const stub = installFetchStub(401, { error: 'unauthorized' });
  try {
    const result = await listGauntletRuns('token-abc');
    assert.deepEqual(result, { ok: false, status: 401, code: 'unauthorized' });
  } finally {
    stub.restore();
  }
});

test('listGauntletRuns maps a thrown fetch to status 0 / code null', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await listGauntletRuns('token-abc');
    assert.deepEqual(result, { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});

test('updateLegPicks returns the updated view on 200 and PATCHes { legPicks }', async () => {
  const legPicks = { 'scheme-a': ['core/spider-man', 'core/hulk', 'core/storm'] };
  const updated = { ...RAW_VIEW, legPicks };
  const stub = installFetchStub(200, updated);
  try {
    const result = await updateLegPicks('token-abc', 'run-1', legPicks);
    assert.deepEqual(result, { ok: true, value: updated });

    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/gauntlet-runs/run-1'));
    assert.equal(call.init.method, 'PATCH');
    assert.equal(authorizationHeader(call), 'Bearer token-abc');
    assert.deepEqual(JSON.parse(String(call.init.body)), { legPicks });
  } finally {
    stub.restore();
  }
});

test('updateLegPicks surfaces a typed invalid_leg_picks on 400', async () => {
  const stub = installFetchStub(400, { error: 'invalid_leg_picks' });
  try {
    const result = await updateLegPicks('token-abc', 'run-1', {});
    assert.deepEqual(result, {
      ok: false,
      status: 400,
      code: 'invalid_leg_picks',
    });
  } finally {
    stub.restore();
  }
});

test('updateLegPicks maps a thrown fetch to status 0 / code null', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await updateLegPicks('token-abc', 'run-1', {});
    assert.deepEqual(result, { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});

test('deleteGauntletRun returns ok on 204 with no value', async () => {
  const stub = installFetchStub(204, null);
  try {
    const result = await deleteGauntletRun('token-abc', 'run-1');
    assert.deepEqual(result, { ok: true });

    const [call] = stub.calls;
    assert.ok(call);
    assert.ok(call.url.endsWith('/api/me/gauntlet-runs/run-1'));
    assert.equal(call.init.method, 'DELETE');
    assert.equal(authorizationHeader(call), 'Bearer token-abc');
  } finally {
    stub.restore();
  }
});

test('deleteGauntletRun surfaces a typed not_found on 404', async () => {
  const stub = installFetchStub(404, { error: 'not_found' });
  try {
    const result = await deleteGauntletRun('token-abc', 'missing');
    assert.deepEqual(result, { ok: false, status: 404, code: 'not_found' });
  } finally {
    stub.restore();
  }
});

test('deleteGauntletRun maps a thrown fetch to status 0 / code null', async () => {
  const stub = installThrowingFetchStub();
  try {
    const result = await deleteGauntletRun('token-abc', 'run-1');
    assert.deepEqual(result, { ok: false, status: 0, code: null });
  } finally {
    stub.restore();
  }
});
