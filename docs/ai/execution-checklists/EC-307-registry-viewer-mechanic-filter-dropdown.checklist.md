# EC-307 — Registry Viewer Mechanic Filter: Searchable Multi-Select Dropdown (Execution Checklist)

**Source:** docs/ai/work-packets/WP-276-registry-viewer-mechanic-filter-dropdown.md
**Layer:** Registry Viewer (`apps/registry-viewer`)
**Lane:** Lightweight (single session — draft + execute together per `01.0a §Lightweight Lane` / D-24028)

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] WP-270 landed: `test -f apps/registry-viewer/src/components/MechanicFilter.vue && test -f apps/registry-viewer/src/lib/cardMechanicsClient.ts` → OK
- [ ] Baseline green: `pnpm --filter registry-viewer typecheck` → 0; `pnpm --filter registry-viewer test` → 0
- [ ] `App.vue` already passes the full list: `grep -F ':mechanics="cardMechanicsIndex?.mechanics ?? []"' apps/registry-viewer/src/App.vue` → match (so no wiring change needed)
- [ ] Worktree built once (`pnpm -r build`) so the viewer typechecks against the registry dist

## Locked Values (do not re-derive)
- v-model contract UNCHANGED: prop `mechanics: readonly CardMechanicEntry[]`, model `selectedMechanicSlugs: Set<string>` — so `App.vue` needs no wiring change
- List ALL mechanics (no `hidden`-based suppression) — supersedes WP-270 AC-7 (D-24052)
- Sort by label (`localeCompare`); search filters label/slug case-insensitive
- Filter composition (in `App.vue`, unchanged): OR within selected mechanics, AND with the text query + other filters
- Popover: `position: fixed`, anchored via `getBoundingClientRect` at open (escapes the drawer's `overflow: hidden`); closes on outside-click / Escape / viewport scroll+resize
- Empty feed (`mechanics.length === 0`) ⇒ whole control omitted (degraded path preserved)

## Guardrails
- The viewer MUST NOT import `@legendary-arena/game-engine`, `apps/server`, `apps/dashboard`, or any repo-root `scripts/` (grep gate)
- Do NOT touch `cardMechanicsClient.ts`, the `cardMatchesMechanics` predicate, the feed, the schema, or `App.vue`'s `applyFilters()` logic — only the component + the one stale `App.vue` comment
- Do NOT add a new component / client / test file (the existing predicate test is unchanged; no SFC harness)
- Do NOT touch any producer-side file (`scripts/`, `packages/registry`, `data/metadata/`, `.github/`)
- `for...of` not `.reduce()` for any branching loop; full-word names

## Required `// why:` Comments
- On the `position: fixed` popover (escapes the filter drawer's `overflow: hidden` clip).
- On listing ALL mechanics (the WP-270 `hidden !== true` suppression is intentionally dropped — D-24052 / WP-276).
- On closing the popover when the viewport scrolls/resizes (a fixed popover would drift from its anchor).

## Files to Produce
- `apps/registry-viewer/src/components/MechanicFilter.vue` — **modified** — ribbon → searchable multi-select dropdown
- `apps/registry-viewer/src/App.vue` — **modified** — correct the stale `MechanicFilter` template comment (no behavior change)
- `docs/ai/DECISIONS.md` / `WORK_INDEX.md` / `EC_INDEX.md` / `STATUS.md` — **modified** — governance close (D-24052)

Exactly 6 files (2 viewer + 4 governance). No new component/client/test file.

## After Completing
- [ ] No forbidden import: `grep -RInE "(@legendary-arena/game-engine|apps/server|apps/dashboard|(^|/|\.\./)scripts/)" apps/registry-viewer/src/components/MechanicFilter.vue apps/registry-viewer/src/App.vue` → none
- [ ] Dropdown wired: `grep -F "mechanic-popover" …MechanicFilter.vue` ≥1; `grep -F "mechanic-dropdown-toggle" …` ≥1; `grep -F 'type="checkbox"' …` ≥1
- [ ] No `parseAbilityText` in `MechanicFilter.vue` / `App.vue`
- [ ] `pnpm --filter registry-viewer typecheck` 0; `test` 0 (prior count preserved); `build` 0
- [ ] No producer-side file: `git diff --name-only | grep -E '^(scripts/|packages/registry/|data/metadata/|\.github/)'` → none
- [ ] Working-tree scope is exactly the 6 files
- [ ] D-24052 lands; STATUS/WORK_INDEX/EC_INDEX flipped
- [ ] Commit prefix: `EC-307:` (code) + `SPEC:` (governance)

## Common Failure Smells
- Popover clipped / invisible → it must be `position: fixed`, not `absolute` inside the `overflow: hidden` drawer
- Dropdown won't close → register the document `mousedown` + `keydown` (Escape) listeners only while open and remove them on close/unmount
- Hidden mechanics still suppressed → WP-276 lists ALL mechanics; remove the `hidden !== true` filter (D-24052)
- App.vue behavior changed → only its stale comment changes; the v-model contract is preserved
- New component/test file added → out of scope; rework the existing `MechanicFilter.vue` in place (6 files)
