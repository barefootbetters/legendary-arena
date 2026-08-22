import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveEnvelope } from './endpoints.js';

// why: pins the LIVE-provenance contract the `/api/dash/*` fetchers rely on.
// Every server handler returns a bare `{ data }` envelope with no `source` /
// `updatedAt`, so the client stamps them via `liveEnvelope` — without it a live
// KPI/players/matches/etc. tile renders a blank freshness badge instead of
// `LIVE`. If a refactor drops the stamp, these assertions fail loudly.

test('liveEnvelope stamps source LIVE and passes the payload through unchanged', () => {
  const payload = [{ id: 'total_players', value: 4 }];
  const envelope = liveEnvelope(payload);

  assert.equal(envelope.source, 'LIVE');
  // identity: the payload is forwarded, not copied or reshaped.
  assert.equal(envelope.data, payload);
});

test('liveEnvelope stamps a finite numeric updatedAt (drives the "… ago" badge)', () => {
  const before = Date.now();
  const envelope = liveEnvelope({ ok: true });
  const after = Date.now();

  assert.equal(typeof envelope.updatedAt, 'number');
  assert.ok(Number.isFinite(envelope.updatedAt));
  // the timestamp is stamped at call time, so it sits within the call window.
  assert.ok(envelope.updatedAt >= before && envelope.updatedAt <= after);
});

test('liveEnvelope preserves an empty-array payload (no data is still LIVE)', () => {
  const envelope = liveEnvelope<readonly number[]>([]);

  assert.equal(envelope.source, 'LIVE');
  assert.deepEqual(envelope.data, []);
});
