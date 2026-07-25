---
title: Architecture & Library Adoption Inventory
type: Generated
status: evergreen
tags:
  - generated
  - architecture
  - inventory
---

# Architecture & Library Adoption Inventory

_Generated 2026-07-25 by `scripts/architecture-inventory.mjs`._

This is a deterministic snapshot of installed dependencies,
their actual import usage across the workspace, and SaaS /
embedded service integrations detected via static analysis.
It does **not** make recommendations — feed it into the
gap-analysis prompt alongside `docs/02-ARCHITECTURE.md` and
`docs/ai/ARCHITECTURE.md` for prioritized advice.

## Application stacks

One entry per app under `apps/*`. Each "Stack" line is
synthesised from the app's own manifests:

- Node apps (`apps/*/package.json` present): `dependencies` /
  `devDependencies` versions, plus a few transitive facts
  confirmed against `pnpm-lock.yaml` (Socket.IO and Koa
  router both ship via `boardgame.io`, not as direct deps).
  Descriptions come from each workspace's `package.json#description`.
- Hugo apps (`apps/*/hugo.toml` present, no `package.json`):
  pinned binary version from `apps/<name>/.hugo-version`,
  source page count from the projection input directory, and
  deploy target verified against `render.yaml`.

- **`apps/arena-client`** — Gameplay client SPA for Legendary Arena (Vue 3 + Vite + Pinia, TypeScript)
  - Stack: Vue 3 SFCs (`vue@^3.4.27`) + Pinia stores (`pinia@^2.1.7`) + Vite bundler (`vite@^5.3.1`) + boardgame.io (`boardgame.io@^0.50.0`) over Socket.IO (transitive via `boardgame.io`).
- **`apps/dashboard`** — Internal admin dashboard SPA for Legendary Arena (Vue 3 + PrimeVue 4 + Vite)
  - Stack: Vue 3 SFCs (`vue@^3.4.27`) + Pinia stores (`pinia@^2.1.7`) + vue-router (`vue-router@^4.3.2`) + Vite bundler (`vite@^5.3.1`) + PrimeVue (`primevue@^4.0.0`) + Axios (`axios@^1.7.2`) + ECharts (`echarts@^5.5.0`).
- **`apps/engine-runner`** — Headless bot-vs-bot simulation runner CLI for the Legendary Arena engine (Windows-exe Target A, Phase 1)
  - Stack: _(no recognised framework deps — likely a CLI or pure Node app)_.
- **`apps/legends-board`** — Public Legends Attract Board — read-only scoreboard SPA for legends.legendary-arena.com
  - Stack: Vue 3 SFCs (`vue@^3.4.27`) + Vite bundler (`vite@^5.3.1`).
- **`apps/registry-viewer`** — Client-only Registry Viewer for Legendary Arena (Vite + Vue 3)
  - Stack: Vue 3 SFCs (`vue@^3.4.27`) + Vite bundler (`vite@^5.3.1`).
- **`apps/replay-producer`** — CLI Producer App (D-6301) that wraps buildSnapshotSequence with file I/O to emit deterministic ReplaySnapshotSequence JSON
  - Stack: _(no recognised framework deps — likely a CLI or pure Node app)_.
- **`apps/server`** — Legendary Arena boardgame.io game server — wiring layer only
  - Stack: boardgame.io (`boardgame.io@^0.50.0`) over Socket.IO (transitive via `boardgame.io`) + HTTP routes via Koa router (`@koa/router@10.1.1` + `koa@2.16.4`, both transitive via `boardgame.io`) + PostgreSQL via `pg@^8.13.0`.
- **`apps/wiki-viewer`** — Engineering wiki build pipeline. Build-time, read-only Hugo projection of `wiki/` (no `package.json` — Hugo is a Go binary, not a Node dep). Layer-boundary clean: zero runtime imports of `@legendary-arena/game-engine`, `@legendary-arena/registry`, or `apps/server`. Build pipeline is `pnpm wiki-viewer:project` (copy `wiki/*.md` → `apps/wiki-viewer/content/`) → `pnpm wiki-viewer:check-links` (case-sensitive internal-link gate) → `hugo --minify`.
  - Stack: Hugo Extended (`hugo@0.161.1`, pinned in `apps/wiki-viewer/.hugo-version`) + 56 source pages projected from `wiki/` + deployed as Render Static Site `legendary-arena-wiki`.

## Deployment topology

Canonical source: `docs/ops/domains.json`. Ops runbook: `docs/ops/DOMAINS.md`.

| Subdomain | App / Source | Host | State |
|---|---|---|---|
| `legendary-arena.com` | redirect rule -> www.legendary-arena.com | Cloudflare Pages (redirect rule) | live |
| `www.legendary-arena.com` | External Hugo repo at C:\www\legendary-arena-com | Cloudflare Pages | live |
| `play.legendary-arena.com` | apps/arena-client | Cloudflare Pages | live |
| `cards.legendary-arena.com` | apps/registry-viewer | Cloudflare Pages | live |
| `wiki.legendary-arena.com` | TBD - separate Hugo site (not yet authored) | Cloudflare Pages | planned |
| `ewiki.legendary-arena.com` | apps/wiki-viewer (Hugo build of docs/wiki/) | Render Static Site + Cloudflare Access | live |
| `legends.legendary-arena.com` | apps/legends-board | Cloudflare Pages | live |
| `dashboard.legendary-arena.com` | apps/dashboard | Cloudflare Pages + Cloudflare Access | live |
| `api.legendary-arena.com` | apps/server | Render (legendary-arena-server) | live |
| `legendary-arena-server.onrender.com` | apps/server | Render | live |
| `images.legendary-arena.com` | external (BarefootBetters image bucket) | Cloudflare R2 + Cloudflare CDN | live |

## Infrastructure services

Managed services the project depends on, derived from
`render.yaml` and `docs/ops/domains.json`. Answers "what
vendor accounts and managed services does this project
depend on?" — distinct from Deployment topology, which
answers "what URL maps to what app."

### Cloudflare

| Service | Kind | URL / Scope |
|---|---|---|
| Cloudflare Access (zero-trust gate) | zero-trust gate | `dashboard.legendary-arena.com`, `ewiki.legendary-arena.com` |
| Cloudflare Pages (static hosting) | static hosting | `cards.legendary-arena.com`, `legendary-arena.com`, `legends.legendary-arena.com`, `play.legendary-arena.com`, `wiki.legendary-arena.com`, `www.legendary-arena.com` |
| Cloudflare R2 (object storage + CDN) | object storage + CDN | `images.legendary-arena.com` |

### Render

| Service | Kind | URL / Scope |
|---|---|---|
| `legendary-arena-db` | Managed PostgreSQL (pro-4gb) | _internal (connection string via env)_ |
| `legendary-arena-server` | Render Web Service | https://legendary-arena-server.onrender.com |
| `legendary-arena-wiki` | Render Web Service | https://legendary-arena-wiki.onrender.com |

### Render account model & sizing (what we pay for, and why)

Render bills on TWO INDEPENDENT axes: (1) a flat, team-level **Workspace plan**, and (2) per-service **instance types** (compute), billed per service on ANY workspace. They are separate — running a larger instance type does NOT require a paid workspace. The project pays for three Render line items: the Workspace, the game server (a web service), and the managed database.

Web-service instance types (the render.yaml `plan:` value → CPU / RAM / ~monthly compute): `starter` 0.5 / 512 MB / $7 · `standard` 1 / 2 GB / ~$25 · `pro` 2 / 4 GB / ~$85 · `pro plus` 4 / 8 GB / ~$175. (Postgres uses a SEPARATE instance-type scale: `basic-1gb` = 0.5 CPU / 1 GB / $19.)

Curated in `RENDER_ACCOUNT_AND_SIZING_NOTES` in `scripts/architecture-inventory.mjs`.

- WORKSPACE — **Hobby ($0/mo flat)**. The free personal tier; kept deliberately. Instance-type compute is billed per-service regardless of workspace, and the Hobby→Pro ($25/mo flat) difference is features we do not need yet (horizontal autoscaling, preview environments, audit logs, SOC2) — NOT access to larger instances. Caveat: Hobby includes 500 pipeline (build) minutes/mo; a burst of PR merges (each runs `pnpm install && pnpm -r build && migrate`) can exceed it and bill the overage.
- SERVER — web service `legendary-arena-server`, **`standard` (1 CPU / 2 GB, ~$25/mo compute)**. Upgraded 2026-07-23 (#948) from the implicit default `starter` (0.5 CPU / 512 MB, $7): the service had NO `plan:` field, so Render silently ran it on `starter`. That half-CPU could not carry a real-time authoritative WebSocket server that ALSO runs the bot-ally drivers (250 ms polling per live match), the "Watch Bot Play" autoplay loops, and four cron loops (legends publisher / match reaper / capture harvester) — the instance pegged at load ~7, causing health-check restarts (a live match hit the D-24230 revival cap of 3 in <1 h with NO deploys), a crawling bot (~1 turn / 10 min), and the recurring client-desync freezes. `plan:` is BLUEPRINT-MANAGED: it MUST live in render.yaml (a dashboard change reverts on sync), and merging the render.yaml change IS the upgrade. Next lever if `standard` saturates under real concurrency: `pro` (2 CPU / 4 GB, ~$85).
- DATABASE — managed Postgres `legendary-arena-db`, **`basic-1gb` (0.5 CPU / 1 GB, $19/mo)**. Its own 2026-07-22 upgrade from `basic-256mb` (the OOM-recovery fix, #932) is detailed in the "Managed database" block below. NOTE it is also only 0.5 CPU: the July-22 fix addressed RAM (OOM), so if DB *CPU* (not RAM) later becomes the bottleneck, `pro-4gb` (1 CPU / 4 GB, $55) is the equivalent move on the Postgres scale.
- ROOT-CAUSE vs SYMPTOM: the client-side resync fixes (reconnect-resync D-24232/#944, spectator-staleness + tab-focus D-24234/#947) and the server revival-cap reset (D-24233/#945) RECOVER from the desync freezes; the server sizing (#948) removes the CPU starvation that GENERATED them. Verify the fix in the Render **Events tab** (restart frequency → ~0 between real deploys) and the **CPU metric** (load well under 1×/core).

### Managed database — sizing history & operational notes

Instance: Basic-1gb (1 GB RAM / 0.5 CPU) — Render managed PostgreSQL 18, Oregon (US West).

Curated in `MANAGED_DATABASE_OPS_NOTES` in `scripts/architecture-inventory.mjs` (the derived Render table above shows only the plan string).

- Upgraded 2026-07-22 from Basic-256mb (256 MB / 0.1 CPU): the smaller instance repeatedly OOM-crashed into recovery mode ("the database system is in recovery mode" / "not yet accepting connections") under the real workload (bgio match blobs plus leaderboard / dashboard / competitive queries), killing in-flight autoplay + bot-ally matches. Storage stayed ~56% of 1 GB throughout, so the constraint was RAM/CPU, NOT disk.
- BLUEPRINT-MANAGED: `plan`, `ipAllowList`, and `storageAutoscalingEnabled` all live in render.yaml `databases:`. A dashboard-only change to any of them is REVERTED on the next blueprint sync — every managed-DB setting must be set in render.yaml to be durable.
- `ipAllowList: []` = internal-only inbound (was public `0.0.0.0/0`). The server connects via the internal hostname, so nothing app-side breaks; the External Database URL / a local `psql` no longer connects — use the Render dashboard PSQL shell for ops. Caveat: the dashboard also showed the `0.0.0.0/0` rules "Affected by: Workspace / Environment" — a workspace/environment-level network rule may layer on top and is only removable in the dashboard, not render.yaml.
- `storageAutoscalingEnabled: true` grows the disk +50% at 90% full. ROW retention IS handled (this note was stale): the match-reaper (WP-327, `apps/server/src/db/matchReaper.js`) deletes finished matches 1h after gameover — once the WP-335 capture-harvester has preserved the durable replay/competitive artifact per the D-24119 carve-out — and abandoned matches after 24h. What NEITHER the reaper NOR autoscaling does is shrink the table FILE: Postgres keeps deleted-row space as reusable dead tuples (mostly in TOAST, where the jsonb match blobs live), so `pg_total_relation_size('bgio.matches')` can be hundreds of MB with only a few live rows. Reclaim that bloat to disk with a one-shot `VACUUM FULL` — see the operator runbook `docs/ops/RUNBOOK-db-storage-reclaim.md` (worked example 2026-07-24: 346MB → 41MB, ~305MB of TOAST bloat reclaimed). NOT a scheduled chore on `pro-4gb` + autoscaling; reclaim only when you want the space back.
- Render's Connection Pool (PgBouncer) is ENABLED on the instance, but the app stays on the DIRECT Internal Database URL — with 1 GB RAM there is no connection-memory pressure to justify PgBouncer transaction-pooling (which can break prepared statements / session state). Route the app through the pool URL only if real connection pressure ever appears.
- Fix arc (all 2026-07-22): #920 added `pool.on("error")` (a band-aid that stopped the process crash but the DB kept killing idle clients); #930 gave the autoplay loop a bounded transient-read retry (`resilientFetch`, reads-only); #931 de-noised the pool error log (it was dumping a ~40-line pg Connection object per idle-client kill); #932 bumped the plan to basic-1gb (root cause); #933 restricted inbound to internal-only; #935 enabled storage autoscaling.
- DIAGNOSTIC LESSON: the autoplay guest-safe `abortReason` ("The bot loop stopped after an unexpected server error", D-24037) HIDES the raw exception — it is logged only server-side as `[autoplay] match <id> bot loop failed: <msg>`. To diagnose an autoplay/bot abort, pull that Render log line; the engine-runner harness cannot reproduce it (it bypasses boardgame.io).

## First-party subsystems

Internally-built modules of architectural significance that
don't surface in the library tables or per-app stacks.
Each entry's contract surface is verified against actual
`export` declarations on disk, so a renamed or removed
symbol shows up here as drift instead of a stale doc lie.

### PAR Simulation Engine

- **Location:** `packages/game-engine/src/simulation`
- **Owning work packet:** [WP-049](docs/ai/work-packets/WP-049-par-simulation-engine.md)

AI-policy-driven calibration pipeline. T0 RandomPolicy and T2 CompetentHeuristicPolicy sample raw scores via runSimulation; aggregateParFromSimulation reduces the distribution to a percentile PAR (Player Approachability Rating) value, which is persisted as a versioned artifact. Calibration tooling, not gameplay logic (D-0701).

**Contract surface (verified against on-disk exports):**

| Symbol | Status |
|---|---|
| `runSimulation` | present |
| `getLegalMoves` | present |
| `createRandomPolicy` | present |
| `createCompetentHeuristicPolicy` | present |
| `AI_POLICY_TIERS` | present |
| `aggregateParFromSimulation` | present |
| `generateScenarioPar` | present |
| `validateParResult` | present |
| `validateTierOrdering` | present |
| `resolveParForScenario` | present |

### LAGN Specification

- **Location:** `packages/lagn-spec/src`
- **Owning work packet:** [WP-244](docs/ai/work-packets/WP-244-lagn-spec-publication.md)

Legendary Arena Game Notation — the open standard format for game setup, card catalog, and deterministic replay logs. Published as an NPM package with Zod validator, generated JSON Schema, TypeScript types, and CLI tooling. Three-tier format: Tier 1 (mandatory game setup), Tier 2 (optional card catalog), Tier 3 (optional replay sequence). Single source of truth is the Zod schema; TypeScript types are inferred; the JSON Schema is DERIVED from the Zod schema (never hand-maintained) and published as @legendary-arena/lagn via npm, the schema CDN, and the public GitHub repo github.com/legendary-arena/lagn-spec (MIT; a package-only snapshot of packages/lagn-spec — the monorepo copy stays canonical, per WP-244 Gate 1).

**Contract surface (verified against on-disk exports):**

| Symbol | Status |
|---|---|
| `validate` | present |
| `summarize` | present |
| `generateSchema` | present |
| `lagnSchema` | present |
| `LAGN` | present |
| `GameSetup` | present |
| `CardCatalog` | present |
| `Replay` | present |
| `Card` | present |
| `Action` | present |
| `VillainEvent` | present |
| `Turn` | present |
| `GameResult` | present |

### Multiplayer-Play Authentication Boundary

- **Location:** `apps/server/src/match`
- **Owning work packet:** [WP-308](docs/ai/work-packets/WP-308-multiplayer-play-hard-gate.md)

The server-layer gate that requires a free authenticated account to play a seat in a multiplayer match (D-24092 Access Model). Two layers sit in front of the boardgame.io native lobby. The WP-307 guarded endpoints (`POST /api/match/create|join`) run `requireAuthenticatedSession` and then delegate server-internal (loopback `fetch`) to the native routes. The WP-308 `nativeLobbyGuard` — the FIRST app-level Koa middleware in `apps/server`, mounted before the bgio lobby router via `server.app.middleware.unshift` — rejects a raw external POST to the native create/join paths unless it carries a valid authenticated session OR a process-local internal-delegation secret (`node:crypto` `randomBytes`, compared value-exact and constant-time via `timingSafeEqual`), closing the D-24093 soft-gate bypass. The matchGate and the WP-163/164 autoplay loopback delegations attach that secret; the `GET` match list, spectating, and sockets stay guest. Server wires, engine decides — no game logic (D-24094). Framework note: on boardgame.io@0.50.2 the lobby router is applied INSIDE `server.run()` (via `configureApp`), not at `Server()` construction, so an `unshift` after `Server()` reliably precedes it — the middleware ordering the hard gate depends on (verified by the EC-338 PS-1 scaffold). Integration constraints (each the root of a shipped regression, all surfaced 2026-07-05 the first time a signed-in create ran end-to-end): (1) CLIENT — every arena-client route that consumes the bearer token must hydrate it from the broker cookie on load, not only the guarded `?route=me` / `admin-billing` pages; the lobby omitting this bounced signed-in users to `?route=login` on every create/join (fixed in `apps/arena-client/src/App.vue`, PR #547). (2) SERVER — the guarded `/api/match/*` routes must attach their own `koaBody()` (boardgame.io installs a body parser only on its own `/games/*` routes — there is no global one), else `request.body` is undefined, the delegated `setupData` is dropped, and the native `Game.setup` rejects the create with "Missing setupData" (fixed in `matchGate.routes.ts`, PR #551). (3) TESTING — the matchGate unit tests inject `request.body` / the session into a fake context, so none exercised the real end-to-end signed-in create; a single integration test (real request stream → assert `setupData` reaches the delegation) would have caught both (1) and (2).

**Contract surface (verified against on-disk exports):**

| Symbol | Status |
|---|---|
| `registerMatchGateRoutes` | present |
| `MatchGateDependencies` | present |
| `createNativeLobbyGuard` | present |
| `generateInternalDelegationSecret` | present |
| `INTERNAL_DELEGATION_HEADER` | present |
| `NativeLobbyGuardDependencies` | present |

### Friends & Ranked Trust Subsystem

- **Location:** `apps/server/src/friendships`
- **Owning work packet:** [WP-350](docs/ai/work-packets/WP-350-friendships-data-model.md)

The peer-to-peer social graph and the trust boundary it puts on ranked play — the profile surface previously had authentication, public/owner profiles, badges, and team cohorts but no symmetric friend relationship. Shipped as a six-packet arc, all Done 2026-07-11. Packet #1 (WP-350, D-24142): the `legendary.friendships` table (migration 028) — a bigserial PK with requester_id/addressee_id FKs to the INTERNAL `player_id` bigint (the migration-009 profile-family convention, NOT the ext_id text column), a closed status set (`pending | accepted | declined`; `blocked` is deliberately absent — blocking is orthogonal and lands in packet #6), and symmetry stored ONCE per unordered pair via a normalized-pair unique index on (LEAST, GREATEST) so an A→B row makes B→A collide at the DB. The AccountId-keyed state machine (send/accept/decline/remove; declined→pending is an UPDATE, removeFriend DELETEs) plus list helpers and the `areAllMutualFriends` clique predicate (accepted-pair count === C(n,2); n≤1 vacuously true). Packet #2 (WP-351, D-24143): six authenticated-session-required `/api/me/friends*` routes resolving `@handle → AccountId` inbound and enriching to a `FriendSummary` (handle + displayName, NEVER accountId — the FR-2 identity-leak rule). Packet #3 (WP-352, D-24144): the arena-client Friends section on `?route=me`. Packet #4 (WP-353, D-24145): fail-open Brevo transactional emails on request-received / request-accepted (`notifyFriendRequest*` is a single never-throw boundary; a new `brevoTransactional.logic.ts` adds the `POST /v3/smtp/email` path WP-293 lacked). Packet #5 ranked-gate half (WP-354, D-24146): at score submission the authenticated match roster (readSeatAccounts, WP-333) is run through `areAllMutualFriends` and the result stored on `competitive_scores.is_ranked_eligible` (migration 029, NOT NULL DEFAULT true — solo/n≤1 stays ranked; fail-safe to Casual on any friendship-infra throw so scoring never breaks); the public ranked leaderboard SELECT and its parallel COUNT both filter `is_ranked_eligible = true`, evaluated once and immutable (FR-7). Packet #6 (WP-355, D-24147): abuse controls — a SEPARATE `legendary.player_blocks` table (migration 030; blocking is never a friendship status per D-24142, so `blockPlayer` severs any existing friendship transactionally), symmetric block enforcement, a per-day outgoing-request cap (MAX_OUTGOING_PENDING_PER_DAY = 20) and a re-request cooldown (REREQUEST_COOLDOWN_HOURS = 24) enforced block → cooldown → rate-limit before a send, plus three `/api/me/blocks` endpoints. Governing principle: friendship is a trust SIGNAL, not an anti-cheat guarantee — it raises the cost of disposable-account rings, it does not eliminate collusion.

**Contract surface (verified against on-disk exports):**

| Symbol | Status |
|---|---|
| `sendFriendRequest` | present |
| `acceptFriendRequest` | present |
| `declineFriendRequest` | present |
| `removeFriend` | present |
| `listFriends` | present |
| `listIncomingRequests` | present |
| `listOutgoingRequests` | present |
| `getFriendshipStatus` | present |
| `areAllMutualFriends` | present |
| `FRIENDSHIP_STATUSES` | present |
| `FRIENDSHIP_ERROR_CODES` | present |
| `FriendshipView` | present |
| `registerFriendshipRoutes` | present |
| `FriendSummary` | present |
| `FRIEND_API_ERROR_CODES` | present |
| `notifyFriendRequestReceived` | present |
| `notifyFriendRequestAccepted` | present |
| `blockPlayer` | present |
| `unblockPlayer` | present |
| `listBlocks` | present |
| `isEitherBlocked` | present |

## Runtime & toolchain

### Required runtimes

| Runtime | Required | Source |
|---|---|---|
| Node.js (pinned build version) | `24.18.0` | `.node-version` — single source of truth (D-24205) |
| Node.js | `>=22` | `package.json` `engines.node` |
| pnpm | `>=10` | `package.json` `engines.pnpm` |
| packageManager (Corepack pin) | `pnpm@10.32.1` | `package.json` `packageManager` |

### Per-workspace engine overrides

| Workspace | Engines |
|---|---|
| `apps/engine-runner/package.json` | node `>=22` |
| `apps/replay-producer/package.json` | node `>=22` |
| `apps/server/package.json` | node `>=22` |

### Key library versions

| Library | Package | Version(s) |
|---|---|---|
| Vue 3 | `vue` | ^3.4.27 |
| boardgame.io | `boardgame.io` | ^0.50.0 |
| Pinia | `pinia` | ^2.1.7 |
| Vite | `vite` | ^5.3.1 |
| TypeScript | `typescript` | ^5.4.5, ^5.2.2 |
| Zod | `zod` | ^3.23.8, ^3.22.4 |
| node-postgres | `pg` | ^8.13.0 |
| @vue/test-utils | `@vue/test-utils` | ^2.4.6 |

### Operator ops toolchain (out-of-band)

Machine-local tools used for out-of-band infrastructure ops that declare
no repo manifest (so the dependency scanner above does not see them).
Curated in `OPERATOR_OPS_TOOLCHAIN` in `scripts/architecture-inventory.mjs`.

| Tool | Version | Role |
|---|---|---|
| Python | `3.12 (Programs\Python\Python312)` | Interpreter for out-of-band ops scripts (R2 object-metadata via boto3). Invoke by full path — the `python` on PATH is Inkscape's and lacks boto3. |
| pip | `bundled with Python 3.12` | Installs boto3 into the Python 3.12 site-packages. |
| boto3 | `1.43.x` | AWS S3 client used against the Cloudflare R2 S3 endpoint to set Cache-Control on card-image objects (CopyObject + MetadataDirective=REPLACE). Not a repo dependency. |

## Language footprint

Counts derived from on-disk file extensions under `apps/`, `packages/`, `scripts/`, `wiki/` (vendored / generated trees like `node_modules` and `dist` excluded). Extension-blind walk; `package.json` parsing not involved.

### By language (extension-classified)

| Language | Files |
|---|---:|
| TypeScript | 919 |
| Vue SFC | 147 |
| JavaScript | 122 |
| JSON | 107 |
| Markdown | 77 |
| HTML | 16 |
| PowerShell | 10 |
| CSS | 8 |
| TOML | 1 |
| YAML | 1 |

### By extension (raw)

| Extension | Files |
|---|---:|
| `.ts` | 914 |
| `.vue` | 147 |
| `.json` | 107 |
| `.mjs` | 80 |
| `.md` | 77 |
| `.js` | 40 |
| `.html` | 16 |
| `.ps1` | 10 |
| `.css` | 8 |
| `.png` | 7 |
| `.d.ts` | 5 |
| `.txt` | 4 |
| `.example` | 3 |
| `.cjs` | 2 |
| `.gitignore` | 2 |
| `.gitkeep` | 1 |
| `.hugo-version` | 1 |
| `.npmignore` | 1 |
| `.prettierignore` | 1 |
| `.toml` | 1 |
| `.yml` | 1 |

### Toolchain vs source probes

Whether each non-Node language's toolchain marker files and source-file extensions are present anywhere in the scanned tree (or at the repo root for markers like `go.mod`). "Toolchain present + source absent" means the build pipeline depends on this language but no source code in this repo is written in it (e.g. Hugo is a Go binary).

| Language | Toolchain marker present | Source files present |
|---|---|---|
| Go | no | no |
| Python | no | no |
| Rust | no | no |
| Ruby | no | no |
| Java/Kotlin | no | no |
| Docker | no | no |
| Hugo (Go binary) | yes | no |

## Workspace

| Manifest | Name | Role | deps | devDeps | peerDeps |
|---|---|---|---:|---:|---:|
| `apps/arena-client/package.json` | @legendary-arena/arena-client | Gameplay client SPA for Legendary Arena (Vue 3 + Vite + Pinia, TypeScript) | 6 | 13 | 0 |
| `apps/dashboard/package.json` | @legendary-arena/dashboard | Internal admin dashboard SPA for Legendary Arena (Vue 3 + PrimeVue 4 + Vite) | 9 | 13 | 0 |
| `apps/engine-runner/package.json` | @legendary-arena/engine-runner | Headless bot-vs-bot simulation runner CLI for the Legendary Arena engine (Windows-exe Target A, Phase 1) | 2 | 1 | 0 |
| `apps/legends-board/package.json` | @legendary-arena/legends-board | Public Legends Attract Board — read-only scoreboard SPA for legends.legendary-arena.com | 1 | 8 | 0 |
| `apps/registry-viewer/package.json` | registry-viewer | Client-only Registry Viewer for Legendary Arena (Vite + Vue 3) | 4 | 13 | 0 |
| `apps/replay-producer/package.json` | @legendary-arena/replay-producer | CLI Producer App (D-6301) that wraps buildSnapshotSequence with file I/O to emit deterministic ReplaySnapshotSequence JSON | 1 | 3 | 0 |
| `apps/server/package.json` | @legendary-arena/server | Legendary Arena boardgame.io game server — wiring layer only | 10 | 1 | 0 |
| `package.json` | legendary-arena | Legendary Arena monorepo — card registry, viewer, and tooling | 0 | 3 | 0 |
| `packages/game-engine/package.json` | @legendary-arena/game-engine | boardgame.io Game Engine for Legendary Arena | 1 | 2 | 0 |
| `packages/lagn-spec/package.json` | @legendary-arena/lagn | Legendary Arena Game Notation — validator, derived JSON Schema, and CLI | 2 | 5 | 0 |
| `packages/preplan/package.json` | @legendary-arena/preplan | Pre-Planning State Model & Lifecycle (Non-Authoritative, Per-Client) | 0 | 2 | 1 |
| `packages/registry/package.json` | @legendary-arena/registry | Card Data Access Layer for Legendary Arena | 1 | 7 | 0 |
| `packages/vue-sfc-loader/package.json` | @legendary-arena/vue-sfc-loader | Node module-loader hook that compiles Vue 3 Single-File Components for node:test consumers | 1 | 7 | 2 |

## Adopted libraries by category

### Framework — client

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `@vitejs/plugin-vue` | ^5.0.5 | 4 _(partial)_ | `apps/arena-client/package.json` (dev); `apps/dashboard/package.json` (dev); `apps/legends-board/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `@vue/compiler-sfc` | ^3.4.27 | 1 _(minimal)_ | `packages/vue-sfc-loader/package.json` (dev); `packages/vue-sfc-loader/package.json` (peer) |
| `pinia` | ^2.1.7 | 53 _(comprehensive)_ | `apps/arena-client/package.json` (dep); `apps/dashboard/package.json` (dep) |
| `vite` | ^5.3.1 | 7 _(partial)_ | `apps/arena-client/package.json` (dev); `apps/dashboard/package.json` (dev); `apps/legends-board/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `vue` | ^3.4.27 | 194 _(comprehensive)_ | `apps/arena-client/package.json` (dep); `apps/dashboard/package.json` (dep); `apps/legends-board/package.json` (dep); `apps/registry-viewer/package.json` (dep); `packages/vue-sfc-loader/package.json` (dev); `packages/vue-sfc-loader/package.json` (peer) |
| `vue-router` | ^4.3.2 | 6 _(partial)_ | `apps/dashboard/package.json` (dep) |

_Other candidates in this category not currently installed:_ `@vue/runtime-core`

### Framework — server

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `boardgame.io` | ^0.50.0 | 42 _(comprehensive)_ | `apps/arena-client/package.json` (dep); `apps/server/package.json` (dep); `packages/game-engine/package.json` (dep) |

_Other candidates in this category not currently installed:_ `koa`, `@koa/router`, `koa-bodyparser`, `koa-static`, `express`, `fastify`, `hono`

### Realtime / networking

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `socket.io`
- `socket.io-client`
- `ws`
- `sockjs`
- `sockjs-client`
- `engine.io`
- `engine.io-client`

### HTTP client

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `axios` | ^1.7.2 | 2 _(minimal)_ | `apps/dashboard/package.json` (dep) |

_Other candidates in this category not currently installed:_ `ofetch`, `ky`, `undici`

### Data fetching / cache

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `@tanstack/vue-query`
- `@tanstack/query-core`
- `swrv`

### Schema / validation

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `ajv` | ^8.20.0 | 1 _(minimal)_ | `packages/lagn-spec/package.json` (dev) |
| `zod` | ^3.23.8, ^3.22.4 | 10 _(partial)_ | `apps/registry-viewer/package.json` (dep); `packages/lagn-spec/package.json` (dep); `packages/registry/package.json` (dep) |

_Other candidates in this category not currently installed:_ `valibot`, `yup`, `joi`, `superstruct`

### Forms

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `vee-validate`
- `@formkit/core`
- `@formkit/vue`
- `@vuelidate/core`
- `@vuelidate/validators`

### Styling

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `tailwindcss`
- `unocss`
- `windicss`
- `sass`
- `postcss`
- `autoprefixer`
- `@unocss/preset-uno`

### UI component libraries

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `@primevue/themes` | ^4.0.0 | 1 _(minimal)_ | `apps/dashboard/package.json` (dep) |
| `primevue` | ^4.0.0 | 5 _(partial)_ | `apps/dashboard/package.json` (dep) |

_Other candidates in this category not currently installed:_ `primeicons`, `vuetify`, `naive-ui`, `element-plus`, `quasar`, `radix-vue`, `reka-ui`, `shadcn-vue`

### Charts / data viz

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `echarts` | ^5.5.0 | 12 _(partial)_ | `apps/dashboard/package.json` (dep) |
| `vue-echarts` | ^7.0.3 | 1 _(minimal)_ | `apps/dashboard/package.json` (dep) |

_Other candidates in this category not currently installed:_ `chart.js`, `vue-chartjs`, `d3`, `apexcharts`, `vue3-apexcharts`

### Icons

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `@iconify/vue`
- `@iconify/json`
- `lucide-vue-next`
- `heroicons`
- `unplugin-icons`

### Animation

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `gsap`
- `motion-v`
- `animejs`
- `@vueuse/motion`
- `lottie-web`
- `lottie-vue`
- `auto-animate`
- `@formkit/auto-animate`

### State (non-Pinia)

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `vuex`
- `zustand`
- `jotai`
- `xstate`

### Database

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `pg` | ^8.13.0 | 48 _(comprehensive)_ | `apps/server/package.json` (dep) |

_Other candidates in this category not currently installed:_ `postgres`, `drizzle-orm`, `prisma`, `@prisma/client`, `kysely`, `mysql2`, `sqlite3`, `better-sqlite3`

### Auth

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `@teamhanko/hanko-elements` | ^2.4.0 | 2 _(minimal)_ | `apps/arena-client/package.json` (dep); `apps/dashboard/package.json` (dep) |

_Other candidates in this category not currently installed:_ `@teamhanko/hanko-frontend-sdk`, `lucia`, `oslo`, `auth0`, `next-auth`, `better-auth`, `jose`, `jsonwebtoken`

### Storage / cloud

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `@aws-sdk/client-s3` | ^3.600.0 | 3 _(partial)_ | `apps/server/package.json` (dep); `packages/registry/package.json` (dev) |

_Other candidates in this category not currently installed:_ `@aws-sdk/s3-request-presigner`, `aws-sdk`

### Testing

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `@vue/test-utils` | ^2.4.6 | 65 _(comprehensive)_ | `apps/arena-client/package.json` (dev); `packages/vue-sfc-loader/package.json` (dev) |
| `jsdom` | ^24.1.0 | 2 _(minimal)_ | `apps/arena-client/package.json` (dev); `packages/vue-sfc-loader/package.json` (dev) |

_Other candidates in this category not currently installed:_ `vitest`, `happy-dom`, `playwright`, `@playwright/test`, `cypress`, `msw`, `sinon`, `fast-check`

### A11y testing

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `axe-core`
- `@axe-core/playwright`
- `vitest-axe`
- `jest-axe`

### Lint / format

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `@typescript-eslint/eslint-plugin` | ^7.18.0 | 0 ⚠ | `apps/dashboard/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `@typescript-eslint/parser` | ^7.18.0 | 2 _(minimal)_ | `apps/dashboard/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `@vue/eslint-config-typescript` | ^13.0.0 | 2 _(minimal)_ | `apps/dashboard/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `eslint` | ^8.57.1 | 0 _(tooling)_ | `apps/dashboard/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `eslint-plugin-vue` | ^9.33.0 | 2 _(minimal)_ | `apps/dashboard/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `eslint-plugin-vuejs-accessibility` | ^2.5.0 | 1 _(minimal)_ | `apps/registry-viewer/package.json` (dev) |
| `prettier` | ^3.3.0 | 1 _(minimal)_ | `apps/dashboard/package.json` (dev) |

_Other candidates in this category not currently installed:_ `typescript-eslint`

### Build / typecheck / transform

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `tsx` | ^4.15.7, ^4.7.0 | 0 _(tooling)_ | `apps/arena-client/package.json` (dev); `apps/dashboard/package.json` (dev); `apps/engine-runner/package.json` (dev); `apps/legends-board/package.json` (dev); `apps/registry-viewer/package.json` (dev); `apps/replay-producer/package.json` (dev); `apps/server/package.json` (dev); `package.json` (dev); `packages/game-engine/package.json` (dev); `packages/lagn-spec/package.json` (dev); `packages/preplan/package.json` (dev); `packages/registry/package.json` (dev); `packages/vue-sfc-loader/package.json` (dev) |
| `typescript` | ^5.4.5, ^5.2.2 | 1 _(minimal)_ | `apps/arena-client/package.json` (dev); `apps/dashboard/package.json` (dev); `apps/legends-board/package.json` (dev); `apps/registry-viewer/package.json` (dev); `apps/replay-producer/package.json` (dev); `package.json` (dev); `packages/game-engine/package.json` (dev); `packages/lagn-spec/package.json` (dev); `packages/preplan/package.json` (dev); `packages/registry/package.json` (dev); `packages/vue-sfc-loader/package.json` (dep); `packages/vue-sfc-loader/package.json` (dev) |
| `vue-tsc` | ^2.0.19 | 0 _(tooling)_ | `apps/arena-client/package.json` (dev); `apps/dashboard/package.json` (dev); `apps/legends-board/package.json` (dev); `apps/registry-viewer/package.json` (dev) |

_Other candidates in this category not currently installed:_ `esbuild`, `rollup`, `unplugin-vue-components`, `unplugin-auto-import`

### Observability

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `@sentry/vue`
- `@sentry/node`
- `@sentry/browser`
- `pino`
- `winston`
- `@opentelemetry/api`
- `@opentelemetry/sdk-node`

### Date / time

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `dayjs`
- `date-fns`
- `luxon`

### Utilities

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `@vueuse/core`
- `@vueuse/integrations`
- `lodash`
- `lodash-es`
- `ramda`
- `remeda`

### Notifications / overlays

_No packages from this category are installed._

Candidates considered for this category (none adopted):

- `vue-toastification`
- `@kyvg/vue3-notification`
- `vue-sonner`
- `floating-vue`

### Other / uncategorized

Packages installed but not mapped to a category in this
script. Add to `CATEGORY_DEFINITIONS` if any of these
become load-bearing.

| Package | Version(s) | Files importing | Declared in |
|---|---|---:|---|
| `@cloudflare/workers-types` | ^4.20260701.1, ^4.20240620.0 | 1 _(minimal)_ | `apps/arena-client/package.json` (dev); `packages/registry/package.json` (dev) |
| `@koa/multer` | ^3.0.2 | 1 _(minimal)_ | `apps/server/package.json` (dep) |
| `@legendary-arena/game-engine` | workspace:* | 135 _(comprehensive)_ | `apps/arena-client/package.json` (dev); `apps/engine-runner/package.json` (dep); `apps/replay-producer/package.json` (dep); `apps/server/package.json` (dep); `package.json` (dev); `packages/preplan/package.json` (peer) |
| `@legendary-arena/lagn` | workspace:* | 10 _(partial)_ | `apps/legends-board/package.json` (dev); `apps/registry-viewer/package.json` (dep); `apps/server/package.json` (dep) |
| `@legendary-arena/preplan` | workspace:* | 9 _(partial)_ | `apps/arena-client/package.json` (dep) |
| `@legendary-arena/registry` | workspace:* | 44 _(comprehensive)_ | `apps/engine-runner/package.json` (dep); `apps/registry-viewer/package.json` (dep); `apps/server/package.json` (dep) |
| `@legendary-arena/vue-sfc-loader` | workspace:* | 0 ⚠ | `apps/arena-client/package.json` (dev) |
| `@types/howler` | ^2.2.13 | 0 _(tooling)_ | `apps/arena-client/package.json` (dev) |
| `@types/jsdom` | ^21.1.7 | 0 _(tooling)_ | `apps/arena-client/package.json` (dev) |
| `@types/node` | ^22.19.17, ^20.0.0, ^25.6.0 | 7 _(partial)_ | `apps/arena-client/package.json` (dev); `apps/dashboard/package.json` (dev); `apps/legends-board/package.json` (dev); `apps/registry-viewer/package.json` (dev); `apps/replay-producer/package.json` (dev); `packages/lagn-spec/package.json` (dev); `packages/registry/package.json` (dev); `packages/vue-sfc-loader/package.json` (dev) |
| `@vue/tsconfig` | ^0.5.1 | 2 _(minimal)_ | `apps/legends-board/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `ajv-formats` | ^3.0.1 | 1 _(minimal)_ | `packages/lagn-spec/package.json` (dev) |
| `dotenv` | ^16.4.5 | 2 _(minimal)_ | `packages/registry/package.json` (dev) |
| `eslint-config-prettier` | ^9.1.0 | 1 _(minimal)_ | `apps/dashboard/package.json` (dev) |
| `fast-glob` | ^3.3.2 | 0 ⚠ | `packages/registry/package.json` (dev) |
| `howler` | ^2.2.4 | 1 _(minimal)_ | `apps/arena-client/package.json` (dep) |
| `koa-body` | ^5.0.0 | 8 _(partial)_ | `apps/server/package.json` (dep) |
| `sharp` | ^0.33.0 | 1 _(minimal)_ | `apps/server/package.json` (dep) |
| `stripe` | 22.1.0 | 5 _(partial)_ | `apps/server/package.json` (dep) |
| `zod-to-json-schema` | ^3.25.2 | 1 _(minimal)_ | `packages/lagn-spec/package.json` (dep) |

## SaaS / embedded services

Tools detected via static pattern-matching of source files
(HTML, JS, Vue templates, config). These do not appear in
`package.json` and would otherwise be invisible to
dependency-based inventory.

| Service | Category | Detected in | Description |
|---|---|---:|---|
| `brevo` | marketing / email | 13 files | Transactional + marketing email, newsletter forms, SMTP relay. |
| `snipcart` | ecommerce | 1 file | Cart overlay via CDN script + HTML data attributes. |

### SaaS usage detail

#### brevo

- `apps/server/src/marketing/brevoEnqueue.logic.test.ts`
- `apps/server/src/marketing/brevoEnqueue.logic.ts`
- `apps/server/src/marketing/brevoTransactional.logic.test.ts`
- `apps/server/src/marketing/brevoTransactional.logic.ts`
- `docs/ai/DECISIONS.md`
- `docs/ai/STATUS.md`
- `docs/ai/execution-checklists/EC-325-game-signup-brevo-enqueue.checklist.md`
- `docs/ai/execution-checklists/EC-383-friend-request-email-notifications.checklist.md`
- `docs/ai/work-packets/WP-293-game-signup-brevo-enqueue.md`
- `docs/ai/work-packets/WP-353-friend-request-email-notifications.md`
- `wiki/brevo-email-pipeline.md`
- `wiki/hugo-onboarding.md`
- `wiki/hugo-web-system.md`

#### snipcart

- `wiki/hugo-web-system.md`

## Importance tiering

Same packages as the category tables above, pivoted by **blast
radius if removed** instead of by concern. Three tiers:

- **Foundational** — replacing it means rewriting the
  architecture (engine model, runtime contract, schema
  discipline, or persistence story rests on this dep).
- **Adopted** — explicit framework choice locked by a WP or
  `DECISIONS.md` entry; replaceable with significant effort.
- **Tooling** — supports the dev / test / build loop;
  replaceable with low effort, no architectural surface depends
  on the choice.

Curation is a judgment call, not derived from data. Anything
installed but not yet placed surfaces under "Not yet classified".

### Foundational

| Package | Version(s) | Adoption | Files importing |
|---|---|---|---:|
| `boardgame.io` | ^0.50.0 | direct dep — `apps/arena-client/package.json`, `apps/server/package.json`, `packages/game-engine/package.json` | 42 _(comprehensive)_ |
| `pg` | ^8.13.0 | direct dep — `apps/server/package.json` | 48 _(comprehensive)_ |
| `typescript` | ^5.4.5, ^5.2.2 | direct dep — `apps/arena-client/package.json`, `apps/dashboard/package.json`, `apps/legends-board/package.json`, `apps/registry-viewer/package.json`, `apps/replay-producer/package.json`, `package.json`, `packages/game-engine/package.json`, `packages/lagn-spec/package.json`, `packages/preplan/package.json`, `packages/registry/package.json`, `packages/vue-sfc-loader/package.json` | 1 _(minimal)_ |
| `zod` | ^3.23.8, ^3.22.4 | direct dep — `apps/registry-viewer/package.json`, `packages/lagn-spec/package.json`, `packages/registry/package.json` | 10 _(partial)_ |

### Adopted

| Package | Version(s) | Adoption | Files importing |
|---|---|---|---:|
| `@aws-sdk/client-s3` | ^3.600.0 | direct dep — `apps/server/package.json`, `packages/registry/package.json` | 3 _(partial)_ |
| `@koa/router` | 10.1.1 | transitive via `boardgame.io` | _(transitive)_ |
| `axios` | ^1.7.2 | direct dep — `apps/dashboard/package.json` | 2 _(minimal)_ |
| `echarts` | ^5.5.0 | direct dep — `apps/dashboard/package.json` | 12 _(partial)_ |
| `koa` | 2.16.4 | transitive via `boardgame.io` | _(transitive)_ |
| `pinia` | ^2.1.7 | direct dep — `apps/arena-client/package.json`, `apps/dashboard/package.json` | 53 _(comprehensive)_ |
| `primevue` | ^4.0.0 | direct dep — `apps/dashboard/package.json` | 5 _(partial)_ |
| `socket.io` | 3.1.2, 4.8.3 | transitive via `boardgame.io` | _(transitive)_ |
| `socket.io-client` | 4.8.3 | transitive via `boardgame.io` | _(transitive)_ |
| `vite` | ^5.3.1 | direct dep — `apps/arena-client/package.json`, `apps/dashboard/package.json`, `apps/legends-board/package.json`, `apps/registry-viewer/package.json` | 7 _(partial)_ |
| `vue` | ^3.4.27 | direct dep — `apps/arena-client/package.json`, `apps/dashboard/package.json`, `apps/legends-board/package.json`, `apps/registry-viewer/package.json`, `packages/vue-sfc-loader/package.json` | 194 _(comprehensive)_ |
| `vue-router` | ^4.3.2 | direct dep — `apps/dashboard/package.json` | 6 _(partial)_ |

### Tooling

| Package | Version(s) | Adoption | Files importing |
|---|---|---|---:|
| `@cloudflare/workers-types` | ^4.20260701.1, ^4.20240620.0 | direct dep — `apps/arena-client/package.json`, `packages/registry/package.json` | 1 _(minimal)_ |
| `@types/jsdom` | ^21.1.7 | direct dep — `apps/arena-client/package.json` | 0 _(tooling)_ |
| `@types/node` | ^22.19.17, ^20.0.0, ^25.6.0 | direct dep — `apps/arena-client/package.json`, `apps/dashboard/package.json`, `apps/legends-board/package.json`, `apps/registry-viewer/package.json`, `apps/replay-producer/package.json`, `packages/lagn-spec/package.json`, `packages/registry/package.json`, `packages/vue-sfc-loader/package.json` | 7 _(partial)_ |
| `@typescript-eslint/eslint-plugin` | ^7.18.0 | direct dep — `apps/dashboard/package.json`, `apps/registry-viewer/package.json` | 0 ⚠ |
| `@typescript-eslint/parser` | ^7.18.0 | direct dep — `apps/dashboard/package.json`, `apps/registry-viewer/package.json` | 2 _(minimal)_ |
| `@vitejs/plugin-vue` | ^5.0.5 | direct dep — `apps/arena-client/package.json`, `apps/dashboard/package.json`, `apps/legends-board/package.json`, `apps/registry-viewer/package.json` | 4 _(partial)_ |
| `@vue/compiler-sfc` | ^3.4.27 | direct dep — `packages/vue-sfc-loader/package.json` | 1 _(minimal)_ |
| `@vue/eslint-config-typescript` | ^13.0.0 | direct dep — `apps/dashboard/package.json`, `apps/registry-viewer/package.json` | 2 _(minimal)_ |
| `@vue/test-utils` | ^2.4.6 | direct dep — `apps/arena-client/package.json`, `packages/vue-sfc-loader/package.json` | 65 _(comprehensive)_ |
| `@vue/tsconfig` | ^0.5.1 | direct dep — `apps/legends-board/package.json`, `apps/registry-viewer/package.json` | 2 _(minimal)_ |
| `dotenv` | ^16.4.5 | direct dep — `packages/registry/package.json` | 2 _(minimal)_ |
| `eslint` | ^8.57.1 | direct dep — `apps/dashboard/package.json`, `apps/registry-viewer/package.json` | 0 _(tooling)_ |
| `eslint-plugin-vue` | ^9.33.0 | direct dep — `apps/dashboard/package.json`, `apps/registry-viewer/package.json` | 2 _(minimal)_ |
| `eslint-plugin-vuejs-accessibility` | ^2.5.0 | direct dep — `apps/registry-viewer/package.json` | 1 _(minimal)_ |
| `fast-glob` | ^3.3.2 | direct dep — `packages/registry/package.json` | 0 ⚠ |
| `jsdom` | ^24.1.0 | direct dep — `apps/arena-client/package.json`, `packages/vue-sfc-loader/package.json` | 2 _(minimal)_ |
| `tsx` | ^4.15.7, ^4.7.0 | direct dep — `apps/arena-client/package.json`, `apps/dashboard/package.json`, `apps/engine-runner/package.json`, `apps/legends-board/package.json`, `apps/registry-viewer/package.json`, `apps/replay-producer/package.json`, `apps/server/package.json`, `package.json`, `packages/game-engine/package.json`, `packages/lagn-spec/package.json`, `packages/preplan/package.json`, `packages/registry/package.json`, `packages/vue-sfc-loader/package.json` | 0 _(tooling)_ |
| `vue-tsc` | ^2.0.19 | direct dep — `apps/arena-client/package.json`, `apps/dashboard/package.json`, `apps/legends-board/package.json`, `apps/registry-viewer/package.json` | 0 _(tooling)_ |

### Not yet classified

Packages declared in some `package.json` but not yet placed
into Foundational / Adopted / Tooling. Add to
`IMPORTANCE_DEFINITIONS` near the top of the script when any
of these become load-bearing for the architecture.

- `@koa/multer`
- `@primevue/themes`
- `@teamhanko/hanko-elements`
- `@types/howler`
- `ajv`
- `ajv-formats`
- `eslint-config-prettier`
- `howler`
- `koa-body`
- `prettier`
- `sharp`
- `stripe`
- `vue-echarts`
- `zod-to-json-schema`

## Anomalies

### Declared but no source imports detected

Heuristic: package appears in a `package.json` but no file
under `apps/`, `packages/`, or `scripts/` matches a
`from '<pkg>'` / `import('<pkg>')` / `require('<pkg>')`
pattern, **and** it is not referenced by any `tsconfig*.json`
(`extends` / `compilerOptions.types`) or `.eslintrc.*` /
`eslint.config.*` (`extends` / `parser` / `plugins`).
CLI-only tools (`tsx`, `vite`, `vue-tsc`, `eslint`,
`prettier`, `typescript`) are excluded as expected
zero-import.

| Package | Declared in |
|---|---|
| `@legendary-arena/vue-sfc-loader` | `apps/arena-client/package.json` (dev) |
| `@typescript-eslint/eslint-plugin` | `apps/dashboard/package.json` (dev); `apps/registry-viewer/package.json` (dev) |
| `fast-glob` | `packages/registry/package.json` (dev) |

### Version drift across workspace

Same package declared with different version ranges in
different manifests. Worth aligning unless intentional.

| Package | Versions | Locations |
|---|---|---|
| `@cloudflare/workers-types` | ^4.20260701.1, ^4.20240620.0 | `apps/arena-client/package.json` ^4.20260701.1; `packages/registry/package.json` ^4.20240620.0 |
| `@types/node` | ^22.19.17, ^20.0.0, ^25.6.0 | `apps/arena-client/package.json` ^22.19.17; `apps/dashboard/package.json` ^22.19.17; `apps/legends-board/package.json` ^22.19.17; `apps/registry-viewer/package.json` ^22.19.17; `apps/replay-producer/package.json` ^22.19.17; `packages/lagn-spec/package.json` ^20.0.0; `packages/registry/package.json` ^25.6.0; `packages/vue-sfc-loader/package.json` ^22.19.17 |
| `tsx` | ^4.15.7, ^4.7.0 | `apps/arena-client/package.json` ^4.15.7; `apps/dashboard/package.json` ^4.15.7; `apps/engine-runner/package.json` ^4.15.7; `apps/legends-board/package.json` ^4.15.7; `apps/registry-viewer/package.json` ^4.15.7; `apps/replay-producer/package.json` ^4.15.7; `apps/server/package.json` ^4.15.7; `package.json` ^4.15.7; `packages/game-engine/package.json` ^4.15.7; `packages/lagn-spec/package.json` ^4.7.0; `packages/preplan/package.json` ^4.15.7; `packages/registry/package.json` ^4.15.7; `packages/vue-sfc-loader/package.json` ^4.15.7 |
| `typescript` | ^5.4.5, ^5.2.2 | `apps/arena-client/package.json` ^5.4.5; `apps/dashboard/package.json` ^5.4.5; `apps/legends-board/package.json` ^5.4.5; `apps/registry-viewer/package.json` ^5.4.5; `apps/replay-producer/package.json` ^5.4.5; `package.json` ^5.4.5; `packages/game-engine/package.json` ^5.4.5; `packages/lagn-spec/package.json` ^5.2.2; `packages/preplan/package.json` ^5.4.5; `packages/registry/package.json` ^5.4.5; `packages/vue-sfc-loader/package.json` ^5.4.5; `packages/vue-sfc-loader/package.json` ^5.4.5 |
| `zod` | ^3.23.8, ^3.22.4 | `apps/registry-viewer/package.json` ^3.23.8; `packages/lagn-spec/package.json` ^3.22.4; `packages/registry/package.json` ^3.23.8 |

## tsconfig references

Packages reached via `tsconfig*.json` — `extends` and
`compilerOptions.types`. Source-file import counts miss
these because they live in JSON, but the deps are real
(removing them would break the build).

| tsconfig | Referenced packages |
|---|---|
| `apps/arena-client/functions/tsconfig.json` | `@cloudflare/workers-types`, `@types/node` |
| `apps/arena-client/tsconfig.json` | `@types/node`, `vite` |
| `apps/dashboard/tsconfig.json` | `@types/node`, `vite` |
| `apps/legends-board/tsconfig.json` | `@types/node`, `@vue/tsconfig` |
| `apps/registry-viewer/tsconfig.json` | `@types/node`, `@vue/tsconfig`, `vite` |
| `apps/replay-producer/tsconfig.json` | `@types/node` |
| `packages/lagn-spec/tsconfig.json` | `@types/node` |

## ESLint config references

Packages reached via `.eslintrc.*` or `eslint.config.*`
— `extends`, `parser`, `parserOptions.parser`, and
`plugins` string entries. ESLint resolves these via
shortname conventions (`'plugin:vue/...'` ->
`eslint-plugin-vue`), so the source-import scan misses
them entirely.

| Config file | Referenced packages |
|---|---|
| `apps/dashboard/.eslintrc.cjs` | `@typescript-eslint/parser`, `@vue/eslint-config-typescript`, `eslint-config-prettier`, `eslint-plugin-vue`, `prettier` |
| `apps/registry-viewer/.eslintrc.cjs` | `@typescript-eslint/parser`, `@vue/eslint-config-typescript`, `eslint-plugin-vue`, `eslint-plugin-vuejs-accessibility` |

## Transitive dependencies (lockfile)

Lockfile resolves **618** packages: **44** are direct dependencies declared in some `package.json`, **574** are transitive.

### Transitive packages matching tracked categories

These are dependencies you did **not** declare directly
but that pnpm resolved into the install tree. They are
reachable at runtime, so a "category not adopted" line
elsewhere in this report can still mean "we ship it
transitively."

| Package | Category | Resolved version(s) |
|---|---|---|
| `@koa/router` | Framework — server | 10.1.1 |
| `@teamhanko/hanko-frontend-sdk` | Auth | 2.6.0 |
| `@vue/runtime-core` | Framework — client | 3.5.30 |
| `engine.io` | Realtime / networking | 4.1.2, 6.6.6 |
| `engine.io-client` | Realtime / networking | 6.6.4 |
| `esbuild` | Build / typecheck / transform | 0.21.5, 0.27.4 |
| `koa` | Framework — server | 2.16.4 |
| `lodash` | Utilities | 4.18.1 |
| `postcss` | Styling | 8.5.8 |
| `rollup` | Build / typecheck / transform | 4.60.0 |
| `socket.io` | Realtime / networking | 3.1.2, 4.8.3 |
| `socket.io-client` | Realtime / networking | 4.8.3 |
| `ws` | Realtime / networking | 7.4.6, 8.18.3 |

## Architecture-doc cross-reference

Heuristic comparison: which package names appear in
backticks inside the architecture docs vs. which are
actually installed. Mismatches are not errors — docs may
reference deferred items (e.g., Hanko) — but they are worth
a reviewer's eye.

### `docs/ai/ARCHITECTURE.md`

- Package mentions in doc: **10**
- Mentioned in doc but not installed: **2**

  - `@koa/router`
  - `koa`

- Installed but never mentioned in doc: **21**

  - `@aws-sdk/client-s3`
  - `@primevue/themes`
  - `@teamhanko/hanko-elements`
  - `@typescript-eslint/eslint-plugin`
  - `@typescript-eslint/parser`
  - `@vitejs/plugin-vue`
  - `@vue/eslint-config-typescript`
  - `ajv`
  - `axios`
  - `echarts`
  - `eslint`
  - `eslint-plugin-vue`
  - `eslint-plugin-vuejs-accessibility`
  - `pinia`
  - `prettier`
  - `primevue`
  - `tsx`
  - `vite`
  - `vue-echarts`
  - `vue-router`
  - `vue-tsc`

### `docs/02-ARCHITECTURE.md`

- Package mentions in doc: **7**
- Mentioned in doc but not installed: **3**

  - `@koa/router`
  - `jsonwebtoken`
  - `koa`

- Installed but never mentioned in doc: **25**

  - `@aws-sdk/client-s3`
  - `@primevue/themes`
  - `@teamhanko/hanko-elements`
  - `@typescript-eslint/eslint-plugin`
  - `@typescript-eslint/parser`
  - `@vitejs/plugin-vue`
  - `@vue/eslint-config-typescript`
  - `@vue/test-utils`
  - `ajv`
  - `axios`
  - `echarts`
  - `eslint`
  - `eslint-plugin-vue`
  - `eslint-plugin-vuejs-accessibility`
  - `jsdom`
  - `pinia`
  - `prettier`
  - `primevue`
  - `tsx`
  - `typescript`
  - `vite`
  - `vue-echarts`
  - `vue-router`
  - `vue-tsc`
  - `zod`

## How to use this report

1. Open this file alongside `docs/02-ARCHITECTURE.md`.
2. Paste both into the gap-analysis prompt
   (`scripts/architecture-inventory.prompt.md` if you keep
   it, or the prompt in your prior chat) and ask for
   prioritized recommendations.
3. The "Declared but no source imports" table is the
   highest-signal section — it surfaces deferred work and
   accidental dependencies in seconds.

### Running the script

```bash
# Baseline — npm deps + import graph only (no SaaS detection):
node scripts/architecture-inventory.mjs --out wiki/architecture-inventory.md

# With marketing website repo — includes SaaS / embedded service detections
# (Brevo, Snipcart, etc.) from the legendary-arena-com repo:
node scripts/architecture-inventory.mjs --out wiki/architecture-inventory.md \
  --external C:\www\legendary-arena-com
```

The `--external <path>` flag is repeatable — add as many
sibling repos as needed. Each external repo's files appear
prefixed with `[repo-name]` in the SaaS detail section
so you can tell at a glance which repo a detection came from.

### Automated updates

This report is regenerated automatically by
`.github/workflows/architecture-inventory.yml` on a weekly
cron schedule (Mondays 06:00 UTC). The workflow:

1. Checks out both this repo and
   `legendary-arena/legendary-arena-website` (for SaaS
   detection).
2. Runs the inventory script with `--external` pointed at
   the website checkout.
3. If the output differs from the committed copy, opens a PR
   on the `bot/architecture-inventory-refresh` branch for
   human review.
4. If no diff, no-ops silently.

The workflow can also be triggered manually via
`workflow_dispatch` in the GitHub Actions UI. Hand-edits to
this file are non-authoritative and will be overwritten by
the next cron run.
