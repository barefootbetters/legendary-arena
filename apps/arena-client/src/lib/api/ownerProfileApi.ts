/**
 * Owner Profile API Client — Arena Client (WP-104)
 *
 * Typed `fetch` wrappers for the three owner-only HTTP endpoints
 * under `/api/me/`. Consumed by
 * `apps/arena-client/src/pages/MyProfilePage.vue`.
 *
 * Layer-boundary contract: this module imports nothing from
 * `boardgame.io`, `@legendary-arena/game-engine`,
 * `@legendary-arena/registry`, `@legendary-arena/preplan`, or
 * `@legendary-arena/vue-sfc-loader`. The `OwnerProfileView` /
 * `OwnerProfileLink` shapes are declared inline here by structural
 * compatibility with their server-side counterparts in
 * `apps/server/src/profile/ownerProfile.types.ts` — the engine /
 * server-isolation rule prohibits the client from importing
 * server-layer types directly. Mirrors the WP-102
 * `profileApi.ts` precedent verbatim.
 *
 * Authority: WP-104 §Scope (In) §G; EC-128 §1.
 * WP-161 update: fetch URLs now prefixed via `buildApiUrl(...)` so the
 * SPA can target the API host configured via `VITE_API_BASE_URL` at
 * build time. Wire shapes, function signatures, and error handling
 * are byte-identical to WP-104; only the URL string differs.
 */

import { buildApiUrl } from './apiBaseUrl';

/**
 * Owner-curated profile link wire shape. Mirrors
 * `apps/server/src/profile/ownerProfile.types.ts#OwnerProfileLink`
 * by structural compatibility — the server is authoritative on
 * the shape; this declaration is the type-level contract on the
 * client.
 */
export interface OwnerProfileLink {
  readonly provider:
    | 'twitter'
    | 'github'
    | 'twitch'
    | 'discord'
    | 'youtube'
    | 'website';
  readonly url: string;
  readonly isPublic: boolean;
  readonly displayOrder: number;
}

/**
 * Owner's editable view of their own profile. Mirrors
 * `apps/server/src/profile/ownerProfile.types.ts#OwnerProfileView`
 * by structural compatibility. Fields private to `legendary.players`
 * (`email`, `authProvider`, `authProviderId`, `createdAt`) are
 * intentionally absent.
 */
export interface OwnerProfileView {
  readonly avatarUrl: string | null;
  readonly aboutMe: string | null;
  readonly avatarVisibility: 'private' | 'public';
  readonly aboutMeVisibility: 'private' | 'public';
  readonly linksVisibility: 'private' | 'public';
  readonly links: OwnerProfileLink[];
  readonly updatedAt: string | null;
}

/**
 * Sparse partial PATCH body for `PATCH /api/me/profile`. Every
 * field is optional; key absence means "leave unchanged"; explicit
 * `null` means "clear the field"; a string value means "set the
 * field to that string". Mirrors the server `OwnerProfilePatch`.
 */
export interface OwnerProfilePatch {
  readonly avatarUrl?: string | null;
  readonly aboutMe?: string | null;
  readonly avatarVisibility?: 'private' | 'public';
  readonly aboutMeVisibility?: 'private' | 'public';
  readonly linksVisibility?: 'private' | 'public';
}

/**
 * Result discriminator for the owner-profile fetch wrappers. The
 * success branch carries the parsed view; the failure branch
 * carries only the HTTP status code plus a closed-set error code
 * (when the server emitted one in the response body).
 */
export type OwnerProfileApiResult =
  | { ok: true; value: OwnerProfileView }
  | { ok: false; status: number; code: string | null };

// why: client-local mirror of the server's `AvatarUploadErrorCode` union in
// apps/server/src/profile/avatarUpload.types.ts. The engine/server-isolation
// rule forbids importing server-layer types directly, so the codes are
// mirrored here by hand; the drift test in ownerProfileApi.test.ts asserts
// the two stay in sync (set-equality), failing loudly if the server union moves.
export const AVATAR_UPLOAD_ERROR_CODES = [
  'invalid_mime_type',
  'file_too_large',
  'rate_limited',
  'upload_failed',
  'unauthorized',
] as const;

/**
 * Closed set of failure codes the avatar-upload endpoint
 * (`POST /api/me/avatar`) may return in its `{ code, message }` body.
 * Client-local mirror of the server union (see `AVATAR_UPLOAD_ERROR_CODES`).
 */
export type AvatarUploadErrorCode = (typeof AVATAR_UPLOAD_ERROR_CODES)[number];

/**
 * Result discriminator for `uploadOwnerAvatar`. The success branch carries
 * the new server-owned `avatarUrl`; the failure branch carries the HTTP
 * status plus the closed-set error code (or `null` for a network failure or
 * an unrecognized code). Mirrors the shape of `OwnerProfileApiResult`.
 */
export type AvatarUploadApiResult =
  | { ok: true; avatarUrl: string }
  | { ok: false; status: number; code: AvatarUploadErrorCode | null };

async function parseFailure(
  response: Response,
): Promise<{ ok: false; status: number; code: string | null }> {
  let code: string | null = null;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === 'string') {
      code = body.error;
    }
  } catch {
    // why: a malformed JSON response (or no body) is a transport-level
    // failure; we surface only the status code in that case so the
    // page can render a generic error banner without crashing the
    // promise chain.
    code = null;
  }
  return { ok: false, status: response.status, code };
}

/**
 * Fetch the authenticated owner's profile. Returns
 * `{ ok: true, value }` on HTTP 200; returns
 * `{ ok: false, status, code }` on every other status.
 */
export async function fetchOwnerProfile(
  authToken: string | null,
): Promise<OwnerProfileApiResult> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/profile'), {
      method: 'GET',
      headers:
        authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseFailure(response);
  }
  const value = (await response.json()) as OwnerProfileView;
  return { ok: true, value };
}

/**
 * Apply a sparse partial PATCH to the authenticated owner's
 * profile. Returns the updated view on success.
 */
export async function updateOwnerProfile(
  authToken: string | null,
  patch: OwnerProfilePatch,
): Promise<OwnerProfileApiResult> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/profile'), {
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
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseFailure(response);
  }
  const value = (await response.json()) as OwnerProfileView;
  return { ok: true, value };
}

/**
 * Narrow an unknown response-body `code` value to the closed avatar
 * upload error-code set. Returns `null` when the value is absent, not a
 * string, or not one of the known codes.
 */
function narrowAvatarUploadCode(raw: unknown): AvatarUploadErrorCode | null {
  if (typeof raw !== 'string') {
    return null;
  }
  for (const knownCode of AVATAR_UPLOAD_ERROR_CODES) {
    if (knownCode === raw) {
      return knownCode;
    }
  }
  return null;
}

/**
 * Parse a non-200 avatar-upload response into the failure branch. Reads the
 * failure code from `body.code`.
 */
async function parseAvatarUploadFailure(
  response: Response,
): Promise<{ ok: false; status: number; code: AvatarUploadErrorCode | null }> {
  let code: AvatarUploadErrorCode | null = null;
  try {
    // why: the avatar endpoint returns `{ code, message }`, NOT the `{ error }`
    // shape the sibling profile endpoints use; reusing the sibling
    // `parseFailure` here would read the absent `body.error` and map every
    // avatar error to `null`, silently erasing the whole error matrix.
    const body = (await response.json()) as { code?: unknown };
    code = narrowAvatarUploadCode(body.code);
  } catch {
    // why: a malformed or empty JSON body is a transport-level failure; we
    // surface the status alone and leave the code null so the page can render
    // a generic upload-error line without crashing the promise chain.
    code = null;
  }
  return { ok: false, status: response.status, code };
}

/**
 * Upload a new avatar image for the authenticated owner. POSTs a
 * `multipart/form-data` body with the single file field `avatar` to
 * `POST /api/me/avatar` (WP-106). Returns `{ ok: true, avatarUrl }` with the
 * server-owned CDN URL on HTTP 200; `{ ok: false, status, code }` on any
 * other status (the server `code` when recognized, else `null`); and
 * `{ ok: false, status: 0, code: null }` when `fetch` throws (network
 * failure). Never throws.
 */
export async function uploadOwnerAvatar(
  authToken: string | null,
  file: File,
): Promise<AvatarUploadApiResult> {
  const body = new FormData();
  body.append('avatar', file);
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/avatar'), {
      method: 'POST',
      // why: no `Content-Type` header is set — the browser must set
      // `multipart/form-data; boundary=…` itself; a manual Content-Type omits
      // the boundary and the server rejects the body as `invalid_mime_type`.
      headers:
        authToken === null ? {} : { Authorization: `Bearer ${authToken}` },
      body,
    });
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseAvatarUploadFailure(response);
  }
  const value = (await response.json()) as { avatarUrl: string };
  return { ok: true, avatarUrl: value.avatarUrl };
}

/**
 * Replace the authenticated owner's full link list. Returns the
 * updated view on success.
 */
export async function replaceOwnerLinks(
  authToken: string | null,
  links: readonly OwnerProfileLink[],
): Promise<OwnerProfileApiResult> {
  let response: Response;
  try {
    response = await fetch(buildApiUrl('/api/me/links'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken === null
          ? {}
          : { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({ links }),
    });
  } catch {
    return { ok: false, status: 0, code: null };
  }
  if (response.status !== 200) {
    return await parseFailure(response);
  }
  const value = (await response.json()) as OwnerProfileView;
  return { ok: true, value };
}
