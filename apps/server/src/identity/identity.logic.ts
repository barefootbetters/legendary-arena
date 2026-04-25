/**
 * Player Identity Logic — Server Layer (WP-052)
 *
 * Public functions for creating and looking up authenticated player
 * accounts and ephemeral guest identities. All persistent operations
 * go through PostgreSQL via a caller-injected `DatabaseClient`
 * (`pg.Pool`); the pool is created at server startup by future
 * request-handler WPs and is not wired by this packet.
 *
 * Determinism contract: every UUID is sourced from
 * `node:crypto.randomUUID()` or, in tests, from a caller-injected
 * `idProvider` stub. Production callers omit `idProvider`; tests
 * pass a deterministic generator. There is exactly one wall-clock
 * read in this module — `createGuestIdentity`'s `new Date().toISOString()`
 * — and it is acceptable because guest identities are ephemeral and
 * never participate in deterministic replay.
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/game-engine` (especially the
 * engine `PlayerId` per D-5201), `@legendary-arena/registry`,
 * `@legendary-arena/preplan`, or any UI / client / replay-producer
 * package. Type imports come exclusively from `./identity.types.js`;
 * the only runtime import is `node:crypto.randomUUID`.
 *
 * Authority: WP-052 §Scope C; D-5201 (AccountId distinct from engine
 * PlayerId); D-5202 (server identity directory classification);
 * D-8701 (engine PlayerId is plain string); 00.2-data-requirements.md §1
 * (legendary.* namespace, ext_id cross-service identifier).
 */

// why: node:crypto.randomUUID() avoids external dependencies and is
// FIPS-compliant in Node 22+; injectable provider preserves test
// determinism without polluting the production path.
import { randomUUID } from 'node:crypto';

import type {
  AccountId,
  AuthProvider,
  DatabaseClient,
  GuestIdentity,
  PlayerAccount,
  Result,
} from './identity.types.js';

/**
 * Canonicalize an email address by trimming surrounding whitespace
 * and lowercasing. Both `createPlayerAccount` (insert) and
 * `findPlayerByEmail` (lookup) apply this helper, which means the
 * DB constraint `email text UNIQUE` enforces case-folded uniqueness;
 * callers do not need to canonicalize before querying.
 */
// why: email uniqueness is enforced at the DB level on canonicalized
// values. Skipping canonicalization on either path would silently
// allow `Foo@Example.com` and `foo@example.com` to occupy two
// distinct accounts — verified by test #6 in identity.logic.test.ts.
function canonicalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Validate a `displayName` candidate. Returns a discriminated-union
 * result; the caller surfaces the structured error to its own
 * `Result<T>` boundary. Three failure branches: empty after trim,
 * length over 64, and any control character (0x00-0x1F or 0x7F).
 */
function validateDisplayName(
  input: string,
):
  | { ok: true; value: string }
  | { ok: false; reason: string; code: 'invalid_display_name' } {
  const trimmed = input.trim();
  if (trimmed.length < 1) {
    return {
      ok: false,
      reason:
        'displayName must contain at least one non-whitespace character after trimming.',
      code: 'invalid_display_name',
    };
  }
  if (trimmed.length > 64) {
    return {
      ok: false,
      reason: 'displayName must be 64 characters or fewer after trimming.',
      code: 'invalid_display_name',
    };
  }
  // why: control characters (0x00-0x1F, 0x7F) are rejected because
  // they are never legitimate in displayed names and have been used
  // in homoglyph / impersonation attacks against display-name
  // surfaces.
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return {
      ok: false,
      reason:
        'displayName must not contain control characters (newlines, tabs, or other 0x00-0x1F / 0x7F characters).',
      code: 'invalid_display_name',
    };
  }
  return { ok: true, value: trimmed };
}

/**
 * Map a `legendary.players` row (snake_case columns) to the locked
 * `PlayerAccount` shape (camelCase fields). Brand-cast for
 * `accountId` happens here at the read boundary; subsequent reads
 * consume the brand without re-casting. Timestamp columns arrive
 * from `pg` as JavaScript `Date` objects and are converted to ISO
 * 8601 strings to match the `PlayerAccount.createdAt` /
 * `.updatedAt` contract.
 */
function mapPlayerAccountRow(row: {
  ext_id: string;
  email: string;
  display_name: string;
  auth_provider: string;
  auth_provider_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}): PlayerAccount {
  return {
    accountId: row.ext_id as AccountId,
    email: row.email,
    displayName: row.display_name,
    authProvider: row.auth_provider as AuthProvider,
    authProviderId: row.auth_provider_id,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at,
  };
}

/**
 * Insert a new `PlayerAccount`. Returns `Result.ok=true` with the
 * stored record on success. Returns `Result.ok=false` with code
 * `'invalid_display_name'` on validation failure or
 * `'duplicate_email'` on PostgreSQL unique-violation (SQLSTATE
 * 23505). All other errors propagate — they indicate infrastructure
 * failure (connection lost, permission denied), not caller error.
 *
 * Email is canonicalized before insert. `accountId` is generated via
 * `idProvider` (defaulting to `randomUUID`) and brand-cast at
 * exactly this site. `created_at` and `updated_at` default to
 * `now()` at the database level and are equal at insert time.
 */
export async function createPlayerAccount(
  input: {
    email: string;
    displayName: string;
    authProvider: AuthProvider;
    authProviderId: string;
  },
  database: DatabaseClient,
  idProvider: () => string = randomUUID,
): Promise<Result<PlayerAccount>> {
  const canonicalEmail = canonicalizeEmail(input.email);
  const nameValidation = validateDisplayName(input.displayName);
  if (nameValidation.ok === false) {
    // why: structured error mapping — validation failures return a
    // typed Result with the same `code` discriminant the caller
    // would receive from the DB-level duplicate path, so callers
    // dispatch on `code` without parsing prose.
    return {
      ok: false,
      reason: nameValidation.reason,
      code: nameValidation.code,
    };
  }
  const accountId = idProvider() as AccountId;
  try {
    const result = await database.query(
      'INSERT INTO legendary.players ' +
        '(ext_id, email, display_name, auth_provider, auth_provider_id) ' +
        'VALUES ($1, $2, $3, $4, $5) ' +
        'RETURNING ext_id, email, display_name, auth_provider, ' +
        'auth_provider_id, created_at, updated_at',
      [
        accountId,
        canonicalEmail,
        nameValidation.value,
        input.authProvider,
        input.authProviderId,
      ],
    );
    return { ok: true, value: mapPlayerAccountRow(result.rows[0]) };
  } catch (error) {
    // why: PostgreSQL unique-violation SQLSTATE is '23505'. Mapping
    // it to a structured Result with code 'duplicate_email' lets
    // callers dispatch deterministically; any other error indicates
    // infrastructure failure and is rethrown so it surfaces in
    // operational logs.
    if (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: unknown }).code === '23505'
    ) {
      return {
        ok: false,
        reason:
          'Email already registered for an existing account; use findPlayerByEmail to locate the existing record.',
        code: 'duplicate_email',
      };
    }
    throw error;
  }
}

/**
 * Look up a player account by canonicalized email. Returns the
 * mapped `PlayerAccount` if found, `null` otherwise. The lookup
 * canonicalizes the input the same way `createPlayerAccount` does
 * so the case-folded `UNIQUE` constraint is honored on read.
 */
export async function findPlayerByEmail(
  email: string,
  database: DatabaseClient,
): Promise<PlayerAccount | null> {
  const canonicalEmail = canonicalizeEmail(email);
  const result = await database.query(
    'SELECT ext_id, email, display_name, auth_provider, ' +
      'auth_provider_id, created_at, updated_at ' +
      'FROM legendary.players WHERE email = $1 LIMIT 1',
    [canonicalEmail],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapPlayerAccountRow(result.rows[0]);
}

/**
 * Look up a player account by `AccountId` (mapped to
 * `legendary.players.ext_id`). Returns the mapped record if found,
 * `null` otherwise.
 */
export async function findPlayerByAccountId(
  accountId: AccountId,
  database: DatabaseClient,
): Promise<PlayerAccount | null> {
  const result = await database.query(
    'SELECT ext_id, email, display_name, auth_provider, ' +
      'auth_provider_id, created_at, updated_at ' +
      'FROM legendary.players WHERE ext_id = $1 LIMIT 1',
    [accountId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  return mapPlayerAccountRow(result.rows[0]);
}

/**
 * Construct an ephemeral `GuestIdentity`. Pure function: no DB
 * access, no I/O. The `guestSessionId` is a UUID v4 from
 * `idProvider` (defaulting to `randomUUID`). Guests do not have
 * rows in `legendary.players`; their identity exists only in the
 * caller's process memory for the lifetime of the guest session.
 */
// why: ISO 8601 timestamps are the canonical createdAt format
// across the project. createGuestIdentity is the only site in this
// module that introduces a wall-clock read, and it is acceptable
// because guest identities are ephemeral and never participate in
// deterministic replay — the engine's determinism contract
// (ctx.random.* exclusivity) does not extend to ephemeral
// server-side identity bookkeeping.
export function createGuestIdentity(
  idProvider: () => string = randomUUID,
): GuestIdentity {
  return {
    guestSessionId: idProvider(),
    createdAt: new Date().toISOString(),
    isGuest: true,
  };
}
