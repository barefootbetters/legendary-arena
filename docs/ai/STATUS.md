# STATUS.md — Legendary Arena

> Current state of the project after each Work Packet or Foundation Prompt.
> Updated at the end of every execution session.

---

## Current State

### Foundation Prompt 00.4 — Connection & Environment Health Check (2026-04-09)

**What exists now:**
- `scripts/check-connections.mjs` — Node.js ESM health check for all external
  services (PostgreSQL, boardgame.io server, Cloudflare R2, Cloudflare Pages,
  GitHub API, rclone R2 bucket)
- `scripts/Check-Env.ps1` — PowerShell tooling check (Node, pnpm, dotenv-cli,
  git, rclone, .env file, npm packages) — runs without Node.js or network
- `.env.example` — definitive 9-variable reference for the whole project
- `pnpm check` and `pnpm check:env` script entries in package.json

**What a developer can do:**
- Run `pwsh scripts/Check-Env.ps1` on a fresh machine to verify all tools
- Run `pnpm check` to verify all external service connections
- Both produce clear pass/fail reports with remediation for every failure

**Known gaps (expected at this stage):**
- No .env file yet (must be created from .env.example)
- boardgame.io and zod not installed (no game-engine package yet)
- PostgreSQL and game server connections will fail until Foundation Prompt 01

### Foundation Prompt 00.5 — R2 Data & Image Validation (2026-04-09)

**What exists now:**
- `scripts/validate-r2.mjs` — Node.js ESM R2 validation with 4 phases:
  Phase 1: registry check (sets.json), Phase 2: per-set metadata validation,
  Phase 3: image spot-checks (HEAD only), Phase 4: cross-set slug deduplication
- `pnpm validate` runs the full validation against live R2 (no .env needed)

**Live validation results (2026-04-09):**
- 40 sets validated, 0 errors, 74 warnings (known data quality issues)
- 6 missing images (URL pattern mismatches on specific sets)
- 43 cross-set duplicate slugs (expected — same heroes appear in multiple sets)

**Known data quality issues (per 00.2 §12):**
- `[object Object]` abilities in msmc, bkpt, msis sets
- Missing `vp` field on 2 masterminds in mgtg set
- 1 hero card missing `cost` and `hc` in anni set

### Foundation Prompt 01 — Render.com Backend Setup (2026-04-09)

**What exists now:**
- `apps/server/` — new pnpm workspace package (`@legendary-arena/server`)
  - `src/rules/loader.mjs` — loads `legendary.rules` and `legendary.rule_docs`
    from PostgreSQL at startup, caches in memory, exports `loadRules()` and
    `getRules()`
  - `src/game/legendary.mjs` — minimal boardgame.io `Game()` definition wired
    to the rules cache. Placeholder move (`playCard`) and endgame condition.
    No real game logic — that belongs in `packages/game-engine/` (WP-002+).
  - `src/server.mjs` — boardgame.io `Server()` with CORS (production SPA +
    localhost:5173), `/health` endpoint on koa router, rules count logging
  - `src/index.mjs` — process entrypoint with SIGTERM graceful shutdown
- `data/schema-server.sql` — rules-engine DDL subset (sets, masterminds,
  villain_groups, schemes, rules, rule_docs) in `legendary.*` namespace.
  All tables use `bigserial` PKs, `IF NOT EXISTS`, indexed.
- `data/seed-server.sql` — seed data with complete Galactus (Core Set)
  example: set, mastermind (strike 5, vp 6), Heralds of Galactus villain
  group, Brotherhood, two schemes. Wrapped in a transaction.
- `render.yaml` — Render infrastructure-as-code provisioning web service
  + managed PostgreSQL (starter plan) in one deploy

**What a developer can do:**
- `pnpm install` detects the new server workspace and installs deps
- `node --env-file=.env apps/server/src/server.mjs` starts the server
- `GET /health` returns `{ "status": "ok" }` for Render and pnpm check
- `psql $DATABASE_URL -f data/schema-server.sql` creates rules-engine tables
- `psql $DATABASE_URL -f data/seed-server.sql` seeds Galactus example
- `render deploy` provisions both services from `render.yaml`

**Known gaps (expected at this stage):**
- No real game logic — `LegendaryGame` is a placeholder (WP-002)
- No card registry loading at startup (WP-003 registry package needed)
- No authentication (separate WP)
- No lobby/match creation CLI scripts (WP-011/012)

### Foundation Prompt 02 — Database Migrations (2026-04-09)

**What exists now:**
- `scripts/migrate.mjs` — zero-dependency ESM migration runner using `pg` only.
  Reads `.sql` files from `data/migrations/`, applies them in filename order,
  tracks applied migrations in `public.schema_migrations`. Resolves `\i`
  directives (psql includes) by inlining referenced files. Strips embedded
  `BEGIN`/`COMMIT` wrappers to avoid nested transaction issues.
- `data/migrations/001_server_schema.sql` — includes `data/schema-server.sql`
  (rules-engine DDL: legendary.source_files, sets, masterminds, villain_groups,
  schemes, rules, rule_docs)
- `data/migrations/002_seed_rules.sql` — includes `data/seed_rules.sql`
  (rules index + rule_docs glossary + source_files audit records)
- `data/migrations/003_game_sessions.sql` — creates `public.game_sessions`
  table for match tracking (match_id, status, player_count, mastermind_ext_id,
  scheme_ext_id). Uses `text` ext_id references, not bigint FKs.
- `render.yaml` buildCommand updated to run migrations before server start
- `pnpm migrate` script entry in root package.json

**What a developer can do:**
- `pnpm migrate` applies pending migrations against local PostgreSQL
- Running twice is safe — idempotent (0 applied, 3 skipped on second run)
- `render deploy` runs migrations automatically in the build step

**Known gaps (expected at this stage):**
- No rollback mechanism (manual recovery via `psql` if needed)
- No real game logic — game_sessions table is created but not yet used
- Card registry not loaded at startup (WP-003 needed)

### WP-004 — Server Bootstrap: Game Engine + Registry Integration (2026-04-09)

**What changed:**
- `apps/server/src/game/legendary.mjs` — replaced placeholder `Game()` definition
  with a thin re-export of `LegendaryGame` from `@legendary-arena/game-engine`
- `apps/server/src/server.mjs` — imports `LegendaryGame` from
  `@legendary-arena/game-engine` and `createRegistryFromLocalFiles` from
  `@legendary-arena/registry`. Loads registry at startup alongside rules.
  Uses `createRequire` to bridge boardgame.io's CJS-only server bundle.
- `apps/server/package.json` — added `@legendary-arena/game-engine` and
  `@legendary-arena/registry` as workspace dependencies
- `apps/server/src/index.mjs` — added `// why:` comment explaining entrypoint
  vs configuration module separation
- `render.yaml` — already had correct `startCommand`, no change needed

**What a developer can do:**
- `node --env-file=.env apps/server/src/index.mjs` starts the server with
  real game engine and card registry
- Server logs show both startup tasks:
  - `[server] registry loaded: 40 sets, 288 heroes, 2620 cards`
  - `[server] rules loaded: 19 rules, 18 rule docs`
- `GET /health` returns `{"status":"ok"}`
- `POST /games/legendary-arena/create` with `setupData` returns a `matchID`
- Missing `setupData` returns HTTP 400 with a descriptive message (not 500)
- `numPlayers` outside 1-5 returns HTTP 400 (`minPlayers: 1`, `maxPlayers: 5`
  on `LegendaryGame`, enforced by boardgame.io lobby)

**Known gaps (expected at this stage):**
- No lobby/match creation CLI scripts yet (WP-011/012)
- No authentication (separate WP)

### WP-005A — Match Setup Contracts (2026-04-10)

**What changed:**
- `packages/game-engine/src/matchSetup.types.ts` — **new** — defines the
  canonical `MatchSetupConfig` (9 locked fields), `MatchSetupError`
  (`{ field, message }`), and `ValidateMatchSetupResult` (discriminated union)
- `packages/game-engine/src/matchSetup.validate.ts` — **new** —
  `validateMatchSetup(input, registry)` checks both shape and registry ext_id
  existence; never throws; returns structured result. Defines
  `CardRegistryReader` interface to respect the layer boundary.
- `packages/game-engine/src/types.ts` — **modified** — `MatchConfiguration` is
  now a type alias for `MatchSetupConfig` (both had identical 9-field shapes)
- `packages/game-engine/src/index.ts` — **modified** — exports
  `MatchSetupConfig`, `MatchSetupError`, `ValidateMatchSetupResult`,
  `validateMatchSetup`, and `CardRegistryReader`
- `packages/game-engine/src/matchSetup.contracts.test.ts` — **new** — 4 contract
  tests using inline mock registry (no boardgame.io imports)

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` exports the canonical match setup contract types
- `validateMatchSetup` validates both shape and ext_id existence
- `MatchConfiguration` is a type alias for `MatchSetupConfig` — both work
- The validator never throws — `Game.setup()` decides whether to throw
- `CardRegistryReader` is the minimal interface the validator needs from a registry

**Known gaps (expected at this stage):**
- No deterministic shuffling or deck construction — that is WP-005B
- No changes to `Game.setup()` — that is WP-005B
- No gameplay moves, rules, or phases

### WP-005B — Deterministic Setup Implementation (2026-04-10)

**What changed:**
- `packages/game-engine/src/types.ts` — **modified** — expanded
  `LegendaryGameState` with `CardExtId`, `SetupContext`, `PlayerZones`,
  `GlobalPiles`, `MatchSelection` types. G now has `selection`, `playerZones`,
  and `piles` fields.
- `packages/game-engine/src/setup/shuffle.ts` — **new** — `shuffleDeck(cards, context)`
  uses `context.random.Shuffle` exclusively for deterministic shuffling
- `packages/game-engine/src/test/mockCtx.ts` — **new** — `makeMockCtx(overrides?)`
  returns a `SetupContext` with `Shuffle` that reverses arrays (proves shuffle ran)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **new** —
  builds initial G from validated config: per-player zones (12-card starting
  decks of 8 agents + 4 troopers), global piles sized from config counts,
  selection metadata
- `packages/game-engine/src/game.ts` — **modified** — `setup()` now calls
  `validateMatchSetup` (when registry configured) then `buildInitialGameState`.
  Exports `setRegistryForSetup()` for server-side registry configuration.
- `packages/game-engine/src/index.ts` — **modified** — exports new types,
  `buildInitialGameState`, `shuffleDeck`, well-known ext_id constants,
  `setRegistryForSetup`
- `packages/game-engine/src/game.test.ts` — **modified** — updated to use
  `makeMockCtx` for proper boardgame.io 0.50.x context shape
- Shape test and determinism test — **new** — 17 new tests

**Revision pass (same session):**
- `shuffle.ts` — narrowed parameter type from `SetupContext` to new
  `ShuffleProvider` interface (`{ random: { Shuffle } }`) for future reuse
  in move contexts. Zero behavior change.
- `game.ts` — added `clearRegistryForSetup()` test-only reset hook to
  prevent module-level registry pollution across tests
- `types.ts` — expanded `SetupContext` JSDoc explaining boardgame.io 0.50.x
  `ctx` nesting rationale
- `index.ts` — exports `clearRegistryForSetup` and `ShuffleProvider`
- Shape tests — added 3 invariant tests: starting deck composition
  (8 agents + 4 troopers), selection/matchConfiguration field consistency,
  selection array reference isolation
- Determinism tests — added shuffleDeck immutability test
- Test count: 34 → 38 (4 new invariant tests)

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` exports a fully functional `buildInitialGameState`
- `shuffleDeck` provides deterministic shuffling via `context.random.Shuffle`;
  accepts any `ShuffleProvider` (not just `SetupContext`)
- `makeMockCtx` is the shared test helper for all future game engine tests
- `Game.setup()` validates config (when registry set) then builds full initial G
- Determinism guaranteed: same inputs + same RNG → identical G
- All 38 tests passing (17 from WP-005A + 21 new)

**Known gaps (expected at this stage):**
- No hero deck (HQ) construction from registry data — future WP
- No villain deck construction — WP-014/015
- No gameplay moves beyond stubs — WP-008A/B
- `setRegistryForSetup` must be called by the server before creating matches
  (server not yet updated — that is a future integration task)
- Starting deck ext_ids are well-known constants, not resolved from registry

### WP-006A — Player State & Zones Contracts (2026-04-10)

**What changed:**
- `packages/game-engine/src/state/zones.types.ts` — **new** — canonical zone
  and player state contracts: `CardExtId`, `Zone`, `PlayerZones`, `PlayerState`,
  `GlobalPiles`, `ZoneValidationError`, `GameStateShape`
- `packages/game-engine/src/state/zones.validate.ts` — **new** — pure runtime
  shape validators: `validateGameStateShape(input)` and
  `validatePlayerStateShape(input)`. Return structured results, never throw.
  No boardgame.io imports.
- `packages/game-engine/src/state/zones.shape.test.ts` — **new** — 4 structural
  tests (2 passing, 2 `{ ok: false }` cases) using `node:test` and `node:assert`
- `packages/game-engine/src/types.ts` — **modified** — `CardExtId`, `PlayerZones`,
  `GlobalPiles` now re-exported from `state/zones.types.ts`. New types `Zone`,
  `PlayerState`, `ZoneValidationError`, `GameStateShape` also re-exported.
  `LegendaryGameState` uses canonical types from `zones.types.ts`.
- `packages/game-engine/src/index.ts` — **modified** — exports new types and
  validators from `state/zones.types.ts` and `state/zones.validate.ts`

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` exports canonical zone contracts (`CardExtId`,
  `Zone`, `PlayerZones`, `PlayerState`, `GlobalPiles`)
- `ZoneValidationError` is `{ field, message }` — distinct from `MoveError`
- `validateGameStateShape` and `validatePlayerStateShape` are pure helpers
  that check structural shape only — no registry lookups, no throws
- `GameStateShape` is the minimal interface for zone validation
- All 48 tests passing (38 from WP-005B + 10 zone shape tests)

**Known gaps (expected at this stage):**
- No gameplay moves beyond stubs — WP-008A/B
- No hero deck (HQ) or villain deck construction — future WPs
- `PlayerState` is defined but not yet used in `LegendaryGameState` (G uses
  `Record<string, PlayerZones>` directly — `PlayerState` is available for
  move validation in future WPs)

### WP-006B — Player State Initialization (2026-04-10)

**What changed:**
- `packages/game-engine/src/setup/playerInit.ts` — **new** —
  `buildPlayerState(playerId, startingDeck, context)` returns a typed
  `PlayerState` with shuffled deck and 4 empty zones. Uses `ShuffleProvider`
  for the context parameter.
- `packages/game-engine/src/setup/pilesInit.ts` — **new** —
  `buildGlobalPiles(config, context)` returns a typed `GlobalPiles` from
  `MatchSetupConfig` count fields. Contains `createPileCards` helper and
  well-known pile ext_id constants.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  delegates player creation to `buildPlayerState` and pile creation to
  `buildGlobalPiles`. Retains `buildStartingDeckCards`, `buildMatchSelection`,
  and well-known starting card ext_id constants.
- `packages/game-engine/src/setup/playerInit.shape.test.ts` — **new** — 3 shape
  tests: all zones present, deck reversed (proves shuffle), broken player rejected
- `packages/game-engine/src/setup/validators.integration.test.ts` — **new** — 3
  integration tests: `validateGameStateShape` ok, `validatePlayerStateShape` ok
  for all players, `JSON.stringify(G)` does not throw

**What is now fully initialized and validator-confirmed:**
- `buildInitialGameState` produces a `G` that passes `validateGameStateShape`
- Every player in `G` passes `validatePlayerStateShape`
- Player state construction is isolated in `buildPlayerState` — independently
  testable with its own shape tests
- Global pile construction is isolated in `buildGlobalPiles` — typed against
  canonical `GlobalPiles` from WP-006A
- All 56 tests passing (48 from WP-006A + 8 new)

**Known gaps (expected at this stage):**
- No hero deck (HQ) construction from registry data — future WP
- No villain deck construction — WP-014/015
- No gameplay moves beyond stubs — WP-008A/B

### WP-003 — Card Registry Verification & Defect Correction (2026-04-09)

**What was fixed:**
- **Defect 1:** `httpRegistry.ts` was fetching `card-types.json` (card type
  taxonomy) instead of `sets.json` (set index). The Zod parse silently
  produced zero sets because `card-types.json` entries lack `abbr` and
  `releaseDate` fields. Fixed to fetch `sets.json` with a `// why:` comment
  explaining the distinction.
- **Defect 2:** `FlatCard.cost` in `types/index.ts` was typed as
  `number | undefined` but real card data includes star-cost strings like
  `"2*"` (amwp Wasp). Widened to `string | number | undefined` to match
  `HeroCardSchema.cost`.
- Stale JSDoc references to `card-types.json` corrected to `sets.json` in
  `CardRegistry.listSets()` and `HttpRegistryOptions.eagerLoad`.

**What was added:**
- `src/registry.smoke.test.ts` — smoke test using `node:test` confirming
  the local registry loads sets and cards without blocking parse errors
- `test` script in `package.json` for `pnpm --filter @legendary-arena/registry test`
- `tsconfig.build.json` excludes `*.test.ts` from build output

**What is confirmed working:**
- Local registry loads 40 sets (38 parse fully, 2 have known schema issues)
- `listSets().length > 0` and `listCards().length > 0` pass
- Immutable files (`schema.ts`, `shared.ts`, `localRegistry.ts`) were not modified

**Known remaining build errors (pre-existing, out of scope):**
- `localRegistry.ts` — missing `@types/node` type declarations for
  `node:fs/promises` and `node:path`; implicit `any` parameter
- `shared.ts` — `exactOptionalPropertyTypes` strictness (optional fields
  assigned to required fields in `FlatCard`)
- These require modifications to immutable files or adding `@types/node` —
  flagged for a follow-up work packet

### WP-002 — boardgame.io Game Skeleton (2026-04-09)

**What exists now:**
- `packages/game-engine/` — new pnpm workspace package (`@legendary-arena/game-engine`)
  - `src/types.ts` — `MatchConfiguration` (9 locked fields from 00.2 §8.1)
    and `LegendaryGameState` (initial G shape)
  - `src/game.ts` — `LegendaryGame` created with boardgame.io `Game()`,
    4 phases (`lobby`, `setup`, `play`, `end`), 2 move stubs (`playCard`,
    `endTurn`), and a `setup()` function that accepts `MatchConfiguration`
  - `src/index.ts` — named exports: `LegendaryGame`, `MatchConfiguration`,
    `LegendaryGameState`
  - `src/game.test.ts` — JSON-serializability test, field verification,
    phase/move assertions (5 tests, all passing)

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` is importable as a workspace package
- `LegendaryGame` is a valid boardgame.io 0.50.x `Game()` object
- `LegendaryGame.setup()` accepts `MatchConfiguration` and returns
  `LegendaryGameState` (JSON-serializable)
- Phase names are locked: `lobby`, `setup`, `play`, `end`
- Move stubs exist: `playCard`, `endTurn` (void, no side effects)
- `MatchConfiguration` has exactly 9 fields matching 00.2 §8.1

**Known gaps (expected at this stage):**
- Move stubs have no logic — gameplay implementation starts in WP-005B+
- `LegendaryGameState` contains only `matchConfiguration` — zones, piles,
  counters, and other G fields will be added by subsequent Work Packets
- No card registry integration — engine does not import registry (by design)
- No server wiring — `apps/server/` still uses its own placeholder Game()
