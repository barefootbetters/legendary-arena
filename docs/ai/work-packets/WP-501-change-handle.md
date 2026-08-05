# WP-501 — Change Your Handle (owner-profile handle edit)

**Status:** Draft 2026-08-05 — standard two-session lane. **Gates: lint SATISFIED (21/21) · pre-flight READY · copilot PASS** — see Gate Verdicts.
**User-Visible Surface:** owner profile (`?route=me`) gains a **change-your-`@handle`** field; the `@handle` a user is stuck with (the WP-500 auto-derived slug, e.g. `jeff2`) becomes editable. D-24026 live-verify applies.
**Primary Layer:** Server (`apps/server` — identity) + App (`apps/arena-client` — owner profile). Cross-layer, one WP (WP-498 mixed-layer precedent). No schema migration; no engine touch.
**Dependencies:** WP-101 (handle contract — `validateHandleFormat`, `HandleErrorCode`, `HANDLE_REGEX`, `RESERVED_HANDLES`, `findPlayerByAccountId`); WP-500 / D-24303 (auto-assigned changeable handles — `handle_locked_at` NULL = changeable); WP-104 (owner-profile edit surface — `MyProfilePage.vue`, `ownerProfileApi.ts`, the authenticated-session route pattern).

---

## Goal

WP-500 gives every account an auto-derived `@handle`, but there is **no way to change it** — the profile only *renders* `@handle`, and a slug collision means a user can be stuck with `jeff2` when they wanted `jeff`. This WP lets a signed-in user **change their handle** to any available one. Per the D-24303 model, auto-assigned handles are **freely changeable while unlocked** (`handle_locked_at IS NULL`, which is every account today — no lock feature is wired). A new `changeHandle` server function + `PATCH /api/me/handle` endpoint validate + update, and a handle-edit affordance on `?route=me` drives it. The explicit lock/claim action (making a handle permanent) is a deferred follow-up.

## Assumes (Hard-Gate Preconditions)

```bash
# A. WP-500 is landed — auto-assigned handles exist and are unlocked (handle_locked_at NULL).
grep -q "export async function assignAutoHandle" apps/server/src/identity/handle.logic.ts && echo "A_OK WP-500 present"
# B. validateHandleFormat + the reusable error codes exist (no new HandleErrorCode needed).
grep -q "export function validateHandleFormat" apps/server/src/identity/handle.logic.ts && grep -q "handle_already_locked" apps/server/src/identity/handle.types.ts && echo "B_OK validate + handle_already_locked reusable"
# C. No handle route exists yet (this WP wires the first one).
! test -f apps/server/src/identity/handle.routes.ts && echo "C_OK no handle route today"
# D. The owner-profile route-registration + client-api pattern to mirror.
grep -q "registerOwnerProfileRoutes(server.router, pool" apps/server/src/server.mjs && grep -q "buildApiUrl('/api/me/profile')" apps/arena-client/src/lib/api/ownerProfileApi.ts && echo "D_OK owner-profile pattern present"
```

## Context (Read First)

- **Freely changeable, no lock — the D-24303 model.** `assignAutoHandle` leaves `handle_locked_at` NULL (auto-assigned = changeable). `changeHandle` updates the handle **only where `handle_locked_at IS NULL`**, so a user can change it any number of times. Because no lock feature is wired, *every* account is unlocked, so change works for everyone today. The previous handle is simply **released** to the free pool (no redirect / reservation — standard username-change behavior).
- **Reuse the existing error codes — no contract-union change.** `changeHandle` reuses `validateHandleFormat` (→ `invalid_handle` / `reserved_handle`), the partial-unique `23505` (→ `handle_taken`), and — for the defensive 0-row case — the **existing** `handle_already_locked` (row exists but locked) vs `unknown_account` (no row). So `handle.types.ts` (a locked WP-101 contract file) is **not touched**; no `HandleErrorCode`/`HANDLE_ERROR_CODES` drift.
- **Third disjoint writer of the handle columns (extends D-24303).** `changeHandle` is a third sanctioned writer of `handle_canonical` + `display_handle` (after `claimHandle` and `assignAutoHandle`), and — like `assignAutoHandle` — **never writes `handle_locked_at`**. Unlike `assignAutoHandle` (which only fills a NULL handle), `changeHandle` *overwrites* an existing unlocked handle. The `handle.logic.ts` header (amended by WP-500) gains a one-line note.
- **Return shape.** A changed handle is unlocked, so `handle_locked_at` is NULL — which does not fit the required-`string` `HandleClaim.handleLockedAt`. `changeHandle` therefore returns a small `Result<{ handleCanonical: string; displayHandle: string }>` (the new handle for the client to render), reusing `HandleErrorCode`.
- **Deferred follow-ups (out of scope):** the explicit **lock/claim** action (a "make this permanent" that sets `handle_locked_at` — would rewire `claimHandle`'s `handle_canonical IS NULL` guard to `handle_locked_at IS NULL`); per-account **change rate-limit / cooldown** (anti-squat). Neither is needed for the change capability.

## Scope (In)

- **Modify `apps/server/src/identity/handle.logic.ts`** — add `changeHandle(accountId, requestedHandle, database): Promise<Result<{ handleCanonical: string; displayHandle: string }>>`, mirroring `claimHandle`'s structure but `UPDATE … WHERE ext_id = $1 AND handle_locked_at IS NULL` (never writes `handle_locked_at`); one-line header note for the third writer.
- **Modify `apps/server/src/identity/handle.logic.test.ts`** — DB-gated `changeHandle` tests (success overwrites an unlocked handle; `handle_taken` on collision; `invalid_handle`/`reserved_handle`; `unknown_account`; old handle released → re-usable).
- **New `apps/server/src/identity/handle.routes.ts`** — `registerHandleRoutes(router, pool, { requireAuthenticatedSession, verifier, accountResolver })` exposing `PATCH /api/me/handle` (`authenticated-session-required`, body `{ handle }`) → `changeHandle`; `Cache-Control: no-store`; the WP-104 auth chain + error mapping.
- **New `apps/server/src/identity/handle.routes.test.ts`** — route tests (200 success; 400/409 error mapping; 401 auth).
- **Modify `apps/server/src/server.mjs`** — register the handle route (runtime-wiring, `01.5`) with the same injected auth deps as `registerOwnerProfileRoutes`.
- **Modify `apps/arena-client/src/lib/api/ownerProfileApi.ts`** — add `changeHandle(authToken, handle)` → `PATCH /api/me/handle`, returning the **discriminated union** `{ ok:true; handleCanonical; displayHandle } | { ok:false; status; code: HandleErrorCode | null }` (matching the file's `fetchOwnerProfile`/`updateOwnerProfile` siblings; never throws), plus a client-local mirror of the 5 `HandleErrorCode` values (the `AvatarUploadErrorCode` mirror precedent).
- **Modify `apps/arena-client/src/pages/MyProfilePage.vue`** — a **change-your-handle** affordance near the `@handle` line: input + "Change" button + inline error/success; on success, update the rendered `@handle`.
- **Modify a client test** (`MyProfilePage.test.ts` or `ownerProfileApi.test.ts`) — the change flow + error surface.

## Out of Scope

- **The explicit lock/claim action** (making a handle permanent; rewiring `claimHandle`'s guard) — deferred follow-up.
- **Change rate-limit / cooldown / anti-squat** — deferred.
- **A new `HandleErrorCode`** (reuse the existing five), **`handle.types.ts`** (untouched), **any schema migration**, **the public profile / friends / invite flows** (they already read `handle_canonical`).

## Files Expected to Change

- `apps/server/src/identity/handle.logic.ts` — **modified** (`changeHandle` + header note)
- `apps/server/src/identity/handle.logic.test.ts` — **modified** (DB-gated `changeHandle` tests)
- `apps/server/src/identity/handle.routes.ts` — **new** (`PATCH /api/me/handle`)
- `apps/server/src/identity/handle.routes.test.ts` — **new** (route tests)
- `apps/server/src/server.mjs` — **modified** (register the route; `01.5` runtime-wiring)
- `apps/arena-client/src/lib/api/ownerProfileApi.ts` — **modified** (`changeHandle` wrapper)
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** (handle-edit affordance)
- `apps/arena-client/src/pages/MyProfilePage.test.ts` **or** `.../lib/api/ownerProfileApi.test.ts` — **modified** (change flow)
- `docs/ai/REFERENCE/api-endpoints.md` (`PATCH /api/me/handle` + `changeHandle` Library-only rows, D-11804) / STATUS / WORK_INDEX / EC_INDEX / ROADMAP-MINDMAP / NUMBER-LEDGER / DECISIONS — **modified** (governance close)

~7 code/test + 1 runtime-wiring (`server.mjs`) + governance. Cross-layer (server + app). Two-session lane.

## Contract

A signed-in user changes their handle via `PATCH /api/me/handle` `{ handle }` → `changeHandle`, which `validateHandleFormat`s the input and `UPDATE`s `handle_canonical` + `display_handle` **where the account's `handle_locked_at IS NULL`** (freely changeable; never writes `handle_locked_at`). Success → `200 { handleCanonical, displayHandle }`; `invalid_handle`/`reserved_handle` → 400; `handle_taken` (partial-unique `23505`) / `handle_already_locked` → 409; `unknown_account`/auth → 401. The previous handle is released. `changeHandle` is a third disjoint writer of the two columns (extends D-24303); `handle.types.ts` and the friends/invite lookups are unchanged.

## Acceptance Criteria

1. `changeHandle` on an account with an unlocked auto-handle overwrites `handle_canonical` + `display_handle` to the new value, leaves `handle_locked_at` NULL, and `findAccountByHandle(new)` resolves the account while `findAccountByHandle(old)` no longer does.
2. `changeHandle` returns `handle_taken` when the target is held by another account (`23505`), `invalid_handle`/`reserved_handle` on a bad format, and `unknown_account` for a missing account. Never `throw`s.
3. `PATCH /api/me/handle` maps success → `200 { handleCanonical, displayHandle }` and each error to its documented status (400/409/401), with `Cache-Control: no-store`; unauthenticated → 401.
4. On `?route=me`, entering a new handle and clicking Change updates the rendered `@handle` on success and shows inline copy on `handle_taken`/`invalid`/`reserved` — verified in-browser.
5. `pnpm -r build` + `pnpm --filter @legendary-arena/server test` + `pnpm --filter @legendary-arena/arena-client test` exit 0. No `handle.types.ts`/migration/engine change; no `finalStateHash`/`PRE_WP080` re-pin (N/A). `api-endpoints.md` gains the endpoint + `changeHandle` rows (D-11804).

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/server test 2>&1 | tail -6   # incl. DB-gated changeHandle (TEST_DATABASE_URL)
pnpm --filter @legendary-arena/arena-client test 2>&1 | tail -6
# Browser (localhost): ?route=me → change @handle to a free name (updates the line) and to a taken one (inline error).
git diff --name-only | grep -vE '^(apps/server/src/identity/handle\.(logic|routes)\.(ts|test\.ts)|apps/server/src/server\.mjs|apps/arena-client/src/(lib/api/ownerProfileApi|pages/MyProfilePage)\.(ts|vue|test\.ts)|docs/)' ; echo "out-of-scope hits above (expect none)"
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed
- [ ] All 5 Acceptance Criteria pass
- [ ] `changeHandle` never writes `handle_locked_at`, reuses existing `HandleErrorCode`, never `throw`s; the endpoint maps every code correctly
- [ ] `pnpm -r build` + server + arena-client suites exit 0
- [ ] Only the allowlisted files + governance changed; no `handle.types.ts`/migration/engine change; no re-pin (N/A)
- [ ] `docs/ai/STATUS.md` Done; WORK_INDEX `[x]` + EC_INDEX Done; NUMBER-LEDGER `RESERVED`→`LANDED`; D-24305 Active; mindmap `📝`→`✅` + `roadmap:counts:write`; `roadmap:counts:check` 0; `api-endpoints.md` updated (D-11804)
- [ ] Commit prefix `EC-536:` (code) + `SPEC:` (governance close)
- [ ] D-24026 live-verify: change a handle on the deployed `?route=me` and confirm it renders + resolves in the friends lookup (operator-pending)

## Gate Verdicts (drafting session)

- **Pre-flight (01.4):** READY TO EXECUTE — an independent-subagent audit verified every structural claim against source (`validateHandleFormat` split, `claimHandle` mirror, `findPlayerByAccountId` null-on-missing, the `WHERE … handle_locked_at IS NULL` overwrite vs `assignAutoHandle`'s fill-only `WHERE … handle_canonical IS NULL`, `handle_already_locked` reuse needing no `handle.types.ts` change, the migration-008 partial-unique for `23505`, the `server.mjs`/`ownerProfile.routes.ts`/`ownerProfileApi.ts` patterns, and the authorities). Deps on `main`; closed allowlist. One correction folded in (below).
- **Copilot (01.7):** PASS — one RISK corrected: the client `changeHandle` wrapper was drafted with a success-only return that couldn't carry the error branch AC-4 needs; now a discriminated union matching the `ownerProfileApi` siblings (the *server* function's `{ handleCanonical, displayHandle }` return is unchanged and sound). Minor: EC now uses the explicit `validation.ok === false` house form and notes not to assert an error on a handle-less account. No engine/determinism/persistence-snapshot surface.
- **Lane:** standard two-session — cross-layer (server + app) + a new authenticated endpoint; not lightweight.

## Lint Gate Self-Review

All 21 sections resolved (PASS or explicit N/A):
- **§4 (00.2):** canonical field names `handle_canonical` / `display_handle` / `handle_locked_at` verbatim; no new field.
- **§5:** Files Expected to Change is a closed set matching the EC.
- **§10 (env):** N/A. **§11 (auth):** `PATCH /api/me/handle` is `authenticated-session-required` via the WP-104 chain (`requireAuthenticatedSession` + verifier + accountResolver); acting identity session-resolved, never body-supplied. **§12 (tests):** `.test.ts` only; DB-gated `changeHandle` + route + client tests.
- **§17 Vision / §20 Funding / §21 API:** resolved below.
- **§18 / §19:** the verification grep runs over `git diff --name-only`; STATUS authored at close against live HEAD.
- All remaining sections PASS.

## Vision Alignment

**Clauses touched:** §22 (determinism — server identity + client UI; no `G`/RNG/replay/hash). **Conflict:** `No conflict.` Editing a presentation/routing alias; `AccountId` stays the identity/trust key (FR-2), so a handle change never touches ranked eligibility or the friendship trust key (a friendship survives a handle change — FR-3). **Non-Goal check:** none of NG-1..8 crossed.

## Funding Surface Gate

**N/A — no funding surface touched** (owner-profile identity edit only). Authority: WP-097, D-9701, D-9801.

## API Catalog Update

**Adds `PATCH /api/me/handle`** (`Wired`, `authenticated-session-required`) + a `changeHandle` `Library-only` row to `docs/ai/REFERENCE/api-endpoints.md` per D-11804 (whole-row). Request `{ handle }`; response `200 { handleCanonical, displayHandle }` / documented `HandleErrorCode` error envelopes. No change to an existing endpoint's schema.
