# Prompt 02 — Database Migrations

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. Plain `.sql` migration files only — no migration frameworks.
> ESM only. Node v22+. Migrations must be idempotent.

## Assumes

- Prompt 01 complete: Render Web Service and managed PostgreSQL exist
- `DATABASE_URL` environment variable is wired in Render
- `pg` is installed in the Node.js project

---

## Role

You are a senior backend engineer setting up a pragmatic, zero-dependency
migration workflow for a Node.js project on Render.com. You favor explicit
control over magic. No ORMs. No heavy migration frameworks unless justified.

---

## Project Context

Legendary Arena is a Node.js game server (ESM, v22+) in a pnpm monorepo at
`legendary-arena/`. The PostgreSQL schema was defined in Prompt 01. We need a
migration system that:

- Runs automatically on Render deploy (before the game server starts)
- Is safe to run repeatedly (idempotent)
- Does not require a separate migration service or worker
- Lives inside the monorepo alongside the server code
- Handles both schema creation and reference data seeding

---

## Deliverables

### 1. Migration runner (`scripts/migrate.mjs`)

Write a standalone Node.js ESM script that:

1. Connects to `DATABASE_URL` using `pg`
2. Creates a `schema_migrations` table if it doesn't exist (tracks applied migrations)
3. Reads all `.sql` files from `db/migrations/` in filename order
4. Skips files already recorded in `schema_migrations`
5. Applies unapplied migrations inside a transaction (rolls back entire file on error)
6. Records each successful migration with filename + applied timestamp
7. Exits 0 on success, 1 on failure with a clear error message
8. Logs each migration as it runs: `[migrate] applying 001_initial_schema.sql...`

### 2. First three migration files

Provide the content of these files in `db/migrations/`:

- `001_initial_schema.sql` — the five tables from Prompt 01 (expansions, schemes,
  masterminds, villain_groups, setup_rules), including all PKs, FKs, and indexes
- `002_seed_base_set.sql` — the Galactus seed data from Prompt 01
- `003_add_game_sessions.sql` — a `game_sessions` table for tracking active/completed
  games: `id UUID`, `created_at`, `status` as `TEXT CHECK (status IN ('waiting','active','complete'))`,
  `player_count INT`, `mastermind_id UUID FK`, `scheme_id UUID FK`

### 3. Render build command update

Show the updated `render.yaml` `buildCommand`:

```yaml
buildCommand: pnpm install && node scripts/migrate.mjs
```

Explain in a comment why running migrations as part of the build (not startup)
is safe even if the server restarts frequently.

### 4. `package.json` script entry

```json
{ "migrate": "node --env-file=.env scripts/migrate.mjs" }
```

---

## Operational Notes (answer directly)

1. **Re-runs**: What is the exact log output when `migrate.mjs` runs against a
   database that already has all migrations applied?

2. **Rollbacks**: This system has no rollback mechanism. When is that acceptable,
   and what is the manual recovery procedure when a bad migration reaches production?

3. **Local dev**: Should developers run a local PostgreSQL instance or connect to
   the Render database directly? One sentence with justification.

---

## Hard Constraints

- No migration frameworks (no Flyway, Liquibase, Knex migrations, golang-migrate)
- ESM only — no `require()`
- `pg` only — no additional database packages
- Script must be safe for Render's build environment (no TTY assumptions,
  no interactive prompts)
- SQL files must be plain `.sql` — no JavaScript wrapping SQL strings
