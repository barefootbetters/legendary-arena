/**
 * Loadout Library API Client — Arena Client (WP-302 / EC-333)
 *
 * Typed `fetch` wrappers for the profile loadout-library endpoints
 * (Vision §19b). Four authenticated calls under `/api/me/loadouts*`
 * (create / list / update / delete) plus one guest read
 * `GET /api/loadouts/:shareSlug`. Consumed by
 * `apps/arena-client/src/pages/MyProfilePage.vue` (owner surface) and
 * `apps/arena-client/src/pages/SharedLoadoutPage.vue` (public view).
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/game-engine`,
 * `@legendary-arena/game-engine/setup`, `@legendary-arena/registry`,
 * `@legendary-arena/lagn`, `apps/server`, or `pg`. The
 * `SavedLoadoutView` / `PublicLoadoutView` shapes are declared inline
 * here by structural compatibility with their server-side counterparts
 * in `apps/server/src/profile/loadoutLibrary.types.ts` — the
 * engine/server-isolation rule prohibits the client from importing
 * server-layer types directly. The `lagn` document is treated as
 * opaque JSON (`unknown`): sent verbatim on create, received verbatim
 * on read; the server is the sole LAGN-validation authority (D-24086).
 * Mirrors the WP-104 `ownerProfileApi.ts` client pattern verbatim.
 *
 * Authority: WP-302 §Scope (In) §A; EC-333 §Files to Produce; D-24087.
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * The owner's view of one saved loadout. Mirrors
 * `apps/server/src/profile/loadoutLibrary.types.ts#SavedLoadoutView`
 * by structural compatibility. `shareSlug` is `null` while the loadout
 * is private and a non-null opaque string while public. The owner's
 * `player_id` / `ext_id` are server-internal and never on the wire.
 * `lagn` is opaque JSON — the client never imports the LAGN validator.
 */
export interface SavedLoadoutView {
  readonly id: string;
  readonly name: string;
  readonly visibility: 'private' | 'public';
  readonly shareSlug: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lagn: unknown;
}

/**
 * The guest view of one public saved loadout. Mirrors
 * `apps/server/src/profile/loadoutLibrary.types.ts#PublicLoadoutView`
 * by structural compatibility. Carries ONLY the loadout's `name`, its
 * opaque `lagn` document, and the owner's public `displayHandle` —
 * never an account identifier (`accountId` / `ext_id`).
 */
export interface PublicLoadoutView {
  readonly name: string;
  readonly lagn: unknown;
  readonly displayHandle: string;
}

/**
 * The list body returned by `GET /api/me/loadouts` (200): the caller's
 * saved loadouts, newest-relevant ordering owned server-side.
 */
export interface SavedLoadoutListView {
  readonly loadouts: SavedLoadoutView[];
}

/**
 * The PATCH body for `updateLoadout`. Both fields optional; key absence
 * means "leave unchanged". A patch with neither is rejected server-side
 * with `empty_update`.
 */
export interface UpdateLoadoutPatch {
  readonly name?: string;
  readonly visibility?: 'private' | 'public';
}

/**
 * The create body for `createLoadout`. `name` is a plain string; `lagn`
 * is opaque JSON sent verbatim for server-side validation.
 */
export interface CreateLoadoutInput {
  readonly name: string;
  readonly lagn: unknown;
}

/**
 * Result discriminator for the value-returning loadout wrappers. The
 * success branch carries the parsed value; the failure branch carries
 * the HTTP status plus the closed-set error code the server emitted in
 * its `{ error: code }` body (or `null` for a network/parse failure or
 * an unrecognized code). Mirrors `OwnerProfileApiResult`.
 */
export type LoadoutApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; code: string | null };

/**
 * Result discriminator for `deleteLoadout` — a successful DELETE
 * returns 204 with no body, so the success branch carries no value.
 */
export type LoadoutDeleteResult =
  | { ok: true }
  | { ok: false; status: number; code: string | null };

/**
 * Parse a non-2xx loadout response into the failure branch. Reads the
 * failure code from the server's `{ error: code }` body (the shape the
 * loadout routes emit); returns `null` for the code when the body is
 * absent, malformed, or carries no string `error`.
 */
async function parseLoadoutFailure(
  response: Response,
): Promise<{ ok: false; status: number; code: string | null }> {
  let code: string | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') {
      code = body.error;
    }
  } catch {
    // why: a malformed or empty JSON body is a transport-level failure;
    // we surface the status alone and leave the code null so the page can
    // render a generic error line without crashing the promise chain.
    code = null;
  }
  return { ok: false, status: response.status, code };
}

/**
 * Fetch the authenticated caller's saved loadouts. Returns
 * `{ ok: true, value: { loadouts } }` on HTTP 200; `{ ok: false,
 * status, code }` on every other status; and `{ ok: false, status: 0,
 * code: null }` when `fetch` throws (network failure). Never throws.
 */
export async function listLoadouts(
  authToken: string | null,
): Promise<LoadoutApiResult<SavedLoadoutListView>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/loadouts'), {
      method: 'GET',
      headers:
        authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP
    // status; the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseLoadoutFailure(response);
  }
  const value = (await response.json()) as SavedLoadoutListView;
  return { ok: true, value };
}

/**
 * Create a saved loadout from a name plus an opaque `lagn` document.
 * POSTs `{ name, lagn }`; returns the created `SavedLoadoutView` on
 * HTTP 201. The server validates the LAGN document and rejects it with
 * a typed code (`invalid_lagn` / `invalid_name` / `loadout_limit_reached`)
 * on failure. Never throws.
 */
export async function createLoadout(
  authToken: string | null,
  input: CreateLoadoutInput,
): Promise<LoadoutApiResult<SavedLoadoutView>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/loadouts'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken === null
          ? {}
          : { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({ name: input.name, lagn: input.lagn }),
    });
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP
    // status; the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 201) {
    return await parseLoadoutFailure(response);
  }
  const value = (await response.json()) as SavedLoadoutView;
  return { ok: true, value };
}

/**
 * Apply a sparse PATCH (rename and/or visibility toggle) to one saved
 * loadout. Returns the updated `SavedLoadoutView` on HTTP 200. Never
 * throws.
 */
export async function updateLoadout(
  authToken: string | null,
  id: string,
  patch: UpdateLoadoutPatch,
): Promise<LoadoutApiResult<SavedLoadoutView>> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl(`/api/me/loadouts/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken === null
          ? {}
          : { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify(patch),
    });
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP
    // status; the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseLoadoutFailure(response);
  }
  const value = (await response.json()) as SavedLoadoutView;
  return { ok: true, value };
}

/**
 * Delete one saved loadout. Returns `{ ok: true }` on HTTP 204 (no
 * body); `{ ok: false, status, code }` on every other status. Never
 * throws.
 */
export async function deleteLoadout(
  authToken: string | null,
  id: string,
): Promise<LoadoutDeleteResult> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl(`/api/me/loadouts/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers:
        authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP
    // status; the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 204) {
    return await parseLoadoutFailure(response);
  }
  return { ok: true };
}

/**
 * Fetch one public shared loadout by its opaque `shareSlug`. This is
 * the guest read: it attaches NO `Authorization` header. Returns the
 * `PublicLoadoutView` on HTTP 200; `{ ok: false, status: 404, code:
 * 'not_found' }` for a private or unknown slug; and `{ ok: false,
 * status: 0, code: null }` when `fetch` throws. Never throws.
 */
export async function fetchSharedLoadout(
  shareSlug: string,
): Promise<LoadoutApiResult<PublicLoadoutView>> {
  let response: Response;
  try {
    // why: the guest read carries NO auth header — the server returns
    // public-only data (name + displayHandle + lagn) and 404s any
    // private/unknown slug, so no bearer is needed or wanted here.
    response = await fetch(
      buildApiUrl(`/api/loadouts/${encodeURIComponent(shareSlug)}`),
      { method: 'GET' },
    );
  } catch {
    // why: a thrown fetch is a network/transport failure with no HTTP
    // status; the client never throws, so it maps to status 0 / code null.
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseLoadoutFailure(response);
  }
  const value = (await response.json()) as PublicLoadoutView;
  return { ok: true, value };
}
