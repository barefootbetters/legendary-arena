# EC-070 — Preferences Foundation (Execution Checklist)

**Source:** docs/ai/work-packets/WP-068-preferences-foundation.md
**Layer:** Client UI (Vue 3 SPA — `apps/registry-viewer/`)

> **Note on slot choice:** EC-070 is the first truly free slot at
> 2026-04-18. EC-068 is taken by WP-067's execution commit
> (`1d709e5`); EC-069 is reserved for the WP-062 arena HUD
> scoreboard (draft state at the start of this session). This EC is
> drafted alongside the execution commit to satisfy the commit-hygiene
> hook which requires an `EC-###:` prefix (see
> `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`).

## Before Starting
- [x] Branch is `wp-068-preferences-foundation`
- [x] `Test-Path packages/ui-preferences` returns `False`
- [x] `Test-Path apps/registry-viewer/src/prefs` returns `False` (pre-exec)
- [x] `pnpm --filter registry-viewer build` exits 0
- [x] `pnpm --filter registry-viewer typecheck` exits 0
- [x] `pnpm -r test` baseline = 442 passing (registry-viewer 0)
- [x] D-1414 present in DECISIONS.md

## Locked Values (do not re-derive)
- `PREFERENCES_SCHEMA_VERSION = 2` (literal-typed const)
- Storage key: `"legendary-arena.preferences"`
- Backup key: `"legendary-arena.preferences.backup"`
- devLog category reserved: `"prefs"`
- Shared-tier section ids: `"appearance"`, `"accessibility"`, `"advancedBase"`
- AppearancePrefsSchema defaults (plan §2.3):
  `themeMode: "dark"`, `accentColor: "#7070e0"`, `fontScale: 1.0`,
  `fontFamily: "system"`
- AccessibilityPrefsSchema defaults (plan §2.3):
  `reduceMotion: "auto"`, `smoothScroll: true`, `focusRingBold: false`,
  `glossaryShortcut: "Mod+K"`, `escapeClosesLightboxFirst: true`,
  `showFloatingGlossaryFab: "auto"`
- AdvancedBasePrefsSchema defaults (plan §2.3): `verboseDevLog: false`

## Guardrails
- `apps/registry-viewer/src/prefs/shared/schema/*.schema.ts` MUST NOT import
  `vue`, `@vue/*`, or reference `document` / `window` (purity test enforced)
- `createPreferencesStore.ts` contains NO `throw` statement; degradation is
  always to defaults + devLog
- `sectionRegistry.registerSection` throws on duplicate id with full-sentence
  error containing `"already registered"`
- Option A path locked: NO `packages/ui-preferences/` created (D-1414)
- No `Math.random`, `Date.now`, or `performance.now` in any new file
- App.vue, CardGrid.vue, CardDetail.vue, ThemeGrid.vue, ThemeDetail.vue,
  HealthPanel.vue, GlossaryPanel.vue, ImageLightbox.vue, and every
  `src/lib/*.ts` unchanged
- No user-visible UI change; pre/post screenshots bit-identical

## Required Comments
- Each `try/catch` in `persistence.ts` and `createPreferencesStore.ts` needs a
  `// why:` comment naming the failure mode absorbed
- `resetSection` narrowed write needs a `// why:` comment citing the TS
  indexed-write limitation
- `registerSection` duplicate throw needs a `// why:` comment explaining
  storage-migration catastrophe from silent overwrite
- `resetRegistryForTests` needs a `// why:` comment forbidding production use
- `migratePreferences` pass-through needs a `// why:` comment explaining the
  v2 -> v3 chain
- `registerSections.ts` `null` third-arg needs a `// why:` comment tying to
  WP-070 control-primitive rollout

## Files to Produce
- MODIFIED: `apps/registry-viewer/package.json` (pinia dep; tsx devDep + test
  script as minimum test-infra addition)
- MODIFIED: `apps/registry-viewer/src/main.ts` (createPinia wiring + side-
  effect registerSections import)
- NEW (9): `src/prefs/shared/schema/{base,appearance,accessibility,advancedBase}.schema.ts`;
  `src/prefs/shared/registry/sectionRegistry.ts`;
  `src/prefs/shared/store/{persistence,createPreferencesStore}.ts`;
  `src/prefs/shared/composables/usePreferences.ts`;
  `src/prefs/registerSections.ts`
- NEW tests (4): `src/prefs/shared/schema/base.schema.test.ts`;
  `src/prefs/shared/schema/_schema-purity.test.ts`;
  `src/prefs/shared/registry/sectionRegistry.test.ts`;
  `src/prefs/shared/store/createPreferencesStore.test.ts`

## Verification (must be all green)
- [x] `pnpm --filter registry-viewer build` → exits 0
- [x] `pnpm --filter registry-viewer typecheck` → exits 0
- [x] `pnpm --filter registry-viewer test` → exits 0 (17 new tests; 17 pass)
- [x] `pnpm -r test` → exits 0; repo-wide count = 459 (registry-viewer
      0 → 17; zero other regressions)

## Scope Guardrails (spot checks)
- [x] `Test-Path packages/ui-preferences` → `False` (D-1414 compliance)
- [x] `Select-String ... createPreferencesStore.ts -Pattern "^\s*throw "`
      → no output (all error paths degrade, never throw)
- [x] `Select-String ... /shared/schema/*.schema.ts -Pattern "from \"vue\"|document\.|window\.|@vue/"`
      → no output (Option-A → Option-B hoist remains a pure file-move)
- [x] `Select-String .../prefs -Pattern "Math\.random"` → no output
- [x] No edits to `App.vue`, `CardGrid.vue`, `CardDetail.vue`,
      `ThemeGrid.vue`, `ThemeDetail.vue`, `HealthPanel.vue`,
      `GlossaryPanel.vue`, `ImageLightbox.vue`, or any `src/lib/*.ts`

## After Completing (tracking updates)
- [x] `git diff --name-only` shows only WP-068 files + pnpm-lock.yaml +
      STATUS.md + WORK_INDEX.md + this EC file
- [x] STATUS.md updated with WP-068 summary and deviation notes
- [x] WORK_INDEX.md WP-068 row flipped from `[ ]` to `[x]` with
      completion-line format matching WP-067
- [x] Commit prefix: `EC-070:` (commit-hygiene hook rejects `WP-###:`;
      minimum-ceremony EC drafted alongside execution per
      session-context-wp068.md Step 7 Option A)

## Common Failure Smells
- A `.schema.ts` file imports `vue` → purity test fails; DO NOT add types
  from vue even as `import type` — move the Vue-typed code to a non-schema
  module
- Corrupt-blob test fails with `BACKUP_KEY` = null → `loadFromStorage` is
  treating "missing" and "invalid JSON" identically; probe
  `localStorage.getItem` a second time to distinguish
- `resetSection` fails TS narrowing → cast through `Record<string, unknown>`
  (not `any`) with a `// why:` note about generic indexed writes
- Duplicate `registerSection` call silently succeeds → registry singleton
  was reset mid-suite without re-registering; use `resetRegistryForTests`
  in `beforeEach`

Executed 2026-04-18 under commit prefix `EC-070:`.
