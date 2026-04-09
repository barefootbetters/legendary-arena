# Session Prompt — Execute Foundation Prompt 01 (Render.com Backend)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute Foundation Prompt 01 to create the Render.com backend:
- `apps/server/` — boardgame.io Server() with rules loader
- PostgreSQL schema subset for the rules engine
- `render.yaml` infrastructure-as-code
- Process entrypoint with graceful shutdown

---

## Authority Chain (Read in This Order)

Before writing any code, read these files in order:

1. `.claude/CLAUDE.md` — root coordination, EC-mode rules, governance set
2. `docs/ai/ARCHITECTURE.md` — layer boundaries (server is wiring-only)
3. `.claude/rules/server.md` — server layer enforcement rules
4. `docs/ai/REFERENCE/01-render-infrastructure.md` — **THE EXECUTION PROMPT**
   (this is the authoritative spec for what to build)
5. `data/legendary_library_schema.sql` — canonical PostgreSQL schema
6. `data/seed_rules.sql` — rules seed data (column shapes)
7. `docs/ai/REFERENCE/00.2-data-requirements.md §4` — PostgreSQL boundary rules
8. `docs/ai/REFERENCE/00.6-code-style.md` — code style rules

---

## Pre-Execution Checks

Before writing a single line, confirm:

- [ ] Foundation Prompt 00.4 is complete (`scripts/check-connections.mjs` exists)
- [ ] Foundation Prompt 00.5 is complete (`scripts/validate-r2.mjs` exists)
- [ ] `pnpm validate` exits 0 (R2 data is healthy)
- [ ] `data/legendary_library_schema.sql` exists and has been read
- [ ] `data/seed_rules.sql` exists and has been read
- [ ] `apps/server/` does NOT exist yet (this prompt creates it)

If any check fails, STOP.

---

## What You Must Produce

Per `docs/ai/REFERENCE/01-render-infrastructure.md`:

1. `apps/server/package.json` — workspace package declaration
2. `apps/server/src/rules/loader.mjs` — rules cache loader from PostgreSQL
3. `apps/server/src/game/legendary.mjs` — minimal boardgame.io game re-export
4. `apps/server/src/server.mjs` — boardgame.io Server() with CORS, startup
5. `apps/server/src/index.mjs` — process entrypoint with SIGTERM shutdown
6. `data/schema-server.sql` — rules-engine DDL subset
7. `data/seed-server.sql` — seed data with one complete mastermind example
8. `render.yaml` — Render infrastructure-as-code (root of monorepo)

---

## Critical Constraints

- **Server is a wiring layer ONLY** — no game logic, no moves, no `G` mutation
- **ESM only** — no CommonJS, `node:` prefix on all built-in imports
- **boardgame.io `^0.50.0`** — do not upgrade
- **`legendary.*` schema namespace** — all tables under this schema
- **`bigserial` PKs, `ext_id text`** for cross-service identifiers
- **No `Math.random()`** — all randomness via `ctx.random.*`
- **Full-sentence error messages** on every `process.exit(1)`
- **`// why:` comments** on: CORS origins, pool config, rules cache
  pattern, SIGTERM handler, CJS import workaround
- **No `.reduce()`** for building the rules cache — use `for...of`
- **Functions ≤ 30 lines** — split if longer
- **No abbreviated names** — `rulesCache` not `rc`, `matchConfiguration`
  not `cfg`

---

## Commit Rules (EC-Mode Active)

Hooks are installed. Use this prefix:

```
INFRA: execute Foundation Prompt 01 — Render.com backend setup
```

Push to GitHub after committing.

---

## After Completing

- [ ] `pnpm install` exits 0 (new workspace package detected)
- [ ] `apps/server/src/server.mjs` exists with CORS, startup tasks
- [ ] `apps/server/src/index.mjs` exists with SIGTERM handler
- [ ] `apps/server/src/rules/loader.mjs` exists with `loadRules`/`getRules`
- [ ] `render.yaml` exists at monorepo root
- [ ] `data/schema-server.sql` exists
- [ ] `data/seed-server.sql` exists
- [ ] No game logic in any server file (confirmed with grep for `moves`)
- [ ] No `require()` in any `.mjs` file
- [ ] `docs/ai/STATUS.md` updated — server exists, what it can do
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — FP-01 marked complete
- [ ] Committed with `INFRA:` prefix and pushed to GitHub

---

## What NOT To Do

- Do NOT modify `data/legendary_library_schema.sql` (canonical — read only)
- Do NOT modify `data/seed_rules.sql` (canonical — read only)
- Do NOT create game engine code (`packages/game-engine/` is WP-002)
- Do NOT create frontend code
- Do NOT create CI workflow files
- Do NOT implement authentication (separate WP)
- Do NOT create lobby or match CLI scripts (WP-011/012)
- Do NOT modify `.env.example` (already created by FP-00.4)

---

## Success Criteria

Foundation Prompt 01 is complete when:
- The server package exists and installs cleanly
- `render.yaml` can provision both services in one deploy
- The rules loader reads from PostgreSQL and caches in memory
- `pnpm check` PostgreSQL and server checks can now pass
  (on a machine with a running PostgreSQL and Render service)
- All files follow the code style rules with `// why:` comments

Begin execution now. Read the authority chain files first.
