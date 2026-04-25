# WP-052 — Player Identity, Replay Ownership & Access Control

**Status:** Ready for Implementation (Pre-Flight Re-Confirmed 2026-04-25)
**Primary Layer:** Server / Identity + Storage
**Version:** 1.3
**Last Updated:** 2026-04-25
**Dependencies:** WP-051, WP-004, WP-027

**Amendment history:**
- 2026-04-24 — v1.2 — initial pre-flight draft.
- 2026-04-25 — v1.3 — pre-flight resolution bundle:
  - PS-1: `## Vision Alignment` block added (was missing; §17.1 triggers).
  - PS-2: server-side identity type renamed `PlayerId` → `AccountId` and
    field `playerId` → `accountId` throughout, to resolve collision with
    engine `PlayerId` per D-8701 (D-5201).
  - PS-3: `apps/server/src/identity/` classification recorded (D-5202).
  - PS-4: persistence taxonomy reframed — identity records are
    server-persisted player-scoped bookkeeping, distinct from Class 2
    match-scoped configuration (D-5203).
  - PS-5: test suite-count delta locked to +2 (`describe()` per file).
  - PS-6: `assignReplayOwnership` idempotent SQL pattern locked.
  - PS-7: UUID v4 source locked to `node:crypto.randomUUID()`.
  - PS-8: migration idempotency locked (`CREATE TABLE IF NOT EXISTS`).
  - PS-9: email canonicalization locked (lowercase-on-insert).
  - PS-10: `displayName` length / charset constraints locked.
  - PS-11: `updatedAt` mutation policy locked.
  - PS-12: GDPR `deletePlayerData` blob-purge handoff scope locked.

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

## Vision Alignment

**Vision clauses touched:** `§3 (Player Trust & Fairness), §11 (Stateless
Client Philosophy), §18 (Replayability & Spectation), §19 (AI-Ready Export
& Analysis Support), §22 (Deterministic & Reproducible Evaluation), §24
(Replay-Verified Competitive Integrity), NG-1 (Pay-to-Win), NG-3 (Content
Withheld for Competitive Advantage), Financial Sustainability covenant`.

**Conflict assertion:** **No conflict: this WP preserves all touched clauses.**

- §3 / §18 / §22 / §24: identity affects access only — replay content,
  the replay hash from `computeStateHash` (WP-027), and the engine's
  determinism guarantees are untouched. Ownership records reference the
  hash; they never modify replay data.
- §11: identity logic is server-authoritative. Clients carry no identity
  state beyond their own session credentials. No identity computation
  occurs client-side.
- §19: structured replay export remains available to every player —
  guest and account alike — and is not gated on account creation.
- NG-1 / NG-3: extended retention (Supporter tier) is modeled in the
  type system (`extendedDays`) but is a **convenience only, never a
  gameplay advantage**. No mechanic, score, RNG seed, matchmaking
  consideration, or competitive surface depends on retention class.
- Financial Sustainability covenant: extended retention is a
  presentation / participation feature consistent with the covenant's
  monetization boundary — distribution, access, presentation,
  participation. It does not gate gameplay or scoring.

**Non-Goal proximity check:** This WP touches identity, accounts, retention
tiers, and competitive submission gating. Explicit confirmation that none
of NG-1..NG-7 are crossed:

- NG-1 (Pay-to-Win): not crossed — retention class never affects
  gameplay, scoring, or competitive ranking.
- NG-2 (Gacha): not crossed — no randomized purchases.
- NG-3 (Content Withheld): not crossed — no heroes / masterminds /
  villains gated by account or tier.
- NG-4 (Energy / Timers): not crossed — no play-rate gating.
- NG-5 (Ads): not crossed — no advertising surface introduced.
- NG-6 (Dark Patterns): not crossed — private-by-default visibility
  enforces the safer default; opt-in is explicit.
- NG-7 (Apologetic Monetization): not crossed — extended retention is
  trivially explainable as a storage-cost feature.

**Determinism preservation:** N/A for engine determinism — identity is
server-layer access control and does not enter `G`, `ctx`, RNG, or
scoring. Replay determinism (engine-level, Vision §22) is preserved by
construction: ownership references the cryptographic hash from WP-027's
`computeStateHash` and never mutates replay content. Server re-execution
of replays for verification (per `13-REPLAYS-REFERENCE.md` §Community
Scoreboard Integration) is unaffected by this packet.

---

## Goal

Introduce the player identity model and replay ownership contracts. After this
session, Legendary Arena knows *who* a player is and *who owns* each replay:

- `AccountId` is a branded string type representing a persistent
  authenticated account identity. Renamed from a draft-time `PlayerId` to
  resolve collision with the engine's seat-string `PlayerId` (D-8701) —
  see D-5201.
- `PlayerAccount` defines the server-persisted account record (email, OAuth
  binding, creation date)
- `GuestIdentity` defines the ephemeral guest identity model — no server
  persistence, replay-exportable. Guests have a `guestSessionId`, not an
  `AccountId`.
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

**Naming clarification:** Three different identifiers are at play and must
not be confused:

| Identifier | Layer | Type | Semantic |
|---|---|---|---|
| `playerID` (lowercase, boardgame.io) | Engine (framework) | `string` ("0", "1", ...) | Per-match seat index |
| `PlayerId` (engine) per D-8701 | Engine | `string` (alias) | Per-match seat alias for `Record<PlayerId, ...>` keys |
| `AccountId` (this WP) | Server | `string & { readonly __brand: 'AccountId' }` | Cross-match persistent account identity (UUID v4, ext_id) |

The engine never imports or computes an `AccountId`. The server never
treats `playerID` / engine `PlayerId` as cross-match identity.

---

## Assumes

- WP-004 complete. Specifically:
  - Server startup sequence exists at `apps/server/src/server.mjs`
    (`apps/server/src/index.mjs` is the SIGTERM/process entrypoint only)
  - PostgreSQL connection is established at startup
  - Migration runner (`data/migrations/`) is operational
- WP-027 complete. Specifically:
  - `ReplayInput` canonical contract exists (seed + setupConfig + playerOrder + moves)
  - `replayGame(input): ReplayResult` exists and is pure
  - `computeStateHash(G): string` exists with canonical serialization
  - Replay verification hash is computable from replay data
- WP-051 complete. Specifically:
  - `checkParPublished(scenarioKey)` exists at the server layer
  - Server gate check is operational (competitive submissions gated on PAR)
- `docs/13-REPLAYS-REFERENCE.md` exists (normative governance for identity,
  guest, ownership, and privacy policies)
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `pnpm --filter @legendary-arena/server test` exits 0 with **19 tests, 3 suites,
  0 fail** (locked baseline at WP-052 entry)
- `docs/ai/DECISIONS.md` exists and contains D-8701 (engine `PlayerId` alias)
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
- `docs/ai/ARCHITECTURE.md — "Persistence Boundaries"` and
  `.claude/rules/persistence.md` — `PlayerAccount` and `ReplayOwnershipRecord`
  are **server-persisted player-scoped bookkeeping** per D-5203. They are
  not Class 1 (runtime) — never enter `G`/`ctx`. They are also not Class 2
  (configuration) in the strict sense — Class 2 is match-scoped (per
  `persistence.md`: `MatchSetupConfig`, player names, match `createdAt`).
  Identity records form their own classification: durable, server-managed,
  player-scoped, never inputs to a single match.
- `docs/ai/DECISIONS.md` — **D-8701 (engine `PlayerId` alias)**, **D-5201
  (server `AccountId` rename)**, **D-5202 (server identity directory
  classification)**, **D-5203 (identity persistence taxonomy)** are
  authoritative. Read all four before opening any file.
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
- `apps/server/src/server.mjs` — read the server startup sequence to understand
  where identity loading integrates.
- `apps/server/src/par/parGate.mjs` — read for the established
  caller-injected dependency pattern (database client, base path, version)
  that this WP mirrors.
- `data/migrations/` — read existing migration files (`001`..`003`) to
  understand numbering and format conventions.
- `packages/game-engine/src/types.ts` lines 345–352 — read D-8701's
  rationale for the engine `PlayerId` alias. The server `AccountId`
  introduced here is deliberately a different concept; reading the engine
  alias prevents accidental conflation.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only (engine);
  this packet does not introduce randomness into `G`
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  `node:crypto`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Identity never affects outcomes:** `AccountId` is used for access control
  and replay ownership — never for game logic, scoring, matchmaking advantage,
  or RNG seeding. The engine must never import or reference identity types.
- **`AccountId` mapping:** The server-level `AccountId` always corresponds to
  `legendary.players.ext_id`. The database primary key (`player_id bigint`)
  must never be exposed or used as an identity outside the database layer.
- **`AccountId` distinct from engine `PlayerId`:** D-8701 defines an engine-side
  `PlayerId` alias (`string`, boardgame.io seat). `AccountId` is a server-side
  branded UUID v4. The two are deliberately separate types living in
  different layers; no cross-layer import is permitted (D-5201).
- **UUID v4 source locked:** all UUIDs (`AccountId` ext_id, `guestSessionId`)
  are generated via `randomUUID` from `node:crypto`. No external library, no
  fallback. Deterministic in test paths via dependency-injected provider
  (see §Scope C).
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
  change after creation. All other fields (`accountId`, `email`, `displayName`,
  `authProvider`, `authProviderId`, `createdAt`) are immutable once
  established. No mutation function for these fields is defined in this packet.
- **`updatedAt` policy:** at insert time, `updated_at` equals `created_at`
  (both default to `now()` at the database level). No DB trigger updates
  `updated_at`; application code must set it explicitly on any future
  identity mutation. Read operations must never update identity records.
  No mutation function is exported from this packet, so `updated_at` will
  always equal `created_at` for records created here — the column exists
  only to support future identity-mutation WPs.
- **Email canonicalization:** `createPlayerAccount` lowercases and trims
  `email` before insertion (`email.trim().toLowerCase()`). The
  `legendary.players.email UNIQUE` constraint then enforces case-folded
  uniqueness. Querying functions (`findPlayerByEmail`) apply the same
  canonicalization to the input.
- **`displayName` constraints:** trimmed before insertion. Length must be
  in `[1, 64]` characters after trimming. Newlines, tabs, and control
  characters are rejected. The migration column remains `text NOT NULL`;
  application-layer validation enforces these rules.
- **No UI implementation:** this packet defines data contracts and server
  logic — no frontend, no forms, no OAuth UI flows.
- **No leaderboard logic:** score submission and leaderboard queries are
  WP-054 and WP-055 respectively.
- **Layer boundary:** identity types live in `apps/server/src/identity/` —
  never in `packages/game-engine/`. The engine does not know about players
  beyond boardgame.io's built-in `playerID` and the engine `PlayerId` seat
  alias (D-8701).
- **30-day minimum retention:** server-stored replays for account holders are
  retained for a minimum of 30 days per `13-REPLAYS-REFERENCE.md` §Storage.
  Extended retention (Supporter tier) is a **convenience only, never a
  gameplay advantage** — per `01-VISION.md` §Financial Sustainability.
- **GDPR `deletePlayerData` blob handoff:** this packet handles identity
  metadata only (account row + ownership rows). Replay blob removal is
  out of scope. The function returns `{ deletedReplays, accountDeleted }`
  for audit logging. **No queue is enqueued, no scheduler is invoked.**
  A future WP will introduce blob purge against the audit count. This
  packet does not depend on any blob-purge infrastructure (D-5207 to be
  filed when blob purge is scoped).
- WP-027 contract files must NOT be modified — replay format is locked.
- WP-051 contract files must NOT be modified — PAR gate is locked.
- `packages/game-engine/src/types.ts` must NOT be modified — engine
  `PlayerId` per D-8701 is locked.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths.

**Locked contract values:**

- **`legendary.*` namespace** (PostgreSQL):
  All tables live in the `legendary.*` schema (e.g., `legendary.players`,
  `legendary.replay_ownership`). PKs use `bigserial`. Cross-service IDs use
  `ext_id text`.

- **Migration numbers locked:**
  - `data/migrations/004_create_players_table.sql`
  - `data/migrations/005_create_replay_ownership_table.sql`

- **Migration idempotency locked:** all DDL uses `CREATE TABLE IF NOT EXISTS`
  and any seed-style insert (none in this packet) would use `ON CONFLICT
  DO NOTHING` per Foundation Prompt 02 / FP-3 precedent.

- **`AccountId`:** branded string type
  `string & { readonly __brand: 'AccountId' }`. Generated via
  `node:crypto.randomUUID()`. Immutable after creation. Maps to
  `legendary.players.ext_id`.

- **`AuthProvider` values:** `'email'` | `'google'` | `'discord'`. Canonical
  array `AUTH_PROVIDERS: readonly AuthProvider[]`. Drift-detection test
  required.

- **`ReplayVisibility` values:** `'private'` | `'link'` | `'public'`.
  Canonical array `REPLAY_VISIBILITY_VALUES: readonly ReplayVisibility[]`.
  Drift-detection test required.

- **Guest retention policy:** Guests receive **immediate, unconditional**
  one-click local replay export upon game completion. No server-side storage
  of guest replays. Guest-to-account migration preserves locally exported
  replays via import.

- **Account replay retention:** Minimum 30 days server-side. Extended
  retention (Supporter tier) is a **convenience only, never a gameplay
  advantage** — per `01-VISION.md` §Financial Sustainability.

- **`DEFAULT_RETENTION_POLICY`:**
  `{ minimumDays: 30, defaultDays: 90, extendedDays: null }`.

- **`assignReplayOwnership` idempotency SQL pattern (locked, PS-6):**
  ```sql
  INSERT INTO legendary.replay_ownership
    (player_id, replay_hash, scenario_key, visibility, expires_at)
  VALUES ($1, $2, $3, 'private', $4)
  ON CONFLICT (player_id, replay_hash)
    DO UPDATE SET visibility = legendary.replay_ownership.visibility
  RETURNING ownership_id, player_id, replay_hash, scenario_key,
            visibility, created_at, expires_at;
  ```
  The `DO UPDATE SET visibility = legendary.replay_ownership.visibility`
  is a no-op self-assignment that forces `RETURNING` to emit the existing
  row's columns on conflict (PostgreSQL `RETURNING` does not emit rows
  on `DO NOTHING`). This is atomic and race-safe.

- **Structured error shape (locked, FIX from copilot #22/#29):**
  identity functions that may fail due to caller error return
  `Result<T>` discriminated union:
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
  The `reason` is a full-sentence message per code-style Rule 11. The
  `code` enables programmatic dispatch without parsing prose. Functions
  that cannot fail (`createGuestIdentity`, type guards, drift checks)
  return their value directly without wrapping.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic
reproduction and state inspection. Logging, breakpoints, or "printf debugging"
are not acceptable debugging strategies.

The following requirements are mandatory:

- Behavior introduced by this packet must be fully reproducible given:
  - identical database state
  - identical inputs to any identity or ownership function
  - identical injected `randomUUID` provider in tests (default:
    `node:crypto.randomUUID`)

- Execution must be externally observable via deterministic state changes.
  Invisible or implicit side effects are not permitted.

- This packet must not introduce any state mutation that:
  - cannot be inspected post-execution, or
  - cannot be validated via tests or database queries.

- The following invariants must always hold after execution:
  - `legendary.players` records are uniquely constrained on email
    (after canonicalization)
  - `legendary.replay_ownership` records are uniquely constrained on
    `(player_id, replay_hash)`
  - No orphaned ownership records exist (foreign key enforced)
  - All visibility values are valid enum members
  - All `AccountId` values match the UUID v4 string shape

- Failures attributable to this packet must be localizable via:
  - violation of declared invariants, or
  - unexpected mutation of packet-owned state

---

## Scope (In)

### A) `apps/server/src/identity/identity.types.ts` — new

- `AccountId` is a branded string type
  `type AccountId = string & { readonly __brand: 'AccountId' }` —
  server-assigned UUID v4
  - `// why:` branding prevents accidental interchange with other string
    identifiers at compile time. Renamed from a draft-time `PlayerId` to
    avoid collision with the engine `PlayerId` alias per D-8701 (D-5201).
  - `// why:` UUID v4 avoids sequential ID enumeration attacks and is
    sourced from `node:crypto.randomUUID()` per locked contract value.
- `interface PlayerAccount { accountId: AccountId; email: string; displayName: string; authProvider: AuthProvider; authProviderId: string; createdAt: string; updatedAt: string }`
  - `// why:` `authProviderId` is the external IdP subject identifier,
    not a password — passwords are never stored.
  - `// why:` `email` is stored in canonical lowercase form; callers do
    not need to canonicalize before querying.
- `type AuthProvider = 'email' | 'google' | 'discord'`
  - `// why:` `AuthProvider` values are part of the identity trust
    surface; adding a provider requires a DECISIONS.md entry, not a
    config change.
- `AUTH_PROVIDERS: readonly AuthProvider[]` — canonical array with
  drift-detection test
- `interface GuestIdentity { guestSessionId: string; createdAt: string; isGuest: true }`
  - `// why:` `isGuest` discriminant enables type narrowing;
    `guestSessionId` is ephemeral and never persisted.
- `type PlayerIdentity = PlayerAccount | GuestIdentity`
  - `// why:` discriminated union — guests are a policy variant of
    identity, not a degraded account.
- `isGuest(identity: PlayerIdentity): identity is GuestIdentity` — type guard
- `Result<T>` discriminated union and `IdentityErrorCode` union per the
  locked structured error shape.

### B) `apps/server/src/identity/replayOwnership.types.ts` — new

- `type ReplayVisibility = 'private' | 'link' | 'public'`
- `REPLAY_VISIBILITY_VALUES: readonly ReplayVisibility[]` — canonical array
  with drift-detection test
- `interface ReplayOwnershipRecord { ownershipId: number; accountId: AccountId; replayHash: string; scenarioKey: string; visibility: ReplayVisibility; createdAt: string; expiresAt: string | null }`
  - `// why:` `replayHash` is a plain `string` (not branded). It carries
    the cryptographic hash from WP-027's `computeStateHash`, which
    returns `string`. A future WP may brand this hash; no branding is
    introduced here to avoid premature widening.
  - `// why:` `expiresAt` is `string | null` (not optional `?:`) per
    `exactOptionalPropertyTypes`. `null` means "indefinite retention"
    (Supporter tier); a non-null ISO-8601 timestamp means the server
    may purge after this date.
  - `// why:` `replayHash` ownership references the cryptographic hash
    from WP-027's `computeStateHash` — ownership references the hash,
    never the replay blob.
  - `// why:` all ownership fields except `visibility` are immutable
    after creation; mutating ownership metadata would undermine replay
    immutability guarantees.
  - `// why:` retention expiration affects storage eligibility only;
    it does not affect replay validity, score verification, or
    historical auditability.
- `interface ReplayRetentionPolicy { minimumDays: number; defaultDays: number; extendedDays: number | null }`
  - `// why:` `minimumDays` is 30 per 13-REPLAYS-REFERENCE.md §Storage.
- `DEFAULT_RETENTION_POLICY: ReplayRetentionPolicy` — locked value:
  `{ minimumDays: 30, defaultDays: 90, extendedDays: null }`.

### C) `apps/server/src/identity/identity.logic.ts` — new

All exports take a `DatabaseClient` parameter (caller-injected, mirrors
WP-051's PAR gate pattern). UUID generation is also caller-injected via
an optional `idProvider: () => string` defaulting to `node:crypto.randomUUID`
— this allows deterministic test fixtures while keeping production paths
on the locked source.

- `createPlayerAccount(input: { email: string; displayName: string; authProvider: AuthProvider; authProviderId: string }, database: DatabaseClient, idProvider?: () => string): Promise<Result<PlayerAccount>>`
  — canonicalizes `email` (trim + lowercase) and `displayName` (trim);
  validates `displayName` length ∈ `[1, 64]` and rejects control
  characters; generates `accountId` via `idProvider ?? randomUUID`;
  inserts into `legendary.players`; returns the created record.
  - Returns `{ ok: false, code: 'duplicate_email', reason: ... }` if
    email already exists (mapped from PostgreSQL unique-violation
    `code: '23505'`) — never throws.
  - Returns `{ ok: false, code: 'invalid_email' | 'invalid_display_name', ... }`
    on validation failure — never throws.
  - `// why:` email uniqueness enforced at DB level (unique constraint
    on canonicalized form), not application level.
  - `updatedAt` is set to the same value as `createdAt` at insert time;
    no future mutation occurs in this packet.

- `findPlayerByEmail(email: string, database: DatabaseClient): Promise<PlayerAccount | null>`
  — canonicalizes `email` (trim + lowercase); looks up by email; returns
  `null` if not found. Pure read; never mutates.

- `findPlayerByAccountId(accountId: AccountId, database: DatabaseClient): Promise<PlayerAccount | null>`
  — looks up by `ext_id`; returns `null` if not found. Pure read; never
  mutates. Renamed from draft `findPlayerById` for parameter clarity
  (PS-2 / D-5201).

- `createGuestIdentity(idProvider?: () => string): GuestIdentity`
  — creates an ephemeral guest identity with a UUID v4 session ID via
  `idProvider ?? randomUUID`. Pure function — no database access.
  - `// why:` guest sessions are runtime-only, never persisted.

### D) `apps/server/src/identity/replayOwnership.logic.ts` — new

- `assignReplayOwnership(accountId: AccountId, replayHash: string, scenarioKey: string, database: DatabaseClient): Promise<Result<ReplayOwnershipRecord>>`
  — inserts ownership record using the locked SQL pattern (see
  Non-Negotiable Constraints / locked SQL pattern) with `visibility:
  'private'` and `expiresAt` computed from `DEFAULT_RETENTION_POLICY`.
  - Idempotent: if `(player_id, replay_hash)` already exists, the
    `ON CONFLICT … DO UPDATE SET visibility = visibility` no-op forces
    `RETURNING` to emit the existing row unchanged.
  - Returns `{ ok: false, code: 'unknown_account', reason: ... }` if
    the FK resolution to `legendary.players` fails (mapped from
    PostgreSQL `code: '23503'`) — never throws.
  - `// why:` idempotent to handle network retries safely.

- `updateReplayVisibility(ownershipId: number, visibility: ReplayVisibility, database: DatabaseClient): Promise<ReplayOwnershipRecord | null>`
  — updates visibility; returns `null` if ownership record not found.
  - `// why:` visibility is the only mutable field on ownership —
    all other fields are immutable after creation.

- `listAccountReplays(accountId: AccountId, database: DatabaseClient): Promise<ReplayOwnershipRecord[]>`
  — returns all non-expired ownership records for an account, ordered
  by `created_at` descending. Renamed from draft `listPlayerReplays`
  for parameter clarity (PS-2).
  - Expiration is enforced at read time: records with `expires_at < now()`
    must be excluded even if still present in the database.
  - `// why:` read-time enforcement avoids implicit background purge
    jobs and keeps deletion semantics observable from the query layer.

- `findReplayOwnership(replayHash: string, database: DatabaseClient): Promise<ReplayOwnershipRecord | null>`
  — looks up ownership by replay hash.
  - Returns ownership metadata only; callers are responsible for
    enforcing visibility and access checks.
  - `// why:` keeps identity strictly an access-input layer; embedding
    visibility checks here would couple lookup to policy and risk leaks
    at other call sites.

- `deletePlayerData(accountId: AccountId, database: DatabaseClient): Promise<{ deletedReplays: number; accountDeleted: boolean }>`
  — GDPR-compliant deletion: removes all ownership records and the player
  account in a single transaction. Returns counts for audit logging.
  - `// why:` GDPR Article 17 right to erasure — deletes ownership
    metadata and account identity. **Replay blob removal is out of
    scope for this packet.** No queue is enqueued; no scheduler is
    invoked. The returned audit count is the handoff. A future WP
    must read this audit signal (or run an independent reconciliation
    pass) to purge orphaned blobs from object storage.

### E) Database migrations — new

- `data/migrations/004_create_players_table.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS legendary.players (
    player_id        bigserial    PRIMARY KEY,
    ext_id           text         NOT NULL UNIQUE,  -- UUID v4, mapped to AccountId
    email            text         NOT NULL UNIQUE,  -- canonicalized: trimmed + lowercased
    display_name     text         NOT NULL,         -- trimmed; length 1-64; no controls
    auth_provider    text         NOT NULL,
    auth_provider_id text         NOT NULL,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now()
  );
  ```
  - `// why:` `ext_id` is the cross-service identifier per
    `00.2-data-requirements.md` and maps 1:1 to `AccountId` per D-5201;
    `bigserial` PK per convention.
  - `// why:` `email` is stored canonicalized at insert time; the
    `UNIQUE` constraint enforces case-folded uniqueness.

- `data/migrations/005_create_replay_ownership_table.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS legendary.replay_ownership (
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
  - `// why:` `UNIQUE (player_id, replay_hash)` enforces idempotent
    ownership assignment; `visibility` defaults to `'private'` per
    13-REPLAYS-REFERENCE.md §Privacy.
  - `// why:` `player_id` is the internal bigint FK to
    `legendary.players(player_id)`. The TypeScript application layer
    uses `accountId: AccountId` (mapped to `legendary.players.ext_id`)
    and never exposes the bigint FK — the join from `accountId` to
    `player_id` happens inside the SQL of each query.

### F) Tests — `apps/server/src/identity/identity.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No `boardgame.io` import.

**Suite wrapping (locked, PS-5):** all tests in this file are wrapped in a
single top-level `describe('identity logic (WP-052)', ...)` block. This
adds **+1 suite** to the server test baseline.

**Test count: 8 tests.**

1. `createGuestIdentity` produces a valid `GuestIdentity` with
   `isGuest: true` (uses an injected `idProvider` returning a fixed
   UUID for determinism).
2. `isGuest` returns `true` for guest identity, `false` for account identity.
3. `AUTH_PROVIDERS` array matches `AuthProvider` union (drift detection;
   asserts both forward and backward inclusion).
4. `Object.keys(playerAccount).sort()` matches the locked 7-field list
   `['accountId','authProvider','authProviderId','createdAt','displayName','email','updatedAt']`
   for a constructed `PlayerAccount` (drift detection — copilot #4 fix).
   Likewise `Object.keys(guestIdentity).sort()` matches
   `['createdAt','guestSessionId','isGuest']`.
5. `createPlayerAccount` returns
   `{ ok: false, code: 'duplicate_email' }` on duplicate email
   (requires test database).
6. `createPlayerAccount` canonicalizes email (`Foo@Example.com`
   normalized to `foo@example.com` and rejected as duplicate of an
   earlier `foo@example.com` record) (requires test database).
7. `createPlayerAccount` returns
   `{ ok: false, code: 'invalid_display_name' }` for empty,
   too-long (>64), or control-character display names (no test DB
   needed — pure validation).
8. Email uniqueness FK invariant: orphaned ownership rows cannot be
   created — `assignReplayOwnership` returns
   `{ ok: false, code: 'unknown_account' }` for an unknown account
   (requires test database; smoke check that FK enforcement works).

Tests 5, 6, 8 require a test PostgreSQL database. If unavailable, they
must be marked with `{ skip: 'requires test database' }` (non-silent
skip) — never silently omitted. Tests 1–4 and 7 are pure and always run.

### G) Tests — `apps/server/src/identity/replayOwnership.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No `boardgame.io` import.

**Suite wrapping (locked, PS-5):** all tests in this file are wrapped in a
single top-level `describe('replay ownership logic (WP-052)', ...)` block.
This adds **+1 suite** to the server test baseline. Combined with §F's +1,
the server suite total becomes **5** (was 3).

**Test count: 4 tests.**

1. `DEFAULT_RETENTION_POLICY.minimumDays` equals `30` and
   `REPLAY_VISIBILITY_VALUES` matches `ReplayVisibility` union
   (drift detection).
2. `assignReplayOwnership` is idempotent — second call returns same
   record unchanged; `visibility` is unchanged on conflict (requires
   test database).
3. `updateReplayVisibility` changes only `visibility`, preserves all
   other fields (requires test database; asserts `Object.keys` and
   field-by-field equality of immutable fields).
4. `listAccountReplays` excludes expired records (uses fixed `expires_at
   < now()` row; requires test database).

Tests 2–4 require a test PostgreSQL database. If unavailable, they must
be marked with `{ skip: 'requires test database' }` — never silently
omitted. Test 1 is pure and always runs.

---

## Out of Scope

- **No OAuth UI flows** — OAuth redirect handling, token exchange, and session
  management are future work. This packet defines the account model, not the
  login UX.
- **No leaderboard submission** — that is WP-054.
- **No public leaderboard queries** — that is WP-055.
- **No replay blob storage** — this packet defines ownership metadata. Replay
  blob storage (object storage integration) is an implementation detail
  handled by the server layer independently.
- **No replay format changes** — WP-027 replay format is locked.
- **No engine modifications** — identity is server-only; the engine must not
  change. `packages/game-engine/src/types.ts` (with engine `PlayerId` per
  D-8701) is not modified by this packet.
- **No scoring logic** — WP-048 scoring contracts are locked.
- **No PAR gate changes** — WP-051 gate check is locked.
- **No supporter tier implementation** — extended retention is modeled in the
  type system (`extendedDays`) but not enforced. Tier logic is future work.
  When implemented, it must remain a convenience only, never a gameplay
  advantage (per `01-VISION.md` §Financial Sustainability).
- **No email verification** — account creation accepts canonicalized email;
  verification flow is future work.
- **No GDPR replay-blob purge** — `deletePlayerData` returns audit counts
  only; blob purge is a future WP.
- **No server startup wiring** — this packet does not modify
  `apps/server/src/server.mjs` or `apps/server/src/index.mjs`. Identity
  endpoints will be wired by a future request-handler WP.
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/server/src/identity/identity.types.ts` — **new** —
  `AccountId`, `PlayerAccount`, `GuestIdentity`, `PlayerIdentity`,
  `AuthProvider`, `AUTH_PROVIDERS`, `isGuest`, `Result<T>`,
  `IdentityErrorCode`
- `apps/server/src/identity/replayOwnership.types.ts` — **new** —
  `ReplayVisibility`, `REPLAY_VISIBILITY_VALUES`,
  `ReplayOwnershipRecord`, `ReplayRetentionPolicy`,
  `DEFAULT_RETENTION_POLICY`
- `apps/server/src/identity/identity.logic.ts` — **new** —
  `createPlayerAccount`, `findPlayerByEmail`, `findPlayerByAccountId`,
  `createGuestIdentity`
- `apps/server/src/identity/replayOwnership.logic.ts` — **new** —
  `assignReplayOwnership`, `updateReplayVisibility`,
  `listAccountReplays`, `findReplayOwnership`, `deletePlayerData`
- `data/migrations/004_create_players_table.sql` — **new** —
  `legendary.players` table (idempotent DDL)
- `data/migrations/005_create_replay_ownership_table.sql` — **new** —
  `legendary.replay_ownership` table (idempotent DDL)
- `apps/server/src/identity/identity.logic.test.ts` — **new** —
  `node:test` coverage (8 tests, 1 `describe()` block → +1 suite)
- `apps/server/src/identity/replayOwnership.logic.test.ts` — **new** —
  `node:test` coverage (4 tests, 1 `describe()` block → +1 suite)

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Identity Model
- [ ] `AccountId` is a branded string type
      (`string & { readonly __brand: 'AccountId' }`) — not a plain `string`
- [ ] `AccountId` is generated via `randomUUID` from `node:crypto`
      (or via injected `idProvider` in tests)
- [ ] `PlayerAccount` has exactly 7 fields: `accountId`, `email`,
      `displayName`, `authProvider`, `authProviderId`, `createdAt`,
      `updatedAt`
- [ ] `Object.keys(account).sort()` drift test asserts the 7-field list
      verbatim
- [ ] `AuthProvider` is `'email' | 'google' | 'discord'` — no other values
- [ ] `GuestIdentity` has exactly 3 fields: `guestSessionId`, `createdAt`,
      `isGuest`
- [ ] `Object.keys(guest).sort()` drift test asserts the 3-field list
- [ ] `isGuest` discriminant enables type narrowing on `PlayerIdentity`
- [ ] `createGuestIdentity` is a pure function — no database access
- [ ] `Result<T>` discriminated union is used for fallible identity functions
- [ ] No engine `PlayerId` is imported into any file under
      `apps/server/src/identity/` (verified via grep)

### Replay Ownership
- [ ] `ReplayVisibility` is `'private' | 'link' | 'public'` — no other values
- [ ] New ownership records default to `visibility: 'private'`
- [ ] `assignReplayOwnership` uses the locked
      `INSERT … ON CONFLICT (player_id, replay_hash) DO UPDATE SET
      visibility = legendary.replay_ownership.visibility RETURNING …`
      pattern
- [ ] `updateReplayVisibility` changes only `visibility` — all other fields
      remain immutable
- [ ] No field of `ReplayOwnershipRecord` except `visibility` can be updated
      after creation (enforced by logic — no UPDATE function touches other
      fields)
- [ ] `DEFAULT_RETENTION_POLICY.minimumDays` equals 30
- [ ] `expiresAt` is computed from retention policy at creation time
- [ ] `deletePlayerData` removes all ownership records and the account in
      a single transaction
- [ ] `deletePlayerData` does not enqueue blob purge or invoke any
      scheduler — handoff is the returned audit count alone

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
- [ ] Migration files are numbered `004` and `005` and use
      `CREATE TABLE IF NOT EXISTS`

### Drift Detection
- [ ] `AUTH_PROVIDERS` array matches `AuthProvider` union
- [ ] `REPLAY_VISIBILITY_VALUES` array matches `ReplayVisibility` union
- [ ] Drift-detection tests assert both
- [ ] `Object.keys` drift tests assert `PlayerAccount` and `GuestIdentity`
      shapes

### Layer Boundary
- [ ] No identity types in `packages/game-engine/`
      (confirmed with `Select-String`)
- [ ] No `boardgame.io` import in identity files
      (confirmed with `Select-String`)
- [ ] No `@legendary-arena/game-engine` import in identity files
      (confirmed with `Select-String`)
- [ ] No engine `PlayerId` import in identity files
      (confirmed with `Select-String`)
- [ ] Identity logic does not import or reference `G`, `ctx`, or engine
      runtime types

### Validation Policies
- [ ] Email is canonicalized (trimmed + lowercased) before insertion and
      before lookup
- [ ] `displayName` is trimmed and validated to length `[1, 64]`
- [ ] `displayName` rejects newlines, tabs, and other control characters

### Tests
- [ ] All 12 tests pass (or DB-dependent tests are marked `skip` with reason)
- [ ] Test files use `.test.ts` extension
- [ ] Tests use `node:test` and `node:assert` only
- [ ] No `boardgame.io` import in test files
- [ ] Each test file wraps tests in exactly one `describe()` block →
      server suite count increments by exactly **+2** (3 → 5)
- [ ] Server test count increments by exactly **+12** (19 → 31)
- [ ] Engine test baseline unchanged at **513 / 115 / 0**

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] `packages/game-engine/src/types.ts` not modified (confirmed with
      `git diff`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm test
# Expected: TAP output — all tests passing (or DB tests skipped with reason)
# Expected: engine 513/115/0 unchanged; server 31/5/0 (or 31 with skips)

# Step 3 — confirm no identity types leaked into game-engine
Select-String -Path "packages\game-engine\src" -Pattern "AccountId|PlayerAccount|GuestIdentity|ReplayOwnership|ReplayVisibility" -Recurse
# Expected: no output

# Step 4 — confirm no engine PlayerId import in identity files
Select-String -Path "apps\server\src\identity" -Pattern "from ['""]@legendary-arena/game-engine" -Recurse
# Expected: no output

# Step 5 — confirm no boardgame.io import in identity files
Select-String -Path "apps\server\src\identity" -Pattern "from ['""]boardgame\.io" -Recurse
# Expected: no output

# Step 6 — confirm no require() in identity files
Select-String -Path "apps\server\src\identity" -Pattern "require\(" -Recurse
# Expected: no output

# Step 7 — confirm UUID source is node:crypto
Select-String -Path "apps\server\src\identity" -Pattern "from ['""]node:crypto" -Recurse
# Expected: at least one match (in identity.logic.ts)

# Step 8 — confirm visibility default in migration
Select-String -Path "data\migrations\005_create_replay_ownership_table.sql" -Pattern "DEFAULT 'private'"
# Expected: at least one match

# Step 9 — confirm idempotent DDL in new migrations
Select-String -Path "data\migrations\004_create_players_table.sql","data\migrations\005_create_replay_ownership_table.sql" -Pattern "CREATE TABLE IF NOT EXISTS legendary\."
# Expected: matches in both files

# Step 10 — confirm unique constraints in migrations
Select-String -Path "data\migrations\004_create_players_table.sql","data\migrations\005_create_replay_ownership_table.sql" -Pattern "UNIQUE"
# Expected: matches for (ext_id), (email), and (player_id, replay_hash)

# Step 11 — confirm legendary.* namespace
Select-String -Path "data\migrations\004_create_players_table.sql","data\migrations\005_create_replay_ownership_table.sql" -Pattern "legendary\.players|legendary\.replay_ownership"
# Expected: matches for both tables

# Step 12 — confirm idempotent SQL pattern locked in code
Select-String -Path "apps\server\src\identity\replayOwnership.logic.ts" -Pattern "ON CONFLICT \(player_id, replay_hash\) DO UPDATE"
# Expected: at least one match

# Step 13 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 14 — confirm engine types.ts is unchanged
git diff packages/game-engine/src/types.ts
# Expected: no output (no diff)
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
- [ ] Engine baseline unchanged: **513 tests / 115 suites / 0 fail**
- [ ] Server baseline post-execution: **31 tests / 5 suites / 0 fail**
      (or **31 with skips** for DB-dependent tests)
- [ ] No identity types in `packages/game-engine/`
- [ ] No `boardgame.io` import in identity files
- [ ] No `@legendary-arena/game-engine` import in identity files
- [ ] No `require()` in any generated file
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] WP-027 contract files not modified
- [ ] WP-051 contract files not modified
- [ ] `packages/game-engine/src/types.ts` not modified
- [ ] Migration files use `legendary.*` namespace, `bigserial` PKs, and
      `CREATE TABLE IF NOT EXISTS` idempotent DDL
- [ ] `docs/ai/STATUS.md` updated — player identity model and replay ownership
      contracts now exist; guests can play without accounts; replay visibility
      defaults to private; `AccountId` distinct from engine `PlayerId`
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: D-5201 (`AccountId`
      rename), D-5202 (server identity directory classification), D-5203
      (identity persistence taxonomy), and a per-execution decision noting
      what was locked (UUID source, idempotency SQL, email canonicalization,
      `displayName` constraints, `updatedAt` policy, GDPR audit handoff)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-052 checked off with
      today's date
