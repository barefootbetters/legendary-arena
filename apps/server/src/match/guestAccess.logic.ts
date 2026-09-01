/**
 * Per-Match Guest Access — Server Layer (WP-630 / EC-665 / D-24441)
 *
 * The pure DB + crypto helpers behind the per-match guest password model: a host
 * sets an optional game NAME and an optional guest-join PASSWORD on a match they
 * own; a walk-up guest (a grandchild on a tablet, no email) types the password
 * to take an anonymous Casual seat. This is the friendlier alternative to the
 * WP-628 credential link.
 *
 * The password is stored ONLY as a `node:crypto` scrypt derived key in the
 * `"saltHex:keyHex"` form — scrypt is a brute-force-resistant KDF whose random
 * per-record salt is embedded in the stored string (so the table needs no
 * separate salt column). The plaintext is NEVER stored, logged, or returned, and
 * verification is constant-time (`timingSafeEqual`) so a wrong guess leaks no
 * timing signal about how many leading characters matched.
 *
 * Layer-boundary contract: imports only `node:crypto` and the injected
 * `DatabaseClient` — nothing from `boardgame.io`, `@legendary-arena/game-engine`,
 * `@legendary-arena/registry`, `@legendary-arena/preplan`, or any UI/client
 * package. No engine `G`/`ctx`; `legendary.match_guest_access` is an ordinary
 * server-layer domain table.
 *
 * Authority: WP-630; EC-665; D-24441 (per-match guest password + security
 * posture); D-24120 (the seat a password grants is minted rowless → Casual).
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DatabaseClient } from '../identity/identity.types.js';

/**
 * The result of checking a supplied password against a match's stored access
 * row. A discriminated string union (not a bare boolean) so the caller can map
 * `no-access` → HTTP 409 and `mismatch` → HTTP 401 distinctly — the two are
 * different failures (the match has no password at all vs. a wrong password).
 */
export type GuestPasswordVerdict = 'no-access' | 'mismatch' | 'match';

/**
 * The per-field update a host submits. Each field is a three-state control:
 * `undefined` (absent) leaves the stored value unchanged; the empty string
 * clears it (sets NULL); any other string sets it. This is what lets a host
 * rename the match WITHOUT wiping the password (and vice-versa).
 */
export interface GuestAccessUpdate {
  gameName?: string;
  password?: string;
}

/**
 * The lobby-safe projection of a match's guest access: the display name (or
 * null) and whether a guest password is set — NEVER the derived key itself.
 */
export interface GuestAccessMeta {
  gameName: string | null;
  hasGuestPassword: boolean;
}

// why: scrypt work parameters. keylen 64 bytes; a 16-byte random salt per record.
// scryptSync's default cost (N=16384) is the accepted interactive-login cost and
// is fast enough for a one-off join. The salt is embedded in the stored string,
// so no separate salt column exists.
const SALT_BYTE_LENGTH = 16;
const DERIVED_KEY_BYTE_LENGTH = 64;

/**
 * Hashes a plaintext guest password into the storable `"saltHex:keyHex"` form
 * using a fresh random salt. The returned string is what goes into
 * `match_guest_access.password_kdf`; the plaintext is discarded by the caller.
 *
 * @param plaintextPassword The host-chosen password (a non-empty string).
 * @returns The `"saltHex:keyHex"` scrypt derived-key string.
 */
export function hashGuestPassword(plaintextPassword: string): string {
  const salt = randomBytes(SALT_BYTE_LENGTH);
  const derivedKey = scryptSync(plaintextPassword, salt, DERIVED_KEY_BYTE_LENGTH);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a candidate password against a stored `"saltHex:keyHex"` string in
 * constant time. Re-derives the key with the stored salt and compares with
 * `timingSafeEqual` (after a length precheck, which `timingSafeEqual` requires).
 * A malformed stored string returns false rather than throwing.
 *
 * @param candidatePassword The password the guest typed.
 * @param storedKdf The `"saltHex:keyHex"` value from the database.
 * @returns True only when the candidate re-derives the stored key.
 */
export function verifyGuestPasswordHash(candidatePassword: string, storedKdf: string): boolean {
  const separatorIndex = storedKdf.indexOf(':');
  if (separatorIndex <= 0) {
    // why: a stored value without a salt:key separator is corrupt; treat it as a
    // non-match rather than throwing, so a bad row cannot 500 a public endpoint.
    return false;
  }
  const saltHex = storedKdf.slice(0, separatorIndex);
  const keyHex = storedKdf.slice(separatorIndex + 1);
  const storedKey = Buffer.from(keyHex, 'hex');
  const candidateKey = scryptSync(candidatePassword, Buffer.from(saltHex, 'hex'), storedKey.length);
  // why: timingSafeEqual throws on a length mismatch, so guard it first; a
  // differing length is already a definite non-match.
  if (storedKey.length !== candidateKey.length) {
    return false;
  }
  return timingSafeEqual(storedKey, candidateKey);
}

/**
 * Reads a match's raw access row (including the derived key) for internal use by
 * `verifyGuestPassword`. Not exported — the derived key never leaves this module.
 *
 * @param matchId The bgio match id.
 * @param database The injected pg pool.
 * @returns The row's `game_name` + `password_kdf`, or null when no row exists.
 */
async function readGuestAccessRow(
  matchId: string,
  database: DatabaseClient,
): Promise<{ gameName: string | null; passwordKdf: string | null } | null> {
  const result = await database.query(
    'SELECT game_name, password_kdf FROM legendary.match_guest_access WHERE match_id = $1',
    [matchId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0] as { game_name: string | null; password_kdf: string | null };
  return { gameName: row.game_name, passwordKdf: row.password_kdf };
}

/**
 * Sets (creates or updates) a match's guest access with per-field merge
 * semantics: an absent field is left unchanged; an empty-string field is cleared
 * to NULL; any other string is stored (the password hashed first). Reads the
 * current row so an absent field can be preserved on update. Idempotent per
 * `match_id`.
 *
 * @param matchId The bgio match id.
 * @param update The per-field update (`gameName?`, `password?`).
 * @param database The injected pg pool.
 */
export async function setGuestAccess(
  matchId: string,
  update: GuestAccessUpdate,
  database: DatabaseClient,
): Promise<void> {
  const existing = await readGuestAccessRow(matchId, database);
  const existingGameName = existing === null ? null : existing.gameName;
  const existingKdf = existing === null ? null : existing.passwordKdf;

  // why: three-state merge per field — undefined leaves the stored value,
  // '' clears it to NULL, any other string sets it (the password is hashed).
  // This is what stops a rename (gameName only) from wiping the password.
  let nextGameName: string | null;
  if (update.gameName === undefined) {
    nextGameName = existingGameName;
  } else if (update.gameName === '') {
    nextGameName = null;
  } else {
    nextGameName = update.gameName;
  }

  let nextKdf: string | null;
  if (update.password === undefined) {
    nextKdf = existingKdf;
  } else if (update.password === '') {
    nextKdf = null;
  } else {
    nextKdf = hashGuestPassword(update.password);
  }

  await database.query(
    'INSERT INTO legendary.match_guest_access (match_id, game_name, password_kdf) ' +
      'VALUES ($1, $2, $3) ' +
      'ON CONFLICT (match_id) ' +
      'DO UPDATE SET game_name = EXCLUDED.game_name, password_kdf = EXCLUDED.password_kdf, updated_at = now()',
    [matchId, nextGameName, nextKdf],
  );
}

/**
 * Verifies a guest's supplied password against a match's stored access row and
 * returns a discriminated verdict: `no-access` when the match has no password
 * set, `mismatch` when the password is wrong, `match` when it is correct.
 *
 * @param matchId The bgio match id.
 * @param candidatePassword The password the guest typed.
 * @param database The injected pg pool.
 * @returns The `GuestPasswordVerdict`.
 */
export async function verifyGuestPassword(
  matchId: string,
  candidatePassword: string,
  database: DatabaseClient,
): Promise<GuestPasswordVerdict> {
  const existing = await readGuestAccessRow(matchId, database);
  if (existing === null || existing.passwordKdf === null) {
    return 'no-access';
  }
  if (verifyGuestPasswordHash(candidatePassword, existing.passwordKdf)) {
    return 'match';
  }
  return 'mismatch';
}

/**
 * Reads a match's lobby-safe guest access metadata: the display name (or null)
 * and whether a guest password is set. NEVER returns the derived key.
 *
 * @param matchId The bgio match id.
 * @param database The injected pg pool.
 * @returns The `GuestAccessMeta` (name + hasGuestPassword).
 */
export async function readGuestAccessMeta(
  matchId: string,
  database: DatabaseClient,
): Promise<GuestAccessMeta> {
  const existing = await readGuestAccessRow(matchId, database);
  if (existing === null) {
    return { gameName: null, hasGuestPassword: false };
  }
  return {
    gameName: existing.gameName,
    hasGuestPassword: existing.passwordKdf !== null,
  };
}
