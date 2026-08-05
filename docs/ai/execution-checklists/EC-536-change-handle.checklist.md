# EC-536 — Change Your Handle (Execution Checklist)

**Source:** docs/ai/work-packets/WP-501-change-handle.md
**Layer:** Server (`apps/server` — identity) + App (`apps/arena-client` — owner profile). Standard two-session lane. No schema migration; no engine touch; `handle.types.ts` NOT touched.

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] `pnpm -r build` first (server + arena-client import built deps)
- [ ] Precond A: `grep -q "export async function assignAutoHandle" apps/server/src/identity/handle.logic.ts` (WP-500 landed)
- [ ] Precond B: `grep -q "handle_already_locked" apps/server/src/identity/handle.types.ts` (reuse — NO new HandleErrorCode)
- [ ] Precond C: `! test -f apps/server/src/identity/handle.routes.ts` (new route file)
- [ ] Precond D: `grep -q "registerOwnerProfileRoutes(server.router, pool" apps/server/src/server.mjs` (registration pattern)
- [ ] DB-gated tests runnable: `TEST_DATABASE_URL` + migrations (see `project_db_backed_server_tests_local`)
- [ ] Working tree clean except this WP

## Locked Values (do not re-derive)
- `changeHandle(accountId, requestedHandle, database): Promise<Result<{ handleCanonical: string; displayHandle: string }>>` in `handle.logic.ts`. Structure MIRRORS `claimHandle`: (1) `const validation = validateHandleFormat(requestedHandle); if (validation.ok === false) return validation;` (→ `invalid_handle`/`reserved_handle`; use the explicit `=== false`, house style / `claimHandle:175`). (2) `const { canonical, display } = validation.value;` (3) `UPDATE legendary.players SET handle_canonical = $2, display_handle = $3 WHERE ext_id = $1 AND handle_locked_at IS NULL RETURNING handle_canonical, display_handle` with `[accountId, canonical, display]` — **NEVER set `handle_locked_at`**. (4) catch `23505` → `{ ok:false, code:'handle_taken', reason:<sentence> }`; any other error → `return Promise.reject(error)` (no `throw`, keep the file's zero-`throw` property). (5) `rows.length === 1` → `{ ok:true, value:{ handleCanonical: row.handle_canonical, displayHandle: row.display_handle } }`. (6) 0 rows → `const existing = await findPlayerByAccountId(accountId, database); if (existing === null) return unknown_account;` else the row's handle is locked → `handle_already_locked` (reuse the existing code; a defensive path — nothing is locked today).
- **Reuse the existing 5 `HandleErrorCode` values** — do NOT add a code, do NOT touch `handle.types.ts` or the `HANDLE_ERROR_CODES` drift test.
- `changeHandle` `canonical`/`display` come from `validateHandleFormat` (canonical = `trim().toLowerCase()`, display = post-trim casing) — same split `claimHandle` uses.
- `handle.routes.ts`: `registerHandleRoutes(router, pool, { requireAuthenticatedSession, verifier, accountResolver })` — mirror `ownerProfile.routes.ts`. `PATCH /api/me/handle`, `authenticated-session-required`; body `{ handle: string }`; acting `accountId` resolved from the session (NEVER body-supplied). Map: ok → `200 { handleCanonical, displayHandle }`; `invalid_handle`/`reserved_handle` → `400 { error }`; `handle_taken`/`handle_already_locked` → `409 { error }`; auth failures → `401`/`500` per the locked `SessionValidationErrorCode` table (`unknown_account` is **401, not 403**). `Cache-Control: no-store` as the FIRST statement of every response (WP-115 / D-11504).
- `server.mjs`: `registerHandleRoutes(server.router, pool, { … same injected auth deps as registerOwnerProfileRoutes … })` — `01.5` runtime-wiring, authorized.
- `ownerProfileApi.changeHandle(authToken, handle): Promise<{ ok: true; handleCanonical: string; displayHandle: string } | { ok: false; status: number; code: HandleErrorCode | null }>` — a **discriminated union** (matches every sibling in this file: `fetchOwnerProfile` / `updateOwnerProfile` / `replaceOwnerLinks` return `{ ok:true, value } | { ok:false, status, code }` and NEVER throw). `PATCH buildApiUrl('/api/me/handle')`, `Authorization: Bearer`, JSON `{ handle }`; on 200 → `{ ok:true, handleCanonical, displayHandle }`; on non-200 parse `body.error` into a client-local `HandleErrorCode` mirror (add a `HANDLE_ERROR_CODES`-style const array mirroring the 5 server values, exactly as this file already mirrors `AvatarUploadErrorCode`) → `{ ok:false, status, code }` (`code` null if the body has no recognized error). A bare success-only return CANNOT carry the failure branch AC-4 needs.
- `MyProfilePage.vue`: a change-your-handle affordance near the existing `@{handleCanonical}` line — a text input + "Change" button (`data-testid`s), inline error/success via a local ref; on success, update the displayed handle. Additive; do NOT alter the display-name form or the account-id line.

## Guardrails
- `changeHandle` writes ONLY `handle_canonical` + `display_handle`; `handle_locked_at` stays untouched (a changed handle remains changeable — D-24303/D-24305). Any `handle_locked_at` write here is a contract violation.
- Change ONLY where `handle_locked_at IS NULL` (freely changeable while unlocked). Do NOT overwrite a locked handle.
- Reuse existing `HandleErrorCode`; NO `handle.types.ts` edit, NO drift-test churn.
- `changeHandle` never `throw`s (return `Result` / `Promise.reject`) — the file advertises zero `throw`.
- Acting identity is session-resolved, never body-supplied. `Cache-Control: no-store` on every response.
- Do NOT touch `claimHandle`'s guard, `assignAutoHandle`, `findAccountByHandle`, the friends/invite flows, the display-name/avatar profile edit, or add a lock/rate-limit (all deferred).
- Zero determinism/persistence-of-`G` surface; no re-pin (N/A — server identity + client UI).
- If any of {a new `HandleErrorCode` seems needed, a schema migration, an engine touch, scope ambiguity} arises → STOP and re-scope.

## Required `// why:` Comments
- On `changeHandle` NOT writing `handle_locked_at` (why: a changed handle stays changeable; only an explicit claim locks — D-24303/D-24305).
- On the `WHERE … handle_locked_at IS NULL` clause (why: freely changeable while unlocked; a locked handle is immutable).
- On the `23505` catch (why: the partial-unique on `handle_canonical` means the target is taken → `handle_taken`).
- On the resolver-style `Promise.reject` (why: keep the file's zero-`throw` property; the route maps it to 500).

## Files to Produce
- `apps/server/src/identity/handle.logic.ts` — **modified** — `changeHandle` + header note
- `apps/server/src/identity/handle.logic.test.ts` — **modified** — DB-gated `changeHandle` tests
- `apps/server/src/identity/handle.routes.ts` — **new** — `registerHandleRoutes` / `PATCH /api/me/handle`
- `apps/server/src/identity/handle.routes.test.ts` — **new** — route tests
- `apps/server/src/server.mjs` — **modified** — register the route
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — **modified** — `changeHandle` wrapper
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — handle-edit affordance
- `apps/arena-client/src/pages/MyProfilePage.test.ts` **or** `.../lib/api/ownerProfileApi.test.ts` — **modified** — change flow
- `docs/ai/REFERENCE/api-endpoints.md` + STATUS / WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP / NUMBER-LEDGER / DECISIONS — **modified** — governance close

## After Completing
- [ ] `changeHandle` DB-gated tests green (overwrite unlocked + old-handle-released + taken/invalid/reserved/unknown); route tests green (status mapping + auth); client change-flow test green
- [ ] In-browser (localhost): `?route=me` → change `@handle` to a free name (line updates) + a taken name (inline error)
- [ ] `pnpm -r build` + server + arena-client suites exit 0
- [ ] `git diff --name-only | grep -vE '<the allowlist regex from WP Verification>'` → NO MATCH
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; NUMBER-LEDGER RESERVED→LANDED; D-24305 Active; ROADMAP `✅` + counts; `api-endpoints.md` PATCH /api/me/handle + changeHandle rows (D-11804)
- [ ] Commit prefix: `EC-536:` (code) + `SPEC:` (governance); D-24026 live-verify (change a handle on deployed `?route=me`) operator-pending

## Common Failure Smells
- `changeHandle` writes `handle_locked_at` → breaks the changeable model; only an explicit claim (deferred) may lock.
- A new `HandleErrorCode` added / `handle.types.ts` in the diff → out of scope; reuse `handle_already_locked` + the existing four.
- Returning `HandleClaim` from `changeHandle` → its `handleLockedAt: string` doesn't fit an unlocked (NULL) handle; return `{ handleCanonical, displayHandle }`.
- The change UPDATE omits `WHERE … handle_locked_at IS NULL` → would silently overwrite a (future) locked handle.
- Do NOT write a test asserting `changeHandle` *errors* on a handle-less account (`handle_canonical` NULL): the `WHERE … handle_locked_at IS NULL` matches, so it would ASSIGN (1 row) not error. Harmless post-WP-500 (every account is auto-assigned); just don't assert an error there.
- Route reads `accountId` from the body → identity must be session-resolved (auth-gate), never client-supplied.
- Missing `Cache-Control: no-store` on an error path → WP-115/D-11504 lock.
