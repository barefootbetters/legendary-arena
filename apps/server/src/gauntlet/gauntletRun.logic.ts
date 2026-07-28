/**
 * Gauntlet Run Import + Run-CRUD Logic — Server Layer (WP-445 / EC-480)
 *
 * The single source of pack validation + gauntlet-existence resolution +
 * per-leg-pick structural validation + all SQL for the account-local gauntlet
 * run workspace (the sixth WP of the Mastermind Gauntlets: download → import →
 * build → track epic). The route adapter in `gauntletRun.routes.ts` only
 * authenticates, parses request structure, and maps typed errors to HTTP
 * status; every business decision lives here.
 *
 * Public functions:
 *   * `importGauntletRun` — validate a WP-440 identity pack, resolve gauntlet
 *     existence via the INJECTED resolver, and idempotently insert-or-attach an
 *     active run with empty `leg_picks` (D-24264).
 *   * `listGauntletRuns` — the caller's raw stored runs (identity + `legPicks`
 *     + timestamps; NO derived projection — that is WP-446).
 *   * `updateGauntletRunLegPicks` — structurally validate + persist `legPicks`;
 *     advance `updated_at`.
 *   * `deleteGauntletRun` — delete one of the caller's runs by id.
 *
 * Layer-boundary contract: the only cross-package import in this file is
 * `@legendary-arena/registry` (`validateGauntletPack`, the WP-440 pack
 * validator — a pure Zod validator the server layer already imports). It
 * imports nothing from the engine runtime, the speculative-planning layer, the
 * match framework, or any client app package; the `pg` driver is reachable only
 * through the `DatabaseClient` alias, and gauntlet existence is reached through
 * the injected resolver (never a registry-catalog build in this layer).
 *
 * Ownership keying mirrors the WP-301 loadout-library precedent: every
 * operation resolves `AccountId -> player_id` inline and scopes the query by
 * the resolved `player_id`, so account B can never read or mutate account A's
 * runs (a cross-account id returns `not_found` with no existence leak).
 *
 * Authority: WP-445 §Scope (In) + §Contract; EC-480 §Locked Values +
 * §Guardrails; D-24262 (derived-progression lock); D-24264 (import-idempotency
 * + run-API-shape lock).
 */

import { validateGauntletPack } from '@legendary-arena/registry/gauntletPack';
import type {
  AccountId,
  DatabaseClient,
  GauntletExistenceResolver,
  GauntletRunLegPicks,
  GauntletRunResult,
  GauntletRunView,
  ImportGauntletRunInput,
  UpdateGauntletRunPatch,
} from './gauntletRun.types.js';

/**
 * Canonical-UUID shape matcher for the `:id` path param. A `:id` that is not a
 * well-formed UUID must never reach a `WHERE id = $1::uuid` query — Postgres
 * would raise `invalid input syntax for type uuid` and surface a 500. Instead
 * the logic returns `not_found` for a malformed id, identical to the
 * cross-account-isolation response so a caller cannot distinguish "no such id"
 * from "not your id" (the WP-301 loadout precedent).
 */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The Postgres SQLSTATE for a unique-constraint violation. The idempotent
 * import catches exactly this code on the active-identity partial-unique index
 * and resolves it to the existing active run (D-24264), rather than surfacing a
 * 409/500.
 */
const UNIQUE_VIOLATION_SQLSTATE = '23505';

/**
 * The columns every run read / write returns, in the wire order the row→view
 * mapper expects. Declared once so the four query sites stay byte-identical.
 */
const RUN_COLUMNS =
  'id, set_abbr, mastermind_slug, division, player_count, ' +
  'leg_picks, created_at, updated_at, first_completed_at';

interface PlayerGauntletRunRow {
  id: string;
  set_abbr: string;
  mastermind_slug: string;
  division: string;
  player_count: number | string;
  leg_picks: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  first_completed_at: Date | string | null;
}

/**
 * The outcome of an idempotent import: the run view plus whether a brand-new
 * row was inserted (`201`) or an existing active run was attached to (`200`).
 * The route maps `wasCreated` to the locked status code.
 */
export interface ImportGauntletRunOutcome {
  readonly view: GauntletRunView;
  readonly wasCreated: boolean;
}

/**
 * Resolve the bigint `player_id` for an `AccountId`. Mirrors the WP-301
 * `loadPlayerIdByAccountId` precedent verbatim. Returns `null` when no
 * `legendary.players` row matches the supplied `accountId` (a rare race against
 * deletion). Pure read — no mutation.
 */
export async function loadPlayerIdByAccountId(
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
 * Convert a `timestamptz` column value (which `pg` may hand back as a `Date` or
 * an ISO string depending on driver configuration) to an ISO-8601 string for
 * the wire shape.
 */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Map a `legendary.player_gauntlet_runs` row to the owner `GauntletRunView`
 * wire shape. `leg_picks` is returned by `pg` already parsed from `jsonb`, so
 * it is cast to `GauntletRunLegPicks` (it passed structural validation at write
 * time, or is the empty object the column default seeded). `player_id` is
 * deliberately not mapped — it is server-internal and never on the wire.
 */
function mapGauntletRunRow(row: PlayerGauntletRunRow): GauntletRunView {
  return {
    id: row.id,
    setAbbr: row.set_abbr,
    mastermindSlug: row.mastermind_slug,
    division: row.division as GauntletRunView['division'],
    playerCount: Number(row.player_count),
    legPicks: row.leg_picks as GauntletRunLegPicks,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    firstCompletedAt:
      row.first_completed_at === null
        ? null
        : toIsoString(row.first_completed_at),
  };
}

/**
 * Structurally validate a candidate `legPicks` value: it must be a plain object
 * (not null, not an array) whose every value is an array of strings — the
 * `Record<schemeSlug, heroDeckIds[]>` shape (D-24264 §2). This is the ONLY
 * validation the run workspace applies to picks: it never checks that a hero id
 * is a real registry ext_id or fits the pool budget (that is derived at read
 * time, WP-446, and enforced at launch, a later WP).
 *
 * @param candidate the untrusted `legPicks` value from the request body.
 * @returns the typed picks on success, or a typed `invalid_leg_picks` error.
 */
export function validateLegPicksShape(
  candidate: unknown,
): GauntletRunResult<GauntletRunLegPicks> {
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    return {
      ok: false,
      reason:
        'The legPicks value must be an object mapping each scheme slug to an array of hero deck ids; received a non-object, null, or array value.',
      code: 'invalid_leg_picks',
    };
  }
  for (const [schemeSlug, heroDeckIds] of Object.entries(
    candidate as Record<string, unknown>,
  )) {
    if (!Array.isArray(heroDeckIds)) {
      return {
        ok: false,
        reason: `The legPicks entry for scheme "${schemeSlug}" must be an array of hero deck ids; received a non-array value.`,
        code: 'invalid_leg_picks',
      };
    }
    for (const heroDeckId of heroDeckIds) {
      if (typeof heroDeckId !== 'string') {
        return {
          ok: false,
          reason: `The legPicks entry for scheme "${schemeSlug}" must contain only string hero deck ids; received a non-string element.`,
          code: 'invalid_leg_picks',
        };
      }
    }
  }
  return { ok: true, value: candidate as GauntletRunLegPicks };
}

/**
 * Import a WP-440 identity pack as an active gauntlet run for the caller,
 * idempotently. Validates the pack shape, confirms the gauntlet + approved
 * loadout menu exist via the INJECTED resolver, then attempts an INSERT of an
 * active run with empty `leg_picks`. If an active run for the same identity
 * already exists the INSERT hits the migration-039 partial-unique index; that
 * conflict is caught and resolved to the existing active run (D-24264).
 *
 * @param accountId the authenticated caller's account id.
 * @param input the untrusted request body carrying the WP-440 pack.
 * @param database the pg pool.
 * @param resolveGauntletExistence the injected registry-existence resolver.
 * @returns the run view plus whether a new row was created (`201`) or an
 *   existing active run was attached to (`200`); or a typed error.
 */
export async function importGauntletRun(
  accountId: AccountId,
  input: ImportGauntletRunInput,
  database: DatabaseClient,
  resolveGauntletExistence: GauntletExistenceResolver,
): Promise<GauntletRunResult<ImportGauntletRunOutcome>> {
  // why: the pack is untrusted client input — validate its shape with the
  // WP-440 `validateGauntletPack`, which throws on a bad shape / unsupported
  // version. A thrown validation error is caught here and mapped to the typed
  // `invalid_pack`; nothing is inserted.
  let setAbbr: string;
  let mastermindSlug: string;
  let division: GauntletRunView['division'];
  let playerCount: number;
  try {
    const pack = validateGauntletPack(input.pack);
    setAbbr = pack.gauntlet.setAbbr;
    mastermindSlug = pack.gauntlet.mastermindSlug;
    division = pack.gauntlet.division;
    playerCount = pack.gauntlet.playerCount;
  } catch (caughtError) {
    // why: the pack validator's throw is the only expected failure here; its
    // full-sentence message is surfaced as the result reason so an operator can
    // see WHY the pack was rejected without the route re-throwing to a 500.
    const reason =
      caughtError instanceof Error
        ? caughtError.message
        : 'The submitted value is not a valid gauntlet pack.';
    return { ok: false, reason, code: 'invalid_pack' };
  }

  // why: shape validation never confirms the gauntlet exists (D-24260). The
  // injected resolver — built from the startup gauntlet catalog — answers
  // whether the live registry hosts this gauntlet with an approved menu for the
  // pack's division + player count. An absent gauntlet is a friendly typed
  // `unknown_gauntlet` (422), not a crash.
  const gauntletExists = resolveGauntletExistence({
    setAbbr,
    mastermindSlug,
    division,
    playerCount,
  });
  if (gauntletExists === false) {
    return {
      ok: false,
      reason: `No gauntlet with an approved loadout menu exists for set "${setAbbr}", mastermind "${mastermindSlug}", division "${division}", and player count ${playerCount}; the pack may target an unoffered gauntlet or player count.`,
      code: 'unknown_gauntlet',
    };
  }

  const playerId = await loadPlayerIdByAccountId(accountId, database);
  if (playerId === null) {
    return Promise.reject(
      new Error(
        'No legendary.players row matches the authenticated accountId; the account row may have been deleted between session validation and this import.',
      ),
    );
  }

  try {
    // why: `leg_picks` is not supplied — the column DEFAULT '{}'::jsonb seeds a
    // fresh run with empty picks (D-24264 §2). The RETURNING clause hands back
    // the full row so no follow-up SELECT is needed on the happy path.
    const insertResult = await database.query(
      'INSERT INTO legendary.player_gauntlet_runs ' +
        '(player_id, set_abbr, mastermind_slug, division, player_count) ' +
        'VALUES ($1, $2, $3, $4, $5) ' +
        `RETURNING ${RUN_COLUMNS}`,
      [playerId, setAbbr, mastermindSlug, division, playerCount],
    );
    return {
      ok: true,
      value: {
        view: mapGauntletRunRow(insertResult.rows[0] as PlayerGauntletRunRow),
        wasCreated: true,
      },
    };
  } catch (caughtError) {
    // why: D-24264 idempotency — an active run for this identity already exists,
    // so the INSERT hit the migration-039 partial-unique index
    // `player_gauntlet_runs_active_identity_uidx`
    // `(player_id, set_abbr, mastermind_slug, division, player_count)
    //  WHERE first_completed_at IS NULL`. Re-importing the same download must be
    // a safe no-op that returns the existing active run (200), NEVER a 409/500.
    // Any other error (a genuine DB fault) is re-thrown so the route maps it to
    // 500 — the conflict catch is narrow to exactly the unique-violation code.
    const sqlState = (caughtError as { code?: unknown } | null)?.code;
    if (sqlState !== UNIQUE_VIOLATION_SQLSTATE) {
      throw caughtError;
    }
    const existingResult = await database.query(
      `SELECT ${RUN_COLUMNS} ` +
        'FROM legendary.player_gauntlet_runs ' +
        'WHERE player_id = $1 AND set_abbr = $2 AND mastermind_slug = $3 ' +
        'AND division = $4 AND player_count = $5 AND first_completed_at IS NULL ' +
        'LIMIT 1',
      [playerId, setAbbr, mastermindSlug, division, playerCount],
    );
    if (existingResult.rows.length === 0) {
      // why: the conflicting active run vanished between the INSERT failure and
      // this SELECT (a delete raced the import). That is an internal
      // inconsistency, not a client fault, so surface it as a 500 via reject
      // rather than fabricate a run.
      return Promise.reject(
        new Error(
          'The active gauntlet run that caused the unique-constraint conflict was not found on re-read; it may have been deleted concurrently with this import.',
        ),
      );
    }
    return {
      ok: true,
      value: {
        view: mapGauntletRunRow(existingResult.rows[0] as PlayerGauntletRunRow),
        wasCreated: false,
      },
    };
  }
}

/**
 * List the caller's gauntlet runs — the RAW stored runs (identity + `legPicks`
 * + timestamps + `firstCompletedAt`), with NO derived projection (status /
 * pool / headroom / cleared / last-played are the WP-446 follow-on, D-24262).
 * Ordering: active runs first (`first_completed_at IS NULL` DESC), then
 * `updated_at DESC, id ASC`.
 *
 * @param accountId the authenticated caller's account id.
 * @param database the pg pool.
 * @returns the caller's runs as views, or a rejected promise on a player-row
 *   race (mapped to 500 by the route).
 */
export async function listGauntletRuns(
  accountId: AccountId,
  database: DatabaseClient,
): Promise<GauntletRunResult<GauntletRunView[]>> {
  const playerId = await loadPlayerIdByAccountId(accountId, database);
  if (playerId === null) {
    return Promise.reject(
      new Error(
        'No legendary.players row matches the authenticated accountId; the account row may have been deleted between session validation and this list.',
      ),
    );
  }

  // why: active runs first, then most-recently-touched — `(first_completed_at
  // IS NULL) DESC` sorts the active (true) runs ahead of completed ones; the
  // secondary keys are the locked `updated_at DESC, id ASC` tiebreak.
  const result = await database.query(
    `SELECT ${RUN_COLUMNS} ` +
      'FROM legendary.player_gauntlet_runs ' +
      'WHERE player_id = $1 ' +
      'ORDER BY (first_completed_at IS NULL) DESC, updated_at DESC, id ASC',
    [playerId],
  );
  const runs: GauntletRunView[] = [];
  for (const row of result.rows as PlayerGauntletRunRow[]) {
    runs.push(mapGauntletRunRow(row));
  }
  return { ok: true, value: runs };
}

/**
 * Edit one of the caller's runs' per-leg hero picks. Validates only the
 * STRUCTURAL shape of `legPicks` (an object of `schemeSlug → heroDeckIds[]`),
 * scopes the write by the resolved `player_id`, and advances `updated_at`.
 *
 * @param accountId the authenticated caller's account id.
 * @param runId the `:id` path param (validated against `UUID_PATTERN`).
 * @param patch the untrusted request body carrying `legPicks`.
 * @param database the pg pool.
 * @returns the updated run view; `invalid_leg_picks` on a malformed shape;
 *   `not_found` for a malformed / cross-account / missing id (no existence
 *   leak).
 */
export async function updateGauntletRunLegPicks(
  accountId: AccountId,
  runId: string,
  patch: UpdateGauntletRunPatch,
  database: DatabaseClient,
): Promise<GauntletRunResult<GauntletRunView>> {
  const legPicksResult = validateLegPicksShape(patch.legPicks);
  if (legPicksResult.ok === false) {
    return legPicksResult;
  }

  // why: a malformed :id must return not_found (never a 500 from a uuid-cast
  // error, never an existence leak) — identical to the cross-account isolation
  // response below.
  if (UUID_PATTERN.test(runId) === false) {
    return {
      ok: false,
      reason:
        'No gauntlet run matches the supplied id for this account; the id is not a well-formed identifier.',
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

  // why: scope the UPDATE by the resolved player_id so account B updating
  // account A's id affects zero rows -> not_found (no existence leak);
  // updated_at advances on every successful PATCH.
  const updateResult = await database.query(
    'UPDATE legendary.player_gauntlet_runs ' +
      'SET leg_picks = $1::jsonb, updated_at = now() ' +
      'WHERE id = $2 AND player_id = $3 ' +
      `RETURNING ${RUN_COLUMNS}`,
    [JSON.stringify(legPicksResult.value), runId, playerId],
  );
  if (updateResult.rows.length === 0) {
    return {
      ok: false,
      reason:
        'No gauntlet run matches the supplied id for this account; it may not exist or may belong to another account.',
      code: 'not_found',
    };
  }
  return {
    ok: true,
    value: mapGauntletRunRow(updateResult.rows[0] as PlayerGauntletRunRow),
  };
}

/**
 * Delete one of the caller's gauntlet runs by id. Returns `not_found` for a
 * malformed id, a missing id, or an id owned by another account (cross-account
 * isolation, no existence leak).
 *
 * @param accountId the authenticated caller's account id.
 * @param runId the `:id` path param (validated against `UUID_PATTERN`).
 * @param database the pg pool.
 * @returns success, or a typed `not_found`.
 */
export async function deleteGauntletRun(
  accountId: AccountId,
  runId: string,
  database: DatabaseClient,
): Promise<GauntletRunResult<void>> {
  // why: malformed :id -> not_found, same as the missing / cross-account case;
  // never a uuid-cast 500 and never an existence leak.
  if (UUID_PATTERN.test(runId) === false) {
    return {
      ok: false,
      reason:
        'No gauntlet run matches the supplied id for this account; the id is not a well-formed identifier.',
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

  // why: scope the delete by the resolved player_id so account B cannot delete
  // account A's row; rowCount 0 -> not_found.
  const deleteResult = await database.query(
    'DELETE FROM legendary.player_gauntlet_runs WHERE id = $1 AND player_id = $2',
    [runId, playerId],
  );
  const deletedCount = deleteResult.rowCount ?? 0;
  if (deletedCount === 0) {
    return {
      ok: false,
      reason:
        'No gauntlet run matches the supplied id for this account; it may not exist or may belong to another account.',
      code: 'not_found',
    };
  }
  return { ok: true, value: undefined };
}
