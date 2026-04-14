# Legendary Arena -- Repository Folder Structure

> This document maps the actual repository layout as of 2026-04-14 (Phase 5
> complete, 314 engine tests passing).
> It describes what each directory and key file does, who owns it,
> and what governance rules apply.
>
> **Authoritative for:** folder purposes and ownership.
> **Subordinate to:** `docs/ai/ARCHITECTURE.md` for architectural decisions.

---

## Top-Level Layout

```
legendary-arena/
│
├── .claude/                    # Claude Code coordination (AI governance)
├── .githooks/                  # EC-mode commit hygiene hooks
├── .github/                    # GitHub Actions workflows
│
├── apps/                       # Deployable applications
├── packages/                   # Shared library packages
├── data/                       # Raw card data, metadata, SQL schema, migrations
├── scripts/                    # Standalone CLI tools and diagnostics
├── docs/                       # All documentation
│
├── .env.example                # Definitive environment variable reference (9 vars)
├── .gitignore
├── .gitattributes
├── package.json                # Monorepo root -- workspace scripts
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── pnpm-lock.yaml
├── render.yaml                 # Render.com infrastructure-as-code
└── README.md
```

---

## `.claude/` -- AI Coordination System

The governance layer for AI-assisted development. Loaded automatically
by Claude Code at the start of every session.

```
.claude/
├── CLAUDE.md                   # Root coordination -- EC mode, lint gate, governance set
├── settings.local.json         # Local Claude Code settings (not committed)
└── rules/                      # Per-layer enforcement rules (7 files)
    ├── architecture.md         # Authority hierarchy, layer boundaries
    ├── code-style.md           # Naming, functions, comments, ESM-only
    ├── game-engine.md          # boardgame.io, G, moves, phases, rules pipeline
    ├── persistence.md          # 3 data classes, snapshot rules, what never persists
    ├── registry.md             # Card data loading, schema authority, metadata distinction
    ├── server.md               # Server as wiring-only layer, startup sequence
    └── work-packets.md         # One WP per session, dependency discipline, status rules
```

**Ownership:** Human-authored, Claude-enforced.
**Rule:** Claude must not create new rules files without human approval.

---

## `.githooks/` -- Commit Hygiene (EC Mode)

Repo-local Git hooks enforcing commit message format and staged-file checks.
Installed via `pwsh scripts/git/install-ec-hooks.ps1`.

```
.githooks/
├── pre-commit                  # No secrets, no .test.mjs, no dist/, no node_modules
└── commit-msg                  # EC-###/SPEC/INFRA prefix, forbidden words, EC validation
```

**Commit prefixes enforced:**
- `EC-###: <summary>` -- code changes (requires matching EC file)
- `SPEC: <summary>` -- specification corrections
- `INFRA: <summary>` -- infrastructure and tooling

---

## `.github/workflows/` -- CI

```
.github/workflows/
├── ci.yml                      # Build -> Validate -> Deploy pipeline (registry + viewer)
└── commit-hygiene.yml          # PR mirror of commit hooks (3 parallel jobs)
```

---

## `apps/` -- Deployable Applications

```
apps/
├── registry-viewer/            # Read-only card browser SPA (Vue)
│   ├── src/
│   │   ├── components/         # Vue components
│   │   ├── composables/        # Vue composables
│   │   ├── lib/                # Shared utilities
│   │   └── registry/           # Registry client (types + impl)
│   ├── public/                 # Static assets
│   └── dist/                   # Build output (not committed)
│
└── server/                     # @legendary-arena/server -- boardgame.io runtime
    ├── src/
    │   ├── index.mjs           # Process entrypoint (SIGTERM, lifecycle)
    │   ├── server.mjs          # Server config (registry + rules loading, Server())
    │   ├── game/
    │   │   └── legendary.mjs   # Thin re-export of LegendaryGame from game-engine
    │   └── rules/
    │       └── loader.mjs      # PostgreSQL rules loader (loadRules, getRules)
    └── package.json            # Workspace deps: game-engine, registry, boardgame.io, pg
```

**Import rules:**
- `server` may import: `@legendary-arena/game-engine`, `@legendary-arena/registry`, `pg`, Node built-ins
- `server` must NOT import: UI packages, browser APIs
- `registry-viewer` may import: `@legendary-arena/registry`, UI framework
- `registry-viewer` must NOT import: `game-engine`, `server`, `pg`

---

## `packages/` -- Shared Libraries

```
packages/
├── game-engine/                # @legendary-arena/game-engine (314 tests, 83 suites)
│   ├── src/
│   │   ├── index.ts            # Public exports (types, builders, executors, helpers)
│   │   ├── game.ts             # boardgame.io Game() -- phases, moves, validateSetupData
│   │   ├── types.ts            # MatchConfiguration (9 fields), LegendaryGameState (21 fields)
│   │   ├── matchSetup.types.ts # MatchSetupConfig Zod schema
│   │   ├── matchSetup.validate.ts # Setup validation + CardRegistryReader
│   │   │
│   │   ├── board/              # City, HQ, KO, wounds, bystanders, board keywords
│   │   ├── economy/            # TurnEconomy, cardStats, resource gating
│   │   ├── endgame/            # evaluateEndgame, ENDGAME_CONDITIONS
│   │   ├── hero/               # Hero effect execution, conditional evaluation
│   │   ├── lobby/              # LobbyState, setPlayerReady, startMatchIfReady
│   │   ├── mastermind/         # MastermindState, tactics, fightMastermind setup
│   │   ├── moves/              # Core moves, fight, recruit, zoneOps
│   │   ├── persistence/        # PERSISTENCE_CLASSES, MatchSnapshot, createSnapshot
│   │   ├── rules/              # Hook definitions, execution pipeline, scheme/mastermind handlers
│   │   ├── scheme/             # SchemeSetupInstruction types + executor (WP-026)
│   │   ├── scoring/            # computeFinalScores, VP breakdowns
│   │   ├── setup/              # buildInitialGameState, player/pile init, card keywords, scheme builder
│   │   ├── state/              # Zone types (CardExtId, PlayerZones, GlobalPiles), validators
│   │   ├── test/               # makeMockCtx (shared test helper)
│   │   ├── turn/               # Turn stages, phase loop, advanceTurnStage
│   │   └── villainDeck/        # Deck composition, reveal pipeline, card type classification
│   └── dist/                   # Build output (not committed)
│
└── registry/                   # @legendary-arena/registry
    ├── src/
    │   ├── schema.ts           # Zod schemas (authoritative field shapes) -- IMMUTABLE
    │   ├── shared.ts           # flattenSet(), applyQuery(), buildHealthReport() -- IMMUTABLE
    │   ├── impl/
    │   │   ├── localRegistry.ts  # Local file loader (uses sets.json) -- IMMUTABLE
    │   │   └── httpRegistry.ts   # HTTP/R2 loader (for browser clients)
    │   ├── types/              # TypeScript type definitions (RegistryInfo, CardRegistry, etc.)
    │   └── registry.smoke.test.ts  # Smoke test (node:test) -- loads 40 sets
    └── dist/                   # Build output (not committed)
```

**Import rules:**
- `game-engine` may import: Node built-ins only
- `game-engine` must NOT import: `registry`, `server`, any `apps/*`, `pg`
- `registry` may import: Node built-ins, `zod`
- `registry` must NOT import: `game-engine`, `server`, any `apps/*`, `pg`

---

## `data/` -- Raw Card Data & Database

Card JSON, metadata lookup files, PostgreSQL schema, and migrations.
This is NOT a package -- it is raw data consumed by other packages.

```
data/
├── cards/                      # Per-set card JSON (40 files: core.json, mdns.json, etc.)
│   ├── core.json
│   ├── dkcy.json
│   ├── mdns.json
│   └── ... (40 total)
│
├── metadata/                   # Lookup tables and taxonomies
│   ├── sets.json               # Set index -- THE registry manifest (40 entries)
│   ├── card-types.json         # Card type taxonomy (37 types)
│   ├── hero-teams.json         # Hero team definitions
│   ├── hero-classes.json       # Hero class definitions (5 classes)
│   ├── icons-meta.json         # Icon/stat symbol metadata
│   └── leads.json              # Mastermind -> villain group leads
│
├── migrations/                 # PostgreSQL migrations (applied by scripts/migrate.mjs)
│   ├── 001_server_schema.sql   # Rules-engine DDL (legendary.* namespace)
│   ├── 002_seed_rules.sql      # Rules index + rule_docs glossary
│   └── 003_game_sessions.sql   # Match tracking table (public.game_sessions)
│
├── schema-server.sql           # Rules-engine DDL (included by 001 migration)
├── seed-server.sql             # Galactus example seed data
├── seed_rules.sql              # Rules text seed data (included by 002 migration)
├── legendary_library_schema.sql  # Full card library schema
└── load_legendary_data.mjs     # Seed/load pipeline
```

**Key distinction:**
- `metadata/sets.json` = set index (abbr, releaseDate) -- used by loaders
- `metadata/card-types.json` = card type taxonomy (slug, displayName) -- NOT a set index
- Confusing them causes silent registry failures (see D-1203, WP-003)

---

## `scripts/` -- CLI Tools & Diagnostics

```
scripts/
├── check-connections.mjs       # Node.js ESM -- connection health check (pnpm check)
├── Check-Env.ps1               # PowerShell -- environment/tooling check (pnpm check:env)
├── validate-r2.mjs             # Node.js ESM -- R2 data validation (pnpm validate)
├── migrate.mjs                 # Node.js ESM -- PostgreSQL migration runner (pnpm migrate)
├── Validate-R2-old.ps1         # Legacy PowerShell validator (superseded)
├── ec/                         # EC-mode tooling
│   ├── EC-INDEX.md             # EC status tracking (duplicate of docs/ai)
│   └── health-check.ec.mjs     # EC health check script
└── git/
    ├── install-ec-hooks.ps1    # One-time hook installation
    └── ec-commit.ps1           # Safe commit helper with -Check dry-run mode
```

**Package.json script entries:**

| Command | Script | Purpose |
|---|---|---|
| `pnpm check` | `check-connections.mjs` | Verify all external service connections |
| `pnpm check:env` | `Check-Env.ps1` | Verify local tools (no network needed) |
| `pnpm validate` | `validate-r2.mjs` | Validate R2 card data (4 phases, 40 sets) |
| `pnpm migrate` | `migrate.mjs` | Apply pending PostgreSQL migrations |

---

## `docs/` -- Documentation

### Human-facing docs

```
docs/
├── 00-INDEX.md                 # Table of contents
├── 01-REPO-FOLDER-STRUCTURE.md # This document
├── 01-VISION.md                # Product vision
├── 02-ARCHITECTURE.md          # High-level architecture overview
├── 03-DATA-PIPELINE.md         # R2 -> metadata -> validation flow
├── 03.1-DATA-SOURCES.md        # Authoritative input data inventory
├── 04-DEVELOPMENT-SETUP.md     # Local development guide
├── 05-ROADMAP.md               # Development roadmap (table format)
├── 05-ROADMAP-MINDMAP.md       # Development roadmap (mermaid mindmap)
├── 06-TESTING.md               # Test philosophy, conventions, inventory
├── 07-CLI-REFERENCE.md         # CLI tools reference
├── 08-DEPLOYMENT.md            # Deployment guide
├── 09-CHANGELOG.md             # Changelog
├── 10-GLOSSARY.md              # Term definitions
├── 11-TROUBLESHOOTING.md       # Common issues
├── 12-SCORING-REFERENCE.md     # PAR scoring formula & leaderboard rules
├── 12.1-PAR-ARTIFACT-INTEGRITY.md # PAR artifact hashing rationale
├── 13-REPLAYS-REFERENCE.md     # Replay & game saving system
│
├── devlog/                     # Weekly development journal
├── screenshots/                # UI and validation screenshots
├── prompts-registry-viewer/    # Registry viewer prompts (active)
└── archive prompts-legendary-area-game/  # Legacy prompts (superseded by docs/ai/)
```

### AI coordination system (`docs/ai/`)

```
docs/ai/
├── ARCHITECTURE.md             # Authoritative system architecture (wins over WPs)
├── DECISIONS.md                # 133+ permanent architectural decisions
├── DECISIONS_INDEX.md          # Decision-to-WP traceability index
├── STATUS.md                   # Current project state after each session
│
├── REFERENCE/                  # Authoritative project memory (21 files)
│   ├── 00.1-master-coordination-prompt.md  # Override hierarchy, session protocol
│   ├── 00.2-data-requirements.md           # Canonical data contracts
│   ├── 00.3-prompt-lint-checklist.md       # 28-item quality gate
│   ├── 00.4-connection-health-check.md     # Environment check prompt
│   ├── 00.5-validation.md                  # R2 validation prompt
│   ├── 00.6-code-style.md                  # 15 code style rules
│   ├── 01-render-infrastructure.md         # Server setup prompt
│   ├── 01.1-how-to-use-ecs-while-coding.md # EC workflow
│   ├── 01.2-bug-handling-under-ec-mode.md  # Clause-driven debugging
│   ├── 01.3-commit-hygiene-under-ec-mode.md # Commit format and hooks
│   ├── 01.4-pre-flight-invocation.md       # WP readiness gate template
│   ├── 01.5-runtime-wiring-allowance.md    # Allowlist for structural wiring
│   ├── 02-CODE-CATEGORIES.md               # Code category boundaries
│   ├── 02-database-migrations.md           # Migration runner prompt
│   ├── 03A-PHASE-3-MULTIPLAYER-READINESS.md # Phase 3 exit gate (closed)
│   └── ... (schema refs, safe knobs, phase gates)
│
├── work-packets/               # 66 Work Packets (design authority)
│   ├── WORK_INDEX.md           # Execution order and status tracking
│   ├── PACKET-TEMPLATE.md      # Mandatory WP structure
│   └── WP-001 through WP-060
│
├── execution-checklists/       # 63 Execution Checklists (execution authority)
│   ├── EC-TEMPLATE.md          # EC structure and rules
│   ├── EC_INDEX.md             # EC status tracking
│   └── EC-001 through EC-060 + R-EC-01..03
│
├── prompts/                    # Reusable tooling prompts
│   ├── PRE-COMMIT-REVIEW.template.md       # WP commit gatekeeper
│   ├── PHASE-COMMIT-REVIEW.template.md     # Phase integration checkpoint
│   ├── generate-execution-checklist.prompt.md
│   └── ... (standardization, auto-tighten)
│
└── invocations/                # 62 session invocation records
    ├── session-wp002 through session-wp026
    └── session-fp01, session-fp02
```

---

## Authority Hierarchy

Files are listed from highest to lowest authority. Higher entries win
in any conflict.

```
1. .claude/CLAUDE.md                          <- root coordination
2. docs/ai/ARCHITECTURE.md                    <- architectural decisions
3. .claude/rules/*.md                         <- per-layer enforcement
4. docs/ai/work-packets/WORK_INDEX.md         <- execution order
5. docs/ai/execution-checklists/EC-*.md       <- execution contracts
6. docs/ai/work-packets/WP-*.md              <- design documents
7. Active conversation context                <- lowest authority
```

---

## What Does NOT Exist Yet

These directories and packages are planned but not created. They will
be created by their respective Work Packets.

| Planned | Created by | Purpose |
|---|---|---|
| `docs/ops/` | WP-035 | Operational playbooks |
| `docs/beta/` | WP-037 | Beta strategy documents |
| `docs/governance/` | WP-040 | Growth governance documents |

---

*Last updated: 2026-04-14 (Phase 5 complete — 314 engine tests, 41/61 items done)*
*To regenerate: compare against `find . -type d` and `git ls-files`*
