# EC-329 — Owner Profile Avatar Upload UI (Execution Checklist)

**Source:** docs/ai/work-packets/WP-298-owner-profile-avatar-upload-ui.md
**Layer:** Arena Client (`apps/arena-client`) · **Lightweight Lane** (D-24028)

## Before Starting (Hard Gate)
- [ ] Server endpoint present: `grep -c "/api/me/avatar" apps/server/src/profile/avatarUpload.routes.ts` ≥ 1 (the pipeline this consumes — WP-106, do NOT modify)
- [ ] Client wrapper pattern present: `grep -c "buildApiUrl" apps/arena-client/src/lib/api/ownerProfileApi.ts` ≥ 1 (mirror `fetchOwnerProfile`/`updateOwnerProfile`)
- [ ] Baseline snapshot: `pnpm --filter @legendary-arena/arena-client typecheck` → **0**; `test` → record passing count **X** (at `da0ef06b`). At close: typecheck 0; test count **= X + the new `ownerProfileApi` upload tests**, no other suite delta; `build` 0
- [ ] Scaffold (lane requirement): prototype `uploadOwnerAvatar` + its test, run the arena-client suite, record the observed result BEFORE confirming eligibility

## Locked Values (do not re-derive)
- Endpoint: `POST /api/me/avatar`; request body `multipart/form-data` with a **single file field named `avatar`** (server-locked)
- Success: `200 { avatarUrl: string }`; the avatar URL is `https://images.legendary-arena.com/avatars/{accountId}.webp` (D-24083 host — display only, never construct it client-side)
- Closed error-code union (mirror as a client-local `readonly` list): `'invalid_mime_type' | 'file_too_large' | 'rate_limited' | 'upload_failed' | 'unauthorized'`; bodies `{ code, message }`; statuses 400 / 401 / 429 / 500
- Auth: `Authorization: Bearer ${authToken}` when `authToken !== null`, omitted otherwise (same as the sibling wrappers)
- Result shape: `{ ok: true; avatarUrl } | { ok: false; status; code }` (mirrors `OwnerProfileApiResult`); network failure → `{ ok: false, status: 0, code: null }`
- Canonical field names (00.2): `avatarUrl` (response), `avatar` (form field) — do not rename

## Guardrails
- Additive only: do NOT touch `fetchOwnerProfile` / `updateOwnerProfile` / `replaceOwnerLinks`, the auth store, `App.vue`, or the public profile page; keep the existing free-text avatar-URL field
- **No server / contract / catalog change** — consume the existing `POST /api/me/avatar`; `apps/server/**`, `avatarUpload.*`, `ownerProfile.*`, `api-endpoints.md` all byte-identical
- **Never set a `Content-Type` header on the upload `fetch`** — the browser sets the multipart boundary; a manual one breaks it (server → `invalid_mime_type`)
- No cross-layer import (`apps/server` / `packages/registry` / `packages/game-engine` runtime) and no `boardgame.io` in `ownerProfileApi.ts`; the error-code list is a client-local mirror, not a server import
- `MyProfilePage.vue` upload control routes through `uploadOwnerAvatar` only; on success set `formAvatarUrl` to the returned URL — never construct the CDN URL by hand
- `for...of` / explicit `if/else` (no branching `.reduce()`); full-word names; `ok`/`is*` booleans; every function has JSDoc

## Required `// why:` Comments
- On the omitted `Content-Type` in `uploadOwnerAvatar` (browser sets the multipart boundary; a manual header breaks it)
- On the client-local `AVATAR_UPLOAD_ERROR_CODES` mirror (mirrors the server union; the drift test guards the two staying in sync)

## Files to Produce
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` (modify — `uploadOwnerAvatar` + `AvatarUploadApiResult` + `AVATAR_UPLOAD_ERROR_CODES`)
- `apps/arena-client/src/lib/api/ownerProfileApi.test.ts` (new — node:test coverage)
- `apps/arena-client/src/pages/MyProfilePage.vue` (modify — file-input + "Upload avatar" control + handler)
- `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` (governance close; **no DECISIONS change** — consumes existing D-10601 / D-10602)

## File Responsibilities (no logic duplication)
- `ownerProfileApi.ts` — the SINGLE source of the upload fetch + result mapping; `MyProfilePage.vue` must not re-encode the request shape or error mapping
- `MyProfilePage.vue` — UI + orchestration only: read the selected `File` → call `uploadOwnerAvatar` → on `ok` set `formAvatarUrl` + success line, on `!ok` map `code` → a full-sentence message

## Required Test Matrix (`ownerProfileApi.test.ts` — every row required)
- `200 { avatarUrl }` → `{ ok: true, avatarUrl }`; the stubbed request used `POST`, included `Authorization`, and set **no** `Content-Type`
- `400 { code: 'invalid_mime_type' }` and `400 { code: 'file_too_large' }` → `{ ok: false, status: 400, code }` (code preserved)
- `401 { code: 'unauthorized' }` → `{ ok: false, status: 401, code: 'unauthorized' }`
- a thrown `fetch` → `{ ok: false, status: 0, code: null }`
- drift: `AVATAR_UPLOAD_ERROR_CODES` deepEquals the 5 server codes

## After Completing
- [ ] `uploadOwnerAvatar` posts FormData field `avatar`, no `Content-Type`, Bearer when token non-null; result mapping per the matrix
- [ ] `MyProfilePage.vue` file-input + "Upload avatar" control updates the avatar on success, maps each error code to a sentence; URL field + save flow untouched
- [ ] No forbidden import; `ownerProfileApi.ts` boardgame.io-free; no server/contract/catalog/`App.vue` change
- [ ] `typecheck` 0; `test` 0 (count preserved + new tests); `build` 0
- [ ] LIVE: a player uploads an image on `?route=me` → avatar updates; an oversized/wrong-type file shows the mapped error without wiping the avatar
- [ ] WORK_INDEX / EC_INDEX / STATUS flipped; commit prefix `EC-329:` (code) + `SPEC:` (governance); D-24026 live-verify post-deploy

## Common Failure Smells
- Upload rejected as `invalid_mime_type` for a valid image → a `Content-Type` header was set manually (must be omitted so the browser sets the multipart boundary)
- Typecheck fails importing `AvatarUploadErrorCode` from the server → use the client-local mirror, never an `apps/server` import
- The avatar doesn't refresh after a successful upload → `formAvatarUrl` was not set to the returned `avatarUrl`
- A network error throws to the UI → the wrapper must catch and return `{ ok: false, status: 0, code: null }`, never throw
