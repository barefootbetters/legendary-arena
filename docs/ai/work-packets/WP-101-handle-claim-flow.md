# WP-101 — Handle Claim Flow & Global Uniqueness

**Status:** Draft (lint-gate self-review PASS; pre-flight pending)
**Primary Layer:** Server / Identity
**Dependencies:** WP-052

> WP-112 (session token validation; renumbered from "WP-100" per D-10002)
> is not yet drafted. This packet treats
> `requireAuthenticatedSession(req): Promise<AccountId>` as a caller-injected
> contract — same dependency-injection pattern WP-052 used for `DatabaseClient`.
> Tests stub it; the real implementation arrives with WP-112.

---

## Session Context

WP-052 established `AccountId` (server-side branded UUID v4), `PlayerAccount`
(7 fields including `email`, `displayName`, `authProvider`, `authProviderId`),
and the `legendary.players` table with `bigserial` PK + `ext_id text UNIQUE`;
this packet adds an immutable, globally unique, URL-safe `handle` that locks
at first successful claim, without modifying any WP-052 identity primitive,
contract file, or migration.

---

## Goal

After this session, `apps/server/src/identity/` exports handle-claim
logic: `validateHandleFormat(handle)` (pure) returns canonical and
display forms or a typed error code; `claimHandle(accountId, requestedHandle,
database)` performs a one-time idempotent UPDATE against `legendary.players`
and returns a typed `Result<HandleClaim>`; `findAccountByHandle` and
`getHandleForAccount` are read-only lookups. The `legendary.players` table
gains three columns (`handle_canonical`, `display_handle`, `handle_locked_at`)
via migration `007`, with a partial UNIQUE index that enforces global
uniqueness once a handle is claimed while permitting NULLs in the pre-claim
state. The system never permits handle rename, transfer, or recycling.

**A handle is considered _locked_ at the moment `handle_locked_at` is set
and is immutable thereafter.** This single definition governs every
later use of the word "lock" / "locked" / "locked_at" in this packet.

**This packet intentionally stops at server-internal logic and
persistence.** Request handlers, HTTP route wiring, session middleware,
and any UI surface are deferred to future WPs (WP-112 for session
validation — renumbered from "WP-100" per D-10002; a future
request-handler WP for the claim endpoint; WP-102 for the public
profile page). The reviewer should expect to
find no Express routes, no middleware registration, and no
`apps/server/src/index.mjs` modification in this packet.

---

## Vision Alignment

**Vision clauses touched:** `§3 (Player Trust & Fairness), §11 (Stateless
Client Philosophy), §14 (Explicit Decisions, No Silent Drift), §25 (Skill
Over Repetition — Non-Ranking Telemetry Carve-Out)`.

**Conflict assertion:** **No conflict: this WP preserves all touched clauses.**

- §3: handles are explicit user choices, not inferred from auth providers
  or generated server-side. The reserved-handle set is documented and
  exported; the regex is documented and exported. No hidden modifiers.
- §11: handle state is server-authoritative. The client carries no handle
  state beyond what it submits during claim and what it reads back from
  authoritative responses.
- §14: every locked decision in this packet (canonicalization,
  charset, reserved set, lock semantics, rename policy) is recorded
  explicitly in `Non-Negotiable Constraints` and tested for drift.
- §25: handles are user-facing identifiers. They never enter ranking,
  PAR, scoring, matchmaking, or competitive surfaces. Display in profile
  pages and replay metadata is non-ranking telemetry per the §25
  carve-out.

**Non-Goal proximity check:** None of NG-1..NG-7 are crossed. Handles are
not purchasable, not gated, not gacha-randomized, not ad surfaces, not
energy-limited, not used as dark patterns, and the rename-disallowed
policy needs no apologetic explanation — it is a simple invariant.

**Determinism preservation:** N/A for engine determinism — handles are
server-layer access metadata and never enter `G`, `ctx`, RNG, or scoring.

---

## Assumes

- WP-052 complete. Specifically:
  - `apps/server/src/identity/identity.types.ts` exports `AccountId`,
    `PlayerAccount`, `Result<T>`, `IdentityErrorCode`
  - `apps/server/src/identity/identity.logic.ts` exports
    `findPlayerByAccountId`, `createPlayerAccount` (canonicalization
    precedent: `email.trim().toLowerCase()` + plain `UNIQUE` constraint)
  - `data/migrations/004_create_players_table.sql` creates
    `legendary.players` with `bigserial` PK, `ext_id text UNIQUE`,
    `email text UNIQUE`, `display_name text NOT NULL`
  - D-5201 (`AccountId` rename), D-5202 (server identity directory
    classification), D-5203 (identity persistence taxonomy) recorded
- Migrations `001`..`006` exist; the migration runner (Foundation Prompt
  02) is operational. Migration `006_create_replay_blobs_table.sql`
  was landed by WP-103 on 2026-04-25 (commit `fe7db3e`); WP-101's
  new migration is therefore `007`, not `006`.
- `pnpm -r build` exits 0
- `pnpm test` exits 0 with the post-WP-103 / post-WP-053a baseline:
  - engine **522 / 116 / 0** (post-WP-053a at commit `e5b9d15`;
    WP-053a added +9 tests / +1 suite vs the post-WP-052 baseline
    of `513 / 115 / 0`)
  - server **36 / 6 / 0** (post-WP-103 at commit `fe7db3e`; WP-103
    added +5 tests / +1 suite vs the post-WP-052 baseline of
    `31 / 5 / 0`; with skips when `TEST_DATABASE_URL` is unset)
- `docs/ai/DECISIONS.md` exists
- `docs/ai/ARCHITECTURE.md` exists
- WP-112 (session token validation; renumbered from "WP-100" per
  D-10002) is **not** required to land before this packet. WP-101
  treats authenticated session resolution as an injected contract;
  tests stub a fixture `AccountId` directly.

If any of the above is false, this packet is **BLOCKED** and must not
proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — handles are
  server-layer identity; the engine must never import handle types or
  check handle uniqueness. Confirm no cross-layer leakage before writing.
- `docs/ai/ARCHITECTURE.md §Persistence Boundaries` and
  `.claude/rules/persistence.md` — handle columns extend the
  server-persisted player-scoped bookkeeping classification established by
  D-5203. They never enter `G`/`ctx`.
- `docs/ai/work-packets/WP-052-player-identity-replay-ownership.md
  §Scope (In) C` — read the `createPlayerAccount` canonicalization
  pattern (`email.trim().toLowerCase()` + DB `UNIQUE`) and the
  `Result<T>` discriminated-union error shape. Handle canonicalization
  mirrors this approach exactly.
- `docs/ai/REFERENCE/00.2-data-requirements.md §1` — PostgreSQL namespace
  is `legendary.*`, PKs use `bigserial`, cross-service IDs use
  `ext_id text`. The migration in this packet must conform.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on canonicalization decisions),
  Rule 11 (full-sentence error messages), Rule 13 (ESM only), Rule 14
  (field names match data contract).
- `docs/ai/DECISIONS.md` — scan for any prior entries on `handle`,
  `displayName`, or public identifiers; D-5201 (AccountId rename) is
  authoritative for naming.
- `docs/01-VISION.md §3, §14, §25` — handles are user-facing identifiers
  shown on profile surfaces and in replay metadata. They are never
  ranking inputs. The non-ranking telemetry carve-out applies.
- `docs/ai/DESIGN-RANKING.md` lines 485–487 — **authoritative ranking
  identity invariant.** Verbatim: "Player identity for all ranking
  purposes is the stable player ID, never display name, account alias,
  handle, or session identifier." WP-101 must preserve this: handles
  introduced here MUST NOT appear as ranking inputs in WP-053 / WP-054
  or any future scoring/leaderboard surface. Rankings continue to use
  `AccountId` (the stable player ID per WP-052 / D-5201).
- `docs/ai/DESIGN-RANKING.md` lines 145, 205 — **terminology note.**
  DESIGN-RANKING.md uses the phrase "replay handle" to mean a reference
  to a replay artifact (`replayHash` per WP-027). This is a different
  noun from the "user handle" introduced by this packet. The WP-101
  identifier is **never** called a "replay handle" in any code, comment,
  test name, error message, or documentation produced under this packet.
- `docs/13-REPLAYS-REFERENCE.md` — scanned during pre-draft (2026-04-25):
  no normative governance on player display names, handles, or shared
  identifiers in replay surfaces exists at this time. The doc
  anticipates "Permanent shareable replay links" (line 248) but does
  not lock a URL shape; WP-101's deferral of `/players/{handle}` to
  WP-102 is consistent.
- `data/migrations/004_create_players_table.sql` — read the existing
  `legendary.players` shape before authoring an `ALTER TABLE` migration.
- `apps/server/src/identity/identity.logic.ts` — read the
  caller-injected `DatabaseClient` pattern; this packet mirrors it.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
  (engine); this packet does not introduce randomness into `G`
- Never throw inside boardgame.io move functions — return void on invalid
  input (this packet does not introduce moves; the rule still applies
  globally)
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md
  §Persistence Boundaries
- `G` must be JSON-serializable at all times — no class instances, Maps,
  Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never
  `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`,
  `node:assert`, `node:crypto`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output —
  no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Handles never affect outcomes.** A handle is a user-facing access
  identifier — never an input to game logic, scoring, RNG, matchmaking,
  or competitive ranking. The engine must never import handle types or
  any code from `apps/server/src/identity/handle*`. This satisfies the
  ranking-identity invariant in `DESIGN-RANKING.md` lines 485–487:
  rankings use `AccountId` (stable player ID), never the handle.
- **Authenticated caller required.** `claimHandle` accepts a verified
  `AccountId` argument supplied by the injected session resolver. It
  never accepts an arbitrary `accountId` string from an HTTP body, query
  parameter, or request header. The caller-injected
  `requireAuthenticatedSession` (WP-112; renumbered from "WP-100"
  per D-10002) is the sole source of truth for
  the caller's identity; claim endpoints (introduced by a future WP)
  call it before invoking `claimHandle`. Until WP-112 lands, tests
  inject a fixture `AccountId` directly.
- **Handles are immutable after first successful claim** (i.e.,
  permanently locked, per the definition in `## Goal`). No rename
  function exists in this packet. No admin override. No GDPR-motivated
  rename. Deleting an account deletes the `legendary.players` row;
  the handle is **not** retained in a tombstone table and is therefore
  not preserved for reassignment, recovery, or anti-impersonation
  reservation. The canonical value disappears from the partial UNIQUE
  index along with the row. Any future exception (rename, recycle, or
  tombstone) requires a new WP and a `DECISIONS.md` entry.
- **Public surfaces must not treat handle as a stable identity key.**
  Any future surface that exposes handles externally — `/players/{handle}`
  (proposed WP-102), replay attribution, leaderboard displays, profile
  URLs, and shareable replay links (per `13-REPLAYS-REFERENCE.md`
  line 248) — must use `AccountId` as the authoritative identity and
  treat the handle as a presentation alias that may be reused by a
  different account after deletion under this packet's no-tombstone
  policy. Routing, lookup, and attribution must dereference handle →
  `AccountId` at the point of use; any cached `(handle, content)`
  association is stale by construction once the underlying account
  changes. This invariant complements (and does not replace) the
  ranking-identity invariant from `DESIGN-RANKING.md` lines 485–487:
  rankings continue to use `AccountId` regardless of presentation
  surface.
- **Terminology disambiguation.** `DESIGN-RANKING.md` uses "replay
  handle" to mean `replayHash` (a reference to a replay artifact). This
  packet's `handle` / `Handle*` symbols ALWAYS refer to the user-facing
  account identifier introduced here. No file in this packet uses the
  bare phrase "replay handle" to describe a hash, and no symbol
  introduced here is named with "replay" as a prefix. If a future WP
  needs to resolve the terminology overload across the codebase, it
  belongs in a separate documentation-only WP.
- **One handle per account; one account per handle.** Enforced both at
  the application layer (via `handle_already_locked` on re-claim attempts
  with a different value) and at the database layer (partial UNIQUE
  index on `handle_canonical`).
- **Canonicalization is the uniqueness key.** `handle_canonical =
  handle.trim().toLowerCase()`. The DB unique index is on
  `handle_canonical`, never on the cased value. `display_handle`
  preserves the user's submitted casing for presentation.
  Canonicalization (`trim()` → `toLowerCase()`) is applied **before**
  regex validation, reserved-set checks, database writes, and all
  comparisons — every check in this packet runs against the canonical
  form, never against the user-submitted casing.
- **`display_handle` is presentation-only.** It must never be used for
  lookup, authorization, routing, uniqueness checks, or identity
  inference. All authoritative operations key on `handle_canonical` or
  `AccountId`. Any future surface that displays the handle reads
  `display_handle` for rendering and `handle_canonical` (or
  `AccountId`) for everything else.
- **Reserved-handle check runs before uniqueness.** The static reject set
  (see locked values) is checked against the canonical form before any
  DB write. Reserved handles return `code: 'reserved_handle'` regardless
  of DB state.
- **Format validation runs against the canonical form.** The locked
  regex matches the canonicalized value; submissions whose canonical
  form fails the regex are rejected with `code: 'invalid_handle'`.
- **No consecutive underscores.** In addition to the regex, an explicit
  substring check rejects `__`. This belongs in code (clearer error
  message) rather than a more complex regex.
- **Idempotent on re-claim by same account with same canonical handle.**
  Returning user submits the same `(accountId, canonical)` → returns
  `{ ok: true, value: existingClaim }` without DB write. Same account
  submits a *different* handle → `code: 'handle_already_locked'`.
- **No client-side handle generation, suggestion, or auto-derivation.**
  Handles are never derived from email, OAuth provider data, display
  name, or any other identity input. Users explicitly type the handle
  they want.
- **No engine import.** Identity files must not import `boardgame.io`,
  `@legendary-arena/game-engine`, or any engine `PlayerId` alias.
  Verified by `Select-String` in verification steps.
- **No UI implementation.** This packet defines server logic, types, and
  the migration. No frontend forms, no Vue components, no HTTP route
  wiring.
- **No public profile pages.** Read-only `/players/{handle}` is
  proposed for a future WP-102. This packet stops at
  `findAccountByHandle` and `getHandleForAccount`.
- **WP-052 contract files must NOT be modified.**
  `apps/server/src/identity/identity.types.ts` and
  `apps/server/src/identity/identity.logic.ts` are locked. New types
  live in new files; new functions live in new files. The `Result<T>`
  type is **re-imported** from `identity.types.ts`, never re-declared.
- **WP-052 migrations 004 and 005 must NOT be edited.** New columns are
  added by a NEW migration `007_add_handle_to_players.sql`.
- `packages/game-engine/src/types.ts` must NOT be modified — engine
  `PlayerId` alias (D-8701) is locked.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the
  human before proceeding — never guess or invent field names, type
  shapes, or file paths.

**Locked contract values:**

- **`legendary.*` namespace** (PostgreSQL): all tables remain in the
  `legendary.*` schema. PKs use `bigserial`. Cross-service IDs use
  `ext_id text` per `00.2-data-requirements.md` §1.

- **Migration number locked:** `data/migrations/007_add_handle_to_players.sql`.

- **Handle format regex (locked):** `^[a-z][a-z0-9_]{2,23}$`
  - 3–24 characters total
  - first character is a lowercase letter (no leading digit, no leading
    underscore)
  - subsequent characters are lowercase letters, digits, or underscore
  - matches against the **canonical** value (post-`trim().toLowerCase()`)

- **Handle reserved set (locked, alphabetical, 15 entries):**
  ```
  admin, administrator, anonymous, api, arena, guest, legendary,
  mod, moderator, null, root, staff, support, system, undefined
  ```
  Membership is checked against the canonical form. Future additions
  require a new WP and a `DECISIONS.md` entry.

- **Handle column shapes (locked, added to `legendary.players`):**
  - `handle_canonical text` — nullable until claimed; once non-null,
    never updated
  - `display_handle text` — nullable until claimed; once non-null,
    never updated
  - `handle_locked_at timestamptz` — nullable until claimed; set to
    `now()` at claim time
  - All three columns share the invariant: NULL together or non-NULL
    together (mutual presence)

- **Result shape (re-used from WP-052, NOT re-declared):**
  ```ts
  Result<HandleClaim> = { ok: true; value: HandleClaim }
                      | { ok: false; reason: string; code: HandleErrorCode };
  ```
  `reason` is a full-sentence message per code-style Rule 11.

- **`HandleErrorCode` (locked, 5 values):**
  ```
  'invalid_handle' | 'reserved_handle' | 'handle_taken'
                  | 'handle_already_locked' | 'unknown_account'
  ```
  Canonical array `HANDLE_ERROR_CODES: readonly HandleErrorCode[]`.
  Drift-detection test required (forward and backward inclusion).

- **`HandleClaim` shape (locked, 4 fields):**
  ```ts
  interface HandleClaim {
    accountId: AccountId;
    handleCanonical: string;
    displayHandle: string;
    handleLockedAt: string;
  }
  ```
  All four fields immutable after claim.

- **Idempotent claim SQL pattern (locked):**
  ```sql
  UPDATE legendary.players
  SET handle_canonical = $2,
      display_handle   = $3,
      handle_locked_at = now()
  WHERE ext_id = $1
    AND handle_canonical IS NULL
  RETURNING ext_id, handle_canonical, display_handle, handle_locked_at;
  ```
  - Empty `RETURNING` set means either the account does not exist OR
    the account already has a handle locked. The application layer
    disambiguates via a follow-up `findPlayerByAccountId` and maps to
    `unknown_account` vs `handle_already_locked` vs (when the existing
    canonical equals the requested canonical) idempotent success.
  - Concurrent claims for the same canonical handle from different
    accounts are serialized by the partial UNIQUE index; PostgreSQL
    `code: '23505'` on `handle_canonical` maps to `handle_taken`.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic
reproduction and state inspection. Logging, breakpoints, or "printf
debugging" are not acceptable debugging strategies.

The following requirements are mandatory:

- Behavior introduced by this packet must be fully reproducible given:
  - identical database state
  - identical inputs to `validateHandleFormat` and `claimHandle`
  - identical `AccountId` produced by the (test-stubbed) injected session

- Execution must be externally observable via deterministic state changes:
  - successful claim is observable via SQL inspection of
    `legendary.players` columns `handle_canonical`, `display_handle`,
    `handle_locked_at`
  - all failure modes return a typed `Result.ok = false` with a
    deterministic `code`; no failure produces an exception

- This packet must not introduce any state mutation that:
  - cannot be inspected post-execution via SQL, or
  - cannot be validated via tests

- The following invariants must always hold after execution:
  - every non-null `handle_canonical` value matches
    `^[a-z][a-z0-9_]{2,23}$`
  - every non-null `handle_canonical` is unique across
    `legendary.players` (enforced by partial UNIQUE index)
  - whenever `handle_canonical` is non-null, `display_handle` and
    `handle_locked_at` are also non-null (mutual presence)
  - `handle_canonical` is never reverted to NULL once written
  - canonical forms in `RESERVED_HANDLES` never appear in
    `handle_canonical`
  - no row has `handle_canonical` set to `''`, whitespace-only, or
    a value containing uppercase letters

- Failures attributable to this packet must be localizable via:
  - violation of declared invariants, or
  - unexpected mutation of WP-052 columns

---

## Scope (In)

### A) `apps/server/src/identity/handle.types.ts` — new

- `interface HandleClaim { accountId: AccountId; handleCanonical: string;
  displayHandle: string; handleLockedAt: string }`
  - `// why:` four-field shape locked; rename or addition requires a
    `DECISIONS.md` entry. `handleLockedAt` is an ISO-8601 string for
    JSON-serializable handoff to clients.
- `type HandleErrorCode = 'invalid_handle' | 'reserved_handle' |
  'handle_taken' | 'handle_already_locked' | 'unknown_account'`
- `HANDLE_ERROR_CODES: readonly HandleErrorCode[]` — canonical array
  with drift-detection test (forward and backward inclusion).
- `RESERVED_HANDLES: readonly string[]` — exported alphabetical-sorted
  array of reserved canonical handles.
  - `// why:` exporting the array (not embedding it in regex form) lets
    tests assert exact content and lets future WPs read the locked set
    without duplicating it.
- `HANDLE_REGEX: RegExp` — exported as `/^[a-z][a-z0-9_]{2,23}$/`.
  - `// why:` exported so tests can assert the exact pattern matches the
    documented locked value byte-for-byte (`HANDLE_REGEX.source ===
    '^[a-z][a-z0-9_]{2,23}$'`).
- Re-imports `Result<T>` and `AccountId` from `identity.types.ts`. Does
  NOT redeclare these types.

### B) `apps/server/src/identity/handle.logic.ts` — new

All exports take `database: DatabaseClient` (caller-injected, mirrors
WP-052's pattern). All exports either return a value directly (pure
helpers, simple reads) or wrap fallible behavior in `Result<T>` per the
WP-052 precedent.

- `validateHandleFormat(handle: string): Result<{ canonical: string;
  display: string }>`
  - Steps in order: trim input → check non-empty → check no consecutive
    underscores in canonical → match against `HANDLE_REGEX` → check
    canonical against `RESERVED_HANDLES`.
  - Pure: no DB access.
  - Reserved-set hit returns `{ ok: false, code: 'reserved_handle',
    reason: 'The handle "<canonical>" is reserved and cannot be claimed.' }`.
  - Format failure (regex or `__` substring) returns
    `{ ok: false, code: 'invalid_handle', reason: ... }` with a
    full-sentence message per Rule 11.
  - On success returns
    `{ ok: true, value: { canonical, display } }` where `canonical =
    handle.trim().toLowerCase()` and `display = handle.trim()`.
  - `// why:` separated from `claimHandle` so callers (e.g., a future
    "is this handle available?" preview API) can validate without
    writing.

- `claimHandle(accountId: AccountId, requestedHandle: string,
  database: DatabaseClient): Promise<Result<HandleClaim>>`
  - Calls `validateHandleFormat`; propagates failure unchanged.
  - On valid input, executes the locked idempotent UPDATE.
  - On non-empty `RETURNING`: maps the row to `HandleClaim` and returns
    `{ ok: true, value }`.
  - On empty `RETURNING`: calls `findPlayerByAccountId` to disambiguate.
    - If account does not exist → `code: 'unknown_account'`.
    - If account exists and `handle_canonical` matches the requested
      canonical → idempotent re-claim; returns
      `{ ok: true, value: existingClaim }` reconstructed from the row.
    - If account exists and `handle_canonical` is non-null and
      different → `code: 'handle_already_locked'`.
  - On PostgreSQL `code: '23505'` on `handle_canonical` (caught from
    the UPDATE itself if a concurrent INSERT/UPDATE for the same
    canonical from another account races): returns
    `code: 'handle_taken'`.
  - Never throws; all failure paths return `Result.ok = false`.
  - `// why:` idempotent-on-same-input behavior matches WP-052
    `assignReplayOwnership` precedent and makes the endpoint safe for
    network retries.

- `findAccountByHandle(canonicalHandle: string, database: DatabaseClient):
  Promise<PlayerAccount | null>`
  - Canonicalizes input defensively (`trim().toLowerCase()`) before the
    SQL parameter to avoid case-sensitive lookups, but performs **no
    format validation**. Callers must not rely on this function to
    reject invalid or reserved handles — it is a lookup, not a
    validator. Format-checking responsibilities belong to
    `validateHandleFormat`.
  - Returns the full `PlayerAccount` shape (re-used from WP-052) or
    `null` if no matching row.
  - Pure read; never mutates.

- `getHandleForAccount(accountId: AccountId, database: DatabaseClient):
  Promise<{ handleCanonical: string; displayHandle: string;
  handleLockedAt: string } | null>`
  - Returns `null` if the account does not exist OR has not yet claimed
    a handle (i.e., `handle_canonical IS NULL`).
  - Pure read.

### C) Database migration — new

`data/migrations/007_add_handle_to_players.sql`:
```sql
-- WP-101: add handle columns and partial unique index to legendary.players.
-- All DDL is idempotent per Foundation Prompt 02 / WP-052 precedent.

ALTER TABLE legendary.players
  ADD COLUMN IF NOT EXISTS handle_canonical text,
  ADD COLUMN IF NOT EXISTS display_handle   text,
  ADD COLUMN IF NOT EXISTS handle_locked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS legendary_players_handle_canonical_unique
  ON legendary.players (handle_canonical)
  WHERE handle_canonical IS NOT NULL;
```
- `// why:` partial unique index on `WHERE handle_canonical IS NOT NULL`
  permits multiple pre-claim rows with NULL handles while enforcing
  global uniqueness once any handle is claimed.
- `// why:` `ADD COLUMN IF NOT EXISTS` and
  `CREATE UNIQUE INDEX IF NOT EXISTS` mirror WP-052 idempotency
  precedent and let the migration runner safely re-execute.

### D) Tests — `apps/server/src/identity/handle.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No `boardgame.io` import.

**Suite wrapping (matches WP-052 PS-5 precedent):** all tests in this
file are wrapped in a single top-level `describe('handle logic
(WP-101)', ...)` block. This adds **+1 suite** to the server baseline.
Building on WP-052's +2 and WP-103's +1 (already landed), the server
suite total becomes **7** (6 → 7).

**Test count: 12 tests.**

**Net server test delta:** **+12 tests, +1 suite** (36 / 6 → 48 / 7).

1. `HANDLE_ERROR_CODES` array matches `HandleErrorCode` union (drift —
   forward and backward inclusion).
2. `RESERVED_HANDLES` matches the locked 15-entry alphabetical list
   verbatim.
3. `HANDLE_REGEX.source === '^[a-z][a-z0-9_]{2,23}$'` (drift on the
   regex itself).
4. `validateHandleFormat('Alice')` →
   `{ ok: true, value: { canonical: 'alice', display: 'Alice' } }`.
5. `validateHandleFormat('  Alice  ')` trims; canonical is `'alice'`,
   display is `'Alice'` (no internal trim).
6. `validateHandleFormat('ad')` →
   `{ ok: false, code: 'invalid_handle' }` (too short — 2 chars).
7. `validateHandleFormat('1abc')` →
   `{ ok: false, code: 'invalid_handle' }` (leading digit).
8. `validateHandleFormat('a__b')` →
   `{ ok: false, code: 'invalid_handle' }` (consecutive underscores).
9. `validateHandleFormat('Admin')` →
   `{ ok: false, code: 'reserved_handle' }` (canonicalizes to a
   reserved entry).
10. `claimHandle` succeeds against a fresh account: returns a
    `HandleClaim` with all four fields populated; subsequent SQL
    inspection shows the row's three new columns are non-NULL with
    matching values (requires test DB).
11. `claimHandle` is idempotent for `(accountId, canonical)` — second
    call with the same handle (or different casing of the same
    canonical) returns `{ ok: true, value }` matching the first;
    `handle_locked_at` is unchanged on the second call (requires test
    DB).
12. `claimHandle` returns `{ ok: false, code: 'handle_taken' }` when a
    second account submits a handle whose canonical form was already
    claimed by a different account (fixture: account A claims
    `'Alice'`; account B claims `'alice'`) (requires test DB).

Tests 10–12 require a test PostgreSQL database. If unavailable, mark
each with `{ skip: 'requires test database' }` (non-silent skip per
WP-052 precedent) — never silently omit. Tests 1–9 are pure and always
run.

---

## Out of Scope

- **No HTTP route wiring** — the claim endpoint that calls `claimHandle`
  belongs to a future request-handler WP.
- **No session validation implementation** — `requireAuthenticatedSession`
  is WP-112 (renumbered from "WP-100" per D-10002). Tests inject a
  fixture `AccountId` directly.
- **No auth provider integration** — Hanko vs `jsonwebtoken` selection
  is WP-099 governance.
- **No public profile page** — read-only `/players/{handle}` is the
  proposed WP-102.
- **No "handle availability" preview API** — `validateHandleFormat` is
  exposed for future use, but no endpoint is wired here.
- **No handle suggestion or auto-generation** — handles are user-typed
  only. No derivation from email, OAuth data, display name, or any
  other source.
- **No rename, admin override, or GDPR-motivated rename** — handles are
  immutable after claim. Account deletion (WP-052 `deletePlayerData`)
  removes the `legendary.players` row entirely; per the Non-Negotiable
  Constraints, no tombstone table preserves the canonical value, so a
  deleted handle naturally vanishes from the partial UNIQUE index and
  is technically re-claimable by a different account. Anti-impersonation
  reservation of deleted handles is **out of scope** for this packet
  and requires a future WP and `DECISIONS.md` entry if ever introduced.
- **No engine modifications** — `packages/game-engine/` is not touched.
- **No WP-052 contract modifications** — `identity.types.ts`,
  `identity.logic.ts`, migrations 004 and 005 are locked.
- **No leaderboard, scoring, or replay-ownership changes** — WP-027,
  WP-048, WP-051, WP-052, WP-053, WP-054 contracts are untouched.
- **No telemetry on handles** — handles never enter ranking inputs
  (Vision §25).
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/server/src/identity/handle.types.ts` — **new** — `HandleClaim`,
  `HandleErrorCode`, `HANDLE_ERROR_CODES`, `RESERVED_HANDLES`,
  `HANDLE_REGEX`
- `apps/server/src/identity/handle.logic.ts` — **new** —
  `validateHandleFormat`, `claimHandle`, `findAccountByHandle`,
  `getHandleForAccount`
- `apps/server/src/identity/handle.logic.test.ts` — **new** —
  `node:test` coverage (12 tests, 1 `describe()` block → +1 suite)
- `data/migrations/007_add_handle_to_players.sql` — **new** —
  `legendary.players` handle columns + partial unique index (idempotent
  DDL)

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Types & Constants
- [ ] `handle.types.ts` exports `HandleClaim` with exactly 4 fields:
      `accountId`, `handleCanonical`, `displayHandle`, `handleLockedAt`
- [ ] `Object.keys(handleClaim).sort()` drift test asserts the 4-field
      list verbatim
- [ ] `HandleErrorCode` is exactly
      `'invalid_handle' | 'reserved_handle' | 'handle_taken' |
      'handle_already_locked' | 'unknown_account'` — no other values
- [ ] `HANDLE_ERROR_CODES` matches the union (drift test, forward and
      backward inclusion)
- [ ] `RESERVED_HANDLES` matches the locked 15-entry alphabetical list
      verbatim
- [ ] `HANDLE_REGEX.source === '^[a-z][a-z0-9_]{2,23}$'`
- [ ] `Result<T>` is re-imported from `identity.types.ts` — no new
      parallel `Result` type defined in this packet

### Validation
- [ ] `validateHandleFormat` is pure (no DB access; no async)
- [ ] Trimming and lowercasing happen before reserved-set and regex
      checks
- [ ] Reserved-set check returns `code: 'reserved_handle'`, never
      `code: 'invalid_handle'`
- [ ] Regex failure returns `code: 'invalid_handle'`
- [ ] Consecutive-underscore rejection returns
      `code: 'invalid_handle'`
- [ ] Successful validation returns both `canonical` (lowercase) and
      `display` (trimmed but case-preserved) forms
- [ ] All `reason` strings are full sentences per Rule 11

### Claim Behavior
- [ ] `claimHandle` calls `validateHandleFormat` first and propagates
      failure unchanged
- [ ] On success the row's `handle_canonical`, `display_handle`, and
      `handle_locked_at` are all set in a single SQL statement (the
      locked idempotent UPDATE)
- [ ] `claimHandle` is idempotent for `(accountId, canonical)` —
      second call returns same `HandleClaim` and does not bump
      `handle_locked_at`
- [ ] Different handle for an already-claimed account returns
      `code: 'handle_already_locked'`
- [ ] Conflicting canonical handle from a different account returns
      `code: 'handle_taken'`
- [ ] Unknown `accountId` returns `code: 'unknown_account'`
- [ ] No `claimHandle` failure throws — every failure returns
      `Result.ok = false`
- [ ] No code path in this package mutates `handle_canonical`,
      `display_handle`, or `handle_locked_at` once they are non-NULL
      (verified by absence of any `UPDATE … SET handle_canonical` in
      `handle.logic.ts` outside the locked claim pattern)

### Database
- [ ] Migration `007_add_handle_to_players.sql` uses
      `ADD COLUMN IF NOT EXISTS` for all three columns
- [ ] A partial UNIQUE index on
      `handle_canonical WHERE handle_canonical IS NOT NULL` exists
- [ ] No FK or other relation references handle columns in this packet
- [ ] WP-052 migrations 004 and 005 are unchanged (verified via
      `git diff`)

### Layer Boundary
- [ ] No `boardgame.io` import in any new file (verified via
      `Select-String`)
- [ ] No `@legendary-arena/game-engine` import in any new file
      (verified via `Select-String`)
- [ ] No engine `PlayerId` import in any new file (verified via
      `Select-String`)
- [ ] No handle types in `packages/game-engine/` (verified via
      `Select-String`)
- [ ] No mutation of WP-052 contract files (verified via `git diff`)

### Tests
- [ ] All 12 tests pass (or DB-dependent tests are marked `skip` with
      reason)
- [ ] Test file uses `.test.ts` extension
- [ ] Test file uses `node:test` and `node:assert` only
- [ ] No `boardgame.io` import in test file
- [ ] Test file wraps tests in exactly one `describe()` block —
      server suite count increments by exactly **+1** (6 → 7)
- [ ] Server test count increments by exactly **+12** (36 → 48)
- [ ] Engine test baseline unchanged at **522 / 116 / 0**

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (verified via `git diff --name-only`)
- [ ] No `require()` in any generated file (verified via
      `Select-String`)
- [ ] `packages/game-engine/src/types.ts` not modified (verified via
      `git diff`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm test
# Expected: TAP output — all tests passing (or DB tests 10–12 skipped
#           with reason)
# Expected: engine 522 / 116 / 0 unchanged
# Expected: server 48 / 7 / 0 (or 48 with skips for DB tests 10–12)

# Step 3 — confirm no boardgame.io import in new files
Select-String -Path "apps\server\src\identity\handle*" -Pattern "from ['""]boardgame\.io" -Recurse
# Expected: no output

# Step 4 — confirm no engine import in new files
Select-String -Path "apps\server\src\identity\handle*" -Pattern "from ['""]@legendary-arena/game-engine" -Recurse
# Expected: no output

# Step 5 — confirm no require() in new files
Select-String -Path "apps\server\src\identity\handle*" -Pattern "require\(" -Recurse
# Expected: no output

# Step 6 — confirm no handle types leaked into game-engine
Select-String -Path "packages\game-engine\src" -Pattern "HandleClaim|HANDLE_ERROR_CODES|RESERVED_HANDLES|HANDLE_REGEX" -Recurse
# Expected: no output

# Step 7 — confirm idempotent DDL in migration (three ADD COLUMN lines)
Select-String -Path "data\migrations\007_add_handle_to_players.sql" -Pattern "ADD COLUMN IF NOT EXISTS"
# Expected: matches for handle_canonical, display_handle, handle_locked_at

# Step 8 — confirm partial unique index in migration
Select-String -Path "data\migrations\007_add_handle_to_players.sql" -Pattern "CREATE UNIQUE INDEX IF NOT EXISTS"
# Expected: at least one match
Select-String -Path "data\migrations\007_add_handle_to_players.sql" -Pattern "WHERE handle_canonical IS NOT NULL"
# Expected: at least one match

# Step 9 — confirm legendary.* namespace is preserved in migration
Select-String -Path "data\migrations\007_add_handle_to_players.sql" -Pattern "legendary\.players"
# Expected: at least one match

# Step 10 — confirm Result<T> is re-imported, not redeclared
Select-String -Path "apps\server\src\identity\handle.types.ts" -Pattern "type Result"
# Expected: no output (Result is imported, not redeclared)
Select-String -Path "apps\server\src\identity\handle.types.ts" -Pattern "import.*Result.*from.*identity\.types"
# Expected: at least one match (or equivalent with relative path)

# Step 11 — confirm no UPDATE of handle_* columns outside the claim path
Select-String -Path "apps\server\src\identity\handle.logic.ts" -Pattern "UPDATE legendary\.players"
# Expected: exactly one match (the locked claim SQL)

# Step 12 — confirm WP-052 contract files unchanged
git diff apps/server/src/identity/identity.types.ts
# Expected: no output
git diff apps/server/src/identity/identity.logic.ts
# Expected: no output

# Step 13 — confirm WP-052 migrations unchanged
git diff data/migrations/004_create_players_table.sql data/migrations/005_create_replay_ownership_table.sql
# Expected: no output

# Step 14 — confirm engine types.ts unchanged
git diff packages/game-engine/src/types.ts
# Expected: no output

# Step 15 — confirm only files in Files Expected to Change were modified
git diff --name-only
# Expected: only the 4 files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in
> `## Verification Steps` before checking any item below. Reading the
> code is not sufficient — run the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (all test files; DB tests may skip with
      reason)
- [ ] Engine baseline unchanged: **522 / 116 / 0**
- [ ] Server baseline post-execution: **48 / 7 / 0** (or **48 with
      skips** for DB-dependent tests 10–12)
- [ ] No `boardgame.io` import in any new file
- [ ] No `@legendary-arena/game-engine` import in any new file
- [ ] No `require()` in any generated file
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] WP-052 contract files (`identity.types.ts`, `identity.logic.ts`,
      migrations 004 and 005) are unchanged
- [ ] `packages/game-engine/src/types.ts` is unchanged
- [ ] Migration uses `legendary.*` namespace, idempotent DDL
      (`ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`),
      and a partial unique index on `WHERE handle_canonical IS NOT NULL`
- [ ] `docs/ai/STATUS.md` updated — handles can now be claimed; global
      uniqueness is enforced via partial unique index; reserved set and
      format regex are documented; rename, admin override, and recycling
      are permanently disallowed; the claim endpoint is intentionally
      not wired (deferred to a future request-handler WP)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-101 listed in the
      appropriate phase with today's date
