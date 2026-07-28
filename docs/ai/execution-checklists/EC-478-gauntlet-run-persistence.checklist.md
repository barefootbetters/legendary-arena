# EC-478 — Gauntlet Run Persistence (`player_gauntlet_runs`) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-443-gauntlet-run-persistence.md
**Layer:** Server (persistence — `legendary.*` domain storage)

## Before Starting
- [ ] On `origin/main` @ `61bef39a`; `apps/server` builds and its DB-gated tests pass green against a migrated `TEST_DATABASE_URL`.
- [ ] WP-440 ✅ / WP-441 ✅ / WP-442 ✅ shipped (pack contract + legends download + shared truth helper). This WP is parallel-safe with WP-440/441; WP-5 depends on it.
- [ ] Migration frontier confirmed: `038_add_driver_owner_to_match_bot_ally.sql` is the last on `main` → next free number is **039**. Re-verify `ls data/migrations/*.sql` before writing (a concurrent session may have added one; use the true next number).
- [ ] `legendary.players(player_id)` is a `bigint` PK with `ON DELETE CASCADE` FK precedent (009/011/022); `gen_random_uuid()` + partial-unique-`WHERE` idioms exist (017/022).
- [ ] `pnpm --filter @legendary-arena/server build` exits 0; `pnpm --filter @legendary-arena/server test` exits 0.
- [ ] **Scope lock — EXACT target set (any file outside is a FAIL):** `data/migrations/039_create_player_gauntlet_runs.sql` (new), `apps/server/src/gauntlet/gauntletRun.types.ts` (new, minimal), `apps/server/src/gauntlet/gauntletRun.migration.test.ts` (new) + governance ledgers only.

## Locked Values (do not re-derive)
- **Migration number `039`** (038 = `driver_owner`, on `main`).
- **Column set (exactly 10, verbatim):** `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`; `player_id bigint NOT NULL REFERENCES legendary.players(player_id) ON DELETE CASCADE`; `set_abbr text NOT NULL`; `mastermind_slug text NOT NULL`; `division text NOT NULL CHECK (division IN ('fixed', 'open'))`; `player_count smallint NOT NULL CHECK (player_count BETWEEN 1 AND 5)`; `leg_picks jsonb NOT NULL DEFAULT '{}'::jsonb`; `created_at timestamptz NOT NULL DEFAULT now()`; `updated_at timestamptz NOT NULL DEFAULT now()`; `first_completed_at timestamptz` (nullable).
- **Partial-unique active-run index** `player_gauntlet_runs_active_identity_uidx`: `UNIQUE (player_id, set_abbr, mastermind_slug, division, player_count) WHERE first_completed_at IS NULL` — verbatim predicate.
- **Listing index** `player_gauntlet_runs_player_idx` on `(player_id)`.
- **Types module surface (minimal):** `GauntletRunDivision = 'fixed' | 'open'`; `GauntletRunLegPicks = Record<string, readonly string[]>`; `GauntletRunRow` interface mirroring the columns (`playerId: string` — pg surfaces `bigint` as string). No function, no `pg`, no repository, no error-code union.

## Guardrails
- **MINIMAL + MAXIMALLY DERIVED:** store ONLY identity + `leg_picks` + audit timestamps. **NO `status`, NO `hero_pool`, NO child table, NO history/flag/pool-validity/champion table.** Status, pool, budget headroom, champion, last-played are ALL derived at read time (WP-5). Adding any derived column is a FAIL (D-24262). If a column seems to make a read cheaper → STOP, it is derived.
- **PARTIAL-UNIQUE PREDICATE EXACT:** `WHERE first_completed_at IS NULL` — NOT a full UNIQUE (that would forbid a completed run + a fresh active run of the same identity), NOT a different column set.
- **`first_completed_at` = write-once audit, NOT truth:** nullable timestamp set the first time a read derives champion (WP-5); NEVER read as championship truth (every read re-derives champion from `competitive_scores`). History ordering + active-run boundary only.
- **RUN LEGS LIVE IN `leg_picks`, NOT `player_loadouts`:** the 50-loadout cap (D-24086) is untouched. No `player_loadouts` write.
- **PERSISTENCE BOUNDARY:** `G`/`ctx` untouched; this is `legendary.*` domain storage — NOT a snapshot, NOT a save-game, NOT the `bgio` framework store. NO carve-out added (`.claude/rules/architecture.md §Persistence Boundary` needs no edit — ordinary server domain storage, the `player_loadouts` precedent).
- **IDEMPOTENT:** `CREATE TABLE IF NOT EXISTS` + `CREATE {UNIQUE} INDEX IF NOT EXISTS` (009/022/033). Re-running the runner on a seeded DB succeeds.
- **NO API / read logic / client:** endpoint, re-import idempotency, pack validation, derived reads, tracker UI are ALL WP-5/WP-7. §21 N/A.

## Required `// why:` Comments (SQL `--` header)
- Migration header: cite WP-443 / EC-478 / D-24262 + the number note (039 because 038 is `driver_owner`).
- The partial-unique index — why `WHERE first_completed_at IS NULL` (at-most-one ACTIVE run per identity; a completed run frees the slot).
- `first_completed_at` — write-once audit + archive boundary, never championship truth.
- `leg_picks` — the single authoritative hero state (map schemeSlug → heroDeckIds; no child table, no `player_loadouts` entry).

## Files to Produce
- `data/migrations/039_create_player_gauntlet_runs.sql` — **new** — single table `legendary.player_gauntlet_runs` (10 cols) + partial-unique active-run index + `(player_id)` index; idempotent; `legendary.*` schema.
- `apps/server/src/gauntlet/gauntletRun.types.ts` — **new (minimal)** — plain row-shape types (`GauntletRunDivision`, `GauntletRunLegPicks`, `GauntletRunRow`). No function/`pg`/repository.
- `apps/server/src/gauntlet/gauntletRun.migration.test.ts` — **new** — `node:test` DB-gated (TEST_DATABASE_URL, options-based non-silent skip): table/columns/indexes exist; 2nd active run of same identity blocked; allowed after `first_completed_at` stamped; division + player_count CHECKs reject; player DELETE cascades. Per-suite-run unique labels + `after` cleanup.

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (DB portion green against a migrated `TEST_DATABASE_URL`; skips LOUDLY without it).
- [ ] `grep -nE "\b(status|hero_pool|champion|cleared)\b" data/migrations/039_create_player_gauntlet_runs.sql` — no column-definition match (D-24262 derived-lock).
- [ ] `grep -n "WHERE first_completed_at IS NULL" data/migrations/039_create_player_gauntlet_runs.sql` — exactly one match (the partial-unique predicate).
- [ ] `docs/ai/STATUS.md` updated — states "No user-observable change — infrastructure only" (D-24026 inverted); notes no persistence carve-out added.
- [ ] `docs/ai/DECISIONS.md` — **D-24262 flips Drafted → Active (post-execution)**.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-478 status → `Done`.
- [ ] No file outside `Files to Produce` (+ governance ledgers) modified.

## Common Failure Smells
- A `status` / `hero_pool` / `last_played` column "to make the read simpler" → derived-state leak; delete it, derive at read time (WP-5). D-24262 FAIL.
- A full `UNIQUE` (no `WHERE`) → a completed run blocks a fresh active run of the same identity; the test's allow-after-complete assertion catches it. Add the partial predicate.
- Migration test passes without a DB and reports green → silent skip; it must skip LOUDLY (options-based `{ skip: '<reason>' }`), never a bare early return.
- `first_completed_at` read as "is champion" anywhere → truth leak; it is audit-only, champion is re-derived from `competitive_scores`.
- A `.claude/rules/architecture.md` / `ARCHITECTURE.md` persistence-carve-out edit → NOT needed; this is ordinary `legendary.*` domain storage, not a `bgio`-blob read.
