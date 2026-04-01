# Prompt 01 — Render.com Backend Setup

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. No secrets committed to files.

---

## Role

You are a senior backend engineer with deep, opinionated experience in:

- **Node.js** (ESM, v22+)
- **boardgame.io** (v0.50.x) authoritative multiplayer architecture
- **PostgreSQL** schema design and query patterns
- **Render.com** deployment and Infrastructure-as-Code (`render.yaml`)

You have shipped production Node.js game servers before. You make pragmatic
tradeoffs, write comments that explain *why* not just *what*, and you do not
reach for complexity when simplicity works.

---

## Project Context

**Legendary Arena** is an authoritative multiplayer card game server modeled
on the Marvel Legendary board game. Early-production target: fewer than 100
concurrent players.

### What already exists (do not recreate or contradict)

| Layer | What exists | Where |
|---|---|---|
| Card registry JSON | Per-set JSON files | R2: `https://images.barefootbetters.com/metadata/{abbr}.json` |
| Card images | WebP files | R2: `https://images.barefootbetters.com/{abbr}/` |
| Registry Viewer SPA | Vite + Vue 3 | Cloudflare Pages: `https://cards.barefootbetters.com` |
| Monorepo root | pnpm workspaces | `legendary-arena/` |

### What PostgreSQL is — and is NOT — for

**Use PostgreSQL for:**
- Validated game rules: setup constraints, mastermind strike counts, scheme twist rules
- Entity relationships: which villain groups belong to which mastermind
- Configuration that varies between sessions (expansion availability, banned combos)
- Seeded reference data the rules engine queries at startup

**Do NOT use PostgreSQL for:**
- Live turn state (`G`, `ctx`) — boardgame.io keeps this in memory
- Card display data (names, images, flavor) — already in R2 JSON
- Player session data — boardgame.io handles this

This distinction is critical. The database is a **rules engine backing store**,
not a card database mirror.

### CORS and networking

Allowed origins:
- `https://cards.barefootbetters.com` (production SPA)
- `http://localhost:5173` (local dev)

---

## Deliverables

Produce a complete, opinionated, copy-paste-ready implementation across five
sections. Do not pad with alternatives — give the version you would actually deploy.

---

### Section 1 — PostgreSQL Schema

1. DDL for five tables in this order:
   `expansions` → `schemes` → `masterminds` → `villain_groups` → `setup_rules`
2. Every table: UUID primary key with `gen_random_uuid()` default, `created_at`
   timestamp, appropriate foreign keys with `ON DELETE CASCADE`
3. At least one index per table beyond the PK (justify each in a comment)
4. One complete seed block: Galactus mastermind from the base set, including
   his scheme and setup_rule, demonstrating FK relationships
5. `-- Why this table exists` comment at the top of each `CREATE TABLE`

Do not include card display data (names, flavor text, image URLs). Rules data only.

---

### Section 2 — Node.js Rules Loader (`src/rules/loader.mjs`)

1. Connect to PostgreSQL via `pg` pool using `process.env.DATABASE_URL`
2. On startup: load all rules into `rulesCache` — one query per table, assembled
   into a nested in-memory object
3. Export `getRules()` — synchronous after startup, returns the cached object
4. Export `loadRules()` — async initialization called once at server startup
5. On connection failure: log a clear error and `process.exit(1)`
6. JSDoc comment above `getRules()` documenting the complete return shape
7. No boardgame.io imports — pure data layer

---

### Section 3 — boardgame.io Game Definition (`src/game/legendary.mjs`)

1. Import `getRules()` from the loader
2. Minimal but structurally correct `LegendaryGame` using boardgame.io `Game()`
3. Includes: `setup()`, one `moves` entry (`playCard`), one `endIf()` condition
4. Comment block at top explaining:
   - Why `G` never touches the database
   - What belongs in `G` vs. what is looked up from `rulesCache`
5. ESM only — no `require()`

Keep this minimal. The purpose is to show the seam between rules data and
game state, not to implement full game logic.

---

### Section 4 — Authoritative Server (`src/server.mjs`)

1. Call `loadRules()` before creating the boardgame.io server
2. Initialize `Server()` from boardgame.io with `LegendaryGame`
3. CORS: allow exactly the two origins listed above
4. Read `PORT` from `process.env.PORT`, fallback `8000`
5. Log on startup: port, rules loaded count, `NODE_ENV`
6. Comment explaining why the server must be authoritative and what that
   means for WebSocket traffic on Render

---

### Section 5 — Render Infrastructure

**`render.yaml`:**
- Web Service `legendary-arena-server`:
  - `runtime: node`
  - `buildCommand: pnpm install`
  - `startCommand: node src/server.mjs`
  - `envVars`: wire `DATABASE_URL` via `fromDatabase`, set `NODE_ENV: production`
  - Health check path: `/health`
- PostgreSQL database `legendary-arena-db`:
  - `plan: starter`
  - Name that the web service references in `fromDatabase`
- Short YAML comment above each block

**`.env.example`**: every env var the server reads, with placeholder values
and one-line comments. (Will be superseded by the complete version in Prompt 00.4.)

---

## Operational Notes (answer these four directly)

1. **Migrations**: How should schema changes be applied? Where do migration
   files live in the monorepo? What tool, if any, do you recommend and why?

2. **Rule updates**: A new expansion's rules are added to PostgreSQL. Does the
   server need to restart? Why or why not, given the startup-load caching strategy?

3. **Why not turn state in PostgreSQL?** One sentence — specific to boardgame.io's
   architecture, not a general "databases are slow" answer.

4. **What breaks first at scale?** Given startup-load caching and Render starter
   tier, what is the first bottleneck at ~100 concurrent games, and what is the
   minimal fix?

---

## Hard Constraints

- ESM only (`"type": "module"` in package.json)
- Node.js v22+
- boardgame.io v0.50.x: use `Server()`, `Game()` — not deprecated `createServer()`
- `pg` for PostgreSQL — no ORMs (no Prisma, Knex, Sequelize)
- No Redis, no Kubernetes, no message queues
- No frontend code
- No secrets in files — all sensitive values via environment variables
- Comments explain intent and tradeoffs, not just what the code does
