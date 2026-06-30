# WP-298 — Owner Profile Avatar Upload UI (Wire the Existing `POST /api/me/avatar` Endpoint)

**Status:** Draft — ready to execute (drafted 2026-06-30) · **Lightweight Lane** (D-24028)
**Primary Layer:** Arena Client (`apps/arena-client`)
**User-Visible Surface:** `play.legendary-arena.com` (the `?route=me` owner profile — a file picker + "Upload avatar" control that drives the existing server upload pipeline)
**Dependencies:** WP-106 (the `POST /api/me/avatar` upload pipeline — server) ✅; WP-296 / D-24083 (the `images.legendary-arena.com/avatars/` CDN host + closed-origin `validateAvatarUrl` allowlist) ✅; WP-104 (the `?route=me` owner profile + `OwnerProfileView`) ✅; WP-160 (the Pinia auth store token) ✅; WP-161 (`buildApiUrl` + `VITE_API_BASE_URL`) ✅.
**Baseline:** `origin/main` @ `da0ef06b` (2026-06-30). The server endpoint and the client `ownerProfileApi.ts` wrappers exist; the client has **no** avatar-upload wrapper and `MyProfilePage.vue` exposes only a free-text avatar-URL field.

---

## Goal

The owner profile page (`MyProfilePage.vue`, `?route=me`) gains a real **avatar file-upload control** that drives the already-shipped `POST /api/me/avatar` pipeline (WP-106). After this packet, `apps/arena-client` exports a new typed wrapper `uploadOwnerAvatar(authToken, file)` in `ownerProfileApi.ts` that POSTs a `multipart/form-data` body (single field `avatar`) and returns the new `{ avatarUrl }` on success or the server's typed error code otherwise; `MyProfilePage.vue` renders a `<input type="file">` + an "Upload avatar" button that calls it, shows per-error feedback, and on success updates the displayed avatar. This closes the gap where the server upload pipeline shipped but the client could only paste a CDN URL it had no way to produce (the closed-origin allowlist only accepts `images.legendary-arena.com/avatars/` URLs, which are produced **only** by this endpoint).

---

## User-Visible Impact

On `play.legendary-arena.com`, a signed-in player on their profile (`?route=me`) can choose an image file and click "Upload avatar"; the image is uploaded, resized server-side to `{accountId}.webp`, and their profile avatar updates to the new picture. An invalid file (wrong type, over 5 MB) shows a specific message and leaves the prior avatar unchanged. Before this packet, the only avatar control was a text box for a CDN URL the player had no way to generate — effectively unusable.

---

## Assumes

- **The server endpoint exists and is locked.** `POST /api/me/avatar` (WP-106, contract D-10602 / validation D-10601) accepts `multipart/form-data` with a single file field named **`avatar`**, returns `200 { avatarUrl: string }` on success, and the closed error union `'invalid_mime_type' | 'file_too_large' | 'rate_limited' | 'upload_failed' | 'unauthorized'` (`AvatarUploadErrorCode`) with `{ code, message }` bodies and status codes 400 / 401 / 429 / 500. (Verified at `apps/server/src/profile/avatarUpload.routes.ts` + `avatarUpload.types.ts`.)
- **The client API-wrapper pattern is fixed.** `apps/arena-client/src/lib/api/ownerProfileApi.ts` exports `fetchOwnerProfile` / `updateOwnerProfile` / `replaceOwnerLinks`, each taking `authToken: string | null`, attaching `Authorization: Bearer ${authToken}` when non-null, calling `buildApiUrl(path)`, and returning the discriminated `OwnerProfileApiResult` (`{ ok: true; value } | { ok: false; status; code }`). The new wrapper mirrors this exactly. (Verified at `ownerProfileApi.ts:113-167`.)
- **`MyProfilePage.vue` already reads the auth token + the owner profile.** It holds `formAvatarUrl` (the existing free-text field, `data-testid="my-profile-avatar-url"`) and saves via `updateOwnerProfile`. (Verified at `MyProfilePage.vue` setup + `<section class="profile-form">`.)
- **The test runner is `node:test`** via `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts` (Verified at `apps/arena-client/package.json`.) `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) + `test` + `build` exit 0 at baseline.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — `apps/arena-client` consumes the Runtime-Safe Engine Surface only and the server API cross-origin; it owns no game logic. This packet adds a UI affordance + a typed fetch wrapper, nothing else.
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — read entirely; the new wrapper must match the existing signature/return shape and the `Authorization`-header + `buildApiUrl` pattern, and must NOT break `OwnerProfileView` / `OwnerProfileApiResult`.
- `apps/server/src/profile/avatarUpload.types.ts` — the canonical `AvatarUploadErrorCode` union + the `{ avatarUrl }` success shape the client maps. **Do not import server code**; mirror the codes as a client-local closed list (cross-layer import is forbidden).
- `apps/server/src/profile/avatarUpload.routes.ts` — read the request contract (field name `avatar`, status/code mapping) to mirror it exactly client-side.
- `apps/arena-client/src/pages/MyProfilePage.vue` — read the `<section class="profile-form">` avatar block to add the file input beside the existing URL field without disturbing the save flow.
- `docs/ai/DECISIONS.md` — D-10601 / D-10602 (the avatar contract this consumes) and D-24083 (the CDN host); scan for the WP-106 / WP-296 avatar entries.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 11 (full-sentence errors), Rule 13 (ESM only), Rule 14 (field names match the contract: `avatarUrl`, `avatar`).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+; `node:` prefix on built-ins; test files `.test.ts` (never `.test.mjs`).
- Full file contents for every new or modified file — no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- No cross-layer import: the client must NOT import from `apps/server/**`, `packages/registry/**`, or `packages/game-engine/**` runtime code. The avatar error codes are mirrored as a client-local `readonly` list.
- No `boardgame.io` import in the API wrapper (it is a pure fetch helper).

**Packet-specific:**
- The upload request is `multipart/form-data` with a single field named exactly **`avatar`** (the server's locked field name). Build it with `FormData`; append the `File` under `'avatar'`.
- **Do NOT set a `Content-Type` header on the upload `fetch`.** Add a `// why:` comment: the browser must set `multipart/form-data; boundary=…` itself; a manual `Content-Type` breaks the multipart boundary and the server rejects it as `invalid_mime_type`.
- Attach the session token the same way the existing wrappers do: `Authorization: Bearer ${authToken}` when `authToken !== null`, omitted otherwise.
- The new wrapper returns a discriminated union (`{ ok: true; avatarUrl } | { ok: false; status; code }`) mirroring `OwnerProfileApiResult`'s shape; `code` is the client-local `AvatarUploadErrorCode` mirror or `null` on a network error / unmapped status.
- The existing free-text `formAvatarUrl` field and `updateOwnerProfile` save flow stay — the upload control is **additive**. On a successful upload, set `formAvatarUrl` to the returned `avatarUrl` so the visible avatar reflects the new image.
- Error messages shown to the player are full sentences mapped from the code (e.g. `file_too_large` → "That image is larger than the 5 MB limit; choose a smaller file.").

**Session protocol:**
- If the exact `MyProfilePage.vue` avatar-section markup or the auth-store token accessor is unclear, stop and confirm against the file — do not invent a field name or testid.

---

## Scope (In)

### A) `ownerProfileApi.ts` — new wrapper `uploadOwnerAvatar`
- `uploadOwnerAvatar(authToken: string | null, file: File): Promise<AvatarUploadApiResult>`:
  - Build `const body = new FormData(); body.append('avatar', file);`
  - `fetch(buildApiUrl('/api/me/avatar'), { method: 'POST', headers: authToken === null ? {} : { Authorization: \`Bearer ${authToken}\` }, body })` — **no `Content-Type`** (`// why:` the browser sets the multipart boundary).
  - On `response.status === 200`: parse `{ avatarUrl }` and return `{ ok: true, avatarUrl }`.
  - On non-200: reuse the existing `parseFailure` shape — return `{ ok: false, status, code }` where `code` is the body's `code` narrowed against the client-local `AVATAR_UPLOAD_ERROR_CODES` mirror, else `null`.
  - On a thrown fetch (network): return `{ ok: false, status: 0, code: null }`.
- Add a client-local closed list `AVATAR_UPLOAD_ERROR_CODES` (mirror of the server union; `// why:` comment that it mirrors the server contract and a drift test guards it) + the `AvatarUploadApiResult` type.

### B) `MyProfilePage.vue` — file-upload control (additive)
- In the avatar block of `<section class="profile-form">`, after the existing URL field, add:
  - `<input type="file" accept="image/*" data-testid="my-profile-avatar-file">`
  - an "Upload avatar" `<button data-testid="my-profile-avatar-upload">`
  - an error line + a success line (mirroring the page's existing feedback style).
- `onAvatarFileSelected` / `onUploadAvatar`: read the selected `File`, call `uploadOwnerAvatar(token, file)`; on `ok` set `formAvatarUrl` to `avatarUrl` and show the success line; on `!ok` map `code` → a full-sentence message. Never throws.

### C) Tests
Add `node:test` coverage in `apps/arena-client/src/lib/api/ownerProfileApi.test.ts` (**new**):
- A stubbed `globalThis.fetch` returning `200 { avatarUrl }` → wrapper returns `{ ok: true, avatarUrl }`; the request used `POST`, included the `Authorization` header, and set **no** `Content-Type`.
- `400 { code: 'invalid_mime_type' }` and `400 { code: 'file_too_large' }` → `{ ok: false, status: 400, code }` with the code preserved.
- `401 { code: 'unauthorized' }` → `{ ok: false, status: 401, code: 'unauthorized' }`.
- A thrown fetch → `{ ok: false, status: 0, code: null }`.
- Drift test: `AVATAR_UPLOAD_ERROR_CODES` contains exactly the 5 expected values (`// why:` failure means the client mirror drifted from the server union).
- No `boardgame.io` import; `node:test` + `node:assert` only.

---

## Out of Scope

- **No server change.** `POST /api/me/avatar`, `avatarUpload.*`, `ownerProfile.*`, the validation policy (D-10601), the CDN host (D-24083), and the api-endpoints catalog row are all unchanged — this packet only consumes the endpoint.
- **No removal of the existing free-text avatar-URL field** — the upload path is additive; the URL field stays for an already-valid CDN URL.
- **No avatar cropping / client-side resize / drag-and-drop** — the server owns resize/transform (D-10601); the client sends the raw file.
- **No change to `updateOwnerProfile` / `fetchOwnerProfile` / `replaceOwnerLinks`**, the auth store, `App.vue`, or the public profile page.
- **No new identity model, no `www` change** (D-24084), no Stripe/Snipcart/commerce change.
- Refactors or "while I'm here" cleanups of `ownerProfileApi.ts` or `MyProfilePage.vue` are out of scope.

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — **modified** — add `uploadOwnerAvatar`, `AvatarUploadApiResult`, and the client-local `AVATAR_UPLOAD_ERROR_CODES` mirror.
- `apps/arena-client/src/lib/api/ownerProfileApi.test.ts` — **new** — `node:test` coverage for the upload wrapper (success / error-code mapping / network failure / drift test).
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — additive file-input + "Upload avatar" control + handler.
- Governance: `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/STATUS.md` (no new D-entry — the avatar contract is the pre-existing D-10601 / D-10602).

**3 code/test files (1 modified + 1 new + 1 modified) + governance.** Lightweight-lane eligible. No other files may be modified.

---

## Vision Alignment

**Vision clauses touched:** §3, §11 (player identity / accounts / visibility — the avatar is owner-profile data). No scoring / PAR / replay / RNG / simulation surface.

**Conflict assertion:** No conflict — this WP preserves all touched clauses. It surfaces an existing, account-scoped, server-validated upload path; ownership and visibility semantics (the `avatarVisibility` field, the per-user `{accountId}.webp` impersonation guard) are unchanged and enforced server-side.

**Non-Goal proximity check:** User-facing but crosses none of NG-1..7. Not pay-to-win (NG-1), not a paid/persuasive surface — a profile picture upload. **PvP terminology (§23(b)):** "avatar" / "profile" carry no match/opponent/win-loss framing.

**Determinism preservation:** N/A — client UI + server-owned upload; no engine scoring, replay, RNG, or simulation surface.

---

## Acceptance Criteria

1. `ownerProfileApi.ts` exports `uploadOwnerAvatar(authToken, file)` that POSTs `multipart/form-data` (field `avatar`) to `buildApiUrl('/api/me/avatar')`, sets **no** `Content-Type`, and attaches `Authorization: Bearer ${authToken}` when the token is non-null (**AC-1**).
2. On `200 { avatarUrl }` the wrapper returns `{ ok: true, avatarUrl }`; on a non-200 it returns `{ ok: false, status, code }` with the server `code` preserved when it is one of the 5 known codes, else `null`; on a thrown fetch it returns `{ ok: false, status: 0, code: null }` (**AC-2**).
3. `AVATAR_UPLOAD_ERROR_CODES` (client mirror) contains exactly the 5 server codes; a drift test asserts it (**AC-3**).
4. `MyProfilePage.vue` shows a `<input type="file">` (`data-testid="my-profile-avatar-file"`) + an "Upload avatar" button (`data-testid="my-profile-avatar-upload"`); a successful upload sets `formAvatarUrl` to the returned URL and shows a success line (**AC-4**).
5. An upload that returns `file_too_large` / `invalid_mime_type` shows a specific full-sentence message and leaves `formAvatarUrl` unchanged (**AC-5**).
6. No cross-layer import (`apps/server` / `packages/*` runtime) and no `boardgame.io` import in `ownerProfileApi.ts`; the existing `fetchOwnerProfile` / `updateOwnerProfile` / `replaceOwnerLinks` wrappers are unchanged (**AC-6**).
7. `pnpm --filter @legendary-arena/arena-client typecheck` 0; `test` 0 (prior count preserved + the new wrapper tests); `build` 0 (**AC-7**).

---

## Verification Steps

```pwsh
# Step 1 — typecheck (vue-tsc)
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0

# Step 2 — run all arena-client tests
pnpm --filter @legendary-arena/arena-client test
# Expected: TAP — all passing (prior count + new upload-wrapper tests), 0 failing

# Step 3 — build
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0

# Step 4 — confirm the wrapper + field name
Select-String -Path "apps\arena-client\src\lib\api\ownerProfileApi.ts" -Pattern "uploadOwnerAvatar|append\('avatar'|/api/me/avatar"
# Expected: all three present

# Step 5 — confirm NO Content-Type is set on the upload (would break multipart)
Select-String -Path "apps\arena-client\src\lib\api\ownerProfileApi.ts" -Pattern "Content-Type"
# Expected: only the JSON PATCH/links wrappers (NOT inside uploadOwnerAvatar)

# Step 6 — confirm no forbidden cross-layer / boardgame.io import
Select-String -Path "apps\arena-client\src\lib\api\ownerProfileApi.ts" -Pattern "apps/server|packages/registry|packages/game-engine|boardgame.io"
# Expected: no output

# Step 7 — confirm scope
git diff --name-only
# Expected: only the files in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification (D-24026):** the change is confirmed **live on `play.legendary-arena.com`** — a signed-in player uploads an image on `?route=me` and the profile avatar updates; an oversized/wrong-type file shows the mapped error without wiping the avatar (screenshot / observed behavior captured). Tests alone do NOT satisfy this item.
- [ ] All acceptance criteria pass
- [ ] `uploadOwnerAvatar` + `AvatarUploadApiResult` + `AVATAR_UPLOAD_ERROR_CODES` added; FormData field `avatar`; no `Content-Type` header (`// why:` present)
- [ ] `MyProfilePage.vue` file-input + "Upload avatar" control drives the wrapper; success sets `formAvatarUrl`; per-code error messages
- [ ] `ownerProfileApi.test.ts` covers success / error-code mapping / network failure / drift; `node:test` + `node:assert`, no `boardgame.io`
- [ ] No server / contract / catalog change; existing wrappers + auth store + `App.vue` unchanged
- [ ] `typecheck` + `test` + `build` exit 0; no files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated (avatar upload UI now wired); `docs/ai/work-packets/WORK_INDEX.md` WP-298 checked off with date

---

## Lightweight-Lane Eligibility (D-24028)

**Structural (provisional):** (1) single layer — `apps/arena-client` only ✓; (2) 3 code/test files, no separate runtime-wiring file ✓; (3) no `01.6` trigger — the wrapper mirrors the existing `ownerProfileApi.ts` fetch-wrapper pattern (no new abstraction/contract category) ✓; (4) no new contract file (the error-code mirror is a local closed list guarded by a drift test, consuming the existing server contract) ✓; (5) **zero** D-entries — consumes the pre-existing D-10601 / D-10602 avatar contract ✓; (6) narrow UX surface (a file-upload control) — no scoring/identity-semantics/RNG/determinism/monetization change ✓.
**Empirical (confirmed at govern-close):** (7) strictly additive — the existing URL field + save flow + sibling wrappers untouched ✓; (8) zero determinism/persistence/hash impact (client UI consuming an existing endpoint) ✓; (9) file budget holds at final `git diff --name-only` ✓.
**Scaffold (empirical independence):** the wrapper + its test are prototyped and `pnpm --filter @legendary-arena/arena-client test` run **before** eligibility is confirmed, with the observed pass count recorded. Purely additive (a new path; nothing previously-passing is rewritten), so `01.4 §Empirical Scaffold` validation-tightening does not strictly apply; the lane's mandatory scaffold is satisfied by the observed run.

## Lint Gate Self-Review (00.3)

- §1 Structure — PASS: all required sections present; `## Out of Scope` lists ≥2 excluded items (server change, URL-field removal, cropping).
- §2 Non-Negotiable Constraints — PASS: forbids cross-layer + `boardgame.io` imports + server edits; the no-`Content-Type` and field-name rules are explicit; references `00.6`.
- §3 Assumes — PASS: the server endpoint contract, the client wrapper pattern, the `MyProfilePage` avatar block, and the test runner all listed with file:line sources.
- §4 Context — PASS: cites ARCHITECTURE layer rule, the real `ownerProfileApi.ts` / `avatarUpload.*` / `MyProfilePage.vue`, D-10601/10602/24083, `00.6`.
- §5 Output Completeness — PASS: 3 code/test files + governance, each marked new/modified with a one-line role; bounded (≤4).
- §6 Naming — PASS: canonical `avatarUrl` (response) + `avatar` (form field) per the server contract; descriptive `uploadOwnerAvatar` / `onUploadAvatar` / `AvatarUploadApiResult`; no abbreviations.
- §7 Dependency Discipline — PASS: no new npm dependency; uses built-in `fetch` + `FormData`. No axios/node-fetch.
- §8 Architectural Boundaries — PASS (Frontend): wrapper carries no game logic, no direct R2 fetch, no `boardgame.io`; grep-gated forbidden imports; consumes the server API cross-origin via `buildApiUrl` only.
- §9 Windows Compatibility — PASS: Verification Steps use `pwsh` + `Select-String` + `\` paths.
- §10 Env Var Hygiene — N/A: no new env vars (reuses `VITE_API_BASE_URL`); no secret in output.
- §11 Authentication Clarity — PASS: reuses the **existing** authenticated-session model (Option-equivalent) — the bearer token from the Pinia auth store on the existing `/api/me/*` endpoints; no new identity model, no JWT-secret surface introduced. The endpoint requires an authenticated session (server-enforced); the client attaches the token exactly as the sibling wrappers do.
- §12 Test Quality — PASS: `node:test` + `node:assert`, `globalThis.fetch` stub, no boardgame.io, no network/DB; drift test on the error-code mirror.
- §13 Commands & Verification — PASS: exact `pnpm` + `Select-String` commands with expected output.
- §14 Acceptance Criteria — PASS: 7 binary, observable items naming real files / functions / testids / codes.
- §15 Definition of Done — PASS: binary checkboxes incl. STATUS / WORK_INDEX + commit-prefix; §15.1 user-visible verify item present.
- §15.1 User-Visible Verification (D-24026) — PASS: surface `play.legendary-arena.com`; `## User-Visible Impact` present; DoD has a live-on-surface verify item, not tests-only.
- §16 Code Style — PASS: small wrapper + JSDoc; explicit `if/else` (no nested ternary / branching `.reduce()`); `is/ok`-style discriminants; `// why:` on the no-`Content-Type` decision + the error-code mirror; named imports only.
- §17 Vision Alignment — PASS: `## Vision Alignment` present; cites §3/§11; NG-proximity none; determinism N/A.
- §18 Prose-vs-Grep — N/A: verification greps target identifier tokens (`uploadOwnerAvatar`, `Content-Type`), not a count-bounded literal echoed verbatim in adjacent prose that would self-trip.
- §19 Bridge-vs-HEAD — N/A: no repo-state-snapshot artifact authored.
- §20 Funding Surface Gate — N/A: profile avatar UX; no donate/support copy, no funding affordance, no tournament-funding channel.
- §21 API Catalog Update — N/A: no HTTP endpoint or `apps/server/src/**` library function added or modified; this packet is a **client consumer** of the already-cataloged `POST /api/me/avatar` row (the catalog tracks server endpoints + server library functions, not client callers).

## Lint / Pre-Flight / Copilot (lightweight lane)

**Lint (00.3): PASS** — all 21 sections resolved above; §15.1 (D-24026) + §17 (Vision) satisfied with real blocks; §11 addresses the reuse-existing-auth model; §20 / §21 N/A carry non-tautological reasons.

**Condensed pre-flight (01.4): READY (lane).** Class = lightweight additive client UX (single layer; one modified wrapper + its new test + one additive control in an existing page). **Dependencies complete** — WP-106 ✅ (the `POST /api/me/avatar` pipeline this consumes), WP-296 ✅ (the CDN host the success URL uses), WP-104 ✅ (the `?route=me` profile + `OwnerProfileView`), WP-160 ✅ (the auth-store token), WP-161 ✅ (`buildApiUrl`) — all verified against source on `origin/main` @ `da0ef06b` (the server route contract + the client wrapper pattern both read from current `main`). **Scope locked** — 3 code/test files, additive, no contract/server/catalog/determinism/persistence surface. **Behavior-identity** is subsumed by the scaffold: the change is additive (a new wrapper + a new control; nothing previously passing is rewritten), so the suite is expected to hold at baseline + the new upload tests.

**Targeted self-review (lane copilot): PASS.** Eligibility is demonstrated with artifacts (3-file count, no new contract file, no hash/determinism surface, the planned scaffold run), not argued in prose. The one real failure mode — a manually-set `Content-Type` breaking the multipart boundary — is pinned as a Locked Value + a required `// why:` + a Common Failure Smell in EC-329. The client-local error-code mirror is guarded by a drift test against the server union. No BLOCK; no inline-amendment budget consumed at draft.

## Decision

This packet reserves **no** new DECISIONS entry — it consumes the pre-existing avatar contract (D-10601 validation policy, D-10602 endpoint/success-URL, D-24083 host). The design choices (additive file-upload control beside the retained URL field; client-local error-code mirror; no `Content-Type` on the multipart POST) are operational, not architectural, and are pinned in the WP + EC-329 rather than as a durable decision.
