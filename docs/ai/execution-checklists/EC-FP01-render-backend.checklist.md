# EC-FP01 — Render.com Backend Setup (Execution Checklist)

**Source:** docs/ai/REFERENCE/01-render-infrastructure.md (Foundation Prompt 01)
**Layer:** Server / Infrastructure

## Before Starting
- [x] FP-00.4 complete (`scripts/check-connections.mjs` exists)
- [x] FP-00.5 complete (`scripts/validate-r2.mjs` exists)
- [x] `data/legendary_library_schema.sql` exists and read
- [x] `data/seed_rules.sql` exists and read
- [x] `apps/server/` does NOT exist yet

## Locked Values (do not re-derive)
- `legendary.*` schema namespace on all tables
- `bigserial` PKs (consistent with `legendary_library_schema.sql`)
- `rules` table columns: `rule_id int PK`, `code text`, `label text`, `card_types int[]`, `raw jsonb`
- `rule_docs` table columns: `rule_id int PK FK`, `definition jsonb`, `summary text`, `raw jsonb`
- Export names locked: `loadRules`, `getRules`
- CORS origins: `https://cards.barefootbetters.com`, `http://localhost:5173`
- boardgame.io `^0.50.0` — do not upgrade

## Guardrails
- Server is wiring-only — no game logic, no moves, no G mutation
- ESM only — no CommonJS, `node:` prefix on built-ins
- No `.reduce()` for rules cache — use `for...of`
- Functions ≤ 30 lines
- Full-sentence error messages on `process.exit(1)`
- `// why:` comments on CORS, pool config, rules cache, SIGTERM, CJS workaround

## Required `// why:` Comments
- CORS origins array (why these two origins)
- Pool config (why max=5, why inline)
- Rules cache pattern (why startup-load, why not lazy)
- SIGTERM handler (why graceful shutdown on Render)
- boardgame.io Server() (why authoritative, why single port)

## Deliverables
- [x] `apps/server/package.json`
- [x] `apps/server/src/rules/loader.mjs`
- [x] `apps/server/src/game/legendary.mjs`
- [x] `apps/server/src/server.mjs`
- [x] `apps/server/src/index.mjs`
- [x] `data/schema-server.sql`
- [x] `data/seed-server.sql`
- [x] `render.yaml`

## Post-Execution
- [x] `pnpm install` exits 0
- [x] No `require()` in any `.mjs` file
- [x] No `Math.random()` in any server file
- [x] `docs/ai/STATUS.md` updated
- [x] `docs/ai/work-packets/WORK_INDEX.md` — FP-01 marked complete
