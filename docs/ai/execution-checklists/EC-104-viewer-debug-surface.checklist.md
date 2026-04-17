# EC-104 — Viewer Debug Surface (Dev-Only) (Execution Checklist)

**Source:** Ad-hoc — direct follow-up to EC-103. No backing WP.
**Layer:** Registry Viewer (`apps/registry-viewer`) ONLY

## Execution Authority

This EC adds a dev-only debug surface to the registry viewer by
**extending existing infrastructure** (`HealthPanel.vue`,
`devLog.ts`) and introducing a **single unified execution gate**
(`DEBUG_VIEWER`). It:

- does NOT create parallel debug components
- does NOT alter runtime behavior
- does NOT change production bundle output

Vite's dead-code elimination (DCE) guarantees that all logic gated
on `import.meta.env.DEV` is stripped from production builds. **This
EC depends on that contract and verifies it explicitly.**

## Execution Style

Narrow, infrastructure-focused, viewer-only. Most steps are
single-file edits. **Manual DCE verification is load-bearing** and
must not be skipped.

---

## Before Starting (Preconditions — Blocking)

All of the following must be true before opening the execution
session. Each is a **pass/fail gate**.

- [ ] EC-103 has landed (commit `e7d6408` — viewer a11y + CI gating)
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer lint` exits 0 errors
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] No stray `console.log` / `console.debug` / `console.info` /
      `console.trace` anywhere in `apps/registry-viewer/src/`
      outside `src/lib/devLog.ts` (verify via `grep -rnE`).
      `console.warn` and `console.error` in `App.vue` are permitted
      and expected.
- [ ] Working tree has no modified or staged files (pre-existing
      untracked items are OK)

---

## Baseline Reference (Informational — Not Blocking)

These are reference values for drift detection during verification.
They are NOT pass/fail gates on their own — the `≤` thresholds in
§Locked Values are.

- JS bundle: ≈182 KB raw / ≈58 KB gzip
- CSS bundle: ≈26 KB raw / ≈4.8 KB gzip
- Cosmetic lint warnings: ≈174 (non-a11y, non-`no-console`)

---

## Locked Values (Do Not Re-Derive)

### Unified debug gate — exact shape

File: `apps/registry-viewer/src/lib/debugMode.ts` (new)

```ts
/**
 * Single gate for all dev-only observability in the registry viewer.
 *
 * `import.meta.env.DEV` is compiled to a literal `false` by Vite in
 * production builds. With DEV as the LEFT operand of `&&`, the right
 * operand (the URLSearchParams construction) is statically
 * unreachable in prod and stripped by dead-code elimination.
 *
 * DO NOT reorder the operands: if URLSearchParams appears first, it
 * executes on every prod page load before short-circuit evaluation
 * rejects it, and the reference survives DCE.
 */
export const DEBUG_VIEWER =
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("debug");
```

**No other file may reference `import.meta.env.DEV` for viewer
debugging.** Every other file must import `DEBUG_VIEWER`.

### `no-console` rule — exact shape

In `apps/registry-viewer/.eslintrc.cjs`, add to the `rules` object:

```js
'no-console': ['error', { allow: ['warn', 'error'] }],
```

Do NOT allow `log`, `debug`, `info`, or `trace`.

### ESLint override — exact shape

Append to the existing `overrides:` array (create the key if absent —
read the file first):

```js
{
  files: ['src/lib/devLog.ts', 'src/lib/debugMode.ts'],
  rules: { 'no-console': 'off' },
},
```

**No other overrides permitted.** `App.vue`'s existing
`console.warn` / `console.error` calls are permitted by the top-level
`allow` list and do NOT need an override.

### `devLog` signature — exact shape

```ts
type Category = "registry" | "theme" | "filter" | "render";

export function devLog(
  category: Category,
  message: string,
  fields?: Record<string, unknown>,
): void;
```

Rules:

- Early return if `DEBUG_VIEWER === false`
- Use `console.groupCollapsed()` + `console.groupEnd()` for
  multi-field events
- Never log arrays > 20 elements (slice to 3-sample IDs)
- Never log registry or theme payloads themselves

### HealthPanel debug surface — exact shape

The debug surface lives **inside `src/components/HealthPanel.vue`**
as a **single conditional `<div class="debug-section" v-if=
"DEBUG_VIEWER">`** appended below the existing `.errors-section`.

**Forbidden implementations** (any of these is scope creep):

- Tab widget / tab bar
- Accordion / collapsible pane
- Router view or route-guarded sub-page
- Vue `<slot>` or slot-based subcomponent
- New child component (`DebugSection.vue`, etc.)
- Any new top-level overlay, modal, or panel

### `debugState` prop — exact shape

Optional prop on `HealthPanel.vue`:

```ts
{
  searchText: string;
  filterSet: string;
  filterHC: string;
  selectedTypes: string[];      // sorted copy of Set<FlatCardType>
  selectedCardKey: string | null;
  selectedThemeId: string | null;
  filteredCount: number;
  totalCount: number;
  glossaryOpen: boolean;
  lightboxOpen: boolean;
}
```

### `debugState` population rules

In `App.vue`, populate `debugState` **only** by one of:

1. **Inline template object literal** on the `<HealthPanel>` tag:
   ```vue
   :debug-state="{
     searchText: searchText,
     filterSet: filterSet,
     filterHC: filterHC,
     selectedTypes: [...selectedTypes].sort(),
     selectedCardKey: selectedCard?.key ?? null,
     selectedThemeId: selectedTheme?.themeId ?? null,
     filteredCount: filteredCards.length,
     totalCount: allCards.length,
     glossaryOpen: glossary.isOpen.value,
     lightboxOpen: lightbox.isOpen.value,
   }"
   ```
2. **A single `computed()`** that references only existing refs and
   returns the same object shape. Only permitted if the inline form
   makes the template unreadable.

**Forbidden in `App.vue`:**

- ❌ New `ref()` whose only consumer is `debugState`
- ❌ New `watch()` or `watchEffect()` for any reason
- ❌ New `computed()` beyond the single optional aggregator above
- ❌ Duplicating state already in existing refs
- ❌ Any `store`, `reactive()`, or `provide/inject` for debug state

No field may display "registry source (local vs HTTP)" — the browser
bundle is always HTTP; the field is meaningless.

### Commit prefix

`EC-104:` (viewer files staged ⇒ hook requires EC-### prefix per
`01.3`). `INFRA:` / `SPEC:` will be rejected by the commit-msg hook.

### Production bundle guarantees (hard gates)

- `grep -rE "DEBUG_VIEWER|debugMode" apps/registry-viewer/dist/`
  returns **zero matches**
- Raw JS bundle grows by **≤ 2 KB** vs EC-103 baseline (≈182 KB → ≤ 184 KB)
- Raw CSS bundle grows by **≤ 1 KB** vs EC-103 baseline (≈26 KB → ≤ 27 KB)
- Total lint warning count stays **≤ 180** (baseline ≈174 + small margin)

---

## Guardrails (Non-Negotiable)

- **One gate, one source of truth.** Only `src/lib/debugMode.ts`
  may reference `import.meta.env.DEV` for viewer debugging.
- **Extend, don't duplicate.** No new debug components, overlays,
  panels, routes, tabs, or subcomponents. The debug surface lives
  inside `src/components/HealthPanel.vue` as a conditional `<div>`.
- **No new dependencies.** Zero changes to `package.json` (other
  than unrelated pre-existing untracked entries, which stay
  unstaged).
- **Registry / theme clients are observe-only.** `src/lib/
  registryClient.ts` and `src/lib/themeClient.ts` receive `devLog`
  calls; existing fetch semantics, error handling, and singleton
  caching behavior must be preserved **exactly**.
- **Complete signature migrations.** If Step 2's new `devLog`
  signature breaks any existing callers, update every call site in
  the same commit. Do not leave a deprecated shape.
- **Never suppress `no-console`** via `eslint-disable` outside the
  two overridden files. Route through `devLog` instead.
- **Never run `eslint --fix`** — it will touch 165+ cosmetic
  warnings and balloon the diff outside EC-104 scope.
- **Never bypass hooks** (`--no-verify`, `--no-gpg-sign`).

---

## Required `// why:` Comments

- `src/lib/debugMode.ts` — operand order rationale (DCE
  load-bearing)
- `src/components/HealthPanel.vue` on the
  `<div class="debug-section" v-if="DEBUG_VIEWER">` — cite EC-104
  and the dev-only gate
- `apps/registry-viewer/.eslintrc.cjs` override entry — explain
  that `devLog.ts` and `debugMode.ts` are the approved `console.*`
  exit points (EC-104)
- Any non-obvious `devLog()` call (e.g., timing at a non-obvious
  checkpoint); most should be self-evident from the category + message

---

## Files to Produce

Exact files. Anything outside this list is out of scope.

- `apps/registry-viewer/src/lib/debugMode.ts` — **new** — exact
  Locked Values shape
- `apps/registry-viewer/src/lib/devLog.ts` — **modified** — gate on
  `DEBUG_VIEWER`; add category tag; grouped output
- `apps/registry-viewer/src/lib/registryClient.ts` — **modified** —
  `devLog('registry', 'load start' | 'load complete' | 'load
  failed', …)` with fields `{ baseUrl, durationMs, setCount,
  cardCount, sampleCardIds }` (3-sample max)
- `apps/registry-viewer/src/lib/themeClient.ts` — **modified** —
  `devLog('theme', 'load start' | 'load complete' | 'load failed',
  …)` with fields `{ baseUrl, durationMs, themeCount,
  sampleThemeIds }` (3-sample max)
- `apps/registry-viewer/src/components/HealthPanel.vue` —
  **modified** — conditional `.debug-section`; new optional
  `debugState` prop
- `apps/registry-viewer/src/App.vue` — **modified** — pass
  `debugState` to `<HealthPanel>` per §Locked Values population rules
- `apps/registry-viewer/src/components/CardGrid.vue` — **modified
  only if needed** — update existing `devLog(...)` call sites to the
  new signature
- `apps/registry-viewer/.eslintrc.cjs` — **modified** — `no-console`
  rule + overrides entry
- `docs/ai/execution-checklists/EC-104-viewer-debug-surface.checklist.md`
  — **new** — this file
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** —
  register EC-104 as `Draft` (via SPEC before execution) and flip
  to `Done` in the EC-104 execution commit

---

## Out of Scope (Do NOT Expand)

- **Event tracing for a11y-sensitive paths** (token click →
  glossary, backdrop dismiss, resize Enter/Space, cross-link
  navigation) — deferred to EC-105. Rationale: tracing on top of
  fresh infra multiplies surface area before foundations bake in.
- **Render-guard assertions** (e.g., warn if `allCards.length === 0`
  post-load) — empty filtered states are legitimate user actions;
  unclear invariants cause warning fatigue. Defer until real
  invariants surface.
- **Parallel `DebugPanel.vue` component** — explicit governance
  failure. Extend `HealthPanel.vue` only.
- **The 165+ remaining cosmetic lint warnings** (non-a11y,
  non-`no-console`). Those belong to a future `EC-106: viewer lint
  warning cleanup` if anyone cares.
- **Performance work** (lazy-load sets, bundle splitting) — separate
  EC track.
- **Any change to `FlatCard`, `CardQuery`, Zod schemas, or
  `apps/registry-viewer/src/registry/**`** — this EC only touches
  `src/lib/` for observability hooks; layer boundary is preserved.
- **Any engine, server, or cross-layer change.**

---

## Verification Steps (Run In Order; All Must Pass)

```bash
# 1. Dependencies
pnpm install --frozen-lockfile

# 2. Typecheck — must exit 0, zero errors
pnpm --filter registry-viewer typecheck

# 3. Lint — must exit 0 errors; warnings ≤ 180
pnpm --filter registry-viewer lint

# 4. Build — must exit 0
pnpm --filter registry-viewer build

# 5. HARD GATE — DCE verification (prod bundle must not contain
#    debug symbols). This is the reason EC-104 exists; skipping
#    this step means EC-104 did not actually achieve its goal.
grep -rE "DEBUG_VIEWER|debugMode" apps/registry-viewer/dist/ \
  && echo FAIL || echo OK
# expect: OK

# 6. Bundle size within tolerance (delta vs EC-103 baseline)
ls -la apps/registry-viewer/dist/assets/
# expect: index-*.js raw ≤ 184 KB; index-*.css raw ≤ 27 KB
```

### Manual DEV smoke test

```bash
pnpm --filter registry-viewer dev
```

- 7a. Visit `http://localhost:5173/` (no query param).
      Expect: no `[registry]` or `[theme]` console output;
      Diagnostics modal has NO Debug section.
- 7b. Visit `http://localhost:5173/?debug`. Open DevTools console.
      Expect: `[registry] load complete` collapsible group with
      fields `baseUrl`, `durationMs`, `setCount`, `cardCount`,
      `sampleCardIds`; same for `[theme] load complete`.
- 7c. Click "🔍 Diagnostics" on the `?debug` page.
      Expect: Debug section visible below Errors; active filter
      state (search / filterSet / filterHC / selectedTypes) reflects
      current UI.
- 7d. Apply a filter + select a card; re-open Diagnostics.
      Expect: Debug section reflects the new state.
- 7e. Toggle glossary (Ctrl/Cmd+K); re-open Diagnostics.
      Expect: `Glossary open: true`.

### Manual PROD smoke test (HARD GATE — the DCE payoff)

```bash
pnpm --filter registry-viewer build
pnpm --filter registry-viewer preview
```

- 8a. Visit `http://localhost:4173/?debug`.
      Expect: NO `[registry]` or `[theme]` console output;
      Diagnostics modal has NO Debug section **even with `?debug`**.
- 8b. DevTools → Sources / Network → inspect `index-*.js`. Search
      the file for `DEBUG_VIEWER` and `debugMode`.
      Expect: zero matches in both.

If any step fails, STOP and fix before committing.

---

## After Completing

Every item must be true. DCE verification appears twice in this
checklist because it is the single most important guarantee of
EC-104 — anyone reviewing the commit should be able to confirm it
from the diff + `dist/` inspection alone.

- [ ] Verification steps 1–6 all pass
- [ ] Manual DEV smoke (7a–7e) passes
- [ ] **Manual PROD smoke (8a–8b) passes — DCE verified**
- [ ] Prod bundle `grep` for `DEBUG_VIEWER` / `debugMode` returns
      zero matches
- [ ] Bundle size within tolerance (JS ≤ 184 KB raw, CSS ≤ 27 KB raw)
- [ ] Lint warning count ≤ 180
- [ ] No file outside §Files to Produce modified
- [ ] `EC_INDEX.md` has EC-104 flipped Draft → Done + Last updated
      bumped (landed in the EC-104 execution commit, not a follow-up)
- [ ] Commit prefix `EC-104:`; hook passes without `--no-verify` or
      `--no-gpg-sign`
- [ ] All `// why:` comments from §Required Comments present

---

## Common Failure Smells

- **DCE did not strip debug paths** — prod bundle still contains
  `DEBUG_VIEWER`. Usual cause: operand order reversed in
  `src/lib/debugMode.ts` (URLSearchParams first). Fix the order;
  rebuild; re-grep.
- **Adding a tab widget to HealthPanel** — scope creep. The debug
  surface is a conditional `<div>`, not a tab. If CSS layout nudges
  you toward tabs, push back: HealthPanel is a narrow modal with
  vertical sections, not a dashboard.
- **Duplicating state in `App.vue` for `debugState`** — wrong. Pass
  existing refs via the prop (inline object literal preferred; single
  presentational `computed` allowed). No new domain refs, no watchers.
- **New child component for the debug section** — explicit
  governance failure. The conditional `<div>` must live inside
  `HealthPanel.vue` itself; do not add `DebugSection.vue`,
  `<DebugFields>`, or slot-based indirection.
- **`no-console` rule surfaces errors in `App.vue` or components** —
  Pre-Exec inventory missed a stray `console.log`. STOP and report;
  do not silently clean up other files.
- **`devLog` signature change breaks `CardGrid.vue` silently** —
  TypeScript will catch it; if you see a red squiggle, update the
  call site in the same commit. Do not add a compatibility shim.
- **Logging full card / theme payloads** — blows up the console and
  leaks data shape. Stick to counts, durations, and 3-sample IDs.
- **Using `import.meta.env.DEV` outside `src/lib/debugMode.ts`** —
  defeats the single-source-of-truth rule. Route through
  `DEBUG_VIEWER`.
- **Commit prefix `INFRA:` or `SPEC:` with `apps/` files staged** —
  hook blocks. Use `EC-104:`.
- **Forgetting to stage `EC_INDEX.md`** — commit will technically
  pass but EC-104 stays Draft in the index. Must land in the same
  commit per §Files to Produce.

---
