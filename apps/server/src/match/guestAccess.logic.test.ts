/**
 * Tests for the WP-630 per-match guest access logic (scrypt KDF + per-field
 * merge + discriminated verify + lobby-safe meta).
 *
 * Pure unit tests: an in-memory fake pg pool stands in for the single-row
 * `legendary.match_guest_access` store (it answers the SELECT and the
 * INSERT ... ON CONFLICT upsert the helpers issue). No live DB, no network.
 *
 * The security-critical properties pinned here:
 *   - the stored value is a scrypt derived key, never the plaintext;
 *   - verify is a discriminated verdict (no-access vs mismatch vs match), so the
 *     route can map 409 vs 401 distinctly;
 *   - the per-field merge leaves an absent field untouched (a rename never wipes
 *     the password) and clears an empty-string field;
 *   - the meta read never returns the derived key.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  hashGuestPassword,
  verifyGuestPasswordHash,
  setGuestAccess,
  verifyGuestPassword,
  readGuestAccessMeta,
} from './guestAccess.logic.js';

interface StoredRow {
  game_name: string | null;
  password_kdf: string | null;
}

/**
 * An in-memory fake of the single-row `match_guest_access` store. Answers the
 * SELECT and the INSERT ... ON CONFLICT DO UPDATE the helpers issue, keyed by
 * match id. Records every SQL string so a test can assert what was written.
 */
function makeStore(): { database: never; rows: Map<string, StoredRow>; sqlLog: string[] } {
  const rows = new Map<string, StoredRow>();
  const sqlLog: string[] = [];
  const database = {
    query: async (sql: string, params: unknown[]) => {
      sqlLog.push(sql);
      if (sql.startsWith('SELECT')) {
        const matchId = params[0] as string;
        const existing = rows.get(matchId);
        return existing === undefined ? { rows: [], rowCount: 0 } : { rows: [existing], rowCount: 1 };
      }
      if (sql.startsWith('INSERT')) {
        const matchId = params[0] as string;
        rows.set(matchId, {
          game_name: params[1] as string | null,
          password_kdf: params[2] as string | null,
        });
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as never;
  return { database, rows, sqlLog };
}

describe('guestAccess.logic hash/verify (WP-630)', () => {
  test('hashGuestPassword produces a salt:key string, not the plaintext', () => {
    const stored = hashGuestPassword('open-sesame');
    assert.equal(stored.includes('open-sesame'), false);
    assert.match(stored, /^[0-9a-f]+:[0-9a-f]+$/);
  });

  test('a fresh hash of the same password differs (random per-record salt)', () => {
    const first = hashGuestPassword('same-password');
    const second = hashGuestPassword('same-password');
    assert.notEqual(first, second);
  });

  test('verifyGuestPasswordHash accepts the right password and rejects a wrong one', () => {
    const stored = hashGuestPassword('correct-horse');
    assert.equal(verifyGuestPasswordHash('correct-horse', stored), true);
    assert.equal(verifyGuestPasswordHash('wrong-horse', stored), false);
  });

  test('verifyGuestPasswordHash returns false on a corrupt stored string (no throw)', () => {
    assert.equal(verifyGuestPasswordHash('anything', 'not-a-valid-kdf'), false);
    assert.equal(verifyGuestPasswordHash('anything', ''), false);
  });
});

describe('guestAccess.logic verify verdict (WP-630)', () => {
  test('no row → no-access', async () => {
    const { database } = makeStore();
    assert.equal(await verifyGuestPassword('m1', 'pw', database), 'no-access');
  });

  test('row with no password → no-access', async () => {
    const { database } = makeStore();
    await setGuestAccess('m1', { gameName: 'Grandkids' }, database);
    assert.equal(await verifyGuestPassword('m1', 'pw', database), 'no-access');
  });

  test('wrong password → mismatch; right password → match', async () => {
    const { database } = makeStore();
    await setGuestAccess('m1', { password: 'letmein' }, database);
    assert.equal(await verifyGuestPassword('m1', 'nope', database), 'mismatch');
    assert.equal(await verifyGuestPassword('m1', 'letmein', database), 'match');
  });
});

describe('guestAccess.logic per-field merge (WP-630)', () => {
  test('setting only a new gameName leaves the password intact', async () => {
    const { database } = makeStore();
    await setGuestAccess('m1', { gameName: 'First', password: 'secret' }, database);
    // A later rename with NO password field must not wipe the password.
    await setGuestAccess('m1', { gameName: 'Renamed' }, database);
    assert.equal(await verifyGuestPassword('m1', 'secret', database), 'match');
    const meta = await readGuestAccessMeta('m1', database);
    assert.equal(meta.gameName, 'Renamed');
    assert.equal(meta.hasGuestPassword, true);
  });

  test('an empty-string password clears the password but keeps the name', async () => {
    const { database } = makeStore();
    await setGuestAccess('m1', { gameName: 'Keep', password: 'secret' }, database);
    await setGuestAccess('m1', { password: '' }, database);
    assert.equal(await verifyGuestPassword('m1', 'secret', database), 'no-access');
    const meta = await readGuestAccessMeta('m1', database);
    assert.equal(meta.gameName, 'Keep');
    assert.equal(meta.hasGuestPassword, false);
  });

  test('an empty-string gameName clears the name but keeps the password', async () => {
    const { database } = makeStore();
    await setGuestAccess('m1', { gameName: 'Temp', password: 'secret' }, database);
    await setGuestAccess('m1', { gameName: '' }, database);
    const meta = await readGuestAccessMeta('m1', database);
    assert.equal(meta.gameName, null);
    assert.equal(meta.hasGuestPassword, true);
  });
});

describe('guestAccess.logic meta read (WP-630)', () => {
  test('readGuestAccessMeta never returns the derived key', async () => {
    const { database } = makeStore();
    await setGuestAccess('m1', { gameName: 'Named', password: 'secret' }, database);
    const meta = await readGuestAccessMeta('m1', database);
    assert.deepEqual(Object.keys(meta).sort(), ['gameName', 'hasGuestPassword']);
    assert.equal(JSON.stringify(meta).includes('secret'), false);
    // The meta object has no field carrying the kdf.
    assert.equal('passwordKdf' in meta, false);
    assert.equal('password_kdf' in meta, false);
  });

  test('readGuestAccessMeta on an unknown match is empty, not an error', async () => {
    const { database } = makeStore();
    const meta = await readGuestAccessMeta('missing', database);
    assert.deepEqual(meta, { gameName: null, hasGuestPassword: false });
  });
});
