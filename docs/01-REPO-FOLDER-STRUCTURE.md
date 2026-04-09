# Legendary Arena — Repository Folder Structure

> This document maps the actual repository layout as of 2026-04-09.
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
├── data/                       # Raw card data, metadata, SQL schema
├── scripts/                    # Standalone CLI tools and diagnostics
├── docs/                       # All documentation
│
├── .env.example                # Definitive environment variable reference (9 vars)
├── .gitignore
├── .gitattributes
├── package.json                # Monorepo root — workspace scripts
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── pnpm-lock.yaml
└── README.md
```

---

## `.claude/` — AI Coordination System

The governance layer for AI-assisted development. Loaded automatically
by Claude Code at the start of every session.

```
.claude/
├── CLAUDE.md                   # Root coordination — EC mode, lint gate, governance set
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

## `.githooks/` — Commit Hygiene (EC Mode)

Repo-local Git hooks enforcing commit message format and staged-file checks.
Installed via `pwsh scripts/git/install-ec-hooks.ps1`.

```
.githooks/
├── pre-commit                  # No secrets, no .test.mjs, no dist/, no node_modules
└── commit-msg                  # EC-###/SPEC/INFRA prefix, forbidden words, EC validation
```

**Commit prefixes enforced:**
- `EC-###: <summary>` — code changes (requires matching EC file)
- `SPEC: <summary>` — specification corrections
- `INFRA: <summary>` — infrastructure and tooling

---

## `.github/workflows/` — CI

```
.github/workflows/
├── ci.yml                      # Build → Validate → Deploy pipeline (registry + viewer)
└── commit-hygiene.yml          # PR mirror of commit hooks (3 parallel jobs)
```

---

## `apps/` — Deployable Applications

```
apps/
└── registry-viewer/            # Read-only card browser SPA (Vue)
    ├── src/
    │   ├── components/         # Vue components
    │   ├── composables/        # Vue composables
    │   ├── lib/                # Shared utilities
    │   └── registry/           # Registry client (types + impl)
    ├── public/                 # Static assets
    └── dist/                   # Build output (not committed)
```

**Planned (not yet created):**
- `apps/server/` — boardgame.io Server() runtime (Foundation Prompt 01)

**Import rules:**
- `registry-viewer` may import: `@legendary-arena/registry`, UI framework
- `registry-viewer` must NOT import: `game-engine`, `server`, `pg`

---

## `packages/` — Shared Libraries

```
packages/
└── registry/                   # @legendary-arena/registry
    ├── src/
    │   ├── schema.ts           # Zod schemas (authoritative field shapes)
    │   ├── shared.ts           # flattenSet(), applyQuery(), buildHealthReport()
    │   ├── impl/
    │   │   └── localRegistry.ts  # Local file loader (uses sets.json)
    │   └── types/              # TypeScript type definitions
    ├── scripts/
    │   └── validate.ts         # Registry validation script
    └── dist/                   # Build output (not committed)
```

**Planned (not yet created):**
- `packages/game-engine/` — boardgame.io Game() definition (WP-002)

**Import rules:**
- `registry` may import: Node built-ins, `zod`
- `registry` must NOT import: `game-engine`, `server`, any `apps/*`, `pg`

---

## `data/` — Raw Card Data & Database

Card JSON, metadata lookup files, and PostgreSQL schema. This is NOT a
package — it is raw data consumed by other packages.

```
data/
├── cards/                      # Per-set card JSON (40 files: core.json, mdns.json, etc.)
│   ├── core.json
│   ├── dkcy.json
│   ├── mdns.json
│   └── ... (40 total)
│
├── metadata/                   # Lookup tables and taxonomies
│   ├── sets.json               # Set index — THE registry manifest (40 entries)
│   ├── card-types.json         # Card type taxonomy (37 types)
│   ├── hero-teams.json         # Hero team definitions
│   ├── hero-classes.json       # Hero class definitions (5 classes)
│   ├── icons-meta.json         # Icon/stat symbol metadata
│   └── leads.json              # Mastermind → villain group leads
│
├── legendary_library_schema.sql  # PostgreSQL schema (legendary.* namespace)
├── seed_rules.sql              # Rules text seed data
└── load_legendary_data.mjs     # Seed/load pipeline
```

**Key distinction:**
- `metadata/sets.json` = set index (abbr, releaseDate) — used by loaders
- `metadata/card-types.json` = card type taxonomy (slug, displayName) — NOT a set index
- Confusing them causes silent registry failures (see WP-003)

---

## `scripts/` — CLI Tools & Diagnostics

```
scripts/
├── check-connections.mjs       # Node.js ESM — connection health check (pnpm check)
├── Check-Env.ps1               # PowerShell — environment/tooling check (pnpm check:env)
├── validate-r2.mjs             # Node.js ESM — R2 data validation (pnpm validate)
├── Validate-R2-old.ps1         # Legacy PowerShell validator (superseded)
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

---

## `docs/` — Documentation

### Human-facing docs

```
docs/
├── 00-INDEX.md                 # Table of contents
├── 01-REPO-FOLDER-STRUCTURE.md # This document
├── 02-ARCHITECTURE.md          # High-level architecture overview
├── 03-DATA-PIPELINE.md         # R2 → metadata → validation flow
├── 05-ROADMAP.md               # Development roadmap (table format)
├── 05-ROADMAP-MINDMAP.md       # Development roadmap (ASCII mindmap)
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
├── DECISIONS.md                # 24 permanent architectural decisions
├── DECISIONS_INDEX.md          # Decision-to-WP traceability index
├── STATUS.md                   # Current project state after each session
│
├── REFERENCE/                  # Authoritative project memory
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
│   └── 02-database-migrations.md           # Migration runner prompt
│
├── work-packets/               # 47 Work Packets (design authority)
│   ├── WORK_INDEX.md           # Execution order and status tracking
│   ├── PACKET-TEMPLATE.md      # Mandatory WP structure
│   ├── WP-001-foundation.md
│   ├── WP-002-game-skeleton.md
│   └── ... (WP-002 through WP-047)
│
├── execution-checklists/       # 51 Execution Checklists (execution authority)
│   ├── EC-TEMPLATE.md          # EC structure and rules
│   ├── EC_INDEX.md             # EC status tracking
│   ├── EC-010-endgame.checklist.md  # Reference EC
│   ├── R-EC-01-object-abilities.checklist.md  # Registry hygiene
│   ├── R-EC-02-missing-fields.checklist.md
│   ├── R-EC-03-missing-images.checklist.md
│   └── ... (EC-001 through EC-047)
│
├── prompts/                    # Reusable tooling prompts
│   ├── standardization-completeness-check.prompt.md
│   ├── generate-execution-checklist.prompt.md
│   └── auto-tighten-execution-checklists.prompt.md
│
└── invocations/                # Session invocation records (if any)
```

---

## Authority Hierarchy

Files are listed from highest to lowest authority. Higher entries win
in any conflict.

```
1. .claude/CLAUDE.md                          ← root coordination
2. docs/ai/ARCHITECTURE.md                    ← architectural decisions
3. .claude/rules/*.md                         ← per-layer enforcement
4. docs/ai/work-packets/WORK_INDEX.md         ← execution order
5. docs/ai/execution-checklists/EC-*.md        ← execution contracts
6. docs/ai/work-packets/WP-*.md               ← design documents
7. Active conversation context                 ← lowest authority
```

---

## What Does NOT Exist Yet

These directories and packages are planned but not created. They will
be created by their respective Work Packets or Foundation Prompts.

| Planned | Created by | Purpose |
|---|---|---|
| `packages/game-engine/` | WP-002 | boardgame.io Game() definition |
| `apps/server/` | FP-01 | boardgame.io Server() runtime |
| `data/migrations/` | FP-02 | PostgreSQL migration files |
| `docs/ops/` | WP-035 | Operational playbooks |
| `docs/beta/` | WP-037 | Beta strategy documents |
| `docs/governance/` | WP-040 | Growth governance documents |

---

*Last updated: 2026-04-09*
*To regenerate: compare against `find . -type d` and `git ls-files`*
