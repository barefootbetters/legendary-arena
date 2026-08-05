# WP-500 — Auto-Assign Changeable Handles at Sign-In + Backfill

**Status:** Draft 2026-08-05 — standard two-session lane. **Gates: lint SATISFIED (21/21) · pre-flight READY · copilot PASS** — see Gate Verdicts.
**User-Visible Surface:** indirect — every account gains a `@handle`, so the (already-shipped) by-`@handle` friend-request and match-invite flows start resolving, and the owner/public profile `@handle` line renders. No new UI in this WP. D-24026 live-verify applies (a signed-in account shows a handle; a friend request by that handle succeeds).
**Primary Layer:** Server (`apps/server` — identity + auth). No engine/registry/client change. No schema migration (handle columns exist since migration 008).
**Dependencies:** WP-101 (handle contract — `handle_canonical`/`display_handle`/`handle_locked_at`, `HANDLE_REGEX`, `RESERVED_HANDLES`); WP-174 (first-sign-in provisioning); WP-499 / D-24302 (join-by-ID + the diagnosis that motivates this).

---

## Goal

The handle-claim feature was built (WP-101) but never wired: `claimHandle` has zero non-test callers, no endpoint, and no profile field, so `handle_canonical` is **NULL for every account** and every `@handle` affordance (friend-request WP-351, match-invite WP-358/366) returns `handle_not_found` for every target (diagnosed under WP-499; see the ewiki Profile Login page). This WP makes every account reachable by `@handle` — the root-cause fix. It auto-assigns a **changeable** handle derived from `display_name` at first-sign-in provisioning (leaving `handle_locked_at` NULL so a later explicit claim can still lock a user-chosen handle), and backfills the existing NULL-handle rows. The by-`@handle` flows then resolve with no change to their own code. The change-handle **UI + endpoint** (letting a user pick a nicer handle) is the paired follow-up WP, out of scope here.

## Assumes (Hard-Gate Preconditions)

```bash
# A. Handles are NULL for all accounts today — claimHandle is the only writer and has no production caller.
grep -q "handle_canonical = \$2" apps/server/src/identity/handle.logic.ts && echo "A_OK claimHandle is the current sole writer"
# B. Provisioning does NOT set a handle (the gap this WP fills).
! grep -q "handle_canonical" apps/server/src/auth/accountProvisioning.logic.ts && echo "B_OK provisioning sets no handle"
# C. The resolver derives displayName and calls provisionPlayerAccount (the wiring point).
grep -q "provisionPlayerAccount(" apps/server/src/auth/accountResolver.logic.ts && echo "C_OK resolver provisioning wiring point"
# D. The locked handle format + reserved set exist to derive against.
grep -q "HANDLE_REGEX" apps/server/src/identity/handle.types.ts && grep -q "RESERVED_HANDLES" apps/server/src/identity/handle.types.ts && echo "D_OK format + reserved set present"
```

## Context (Read First)

- **Auto-assign fires ONLY at first-sign-in provisioning; the backfill heals every existing account.** The resolver returns early for an already-known account (the found-account branch, `accountResolver.logic.ts` ~line 133); `attemptProvisioning` — and thus `assignAutoHandle` — runs **only on the no-match branch**, i.e. when provisioning a brand-new account (`accountProvisioning.logic.ts` header: provisioning is "the SOLE write site invoked by the account resolver's no-match branch"). So new accounts get a handle at provisioning, but existing NULL-handle accounts do **NOT** self-heal on login — they are healed **solely by the one-time `scripts/backfill-handles.mjs`**. That backfill is therefore a **hard Definition-of-Done gate** (the entire current user base is NULL-handle; without the backfill the bug is unfixed for them). `assignAutoHandle` is guarded (`WHERE handle_canonical IS NULL`), so it is idempotent and the backfill is safe to re-run.
- **Second writer of the handle columns (contract amendment, D-24303).** WP-101's module header states `claimHandle` is the *sole* writer of `handle_canonical`/`display_handle`/`handle_locked_at`. This WP adds `assignAutoHandle` as a second writer, but a **disjoint** one: it writes only `handle_canonical` + `display_handle` (equal, the derived slug) and **never** `handle_locked_at`. The WP-101 "mutual-presence invariant" is amended: `handle_canonical` + `display_handle` still move together; `handle_locked_at` becomes **independent** — NULL means auto-assigned (changeable), `now()` means explicitly claimed (immutable). Update the module header + any sole-writer verification note in lockstep.
- **Derivation is a best-effort, fail-open convenience.** A handle-assign failure (exhausted collision retries, transient DB error) must **never** break sign-in — it is wrapped in an **explicit call-site `try/catch`** that logs and continues. (This is *unlike* the D-24079 marketing enqueue, which is fail-open only because it is a dependency-injected fail-safe wrapper with no call-site guard; `assignAutoHandle` is a direct DB call that can reject, so it needs a real `try/catch`.) A handle-less account simply stays unreachable-by-handle until the backfill, which is the pre-WP status quo, not a regression.
- **No schema migration.** The three handle columns and the partial unique index on `handle_canonical` already exist (migration 008). This WP is pure logic + a data backfill.
- **Paired follow-up (out of scope):** the change-handle/claim **endpoint** + the profile **UI** field, and rewiring `claimHandle`'s `handle_canonical IS NULL` guard to key on `handle_locked_at IS NULL` (so a claim can overwrite an unlocked auto-handle). Reserved for the next WP; this WP only declares the model.

## Scope (In)

- **Modify `apps/server/src/identity/handle.logic.ts`** — add two functions:
  - `deriveHandle(displayName: string): string` (pure) — slug the display name to a valid handle per D-24303 §1 (`player` fallback for empty/reserved/underivable).
  - `assignAutoHandle(accountId, displayName, database): Promise<string | null>` — idempotent, collision-safe assignment per D-24303 §2 (`UPDATE … WHERE handle_canonical IS NULL`, `handle_locked_at` untouched/NULL; returns the assigned handle, or `null` if the row already had one or assignment could not complete). Update the module header for the amended writer invariant.
- **Modify `apps/server/src/identity/handle.logic.test.ts`** — unit tests for `deriveHandle` (casing, spaces, punctuation, leading digit, too-short/long, reserved, empty→`player`) and `assignAutoHandle` (fresh assign leaves `handle_locked_at` NULL; idempotent no-op when a handle exists; collision appends a suffix; DB-gated per the existing suite's real-Postgres tests).
- **Modify `apps/server/src/auth/accountResolver.logic.ts`** — after a successful `provisionPlayerAccount` in `attemptProvisioning`, call `assignAutoHandle(accountId, displayName, database)` inside an **explicit `try/catch`** that logs and continues (a throw/failure is swallowed with a `// why:`, never breaking sign-in).
- **Modify `apps/server/src/auth/accountResolver.logic.test.ts`** — assert a newly-provisioned account is assigned a handle, and that an `assignAutoHandle` failure does not fail resolution.
- **New `scripts/backfill-handles.mjs`** — a one-time operator script (`node --env-file=.env scripts/backfill-handles.mjs`) that reads `handle_canonical IS NULL` rows and assigns each a handle via the **same** `deriveHandle`/`assignAutoHandle` logic (single source of truth). It imports the server TS via the established **tsx-register precedent** (`scripts/process-stripe-events.mjs` / D-13405: `createRequire` → `tsx/esm/api` `register()` → `pathToFileURL` dynamic-import of the `.ts` source) — `apps/server` emits **no dist**, so a plain `import` of built output is not available. Idempotent, re-runnable; prints `assigned N / skipped M`.

## Out of Scope

- **The change-handle / claim endpoint + profile UI** (paired follow-up WP) — no `PATCH /api/me/handle`, no `MyProfilePage.vue` field.
- **Rewiring `claimHandle`'s `handle_canonical IS NULL` guard** to `handle_locked_at IS NULL` — rides the follow-up when a claim/change path is actually wired; `claimHandle` stays unused this WP.
- **A SQL-migration backfill** — deliberately rejected (SQL slug logic would diverge from the TS `deriveHandle`); the backfill reuses the TS functions.
- **Any engine/registry/client change; account-linking; the friends/invite flows themselves** (they resolve unchanged once handles exist).

## Files Expected to Change

- `apps/server/src/identity/handle.logic.ts` — **modified** (`deriveHandle` + `assignAutoHandle` + header)
- `apps/server/src/identity/handle.logic.test.ts` — **modified** (unit + DB-gated tests)
- `apps/server/src/auth/accountResolver.logic.ts` — **modified** (fail-open wiring)
- `apps/server/src/auth/accountResolver.logic.test.ts` — **modified** (assign-on-provision + fail-open tests)
- `scripts/backfill-handles.mjs` — **new** (one-time backfill)
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` / `NUMBER-LEDGER.md` / `DECISIONS.md` / `docs/ai/REFERENCE/api-endpoints.md`(if a Library-only row changes) — **modified** (governance close)

4 code/test files + 1 script + governance. Server layer, single package (`apps/server`). Two-session lane.

## Contract

At first-sign-in provisioning, the server derives a handle from `display_name` (`deriveHandle`) and assigns it (`assignAutoHandle`) — setting `handle_canonical` + `display_handle` to the derived slug and leaving `handle_locked_at` NULL — idempotently (`WHERE handle_canonical IS NULL`) and fail-open. A one-time backfill assigns handles to all existing NULL rows via the same logic. **Amended handle invariant (D-24303):** `handle_canonical`/`display_handle` are NULL-together or set-together; `handle_locked_at` is independent — NULL = auto-assigned (changeable), `now()` = explicitly claimed (immutable). `claimHandle`, `findAccountByHandle`, `getHandleForAccount`, and the profile projections are otherwise unchanged; the by-`@handle` friend/invite flows resolve with no code change.

## Acceptance Criteria

1. `deriveHandle` returns a `HANDLE_REGEX`-valid value for the pinned cases: `"Jeff"`→`jeff`; `"Spider-Man"`→`spider_man`; `"88Legend"`→`u88legend` (leading non-letter ⇒ prefix `u`); `"Jo"`→`jo0` (pad to 3 with `0`); a 40-char name→a ≤24-char slug; an emoji-only, empty, or reserved name→`player`.
2. `assignAutoHandle` on a fresh account sets `handle_canonical` = `display_handle` = the slug with `handle_locked_at` **NULL**; a second call is a no-op (returns `null`); a slug already taken yields a suffixed variant (`base`, `base2`, …) via the partial-unique `23505` retry. **A 24-char base that collides stays ≤24** — the base is truncated to `24 − suffix.length` before the suffix is appended, and every candidate is validated against `HANDLE_REGEX` before the UPDATE (no over-length handle can be written).
3. A newly-provisioned account (via the resolver) has a non-NULL `handle_canonical`; an injected `assignAutoHandle` failure still returns a resolved `AccountId` (sign-in unbroken).
4. `scripts/backfill-handles.mjs` assigns a handle to every pre-existing NULL row (re-run = 0 further assignments) and prints a count.
5. After a backfill in a test DB, `findAccountByHandle(deriveHandle(name))` resolves the account (the friend/invite lookup now succeeds). `pnpm -r build` + `pnpm --filter @legendary-arena/server test` exit 0. No engine/registry/client file changed; no `finalStateHash`/`PRE_WP080` re-pin (N/A — no engine surface).

## Verification Steps

```bash
pnpm -r build
pnpm --filter @legendary-arena/server test 2>&1 | tail -6   # incl. the DB-gated identity + resolver suites (TEST_DATABASE_URL)
# Backfill against the local test DB, then confirm reachability:
node --env-file=.env scripts/backfill-handles.mjs   # prints "assigned N / skipped M"
git diff --name-only | grep -vE '^(apps/server/src/(identity/handle\.logic|auth/accountResolver\.logic)\.(ts|test\.ts)|scripts/backfill-handles\.mjs|docs/)' ; echo "out-of-scope hits above (expect none)"
```

## Definition of Done (Binary Gate — ALL must pass)

- [ ] Preconditions A–D passed
- [ ] All 5 Acceptance Criteria pass
- [ ] `assignAutoHandle` leaves `handle_locked_at` NULL and is idempotent + collision-safe; wiring is fail-open (sign-in never breaks)
- [ ] `pnpm -r build` + server suite (incl. DB-gated) exit 0
- [ ] Only the five allowlisted files + governance changed; no engine/registry/client change; no re-pin (N/A)
- [ ] `docs/ai/STATUS.md` Done entry; WORK_INDEX `[x]` + EC_INDEX Done; NUMBER-LEDGER `RESERVED`→`LANDED`; D-24303 flipped Active; mindmap node `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` 0; `api-endpoints.md` updated if a Library-only row changed
- [ ] Commit prefix `EC-535:` (code) + `SPEC:` (governance close)
- [ ] **Prod backfill run is a REQUIRED completion step** (not optional): after deploy, `node --env-file=.env scripts/backfill-handles.mjs` against prod, because the entire existing user base is NULL-handle and auto-assign fires only for newly-provisioned accounts. Until it runs, existing accounts remain unreachable by `@handle`.
- [ ] D-24026 live-verify: a signed-in account shows a `@handle`; a friend-request/invite to that handle resolves (operator-pending, post-deploy, after the prod backfill above)

## Gate Verdicts (drafting session)

- **Pre-flight (01.4):** READY TO EXECUTE **after correction**. An independent-subagent audit first returned **NOT READY / BLOCK** and caught four real defects in the draft, all now folded in: (1) the "self-heals on every login" model was **false** — `attemptProvisioning` runs only on the resolver's no-match branch, so auto-assign fires only for newly-provisioned accounts and the backfill is the sole heal path for existing accounts (now a hard DoD gate); (2) the collision suffix could overflow the 24-char `HANDLE_REGEX` ceiling (now: truncate base to `24 − suffix.length` + validate each candidate); (3) "fail-open like the marketing enqueue" was structurally wrong (that path is a DI'd fail-safe with no `try/catch`; `assignAutoHandle` needs an explicit call-site `try/catch`); (4) the backfill's "import from dist" was a dead end (`apps/server` emits no dist — now pinned to the `process-stripe-events.mjs`/D-13405 tsx-register precedent + `--env-file=.env`). Deps (WP-101, WP-174, WP-499/D-24302) and the wiring point verified against source.
- **Copilot (01.7):** PASS (post-correction) — the amendment (second, disjoint handle-writer) is coherent and prose-enforced (no automated sole-writer gate exists — migration 008's "verified by tests" comment is stale; the invariant lives in the `handle.logic.ts` header). `deriveHandle`'s branches are pinned deterministic (prefix `u`, pad `0`, terminal `player` fallback). No engine/determinism/persistence-snapshot surface.
- **Lane:** standard two-session — an identity contract amendment (WP-101 invariant) + a second handle-writer; not lightweight.

## Lint Gate Self-Review

All 21 sections resolved (PASS or explicit N/A):
- **§4 (00.2):** canonical field names `handle_canonical` / `display_handle` / `handle_locked_at` used verbatim; no new field.
- **§5:** Files Expected to Change is a closed set (5 code/script + governance) matching the EC.
- **§10 (env):** N/A — no new env var (backfill reuses `DATABASE_URL`/`TEST_DATABASE_URL`). **§11 (auth):** provisioning runs inside the existing WP-112 session-verify chain; no new auth surface. **§12 (tests):** `.test.ts` only; DB-gated identity + resolver suites extended.
- **§17 Vision / §20 Funding / §21 API:** resolved below.
- **§18 / §19:** the only verification grep runs over `git diff --name-only`; STATUS authored at close against live HEAD.
- All remaining sections PASS.

## Vision Alignment

**Clauses touched:** §22 (determinism — server identity only; no `G`/RNG/replay/hash). **Conflict:** `No conflict.` Assigning a presentation/routing alias lowers friction to connect + play; no card semantics, scoring, or persistence-of-`G` change. Handles remain **presentation/routing aliases** — `AccountId` stays the identity key for trust/ranking (FR-2), so auto-assignment does not touch ranked-eligibility or the friendship trust key. **Non-Goal check:** none of NG-1..8 crossed (no monetization/pay-to-win/persuasion/competitive surface).

## Funding Surface Gate

**N/A — no funding surface touched** (no nav/registry/profile-funding/tournament affordance or copy). Authority: WP-097, D-9701, D-9801.

## API Catalog Update

**No new HTTP endpoint.** `assignAutoHandle` / `deriveHandle` are `apps/server/src/**` library functions reachable from the resolver; if either is recorded in `api-endpoints.md` as `Library-only` at execution, add/replace the whole row per D-11804. No request/response schema change to any existing endpoint.
