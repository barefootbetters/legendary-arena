# WP-042 — Deployment Checklists (Data, Database & Infrastructure)

**Status:** Ready
**Primary Layer:** Server / Operations
**Dependencies:** WP-035

---

## Session Context

WP-035 established the release, deployment, and ops playbook including the
environment model (dev, test, staging, prod) and the principle that no
deployment bypasses validation. This packet converts the legacy operational
checklists from `docs/prompts-legendary-area-game/00.2b-deployment-checklists.md`
into governed, verifiable deployment procedures for the three infrastructure
pillars: Cloudflare R2 card data, PostgreSQL database, and Render.com hosting.

---

## Goal

Establish governed, verifiable deployment checklists that confirm all
infrastructure prerequisites are met before any release or environment
provisioning. After this session:

- A canonical R2 data validation procedure exists with pass/fail verification
- A canonical PostgreSQL migration and seeding procedure exists with row-count
  verification queries
- Infrastructure configuration requirements (R2 bucket, CORS, Render) are
  documented as verifiable assertions
- All checklists produce binary pass/fail outcomes — no subjective checks
- The Konva.js canvas UI checklist from the legacy document is explicitly
  excluded (UI implementation is not a deployment concern)

---

## Assumes

- WP-035 complete. Specifically:
  - Release and deployment playbook exists
  - Environment model (dev, test, staging, prod) is documented
  - No deployment without validation is an established principle
- `packages/registry/scripts/validate.ts` exists and runs via `pnpm registry:validate`
- `data/migrations/` exists with migration SQL files (Foundation Prompt 02)
- `scripts/migrate.mjs` and `scripts/seed-from-r2.mjs` exist (Foundation Prompt 01/02)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 1` — package boundaries. The server is a
  wiring layer only. Deployment checklists verify infrastructure readiness but
  must not introduce game logic, state interpretation, or engine concerns.
- `docs/ai/ARCHITECTURE.md §Section 2` — data flow. Registry loads card data
  from local files or R2 at server startup. Rules text loads from PostgreSQL.
  Both must succeed before `Server()` accepts requests.
- `docs/ai/ARCHITECTURE.md §Section 3` — persistence boundaries. `G` and `ctx`
  are never persisted. PostgreSQL stores rules text and card metadata only.
  The distinction between R2 display data and PostgreSQL mechanical data is
  critical.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — deployment
  checklists are server/ops layer concerns. They must not encode game engine
  logic, UI implementation details, or registry internals beyond what is needed
  for verification.
- `docs/prompts-legendary-area-game/00.2b-deployment-checklists.md` — the legacy
  source document. Sections A (R2) and B (PostgreSQL) are in scope. Section C
  (Konva.js canvas) is OUT of scope — it describes UI implementation, not
  deployment prerequisites.
- `docs/ai/REFERENCE/00.2-data-requirements.md §4` — what belongs in PostgreSQL
  vs. what stays in R2. All card images and display text stay in R2; only
  game-mechanical fields go in the database.

---

## Non-Negotiable Constraints

**Applicable constraints (always apply — do not remove):**
- ESM only, Node v22+ — all scripts use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports
- No game logic in deployment scripts — scripts verify infrastructure, not
  gameplay
- No modification to `packages/game-engine/` — deployment is a server/ops concern
- No modification to `packages/registry/src/` — the validate script already
  exists; this packet documents its usage, not its implementation
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Deployment checklists produce **binary pass/fail** outcomes only
- All SQL verification queries use the `legendary.*` schema namespace
- Migration execution order is defined by filename sort — never reordered
- Re-seeding uses `ON CONFLICT (slug) DO UPDATE` — never `DELETE` + re-insert
- No Konva.js, canvas, or UI implementation checks — those are UI-layer
  concerns and do not belong in deployment checklists

**Session protocol:**
- If any infrastructure endpoint, table name, or CLI command is unclear, stop
  and ask the human before proceeding — never guess

**Locked contract values:**

- **legendary.\* namespace** — all tables in `legendary.*` schema. PKs use
  `bigserial`. Cross-service IDs use `ext_id text`.

- **R2 base URL:** `https://images.barefootbetters.com`

- **Metadata files (R2 and local):**
  `sets.json` (40 entries) | `card-types.json` (37 entries) |
  `hero-classes.json` (5 entries) | `hero-teams.json` (25 entries) |
  `icons-meta.json` (7 entries) | `leads.json` (50+ entries)

- **Migration files (execution order by filename):**
  `001_initial_schema.sql` | `002_seed_base_set.sql` |
  `003_add_game_sessions.sql` | `004_upsert_indexes.sql` |
  `005_lobby_columns.sql`

- **Lookup table expected counts:**
  `legendary.sets` = 40 | `legendary.card_types` = 37 |
  `legendary.teams` = 25 | `legendary.hero_classes` = 5 |
  `legendary.icons` = 7 | `legendary.rarities` = 3

---

## Scope (In)

### A) `docs/ai/deployment/r2-data-checklist.md` — new

Governed checklist for Cloudflare R2 data and image asset verification.
Converted from legacy 00.2b Checklist A.

Contents:
- **A.1 — Validation script usage** — `pnpm registry:validate` in local and R2
  modes with environment variable documentation (`CARDS_DIR`, `R2_BASE_URL`,
  `SKIP_IMAGES`, `IMAGE_DELAY_MS`); 5-phase validation pipeline description;
  exit code semantics (0 = pass, 1 = errors); output files
  (`dist/registry-health.json`)
- **A.2 — Registry manifest** — `metadata/sets.json` existence and shape (array
  of 40 set entries with `abbr` fields); verification via Phase 1
- **A.3 — Metadata files** — 6 required metadata files with expected entry
  counts; 40 per-set card JSON files with schema and `imageUrl` domain checks;
  verification via Phases 2 and 3
- **A.4 — Image assets** — naming convention table (hero, mastermind, villain,
  henchman, scheme, bystander, wound); Phase 5 HEAD spot-checks (3 per set,
  120 total); delay between requests (50ms default)
- **A.5 — Cross-reference checks** — `alwaysLeads` slug resolution; duplicate
  slug detection; verification via Phase 4
- **A.6 — R2 bucket configuration** — bucket name (`legendary-images`), public
  URL, CORS policy (GET/HEAD from `cards.barefootbetters.com` and
  `localhost:5173`), cache-control headers (immutable for images, 1h for JSON),
  rclone remote verification
- **A.7 — New set upload procedure** — ordered steps for adding an expansion:
  local validate, upload JSON, upload images, verify `metadata/sets.json`,
  R2 validate, `pnpm seed`, registry-viewer verification

Each item is a verifiable assertion with a specific verification command or
SQL query.

### B) `docs/ai/deployment/postgresql-checklist.md` — new

Governed checklist for PostgreSQL database provisioning and seeding.
Converted from legacy 00.2b Checklist B.

Contents:
- **B.1 — Pre-conditions** — `DATABASE_URL`, `EXPECTED_DB_NAME`, connection
  health check, Node v22+, `pg` package
- **B.2 — Migration execution** — `pnpm migrate` with ordered migration list
  (001 through 005); idempotent; expected output
- **B.3 — Lookup table seeding** — `pnpm seed` with dependency order; 6 tables
  with expected row counts; SQL verification queries for each
- **B.4 — Group and entity seeding** — masterminds, villain groups, henchman
  groups, hero decks with SQL count verification
- **B.5 — Card record seeding** — cards, card_keywords, card_icons with FK
  integrity spot-check query
- **B.6 — Rules data seeding** — `legendary.rules`, `legendary.rule_docs`,
  full-text search vector verification
- **B.7 — Game-specific data verification** — Galactus alwaysLeads relationship
  check, hero deck card count (4 per hero), no null `ext_id` check
- **B.8 — Re-seeding procedure** — `pnpm seed` with upsert semantics; never
  `DELETE`; verification of new set data

Each item has a specific SQL query or CLI command with expected output.

### C) Update cross-references

- `docs/ai/ARCHITECTURE.md §Section 2` — add a note in the "Server Startup
  Sequence" subsection referencing the deployment checklists:
  "Deployment prerequisites are verified by the checklists in
  `docs/ai/deployment/`."
- No structural or boundary changes to ARCHITECTURE.md

---

## Out of Scope

- **No Konva.js / canvas / UI checklists** — legacy 00.2b Checklist C describes
  a specific Konva.js UI implementation (color constants, zone layout, card
  rendering layers, modal components). These are UI-layer implementation details,
  not deployment prerequisites. Per the Layer Boundary, UI is a separate concern
  from server/ops deployment. If a UI deployment checklist is needed, it belongs
  in a separate UI-layer Work Packet.
- No modifications to `packages/game-engine/` — engine is not a deployment
  concern
- No modifications to `packages/registry/src/` — the validation script exists;
  this packet documents its usage
- No modifications to `apps/server/src/` — server code is not changed by
  deployment checklists
- No new scripts or automation — checklists document existing tools
  (`pnpm registry:validate`, `pnpm migrate`, `pnpm seed`)
- No Render.com deployment configuration changes — the checklist documents what
  must be true, not how to change Render settings
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Files Expected to Change

- `docs/ai/deployment/r2-data-checklist.md` — **new** — R2 data and image
  verification checklist
- `docs/ai/deployment/postgresql-checklist.md` — **new** — PostgreSQL migration
  and seeding checklist
- `docs/ai/ARCHITECTURE.md` — **modified** — one-line cross-reference to
  deployment checklists in Server Startup Sequence subsection

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### R2 Data Checklist
- [ ] `docs/ai/deployment/r2-data-checklist.md` exists
- [ ] Contains validation script usage for both local and R2 modes
- [ ] Contains all 6 metadata file checks with expected entry counts
- [ ] Contains image naming convention table
- [ ] Contains new set upload procedure (ordered steps)
- [ ] Contains R2 bucket configuration requirements
- [ ] Every checklist item has a specific verification command or query
- [ ] No Konva.js, canvas, or UI references appear in the file
      (confirmed with `Select-String`)

### PostgreSQL Checklist
- [ ] `docs/ai/deployment/postgresql-checklist.md` exists
- [ ] Contains pre-conditions (DATABASE_URL, health check)
- [ ] Contains migration execution order (001 through 005)
- [ ] Contains lookup table seeding with 6 expected row counts
- [ ] Contains FK integrity spot-check SQL
- [ ] Contains rules data and FTS vector verification
- [ ] Every checklist item has a specific SQL query or CLI command
- [ ] All table references use `legendary.*` namespace
- [ ] No game logic, move logic, or engine references appear in the file

### Cross-References
- [ ] `docs/ai/ARCHITECTURE.md` contains a reference to `docs/ai/deployment/`

### Layer Boundary Compliance
- [ ] Neither checklist file references `packages/game-engine/` internals
- [ ] Neither checklist file contains boardgame.io concepts (G, ctx, moves)
- [ ] Neither checklist file contains UI implementation details
- [ ] No files in `packages/` or `apps/` were modified

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm R2 checklist exists and has no UI references
Test-Path "docs\ai\deployment\r2-data-checklist.md"
# Expected: True

Select-String -Path "docs\ai\deployment\r2-data-checklist.md" -Pattern "Konva|canvas|boardLayout|CARD_TINT"
# Expected: no output

# Step 2 — confirm PostgreSQL checklist exists and uses legendary.* namespace
Test-Path "docs\ai\deployment\postgresql-checklist.md"
# Expected: True

Select-String -Path "docs\ai\deployment\postgresql-checklist.md" -Pattern "legendary\."
# Expected: multiple matches (all table references)

# Step 3 — confirm no engine or UI references in either checklist
Select-String -Path "docs\ai\deployment\*.md" -Pattern "game-engine|boardgame\.io|LegendaryGame|ctx\." -Recurse
# Expected: no output

# Step 4 — confirm ARCHITECTURE.md cross-reference
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "docs/ai/deployment"
# Expected: at least one match

# Step 5 — confirm no files outside scope were changed
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
- [ ] `docs/ai/deployment/r2-data-checklist.md` exists with all sections from
      Scope (In) §A
- [ ] `docs/ai/deployment/postgresql-checklist.md` exists with all sections from
      Scope (In) §B
- [ ] No Konva.js, canvas, or UI references in either checklist
      (confirmed with `Select-String`)
- [ ] No game-engine internals referenced in either checklist
      (confirmed with `Select-String`)
- [ ] All table references use `legendary.*` namespace
- [ ] `docs/ai/ARCHITECTURE.md` updated with deployment checklist cross-reference
- [ ] No files in `packages/` or `apps/` were modified
      (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — deployment checklists exist; R2 and
      PostgreSQL verification is governed
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why legacy 00.2b Checklist C
      (Konva.js canvas) was excluded (UI implementation is not a deployment
      concern per Layer Boundary); why checklists are documentation not code
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-042 checked off with today's date
