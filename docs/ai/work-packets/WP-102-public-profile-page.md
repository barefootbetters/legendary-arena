# WP-102 — Public Player Profile Page (Read-Only)

**Status:** Draft (drafted 2026-04-25; lint-gate self-review PASS — see §Lint Self-Review at foot; staleness sweep 2026-04-28 [post-WP-101 baselines + migration `007` → `008` for the WP-101 handle migration + WP-053 contract immutability added]; pre-flight 2026-04-28 surfaced PS-1 / PS-2 / PS-3 / PS-5 + 4 copilot RISK fixes — applied this session; pre-flight re-run pending)
**Primary Layer:** Server (read-only profile composition) + App (Vue SPA route + page)
**Dependencies:** WP-052 (identity model + `legendary.replay_ownership`); WP-101 (handle claim + `findAccountByHandle`, **landed 2026-04-28 at Commit B `7b92734`**). Soft-dep on WP-112 (session token validation; renumbered from "WP-100" per D-10002) — **not required to land first**, because this packet's only public endpoint is unauthenticated; the WP-112 contract is not invoked.

> **EC slot (2026-04-28 staleness sweep).** When the EC for this WP is
> drafted, it cannot use the `EC-102-*.checklist.md` slot —
> `EC-102-viewer-typecheck-cleanup.checklist.md` already occupies it
> (viewer-series namespace per the keystone-collision rule that drove
> the EC-101 → EC-114 retarget on 2026-04-27). Next free EC slot is
> **`EC-117`** (EC-115 = WP-109 deferred; EC-116 = registry-viewer URL
> setup-preview, both occupied). Provisional filename:
> `EC-117-public-profile-page.checklist.md`. WP number unchanged
> (still WP-102); only the EC slot moves. Follows the EC-103 → EC-111
> and EC-101 → EC-114 retarget precedent.

---

## Session Context

WP-101 (drafted 2026-04-25; landed 2026-04-28) introduced an
immutable, globally unique, URL-safe `handle` to `legendary.players`
via migration `008` (slot retargeted `007` → `008` on 2026-04-27 per
WP-053 consuming slot `007`), and
exported `findAccountByHandle(canonicalHandle, database) →
PlayerAccount | null` and `getHandleForAccount(accountId, database) →
{ handleCanonical, displayHandle, handleLockedAt } | null` from the new
`apps/server/src/identity/handle.logic.ts`. WP-101 explicitly
**deferred** the public profile surface to WP-102 (the present packet)
and locked two complementary public-surface invariants that WP-102
must honor verbatim: (1) per `DESIGN-RANKING.md` lines 485–487,
rankings use `AccountId` (the stable player ID), never the handle;
(2) per WP-101 §"Public surfaces must not treat handle as a stable
identity key", `/players/{handle}` MUST dereference handle → `AccountId`
at request time and treat the handle as a presentation alias that may
be reused by a different account after WP-052 `deletePlayerData`
(no-tombstone policy).

This packet is the **first WP to expose handles in HTTP** and the
**first profile surface in the Vue SPA**. Scope is intentionally narrow:
a public, read-only `/players/:handle` page that shows the current
account's display name, the canonical handle, the handle-locked
timestamp, and the player's public-or-link-visible, unexpired replay
list (composed from `legendary.replay_ownership` per WP-052). All
other profile surfaces — owner edit (`/me`), avatar upload, badges,
tournaments, comments, anti-cheat integrity, payments — are deferred
to WP-104 through WP-108+ and explicitly out of scope here.

No new database tables. No new migrations. No new npm dependencies.
No write paths. No authenticated endpoints. No engine, registry, or
pre-planning code touched.

**Terminology** (referenced throughout this WP without re-definition):

- **`AccountId`** — the stable cross-service logical identity per
  WP-052 / D-5201; branded UUID v4 (`string & { __brand: 'AccountId' }`)
  generated server-side from `node:crypto.randomUUID()`. Maps 1:1 to
  `legendary.players.ext_id text UNIQUE`. The authoritative key for
  ranking, authorization, replay ownership, and any future cross-WP
  reference.
- **`player_id`** — the internal `bigserial PK` on
  `legendary.players`. Used **only** for FK joins (e.g.,
  `legendary.replay_ownership.player_id`,
  `legendary.competitive_scores.player_id`). Never exposed at the
  application surface; never serialized to clients; never used as an
  identity key in any DTO produced by this packet.
- **`handle`** (per WP-101) — the immutable, globally unique,
  URL-safe presentation alias. WP-102 dereferences `handle` →
  `AccountId` per request via `findAccountByHandle`; routing,
  attribution, and authorization NEVER key on the handle directly
  (no-tombstone policy + reclaim risk).

---

## Goal

After this session, an unauthenticated visitor can navigate to
`https://<arena-host>/?profile=<handle>` (where `<handle>` is any
canonicalized handle claimed under WP-101) and see a read-only profile
page that composes data from `legendary.players` and
`legendary.replay_ownership` via a single new HTTP endpoint
`GET /api/players/:handle/profile`. Unknown or unclaimed handles
return HTTP 404 with the locked body
`{ "error": "player_not_found" }` (no information leak distinguishing
unclaimed vs deleted vs reserved handles) and render an empty-state
"no such player" page.
Surfaces that have no upstream system yet (rank, badges, tournaments,
comments, integrity, support) render as locked **empty-state stubs**
labelled "Coming soon — see [WP-NNN]" and produce no requests.

> **Routing note (per pre-flight 2026-04-28 PS-2 resolution).**
> arena-client uses a hand-rolled query-string router in `App.vue`
> (`type AppRoute = 'fixture' | 'live' | 'lobby'`); `vue-router` is
> not installed and adding it is out of scope per WP-102 §Goal "No
> new npm dependencies". The public-profile surface therefore
> extends `AppRoute` with `'profile'` and consumes the canonical
> handle from a `?profile=<canonical>` query parameter. A future
> routing-WP that introduces `vue-router` may upgrade the URL shape
> to the path-based `/players/:handle` form referenced in
> `DESIGN-RANKING.md` and earlier WP drafts; WP-102 itself ships
> the query-string variant.

Concretely:

- `apps/server/src/profile/` ships `profile.types.ts`,
  `profile.logic.ts`, `profile.routes.ts`, and `profile.logic.test.ts`.
- A new HTTP handler `GET /api/players/:handle/profile` is registered
  on the existing Koa router (boardgame.io's `server.router` from
  `apps/server/src/server.mjs`; mirrors `registerHealthRoute(server.router)`
  precedent at `server.mjs:30–34, :120`) and returns a `PublicProfileView`
  JSON body or 404 (no body details on 404 — see §Locked contract values).
- `apps/arena-client/src/App.vue` extends `AppRoute` with `'profile'`,
  parses `?profile=<canonical>` from the URL, and conditionally renders
  `<PlayerProfilePage :handle="canonical" />` when `route === 'profile'`.
- `apps/arena-client/src/lib/api/profileApi.ts` exposes a typed
  `fetchPublicProfile(handle)` wrapper.
- The page renders display name, canonical handle (as the URL slug),
  handle-locked-at timestamp, and the public-or-link-visible,
  unexpired replay list. Empty-state stubs for future surfaces are
  inert — they make zero network requests.

**Invariant locked here:** every server response and every client
render dereferences handle → `AccountId` exactly once at the point of
use, and never caches a `(handle, content)` association beyond
request scope. Per WP-101 §"Public surfaces must not treat handle
as a stable identity key", a deleted-and-reclaimed handle MUST NOT
serve a previous account's content under any code path introduced
here.

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. This WP
> touches player identity (Vision §3, §11), replay surfacing (§18,
> §22, §24), and a competitive-trust public surface — Vision Alignment
> is mandatory.

**Vision clauses touched:** §3 (Player Trust & Fairness), §11 (Stateless
Client Philosophy), §14 (Explicit Decisions, No Silent Drift), §18
(Replayability & Spectation), §22 (Replay determinism), §24 (Replay-
Verified Competitive Integrity), §25 (Skill Over Repetition —
Non-Ranking Telemetry Carve-Out), Non-Goals NG-1, NG-3, NG-6.

**Conflict assertion:** **No conflict: this WP preserves all touched
clauses.**

- **§3 Player Trust & Fairness.** The page surfaces only audit
  outputs (claimed handle, display name, public replay references)
  and never influences gameplay outcomes. Visibility is opt-in:
  `legendary.replay_ownership.visibility` defaults to `'private'`
  per WP-052, so an account that never opts replays into `'public'`
  or `'link'` shows an empty replay list — never a leak.
- **§11 Stateless Client Philosophy.** The Vue SPA fetches a
  server-composed projection on mount and re-fetches on route
  change; it carries no profile state beyond what the server
  authoritatively returned. No client-side merging of historical
  responses; no localStorage profile cache.
- **§14 Explicit Decisions, No Silent Drift.** The handle-as-
  presentation-alias rule, the no-tombstone reuse implication, and
  the handle → `AccountId` dereference invariant are recorded
  verbatim in §Non-Negotiable Constraints rather than left as
  implementation lore.
- **§18 Replayability & Spectation.** Public profile surfaces a
  player's `'public'` and `'link'` replays so spectators can find
  and replay them. Excluded: `'private'` replays and any replay
  whose `expires_at` has passed.
- **§22 Replay determinism.** This WP renders replay metadata only
  (`replayHash`, `scenarioKey`, `createdAt`, `visibility`); it does
  not load, hash, simulate, or verify replays. Determinism guarantees
  established by WP-027 / WP-053 / WP-103 are preserved by
  construction — this packet is a read-only display surface above
  the replay layer and never touches `G`, `ctx`, RNG, or any engine
  code path.
- **§24 Replay-Verified Competitive Integrity.** No ranking input is
  exposed or computed here. Per `DESIGN-RANKING.md` lines 485–487,
  rankings use `AccountId` (stable player ID), never the handle.
  The "Rank" empty-state stub does not display anything that could
  be construed as a leaderboard standing.
- **§25 Non-Ranking Telemetry Carve-Out.** Display of the handle on
  a profile page is non-ranking telemetry. The ranking-identity
  invariant is preserved.

**Non-Goal proximity check:** Confirmed clear.

- **NG-1 (pay-to-win):** No paid surface, no payment integration, no
  gating of any feature on payment. Empty-state "Support" tab is
  inert and makes no requests.
- **NG-3 (content withheld):** No content gated. The page serves
  publicly opted-in data only; no hero, scenario, rule, or replay
  is hidden behind authentication or a paywall.
- **NG-6 (dark patterns):** No FOMO timers, no upsell prompts, no
  manipulative re-prompts. Page is purely informational.
- **NG-2, NG-4, NG-5, NG-7:** N/A — no randomized purchases, energy,
  ads, or apologetic monetization on this surface.

**Funding Surface Gate (00.3 §20 — drafted by WP-098, pending
landing):** **N/A.** This WP does not touch any §A or §B surface
defined by WP-097 §F. Empty-state "Support" tab is inert (no
network requests, no schema, no donation/subscription/tournament-
funding affordance) and does not constitute a funding surface.
Justification: no UI affordance for donation, subscription, or
tournament-funding payment is present — the tab renders only the
text "Coming soon — see WP-108".

**Determinism preservation:** Replay metadata is read-only display.
No engine code path executes. `G` and `ctx` are never touched. The
replay loader (WP-103) and replay verification (WP-053) are not
invoked. Determinism guarantees are preserved by construction.

---

## Assumes

- **WP-052 complete.** Specifically:
  - `apps/server/src/identity/identity.types.ts` exports `AccountId`,
    `PlayerAccount` (7 fields including `displayName`), `Result<T>`,
    `IdentityErrorCode`, and `DatabaseClient`.
  - `apps/server/src/identity/identity.logic.ts` exports
    `findPlayerByAccountId`.
  - `data/migrations/004_create_players_table.sql` is applied.
  - `data/migrations/005_create_replay_ownership_table.sql` is
    applied; `legendary.replay_ownership` has columns
    `(ownership_id bigserial, player_id bigint FK,
    replay_hash text, scenario_key text, visibility text DEFAULT
    'private', created_at timestamptz, expires_at timestamptz NULL)`
    with `UNIQUE (player_id, replay_hash)`.
  - `ReplayVisibility = 'private' | 'link' | 'public'` and
    `REPLAY_VISIBILITY_VALUES` exported from
    `apps/server/src/identity/identity.types.ts` (or wherever
    WP-052 placed them).
- **WP-101 complete.** Specifically:
  - `apps/server/src/identity/handle.types.ts` exports
    `HandleClaim`, `HANDLE_REGEX`, `RESERVED_HANDLES`,
    `HANDLE_ERROR_CODES`.
  - `apps/server/src/identity/handle.logic.ts` exports
    `findAccountByHandle(canonicalHandle, database) →
    Promise<PlayerAccount | null>` and `getHandleForAccount(accountId,
    database) → Promise<{ handleCanonical, displayHandle,
    handleLockedAt } | null>`.
  - Migration `008_add_handle_to_players.sql` is applied;
    `legendary.players` has `handle_canonical text`, `display_handle
    text`, `handle_locked_at timestamptz` and the partial UNIQUE
    index on `WHERE handle_canonical IS NOT NULL`.
- **arena-client framework.** WP-061 / WP-090 / WP-092 have shipped
  the Vue SPA harness with Vue Router; `apps/arena-client/src/router/`
  exists and exports a router config; `apps/arena-client/src/pages/`
  is the established page-component location; `apps/arena-client/src/lib/`
  is the established library location for non-component utilities.
  If any of those paths differ at execution time, the executor
  reconciles via pre-flight rather than guessing.
- **Koa router (boardgame.io v0.50).** Pre-flight 2026-04-28 PS-1
  resolved the framework: there is **no Express** in this codebase.
  boardgame.io's `Server({...})` (constructed at
  `apps/server/src/server.mjs:110–118`) returns a Koa application
  whose `server.router` is an `@koa/router` instance. New REST
  handlers register on that router via the
  `registerHealthRoute(server.router)` precedent at
  `server.mjs:30–34`. The registration call site is the same line
  that registers `/health` (line ~120).
- **No `legendary.players.deleted_at` column exists.** WP-052
  `deletePlayerData` deletes the row; there is no soft-delete
  marker. Therefore `findAccountByHandle` returning a non-null row
  is sufficient evidence that the account currently owns the handle.
- **Test database fixture.** Server tests follow the locked WP-052
  pattern `hasTestDatabase ? {} : { skip: 'requires test database' }`
  for DB-dependent cases; pure cases always run.
- **`pnpm -r build` exits 0** post-WP-101 baseline.
- **`pnpm test` baselines** at WP-101 close (verified 2026-04-28 at
  Commit B `7b92734`): engine `570 / 126 / 0`; server `63 / 9 / 0`
  (with skips for the WP-052 / WP-103 / WP-053 / WP-101 DB-dependent
  tests when `TEST_DATABASE_URL` is unset). WP-102 must re-verify
  these at pre-flight time. The pre-WP-101 staleness-sweep prediction
  of `522 / 116 / 0` + `48 / 7 / 0` was retargeted to the post-
  WP-113 floor `570 / 126 / 0` + `51 / 8 / 0` on 2026-04-27 (via the
  WP-101 staleness sweep at `2bfc64b`); WP-101 then added `+12 / +1`,
  yielding the current `63 / 9 / 0` server floor.

If any of the above is false, this packet is **BLOCKED** and must
not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §"Layer Boundary (Authoritative)"` —
  confirms `apps/server/**` may import `packages/registry/**` and
  `packages/game-engine/**` types but not `packages/preplan/**`;
  `apps/arena-client/**` may not import engine or registry runtime
  code. WP-102 honors both: server code reads PostgreSQL only;
  client code calls HTTP only.
- `docs/ai/ARCHITECTURE.md §"Persistence Boundaries"` — `G` and
  `ctx` are runtime-only; profile state is server-layer access
  metadata, never engine state. WP-102 introduces no engine touch.
- `.claude/rules/architecture.md §"Layer Boundary"` — runtime
  enforcement of the above. The per-package import table forbids
  arena-client from importing `game-engine` runtime; WP-102 imports
  only via fetch.
- `docs/ai/work-packets/WP-052-player-identity-replay-ownership.md
  §Scope (In) C and §Locked contract values` — read the
  `ReplayOwnershipRecord` shape (`ownershipId`, `accountId`,
  `replayHash`, `scenarioKey`, `visibility`, `createdAt`,
  `expiresAt`), the `ReplayVisibility` enum (`'private' | 'link' |
  'public'`), and the `replay_ownership` SQL shape verbatim. This
  WP queries that table and must filter by `visibility IN ('public',
  'link') AND (expires_at IS NULL OR expires_at > now())`.
- `docs/ai/work-packets/WP-101-handle-claim-flow.md
  §Non-Negotiable Constraints "Public surfaces must not treat handle
  as a stable identity key"` — read verbatim. This WP-102 implements
  the dereference rule. Any code path that caches `(handle, content)`
  beyond request scope is a violation.
- `docs/ai/work-packets/WP-101-handle-claim-flow.md §Scope (In) B` —
  read the `findAccountByHandle` signature and contract. WP-102
  consumes it without modification.
- `docs/01-VISION.md §3, §11, §14, §18, §22, §24, §25` — Vision
  clauses cited above. The §25 non-ranking telemetry carve-out is
  the basis for displaying handles on profiles without violating the
  ranking-identity invariant.
- `docs/01-VISION.md §"Non-Goals: Exploitative Monetization"`
  (NG-1..NG-7) — none crossed; explicit empty-state for "Support"
  tab is intentionally inert to avoid NG-1 / NG-6 surface.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §11
  (Authentication Clarity)` — N/A: this WP defines no authenticated
  endpoint. The single endpoint is public.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17, §20` —
  Vision Alignment block + Funding Surface Gate applicability
  declaration are both required and present.
- `docs/ai/REFERENCE/00.6-code-style.md` — full English words,
  `// why:` comments where needed, no `.reduce()` for branching
  loops, JSDoc on every function, named imports only, full-sentence
  error messages.
- `docs/ai/REFERENCE/00.2-data-requirements.md §1` — PostgreSQL
  namespace is `legendary.*`; cross-service IDs use `ext_id text`.
  WP-102 reads existing tables only and conforms by construction.
- `docs/ai/DECISIONS.md` — scan recent entries (D-9601, D-9701,
  D-9901..D-9905, and any handle-related decisions landed under
  WP-101) to confirm the current state of identity/handle/funding
  governance before drafting.
- `docs/13-REPLAYS-REFERENCE.md` — confirm the visibility and
  expiration semantics this packet must honor on the read path.
  The "Permanent shareable replay links" anticipation (line 248) is
  consistent with surfacing `'link'` and `'public'` replays here.
- `.claude/rules/work-packets.md` — one packet per session,
  dependency discipline, status updates only at full DoD.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all engine randomness uses
  `ctx.random.*` only. **N/A here** (no engine touch); rule
  preserved for template completeness.
- Never throw inside boardgame.io move functions — return void on
  invalid input. **N/A here** (no moves introduced); rule preserved.
- Never persist `G`, `ctx`, or any runtime state — see
  `docs/ai/ARCHITECTURE.md §Persistence Boundaries`. **N/A here**
  (no engine state touched).
- `G` must be JSON-serializable at all times — no class instances,
  Maps, Sets, or functions. **N/A here**.
- `.reduce()` is forbidden in zone operations and effect application.
  In WP-102 specifically, `.reduce()` must NOT be used to compose
  the public profile view; use explicit `for...of` loops.
- ESM only, Node v22+ — all new files use `import`/`export`, never
  `require()`.
- `node:` prefix on all Node.js built-in imports (`node:test`,
  `node:assert`, `node:crypto`, etc.).
- Test files use `.test.ts` extension — never `.test.mjs`.
- No database or network access inside move functions or pure
  helpers. **N/A here** (no moves).
- Full file contents required for every new or modified file in the
  output — no diffs, no snippets, no "show only the changed section".
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- **Handle is a presentation alias, not a stable identity key.**
  Every server code path under `apps/server/src/profile/` MUST call
  `findAccountByHandle(canonicalHandle, database)` once at request
  time and use the returned `PlayerAccount.accountId` for every
  subsequent join, query, or attribution. No code path may cache
  `(handle, accountId)` or `(handle, content)` associations beyond
  the lifetime of a single HTTP request. Per WP-101's no-tombstone
  policy, a handle reclaimed by a different account after deletion
  MUST NOT serve the prior account's content under any condition.
- **Rankings use `AccountId`, never the handle.** Per
  `DESIGN-RANKING.md` lines 485–487. The "Rank" empty-state stub on
  the profile page must not display anything that could be construed
  as a leaderboard standing. When WP-054/WP-055 land and feed
  rank data into this surface (a future WP — not WP-102), the
  ranking source MUST be keyed on `AccountId`.
- **Read-only against `legendary.players` and
  `legendary.replay_ownership`.** No `INSERT`, `UPDATE`, or `DELETE`
  in any new file. Verified via grep for SQL keywords in
  verification steps.
- **No new tables, no new migrations.** WP-102 introduces no schema
  change. Owner editing tables (profile, links, badges, etc.) are
  WP-104+.
- **No write paths.** No HTTP `POST`, `PUT`, `PATCH`, or `DELETE`
  handlers introduced. The single new endpoint is `GET
  /api/players/:handle/profile`.
- **No authenticated endpoint.** The endpoint is public; no
  `requireAuthenticatedSession` import, no WP-112 contract
  invocation (WP-112 renumbered from "WP-100" per D-10002).
  Owner-only views (`/me`, profile editing) are WP-104+.
- **Empty-state stubs make zero network requests.** The
  rank/badges/tournaments/comments/integrity/support tabs render
  static "Coming soon — see WP-NNN" text. They MUST NOT call any
  fetch / XHR / WebSocket. Verified via grep on the page component.
- **No engine import.** No file under `apps/server/src/profile/` or
  `apps/arena-client/src/pages/PlayerProfilePage.vue` /
  `apps/arena-client/src/lib/api/profileApi.ts` may import
  `boardgame.io`, `@legendary-arena/game-engine`, or
  `@legendary-arena/registry`. Verified via `Select-String` in
  verification steps.
- **No pre-planning import.** `packages/preplan/**` is not imported
  from any WP-102 file. Verified.
- **No Hanko reference.** Per WP-099 D-9904, Hanko-specific code
  lives only under `apps/server/src/auth/hanko/` (not yet created).
  WP-102 introduces no Hanko import, type, string literal, or
  fixture.
- **No `'hanko'` as `auth_provider` value.** Per WP-099 D-9902. The
  profile view never echoes `auth_provider`; this is enforced by
  the `PublicProfileView` shape (see Locked contract values).
- **`PublicProfileView` excludes private fields.** The DTO MUST NOT
  include `email`, `auth_provider`, `auth_provider_id`, `account_id`
  (the `AccountId` is server-internal — handle is the public
  identifier on this surface), or `created_at` from
  `PlayerAccount`. Verified via the DTO drift test.
- **Replay list filter is locked.** Server-side SQL filters by
  `visibility IN ('public', 'link') AND (expires_at IS NULL OR
  expires_at > now())`. The `'private'` value MUST NOT appear in
  the response. Verified via test.
- **404 body discipline.** Unknown handle returns HTTP 404 with the
  body `{ "error": "player_not_found" }` — no information about
  whether the handle was unclaimed, deleted, or reserved. Verified
  via test.
- **WP-052 contract files NOT modified.** `identity.types.ts`,
  `identity.logic.ts`, migrations 004 and 005 are locked.
- **WP-101 contract files NOT modified.** `handle.types.ts`,
  `handle.logic.ts`, migration 008 are locked.
- **WP-103 contract files NOT modified.** `replay.types.ts`,
  `replay.logic.ts`, migration 006 are locked. WP-102 does not
  load replay payloads — only metadata from
  `legendary.replay_ownership`.
- **WP-053 contract files NOT modified.** `competition.types.ts`,
  `competition.logic.ts`, migration 007 are locked. WP-102 does not
  read or expose competitive scores — the "Rank" empty-state tab is
  inert.
- **`packages/game-engine/src/types.ts` NOT modified.**
- **No new npm dependencies.** All wiring uses Node's built-in
  `fetch`, the existing Vue 3 / Pinia stack (no `vue-router`), and
  the existing `pg` client. Verified via `git diff` of every
  `package.json` and `pnpm-lock.yaml` after Commit A. Pre-flight
  2026-04-28 PS-2 confirmed `apps/arena-client/package.json` lists
  only `vue ^3.4.27` and `pinia ^2.1.7` — no `vue-router` —
  motivating the `App.vue` query-string router pattern.
- **Lifecycle prohibition (locked, copilot-check 2026-04-28 RISK
  #16 fix).** The four exported profile-layer functions
  (`getPublicProfileByHandle`, `loadPlayerIdByAccountId`,
  `registerProfileRoutes`, plus the implicit consumer surface
  `fetchPublicProfile` on the client) MUST NOT be called from:
  `game.ts`, any `LegendaryGame.moves` entry, any phase hook
  (`onBegin` / `onEnd` / `endIf`), any file under `packages/`
  (`game-engine`, `registry`, `preplan`, `vue-sfc-loader`), any
  file under `apps/replay-producer/` or `apps/registry-viewer/`,
  any file under `apps/server/src/identity/`,
  `apps/server/src/replay/`, `apps/server/src/competition/`,
  `apps/server/src/par/`, `apps/server/src/rules/`,
  `apps/server/src/game/`. They are consumed only by their own
  test file (`profile.logic.test.ts`), by `profile.routes.ts`
  (route adapter), by `apps/server/src/server.mjs` (one-line
  registration call per PS-3), and by
  `apps/arena-client/src/pages/PlayerProfilePage.vue` (via
  `profileApi.ts`). Mirrors the WP-101 / EC-114 lifecycle-prohibition
  precedent.
- **Aliasing prevention (locked, copilot-check 2026-04-28 RISK
  #17 fix).** `getPublicProfileByHandle` constructs a fresh
  `PublicProfileView` literal on every call. The `publicReplays`
  array is built via an explicit `for (const row of rows)` loop
  with a fresh `PublicReplaySummary` literal per row — never via
  `result.rows` passthrough, never via `result.rows.map(row => row)`
  identity-map, never via spread of a `pg`-driver row object. The
  returned array is owned by the caller; no internal cache holds
  a reference to it. (This rule is defense-in-depth: `pg` returns
  fresh JS objects per query so the row-level aliasing risk is
  low at MVP scope, but a future caching layer must `Object.freeze()`
  the cached value to preserve the invariant.)
- **Visibility-row narrowing (locked, copilot-check 2026-04-28
  RISK #10 fix).** For each row from the locked SQL filter, the
  application layer MUST narrow `row.visibility` with an explicit
  guard `if (row.visibility !== 'public' && row.visibility !==
  'link') { continue; }` before constructing the `PublicReplaySummary`
  literal. The SQL `visibility IN ('public', 'link')` clause is the
  authoritative gate; the application-layer guard is defense-in-depth
  so the type-level exclusion of `'private'` survives any future SQL
  relaxation (e.g., a future `visibility != 'private'` rewrite that
  would also include unknown future values).
- **Directory classification gap acknowledged.** Introducing
  `apps/server/src/profile/` mirrors WP-103's introduction of
  `apps/server/src/replay/` (D-10301). A corresponding D-entry is
  required and is included in §Definition of Done. The pre-flight
  bundle MUST surface this as an explicit item per the WP-103 / PS-2
  precedent.

**Session protocol:**
- The pre-flight 2026-04-28 already resolved the framework / router
  / entry-point gaps (PS-1 Koa, PS-2 query-string router, PS-3
  `server.mjs`). If the executor encounters drift from these
  resolutions at execution time (e.g., `vue-router` has been added,
  Express has been introduced, `server.mjs` has been replaced),
  **STOP** and re-run pre-flight rather than guessing.
- If WP-101 has not landed (`findAccountByHandle` not exported), the
  packet is BLOCKED — do not proceed by stubbing or copy-pasting
  the function signature.
- If during execution the read-only invariant cannot be maintained
  (e.g., a discovered code path requires a write), **STOP** and ask
  the human; do not silently expand scope.

**Locked contract values:**

- **HTTP route (locked):** `GET /api/players/:handle/profile`
  - Registered on the existing **Koa router** returned by
    boardgame.io's `Server({...})` instance (see
    `apps/server/src/server.mjs:110–120`); mirrors the
    `registerHealthRoute(server.router)` precedent at
    `server.mjs:30–34`. **Express is not present in this codebase** —
    pre-flight 2026-04-28 PS-1.
  - Response 200: `koaContext.body = value` (Koa serializes JSON
    automatically when the body is a plain object; matches the
    `/health` precedent).
  - Response 404: `koaContext.status = 404; koaContext.body = { error:
    'player_not_found' };` — no further details.
  - Response 500: `koaContext.status = 500; koaContext.body = { error:
    'internal_error' };` (no body detail beyond the literal code) on
    any thrown PostgreSQL infra error from `getPublicProfileByHandle`.
    The handler swallows the error after the response is set; never
    re-throws to a global Koa handler.
  - No other status codes introduced by this packet. Never 401 / 403
    — the endpoint is intentionally public.

- **`PublicProfileView` shape (locked, 4 fields):**
  ```ts
  interface PublicProfileView {
    handleCanonical: string;
    displayHandle: string;
    displayName: string;
    publicReplays: PublicReplaySummary[];
  }

  interface PublicReplaySummary {
    replayHash: string;
    scenarioKey: string;
    visibility: 'public' | 'link';
    createdAt: string;
  }
  ```
  - `// why:` `accountId` is intentionally absent — handle is the
    public identifier on this surface; exposing `AccountId` would
    leak the server-internal stable ID per WP-052 D-5201.
  - `// why:` `expiresAt` is intentionally absent from
    `PublicReplaySummary` — the server filters out expired entries
    before returning, so clients never see expiration timestamps and
    cannot rely on them for caching.
  - `// why:` `'private'` is intentionally absent from the
    `visibility` union on `PublicReplaySummary` — the server-side
    filter guarantees private replays never appear in the response.

- **Server filter SQL (locked):**
  ```sql
  SELECT replay_hash, scenario_key, visibility, created_at
  FROM legendary.replay_ownership
  WHERE player_id = $1
    AND visibility IN ('public', 'link')
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC;
  ```

- **`ProfileResult<T>` shape (locked, declared locally — pre-flight
  PS-5):**
  ```ts
  type ProfileResult<T> =
    | { ok: true; value: T }
    | { ok: false; reason: string; code: ProfileErrorCode };
  ```
  - `// why:` declared locally in `profile.types.ts`, **NOT** re-imported
    from `../identity/identity.types.js`. WP-052's `Result<T>` is
    keyed on `IdentityErrorCode` (4 values: `'duplicate_email'`,
    `'invalid_email'`, `'invalid_display_name'`, `'unknown_account'`)
    and cannot carry `'player_not_found'`. The shape mirrors WP-052's
    `Result<T>` exactly — same `ok` discriminant, same `value` /
    `reason` / `code` fields — but with the profile-side error union.
    `AccountId`, `PlayerAccount`, `DatabaseClient` are still
    re-imported from `../identity/identity.types.js` (no parallel
    declarations).
  - Pre-flight 2026-04-28 surfaced this as PS-5 — earlier WP-102
    drafts (and EC-117 §Locked Values) said "re-import `Result<T>`",
    which is technically incompatible with `ProfileErrorCode`.

- **Vue surface (locked, query-string router — pre-flight PS-2):**
  `?profile=<handle>` query parameter on the arena-client root URL.
  `App.vue` parses the URL with the existing `parseQuery()` helper,
  extends `type AppRoute` with `'profile'`, and conditionally renders
  `<PlayerProfilePage :handle="canonical" />` when `route ===
  'profile'`. Public; no authentication guard. **No `vue-router`** —
  `apps/arena-client/package.json` does not depend on `vue-router`,
  and adding it is out of scope per WP-102 §Goal "No new npm
  dependencies".

- **Empty-state tab labels (locked, 6 entries):**
  - "Rank — coming soon (WP-054 / WP-055)"
  - "Badges — coming soon (WP-105)"
  - "Tournaments — coming soon"
  - "Comments — coming soon"
  - "Integrity — coming soon (WP-107+)"
  - "Support — coming soon (WP-108+)"

- **Module path (locked):** `apps/server/src/profile/` —
  classification mirrors WP-103's `apps/server/src/replay/`
  (D-10301) and WP-052's `apps/server/src/identity/` (D-5202). A
  new D-entry is required at WP-102 execution.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via
deterministic reproduction and SQL inspection. Logging and "printf
debugging" are not acceptable diagnostic strategies.

The following requirements are mandatory:

- Behavior introduced by this packet must be fully reproducible given:
  - identical database state in `legendary.players` and
    `legendary.replay_ownership`
  - identical handle path parameter in the HTTP request
  - identical server clock (only relevant for the `expires_at >
    now()` filter; tests pin a fixed `now()` via fixture rows whose
    `expires_at` is far in the past or future)

- Execution must be externally observable via:
  - HTTP response body inspection (200 with `PublicProfileView` or
    404 with the locked error body)
  - SQL inspection of the underlying tables (which is unaffected —
    this packet writes nothing)

- This packet must not introduce any state mutation. The following
  invariants must always hold after execution:
  - No row in `legendary.players` is changed by any code path under
    `apps/server/src/profile/`.
  - No row in `legendary.replay_ownership` is changed by any code
    path under `apps/server/src/profile/`.
  - The HTTP response for an unknown handle is identical to the
    response for a deleted-account handle (no information leak).

- Failures attributable to this packet must be localizable via:
  - violation of the read-only invariant (any `INSERT`/`UPDATE`/
    `DELETE` introduced — verification step catches this)
  - violation of the visibility filter (any `'private'` value in a
    response body — test catches this)

---

## Scope (In)

### A) `apps/server/src/profile/profile.types.ts` — new

- `interface PublicProfileView { handleCanonical: string;
  displayHandle: string; displayName: string;
  publicReplays: PublicReplaySummary[] }`
  - `// why:` 4-field shape locked; rename or addition requires a
    `DECISIONS.md` entry. `accountId` intentionally absent (WP-052
    D-5201 — `AccountId` is server-internal).
- `interface PublicReplaySummary { replayHash: string;
  scenarioKey: string; visibility: 'public' | 'link';
  createdAt: string }`
  - `// why:` `'private'` intentionally absent from the visibility
    union — the server-side filter guarantees private replays never
    appear in the response, so the public-facing type expresses
    that guarantee at the type level.
  - `// why:` `expiresAt` intentionally absent — server filters
    expired entries before returning.
- `type ProfileErrorCode = 'player_not_found'`
  - Single-value union for now. The handler maps every "no such
    handle" case to this single code; expanding the union requires
    a new packet and a `DECISIONS.md` entry.
- `PROFILE_ERROR_CODES: readonly ProfileErrorCode[]` — canonical
  array with drift-detection test.
- Declares `type ProfileResult<T>` locally (see §Locked contract
  values). The shape mirrors WP-052's `Result<T>` but is keyed on
  `ProfileErrorCode`, not `IdentityErrorCode`.
- Re-imports `AccountId`, `PlayerAccount`, and `DatabaseClient` from
  `../identity/identity.types.js`. Does NOT redeclare these three
  types. **Does NOT re-import `Result<T>`** — `Result<T>`'s error
  branch is locked to `IdentityErrorCode`, which cannot carry
  `'player_not_found'` (pre-flight 2026-04-28 PS-5).

### B) `apps/server/src/profile/profile.logic.ts` — new

All exports take `database: DatabaseClient` (caller-injected,
mirrors WP-052's pattern).

- `getPublicProfileByHandle(rawHandle: string, database:
  DatabaseClient): Promise<ProfileResult<PublicProfileView>>`
  - Canonicalizes input first (`rawHandle.trim().toLowerCase()`).
  - Calls `findAccountByHandle(canonical, database)` from WP-101.
  - If `null` → returns `{ ok: false, code: 'player_not_found',
    reason: 'No player has claimed the handle "<canonical>".' }`.
  - If non-null → resolves the player's `bigserial player_id` via
    a single follow-up query on `legendary.players` keyed by the
    returned `accountId` (the WP-052 internal mapping), then runs
    the locked replay-filter SQL keyed on `player_id`.
  - Iterates the SQL rows with an explicit `for (const row of rows)`
    loop (no `.reduce()`) and **constructs a fresh
    `PublicReplaySummary` literal per row** — never aliases or
    spreads a `pg`-driver row object into the returned array
    (copilot-check 2026-04-28 RISK #17 fix).
  - **Per-row visibility narrowing (locked, copilot-check RISK #10
    fix):** for each row from the locked SQL, the application layer
    MUST narrow `row.visibility` with an explicit guard
    `if (row.visibility !== 'public' && row.visibility !== 'link') {
    continue; /* skip and emit a warning */ }`. The SQL
    `visibility IN ('public', 'link')` filter is the authoritative
    gate; the application-layer guard is defense-in-depth so the
    type-level exclusion of `'private'` survives any future SQL
    relaxation.
  - Composes and returns the `PublicProfileView` as a fresh literal.
    The returned `publicReplays` array is owned by the caller and is
    never aliased to internal state.
  - `// why:` returns `ProfileResult<T>` rather than throwing on the
    "not found" path because 404 is an expected, non-exceptional
    outcome — every handle starts unclaimed and many requests will
    target unclaimed values.

- `loadPlayerIdByAccountId(accountId: AccountId, database:
  DatabaseClient): Promise<number | null>`
  - Helper used by `getPublicProfileByHandle`. Returns the
    `bigserial player_id` for FK joins on `legendary.replay_ownership`
    or `null` if the row was deleted between the
    `findAccountByHandle` call and this query.
  - `// why:` two-step lookup is the simplest correct shape — it
    keeps WP-101's `findAccountByHandle` interface unchanged
    (returns `PlayerAccount` keyed on `ext_id`/`AccountId`) while
    surfacing the bigint FK value `legendary.replay_ownership`
    needs.

### C) `apps/server/src/profile/profile.routes.ts` — new

- `registerProfileRoutes(router: KoaRouter, database: DatabaseClient):
  void`
  - `KoaRouter` is the type of `server.router` returned by
    boardgame.io's `Server({...})` (`@koa/router` instance per
    boardgame.io v0.50). Mirrors `registerHealthRoute(router)` at
    `apps/server/src/server.mjs:30–34`. Pre-flight 2026-04-28 PS-1
    locked the framework as Koa — **Express is not present in this
    codebase**.
  - Registers a single `GET /api/players/:handle/profile` handler.
  - Handler calls `getPublicProfileByHandle(koaContext.params.handle,
    database)`.
  - On `ok: true` →
    `koaContext.status = 200; koaContext.body = result.value;`
    (Koa serializes plain-object bodies as JSON automatically; the
    `/health` precedent at `server.mjs:31–32` confirms.)
  - On `ok: false` with `code: 'player_not_found'` →
    `koaContext.status = 404; koaContext.body = { error:
    'player_not_found' };`
  - On any thrown PostgreSQL infra error →
    `koaContext.status = 500; koaContext.body = { error:
    'internal_error' };` and the catch block swallows the error
    after the response is set; never re-throws to a global Koa
    handler. (Matches the existing server convention — `server.mjs`
    has no global error middleware beyond boardgame.io's defaults.)
  - Never throws lexically. Internal try / catch around the
    `getPublicProfileByHandle` call captures the rejection.
  - `// why:` the route handler is a thin Koa adapter; all logic
    lives in `profile.logic.ts` so it is independently testable
    without spinning up boardgame.io's `Server()` or any HTTP
    listener. The logic-layer test (8 tests in 1 describe block)
    covers the three branches; an optional follow-up
    `profile.routes.test.ts` may exercise the koa-router adapter
    surface but is not required by EC-117.
  - `// why:` this route is intentionally unauthenticated. Public
    profile visibility is governed solely by the WP-052 replay
    visibility flags + the WP-102 server-side filter
    (`visibility IN ('public', 'link') AND (expires_at IS NULL OR
    expires_at > now())`); no `requireAuthenticatedSession` call,
    no Hanko session check, no per-request authorization. A future
    WP that introduces an authenticated `/me/profile` companion
    surface (e.g., WP-104 owner-edit) MUST register a separate
    handler — never bolt auth onto this route.

### D) `apps/server/src/profile/profile.logic.test.ts` — new

Uses `node:test` and `node:assert` only. No `boardgame.io` import.
No `@legendary-arena/game-engine` import.

**Suite wrapping:** all tests in this file are wrapped in a single
top-level `describe('public profile logic (WP-102)', ...)` block.
This adds **+1 suite** to the server baseline (post-WP-101: `9 →
10`).

**Test count: 8 tests.**

1. `PROFILE_ERROR_CODES` array matches `ProfileErrorCode` union
   (drift — forward and backward inclusion).
2. `Object.keys(PublicProfileView fixture).sort()` drift test
   asserts exactly `['displayHandle', 'displayName',
   'handleCanonical', 'publicReplays']` and no other keys (no
   `accountId`, no `email`, no `authProvider`).
3. `Object.keys(PublicReplaySummary fixture).sort()` drift test
   asserts exactly `['createdAt', 'replayHash', 'scenarioKey',
   'visibility']` (no `expiresAt`, no `ownershipId`).
4. `getPublicProfileByHandle` returns `{ ok: false, code:
   'player_not_found' }` for an unclaimed canonical handle (DB
   fixture: insert a player with NULL handle columns; query the
   handle's canonical form which is not present anywhere) (requires
   test DB).
5. `getPublicProfileByHandle` returns the four-field view for a
   claimed handle whose owner has zero replay rows (requires test
   DB; assert `publicReplays === []`).
6. `getPublicProfileByHandle` returns only `'public'` and `'link'`
   replays — never `'private'` (DB fixture: insert one replay of
   each visibility; assert response contains exactly the two
   non-private rows; assert `'private'` never appears in the
   response JSON) (requires test DB).
7. `getPublicProfileByHandle` excludes expired replays (DB fixture:
   one row with `expires_at = now() - INTERVAL '1 day'` and one
   with `expires_at = now() + INTERVAL '1 day'`; assert only the
   future-dated row is returned) (requires test DB).
8. `getPublicProfileByHandle` is case-insensitive on the input
   (request for `'Alice'` resolves to a handle stored as
   `handle_canonical = 'alice'`; assert success with the same
   `displayHandle` recorded at claim time, not the request casing)
   (requires test DB).

Tests 4–8 require a test PostgreSQL database. If unavailable, mark
each with `{ skip: 'requires test database' }` (non-silent skip per
WP-052 precedent). Tests 1–3 are pure and always run.

### E) `apps/arena-client/src/App.vue` — modified (per PS-2)

> **Pre-flight 2026-04-28 PS-2 resolution.** Earlier WP-102 drafts
> specified `apps/arena-client/src/router/routes.ts` (modified). That
> file does not exist; arena-client has no `vue-router` dependency
> and adding one is out of scope per WP-102 §Goal "No new npm
> dependencies". WP-102 instead extends the existing hand-rolled
> query-string router in `App.vue` (precedent: `parseQuery()` +
> `type AppRoute = 'fixture' | 'live' | 'lobby'` at `App.vue:17, 48`).

Apply the **minimum** diff:

1. Extend the route union:
   ```ts
   type AppRoute = 'fixture' | 'live' | 'lobby' | 'profile';
   ```
2. Extend `parseQuery()` to read `?profile=<canonical>`:
   ```ts
   const profileHandle = readQueryParam(params, 'profile');
   // why: presence of ?profile= takes priority over ?match= /
   //      ?fixture= because the profile surface is a leaf navigation
   //      target; once a user lands on /?profile=alice we don't
   //      want a stale ?match= to silently fall through to the
   //      live route. Tested by AppRoute drift test.
   ```
3. Extend the `AppRoute` resolution to set `route = 'profile'` when
   `profileHandle !== null` (priority above `'live'` / `'fixture'` /
   `'lobby'` per the `// why:` above).
4. Conditionally render `<PlayerProfilePage :handle="profileHandle" />`
   in the template's `<v-if="route === 'profile'">` branch (mirrors
   the existing `'fixture'` / `'live'` / `'lobby'` branches). Import
   the component lazily via `defineAsyncComponent(() => import(
   './pages/PlayerProfilePage.vue'))` to avoid bundle-size regression
   on the live-match path.
5. No `vue-router` import. No `<router-view>`. No `<router-link>`.
   Existing routes byte-identical aside from the new union value
   and the new `<v-if>` branch.
6. No route guard added (this surface is public).

### F) `apps/arena-client/src/pages/PlayerProfilePage.vue` — new

Vue 3 SFC using the existing arena-client conventions. Per the
WP-100 / `App.vue` precedent for separate-compile via
`@legendary-arena/vue-sfc-loader`, use `defineComponent({ setup() {
return {...} } })` (NOT `<script setup>`) when the template
references non-prop bindings (D-6512 / P6-30).

- `<script lang="ts">` block (see precedent caveat above).
- **Props:** `defineProps<{ handle: string }>()`. Receives the
  canonical handle from `App.vue`'s `<v-if="route === 'profile'">`
  branch; does NOT read from `vue-router` (which is not installed —
  pre-flight PS-2). Treat `handle` as already-canonicalized for the
  initial fetch; the server canonicalizes defensively anyway.
- Calls `fetchPublicProfile(handle)` from
  `../lib/api/profileApi.ts` on mount and whenever the `handle`
  prop changes (`watch(() => props.handle, ...)`).
- Renders three top-level regions:
  1. **Header.** Displays `displayName`, `displayHandle`,
     `handleCanonical` (as small grey `@<canonical>` slug under the
     name).
  2. **Replays section.** If `publicReplays.length > 0`, renders a
     simple list (`replayHash` truncated to first 8 chars,
     `scenarioKey`, `createdAt` formatted via `Intl.DateTimeFormat`,
     and a small badge for `visibility`). If empty, renders "No
     public replays yet."
  3. **Empty-state tabs.** Six inert `<section>` blocks with the
     six locked tab labels (see Locked contract values). Each is
     pure markup; **no script logic, no fetch, no event handlers,
     no Vue lifecycle hooks**. Each tab carries an HTML
     comment `<!-- why: ... -->` (or `// why:` in the `<script>`
     block, per copilot-check 2026-04-28 RISK #15) naming why it
     makes no fetch — preserves Vision §11 stateless-client and
     the WP-102 lifecycle prohibition.
- 404 path: if the API returns 404, renders a "No player has
  claimed this handle." page; no fetch retry.
- Loading state: a simple spinner or "Loading…" text while the
  initial fetch is pending.
- Error state (5xx): "Could not load profile. Please try again
  later." — no retry logic in this packet.
- No global state stores touched (Pinia or otherwise) — page
  manages its own local refs.

### G) `apps/arena-client/src/lib/api/profileApi.ts` — new

- `fetchPublicProfile(handle: string): Promise<{ ok: true; value:
  PublicProfileView } | { ok: false; status: number }>`
  - Calls `fetch(\`/api/players/${encodeURIComponent(handle)}/profile\`)`.
  - On 200: parses JSON and returns `{ ok: true, value }`.
  - On any non-200: returns `{ ok: false, status }` — no body detail
    propagated.
  - `// why:` `encodeURIComponent` defends against handle values
    that fail format validation but somehow reach the client; the
    server is authoritative regardless.
- Re-uses the `PublicProfileView` type by structural compatibility
  — defined inline in this file rather than imported from server
  code (engine-/server-isolation rule).

### H) `apps/server/src/server.mjs` — modified (per PS-3)

The existing server entry point (resolved at pre-flight 2026-04-28
PS-3 to `apps/server/src/server.mjs`) must call
`registerProfileRoutes(server.router, database)` **once** during
startup, immediately after the existing
`registerHealthRoute(server.router)` call at line ~120.

- One-line call site addition; no other changes to `server.mjs`.
- `database` argument is the `pg.Pool` instance the server creates
  at startup. **WP-102 does NOT introduce pool creation** — if no
  pool exists at the point of call (a future request-handler WP
  may own pool lifecycle), WP-102's session prompt will surface this
  as an additional pre-execution gate. The pre-flight 2026-04-28 did
  not check pool availability and the executor must verify at
  session start (§Pre-Session Gate).
- The Koa router is already in scope at this line via the
  `Server({...})` construction at line ~110. No new framework imports
  needed.

---

## Out of Scope

- **Owner edit (`/me`).** Profile editing, avatar URL fields,
  `about_me`, social links, and the privacy toggles are WP-104.
- **Avatar upload.** R2 / object-storage upload pipeline,
  presigned URLs, MIME validation, image moderation are WP-106.
- **Badges.** Badge data model, issuance, and display are WP-105.
- **Tournaments tab.** Tournament participation surfacing depends
  on a tournament engine WP that does not exist; deferred.
- **Comments tab.** Comment authoring, moderation, and history are
  separate WPs; deferred.
- **Integrity / anti-cheat.** Public review status, admin notes,
  RBAC, and admin endpoints are WP-107+ (after an admin-auth WP).
- **Subscriptions / donations / payments.** Funding surfacing
  depends on WP-097 (D-9701) landing and WP-098 §20 Funding Surface
  Gate Trigger landing, plus a payment-integration WP; deferred to
  WP-108+.
- **Rank / best score display.** Reads from WP-054/WP-055 surfaces
  that are drafted but not done; deferred to a future profile
  enhancement WP that consumes those reads. WP-102 displays only
  the locked "Rank — coming soon" empty-state stub.
- **Authenticated endpoints.** No `requireAuthenticatedSession`,
  no WP-112 contract invocation (WP-112 renumbered from "WP-100"
  per D-10002), no owner-only endpoints. Public surface only.
- **Session middleware.** WP-112 (session token validation;
  renumbered from "WP-100" per D-10002) is not introduced or
  required by this packet.
- **Hanko integration.** WP-099 governance — Hanko-specific code
  lives under `apps/server/src/auth/hanko/` (not yet created).
  WP-102 introduces no Hanko import, type, string literal, or
  fixture. Per D-9902, no `'hanko'` value appears as
  `auth_provider`.
- **Handle rename, reservation, or anti-impersonation.** Per
  WP-101 §Out of Scope and the no-tombstone policy. WP-102 honors
  the implication: a handle reclaimed by a different account
  serves the new account's content (and only the new account's
  content) on the next request after reclaim.
- **Caching layer.** No ETag, no Cache-Control beyond browser
  defaults, no CDN integration. Future performance tuning is its
  own packet.
- **Internationalization.** Static strings in the empty-state
  stubs are English-only; i18n is a separate Vision §17 surface
  and a separate packet.
- **`legendary.players.deleted_at` soft-delete column.** WP-052
  hard-deletes via `deletePlayerData`; introducing a soft-delete
  marker is its own governance change, not a WP-102 implication.
- **`legendary.replay_ownership` schema changes.** No new columns,
  no new indexes, no new constraints. Read-only consumption of
  the existing shape.
- **Engine, registry, or pre-planning code.** Untouched.
- **WP-052 / WP-101 / WP-103 contract files.** All locked; no
  edits.
- **Refactors, cleanups, "while I'm here" improvements.** Out of
  scope unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/server/src/profile/profile.types.ts` — **new** —
  `PublicProfileView`, `PublicReplaySummary`, `ProfileErrorCode`,
  `PROFILE_ERROR_CODES`. Re-imports `Result<T>`, `AccountId`,
  `DatabaseClient` from `../identity/identity.types.js`.
- `apps/server/src/profile/profile.logic.ts` — **new** —
  `getPublicProfileByHandle`, `loadPlayerIdByAccountId`. Composes
  the public view via WP-101 `findAccountByHandle` + locked
  replay-filter SQL.
- `apps/server/src/profile/profile.routes.ts` — **new** —
  `registerProfileRoutes(app, database)` registers the single
  `GET /api/players/:handle/profile` handler.
- `apps/server/src/profile/profile.logic.test.ts` — **new** —
  `node:test` coverage (8 tests, 1 `describe()` block → +1 suite;
  3 pure + 5 DB-dependent).
- `apps/arena-client/src/App.vue` — **modified** (per pre-flight
  2026-04-28 PS-2; replaces the earlier `apps/arena-client/src/router/
  routes.ts` placeholder which does not exist). Extends
  `type AppRoute` with `'profile'`; reads `?profile=<canonical>` via
  `parseQuery()`; renders `<PlayerProfilePage :handle="..." />` in
  the new `route === 'profile'` branch. Component lazy-loaded via
  `defineAsyncComponent`. No `vue-router` import.
- `apps/arena-client/src/pages/PlayerProfilePage.vue` — **new** —
  Vue 3 SFC: header, replays section, six inert empty-state tab
  blocks.
- `apps/arena-client/src/lib/api/profileApi.ts` — **new** —
  `fetchPublicProfile(handle)` typed `fetch` wrapper.
- `apps/server/src/server.mjs` — **modified** (resolved at
  pre-flight 2026-04-28 PS-3). One-line addition calling
  `registerProfileRoutes(server.router, database)` immediately after
  the existing `registerHealthRoute(server.router)` call at line ~120.
  Mirrors the Koa router precedent — no Express, no new framework
  import.

No other files may be modified. Verified by `git diff --name-only`
after each commit.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Types & Constants
- [ ] `profile.types.ts` exports `PublicProfileView` with exactly
      4 fields: `handleCanonical`, `displayHandle`, `displayName`,
      `publicReplays`.
- [ ] `Object.keys(view).sort()` drift test asserts the 4-field
      list verbatim — no `accountId`, `email`, `authProvider`,
      `authProviderId`, `createdAt`, or any other `PlayerAccount`
      field leaks.
- [ ] `PublicReplaySummary` has exactly 4 fields: `replayHash`,
      `scenarioKey`, `visibility`, `createdAt` (drift test asserts
      no `expiresAt`, no `ownershipId`, no `private` value path).
- [ ] `PublicReplaySummary.visibility` is typed as `'public' |
      'link'` — `'private'` is not a valid value at the type
      level.
- [ ] `ProfileErrorCode` is exactly `'player_not_found'`.
- [ ] `PROFILE_ERROR_CODES` matches the union (drift test, forward
      and backward inclusion).
- [ ] `Result<T>`, `AccountId`, and `DatabaseClient` are
      re-imported from `../identity/identity.types.js` — never
      redeclared.

### Server Logic
- [ ] `getPublicProfileByHandle` canonicalizes input
      (`trim().toLowerCase()`) before calling
      `findAccountByHandle`.
- [ ] `getPublicProfileByHandle` calls `findAccountByHandle` from
      WP-101 (verified via `Select-String` for the import).
- [ ] On `findAccountByHandle === null` → returns
      `{ ok: false, code: 'player_not_found' }`.
- [ ] Replay filter SQL contains the literal substring
      `visibility IN ('public', 'link')` and the literal substring
      `expires_at IS NULL OR expires_at > now()`.
- [ ] No `INSERT`, `UPDATE`, or `DELETE` SQL appears in any new
      file under `apps/server/src/profile/` (verified via
      `Select-String`).
- [ ] No `.reduce(` call appears in any file under
      `apps/server/src/profile/` (verified via `Select-String`).
- [ ] All `reason` strings are full sentences per Rule 11.

### HTTP Handler
- [ ] `registerProfileRoutes(app, database)` registers exactly one
      route: `GET /api/players/:handle/profile`.
- [ ] Handler returns 200 with `PublicProfileView` body on
      success.
- [ ] Handler returns 404 with body `{ "error":
      "player_not_found" }` for unknown handle.
- [ ] Handler does not throw on any code path; infra failures
      return 500 with no body detail.
- [ ] No `requireAuthenticatedSession`, no auth middleware import
      in any new file.

### Vue SPA
- [ ] `apps/arena-client/src/App.vue` extends `type AppRoute` with
      `'profile'`, parses `?profile=<canonical>` via the existing
      `parseQuery()` helper, and renders `<PlayerProfilePage
      :handle="..." />` (lazy-loaded via `defineAsyncComponent`)
      in the new `route === 'profile'` branch. All other branches
      byte-identical (verified via `git diff` review). **No
      `vue-router` import, no `<router-view>`, no `<router-link>`**
      (per pre-flight PS-2).
- [ ] `PlayerProfilePage.vue` calls `fetchPublicProfile` from
      `../lib/api/profileApi.ts` and never imports `boardgame.io`,
      `@legendary-arena/game-engine`, or `@legendary-arena/registry`.
- [ ] Empty-state tab sections contain no `fetch`, no `axios`, no
      `XMLHttpRequest`, no WebSocket reference (verified via
      `Select-String` on the page file).
- [ ] The page renders all six locked empty-state tab labels
      verbatim.
- [ ] `fetchPublicProfile` URL-encodes the handle path parameter
      via `encodeURIComponent`.

### Layer Boundary
- [ ] No `boardgame.io` import in any new file (verified via
      `Select-String`).
- [ ] No `@legendary-arena/game-engine` import in any new file.
- [ ] No `@legendary-arena/registry` import in any new file.
- [ ] No `packages/preplan` import in any new file.
- [ ] No engine `PlayerId` import in any new file.
- [ ] No mutation of WP-052, WP-101, or WP-103 contract files
      (verified via `git diff`).

### Read-Only Invariant
- [ ] `Select-String` for `INSERT INTO|UPDATE|DELETE FROM` against
      `apps/server/src/profile/**` returns zero matches.
- [ ] No new migration file is added under `data/migrations/`.
- [ ] `legendary.players` and `legendary.replay_ownership` schemas
      unchanged (verified via `git diff data/migrations/`).

### Tests
- [ ] All 8 tests pass (or DB-dependent tests 4–8 are marked
      `skip` with reason).
- [ ] Test file uses `.test.ts` extension.
- [ ] Test file uses `node:test` and `node:assert` only.
- [ ] No `boardgame.io` or `@legendary-arena/game-engine` import
      in test file.
- [ ] Test file wraps tests in exactly one `describe()` block —
      server suite count increments by exactly **+1** (post-WP-101:
      `9 → 10`).
- [ ] Server test count increments by exactly **+8** (post-WP-101:
      `63 → 71`).
- [ ] Engine test baseline unchanged at **`570 / 126 / 0`**.

### Visibility Filter
- [ ] Test 6 asserts `'private'` never appears in the response
      JSON when a private replay exists for the same player.
- [ ] Test 7 asserts an expired replay never appears in the
      response.
- [ ] Test 8 asserts case-insensitive handle resolution against
      the canonical column.

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (verified via `git diff --name-only`).
- [ ] `package.json` (root and per-package) unchanged — no new
      dependency.
- [ ] `packages/game-engine/src/types.ts` unchanged.
- [ ] No Hanko reference (`@teamhanko`, `hanko.io`, `'hanko'` as
      a string) in any new file.

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm -r build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm test
# Expected: TAP output — all tests passing (or DB tests 4–8 skipped
#           with reason)
# Expected: engine 570 / 126 / 0 unchanged
# Expected: server 71 / 10 / 0 (or 71 with skips for DB tests 4–8)

# Step 3 — confirm no boardgame.io import in new server files
Select-String -Path "apps\server\src\profile\*" -Pattern "from ['""]boardgame\.io" -Recurse
# Expected: no output

# Step 4 — confirm no engine import in new server files
Select-String -Path "apps\server\src\profile\*" -Pattern "from ['""]@legendary-arena/game-engine" -Recurse
# Expected: no output

# Step 5 — confirm no engine or registry import in new client files
Select-String -Path "apps\arena-client\src\pages\PlayerProfilePage.vue","apps\arena-client\src\lib\api\profileApi.ts" -Pattern "from ['""]@legendary-arena/(game-engine|registry)|from ['""]boardgame\.io"
# Expected: no output

# Step 6 — confirm read-only invariant on the server profile module
Select-String -Path "apps\server\src\profile\*" -Pattern "INSERT INTO|UPDATE\s+legendary|DELETE\s+FROM" -Recurse
# Expected: no output

# Step 7 — confirm visibility filter is present in profile.logic.ts
Select-String -Path "apps\server\src\profile\profile.logic.ts" -Pattern "visibility IN \('public', 'link'\)"
# Expected: exactly one match

Select-String -Path "apps\server\src\profile\profile.logic.ts" -Pattern "expires_at IS NULL OR expires_at > now\(\)"
# Expected: exactly one match

# Step 8 — confirm no .reduce() in profile module
Select-String -Path "apps\server\src\profile\*" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 9 — confirm WP-101 dereference: findAccountByHandle is called
Select-String -Path "apps\server\src\profile\profile.logic.ts" -Pattern "findAccountByHandle"
# Expected: at least one match (import + call)

# Step 10 — confirm Result<T> / AccountId / DatabaseClient are re-imported
Select-String -Path "apps\server\src\profile\profile.types.ts" -Pattern "type Result|interface PlayerAccount"
# Expected: no output (these are imported, not redeclared)

Select-String -Path "apps\server\src\profile\profile.types.ts" -Pattern "from\s+['""]\.\./identity/identity\.types"
# Expected: at least one match

# Step 11 — confirm no new migration files
git diff --name-only data/migrations/
# Expected: no output

# Step 12 — confirm WP-052 contract files unchanged
git diff apps/server/src/identity/identity.types.ts apps/server/src/identity/identity.logic.ts
# Expected: no output

# Step 13 — confirm WP-052 / WP-101 / WP-103 / WP-053 migrations unchanged
git diff data/migrations/004_create_players_table.sql data/migrations/005_create_replay_ownership_table.sql data/migrations/006_create_replay_blobs_table.sql data/migrations/007_create_competitive_scores_table.sql data/migrations/008_add_handle_to_players.sql
# Expected: no output

# Step 14 — confirm WP-101 contract files unchanged
git diff apps/server/src/identity/handle.types.ts apps/server/src/identity/handle.logic.ts
# Expected: no output

# Step 15 — confirm engine types.ts unchanged
git diff packages/game-engine/src/types.ts
# Expected: no output

# Step 16 — confirm no Hanko reference
Select-String -Path "apps\server\src\profile\*","apps\arena-client\src\pages\PlayerProfilePage.vue","apps\arena-client\src\lib\api\profileApi.ts" -Pattern "@teamhanko|hanko\.io|'hanko'|""hanko""" -Recurse
# Expected: no output

# Step 17 — confirm package.json files unchanged
git diff --name-only -- "**/package.json"
# Expected: no output

# Step 18 — confirm empty-state tabs have no fetch / network calls
Select-String -Path "apps\arena-client\src\pages\PlayerProfilePage.vue" -Pattern "fetch\(|axios|XMLHttpRequest|new WebSocket" -Recurse
# Expected: exactly one match — the `fetchPublicProfile` call indirected
#           through profileApi.ts. The empty-state tab markup must not
#           introduce any additional matches.

# Step 19 — confirm only files in Files Expected to Change were modified
git diff --name-only
# Expected: only the 8 files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in
> `## Verification Steps` before checking any item below. Reading
> the code is not sufficient — run the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` exits 0 (all test files; DB tests may skip with
      reason)
- [ ] Engine baseline unchanged: **`570 / 126 / 0`**
- [ ] Server baseline post-execution: **`71 / 10 / 0`** (or **`71`
      with skips** for DB-dependent tests 4–8)
- [ ] No `boardgame.io` import in any new file
- [ ] No `@legendary-arena/game-engine` import in any new file
- [ ] No `@legendary-arena/registry` import in any new file
- [ ] No `require()` in any generated file
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] WP-052 contract files (`identity.types.ts`,
      `identity.logic.ts`, migrations 004 and 005) are unchanged
- [ ] WP-101 contract files (`handle.types.ts`, `handle.logic.ts`,
      migration 008) are unchanged
- [ ] WP-053 contract files (`competition.types.ts`,
      `competition.logic.ts`, migration 007) are unchanged
- [ ] WP-103 contract files (`replay.types.ts`, `replay.logic.ts`,
      migration 006) are unchanged
- [ ] `packages/game-engine/src/types.ts` is unchanged
- [ ] No new migration file added
- [ ] No `'hanko'` string and no Hanko SDK reference appears in any
      WP-102 file (verified via `Select-String`)
- [ ] `docs/ai/STATUS.md` updated with a `### WP-102 / EC-117
      Executed` block describing: public profile page lives at
      `/players/:handle`; read-only; no schema change; six
      empty-state tabs anchored to future WPs; handle →
      `AccountId` dereference invariant locked
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-102 row with
      today's date and the SPEC commit hash
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-117 row
      flipped `Draft` → `Done {YYYY-MM-DD}` (EC-117 is the slot
      retargeted from `EC-102` per the staleness-sweep note at
      the top of this WP, following the EC-101 → EC-114 retarget
      precedent)
- [ ] `docs/ai/DECISIONS.md` records a new D-entry classifying
      `apps/server/src/profile/` as a server-layer directory
      (mirrors D-5202 for `apps/server/src/identity/` and D-10301
      for `apps/server/src/replay/`); the D-NNNN number is
      assigned at execution time

---

## Lint Self-Review (00.3 §1–§19)

> Performed at draft time; re-confirm before execution.

| § | Item | Status |
|---|---|---|
| §1 | All required WP sections present | PASS |
| §1 | `## Out of Scope` non-empty (≥2 items) | PASS (16 items listed) |
| §2 | Non-Negotiable Constraints with engine-wide + packet-specific + session protocol + locked values | PASS |
| §2 | Constraints reference `00.6-code-style.md` | PASS (Engine-wide bullet "Human-style code…") |
| §2 | Full file contents required, no diffs/snippets | PASS |
| §3 | `## Assumes` lists prior state and dependency files (WP-052, WP-101, arena-client framework [Vue 3 + Pinia, no `vue-router`], Koa router via boardgame.io) | PASS (re-validated 2026-04-28 post-PS-1/PS-2) |
| §4 | `## Context (Read First)` is specific (no "read the docs") | PASS |
| §4 | Architectural sections cited where relevant | PASS (ARCHITECTURE.md Layer Boundary + Persistence Boundaries + .claude/rules/architecture.md) |
| §4 | DECISIONS.md scan instruction included | PASS (Context bullet 11) |
| §4 | 00.2 referenced (this packet touches data shape only via reads of existing tables) | PASS (§1 namespace cited) |
| §5 | Every file is `new` or `modified` with one-line description | PASS |
| §5 | No ambiguous "update this section" language | PASS |
| §5 | File count under ~8 | PASS (8 files) |
| §6 | Naming consistency (no abbreviations, canonical paths, `legendary.*` namespace, `ext_id`/`AccountId` per WP-052) | PASS |
| §7 | No new npm dependencies | PASS (verified by AC item) |
| §7 | Forbidden packages explicitly excluded | PASS (no Passport / Auth0 / Clerk; no Hanko import — Hanko is governance-only per WP-099) |
| §8 | Layer boundaries respected (server reads PostgreSQL only; arena-client uses fetch only; no engine import; no registry import) | PASS |
| §9 | Cross-platform commands (verification uses `pwsh` `Select-String` and `git diff`) | PASS |
| §10 | Env vars: N/A — no new env vars introduced | N/A |
| §11 | Auth: explicitly N/A — single endpoint is public, no `requireAuthenticatedSession` invoked, no WP-112 contract used (WP-112 renumbered from "WP-100" per D-10002) | N/A (declared) |
| §12 | Tests: `node:test` + `node:assert` only; no boardgame.io import; no network access; DB-dependent tests skip via WP-052 pattern | PASS |
| §13 | Verification commands are exact (`pwsh` Select-String + git diff) with expected output | PASS |
| §14 | Acceptance criteria are binary observable items grouped by sub-task | PASS (~38 items across 8 groups; each is binary; matches WP-099 / WP-101 precedent of larger-than-12 item totals when grouped) |
| §15 | DoD includes STATUS.md + WORK_INDEX.md + EC_INDEX + DECISIONS.md (directory-classification entry) + scope-boundary check | PASS |
| §16 | Code style: this WP authors TS, Vue SFC, and SQL — every named function carries JSDoc; no abbreviations; no `.reduce()`; no nested ternaries; full-sentence error messages; named imports only | PASS |
| §17 | Vision Alignment block present with cited clauses (§3, §11, §14, §18, §22, §24, §25, NG-1, NG-3, NG-6) + no-conflict assertion + determinism preservation line | PASS |
| §18 | Prose-vs-grep discipline: forbidden tokens (`Math.random`, `Date.now`, `boardgame.io`, etc.) not enumerated verbatim near literal-string greps | PASS (the Hanko grep at Step 16 targets a forbidden literal; surrounding prose cites WP-099 D-9904 rather than enumerating Hanko tokens) |
| §19 | Bridge-vs-HEAD staleness: N/A — this WP is not a repo-state-summarizing artifact | N/A |
| §20 | Funding Surface Gate applicability declared (per WP-098 draft) | PASS — declared **N/A** in §Vision Alignment with explicit justification ("no UI affordance for donation, subscription, or tournament-funding payment") |

**Final Gate verdict:** PASS at draft time. Re-confirm before
execution by re-running the §1–§20 walkthrough against the
post-WP-101 state of `legendary.players` and the actual arena-client
file paths.
