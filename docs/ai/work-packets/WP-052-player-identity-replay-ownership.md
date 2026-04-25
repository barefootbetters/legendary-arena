# WP-052 — Player Identity, Replay Ownership & Access Control

**Status:** Ready for Implementation
**Primary Layer:** Server / Identity + Storage
**Version:** 1.2
**Last Updated:** 2026-04-24
**Dependencies:** WP-051, WP-004, WP-027

---

## Session Context

WP-004 established the server bootstrap sequence (registry + rules loaded before
accepting requests). WP-027 established the `ReplayInput` contract, `replayGame`,
and `computeStateHash` — replays are engine-layer data produced by deterministic
re-execution. WP-051 established the PAR gate check at the server layer. This
packet introduces **player identity** and **replay ownership** — defining who a
player is, what identity means in Legendary Arena, and how replays are owned,
retained, and access-controlled. Identity affects *access*, never *outcomes*.
`13-REPLAYS-REFERENCE.md` §Account and Guest Policy and §Privacy and Consent
Controls are the normative governance sources for all decisions in this packet.

---

## Why This Packet Matters

This packet closes the loop on the replay system: every game is now
automatically recorded, deterministically replayable, and **owned by the
player** — either as an immediate local export (guest) or as persistent
server storage (account). It fulfills Vision Goal 18 (Replayability &
Spectation), Goal 19 (AI-Ready Export & Analysis Support), and Goal 24
(Replay-Verified Competitive Integrity) while keeping core gameplay
completely open and ungated.

---

## Goal

Introduce the player identity model and replay ownership contracts. After this
session, Legendary Arena knows *who* a player is and *who owns* each replay:

- `PlayerId` is a branded string type representing a persistent or ephemeral
  player identity
- `PlayerAccount` defines the server-persisted account record (email, OAuth
  binding, creation date)
- `GuestIdentity` defines the ephemeral guest identity model — no server
  persistence, replay-exportable
- `ReplayOwnership` defines who owns a replay and under what retention and
  visibility rules
- `ReplayVisibility` enum (`private` | `link` | `public`) controls sharing,
  defaulting to `private`
- Guest players can play, complete games, and **immediately** export replays
  locally without an account — core gameplay is never gated
- Account players unlock server-side replay persistence, replay library,
  annotations, leaderboard submission, and shareable links
- PostgreSQL schema (`legendary.players`, `legendary.replay_ownership`) is
  defined with migration files
- Identity contracts are immutable once established — no field may be renamed
  or repurposed without a `DECISIONS.md` entry

**Invariant:** Player identity affects access and visibility only.
It must never influence gameplay behavior, RNG, scoring, matchmaking advantage,
or engine execution paths.

**Clarification:** `PlayerId` is distinct from boardgame.io's `playerID`.
`playerID` remains an engine-local turn identifier; `PlayerId` is a server-side
identity used only for access control and replay ownership.

---

## Assumes

- WP-004 complete. Specifically:
  - Server startup sequence exists (`apps/server/src/index.mjs`)
  - PostgreSQL connection is established at startup
  - Migration runner (`data/migrations/`) is operational
- WP-027 complete. Specifically:
  - `ReplayInput` canonical contract exists (seed + setupConfig + playerOrder + moves)
  - `replayGame(input): ReplayResult` exists and is pure
  - `computeStateHash(G)` exists with canonical serialization
  - Replay verification hash is computable from replay data
- WP-051 complete. Specifically:
  - `checkParPublished(scenarioKey)` exists at the server layer
  - Server gate check is operational (competitive submissions gated on PAR)
- `docs/13-REPLAYS-REFERENCE.md` exists (normative governance for identity,
  guest, ownership, and privacy policies)
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists
- `docs/ai/ARCHITECTURE.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — identity
  and replay ownership are **server layer** concerns. The engine must never
  import identity types or check ownership. The engine produces replays; the
  server stores them and enforces access. Read the full Layer Boundary section
  to confirm no cross-layer leakage.
- `docs/ai/ARCHITECTURE.md — "Persistence Boundaries"` — `PlayerAccount` is
  persisted server-side data. `GuestIdentity` is ephemeral runtime state.
  Replay ownership records are Class 2 (Configuration) — safe to persist.
  None of these are `G` or engine runtime state.
- `docs/13-REPLAYS-REFERENCE.md` — read the full document. This is the
  normative governance source for:
  - §Account and Guest Policy — guest vs. account semantics
  - §Privacy and Consent Controls — private by default, explicit opt-in
  - §Storage and Access Architecture — server-side storage, local export
  - §Replay System Invariants — replay immutability enforcement
  - §Community Scoreboard Integration — leaderboard submission requires account
- `docs/ai/REFERENCE/00.2-data-requirements.md §1` — PostgreSQL namespace is
  `legendary.*`, PKs use `bigserial`, cross-service IDs use `ext_id text`.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on identity decisions), Rule 11
  (full-sentence error messages), Rule 13 (ESM only).
- `apps/server/src/index.mjs` — read the server startup sequence to understand
  where identity loading integrates.
- `data/migrations/` — read existing migration files to understand numbering
  and format conventions.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Identity never affects outcomes:** `PlayerId` is used for access control
  and replay ownership — never for game logic, scoring, matchmaking advantage,
  or RNG seeding. The engine must never import or reference identity types.
- **PlayerId mapping:** The server-level `PlayerId` always corresponds to
  `legendary.players.ext_id`. The database primary key (`player_id bigint`)
  must never be exposed or used as an identity outside the database layer.
- **Core gameplay is never gated:** any player — guest or account — may play
  and complete a game without an account. Local replay export is immediate
  and unconditional upon game completion.
- **Guest identities are ephemeral:** no server-side persistence of guest
  sessions. Guest replays are exportable but not server-stored.
- **Guest-to-account migration requires explicit replay import:** guest replays
  are never silently attached to an account server-side. Ownership is
  established only via user-initiated import.
- **Replay immutability is absolute:** ownership records reference replays by
  hash — the server must never modify, repair, or re-serialize replay content.
  Ownership is metadata *about* a replay, not part of the replay itself.
- **Private by default:** all replays default to `ReplayVisibility.private`.
  Public sharing and leaderboard submission require explicit opt-in per
  `13-REPLAYS-REFERENCE.md` §Privacy and Consent Controls.
- **Replay ownership is immutable:** once assigned, ownership cannot be
  transferred, reassigned, or revoked (except by GDPR deletion).
- **PlayerAccount immutability:** for `PlayerAccount`, only `updatedAt` may
  change after creation. All other fields (`playerId`, `email`, `displayName`,
  `authProvider`, `authProviderId`, `createdAt`) are immutable once
  established. No mutation function for these fields is defined in this packet.
- **No UI implementation:** this packet defines data contracts and server
  logic — no frontend, no forms, no OAuth UI flows.
- **No leaderboard logic:** score submission and leaderboard queries are
  WP-054 and WP-055 respectively.
- **Layer boundary:** identity types live in `apps/server/` — never in
  `packages/game-engine/`. The engine does not know about players beyond
  boardgame.io's built-in `playerID` string.
- **30-day minimum retention:** server-stored replays for account holders are
  retained for a minimum of 30 days per `13-REPLAYS-REFERENCE.md` §Storage.
  Extended retention (Supporter tier) is a **convenience only, never a
  gameplay advantage** — per `01-VISION.md` §Financial Sustainability.
- WP-027 contract files must NOT be modified — replay format is locked.
- WP-051 contract files must NOT be modified — PAR gate is locked.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values:**

- **`legendary.*` namespace** (PostgreSQL):
  All tables live in the `legendary.*` schema (e.g., `legendary.players`,
  `legendary.replay_ownership`). PKs use `bigserial`. Cross-service IDs use
  `ext_id text`.

- **ReplayVisibility values:** `'private'` | `'link'` | `'public'`

- **Guest retention policy:** Guests receive **immediate, unconditional**
  one-click local replay export upon game completion. No server-side storage
  of guest replays. Guest-to-account migration preserves locally exported
  replays via import.

- **Account replay retention:** Minimum 30 days server-side. Extended
  retention (Supporter tier) is a **convenience only, never a gameplay
  advantage** — per `01-VISION.md` §Financial Sustainability.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic
reproduction and state inspection. Logging, breakpoints, or "printf debugging"
are not acceptable debugging strategies.

The following requirements are mandatory:

- Behavior introduced by this packet must be fully reproducible given:
  - identical database state
  - identical inputs to any identity or ownership function

- Execution must be externally observable via deterministic state changes.
  Invisible or implicit side effects are not permitted.

- This packet must not introduce any state mutation that:
  - cannot be inspected post-execution, or
  - cannot be validated via tests or database queries.

- The following invariants must always hold after execution:
  - `legendary.players` records are uniquely constrained on email
  - `legendary.replay_ownership` records are uniquely constrained on
    `(player_id, replay_hash)`
  - No orphaned ownership records exist (foreign key enforced)
  - All visibility values are valid enum members

- Failures attributable to this packet must be localizable via:
  - violation of declared invariants, or
  - unexpected mutation of packet-owned state

---

## Scope (In)

### A) `apps/server/src/identity/identity.types.ts` — new

- `PlayerId` is a branded string type
  (e.g., `type PlayerId = string & { readonly __brand: 'PlayerId' }`) —
  server-assigned UUID v4
  - `// why:` branding prevents accidental interchange with other string
    identifiers at compile time
  - `// why:` UUID v4 avoids sequential ID enumeration attacks
- `interface PlayerAccount { playerId: PlayerId; email: string; displayName: string; authProvider: AuthProvider; authProviderId: string; createdAt: string; updatedAt: string }`
  - `// why:` comment: `authProviderId` is the external IdP subject identifier,
    not a password — passwords are never stored
- `type AuthProvider = 'email' | 'google' | 'discord'`
  - `// why:` comment: AuthProvider values are part of the identity trust
    surface; adding a provider requires a DECISIONS.md entry, not a config
    change
- `AUTH_PROVIDERS: readonly AuthProvider[]` — canonical array with
  drift-detection test
- `interface GuestIdentity { guestSessionId: string; createdAt: string; isGuest: true }`
  - `// why:` comment: `isGuest` discriminant enables type narrowing;
    `guestSessionId` is ephemeral and never persisted
- `type PlayerIdentity = PlayerAccount | GuestIdentity`
  - `// why:` comment: discriminated union — guests are a policy variant of
    identity, not a degraded account
- `isGuest(identity: PlayerIdentity): identity is GuestIdentity` — type guard

### B) `apps/server/src/identity/replayOwnership.types.ts` — new

- `type ReplayVisibility = 'private' | 'link' | 'public'`
- `REPLAY_VISIBILITY_VALUES: readonly ReplayVisibility[]` — canonical array
  with drift-detection test
- `interface ReplayOwnershipRecord { ownershipId: number; playerId: PlayerId; replayHash: string; scenarioKey: string; visibility: ReplayVisibility; createdAt: string; expiresAt: string | null }`
  - `// why:` comment: `expiresAt` is null for indefinite retention (supporter
    tier); non-null means server may purge after this date
  - `// why:` comment: `replayHash` is the cryptographic hash from WP-027's
    `computeStateHash` — ownership references the hash, never the replay blob
  - `// why:` comment: all ownership fields except `visibility` are immutable
    after creation; mutating ownership metadata would undermine replay
    immutability guarantees
  - `// why:` comment: retention expiration affects storage eligibility only;
    it does not affect replay validity, score verification, or historical
    auditability
- `interface ReplayRetentionPolicy { minimumDays: number; defaultDays: number; extendedDays: number | null }`
  - `// why:` comment: `minimumDays` is 30 per 13-REPLAYS-REFERENCE.md §Storage
- `DEFAULT_RETENTION_POLICY: ReplayRetentionPolicy` — locked value:
  `{ minimumDays: 30, defaultDays: 90, extendedDays: null }`

### C) `apps/server/src/identity/identity.logic.ts` — new

- `createPlayerAccount(email: string, displayName: string, authProvider: AuthProvider, authProviderId: string, database: DatabaseClient): Promise<PlayerAccount>`
  — inserts into `legendary.players`, returns the created record
  - Returns structured error if email already exists — never throws
  - `// why:` comment: email uniqueness enforced at DB level (unique constraint),
    not application level
  - `updatedAt` is modified only on explicit identity mutations (none defined
    in this packet); read access must never mutate identity records

- `findPlayerByEmail(email: string, database: DatabaseClient): Promise<PlayerAccount | null>`
  — looks up by email, returns null if not found

- `findPlayerById(playerId: PlayerId, database: DatabaseClient): Promise<PlayerAccount | null>`
  — looks up by ID, returns null if not found

- `createGuestIdentity(): GuestIdentity`
  — creates an ephemeral guest identity with a UUID v4 session ID
  - Pure function — no database access
  - `// why:` comment: guest sessions are runtime-only, never persisted

### D) `apps/server/src/identity/replayOwnership.logic.ts` — new

- `assignReplayOwnership(playerId: PlayerId, replayHash: string, scenarioKey: string, database: DatabaseClient): Promise<ReplayOwnershipRecord>`
  — inserts ownership record with `visibility: 'private'` and computed
  `expiresAt` from `DEFAULT_RETENTION_POLICY`
  - Idempotent: if `(playerId, replayHash)` already exists, returns existing
    record unchanged
  - `// why:` comment: idempotent to handle network retries safely

- `updateReplayVisibility(ownershipId: number, visibility: ReplayVisibility, database: DatabaseClient): Promise<ReplayOwnershipRecord | null>`
  — updates visibility, returns null if ownership record not found
  - `// why:` comment: visibility is the only mutable field on ownership —
    all other fields are immutable after creation

- `listPlayerReplays(playerId: PlayerId, database: DatabaseClient): Promise<ReplayOwnershipRecord[]>`
  — returns all non-expired ownership records for a player, ordered by
  `createdAt` descending
  - Expiration is enforced at read time: records with `expiresAt < now()` must
    be excluded even if still present in the database
  - `// why:` read-time enforcement avoids implicit background purge jobs and
    keeps deletion semantics observable from the query layer

- `findReplayOwnership(replayHash: string, database: DatabaseClient): Promise<ReplayOwnershipRecord | null>`
  — looks up ownership by replay hash
  - Returns ownership metadata only; callers are responsible for enforcing
    visibility and access checks
  - `// why:` keeps identity strictly an access-input layer; embedding
    visibility checks here would couple lookup to policy and risk leaks at
    other call sites

- `deletePlayerData(playerId: PlayerId, database: DatabaseClient): Promise<{ deletedReplays: number; accountDeleted: boolean }>`
  — GDPR-compliant deletion: removes all ownership records and the player
  account. Returns counts for audit logging.
  - `// why:` comment: GDPR Article 17 right to erasure — deletes ownership
    metadata and account identity; replay blob removal is handled separately
    and asynchronously, preserving auditability and avoiding partial failures
    inside identity workflows

### E) Database migrations — new

- `data/migrations/NNN_create_players_table.sql`:
  ```sql
  CREATE TABLE legendary.players (
    player_id    bigserial    PRIMARY KEY,
    ext_id       text         NOT NULL UNIQUE,  -- UUID v4, used as PlayerId
    email        text         NOT NULL UNIQUE,
    display_name text         NOT NULL,
    auth_provider text        NOT NULL,
    auth_provider_id text     NOT NULL,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now()
  );
  ```
  - `// why:` comment in migration: `ext_id` is the cross-service identifier
    per `00.2-data-requirements.md`; `bigserial` PK per convention

- `data/migrations/NNN_create_replay_ownership_table.sql`:
  ```sql
  CREATE TABLE legendary.replay_ownership (
    ownership_id  bigserial    PRIMARY KEY,
    player_id     bigint       NOT NULL REFERENCES legendary.players(player_id),
    replay_hash   text         NOT NULL,
    scenario_key  text         NOT NULL,
    visibility    text         NOT NULL DEFAULT 'private',
    created_at    timestamptz  NOT NULL DEFAULT now(),
    expires_at    timestamptz,
    UNIQUE (player_id, replay_hash)
  );
  ```
  - `// why:` comment: `UNIQUE (player_id, replay_hash)` enforces idempotent
    ownership assignment; `visibility` defaults to `'private'` per
    13-REPLAYS-REFERENCE.md §Privacy

### F) Tests — `apps/server/src/identity/identity.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No boardgame.io import.

- Eight tests:
  1. `createGuestIdentity` produces a valid `GuestIdentity` with `isGuest: true`
  2. `isGuest` returns true for guest identity, false for account identity
  3. `AUTH_PROVIDERS` array matches `AuthProvider` union (drift detection)
  4. `REPLAY_VISIBILITY_VALUES` array matches `ReplayVisibility` union (drift detection)
  5. `createPlayerAccount` returns structured error on duplicate email
     (requires test database)
  6. `assignReplayOwnership` is idempotent — second call returns same record
     (requires test database)
  7. `updateReplayVisibility` changes only visibility, preserves all other fields
     (requires test database)
  8. `deletePlayerData` removes all ownership records and account
     (requires test database)

- Tests 5–8 require a test PostgreSQL database. If unavailable, they must be
  marked with `{ skip: 'requires test database' }` — never silently omitted.

### G) Tests — `apps/server/src/identity/replayOwnership.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No boardgame.io import.

- Four tests:
  1. `DEFAULT_RETENTION_POLICY.minimumDays` equals 30
  2. New ownership records default to `visibility: 'private'`
  3. `expiresAt` is computed from `DEFAULT_RETENTION_POLICY.defaultDays`
  4. `listPlayerReplays` excludes expired records

---

## Out of Scope

- **No OAuth UI flows** — OAuth redirect handling, token exchange, and session
  management are future work. This packet defines the account model, not the
  login UX.
- **No leaderboard submission** — that is WP-054
- **No public leaderboard queries** — that is WP-055
- **No replay blob storage** — this packet defines ownership metadata. Replay
  blob storage (object storage integration) is an implementation detail
  handled by the server layer independently.
- **No replay format changes** — WP-027 replay format is locked
- **No engine modifications** — identity is server-only; the engine must not
  change
- **No scoring logic** — WP-048 scoring contracts are locked
- **No PAR gate changes** — WP-051 gate check is locked
- **No supporter tier implementation** — extended retention is modeled in the
  type system (`extendedDays`) but not enforced. Tier logic is future work.
  When implemented, it must remain a convenience only, never a gameplay
  advantage (per `01-VISION.md` §Financial Sustainability).
- **No email verification** — account creation accepts email; verification
  flow is future work
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/server/src/identity/identity.types.ts` — **new** — PlayerId,
  PlayerAccount, GuestIdentity, PlayerIdentity, AuthProvider, AUTH_PROVIDERS
- `apps/server/src/identity/replayOwnership.types.ts` — **new** —
  ReplayVisibility, REPLAY_VISIBILITY_VALUES, ReplayOwnershipRecord,
  ReplayRetentionPolicy, DEFAULT_RETENTION_POLICY
- `apps/server/src/identity/identity.logic.ts` — **new** —
  createPlayerAccount, findPlayerByEmail, findPlayerById, createGuestIdentity
- `apps/server/src/identity/replayOwnership.logic.ts` — **new** —
  assignReplayOwnership, updateReplayVisibility, listPlayerReplays,
  findReplayOwnership, deletePlayerData
- `data/migrations/NNN_create_players_table.sql` — **new** —
  legendary.players table
- `data/migrations/NNN_create_replay_ownership_table.sql` — **new** —
  legendary.replay_ownership table
- `apps/server/src/identity/identity.logic.test.ts` — **new** —
  `node:test` coverage (8 tests)
- `apps/server/src/identity/replayOwnership.logic.test.ts` — **new** —
  `node:test` coverage (4 tests)

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Identity Model
- [ ] `PlayerId` is a branded string type (not a plain `string`)
- [ ] `PlayerAccount` has exactly 7 fields: `playerId`, `email`,
      `displayName`, `authProvider`, `authProviderId`, `createdAt`, `updatedAt`
- [ ] `AuthProvider` is `'email' | 'google' | 'discord'` — no other values
- [ ] `GuestIdentity` has exactly 3 fields: `guestSessionId`, `createdAt`,
      `isGuest`
- [ ] `isGuest` discriminant enables type narrowing on `PlayerIdentity`
- [ ] `createGuestIdentity` is a pure function — no database access

### Replay Ownership
- [ ] `ReplayVisibility` is `'private' | 'link' | 'public'` — no other values
- [ ] New ownership records default to `visibility: 'private'`
- [ ] `assignReplayOwnership` is idempotent on `(playerId, replayHash)`
- [ ] `updateReplayVisibility` changes only `visibility` — all other fields
      remain immutable
- [ ] No field of `ReplayOwnershipRecord` except `visibility` can be updated
      after creation (enforced by logic — no UPDATE function touches other fields)
- [ ] `DEFAULT_RETENTION_POLICY.minimumDays` equals 30
- [ ] `expiresAt` is computed from retention policy at creation time
- [ ] `deletePlayerData` removes all ownership records and the account

### Guest Policy
- [ ] Guest identity creation requires no database access
- [ ] Guest identity is never persisted server-side
- [ ] No account is required to play or export replays

### Database
- [ ] `legendary.players` table uses `bigserial` PK, `ext_id text UNIQUE`,
      `email text UNIQUE`
- [ ] `legendary.replay_ownership` table has `UNIQUE (player_id, replay_hash)`
- [ ] `replay_ownership.visibility` defaults to `'private'`
- [ ] `replay_ownership.player_id` has foreign key to `legendary.players`
- [ ] Migration files follow existing numbering convention

### Drift Detection
- [ ] `AUTH_PROVIDERS` array matches `AuthProvider` union
- [ ] `REPLAY_VISIBILITY_VALUES` array matches `ReplayVisibility` union
- [ ] Drift-detection tests assert both

### Layer Boundary
- [ ] No identity types in `packages/game-engine/`
      (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in identity files
      (confirmed with `Select-String`)
- [ ] No `game-engine` import in identity files
      (confirmed with `Select-String`)
- [ ] Identity logic does not import or reference `G`, `ctx`, or engine
      runtime types

### Tests
- [ ] All 12 tests pass (or database-dependent tests are marked `skip` with
      reason)
- [ ] Test files use `.test.ts` extension
- [ ] Tests use `node:test` and `node:assert` only
- [ ] No boardgame.io import in test files

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm test
# Expected: TAP output — all tests passing (or DB tests skipped with reason)

# Step 3 — confirm no identity types leaked into game-engine
Select-String -Path "packages\game-engine\src" -Pattern "PlayerId|PlayerAccount|GuestIdentity|ReplayOwnership|ReplayVisibility" -Recurse
# Expected: no output

# Step 4 — confirm no boardgame.io import in identity files
Select-String -Path "apps\server\src\identity" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 5 — confirm no game-engine import in identity files
Select-String -Path "apps\server\src\identity" -Pattern "@legendary-arena/game-engine" -Recurse
# Expected: no output

# Step 6 — confirm no require() in identity files
Select-String -Path "apps\server\src\identity" -Pattern "require\(" -Recurse
# Expected: no output

# Step 7 — confirm visibility default in migration
Select-String -Path "data\migrations" -Pattern "DEFAULT 'private'"
# Expected: at least one match in replay_ownership migration

# Step 8 — confirm unique constraints in migrations
Select-String -Path "data\migrations" -Pattern "UNIQUE"
# Expected: matches for (ext_id), (email), and (player_id, replay_hash)

# Step 9 — confirm legendary.* namespace
Select-String -Path "data\migrations" -Pattern "CREATE TABLE legendary\."
# Expected: matches for legendary.players and legendary.replay_ownership

# Step 10 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (all test files; DB tests may skip with reason)
- [ ] No identity types in `packages/game-engine/`
      (confirmed with `Select-String`)
- [ ] No boardgame.io import in identity files
      (confirmed with `Select-String`)
- [ ] No game-engine import in identity files
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] WP-027 contract files not modified (confirmed with `git diff`)
- [ ] WP-051 contract files not modified (confirmed with `git diff`)
- [ ] Migration files use `legendary.*` namespace and `bigserial` PKs
- [ ] `docs/ai/STATUS.md` updated — player identity model and replay ownership
      contracts now exist; guests can play without accounts; replay visibility
      defaults to private
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why UUID v4 for PlayerId;
      why guest identity is ephemeral (not a degraded account); why replay
      ownership is immutable; why visibility defaults to private; why 30-day
      minimum retention; why identity is server-only (never in engine); why
      GDPR deletion removes ownership metadata but replay blob purge is separate
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-052 checked off with today's date
