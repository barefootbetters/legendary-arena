# EC-042 — Deployment Checklists (Execution Checklist)

**Source:** docs/ai/work-packets/WP-042-deployment-checklists.md
**Layer:** Server / Operations

**Execution Authority:**
This EC is the authoritative execution checklist for WP-042.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-042.

---

## Before Starting

- [ ] WP-035 complete: release and deployment playbook exists at
      `docs/ops/` (commit `d5935b5`)
- [ ] Environment model (`dev`, `test`, `staging`, `prod`) documented
      by the typed union `DeploymentEnvironment` + D-3502 +
      `docs/ops/DEPLOYMENT_FLOW.md`
- [ ] `packages/registry/scripts/validate.ts` exists
      (`pnpm registry:validate`)
- [ ] `data/migrations/` exists with THREE migration SQL files
      (`001_server_schema.sql`, `002_seed_rules.sql`,
      `003_game_sessions.sql`) from Foundation Prompt 02 commit
      `ac8486b`
- [ ] `scripts/migrate.mjs` exists
- [ ] **`scripts/seed-from-r2.mjs` does NOT exist** — this is NOT a
      precondition failure; WP-042 is scope-reduced per D-4201 to
      ship without seed-dependent checklist sections. See WP-042
      §Scope (In) §B and D-4201 for the full rationale.

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-042.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `legendary.*` schema namespace — all tables use this prefix
- R2 base URL: `https://images.barefootbetters.com`
- Metadata files: `sets.json` (40), `card-types.json` (37),
  `hero-classes.json` (5), `hero-teams.json` (25), `icons-meta.json` (7),
  `leads.json` (50+)
- Migration order by filename (three files from Foundation Prompt 02
  commit `ac8486b`): `001_server_schema.sql`, `002_seed_rules.sql`,
  `003_game_sessions.sql`
- **Row counts for lookup tables are deferred** per D-4201 (depend on
  the absent `scripts/seed-from-r2.mjs`). WP-042 verifies schema
  structure (tables/columns/FK/indexes exist) but NOT row counts.
  Future WP-042.1 adds row-count verification after Foundation Prompt
  03 is revived.
- PKs use `bigserial`; cross-service IDs use `ext_id text`
- R2 bucket name: `legendary-images`
- **Upsert discipline (inherited invariant for future WP-042.1, not
  verified by this WP):** re-seeding uses
  `ON CONFLICT (slug) DO UPDATE` — never `DELETE` + re-insert. The
  checklist body may reference this invariant in prose as the
  documented expectation once seeding exists, but WP-042 does not
  verify it (no seed script to exercise).

---

## Guardrails

- Documentation only — no code modifications (D-4203 locks this as an
  invariant for WP-042 specifically: no new `.mjs` scripts, no new
  `.ts` runtime, no `package.json` script additions; the temptation
  to create `scripts/seed-from-r2.mjs` in-scope is explicitly
  forbidden)
- All checklist items are binary pass/fail
- No Konva.js, canvas, or UI implementation checks — UI is a separate
  layer (D-4202 back-pointer)
- Neither checklist references `packages/game-engine/` internals
- Neither checklist contains game framework concepts (game state
  variable, framework context, move functions) — paraphrase form per
  P6-43 / P6-50
- No game logic in deployment checklists — verify infrastructure, not
  gameplay
- Migration order defined by filename sort — never reordered
- No references to `pnpm seed` or `scripts/seed-from-r2.mjs` (script
  does not exist; any reference would fail checklist self-
  verification)

---

## Required `// why:` Comments

- None — this packet produces documentation only

---

## Files to Produce

- `docs/ai/deployment/r2-data-checklist.md` — **new** — R2 data and image
  verification (sections A.1–A.7 as originally specified)
- `docs/ai/deployment/postgresql-checklist.md` — **new** — PostgreSQL
  migration + schema-structure verification (four sections: B.1, B.2,
  B.6, B.7 — scope-reduced per D-4201; B.3/B.4/B.5/B.8 deferred to
  WP-042.1 awaiting Foundation Prompt 03 revival)
- `docs/ai/ARCHITECTURE.md` — **modified** — one-line cross-reference to
  deployment checklists
- `docs/ops/RELEASE_CHECKLIST.md` — **modified** — two back-pointer
  lines (Gate 2 → R2 checklist §A.1; "Relationship to runtime
  invariant checks" → PostgreSQL checklist §B.7) per PS-2 resolution

---

## Common Failure Smells (Optional)

- UI or Konva.js references leak into deployment checklists
- Checklists reference game-engine internals or boardgame.io concepts
- Migration order differs from filename sort
- Re-seeding uses DELETE + re-insert instead of upsert

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
      (engine baseline UNCHANGED at 436 / 109 / 0 fail — RS-2 lock)
- [ ] `pnpm -r test` exits 0 (repo-wide UNCHANGED at 526 / 0 fail)
- [ ] R2 checklist exists with no UI references
- [ ] PostgreSQL checklist exists with `legendary.*` namespace, covers
      §B.1 / §B.2 / §B.6 / §B.7, and carries a "deferred sections"
      pointer citing D-4201 for §B.3 / §B.4 / §B.5 / §B.8
- [ ] No `seed-from-r2.mjs` or `pnpm seed` references in either
      produced checklist (grep confirms zero matches — script does
      not exist; referencing it would fail checklist self-
      verification)
- [ ] No engine or UI references in either checklist
- [ ] No new `.mjs` / `.ts` scripts created (D-4203 invariant — WP-042
      is documentation class only)
- [ ] ARCHITECTURE.md contains reference to `docs/ai/deployment/`
- [ ] `docs/ops/RELEASE_CHECKLIST.md` has two new back-pointer lines
      (Gate 2 → R2 checklist §A.1; "Relationship to runtime invariant
      checks" → PostgreSQL checklist §B.7)
- [ ] No files in `packages/` or `apps/` modified (confirmed with
      `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (R2 checklist shipped full; PostgreSQL scope-reduced per D-4201;
      WP-042.1 follow-up identified)
- [ ] `docs/ai/DECISIONS.md` has D-4202 (Konva.js exclusion,
      P6-51 form (2) back-pointer) and D-4203 (documentation-not-code
      invariant, P6-51 form (1) discrete entry). D-4201 (WP-042 scope
      reduction) landed in the pre-flight SPEC commit.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-042 checked off with
      date, and WP-042.1 follow-up entry added for the deferred
      seeding checklist sections
