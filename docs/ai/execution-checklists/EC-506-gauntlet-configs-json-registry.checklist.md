# EC-506 — Year-Keyed Gauntlet-Config JSON + Registry Loader (Execution Checklist)

**Source:** docs/ai/work-packets/WP-471-gauntlet-configs-json-registry.md
**Layer:** Registry (`packages/registry`) — data + loader; imports Node + `zod` only

## Before Starting
- [ ] On `origin/main` @ `f6c7c43b` (or later), worktree clean.
- [ ] WP-458 ✅ on `main` (the D-24278 one-config-per-mastermind menu this supersedes).
- [ ] `getGauntletLoadoutMenu` / `GAUNTLET_LOADOUT_MENUS` / `REQUIRED_GROUP_COUNTS`
      exist as the WP describes; registry test/build green.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `data/gauntlet-configs.json`,
      `scripts/seed-gauntlet-configs.mjs`, `packages/registry/src/gauntletConfigs.{ts,test.ts}`,
      `packages/registry/src/index.ts` (barrel: export `getGauntletConfig`, `getActiveYear`,
      `validateGauntletConfigs`, the config type — WP-472 imports via the barrel, which uses
      explicit named exports) (+ governance). Do NOT edit `gauntletLoadouts.generated.ts`
      (consumers migrate in WP-472/473/474/475).

## Locked Values (do not re-derive)
- JSON shape: `year → setAbbr → mastermindSlug → schemeSlug → { villains: string[],
  henchmen: string[] }`, **bare** slugs, each an **ordered pool** (pool[0] always in
  at 1p). Loader scales by `REQUIRED_GROUP_COUNTS` (villains 1,2,3,3,4; henchmen
  1,1,1,2,2) and set-qualifies to `${setAbbr}/${slug}`. Active year drives the loader.
- Seed every set from today's `GAUNTLET_LOADOUT_MENUS`, reading the pool from the
  **highest player-count config** (the 5p superset — lower counts are prefixes), so the
  full ordered pool is captured and non-Core stays behaviourally byte-identical.
- **Fail-loud scheme-key validator:** the seeder/validator MUST reject a JSON scheme key
  that is not a real scheme slug of that set (assert against the set's `data/cards` scheme
  list) — the "unknown leg → seeded default" fallback must NOT mask an authoring typo (the
  copilot-caught `the-legacy-virus` vs `legacy-virus-the` class). Absent-but-real slug =
  deliberately unswapped; absent-and-unreal = hard error.
- Apply ONLY the Core swaps from WP-471 `§Contract` (Dr. Doom / Magneto / Red Skull /
  Loki, the exact schemes + pools listed). No other set/leg changes.

## Guardrails
- Registry imports Node built-ins + `zod` ONLY (no engine/server import).
- The loader is pure/deterministic; validate the JSON at load (throw a full-sentence
  error on malformed data — registry setup-time throw is allowed).
- `for...of`, no `.reduce()` for the pool-scaling; descriptive names.
- Do NOT wire any consumer to the loader (WP-472/473/474); do NOT remove the generated file.

## Required `// why:` Comments
- Why the JSON is the source of truth + the generator narrows to a one-time seeder.
- Why the pool is ordered + scaled by `REQUIRED_GROUP_COUNTS` (matches today's per-count sizing).
- Why the year key exists but only the active year is exposed (archival deferred).

## Files to Produce
- `data/gauntlet-configs.json` — seeded all-sets + Core swaps.
- `scripts/seed-gauntlet-configs.mjs` — the idempotent seeder.
- `packages/registry/src/gauntletConfigs.ts` — type + `validateGauntletConfigs` +
  `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount)` + `getActiveYear`.
- `packages/registry/src/gauntletConfigs.test.ts` — non-Core-equals-today, Core swaps,
  pool scaling, unknown-leg fallback, malformed-throws.

## After Completing
- [ ] `pnpm --filter @legendary-arena/registry test`; `pnpm -r build` + `pnpm -r test`
      (registry) exit 0; no consumer behaviour change.
- [ ] `git diff --stat data/gauntlet-configs.json` after re-seeding shows only the
      intended Core swaps differ from the seed.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-506 Done.
      **No D-entry here** (D-24283 lands at WP-472).
- [ ] No file outside the allowlist (+ governance) modified.

## Common Failure Smells
- Non-Core config drifted → the seeder didn't reproduce the current per-count pool.
- A swap shows at the wrong count → the swapped adversary sits at the wrong pool index
  (position 2 = the 2-player slot).
- Loader returns bare slugs → forgot to set-qualify `${setAbbr}/${slug}`.

## Execution Reconciliation (2026-07-31, operator-confirmed)

**Supersedes the Before-Starting file set and the seeder/all-sets items above.**
`data/gauntlet-configs.json` was found already shipped via #1116 (Core-only, rich schema —
`villainPool`/`henchmanPool`/`variety`, full ext_ids, matching the WP §Contract Core
swaps). Reconciled path (see WP-471 §Execution Reconciliation for the full rationale):

- **Actual target file set (subset of the drafted allowlist):**
  `packages/registry/src/gauntletConfigs.{ts,test.ts}` (new) + `packages/registry/src/index.ts`
  (barrel) + governance. **`scripts/seed-gauntlet-configs.mjs` is NOT created**;
  **`data/gauntlet-configs.json` is NOT modified** (read-only, kept verbatim from #1116).
- **Loader reads #1116's rich schema** and slices `villainPool`/`henchmanPool` by
  `PLAYER_COUNT_SETUP` (not a duplicated `REQUIRED_GROUP_COUNTS`); ext_ids are already full
  `setAbbr/slug` and are returned unchanged (the "loader returns bare slugs" smell is N/A —
  no re-qualification step exists).
- **`getGauntletConfig` returns `undefined` for any absent leg** → the consumer falls back
  to the per-mastermind `GAUNTLET_LOADOUT_MENUS` (WP-472 model). AC#1/AC#3 narrowed
  accordingly; the retained faithfulness guard is that every **unswapped** Core leg
  reproduces the menu.
- **Fail-loud scheme-key validation** is retained as a committed-file test asserting every
  scheme key in `data/gauntlet-configs.json` is a real scheme of its set (vs `data/cards`),
  guarding the `legacy-virus-the` typo class. A `slicing`-vs-`PLAYER_COUNT_SETUP` drift
  guard is added.
- **Retained:** registry zod-only; pure loader; validate-at-load throw; barrel exports; no
  D-entry (D-24283 at WP-472); `User-Visible Surface = none — infrastructure`.
