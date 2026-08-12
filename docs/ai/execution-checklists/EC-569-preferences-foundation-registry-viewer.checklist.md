# EC-569 — Preferences Foundation for the Registry Viewer (Execution Checklist)

**Source:** docs/ai/work-packets/WP-534-preferences-foundation-registry-viewer.md
**Layer:** Client UI (Vue 3 SPA — `apps/registry-viewer/`) — standard two-session lane, two-commit topology

## Before Starting
- [ ] Branch off `origin/main`; `pnpm -r build` first (so registry-viewer resolves `@legendary-arena/registry/*` — the fresh-worktree dist trap).
- [ ] Baseline: `pnpm --filter registry-viewer build` + `typecheck` exit 0; record `pnpm -r test` registry-viewer baseline count.
- [ ] Read the source implementation at commit `8ec6ceda` (`apps/registry-viewer/src/prefs/**`, its `main.ts` Pinia wiring, its `package.json` `pinia` dep) and the design plan `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` (also on `8ec6ceda`).
- [ ] **Integration, not clobber:** bring `src/prefs/**` forward verbatim, but MERGE the Pinia init into the *current* `main.ts` — do NOT overwrite current `main.ts` with the 4-month-old version (it has since changed).

## Locked Values (do not re-derive — from the original EC-070 / plan §2.3)
- `PREFERENCES_SCHEMA_VERSION = 2` (literal-typed const).
- Storage key `"legendary-arena.preferences"`; backup key `"legendary-arena.preferences.backup"`; devLog category `"prefs"`.
- Shared-tier section ids: `"appearance"`, `"accessibility"`, `"advancedBase"`.
- Appearance defaults: `themeMode: "dark"`, `accentColor: "#7070e0"`, `fontScale: 1.0`, `fontFamily: "system"`.
- Accessibility defaults: `reduceMotion: "auto"`, `smoothScroll: true`, `focusRingBold: false`, `glossaryShortcut: "Mod+K"`, `escapeClosesLightboxFirst: true`, `showFloatingGlossaryFab: "auto"`.
- AdvancedBase defaults: `verboseDevLog: false`.

## Guardrails
- **Option-A path (D-24344):** NO `packages/ui-preferences/` — everything under `apps/registry-viewer/src/prefs/`.
- `src/prefs/shared/schema/*.schema.ts` MUST NOT import `vue` / `@vue/*` or reference `document` / `window` (schema-purity test enforces).
- `createPreferencesStore.ts` contains NO `throw`; degradation is always defaults + devLog.
- `sectionRegistry.registerSection` throws on duplicate id with a full-sentence error containing `"already registered"`.
- No `Math.random` / `Date.now` / `performance.now` in any new file.
- `App.vue`, `CardGrid.vue`, `CardDetail.vue`, `ThemeGrid.vue`, `ThemeDetail.vue`, `HealthPanel.vue`, `GlossaryPanel.vue`, `ImageLightbox.vue`, and every `src/lib/*.ts` **unchanged**.
- No user-visible UI change (pre/post render bit-identical); `registerSections.ts` registers ZERO app-specific sections.
- Two-commit topology: `EC-569:` implementation + `SPEC:` govern-close.

## Required `// why:` Comments
- `main.ts` at the Pinia init: why Pinia is added now (foundation for the preferences store; Option-A, no new package — D-24344).
- `createPreferencesStore.ts` at the load/persist path: why corruption/quota failures degrade to defaults + devLog rather than throwing.

## Files to Produce
- `apps/registry-viewer/package.json` — **modified** — add `pinia`.
- `apps/registry-viewer/src/main.ts` — **modified** — `createPinia()` init merged into current file.
- `apps/registry-viewer/src/prefs/registerSections.ts` — **new** (stub, zero app sections).
- `apps/registry-viewer/src/prefs/shared/composables/usePreferences.ts` — **new**.
- `apps/registry-viewer/src/prefs/shared/registry/sectionRegistry.ts` + `.test.ts` — **new**.
- `apps/registry-viewer/src/prefs/shared/schema/{base,appearance,accessibility,advancedBase}.schema.ts` + `base.schema.test.ts` + `_schema-purity.test.ts` — **new**.
- `apps/registry-viewer/src/prefs/shared/store/{createPreferencesStore.ts,persistence.ts}` + `createPreferencesStore.test.ts` — **new**.
- `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` — **new** (ported).
- Govern-close: `WORK_INDEX.md`, `EC_INDEX.md`, `docs/ai/STATUS.md`, `docs/05-ROADMAP-MINDMAP.md` (`📝`→`✅` + `roadmap:counts:write`), `docs/ai/DECISIONS.md` (D-24344 Drafted → Active). `NUMBER-LEDGER.md` already reserved.

## After Completing
- [ ] `pnpm --filter registry-viewer build` + `typecheck` exit 0; `pnpm --filter registry-viewer test` 0 (count rose by the ported tests).
- [ ] `pnpm -r --no-bail test` 0; `pnpm -r build` 0; `git status` shows no unexpected generated-artifact drift.
- [ ] `git diff --name-only` matches the Files-to-Produce allowlist (no stray component / `src/lib` edits).
- [ ] Schema-purity test passes; no `packages/ui-preferences/`.
- [ ] `docs/ai/STATUS.md` updated (foundation only; no user-visible surface — D-24026 N/A this WP).
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; roadmap node ✅ + `roadmap:counts:check` exits 0; D-24344 Active.

## Common Failure Smells
- `main.ts` overwritten with the 4-month-old version → regresses current viewer wiring; MERGE the Pinia init instead.
- Schema-purity test fails → a `*.schema.ts` imported `vue` or touched `window`/`document`.
- `@legendary-arena/registry/*` resolution errors → the pre-existing fresh-worktree dist trap; run `pnpm -r build` first (not a prefs defect).
- A settings drawer / gear icon / app-specific section appears → out of scope (this WP is the invisible foundation only).
