# EC-042 — Deployment Checklists (Execution Checklist)

**Source:** docs/ai/work-packets/WP-042-deployment-checklists.md
**Layer:** Server / Operations

**Execution Authority:**
This EC is the authoritative execution checklist for WP-042.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-042.

---

## Before Starting

- [ ] WP-035 complete: release and deployment playbook exists
- [ ] Environment model (dev, test, staging, prod) documented
- [ ] `packages/registry/scripts/validate.ts` exists (`pnpm registry:validate`)
- [ ] `data/migrations/` exists with migration SQL files
- [ ] `scripts/migrate.mjs` and `scripts/seed-from-r2.mjs` exist

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-042.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `legendary.*` schema namespace — all tables use this prefix
- R2 base URL: `https://images.barefootbetters.com`
- Metadata files: `sets.json` (40), `card-types.json` (37), `hero-classes.json` (5), `hero-teams.json` (25), `icons-meta.json` (7), `leads.json` (50+)
- Migration order by filename: `001_initial_schema.sql`, `002_seed_base_set.sql`, `003_add_game_sessions.sql`, `004_upsert_indexes.sql`, `005_lobby_columns.sql`
- Lookup table counts: `legendary.sets` = 40, `legendary.card_types` = 37, `legendary.teams` = 25, `legendary.hero_classes` = 5, `legendary.icons` = 7, `legendary.rarities` = 3
- PKs use `bigserial`; cross-service IDs use `ext_id text`
- Re-seeding uses `ON CONFLICT (slug) DO UPDATE` — never `DELETE` + re-insert
- R2 bucket name: `legendary-images`

---

## Guardrails

- Documentation only — no code modifications
- All checklist items are binary pass/fail
- No Konva.js, canvas, or UI implementation checks — UI is a separate layer
- Neither checklist references `packages/game-engine/` internals
- Neither checklist contains boardgame.io concepts (G, ctx, moves)
- No game logic in deployment checklists — verify infrastructure, not gameplay
- Migration order defined by filename sort — never reordered

---

## Required `// why:` Comments

- None — this packet produces documentation only

---

## Files to Produce

- `docs/ai/deployment/r2-data-checklist.md` — **new** — R2 data and image verification (sections A.1-A.7)
- `docs/ai/deployment/postgresql-checklist.md` — **new** — PostgreSQL migration and seeding (sections B.1-B.8)
- `docs/ai/ARCHITECTURE.md` — **modified** — one-line cross-reference to deployment checklists

---

## Common Failure Smells (Optional)

- UI or Konva.js references leak into deployment checklists
- Checklists reference game-engine internals or boardgame.io concepts
- Migration order differs from filename sort
- Re-seeding uses DELETE + re-insert instead of upsert

---

## After Completing

- [ ] R2 checklist exists with no UI references
- [ ] PostgreSQL checklist exists with `legendary.*` namespace
- [ ] No engine or UI references in either checklist
- [ ] ARCHITECTURE.md contains reference to `docs/ai/deployment/`
- [ ] No files in `packages/` or `apps/` modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (deployment checklists exist; R2 and PostgreSQL governed)
- [ ] `docs/ai/DECISIONS.md` updated
      (Konva.js checklist excluded per Layer Boundary; checklists are docs not code)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-042 checked off with date
