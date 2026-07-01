/**
 * Profile Loadout Library Logic — Server Layer (WP-301 / EC-332)
 *
 * The single source of validation + per-account cap + opaque-slug
 * minting + SQL for the saved-loadout surface (Vision §19b). The
 * route adapter in `loadoutLibrary.routes.ts` only authenticates,
 * parses request structure, and maps typed errors to HTTP status;
 * every business decision lives here.
 *
 * Public functions:
 *   * `createLoadout` — validate LAGN + name, enforce the cap, insert
 *     a private row scoped to the caller.
 *   * `listLoadouts` — the caller's rows, ordered `updated_at DESC`.
 *   * `updateLoadout` — rename + visibility toggle; mints / preserves /
 *     clears `share_slug` per the locked transition table.
 *   * `deleteLoadout` — delete one of the caller's rows by id.
 *   * `getPublicLoadoutBySlug` — the guest read: public rows only,
 *     allowlisted projection (name + lagn + displayHandle).
 *
 * Layer-boundary contract: the only cross-layer import in this file is
 * `@legendary-arena/lagn` (a pure zod validator, authorized by
 * D-24086). It imports nothing from the engine runtime, the registry
 * runtime, or any UI / client package; the `pg` driver is reachable
 * only through the `DatabaseClient` alias.
 *
 * Ownership keying mirrors the migration-009 profile pattern: every
 * `/api/me/*` operation resolves `ext_id -> player_id` inline and
 * scopes the query by the resolved `player_id`, so account B can
 * never read or mutate account A's rows (a cross-account id returns
 * `not_found` with no existence leak).
 *
 * Authority: WP-301 §Scope (In) §C + §Locked Values; EC-332 §Locked
 * Values + §Guardrails; D-24086.
 */

import { randomBytes } from 'node:crypto';
import { validate } from '@legendary-arena/lagn';
import type { LAGN } from '@legendary-arena/lagn';
import type {
  AccountId,
  CreateLoadoutInput,
  DatabaseClient,
  LoadoutLibraryResult,
  PublicLoadoutView,
  SavedLoadoutView,
  UpdateLoadoutPatch,
} from './loadoutLibrary.types.js';
import {
  MAX_SAVED_LOADOUTS_PER_ACCOUNT,
  SHARE_SLUG_BYTES,
} from './loadoutLibrary.types.js';

/**
 * Locked minimum / maximum length for a loadout `name` (D-24086).
 * The name is trimmed before this check and persisted trimmed; an
 * empty-after-trim or over-maximum name is rejected `invalid_name`.
 */
const MIN_LOADOUT_NAME_LENGTH = 1;
const MAX_LOADOUT_NAME_LENGTH = 80;

/**
 * Canonical-UUID shape matcher for the `:id` path param. A `:id` that
 * is not a well-formed UUID must never reach a `WHERE id = $1::uuid`
 * query — Postgres would raise `invalid input syntax for type uuid`
 * and surface a 500. Instead the logic returns `not_found` for a
 * malformed id, identical to the cross-account-isolation response so
 * a caller cannot distinguish "no such id" from "not your id".
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PlayerLoadoutRow {
  id: string;
  name: string;
  lagn_json: unknown;
  visibility: string;
  share_slug: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Resolve the bigint `player_id` for an `AccountId`. Mirrors the
 * WP-104 `loadPlayerIdByAccountId` precedent verbatim. Returns `null`
 * when no `legendary.players` row matches the supplied `accountId`
 * (a rare race against deletion). Pure read — no mutation.
 */
async function loadPlayerIdByAccountId(
  accountId: AccountId,
  database: DatabaseClient,
): Promise<number | null> {
  const result = await database.query(
    'SELECT player_id FROM legendary.players WHERE ext_id = $1 LIMIT 1',
    [accountId],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const rawId = result.rows[0].player_id;
  return typeof rawId === 'string' ? Number(rawId) : rawId;
}

/**
 * Convert a `timestamptz` column value (which `pg` may hand back as a
 * `Date` or an ISO string depending on driver configuration) to an
 * ISO-8601 string for the wire shape.
 */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Map a `legendary.player_loadouts` row to the owner `SavedLoadoutView`
 * wire shape. `lagn_json` is returned by `pg` already parsed from
 * `jsonb`, so it is cast to `LAGN` (it passed `validate` at write
 * time). `player_id` and the owner's `ext_id` are deliberately not
 * mapped — they are server-internal.
 */
function mapLoadoutRow(row: PlayerLoadoutRow): SavedLoadoutView {
  return {
    id: row.id,
    name: row.name,
    visibility: row.visibility as SavedLoadoutView['visibility'],
    shareSlug: row.share_slug,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    lagn: row.lagn_json as LAGN,
  };
}

/**
 * Validate and normalize a candidate loadout name. Trims first, then
 * enforces the locked 1–80-character bound. Returns the trimmed value
 * on success or a typed `invalid_name` on empty-after-trim / over-80 /
 * non-string input.
 */
export function validateLoadoutName(
  candidate: unknown,
): LoadoutLibraryResult<string> {
  if (typeof candidate !== 'string') {
    return {
      ok: false,
      reason:
        'Loadout name must be a string of 1 to 80 characters; received a non-string value.',
      code: 'invalid_name',
    };
  }
  const trimmed = candidate.trim();
  if (trimmed.length < MIN_LOADOUT_NAME_LENGTH) {
    return {
      ok: false,
      reason:
        'Loadout name must contain at least one non-whitespace character; received an empty or whitespace-only value.',
      code: 'invalid_name',
    };
  }
  if (trimmed.length > MAX_LOADOUT_NAME_LENGTH) {
    return {
      ok: false,
      reason: `Loadout name must be ${MAX_LOADOUT_NAME_LENGTH} characters or fewer after trimming; received a longer value.`,
      code: 'invalid_name',
    };
  }
  return { ok: true, value: trimmed };
}

/**
 * Generate one candidate `share_slug`: `crypto.randomBytes(16)` →
 * `base64url` → a 22-character opaque URL-safe string.
 *
 * why: the slug is random and URL-safe, never derived from
 * `id` / `name` / `player_id`. A derived slug would leak the row's
 * identity or let a caller enumerate other loadouts; 128 bits of
 * entropy makes the slug unguessable.
 */
function generateShareSlug(): string {
  return randomBytes(SHARE_SLUG_BYTES).toString('base64url');
}

/**
 * Mint a `share_slug` that is unique against
 * `legendary.player_loadouts.share_slug`. Generates a candidate,
 * checks it against the table, and retries on collision until a free
 * slug is found (bounded by a generous attempt cap as a safety valve).
 *
 * why: the partial-unique index is the durable backstop, but a
 * check-then-write minimizes the chance of hitting it. The generator
 * is injectable so a test can force the collision path (a colliding
 * candidate followed by a unique one) deterministically; production
 * passes the default `crypto.randomBytes`-based generator.
 */
export async function mintUniqueShareSlug(
  database: DatabaseClient,
  generateSlug: () => string = generateShareSlug,
): Promise<string> {
  const maxAttempts = 16;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateSlug();
    const existing = await database.query(
      'SELECT 1 FROM legendary.player_loadouts WHERE share_slug = $1 LIMIT 1',
      [candidate],
    );
    if (existing.rows.length === 0) {
      return candidate;
    }
  }
  throw new Error(
    'Failed to mint a unique share slug after 16 attempts; the slug generator may be returning a constant value or the table is exhausted.',
  );
}

/**
 * Create a new saved loadout for the caller. Validates the name and
 * the LAGN document, enforces the per-account cap, and inserts a
 * private row (no `share_slug` until the owner makes it public).
 *
 * why (server-side validate): the LAGN document is untrusted client
 * input — it is validated against `@legendary-arena/lagn` before any
 * write and an invalid document is rejected `invalid_lagn` and never
 * stored. Client-side validation is not the gate.
 */
export async function createLoadout(
  accountId: AccountId,
  input: CreateLoadoutInput,
  database: DatabaseClient,
): Promise<LoadoutLibraryResult<SavedLoadoutView>> {
  const nameResult = validateLoadoutName(input.name);
  if (nameResult.ok === false) {
    return nameResult;
  }

  // why: never trust client LAGN — validate every stored document
  // server-side with @legendary-arena/lagn; an invalid document is
  // rejected and never reaches storage.
  const lagnValidation = validate(input.lagn);
  if (lagnValidation.valid === false) {
    return {
      ok: false,
      reason:
        'The provided loadout does not conform to the LAGN v1.0 schema and was not saved; correct the loadout document and retry.',
      code: 'invalid_lagn',
    };
  }

  const playerId = await loadPlayerIdByAccountId(accountId, database);
  if (playerId === null) {
    return Promise.reject(
      new Error(
        'No legendary.players row matches the authenticated accountId; the account row may have been deleted between session validation and this create.',
      ),
    );
  }

  // why: enforce the free-tier quota BEFORE inserting so the library
  // can never grow past the cap; the 51st create is rejected with a
  // typed loadout_limit_reached error, not a silent drop or a 500.
  const countResult = await database.query(
    'SELECT count(*)::int AS loadout_count FROM legendary.player_loadouts WHERE player_id = $1',
    [playerId],
  );
  const existingCount = countResult.rows[0].loadout_count as number;
  if (existingCount >= MAX_SAVED_LOADOUTS_PER_ACCOUNT) {
    return {
      ok: false,
      reason: `This account already holds the maximum of ${MAX_SAVED_LOADOUTS_PER_ACCOUNT} saved loadouts; delete one before saving another.`,
      code: 'loadout_limit_reached',
    };
  }

  const insertResult = await database.query(
    'INSERT INTO legendary.player_loadouts (player_id, name, lagn_json) ' +
      'VALUES ($1, $2, $3::jsonb) ' +
      'RETURNING id, name, lagn_json, visibility, share_slug, created_at, updated_at',
    [playerId, nameResult.value, JSON.stringify(input.lagn)],
  );
  return { ok: true, value: mapLoadoutRow(insertResult.rows[0] as PlayerLoadoutRow) };
}

/**
 * List the caller's saved loadouts, most-recently-touched first.
 * Returns each row's full `lagn` document so the client can render
 * "view as cards" without a second fetch (WP-301 §Out of Scope: no
 * pagination / summary projection at the 50-cap payload size).
 */
export async function listLoadouts(
  accountId: AccountId,
  database: DatabaseClient,
): Promise<LoadoutLibraryResult<SavedLoadoutView[]>> {
  const playerId = await loadPlayerIdByAccountId(accountId, database);
  if (playerId === null) {
    return Promise.reject(
      new Error(
        'No legendary.players row matches the authenticated accountId; the account row may have been deleted between session validation and this list.',
      ),
    );
  }

  // why: updated_at DESC is the locked list ordering — the most
  // recently created or edited loadout appears first.
  const result = await database.query(
    'SELECT id, name, lagn_json, visibility, share_slug, created_at, updated_at ' +
      'FROM legendary.player_loadouts ' +
      'WHERE player_id = $1 ' +
      'ORDER BY updated_at DESC, id ASC',
    [playerId],
  );
  const loadouts: SavedLoadoutView[] = [];
  for (const row of result.rows as PlayerLoadoutRow[]) {
    loadouts.push(mapLoadoutRow(row));
  }
  return { ok: true, value: loadouts };
}

/**
 * Rename and / or change the visibility of one of the caller's saved
 * loadouts. The `share_slug` follows the locked visibility transition
 * table; `updated_at` advances on any real change.
 *
 * why (empty_update + updated_at): a PATCH with neither `name` nor
 * `visibility` present writes nothing and is rejected `empty_update`
 * (a no-op must not silently succeed or bump the timestamp); any PATCH
 * that carries at least one field is a real change and sets
 * `updated_at = now()`.
 *
 * The `slugGenerator` parameter is injectable for deterministic
 * collision-path testing; production omits it and uses the default
 * `crypto.randomBytes`-based generator.
 */
export async function updateLoadout(
  accountId: AccountId,
  loadoutId: string,
  patch: UpdateLoadoutPatch,
  database: DatabaseClient,
  slugGenerator?: () => string,
): Promise<LoadoutLibraryResult<SavedLoadoutView>> {
  const hasName = Object.hasOwn(patch, 'name');
  const hasVisibility = Object.hasOwn(patch, 'visibility');
  if (hasName === false && hasVisibility === false) {
    return {
      ok: false,
      reason:
        'A loadout update must change at least the name or the visibility; the request carried neither field.',
      code: 'empty_update',
    };
  }

  let trimmedName: string | null = null;
  if (hasName === true) {
    const nameResult = validateLoadoutName(patch.name);
    if (nameResult.ok === false) {
      return nameResult;
    }
    trimmedName = nameResult.value;
  }

  // why: a malformed :id must return not_found (never a 500 from a
  // uuid-cast error, never an existence leak) — identical to the
  // cross-account isolation response below.
  if (UUID_PATTERN.test(loadoutId) === false) {
    return {
      ok: false,
      reason:
        'No saved loadout matches the supplied id for this account; the id is not a well-formed identifier.',
      code: 'not_found',
    };
  }

  const playerId = await loadPlayerIdByAccountId(accountId, database);
  if (playerId === null) {
    return Promise.reject(
      new Error(
        'No legendary.players row matches the authenticated accountId; the account row may have been deleted between session validation and this update.',
      ),
    );
  }

  // why: scope the read by the resolved player_id so account B reading
  // account A's id gets zero rows -> not_found (no existence leak).
  const currentResult = await database.query(
    'SELECT id, name, lagn_json, visibility, share_slug, created_at, updated_at ' +
      'FROM legendary.player_loadouts ' +
      'WHERE id = $1 AND player_id = $2 LIMIT 1',
    [loadoutId, playerId],
  );
  if (currentResult.rows.length === 0) {
    return {
      ok: false,
      reason:
        'No saved loadout matches the supplied id for this account; it may not exist or may belong to another account.',
      code: 'not_found',
    };
  }
  const currentRow = currentResult.rows[0] as PlayerLoadoutRow;

  const nextName = trimmedName === null ? currentRow.name : trimmedName;
  const nextVisibility = hasVisibility === true
    ? (patch.visibility as SavedLoadoutView['visibility'])
    : (currentRow.visibility as SavedLoadoutView['visibility']);

  // why: locked visibility -> slug transitions. private->public mints
  // a slug (when none exists); public->public preserves the existing
  // slug so an already-shared link keeps working; ->private clears the
  // slug; private->private leaves it null.
  let nextSlug = currentRow.share_slug;
  if (nextVisibility === 'public' && currentRow.share_slug === null) {
    nextSlug = await mintUniqueShareSlug(database, slugGenerator);
  } else if (nextVisibility === 'private') {
    nextSlug = null;
  }

  const updateResult = await database.query(
    'UPDATE legendary.player_loadouts ' +
      'SET name = $1, visibility = $2, share_slug = $3, updated_at = now() ' +
      'WHERE id = $4 AND player_id = $5 ' +
      'RETURNING id, name, lagn_json, visibility, share_slug, created_at, updated_at',
    [nextName, nextVisibility, nextSlug, loadoutId, playerId],
  );
  return { ok: true, value: mapLoadoutRow(updateResult.rows[0] as PlayerLoadoutRow) };
}

/**
 * Delete one of the caller's saved loadouts by id. Returns
 * `not_found` for a malformed id, a missing id, or an id owned by
 * another account (cross-account isolation, no existence leak).
 */
export async function deleteLoadout(
  accountId: AccountId,
  loadoutId: string,
  database: DatabaseClient,
): Promise<LoadoutLibraryResult<void>> {
  // why: malformed :id -> not_found, same as the missing / cross-account
  // case; never a uuid-cast 500 and never an existence leak.
  if (UUID_PATTERN.test(loadoutId) === false) {
    return {
      ok: false,
      reason:
        'No saved loadout matches the supplied id for this account; the id is not a well-formed identifier.',
      code: 'not_found',
    };
  }

  const playerId = await loadPlayerIdByAccountId(accountId, database);
  if (playerId === null) {
    return Promise.reject(
      new Error(
        'No legendary.players row matches the authenticated accountId; the account row may have been deleted between session validation and this delete.',
      ),
    );
  }

  // why: scope the delete by the resolved player_id so account B
  // cannot delete account A's row; rowCount 0 -> not_found.
  const deleteResult = await database.query(
    'DELETE FROM legendary.player_loadouts WHERE id = $1 AND player_id = $2',
    [loadoutId, playerId],
  );
  const deletedCount = deleteResult.rowCount ?? 0;
  if (deletedCount === 0) {
    return {
      ok: false,
      reason:
        'No saved loadout matches the supplied id for this account; it may not exist or may belong to another account.',
      code: 'not_found',
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Read one public saved loadout by its opaque `share_slug` for the
 * guest endpoint. Returns `not_found` for a missing slug or a private
 * loadout; on success returns ONLY the allowlisted public projection.
 *
 * why (public-only allowlist): the guest projection carries only the
 * loadout's name, its lagn document, and the owner's public
 * displayHandle. It never carries accountId / ext_id, never the
 * internal player_id, and never a private loadout — the `visibility =
 * 'public'` filter plus the null-slug-on-private invariant guarantee a
 * private loadout is unreachable via this endpoint.
 */
export async function getPublicLoadoutBySlug(
  shareSlug: string,
  database: DatabaseClient,
): Promise<LoadoutLibraryResult<PublicLoadoutView>> {
  const result = await database.query(
    'SELECT loadout.name, loadout.lagn_json, player.display_handle, player.display_name ' +
      'FROM legendary.player_loadouts AS loadout ' +
      'JOIN legendary.players AS player ON player.player_id = loadout.player_id ' +
      "WHERE loadout.share_slug = $1 AND loadout.visibility = 'public' LIMIT 1",
    [shareSlug],
  );
  if (result.rows.length === 0) {
    return {
      ok: false,
      reason:
        'No public loadout matches the supplied share slug; it may not exist or may be private.',
      code: 'not_found',
    };
  }
  const row = result.rows[0] as {
    name: string;
    lagn_json: unknown;
    display_handle: string | null;
    display_name: string;
  };
  // why: fall back to display_name when the owner has not claimed a
  // handle, mirroring the public-profile displayHandle fallback in
  // profile.logic.ts so the response is always structurally valid.
  const displayHandle =
    row.display_handle === null ? row.display_name : row.display_handle;
  return {
    ok: true,
    value: {
      name: row.name,
      lagn: row.lagn_json as LAGN,
      displayHandle,
    },
  };
}
