# EC-571 — Set Filter on the Debug Effects Viewer (`/debug/effects`) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-536-effects-viewer-set-filter.md
**Layer:** App (`apps/dashboard`) only — **Lightweight Lane** (D-24028)

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] Viewer + composable + test on main (WP-487): `test -f apps/dashboard/src/pages/debug/EffectsPage.vue && test -f apps/dashboard/src/composables/useEffectIndex.ts && test -f apps/dashboard/src/composables/useEffectIndex.test.ts` → OK
- [ ] Extension points present: `grep -q "export function filterEntries" apps/dashboard/src/composables/useEffectIndex.ts && grep -q "EffectIndexFilter" … && grep -q "handlerOnly" …` → OK
- [ ] Index entries carry `set`: `node -e "const d=require('./data/metadata/effect-implementation-index.json'); process.exit(d.entries.every(e=>typeof e.set==='string'&&e.set)?0:1)"` → exit 0
- [ ] No Set filter yet: `grep -q "SetFilter\|setFilter" apps/dashboard/src/composables/useEffectIndex.ts apps/dashboard/src/pages/debug/EffectsPage.vue` → **ABSENT** (STOP + inspect provenance if present)
- [ ] Working tree clean except for this WP

## Scaffold FIRST (Lightweight Lane empirical-independence gate — REQUIRED before eligibility confirm)
- [ ] Prototype the `filterEntries` set guard + `listSets` + the dropdown, then run `pnpm --filter @legendary-arena/dashboard test:coverage` and RECORD the observed result. Not a validation-tightening change, so no pre-existing-fixture break is expected — but the run is mandatory to pass the lane per `01.0a §Lightweight Lane`.

## Locked Values (do not re-derive)
- `SetFilter` type: `export type SetFilter = string | 'all'` — an **OPEN** union. Sets are registered card data, NOT a closed drift-tested engine vocabulary. Do **NOT** add a `SET_NAMES` canonical array or a drift test (contrast `ScopeFilter`/`StatusFilter`, which are closed `<union> | 'all'`). This distinction is the required `// why:`.
- `EffectIndexFilter` gains exactly `set: SetFilter`; `DEFAULT_FILTER` gains `set: 'all'`.
- `filterEntries` set guard (mirror the scope/status guards verbatim): `if (filter.set !== 'all' && entry.set !== filter.set) { continue; }`.
- `listSets`: `export function listSets(entries: readonly EffectIndexEntry[]): readonly string[]` — accumulate distinct `set` values with `for...of` into a `Set`, return `[...set].sort()`. **No `.reduce()`.** (Use the composable's actual entry type name — mirror the existing `filterEntries` signature.)
- Page control: a **`<select>` dropdown** in the filter row (NOT a button row — the set space is ~41 values). Options = `listSets(entries.value)` with a leading **All sets** (`value = 'all'`) option. `setFilter = ref<SetFilter>('all')`.
- Thread `set: setFilter.value` into the existing `filterEntries(...)` call in the `filteredEntries` computed — do not reorder the other filter fields.
- Default `'all'` — the page renders identically to its pre-WP state until a set is chosen.
- Commit prefix: `EC-571:` (code) + `SPEC:` (governance). No new D (applies D-24292).

## Guardrails
- ADDITIVE ONLY: one new filter dimension + one dropdown + tests. Do NOT rewrite existing filter logic, reorder guards' semantics, or change any default behavior.
- Do NOT touch `packages/**`, `apps/server`, `apps/registry-viewer`, `apps/arena-client`, the WP-484 transform, `effect-implementation-index.json`, `EffectImplementationIndexSchema`, or either mechanic ledger.
- Do NOT add any dependency — no `package.json` / `pnpm-lock.yaml` change (deliberate contrast to WP-487, which added the registry dep).
- Do NOT import the registry barrel or the game engine — no new import at all; the `/schema` import from WP-487 is unchanged.
- Dropdown options come from `listSets(entries)` (data-driven), NEVER a hardcoded set list — a newly-registered set must appear automatically.
- `/coverage` is OUT of scope — do not touch `CoveragePage.vue` / `useCoverageLedger.ts`.
- Dashboard coverage thresholds (lines 90 / branches 80 / functions 88) must still pass — cover the new guard + `listSets` in the test.
- No new auth/role/route-meta — inherit the existing `AppLayout` gate.

## Required `// why:` Comments
- On `export type SetFilter = string | 'all'`: why this union is OPEN (sets are registered card data, not a closed engine vocabulary like `ScopeFilter`/`StatusFilter` — so no canonical array, no drift test).
- On `listSets` (or the dropdown's option computed): why options are derived from the loaded index at runtime rather than a static set list (new card sets must surface without a code change).

## Files to Produce
- `apps/dashboard/src/composables/useEffectIndex.ts` — **modified** — `SetFilter` type + `set` on `EffectIndexFilter` + `DEFAULT_FILTER.set` + the `filterEntries` set guard + `listSets` helper
- `apps/dashboard/src/pages/debug/EffectsPage.vue` — **modified** — `setFilter` ref + Set `<select>` dropdown + thread `set` into `filterEntries`
- `apps/dashboard/src/composables/useEffectIndex.test.ts` — **modified** — set-filter partition cases + `listSets` cases
- `docs/ai/STATUS.md` / `WORK_INDEX.md` / `EC_INDEX.md` — **modified** — governance close (STATUS records the D-24026 live-verify as operator-pending)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-536 node `📝` → `✅`; run `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## After Completing
- [ ] `grep -nE "export type SetFilter|set: SetFilter|filter.set !== 'all'|export function listSets" apps/dashboard/src/composables/useEffectIndex.ts` → all present
- [ ] `grep -rnE "@legendary-arena/game-engine|from ['\"]@legendary-arena/registry['\"]" apps/dashboard/src/composables/useEffectIndex.ts apps/dashboard/src/pages/debug/EffectsPage.vue` → **NO MATCH** (no new engine/barrel import)
- [ ] `git diff --name-only | grep -vE '^(apps/dashboard/|docs/)'` → **NO MATCH**; `git diff --name-only | grep -E 'package.json|pnpm-lock.yaml'` → **NO MATCH**
- [ ] Set dropdown renders on `/debug/effects`; a set narrows the table + composes with scope/status/handler/search; `All sets` restores the full table
- [ ] `pnpm --filter @legendary-arena/dashboard test` + `build` + `test:coverage` exit 0 (thresholds hold)
- [ ] `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP node `✅` + counts refreshed (`roadmap:counts:check` exits 0)
- [ ] Commit prefix: `EC-571:` (code) + `SPEC:` (governance); D-24026 live-verify (Set filter narrows rows on the deployed dashboard) operator-pending

## Common Failure Smells
- A newly-registered set is missing from the dropdown → you hardcoded the set list; source options from `listSets(entries)`
- `listSets` uses `.reduce()` → forbidden in this codebase; use `for...of` into a `Set`, then `.sort()`
- Coverage thresholds drop → the new set guard or `listSets` is untested; add the partition + distinct/sorted cases
- `git status` shows `package.json`/`pnpm-lock.yaml` changed → you added a dependency; this WP adds none (nothing new is imported)
- The page behaves differently before a set is picked → `DEFAULT_FILTER.set`/`setFilter` is not `'all'`; default must leave the page unchanged
- A drift test or `SET_NAMES` array appears → `SetFilter` is deliberately an OPEN union; do not close the set space
- `/coverage` shows in the diff → out of scope; only `/debug/effects` (`apps/dashboard/src/pages/debug` + `composables/useEffectIndex.*`) changes
