# Session Prompt — Execute Foundation Prompt 02 (Database Migrations)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute Foundation Prompt 02 to create a zero-dependency database migration system:
- `scripts/migrate.mjs` — standalone migration runner
- `data/migrations/` — plain SQL migration files (001, 002, 003)
- Updated `render.yaml` buildCommand to run migrations before server start
- `pnpm migrate` script entry

---

## Authority Chain (Read in This Order)

Before writing any code, read these files in order:

1. `.claude/CLAUDE.md` — root coordination, EC-mode rules, governance set
2. `docs/ai/ARCHITECTURE.md` — layer boundaries (server is wiring-only)
3. `.claude/rules/server.md` — server layer enforcement rules
4. `docs/ai/REFERENCE/02-database-migrations.md` — **THE EXECUTION PROMPT**
   (this is the authoritative spec for what to build)
5. `data/legendary_library_schema.sql` — canonical PostgreSQL schema
6. `data/schema-server.sql` — rules-engine DDL subset (produced by FP-01)
7. `data/seed_rules.sql` — rules seed data (format for migration 002)
8. `docs/ai/REFERENCE/00.2-data-requirements.md §4, §8.2` — PostgreSQL
   boundary rules and game_sessions table guidance
9. `docs/ai/REFERENCE/00.6-code-style.md` — code style rules

---

## Pre-Execution Checks

Before writing a single line, confirm:

- [ ] Foundation Prompt 01 is complete (`apps/server/src/server.mjs` exists)
- [ ] `data/schema-server.sql` exists (rules-engine DDL from FP-01)
- [ ] `data/seed_rules.sql` exists (rules seed data)
- [ ] `data/legendary_library_schema.sql` exists (canonical schema)
- [ ] `data/migrations/` does NOT exist yet (this session creates it)
- [ ] `scripts/migrate.mjs` does NOT exist yet (this session creates it)
- [ ] `pg` is installed in `apps/server/` (`apps/server/node_modules/pg` exists)
- [ ] `pnpm install` succeeds

---

## Execution Rules

1. **One Foundation Prompt per session** — only FP-02
2. **Read the full execution prompt** (`02-database-migrations.md`) before writing code
3. **Schema authority**: `data/legendary_library_schema.sql` wins on any
   table/column name conflict
4. **ESM only** — no `require()`, `node:` prefix on all built-ins
5. **Code style**: `docs/ai/REFERENCE/00.6-code-style.md` — all rules apply
6. **No migration frameworks** — plain SQL files + `pg` only
7. **Idempotent**: all DDL uses `IF NOT EXISTS`, all inserts use `ON CONFLICT`
8. **Exit codes matter**: exit 1 blocks Render deployment

---

## Files Expected to Change

- `scripts/migrate.mjs` — **new** — migration runner
- `data/migrations/001_server_schema.sql` — **new** — rules-engine tables
- `data/migrations/002_seed_rules.sql` — **new** — rules glossary seed
- `data/migrations/003_game_sessions.sql` — **new** — match tracking table
- `render.yaml` — **modified** — buildCommand adds migration step
- `package.json` — **modified** — add `migrate` script entry

---

## Current Environment State

- Local PostgreSQL is running with `legendary_arena` database (UTF-8 encoding)
- Render PostgreSQL (free tier) is provisioned and seeded at:
  `dpg-d7c78nnavr4c73eai7b0-a.oregon-postgres.render.com`
- `.env` exists with real `DATABASE_URL` pointing to local PostgreSQL
- `pnpm check` passes except EC-CONN-002 (server not deployed) and
  EC-RCLONE-003 (rclone timeout — transient)
- All tool checks pass (Node 24, pnpm 10, boardgame.io 0.50.2, zod)

---

## Verification After Execution

Run these in order:

```pwsh
# 1. Run migrations against local database
pnpm migrate
# Expected: 3 migrations applied, 0 skipped

# 2. Run again — confirm idempotency
pnpm migrate
# Expected: 0 applied, 3 skipped

# 3. Verify schema_migrations has 3 rows
psql -U postgres -d legendary_arena -c "SELECT filename, applied_at FROM schema_migrations ORDER BY migration_id;"

# 4. Verify game_sessions table
psql -U postgres -d legendary_arena -c "\d game_sessions"

# 5. Health check still passes
pnpm check
```

---

## Post-Execution Updates

- [ ] `docs/ai/STATUS.md` — add FP-02 section
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — mark FP-02 complete
- [ ] `docs/ai/DECISIONS.md` — document ext_id text choice for game_sessions

---

## Important Notes

- `pg` is in `apps/server/node_modules/`, not root `node_modules/`. The
  migrate script runs from the monorepo root — use `createRequire` or resolve
  the import path to the workspace location (same pattern as the health check
  scripts).
- Windows PostgreSQL defaults to WIN1252 client encoding. If seed_rules.sql
  fails with encoding errors, set `$env:PGCLIENTENCODING="UTF8"` or ensure
  the database was created with UTF-8 encoding.
- The Render database connection string is in the Render dashboard under the
  database's Connections section (External Database URL).
