# WP-096 — Registry Viewer: Grid Data View Mode

**Status:** Draft (authored 2026-04-24; awaiting user review and lint-gate sign-off)
**Primary Layer:** Client UI (`apps/registry-viewer/`)
**Dependencies:**
- **Hard:** WP-066 (image-to-data view toggle — established `useCardViewMode`,
  `ViewModeToggle.vue`, `CardDataDisplay.vue`, and the `localStorage`
  `cardViewMode` key that this packet extends to a second consumer).
- **Hard:** WP-003 (CardRegistry + `FlatCard` type — the data shape rendered
  in tile-mode).
- **Soft:** WP-094 (sibling registry-viewer single-component fix — pattern
  reference only; no contract dependency).
- **Compatible with (not dependent on):** WP-086 (queued registry viewer
  card-types upgrade — touches the same component surface but on a
  different axis; merge order does not matter).

---

## Session Context

WP-066 / EC-066 shipped a global view-mode toggle on the registry viewer
(public host: `cards.barefootbetters.com`), allowing users to switch
between an image view (default) and a structured data view. The
implementation only modified `App.vue` and `CardDetail.vue` (the
right-hand sidebar). `CardGrid.vue` (the main grid that renders the
full card list) was not touched. As a result, toggling to data view
today only changes the sidebar; the main grid continues to render
image tiles regardless of the toggle state.

A user reported the gap on 2026-04-24: the toggle works for the
selected card in the sidebar, but was expected to govern the main
grid as well.

The shared `useCardViewMode` composable in
`apps/registry-viewer/src/composables/useCardViewMode.ts` is already
module-scoped and exposes a single source of truth. Wiring the grid to
the same composable is mechanically straightforward; the design work
is deciding what a tile-sized data card looks like so that the grid
layout (fixed-aspect, ~130px-min columns) remains stable when the
toggle is flipped. This packet locks that design and applies it.

The WP-066 post-mortem at
`docs/ai/post-mortems/01.6-WP-066-registry-viewer-data-toggle.md`
confirms WP-066 was deliberately scoped to the sidebar — its
`CardGrid.vue` exclusion was an explicit EC-066 §Guardrails item
("CardGrid.vue NOT modified — do NOT touch unless necessary"), not
an oversight. The user-visible bug is the gap between that deliberate
scope and the public-facing "global toggle" framing the user expected:
a toggle labelled "Data view" / "Image view" implies coverage of the
main grid, not just the sidebar. WP-096 is the corrective follow-up
that wires the grid to the existing composable. No part of the WP-066
acceptance criteria is rolled back; this packet adds a second consumer
of the same composable.

---

## Goal

After this session:

- The `cardViewMode` toggle in `apps/registry-viewer/` controls **both**
  the sidebar and the main grid.
- Flipping the toggle re-renders every visible card tile in the grid
  into a compact structured-data presentation; flipping back restores
  the image tiles.
- The grid's column layout, tile dimensions, and selection / hover /
  scroll-into-view behavior are byte-identical between the two modes —
  only the inside-tile content differs.
- `CardDataDisplay.vue` (sidebar) is unchanged; the new tile-sized
  data view lives in a new sibling component `CardDataTile.vue` whose
  locked field set is documented in this WP and EC-096.
- The `localStorage` key (`cardViewMode`), persistence semantics,
  self-heal narrowing, and the composable public API
  (`{ viewMode, toggleViewMode }`) are unchanged.

---

## Assumes

- WP-066 complete: `apps/registry-viewer/src/composables/useCardViewMode.ts`
  exports
  `useCardViewMode(): { viewMode: Ref<'image' | 'data'>; toggleViewMode: () => void; }`
  and is module-scoped.
- WP-066 complete: `apps/registry-viewer/src/components/ViewModeToggle.vue`
  exists and is mounted in `App.vue`.
- WP-066 complete: `apps/registry-viewer/src/components/CardDataDisplay.vue`
  exists and renders `FlatCard` data with AND-semantics (omit empty /
  null / absent fields entirely).
- WP-003 complete: `FlatCard` is exported from
  `apps/registry-viewer/src/registry/browser.ts` and includes the
  fields named in §Locked Values.
- `apps/registry-viewer/src/components/CardGrid.vue` exists and
  renders cards via `v-for` keyed on `card.key`, with a single tile
  button per card containing `.img-wrap` and `.tile-info` blocks.
- `pnpm --filter registry-viewer build` exits 0 on `main` pre-session.
- `pnpm --filter registry-viewer typecheck` exits 0 on `main`
  pre-session.

If any of the above is false, this packet is **BLOCKED** and must
not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` —
  registry-viewer's allowed import surface and the prohibition on
  reaching into `game-engine`, `preplan`, `server`, or `pg`.
- `.claude/rules/architecture.md §Layer Boundary` — the runtime
  enforcement view of the same rules.
- `apps/registry-viewer/CLAUDE.md` — viewer architecture (Vue 3 +
  Vite 5 + Zod), single-page tab switching, R2 data source.
- `apps/registry-viewer/src/components/CardGrid.vue` — the file to
  be modified. Read template and `<style scoped>` block fully; tile
  dimensions and grid columns are load-bearing for visual continuity.
- `apps/registry-viewer/src/components/CardDataDisplay.vue` — the
  sidebar data view; the new `CardDataTile.vue` is a tile-sized
  cousin and must reuse its display labels and AND-semantics rule
  for byte-consistent terminology between sidebar and grid.
- `apps/registry-viewer/src/composables/useCardViewMode.ts` —
  module-scoped composable; do not extend its public API. Read the
  JSDoc explaining why `setViewMode` is intentionally absent.
- `apps/registry-viewer/src/registry/browser.ts` — `FlatCard` type
  export. The locked field set in §Locked Values draws only from
  fields present on `FlatCard` today.
- `docs/ai/REFERENCE/00.6-code-style.md` — human-style code rules:
  Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 11
  (full-sentence error messages), Rule 13 (ESM only), Rule 14 (field
  names match data contract).
- `docs/ai/post-mortems/01.6-WP-066-registry-viewer-data-toggle.md` —
  records that WP-066 deliberately excluded `CardGrid.vue` per EC-066
  §Guardrails. The user-visible expectation gap (toggle expected to
  govern the grid, not just the sidebar) is what WP-096 corrects.
- `docs/ai/DECISIONS.md` — scan the D-66xx range for any prior
  decisions on the toggle's UX semantics; the new D-9601 entry must
  not contradict them.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+ — all new files use `import`/`export`, never
  `require()`.
- `node:` prefix on all Node.js built-in imports (not applicable in
  scope — browser code only; if any `node:` import appears, it is a
  scope violation).
- Test files use `.test.ts` extension — never `.test.mjs` (not
  applicable in scope — no tests added).
- Full file contents required for every new or modified file. Diffs,
  snippets, and partial output are forbidden.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full
  English names, JSDoc on every function, no `.reduce()` for
  branching logic, comments explain WHY).
- No `Math.random()` and no `Date.now()` in any new or modified file.
- No new npm dependencies. `package.json` files are unchanged.

**Packet-specific:**
- **Composable contract is frozen.** `useCardViewMode` exports
  exactly `{ viewMode, toggleViewMode }`. Do not add `setViewMode`,
  do not rename anything, do not change the localStorage key
  (`'cardViewMode'`) or its persisted values (`'image'` | `'data'`).
- **Production/UI files limited to two.** Only
  `apps/registry-viewer/src/components/CardGrid.vue` is modified;
  only `apps/registry-viewer/src/components/CardDataTile.vue` is
  created. Governance files (STATUS, DECISIONS, WORK_INDEX,
  EC_INDEX, the WP and EC themselves) are updated per §Files
  Expected to Change and §Definition of Done.
- **No prop plumbing through `App.vue`.** `CardGrid.vue` reads from
  `useCardViewMode()` directly. The grid does **not** receive a
  `view-mode` prop; the composable is the source of truth.
- **Tile dimensions preserved byte-exact.** The `.card-tile` outer
  dimensions, the `.img-wrap` 3:4 aspect ratio swap area, the grid
  column track (`grid-template-columns: repeat(auto-fill,
  minmax(130px, 1fr))`), and the `.tile-info` footer block render
  the same in both modes. Data mode replaces the **inside** of the
  3:4 area only.
- **Conditional placement is inside `.img-wrap`.** `.img-wrap`
  itself stays in the DOM in both modes; the `viewMode` branch
  lives inside it. This guarantees CSS selectors, sizing, and any
  background/border rules attached to `.img-wrap` continue to apply
  in data mode without re-derivation.
- **Data tile must fit the existing 3:4 box.** `CardDataTile.vue`
  root element is sized `width: 100%; height: 100%;` with overflow
  controlled (`overflow: hidden;` or equivalent). Do not change
  column tracks or aspect ratios to compensate for content overflow.
- **Field set locked.** The data tile renders only the fields named
  in §Locked Values. Fields absent on `FlatCard` are not added or
  stubbed.
- **AND-semantics for empty fields.** Empty / null / `undefined` /
  empty-string fields are omitted entirely. No em-dash, no "—", no
  placeholder. Matches `CardDataDisplay.vue` byte-for-byte on guard
  forms.
- **Display labels match the sidebar on the six common rows;
  one row diverges by design.** Six of the seven labelled rows
  (`Type`, `Class`, `Cost`, `Attack`, `Recruit`, `Rarity`) are
  byte-identical to `CardDataDisplay.vue`. The seventh row uses
  the compact label `Set` rendering `card.setAbbr`; the sidebar
  at `CardDataDisplay.vue:78` uses `Edition` rendering
  `card.setName` with `setAbbr` parenthesized. The divergence is
  a deliberate tile-compaction choice — the 130px-min `.img-wrap`
  cannot accommodate full set names like "Marvel Studios: What
  If…?" without ellipsis defenses or grid-column reflow.
  Captured under D-9601. Value formatting (e.g., capitalization,
  casing) is performed exactly the same way the sidebar performs
  it; if the sidebar uses a CSS class
  (`text-transform: capitalize`) on its `<dd>`, the tile uses the
  same CSS class on its equivalent element. No new formatting
  helpers are introduced.
- **Required `// why:` comments** on:
  - The `useCardViewMode()` import line in `CardGrid.vue` —
    explain the composable is the single source of truth across the
    app and why the grid does not take a `view-mode` prop.
  - The conditional render block (`<template v-if="viewMode ===
    'data'">` / `v-else`) inside `.img-wrap` — explain that the
    swap is constrained to inside the 3:4 area, that the
    `.tile-info` footer renders unconditionally in both branches,
    and that this preserves the grid column track and tile
    dimensions byte-identically.
  - `CardDataTile.vue` module-header JSDoc — explain that this is
    the grid-tile cousin of `CardDataDisplay.vue`, that the field
    set is locked at WP-096 / EC-096 ratification, that ability
    text is intentionally omitted, that six of the seven labelled
    rows are byte-identical to the sidebar, and that the `Set` /
    `setAbbr` row is the deliberate tile-compaction divergence
    captured under D-9601.
  - `CardDataTile.vue` numeric guard on `cost` — explain why the
    guard is `!== undefined && !== null` rather than truthiness
    (`v-if="card.cost"` would hide a legitimate zero-cost card).
  - `CardDataTile.vue` `attack` / `recruit` empty-string guard —
    explain that source data may carry `''` for these fields.
- **No layer leaks.** Allowed imports in either file: Vue, types
  from `../registry/browser`, the local composable
  (`../composables/useCardViewMode`), the new sibling component
  (`./CardDataTile.vue`). Disallowed: the Node-bearing
  `@legendary-arena/registry` barrel (narrow Zod-schema subpaths
  such as `@legendary-arena/registry/schema` are permitted by the
  layer rule but not needed in this scope); `@legendary-arena/game-engine`;
  `@legendary-arena/preplan`; `@legendary-arena/server`; `pg`;
  `boardgame.io`; any `node:` built-in. Per
  `apps/registry-viewer/CLAUDE.md` and `.claude/rules/architecture.md`
  §Import Rules — the registry barrel pulls Node-only modules into
  the Rollup graph; subpaths do not.
- **No tests added.** The viewer has no Vue component-test harness
  configured at baseline. Verification is build + typecheck +
  manual smoke. Adding a component-test harness is a separate WP.

**Session protocol:**
- If any of the following arises, STOP and ASK before proceeding:
  the tile-mode field set seems to need a field not on `FlatCard`
  today; the grid column track seems to need to change to fit data
  content; the toggle state seems to need a third value beyond
  `'image'` and `'data'`; any file outside §Files Expected to
  Change seems to need editing. Do not "helpfully" extend scope.

**Locked contract values (inline — do not paraphrase or re-derive):**

- **Toggle modes (verbatim):** `'image'` and `'data'`.
- **localStorage key (verbatim):** `'cardViewMode'`.
- **Composable public API (verbatim):**
  `{ viewMode: Ref<'image' | 'data'>; toggleViewMode: () => void; }`.
- **Composable destructure in `CardGrid.vue` (verbatim):**
  `const { viewMode } = useCardViewMode();`
- **Composable import path (verbatim):**
  `from "../composables/useCardViewMode"`.
- **`CardDataTile` import path (verbatim):**
  `from "./CardDataTile.vue"`.
- **Locked field set on `CardDataTile.vue`** (rendered in this
  order, each under AND-semantics omission):
  1. `name` — heading, no labelled row.
  2. `cardType` — label `Type`.
  3. `setAbbr` — label `Set`. **Deliberate divergence from sidebar
     (`CardDataDisplay.vue:78` uses `Edition` on `setName` with
     `setAbbr` parenthesized).** Tile-compaction rationale captured
     under D-9601 — the 130px-min `.img-wrap` cannot accommodate
     full set names without ellipsis defenses or grid reflow.
  4. `hc` — label `Class`.
  5. `cost` — label `Cost`.
  6. `attack` — label `Attack`.
  7. `recruit` — label `Recruit`.
  8. `rarityLabel` (preferred) or `rarity` (fallback) — label `Rarity`.
- **AND-semantics guards (verbatim, matching `CardDataDisplay.vue`):**
  - Strings: `v-if="card.X"`.
  - Numbers (may legitimately be `0`):
    `v-if="card.X !== undefined && card.X !== null"`.
  - `attack` / `recruit` (may be empty string in source data):
    `v-if="card.X !== undefined && card.X !== null && card.X !== ''"`.
- **Abilities omission:** ability text is **NOT rendered on the
  tile** in this packet. The sidebar continues to be the place to
  read full ability text.

---

## Vision Alignment

**Vision clauses touched:** §10a (Registry Viewer public surface —
search and browse quality on `cards.barefootbetters.com`).

**Conflict assertion:** No conflict. This WP completes the
"global toggle" intent of WP-066 by extending its existing public
behavior to the grid surface.

**Non-Goal proximity check:** None of NG-1..7 is crossed. The
registry viewer is free public tooling; this packet adds no
monetization, no persuasive surfaces, no competitive ranking
implications.

**Determinism preservation:** N/A — no scoring, replay, RNG, or
simulation surfaces are touched. The view-mode toggle is a UI-only
client-local state read from `localStorage`.

---

## Debuggability & Diagnostics

This packet is UI-only and introduces no game state, no RNG, and no
mutation of `G` / `ctx`. The template's reproducibility and replay
clauses are therefore largely N/A; the items below are the
applicable subset adapted for client UI scope.

- **Deterministic reproduction:** the toggle's effect on the grid
  is fully determined by `localStorage['cardViewMode']` and the
  `FlatCard` data fed to `CardGrid.vue`. Identical storage value +
  identical card list = identical render. No timer, no animation
  state, no RNG.
- **External observability:** the toggle's effect is visible in the
  rendered DOM (image tiles vs data tiles) and in
  `document.querySelector('.view-mode-toggle')[aria-pressed]`. No
  hidden side effects.
- **State mutation surface:** the only state read is the
  module-scoped `viewMode` ref inside `useCardViewMode`. The only
  state written is the same ref via the existing `toggleViewMode`
  function. No new state is introduced by this packet.
- **Invariants after execution:** the composable's public API
  (`{ viewMode, toggleViewMode }`) and persisted localStorage shape
  (`'image'` | `'data'`) are byte-identical pre- and post-packet.
  No cross-packet state is mutated outside declared scope.
- **Failure localization:** any visible regression in the grid
  must trace to one of the two production files in §Files Expected
  to Change; if it does not, the packet's scope was violated.
- **`G.messages` usage:** N/A — this packet does not touch `G`.

---

## Scope (In)

### A) `apps/registry-viewer/src/components/CardGrid.vue` — modified

- Import `useCardViewMode` from `../composables/useCardViewMode`
  and destructure `viewMode` only (the toggle function is invoked
  by `ViewModeToggle.vue`; the grid is read-only).
- Import `CardDataTile` from `./CardDataTile.vue`.
- Inside the existing `v-for` tile button, keep `.img-wrap` in the
  DOM in both modes. Inside `.img-wrap`, branch the rendered
  content on `viewMode`:
  - **Image mode (`viewMode === 'image'`):** existing image and
    type-badge content renders unchanged.
  - **Data mode (`viewMode === 'data'`):** render
    `<CardDataTile :card="card" />` in the same `.img-wrap` box.
- The `.tile-info` footer block renders unconditionally in both
  modes; no template, structural, or style change to it.
- Add the `// why:` comments named in §Non-Negotiable Constraints.

### B) `apps/registry-viewer/src/components/CardDataTile.vue` — new

- Vue 3 SFC, `<script setup lang="ts">`, scoped CSS.
- Module-header JSDoc explaining: grid-tile cousin of
  `CardDataDisplay.vue`; locked field set; AND-semantics; ability
  text intentionally omitted; six of the seven labelled rows match
  the sidebar byte-for-byte; the `Set` / `setAbbr` row is the
  deliberate tile-compaction divergence captured under D-9601.
- Defines exactly one prop: `defineProps<{ card: FlatCard }>()`.
  No emits.
- Renders the eight locked fields named in §Locked Values, in the
  listed order, each guarded by `v-if` AND-semantics. Six of the
  seven labelled rows (`Type`, `Class`, `Cost`, `Attack`, `Recruit`,
  `Rarity`) match `CardDataDisplay.vue` byte-for-byte; the `Set`
  row uses `setAbbr` (not `setName`/`Edition`) per §Locked Values
  and D-9601.
- Root element sized `width: 100%; height: 100%;` with overflow
  controlled to fit inside the existing `.img-wrap` 3:4 box.
- Uses the same dark-theme local literal color tokens already in
  use by registry-viewer components (`#1a1a24` / `#d8d8ee` /
  `#6666aa` family). No new shared color module is extracted.
- Includes a `@media print` block (white background, black text,
  hairline border) mirroring the printability rule established by
  `CardDataDisplay.vue`.

---

## Out of Scope

- No changes to `useCardViewMode.ts`, `ViewModeToggle.vue`,
  `CardDataDisplay.vue`, `App.vue`, `CardDetail.vue`, or any
  composable, utility, or theme module.
- No changes to the toggle's `localStorage` key, persisted values,
  or self-heal narrowing.
- No changes to the grid column track (`minmax(130px, 1fr)`),
  tile-aspect ratio (3:4), or any `.card-tile` / `.tile-info`
  dimensions.
- No new fields on `FlatCard`. The "contract-aware placeholder"
  fields documented in `CardDataDisplay.vue` JSDoc
  (`victoryPoints`, `recruiterText`, `attackerText`) are NOT
  surfaced on the tile in this packet; they remain absent.
- No new `useCardViewMode` consumers beyond `CardGrid.vue` in this
  packet (e.g., `LoadoutBuilder.vue`, `ThemeGrid.vue`,
  `ThemeDetail.vue` are not wired). A future WP may extend the
  toggle's reach; this one does not.
- No new tests, no new test harness, no new test config.
- No keyboard-shortcut binding for toggle (an EC-103 a11y
  follow-up, not this packet).
- No tooltip / glossary integration on the data tile.
- No changes to `packages/registry/**`, `packages/game-engine/**`,
  `apps/server/**`, `apps/arena-client/**`. Registry-viewer
  internal only.
- Refactors, cleanups, or "while I'm here" improvements are
  **out of scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

**Production / UI (scope-limited):**

- `apps/registry-viewer/src/components/CardGrid.vue` — **modified**
  — consume `useCardViewMode`, branch tile swap-area on `viewMode`,
  import and render `CardDataTile` in data mode. Add the required
  `// why:` comments.
- `apps/registry-viewer/src/components/CardDataTile.vue` — **new**
  — compact tile-sized data card under the locked field set and
  AND-semantics rule, with print parity.

**Governance (required by Definition of Done):**

- `docs/ai/STATUS.md` — **modified** — one-line capability note
  recording the grid now respects `cardViewMode`, and citing the
  WP-066 → WP-096 corrective-follow-up relationship.
- `docs/ai/DECISIONS.md` — **modified** — add `D-9601` entry
  capturing locked field set, composable-vs-prop choice,
  AND-semantics parity rationale, ability-text omission rationale,
  and the `Set` / `setAbbr` tile-compaction divergence from the
  sidebar's `Edition` / `setName` pattern.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — register
  WP-096 in the appropriate section and check it off `[x]` with
  today's date and the executing commit hash.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** —
  register EC-096 row with status `Done <date>` and a one-line
  scope description matching this WP.

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### A) `CardGrid.vue` wiring
- [ ] Imports `useCardViewMode` from
      `../composables/useCardViewMode` and destructures `viewMode`
      only (no other names from the composable are pulled in).
- [ ] Imports `CardDataTile` from `./CardDataTile.vue`.
- [ ] `.img-wrap` remains in the DOM in both modes; the `viewMode`
      conditional lives inside it.
- [ ] In image mode, `.img-wrap` content (image + type-badge) is
      unchanged from baseline.
- [ ] In data mode, `.img-wrap` renders `<CardDataTile :card />`
      and nothing else.
- [ ] `.tile-info` footer renders unconditionally in both modes,
      structurally and stylistically unchanged from baseline.

### B) `CardDataTile.vue` shape
- [ ] Exists at `apps/registry-viewer/src/components/CardDataTile.vue`.
- [ ] Uses `<script setup lang="ts">` and scoped CSS.
- [ ] Defines exactly one prop: `card: FlatCard`. Emits no events.
- [ ] Renders the eight locked fields in §Locked Values order,
      each guarded by AND-semantics.
- [ ] Display labels for six of the seven labelled rows (`Type`,
      `Class`, `Cost`, `Attack`, `Recruit`, `Rarity`) are
      byte-identical to `CardDataDisplay.vue`. The seventh row
      uses the compact label `Set` rendering `card.setAbbr` —
      deliberate tile-compaction divergence per §Locked Values
      and D-9601 (sidebar uses `Edition` on `setName`).
- [ ] Root element sized `width: 100%; height: 100%;` with overflow
      controlled — fits inside the `.img-wrap` 3:4 box without
      reflowing the grid.
- [ ] Includes `@media print` block (white bg, black text, hairline
      border).

### C) Layer & scope enforcement
- [ ] Neither file imports `boardgame.io`,
      `@legendary-arena/game-engine`, `@legendary-arena/preplan`,
      `@legendary-arena/server`, `pg`, or any `node:` built-in.
- [ ] Only files listed in §Files Expected to Change are
      modified/created (confirmed with `git diff --name-only`).

### D) Build & manual smoke
- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] Manual smoke (Verification Step 5) confirms the toggle flips
      the entire grid, selection survives the flip, and no Vue
      console warnings appear in either toggle direction.

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter registry-viewer build
# Expected: exits 0, no TypeScript errors

# Step 2 — typecheck
pnpm --filter registry-viewer typecheck
# Expected: exits 0

# Step 3 — confirm composable contract is unchanged
git diff apps/registry-viewer/src/composables/useCardViewMode.ts
# Expected: no output

# Step 4 — confirm sidebar files are unchanged
git diff apps/registry-viewer/src/components/CardDataDisplay.vue
git diff apps/registry-viewer/src/components/CardDetail.vue
git diff apps/registry-viewer/src/components/ViewModeToggle.vue
git diff apps/registry-viewer/src/App.vue
# Expected: no output for any of the four

# Step 5 — manual smoke
# Terminal: pnpm --filter registry-viewer dev
# Open the viewer at the local dev URL printed by Vite, Cards tab.
#   a. Default: grid renders image tiles. Toolbar reads "Data view".
#   b. Click toggle. Toolbar reads "Image view" (aria-pressed='true').
#      Every grid tile re-renders as a data card. Column count and
#      outer tile dimensions are visually unchanged.
#   c. Click a card. Sidebar opens in data mode (already shipped in
#      WP-066). The selected tile's `.selected` border glow renders.
#   d. Click toggle again. Tiles revert to image mode in one frame;
#      selection persists; sidebar flips back to image mode.
#   e. Reload after leaving toggle on "Image view" (data mode).
#      Confirm grid renders data tiles on first paint.
#   f. Apply a search filter, then toggle. Filter remains applied.
#   g. DevTools console: no Vue warnings, no missing-key warnings,
#      no prop-type warnings on either toggle direction.
#   h. Print preview in data mode: tiles render with white
#      background, black text, hairline border.

# Step 6 — confirm scope
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
#   apps/registry-viewer/src/components/CardGrid.vue
#   apps/registry-viewer/src/components/CardDataTile.vue
#   docs/ai/STATUS.md
#   docs/ai/DECISIONS.md
#   docs/ai/work-packets/WORK_INDEX.md
#   docs/ai/execution-checklists/EC_INDEX.md
#   docs/ai/work-packets/WP-096-registry-viewer-grid-data-view.md
#   docs/ai/execution-checklists/EC-096-registry-viewer-grid-data-view.checklist.md
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All Acceptance Criteria pass.
- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] Manual smoke (Verification Step 5, sub-steps a–h) passes
      end-to-end.
- [ ] No files outside §Files Expected to Change were modified
      (confirmed with `git diff --name-only`).
- [ ] `docs/ai/STATUS.md` updated — grid now respects
      `cardViewMode`; cites WP-066 → WP-096 relationship.
- [ ] `docs/ai/DECISIONS.md` updated — `D-9601` entry capturing
      locked field set, composable-vs-prop choice, AND-semantics
      parity, ability-text omission rationale, and the
      `Set` / `setAbbr` tile-compaction divergence from sidebar
      `Edition` / `setName`.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-096 registered
      and checked off `[x]` with today's date and commit hash.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-096 row
      with status `Done <date>` and a one-line scope description.
- [ ] Commit message uses `EC-096:` prefix per
      `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`.
- [ ] Post-mortem at
      `docs/ai/post-mortems/01.6-WP-096-registry-viewer-grid-data-view.md`
      authored if any in-execution fix or scope amendment was
      applied; otherwise OPTIONAL per WP-030 precedent.
