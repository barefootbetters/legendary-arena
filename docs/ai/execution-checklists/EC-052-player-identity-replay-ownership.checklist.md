# EC-052 — Player Identity & Replay Ownership (Execution Checklist)

**Source:** docs/ai/work-packets/WP-052-player-identity-replay-ownership.md (v1.3, 2026-04-25)
**Layer:** Server / Identity + Storage

**Execution Authority:**
This EC is the authoritative execution checklist for WP-052.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-052.

**Pre-Flight resolution bundle (2026-04-25):** PS-1 (Vision Alignment),
PS-2 (`PlayerId` → `AccountId` rename — D-5201), PS-3 (server identity
directory classification — D-5202), PS-4 (persistence taxonomy
clarification — D-5203), PS-5 (test suite wrapping → +2 suites), PS-6
(idempotent SQL pattern), PS-7 (UUID source `node:crypto`), PS-8
(`CREATE TABLE IF NOT EXISTS`), PS-9 (email canonicalization), PS-10
(`displayName` constraints), PS-11 (`updatedAt` policy), PS-12 (GDPR
blob handoff scope) all locked into the WP and reflected below.

---

## Before Starting

- [ ] WP-004 complete: server startup sequence exists (`apps/server/src/server.mjs`;
      `index.mjs` is process entrypoint only)
- [ ] WP-027 complete: `ReplayInput`, `replayGame`, `computeStateHash` exported
- [ ] WP-051 complete: `checkParPublished(scenarioKey)` exists at server layer
- [ ] `docs/13-REPLAYS-REFERENCE.md` exists and read in full
- [ ] `docs/ai/ARCHITECTURE.md §Layer Boundary` read
- [ ] `docs/ai/DECISIONS.md` D-8701, D-5201, D-5202, D-5203 read in full
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 with engine **513/115/0** and server **19/3/0**
      baseline at packet entry

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-052.

- `AccountId` is a nominal/branded string type
  `string & { readonly __brand: 'AccountId' }` — compile-time branding
  must prevent accidental interchange with other strings; renamed from a
  draft-time `PlayerId` to resolve collision with engine `PlayerId`
  (D-8701, D-5201)
- `AccountId` is generated via `randomUUID` from `node:crypto` (or via
  injected `idProvider` in tests). No external library, no fallback.
- `AccountId` maps to `legendary.players.ext_id` — never to
  `player_id bigint`
- `AccountId` is distinct from boardgame.io's `playerID` (engine-local
  turn identifier) and from the engine `PlayerId` alias per D-8701
- `AuthProvider`: `'email' | 'google' | 'discord'` — no other values
- `ReplayVisibility`: `'private' | 'link' | 'public'` — default `'private'`
- `DEFAULT_RETENTION_POLICY`: `{ minimumDays: 30, defaultDays: 90, extendedDays: null }`
- `PlayerAccount` fields (exact 7): `accountId`, `email`, `displayName`,
  `authProvider`, `authProviderId`, `createdAt`, `updatedAt`
- `GuestIdentity` fields (exact 3): `guestSessionId`, `createdAt`,
  `isGuest: true`
- `legendary.*` schema namespace; PKs use `bigserial`; cross-service IDs
  use `ext_id text`
- Migration filenames: `004_create_players_table.sql`,
  `005_create_replay_ownership_table.sql`
- All migration DDL uses `CREATE TABLE IF NOT EXISTS legendary.…`
- `UNIQUE (player_id, replay_hash)` on `legendary.replay_ownership`
- Idempotent insert SQL pattern (verbatim) for `assignReplayOwnership`:
  ```sql
  INSERT INTO legendary.replay_ownership
    (player_id, replay_hash, scenario_key, visibility, expires_at)
  VALUES ($1, $2, $3, 'private', $4)
  ON CONFLICT (player_id, replay_hash)
    DO UPDATE SET visibility = legendary.replay_ownership.visibility
  RETURNING ownership_id, player_id, replay_hash, scenario_key,
            visibility, created_at, expires_at;
  ```
- Structured error shape:
  ```ts
  export type Result<T> =
    | { ok: true; value: T }
    | { ok: false; reason: string; code: IdentityErrorCode };

  export type IdentityErrorCode =
    | 'duplicate_email'
    | 'invalid_email'
    | 'invalid_display_name'
    | 'unknown_account';
  ```
- Email canonicalization: `email.trim().toLowerCase()` on insert AND on
  query
- `displayName` rules: trimmed; length ∈ `[1, 64]`; no newlines / tabs /
  control characters
- `updatedAt` policy: equals `createdAt` at insert time; no DB trigger;
  no mutation function exported in this packet; future identity-mutation
  WPs must set explicitly
- GDPR `deletePlayerData` handoff: returns `{ deletedReplays,
  accountDeleted }` for audit; no queue; no scheduler; no blob purge
  side effect
- Test suite wrapping: each test file uses one top-level `describe()`
  block → server suite total **3 → 5**; server test total **19 → 31**

---

## Guardrails

- Identity never affects gameplay, RNG, scoring, matchmaking, or engine execution
- The game engine must never receive, compute, store, or serialize an
  `AccountId` value
- Identity types live **only** in `apps/server/src/identity/` — never in
  `packages/game-engine/`
- The engine `PlayerId` alias (D-8701) must NOT be imported into any file
  under `apps/server/src/identity/` — these are deliberately separate
  concepts (D-5201)
- `packages/game-engine/src/types.ts` is **not modified** by this packet
- Guest play is fully functional and ungated; local replay export is
  immediate and unconditional
- Guest-to-account migration requires explicit user-initiated replay
  import — never silent server attach
- Replay ownership is metadata only; no UPDATE path may exist for any
  field except `visibility`
- PlayerAccount immutability: after creation, only `updatedAt` may
  change; `accountId`, `email`, `displayName`, `authProvider`,
  `authProviderId`, and `createdAt` must never be mutated
- `updatedAt` is modified only by explicit identity mutation logic; read
  operations must never update identity records; this packet exports no
  such mutation
- `findReplayOwnership` returns ownership metadata only; it must not be
  treated as an authorization or visibility check
- Retention expiration affects storage eligibility only — never replay
  validity or score verification
- Extended retention (Supporter tier) is convenience only, never a
  gameplay advantage
- Adding an `AuthProvider` is a governance event requiring `DECISIONS.md`
  — not a config change
- `node:crypto.randomUUID()` is the **only** UUID source — no fallback
  library, no `Math.random`-derived IDs
- All optional-style fields use `field: T | null` discriminant under
  `exactOptionalPropertyTypes`, never `field?: T`

---

## Required `// why:` Comments

- `AccountId` type:
  - Branding prevents accidental interchange with other strings
  - UUID v4 avoids sequential ID enumeration attacks
  - Renamed from `PlayerId` to avoid collision with engine `PlayerId`
    (D-8701, D-5201)
  - UUID source is `node:crypto.randomUUID()` (no external dep)
- `AuthProvider` type: trust surface; additions require DECISIONS.md entry
- `PlayerIdentity` union: guests are a policy variant, not a degraded account
- `PlayerAccount.email`: stored canonicalized at insert; callers do not
  need to canonicalize before querying
- `ReplayOwnershipRecord.replayHash`: plain `string` (not branded);
  carries the hash from `computeStateHash` (WP-027) which returns
  `string`
- `ReplayOwnershipRecord` immutability: all fields except `visibility`
  are immutable after creation
- `ReplayOwnershipRecord.expiresAt`: storage eligibility only, not
  validity; `string | null` (not `?:`) per `exactOptionalPropertyTypes`
- `assignReplayOwnership`: idempotent to handle network retries safely;
  uses `ON CONFLICT … DO UPDATE SET visibility = visibility` to force
  `RETURNING` on conflict
- `deletePlayerData`: GDPR erasure; blob removal is asynchronous and
  separate (audit count is the only handoff in this packet)
- `listAccountReplays`: read-time expiration enforcement avoids implicit
  background purge jobs
- `findReplayOwnership`: returns metadata only; visibility / access
  enforcement is the caller's responsibility
- Migration `ext_id`: cross-service identifier per
  `00.2-data-requirements.md`; maps 1:1 to `AccountId`
- Migration `player_id` (FK): internal bigint; never exposed at the
  application layer (which uses `accountId: AccountId` instead)

---

## Files to Produce

- `apps/server/src/identity/identity.types.ts` — **new** — `AccountId`,
  `PlayerAccount`, `GuestIdentity`, `PlayerIdentity`, `AuthProvider`,
  `AUTH_PROVIDERS`, `isGuest`, `Result<T>`, `IdentityErrorCode`
- `apps/server/src/identity/replayOwnership.types.ts` — **new** —
  `ReplayVisibility`, `REPLAY_VISIBILITY_VALUES`, `ReplayOwnershipRecord`,
  `ReplayRetentionPolicy`, `DEFAULT_RETENTION_POLICY`
- `apps/server/src/identity/identity.logic.ts` — **new** —
  `createPlayerAccount`, `findPlayerByEmail`, `findPlayerByAccountId`,
  `createGuestIdentity` (parameter `idProvider?: () => string` defaults
  to `randomUUID` from `node:crypto`)
- `apps/server/src/identity/replayOwnership.logic.ts` — **new** —
  `assignReplayOwnership`, `updateReplayVisibility`, `listAccountReplays`,
  `findReplayOwnership`, `deletePlayerData`
- `data/migrations/004_create_players_table.sql` — **new** —
  `legendary.players` (idempotent DDL)
- `data/migrations/005_create_replay_ownership_table.sql` — **new** —
  `legendary.replay_ownership` (idempotent DDL)
- `apps/server/src/identity/identity.logic.test.ts` — **new** — 8 tests
  in **one** `describe('identity logic (WP-052)', ...)` block
- `apps/server/src/identity/replayOwnership.logic.test.ts` — **new** —
  4 tests in **one** `describe('replay ownership logic (WP-052)', ...)` block

---

## Test Plan (Locked)

**Engine baseline must remain `513 / 115 / 0`** (this packet touches no
engine code). **Server baseline post-execution: `31 / 5 / 0`** (or 31
with skips for DB-dependent tests). All skips must use `node:test`'s
`{ skip: 'requires test database' }` so TAP records the skip — silent
omission is a failed execution.

### `identity.logic.test.ts` (8 tests, +1 suite)

1. `createGuestIdentity` produces valid `GuestIdentity` (pure;
   deterministic via injected `idProvider`)
2. `isGuest` discriminant test (pure)
3. `AUTH_PROVIDERS` ↔ `AuthProvider` drift detection (pure)
4. `Object.keys` shape drift for `PlayerAccount` (7 fields) and
   `GuestIdentity` (3 fields) (pure)
5. `createPlayerAccount` returns
   `{ ok: false, code: 'duplicate_email' }` (DB-dependent)
6. `createPlayerAccount` canonicalizes email (DB-dependent)
7. `createPlayerAccount` rejects invalid `displayName`
   (`{ ok: false, code: 'invalid_display_name' }`) (pure)
8. FK invariant: `assignReplayOwnership` returns
   `{ ok: false, code: 'unknown_account' }` for unknown account
   (DB-dependent)

### `replayOwnership.logic.test.ts` (4 tests, +1 suite)

1. `DEFAULT_RETENTION_POLICY.minimumDays === 30` and
   `REPLAY_VISIBILITY_VALUES` ↔ `ReplayVisibility` drift detection
   (pure)
2. `assignReplayOwnership` idempotency — second call returns same
   record unchanged (DB-dependent)
3. `updateReplayVisibility` mutation isolation — only `visibility`
   changes; `Object.keys` and field-by-field equality on immutable
   fields (DB-dependent)
4. `listAccountReplays` excludes expired records (DB-dependent)

---

## After Completing

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (DB tests may skip with reason)
- [ ] Engine: **513 / 115 / 0** (unchanged)
- [ ] Server: **31 / 5 / 0** (or 31 with skips)
- [ ] No identity types leaked into `packages/game-engine/src/`; no
      `boardgame.io`, `@legendary-arena/game-engine`, or `require()`
      in `apps/server/src/identity/` (Select-String confirms all)
- [ ] Migrations use `legendary.*` namespace, `bigserial` PKs,
      `CREATE TABLE IF NOT EXISTS`, `DEFAULT 'private'`,
      `UNIQUE (player_id, replay_hash)`
- [ ] Replay expiration does not invalidate ability to re-execute or
      verify scores
- [ ] `listAccountReplays` excludes records where `expires_at < now()`,
      even if such rows still exist in the database
- [ ] `assignReplayOwnership` uses the locked
      `ON CONFLICT (player_id, replay_hash) DO UPDATE …` pattern
      verbatim
- [ ] `node:crypto.randomUUID` is the production UUID source; tests
      that need determinism inject a stub provider
- [ ] Email canonicalized on every insert and every lookup
- [ ] `displayName` validation enforced (length, controls)
- [ ] `deletePlayerData` returns audit counts and does not enqueue
      blob purge
- [ ] `packages/game-engine/src/types.ts` unmodified (engine `PlayerId`
      per D-8701 is locked)
- [ ] WP-027 and WP-051 contract files unmodified; no files outside
      scope changed (`git diff` confirms)
- [ ] `STATUS.md` updated; `DECISIONS.md` updated (D-5201, D-5202,
      D-5203 already filed pre-execution; per-execution decision noting
      what was locked is added at completion); `WORK_INDEX.md` WP-052
      checked off

---

## Common Failure Smells

- Identity type appears in `packages/game-engine/` → layer boundary violation
- Engine `PlayerId` (from `packages/game-engine/src/types.ts`) imported
  into `apps/server/src/identity/` → cross-layer naming-collision
  violation (D-5201)
- `player_id bigint` exposed in API payloads or outside SQL queries →
  `AccountId` mapping violated; use `ext_id`
- Guest replay appears in `legendary.replay_ownership` without account
  → silent attach; migration must be explicit import
- `updateReplayVisibility` touches fields besides `visibility` →
  ownership immutability violated
- `AUTH_PROVIDERS` array length differs from `AuthProvider` union
  members → drift-detection test missing or broken
- `Object.keys(playerAccount).sort()` does not match the locked 7-field
  list → silent shape drift; the drift test catches this
- PlayerAccount fields updated outside creation flow → identity
  immutability violated
- `Math.random()` or non-`node:crypto` UUID generation → determinism /
  trust violation
- Migration uses `CREATE TABLE` (not `IF NOT EXISTS`) → migration runner
  re-run will fail; FP-3 idempotency precedent violated
- `assignReplayOwnership` uses SELECT-then-INSERT or `DO NOTHING`
  without `RETURNING` workaround → race window or empty `RETURNING`
  result on conflict
- Email stored as supplied (not canonicalized) → mixed-case duplicates;
  `UNIQUE (email)` enforces case-folded uniqueness only if values are
  canonicalized at insert
- `displayName` accepted with newlines, control characters, or empty
  after trim → validation gap
- `expiresAt` typed as `string | undefined` or `expiresAt?: string` →
  `exactOptionalPropertyTypes` violation; must be `string | null`
- DB-dependent test silently omitted (no `{ skip: ... }`) → invariant
  may be unverified; TAP output must record the skip
- `deletePlayerData` enqueues a blob-purge job or scheduler call → out
  of scope; only the audit count handoff is permitted
