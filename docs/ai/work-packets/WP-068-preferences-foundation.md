# WP-068 — Preferences Foundation (Schema, Store, Section Registry)

**Status:** Ready
**Primary Layer:** Client UI (Vue 3 SPA — `apps/registry-viewer/`)
**Dependencies:** None (Option A path — viewer is independent; no shared-package build required)

---

## Session Context

The registry viewer (`apps/registry-viewer/`) is an established Vue 3 SPA that
currently has no state-management library and no preferences system — every
user-facing behavior is hardcoded (dark theme, tile size `130px`, `Ctrl+K`
shortcut, etc.). `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` designs the
introduction of a Pinia-backed preferences store, and `docs/ai/DECISIONS.md`
D-1401 locked the **Option A** delivery path (everything under
`apps/registry-viewer/src/prefs/`, no new workspace package). This packet
builds the invisible foundation only — no user-visible UI changes.

---

## Goal

After this session, `apps/registry-viewer/` has:

1. Pinia installed and initialized in `main.ts`.
2. A typed Zod preferences schema covering the three **shared-tier** sections
   (Appearance, Accessibility, AdvancedBase), living under
   `src/prefs/shared/schema/` and composed into a single `PreferencesSchema`
   with a versioned envelope (`PREFERENCES_SCHEMA_VERSION = 2`).
3. A **section registry** (`src/prefs/shared/registry/sectionRegistry.ts`)
   exposing `registerSection(id, schema, component)` with runtime duplicate
   rejection and compile-time type widening.
4. A **Pinia store factory** (`src/prefs/shared/store/createPreferencesStore.ts`)
   that composes registered section schemas at runtime, loads from
   localStorage via a corruption-safe envelope, persists on change with a quota
   guard, and exposes `resetAll`, `resetSection`, `importJson`, `exportJson`.
5. A `usePreferences()` composable that gives components a typed read/write
   handle.
6. An app-level `src/prefs/registerSections.ts` stub that imports the shared
   side-effect registrations but registers **zero** app-specific sections yet
   (Display / Filters / DataSource / Advanced sections come in WP-071 through
   WP-077).
7. Unit tests covering schema round-trip, corruption backup, quota failure
   degradation, and section-registry duplicate rejection.

No gear icon, no drawer, no CSS changes, no behavior change visible to end
users. Existing viewer output must be bit-identical to pre-packet production.

---

## Assumes

- `apps/registry-viewer/` builds and runs without errors:
  - `pnpm --filter registry-viewer build` exits 0
  - `pnpm --filter registry-viewer typecheck` exits 0
- `zod` is already a dependency of `apps/registry-viewer` (per existing
  `package.json`).
- `vue` is at `^3.4.27` (per existing `package.json`).
- `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` exists and §2.3 is the
  authoritative schema reference for this packet.
- `docs/ai/DECISIONS.md` entry **D-1401** exists and locks the Option A path.
- `localStorage` is available in the target browser environment (degrade to
  in-memory when it is not).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/14-PREFERENCES-PANEL-IMPLEMENTATION-PLAN.md` §2.1, §2.3, §2.4, §3.3,
  §5.7 — these sections are the authoritative design for everything this
  packet creates. §2.3 schema defaults are load-bearing (the
  "defaults-match-today" property depends on them); §5.7 requires that users
  with no stored preferences see the exact same UI they see today.
- `docs/ai/DECISIONS.md` §D-1401 — locks the Option A path. This packet
  creates files under `apps/registry-viewer/src/prefs/` only; it must not
  create `packages/ui-preferences/`.
- `apps/registry-viewer/CLAUDE.md` — layer rules for the viewer. Confirm that
  the viewer may import `zod`, `pinia`, and Vue runtime but must NOT import
  from `packages/game-engine`, `packages/preplan`, `apps/server`, or `pg`.
- `apps/registry-viewer/src/main.ts` — entry point. Read entirely before
  modifying.
- `apps/registry-viewer/src/App.vue` — read lines 1-50 to understand the
  existing composable pattern. This packet does **not** modify this file.
- `apps/registry-viewer/package.json` — confirm current `zod` and `vue`
  versions; confirm `pinia` is NOT already a dependency.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) — the viewer is
  an app, not a package; it depends downward only. Preferences are a
  client-only concern with zero engine coupling.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules for this packet:
  - Rule 4: no abbreviations (full English words)
  - Rule 6: `// why:` comments for non-obvious logic (especially every
    `localStorage` access and every `catch` block that swallows an error)
  - Rule 9: `node:` prefix on Node built-ins (none expected here)
  - Rule 11: full-sentence error messages
  - Rule 13: ESM only, `.test.ts` (never `.test.mjs`)
  - Rule 14: field names match the schema exactly — never rename

---

## Non-Negotiable Constraints

**Viewer-wide (always apply — do not remove):**

- Never import from `packages/game-engine`, `packages/preplan`, `apps/server`,
  or `pg` — viewer is a client-only SPA
- ESM only; no `require()`; no `.mjs` test files
- `node:` prefix on any Node built-in imports (not expected in this packet)
- Test files use `.test.ts` extension
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**

- `apps/registry-viewer/src/prefs/shared/schema/` files must NOT import `vue`
  or any DOM API. Pure Zod + TypeScript only. (Enforced by a test — see Scope
  C.)
- `apps/registry-viewer/src/prefs/shared/store/createPreferencesStore.ts`
  must wrap every `localStorage` access in `try/catch` with a `// why:`
  comment explaining the degradation path (private mode, quota exceeded,
  corruption).
- Option A path is locked per D-1401. Do NOT create `packages/ui-preferences/`.
  All files live under `apps/registry-viewer/src/prefs/`.
- The schema defaults in §2.3 of the plan are the source of truth — every
  default in `appearance.schema.ts`, `accessibility.schema.ts`,
  `advancedBase.schema.ts` must match the plan character-for-character. No
  "improvements" or "tidy-ups" allowed.
- No user-visible UI in this packet. `App.vue`, `CardGrid.vue`, `CardDetail.vue`,
  `ThemeGrid.vue`, `ThemeDetail.vue`, `HealthPanel.vue`, `GlossaryPanel.vue`,
  `ImageLightbox.vue`, and every `.lib/*.ts` file are out of scope for
  modification. Only `main.ts` is modified (minimal createPinia wiring).
- `registerSection()` must reject duplicate ids at runtime with a full-sentence
  error. Claude must add a test that fails loudly if this check regresses.
- No `Math.random` anywhere in new code (belt-and-braces; this is a viewer,
  but the rule is consistent with the project).

**Session protocol:**

- If any schema default disagrees with the plan, STOP and ask the human before
  proceeding — do not re-derive or guess.

**Locked contract values (inline — do not paraphrase):**

- **`PREFERENCES_SCHEMA_VERSION`** — must be the integer `2`.
- **Storage key** — `legendary-arena.preferences`.
- **Backup key** — `legendary-arena.preferences.backup`.
- **devLog category** — `"prefs"` reserved for this subsystem.
- **Shared-tier section ids** — `"appearance"`, `"accessibility"`,
  `"advancedBase"` (exact strings).
- **`AppearancePrefsSchema` defaults** (§2.3 of plan):
  `themeMode: "dark"`, `accentColor: "#7070e0"`, `fontScale: 1.0`,
  `fontFamily: "system"`.
- **`AccessibilityPrefsSchema` defaults** (§2.3):
  `reduceMotion: "auto"`, `smoothScroll: true`, `focusRingBold: false`,
  `glossaryShortcut: "Mod+K"`, `escapeClosesLightboxFirst: true`,
  `showFloatingGlossaryFab: "auto"`.
- **`AdvancedBasePrefsSchema` defaults** (§2.3):
  `verboseDevLog: false`.

---

## Debuggability & Diagnostics

- A user with corrupt localStorage (bad JSON, failing Zod validation) must
  see the viewer load with defaults — never a white-screen error. The
  corrupt blob is copied to the backup key and logged via `devLog("prefs",
  ...)`.
- A user in private browsing mode (no `localStorage`) must see the viewer
  load with in-memory defaults. Export/Import may be disabled but nothing
  else breaks.
- A user hitting `QuotaExceededError` on write must see the viewer continue
  operating in-memory; the failure is logged via `devLog("prefs", ...)` once
  per session.
- `PreferencesSchema.parse({...empties})` must return a fully-populated
  defaults object — this is the "build defaults" path and must be
  deterministic.
- Every `catch` block in persistence logic must include a `// why:` comment
  explaining which failure mode is being absorbed and why the degradation is
  safe.

---

## Scope (In)

### A) Dependency addition

- **`apps/registry-viewer/package.json`** — modified:
  - Add `"pinia": "^2.1.7"` to `dependencies` (alphabetically between `vue`
    and `zod`).
  - No other changes to `package.json`.

### B) Shared-tier schema files (pure Zod, no Vue imports)

- **`apps/registry-viewer/src/prefs/shared/schema/base.schema.ts`** — new:
  - Exports `PREFERENCES_SCHEMA_VERSION: 2` as a literal-typed const.
  - Exports `buildPreferencesSchema()` — a function that composes a `z.object`
    from the current section registry snapshot. Called by the store factory
    at instantiation time.
  - Exports `migratePreferences(raw: unknown): unknown` — pass-through for
    v2 (first shipping version); documented with a `// why:` comment
    explaining that future v2 → v3 migrations chain here.
  - Exports `type Preferences` inferred from the composed schema.

- **`apps/registry-viewer/src/prefs/shared/schema/appearance.schema.ts`** —
  new:
  - Exports `AppearancePrefsSchema` (Zod object) with defaults verbatim from
    plan §2.3.
  - Exports `type AppearancePrefs = z.infer<typeof AppearancePrefsSchema>`.

- **`apps/registry-viewer/src/prefs/shared/schema/accessibility.schema.ts`**
  — new:
  - Exports `AccessibilityPrefsSchema` per plan §2.3.
  - Exports `type AccessibilityPrefs`.

- **`apps/registry-viewer/src/prefs/shared/schema/advancedBase.schema.ts`** —
  new:
  - Exports `AdvancedBasePrefsSchema` per plan §2.3 (`verboseDevLog` only in
    the shared tier; other advanced keys are app-specific and come in WP-077).
  - Exports `type AdvancedBasePrefs`.

### C) Section registry

- **`apps/registry-viewer/src/prefs/shared/registry/sectionRegistry.ts`** —
  new:
  - Exports `registerSection<Id extends string, S extends z.ZodTypeAny>(id: Id, schema: S, component: Component | null): void`.
    The `component` parameter is nullable for this packet because no sections
    have UI yet; WP-070 introduces the component primitives.
  - Exports `getRegisteredSections(): ReadonlyMap<string, { schema: z.ZodTypeAny; component: Component | null }>`.
  - Registering a duplicate id throws `new Error("Preferences section \"...\" is already registered. Each id may be registered exactly once per application bootstrap.")`. Add a `// why:` comment explaining that silent overwrite would let the second registration silently win, which would be catastrophic for storage migrations.
  - Exports `resetRegistryForTests()` — ONLY used by tests, gated with a
    `// why:` comment forbidding production callers. The name makes misuse
    obvious in code review.

### D) Persistence helper

- **`apps/registry-viewer/src/prefs/shared/store/persistence.ts`** — new:
  - Exports `readEnvelope(key: string): unknown | null` — returns `null` on
    any failure (private mode, missing, invalid JSON).
  - Exports `writeEnvelope(key: string, value: unknown): boolean` — returns
    `true` on success, `false` on quota or private-mode failure. Callers
    handle the failure (typically: log via `devLog` and continue).
  - Exports `backupCorrupt(key: string, backupKey: string): void` —
    best-effort copy; silently succeeds on failure (backup is a diagnostic
    convenience, not a correctness requirement).
  - Every `try/catch` includes a full `// why:` comment naming the failure
    mode being absorbed.

### E) Store factory

- **`apps/registry-viewer/src/prefs/shared/store/createPreferencesStore.ts`**
  — new:
  - Follows the code from plan §3.3 with import paths adjusted for Option A
    (`../schema/base.schema` not `../schema/base.schema` from a package).
  - Uses `defineStore("preferences", () => {...})` (setup-function form).
  - `buildDefaults()` calls `PreferencesSchema.parse({ version: 2, ... })`
    using an object whose keys come from the current registry snapshot
    (dynamic — the set of keys depends on which sections have been
    registered at store-instantiation time).
  - `loadFromStorage()` uses `readEnvelope`, runs migrations, validates with
    the composed schema, and falls back to `buildDefaults()` on any failure
    (with `backupCorrupt` first).
  - `watch(() => JSON.stringify(state), ...)` persists via `writeEnvelope`.
    The serializer runs after every mutation; this is acceptable for the
    current schema size (≤ 30 scalars) — see plan §5.4.
  - Exposes `state: readonly(state)`, `mutable: state`, `resetAll`,
    `resetSection`, `importJson`, `exportJson`.
  - `resetSection` uses `as any` at one narrowed line only, with a `// why:`
    comment citing the TypeScript narrowing limitation for generic indexed
    writes.

### F) Composable

- **`apps/registry-viewer/src/prefs/shared/composables/usePreferences.ts`** —
  new:
  - Exports `usePreferences()` returning `{ ...storeToRefs(store), store }`
    per plan §3.4. Generic over the registered schema shape.

### G) App-level bootstrap

- **`apps/registry-viewer/src/prefs/registerSections.ts`** — new:
  - Side-effect imports the shared schemas and calls `registerSection` three
    times: `"appearance"`, `"accessibility"`, `"advancedBase"`, each with
    `component: null` (WP-070 adds the components).
  - Does NOT register any app-specific sections (Display / Filters /
    DataSource / Advanced). Those come in WP-071, WP-072, WP-074, WP-077
    respectively.
  - Add a `// why:` comment explaining that the component field is null
    because no UI primitives exist yet; WP-070 will revisit this file to
    attach the Appearance / Accessibility / AdvancedBase section components.

- **`apps/registry-viewer/src/main.ts`** — modified:
  - Add `import { createPinia } from "pinia";`
  - Add `import "./prefs/registerSections";` (side-effect import — must
    precede the Pinia-using app instance)
  - Replace `createApp(App).mount("#app");` with the three-line form:
    ```ts
    const app = createApp(App);
    app.use(createPinia());
    app.mount("#app");
    ```
  - No other changes to this file.

### H) Tests

Add `node:test` test files (viewer already uses `.test.ts` per
`WP-065-vue-sfc-test-transform.md` groundwork):

- **`apps/registry-viewer/src/prefs/shared/schema/base.schema.test.ts`** —
  new:
  - Asserts `PREFERENCES_SCHEMA_VERSION === 2`.
  - Asserts that when only the shared three sections are registered,
    `PreferencesSchema.parse({ version: 2, appearance: {}, accessibility: {}, advancedBase: {} })`
    returns an object whose every field matches the plan §2.3 defaults,
    field-by-field (not a snapshot match — explicit field assertions so a
    drift test fails loudly).
  - Asserts `migratePreferences({ version: 2, ... })` is a pass-through.

- **`apps/registry-viewer/src/prefs/shared/registry/sectionRegistry.test.ts`**
  — new:
  - `registerSection("foo", someSchema, null)` succeeds.
  - `registerSection("foo", ...)` a second time throws an `Error` whose
    message contains `"already registered"`.
  - `getRegisteredSections().get("foo")` returns the registered entry.
  - `resetRegistryForTests()` empties the registry.

- **`apps/registry-viewer/src/prefs/shared/store/createPreferencesStore.test.ts`**
  — new:
  - Round-trip: `JSON.parse(JSON.stringify(state))` re-parses via
    `PreferencesSchema` without loss.
  - `resetSection("appearance")` restores the Appearance section to defaults
    but leaves Accessibility and AdvancedBase untouched.
  - `resetAll()` restores everything to defaults.
  - `importJson(valid)` returns `true` and mutates state;
    `importJson(invalid)` returns `false` and leaves state untouched.
  - Corrupt localStorage (`localStorage.setItem(STORAGE_KEY, "not json")`)
    followed by `loadFromStorage()` equivalent returns defaults and writes
    to the backup key.
  - Test helpers: a minimal mock `localStorage` (standalone — do not pollute
    globals outside the test file; use dependency injection or a stub).

- **Import-purity test:**
  - Add a small `node:test` file
    `apps/registry-viewer/src/prefs/shared/schema/_schema-purity.test.ts`
    that reads each `*.schema.ts` file's source and asserts it contains
    neither `from "vue"` nor `document.` nor `window.` nor `"@vue/`. A
    `// why:` comment on the test explains this guards the Option-A → Option-B
    hoist: any Vue import would block the later file-move to a shared
    package.

---

## Out of Scope

- **No gear icon, no drawer, no `PreferencesPanel.vue`** — WP-069.
- **No control primitives (`PreferenceToggle`, `PreferenceSelect`, etc.)** —
  WP-070.
- **No `DisplayPrefsSchema`, `FiltersPrefsSchema`, `DataSourcePrefsSchema`,
  `AdvancedPrefsSchema`** — these are app-specific schemas created when
  their sections are wired: WP-071 / WP-072 / WP-074 / WP-077.
- **No changes to `App.vue`** — the gear icon and store consumption land in
  WP-069.
- **No changes to `CardGrid.vue`, `CardDetail.vue`, `ThemeGrid.vue`,
  `ThemeDetail.vue`, `HealthPanel.vue`, `GlossaryPanel.vue`,
  `ImageLightbox.vue`** — these are wired in WP-071 (Display), WP-075
  (Appearance), WP-076 (Accessibility).
- **No `useThemeVars()`** — WP-075.
- **No `useUrlSync()`** — WP-073.
- **No CSS variable migration** — WP-075.
- **No `packages/ui-preferences/` workspace package** — deferred per D-1401;
  may be hoisted later when `apps/game-ui/` is scoped.
- **Refactors, cleanups, or "while I'm here" improvements** are out of scope
  unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `apps/registry-viewer/package.json` — **modified** — add `pinia ^2.1.7`
- `apps/registry-viewer/src/main.ts` — **modified** — wire `createPinia()` + side-effect import of `registerSections`
- `apps/registry-viewer/src/prefs/shared/schema/base.schema.ts` — **new** — envelope, version const, schema composer
- `apps/registry-viewer/src/prefs/shared/schema/appearance.schema.ts` — **new** — shared Appearance section schema
- `apps/registry-viewer/src/prefs/shared/schema/accessibility.schema.ts` — **new** — shared Accessibility section schema
- `apps/registry-viewer/src/prefs/shared/schema/advancedBase.schema.ts` — **new** — shared Advanced-base schema
- `apps/registry-viewer/src/prefs/shared/registry/sectionRegistry.ts` — **new** — `registerSection()` API
- `apps/registry-viewer/src/prefs/shared/store/persistence.ts` — **new** — localStorage envelope with quota guard
- `apps/registry-viewer/src/prefs/shared/store/createPreferencesStore.ts` — **new** — Pinia store factory
- `apps/registry-viewer/src/prefs/shared/composables/usePreferences.ts` — **new** — typed reader composable
- `apps/registry-viewer/src/prefs/registerSections.ts` — **new** — app-level bootstrap; registers three shared sections with `component: null`
- `apps/registry-viewer/src/prefs/shared/schema/base.schema.test.ts` — **new** — schema round-trip + defaults tests
- `apps/registry-viewer/src/prefs/shared/schema/_schema-purity.test.ts` — **new** — enforces no Vue/DOM imports in schema subtree
- `apps/registry-viewer/src/prefs/shared/registry/sectionRegistry.test.ts` — **new** — duplicate-id rejection + lookup tests
- `apps/registry-viewer/src/prefs/shared/store/createPreferencesStore.test.ts` — **new** — round-trip, reset, import, corrupt-blob tests

No other files may be modified.

---

## Acceptance Criteria

### A) Dependency

- [ ] `apps/registry-viewer/package.json` `dependencies` block contains
      `"pinia": "^2.1.7"` and nothing else new.
- [ ] `pnpm install` runs clean; `pnpm-lock.yaml` updates only entries under
      the `pinia` subtree (plus its transitive deps).

### B) Shared schemas

- [ ] `base.schema.ts` exports `PREFERENCES_SCHEMA_VERSION` whose inferred
      type is `2` (literal).
- [ ] `appearance.schema.ts` exports `AppearancePrefsSchema` whose default
      parse returns `{ themeMode: "dark", accentColor: "#7070e0", fontScale: 1.0, fontFamily: "system" }`.
- [ ] `accessibility.schema.ts` defaults match plan §2.3 verbatim (6 fields).
- [ ] `advancedBase.schema.ts` defaults match plan §2.3 verbatim (1 field,
      `verboseDevLog: false`).
- [ ] No `.schema.ts` file in `src/prefs/shared/schema/` imports `vue` or
      references `document` / `window` / `@vue/` (confirmed by the purity
      test).

### C) Section registry

- [ ] `registerSection("appearance", AppearancePrefsSchema, null)` succeeds.
- [ ] A second call with id `"appearance"` throws an `Error` whose message
      contains the literal substring `"already registered"`.
- [ ] `getRegisteredSections()` returns a `ReadonlyMap` after bootstrap with
      exactly three entries: `"appearance"`, `"accessibility"`,
      `"advancedBase"`.

### D) Store factory

- [ ] `createPreferencesStore.ts` exports `usePreferencesStore` (Pinia
      `defineStore` return).
- [ ] Instantiating the store with a fresh (empty) localStorage yields
      state equal to `buildDefaults()` field-for-field.
- [ ] `resetSection("appearance")` mutates only `state.appearance`; all
      other sections are referentially unchanged.
- [ ] `importJson(exportJson())` is a no-op round-trip (state before ≡ state
      after).
- [ ] A localStorage pre-populated with `"not json"` at `STORAGE_KEY` loads
      to defaults AND writes the corrupt blob to `BACKUP_KEY`.
- [ ] No `throw` statement inside `createPreferencesStore.ts`
      (confirmed with `Select-String` — errors are caught and degraded; the
      only throw is in `sectionRegistry.ts` for duplicate ids).

### E) Composable

- [ ] `usePreferences()` returns an object whose `.store` property is the
      Pinia store instance and whose other keys are the `storeToRefs` of the
      state.

### F) App bootstrap

- [ ] `src/prefs/registerSections.ts` registers exactly three sections,
      each with `component: null`.
- [ ] No app-specific section (Display / Filters / DataSource / Advanced)
      is registered by this packet.
- [ ] `src/main.ts` calls `createApp(App)`, then `app.use(createPinia())`,
      then `app.mount("#app")` in that order.
- [ ] `src/main.ts` imports `"./prefs/registerSections"` **before** the line
      that creates the Pinia instance.

### G) Tests

- [ ] `pnpm --filter registry-viewer test` exits 0 (all test files).
- [ ] Purity test passes — no schema file contains forbidden imports.
- [ ] Duplicate-id test passes.
- [ ] Corrupt-blob test passes — defaults returned AND backup written.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0 with no new errors.
- [ ] `pnpm --filter registry-viewer build` exits 0.

### Scope Enforcement

- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`).
- [ ] `packages/ui-preferences/` does NOT exist (D-1401 compliance —
      confirmed by `Test-Path packages/ui-preferences` returning `False`).
- [ ] `App.vue`, `CardGrid.vue`, `CardDetail.vue`, `ThemeGrid.vue`,
      `ThemeDetail.vue`, `HealthPanel.vue`, `GlossaryPanel.vue`,
      `ImageLightbox.vue`, and every file under `src/lib/` are unchanged.

### No-Regression

- [ ] Running the viewer (`pnpm --filter registry-viewer dev`) and comparing
      against a pre-packet screenshot baseline shows zero visual difference
      in both Cards and Themes views at default viewport.

---

## Verification Steps

```pwsh
# Step 1 — install new dependency
pnpm install
# Expected: exits 0; pnpm-lock.yaml updated with pinia entries only

# Step 2 — build after all changes
pnpm --filter registry-viewer build
# Expected: exits 0, no TypeScript errors

# Step 3 — typecheck
pnpm --filter registry-viewer typecheck
# Expected: exits 0

# Step 4 — run all tests
pnpm --filter registry-viewer test
# Expected: all tests pass including purity, duplicate-id, corrupt-blob tests

# Step 5 — confirm no packages/ui-preferences/ created (D-1401 compliance)
Test-Path packages\ui-preferences
# Expected: False

# Step 6 — confirm no throw in store factory
Select-String -Path "apps\registry-viewer\src\prefs\shared\store\createPreferencesStore.ts" -Pattern "^\s*throw "
# Expected: no output

# Step 7 — confirm no Vue/DOM import in schema subtree
Select-String -Path "apps\registry-viewer\src\prefs\shared\schema\*.schema.ts" -Pattern "from `"vue`"|document\.|window\.|@vue/"
# Expected: no output

# Step 8 — confirm no Math.random anywhere in new viewer code
Select-String -Path "apps\registry-viewer\src\prefs" -Pattern "Math\.random" -Recurse
# Expected: no output

# Step 9 — confirm scope enforcement
git diff --name-only
# Expected: only files listed in ## Files Expected to Change, plus pnpm-lock.yaml

# Step 10 — visual smoke
pnpm --filter registry-viewer dev
# Open the viewer at the usual local URL, compare against pre-packet screenshot
# Expected: pixel-identical; no gear icon; no drawer; behavior unchanged
```

---

## Definition of Done

Claude Code must execute every verification command in `## Verification Steps`
before checking any item below. Reading the code is not sufficient — run the
commands.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 (all test files)
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] No `throw` in `createPreferencesStore.ts` (confirmed with `Select-String`)
- [ ] No `Math.random` in any new file (confirmed with `Select-String`)
- [ ] No `vue` / DOM imports in any `.schema.ts` file (confirmed by purity test)
- [ ] `packages/ui-preferences/` does not exist (confirmed with `Test-Path`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] Visual smoke: viewer renders pixel-identically to pre-packet production
- [ ] `docs/ai/STATUS.md` updated — records that the viewer now has a
      functional preferences store with three shared-tier sections registered
      but no user-visible UI yet; next packet (WP-069) adds the gear icon +
      drawer shell
- [ ] `docs/ai/DECISIONS.md` updated only if this packet surfaces a new
      decision beyond D-1401 — none expected
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-068 listed and checked off
      with today's date
