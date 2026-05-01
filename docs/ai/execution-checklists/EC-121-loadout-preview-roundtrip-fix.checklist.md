# EC-121 — Loadout Preview Round-Trip Fix (Execution Checklist)

**Source:** docs/ai/work-packets/WP-120-loadout-preview-roundtrip-fix.md
**Layer:** Apps / `apps/registry-viewer` (UI wiring)

## Why This Is an EC (Paired with WP-120)

WP-120 commits a runtime behavior change and a state-ownership decision (D-12001), so it requires the full WP governance arc. This EC is its execution contract — quick-reference for locked values, guardrails, required `// why:` comments, and post-execution verifications. Compliance is binary; every item below must be satisfied exactly.

This is **not** an ad-hoc EC (compare EC-110 CI fix, EC-120 lint baseline). The paired WP is the authoritative design document.

## Before Starting
- [ ] WP-091 complete: `useLoadoutDraft.ts` exports `useLoadoutDraft(registry)` returning `UseLoadoutDraftApi` (16 mutators + `loadFromJson` + `exportToJsonBlob` + `exportFilename` + `resetDraft`)
- [ ] WP-114 complete: `<LoadoutPreview>` and `<LoadoutBuilder>` each currently call `useLoadoutDraft(props.registry)` once in `<script setup>`; `App.vue` calls `useSetupFromUrl(reg)` exactly once inside `onMounted`
- [ ] WP-117 complete: D-11702 records "no router; preserve `activeView` + WP-114 query params" for `apps/registry-viewer`
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 (baseline `22 / 4 / 0`)

## Locked Values (do not re-derive)

**MatchSetupConfig fields (9-field composition lock):**
`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`

**WP-114 URL keys (canonical, preserved verbatim per D-11401):**
`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`

**`UseLoadoutDraftApi` field set (22 names — imported as type, not redefined):**
`draft`, `errors`, `isValid`, `setScheme`, `setMastermind`, `addVillainGroup`, `removeVillainGroup`, `addHenchmanGroup`, `removeHenchmanGroup`, `addHeroGroup`, `removeHeroGroup`, `setCount`, `setPlayerCount`, `setSeed`, `reRollSeed`, `setThemeId`, `setHeroSelectionMode`, `prefillFromTheme`, `loadFromJson`, `exportToJsonBlob`, `exportFilename`, `resetDraft`

**Event name:** `request-edit` (kebab-case in template, matches Vue 3 emit convention)

**Acknowledgement closed set:** `"idle" | "loaded" | "rejected"` (string literal union, not a Zod schema)

**Decision:** D-12001 = A (hoist + props; B singleton rejected — would unlock WP-091 PS-1; C provide/inject rejected — less explicit at this depth)

## Guardrails

1. **`useLoadoutDraft.ts` is byte-identical at execution end.** WP-091 PS-1 + WP-114 PS-1 amendment lock the file's signature, exports, and behavior. `git diff -- apps/registry-viewer/src/composables/useLoadoutDraft.ts` MUST be empty.
2. **`<LoadoutPreview>` stays read-only-by-default.** No `useLoadoutDraft` import. No mutator import from any source. `useLoadoutDraft(...)` call count = 0.
3. **`<LoadoutBuilder>` no longer calls `useLoadoutDraft` locally.** `useLoadoutDraft(...)` call count = 0; the type-only `import type { UseLoadoutDraftApi }` is the only `useLoadoutDraft`-related import.
4. **`App.vue` calls `useLoadoutDraft` exactly once.** Inside `onMounted`, after `registry.value` is non-null, alongside the existing `useSetupFromUrl(reg)` invocation.
5. **No router added.** No `vue-router` import, no `<router-view>`, no `useRouter()` call (D-11702 preserved).
6. **No new dependency.** `apps/registry-viewer/package.json` byte-identical at execution end.
7. **No persistence layer added.** No `localStorage` / `sessionStorage` / `IndexedDB` / `document.cookie` introduced in the 3 modified files.
8. **No engine, server, registry, or arena-client touch.** `git diff --name-only -- 'packages/**' 'apps/server/**' 'apps/arena-client/**' 'data/**'` MUST be empty.
9. **The `request-edit` event fires at most once per click.** No auto-promotion on URL arrival, no debounce, no implicit fire on validation-state change.
10. **WP-093 verbatim UI strings preserved.** The three `HERO_SELECTION_MODE_*` constants imported in `<LoadoutBuilder>` (lines 19–22 at HEAD) are byte-identical at execution end.
11. **Stage by exact filename only.** Never `git add .` / `-A` / `-u` — the residual `EC-119` untracked file is out of scope.

## Required `// why:` Comments

- **`App.vue` hoist site (above `onMounted` block):** explain (1) WP-120 fix moves the call up from each component; (2) WP-091 PS-1 immutable lock preserved by hoist approach; (3) pattern mirrors existing `useSetupFromUrl` hoist.
- **`App.vue` instantiation inside `onMounted`:** one-line cite that this is the WP-120 single-instance instantiation shared by both consumers.
- **`<LoadoutBuilder>` prop intake (`const draftApi = props.draftApi;`):** explain that draft API is now owned by `App.vue` per WP-120 D-12001 = A and WP-091 PS-1 (composable signature) remains untouched.
- **`<LoadoutPreview>` emit-only handler:** explain (1) local mutator import removed per WP-120 §Scope (C); (2) parent owns the single hoisted draft; (3) read-only-by-default posture from EC-116 §Guardrails #4/#5 preserved (zero mutators).

## Files to Produce

1. `apps/registry-viewer/src/App.vue` — **modified** — hoist `useLoadoutDraft(registry)` + add `onPreviewRequestEdit` handler + `previewEditAcknowledgement` ref + pass props to children.
2. `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — accept `draftApi: UseLoadoutDraftApi` prop, remove internal `useLoadoutDraft` call.
3. `apps/registry-viewer/src/components/LoadoutPreview.vue` — **modified** — emit `request-edit`, accept `editAcknowledgement` prop, remove internal `useLoadoutDraft` call.

3 files. No new files. No tests added (no Vue component testing infrastructure exists; manual operator smokes per WP-114 §14 precedent cover the behavior verification).

## After Completing

- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 (baseline `22 / 4 / 0` preserved)
- [ ] `pnpm -r build` exits 0 (full monorepo)
- [ ] All 37 acceptance criteria from WP-120 (sections A–F) PASS
- [ ] Manual Smoke 1 (URL round-trip populates visible builder) **PASS — operator-recorded**
- [ ] Manual Smoke 2 (no URL → blank builder, no stickiness) **PASS — operator-recorded**
- [ ] `docs/ai/STATUS.md` updated — capability line per WP-120 DoD
- [ ] `docs/ai/DECISIONS.md` updated — D-12001 entry (Option A hoist + props; rejected B singleton + C provide/inject)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-120 row flipped `[ ]` → `[x]` with date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-121 row flipped `Draft` → `Done`
- [ ] No files outside the 3 implementation files were modified inside the `EC-121:` commit (governance close lands in a separate `SPEC:` commit)
- [ ] Commit A prefix `EC-121:` (apps/ files staged); Commit B prefix `SPEC: close WP-120 / EC-121 governance`

## Common Failure Smells

- **Loadout tab renders completely blank in the browser (build + tests still pass).** `loadoutDraftApi` was declared with `ref()` instead of `shallowRef()`. Vue's `ref()` deep-reactifies its value via `reactive()`, which auto-unwraps nested refs on property access — so `loadoutDraftApi.value.draft` silently becomes a plain `MatchSetupDocument` instead of `Ref<MatchSetupDocument>`. `<LoadoutBuilder>`'s destructure binds `draft` to a plain object, the template's `draft.value.composition.…` throws at render time, and Vue swallows the subtree. **Fix:** use `shallowRef<UseLoadoutDraftApi | null>(null)` and import it from `vue` alongside `ref`. Build + automated tests do NOT catch this; only the manual smoke does.
- **"Edit this loadout" still does not populate the visible builder** — the hoist did not reach `<LoadoutBuilder>`. Confirm Builder receives `draftApi` as a prop and uses it instead of calling `useLoadoutDraft` locally.
- **TypeScript error "draftApi not assignable to type UseLoadoutDraftApi | null"** — the template's `:draftApi="loadoutDraftApi!"` non-null assertion is missing inside the `v-if="activeView === 'loadout' && registry && loadoutDraftApi"` branch.
- **Lint warning about unused `ref` import** — `ref` is still needed for `copyLinkStatus` in `<LoadoutPreview>`; do not remove the import.
- **Test count drifts from `22 / 4 / 0`** — a test file was modified or a new test was added inadvertently. Check `git diff -- 'apps/registry-viewer/src/**/*.test.ts'`; that diff should be empty.
