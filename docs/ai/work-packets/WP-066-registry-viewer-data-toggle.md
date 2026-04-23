# WP-066 — Registry Viewer: Card Image-to-Data Toggle

**Status:** Ready
**Primary Layer:** Client UI (Vue 3 SPA — `apps/registry-viewer/`)
**Dependencies:** None (registry viewer is independent; existing codebase functions)

---

## Session Context

The registry viewer (`apps/registry-viewer/`) is an established standalone
Vue 3 SPA that displays Legendary card metadata loaded from R2. Currently,
it renders cards in a grid with a detail panel showing images via `CardGrid.vue`
and `CardDetail.vue`. This packet adds the ability to toggle between image view
(current behavior) and a structured data view that mirrors the layout of
www.master-strike.com, allowing users to inspect raw card attributes without
relying on images.

---

## Goal

After this session, `apps/registry-viewer/` exposes a global view-mode toggle
(accessible from the main toolbar) that switches all card displays between:

1. **Image Mode** (default, current behavior): renders card images via
   ImageLightbox and full card art in the detail panel
2. **Data Mode**: renders a structured card data table showing all card
   attributes (cost, attack, recruit, effect text, edition, rarity, etc.)
   in a readable, printable format organized by logical sections

The toggle is persisted in `localStorage` under the key `cardViewMode`
(values: `'image'` | `'data'`), so the user's preference persists across
page reloads. Both modes use the same underlying `FlatCard` data; no new
data is required. The switch affects `CardGrid.vue`, `CardDetail.vue`,
and the display of individual card items when selected.

---

## Assumes

- `apps/registry-viewer/` builds and runs without errors
  (`pnpm --filter registry-viewer dev` and `pnpm --filter registry-viewer build`)
- `FlatCard` type is fully available with all attributes needed for display
  (from `src/registry/browser.ts`)
- Vue 3 Composition API is the standard pattern (as seen in existing
  components: `App.vue`, `CardDetail.vue`, `CardGrid.vue`)
- `localStorage` is available (web browser environment)
- No external dependencies will be added; use only Vue 3 built-ins and
  existing project tooling (Tailwind CSS for styling if used elsewhere,
  or plain CSS)

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `apps/registry-viewer/src/App.vue` — understand the current component
  hierarchy, state management pattern, and how `selectedCard` is passed to
  detail panels. Read the entire file.
- `apps/registry-viewer/src/components/CardDetail.vue` — the detail panel
  that currently renders the card image. Understand how it receives the card
  and renders zones.
- `apps/registry-viewer/src/components/CardGrid.vue` — the grid display.
  Understand how individual cards are rendered and selected.
- `apps/registry-viewer/src/registry/browser.ts` — confirm the exact fields
  available on `FlatCard` (cost, attack, recruit, recruiterText, attackerText,
  victoryPoints, type, subtypes, team, heroClass, rarity, edition, etc.).
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules:
  - Rule 4: no abbreviations (use full English words)
  - Rule 6: `// why:` comments for non-obvious state or logic
  - Rule 13: ESM only, `import` statements with `node:` prefix for Node built-ins
  - Rule 14: field name clarity; use exact property names from data contracts
- www.master-strike.com — browse the site to understand how card data is
  currently displayed (table layout, grouping of attributes, how ability text
  is shown, etc.). Take screenshots or notes on the layout structure for
  reference during coding.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+ — all files use `import`/`export`, never `require()`
- Vue 3 Composition API only; no Vue 2 Options API
- No new npm dependencies (reuse existing Tailwind, Bootstrap, or plain CSS)
- `localStorage` keys must be namespaced: `cardViewMode`; do not pollute global
  namespace
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: explicit variable
  names, no clever ternaries or nested logic, readable to a junior developer

**UI-specific:**
- The view-mode toggle must be a visible, accessible control (button or
  switch) in the toolbar or header area of `App.vue`
- Both modes must work seamlessly with the existing card search, filter, and
  selection logic — toggling view mode must NOT reset selected card or break
  filtering
- Card data in data-view mode must display all `FlatCard` properties that are
  non-empty/non-null. Null or empty fields must be omitted or marked as "—"
  (em-dash).
- The data view must be **printable**: users should be able to right-click
  "Print" and get a clean PDF of visible cards with all attributes
- Both views must render the same selected card in the detail panel — switching
  view mode with a card selected should show the same card in the new view

**Locked card attributes (inline — do not re-derive; delete rows that do not
apply):**
- **FlatCard required fields:** `id`, `name`, `type` (hero|mastermind|villain|henchman|scheme|bystander|wound|location|other)
- **FlatCard optional numeric/string fields:** `cost`, `attack`, `recruit`,
  `victoryPoints`, `recruiterText`, `attackerText`, `team`, `heroClass`, `type`,
  `subtypes`, `rarity`, `edition`, `abilityText`
- **Field display names (use exactly as specified):**
  - `cost` → "Cost"
  - `attack` → "Attack"
  - `recruit` → "Recruit"
  - `victoryPoints` → "Victory Points" (abbreviated "VP" in some UIs)
  - `recruiterText` → "Recruiting Effect" or "Recruitment"
  - `attackerText` → "Attack Effect" or "Combat"
  - `abilityText` → "Ability" or "Card Text"
  - `heroClass` → "Class"
  - `team` → "Team"
  - `rarity` → "Rarity"
  - `edition` → "Edition" (refers to set or expansion; confirm field name)
  - `name` → "Name"
  - `type` → "Type"

---

## Deliverables

### New Components

1. **`src/components/ViewModeToggle.vue`** — button/switch component that
   toggles between image and data view modes. Reactive state is `viewMode`
   (ref). On change, update `localStorage` and emit an event or update a
   shared composable.

2. **`src/components/CardDataDisplay.vue`** — structured card data display
   showing all non-null attributes in a clean table or card-attribute format.
   Alternative to `CardDetail.vue`'s image display. Used when `viewMode === 'data'`.

### Modifications

1. **`src/App.vue`** — add the view-mode toggle to the toolbar/header; manage
   global state for `viewMode` (read from `localStorage` on mount); pass
   `viewMode` as a prop to components that need to switch behavior.

2. **`src/components/CardDetail.vue`** — conditionally render either the image
   display (current) or the data display based on `viewMode`. Both branches
   show the same `card` prop; only presentation changes.

3. **`src/components/CardGrid.vue`** — optionally adjust individual card item
   rendering when in data mode (e.g., show a small data preview instead of
   only the image thumbnail). If no change is needed, this file may remain
   untouched.

### Styling

- Use existing project styling conventions (Tailwind if already in use, or
  plain CSS in scoped `<style>` blocks)
- Data view table must be clean, readable, and professional
- Ensure good contrast and accessibility (WCAG AA minimum)
- Data view must render correctly in both light and dark themes (if applicable)

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via:

1. **View-mode toggle state:** users can verify the toggle is working by
   opening browser DevTools → Application → Local Storage and confirming
   `cardViewMode` changes when the toggle is clicked
2. **Component rendering:** Vue DevTools should show the conditional logic
   working correctly in `CardDetail.vue` and children
3. **No data loss:** selecting a card, toggling view mode, and then returning
   to the original mode should restore the same card with no state corruption

The following invariants must always hold:

- `localStorage.cardViewMode` must always be either `'image'` | `'data'` (or
  undefined on first visit, defaulting to `'image'`)
- Toggling view mode must not modify `selectedCard`, `filteredCards`,
  `searchText`, `filterSet`, or any other filtering state
- All `FlatCard` fields rendered in data mode must be sourced directly from
  the card object, not inferred or derived
- The data view must not throw errors when rendering cards with null or
  missing optional fields

---

## Implementation Notes

### Data View Layout Suggestion

The data view should present card attributes in a clear structure. Example
layout (adapt as needed for design preferences):

```
[Card Image or Icon]
Name: <card name>
Set: <edition>
Type: <type>

Cost: <cost>
Attack: <attack>
Recruit: <recruit>
Victory Points: <vp>

Team: <team>
Class: <hero class>
Rarity: <rarity>

[Ability Text / Card Text]
<full ability text, formatted nicely>

[Attack Effect]
<attack effect text if present>

[Recruit Effect]
<recruit effect text if present>
```

Organize logically into sections (resource costs, abilities, metadata, set info).

### localStorage Persistence

**Key:** `cardViewMode`
**Values:** `'image'` | `'data'`
**Default:** `'image'` (if not set, use image mode)

On app mount, read the value and set the reactive `viewMode` ref. On toggle,
update `localStorage` immediately.

### Composable Option

Consider creating a `useCardViewMode()` composable for centralized view-mode
logic:

```typescript
export function useCardViewMode() {
  const viewMode = ref<'image' | 'data'>(/* read from localStorage */);
  
  function toggleViewMode() {
    viewMode.value = viewMode.value === 'image' ? 'data' : 'image';
    localStorage.setItem('cardViewMode', viewMode.value);
  }
  
  return { viewMode, toggleViewMode };
}
```

This keeps view-mode logic in one place and makes it reusable across components.

---

## Definition of Done

This packet is complete when:

- [ ] `ViewModeToggle.vue` component is created with a clear visual toggle
      (button or switch) and persists state to `localStorage`
- [ ] `CardDataDisplay.vue` component is created, renders all non-empty card
      attributes in a clean, organized layout
- [ ] `App.vue` manages the global `viewMode` state and passes it to detail
      and grid components
- [ ] `CardDetail.vue` conditionally renders image view or data view based on
      `viewMode`
- [ ] Toggling view mode does NOT reset selected card, search filters, or
      other app state
- [ ] View preference persists across page reloads via `localStorage`
- [ ] Data view displays printable card information (verified manually via
      browser print preview)
- [ ] Both view modes work correctly with all existing card search, filter, and
      selection features
- [ ] No TypeScript errors or ESLint violations (`pnpm run typecheck` and
      `pnpm run lint` pass)
- [ ] Code follows `docs/ai/REFERENCE/00.6-code-style.md` conventions

---

## Post-Execution Clarification (appended 2026-04-22)

> **Status:** WP-066 executed and closed on 2026-04-22 at commit `8c5f28f`.
> This appendix is **not** a pre-execution amendment. It is a historical
> clarification that flags ambiguities in the pre-execution WP text above,
> records where each ambiguity was actually resolved, and documents a
> factual-correction flag raised against a suggested post-hoc rewrite that
> was reviewed and declined. Authorized by **D-6601**. No content above
> this horizontal rule is modified.
>
> **Do not read this appendix as if it had been present at execution
> time.** EC-066 is the authoritative execution contract for what shipped;
> the module-header JSDoc of
> [`CardDataDisplay.vue`](../../apps/registry-viewer/src/components/CardDataDisplay.vue)
> is the authoritative source for locked display labels and
> empty-field semantics in the code.

### A1 — Ambiguities in the pre-execution WP text (resolved during pre-flight)

Three ambiguities in the WP §Non-Negotiable Constraints block were caught
during EC-066 pre-flight (PS-1..PS-4 bundle) and resolved **before**
execution:

1. **`type` appears twice** — once under "FlatCard required fields" and
   once under "FlatCard optional numeric/string fields". EC-066 §Locked
   Values treats `type` as required only; the pre-flight PS-1
   disambiguation collapsed the optional duplicate to a no-op.
2. **"Omit empty fields OR mark as em-dash"** — the WP permits both.
   EC-066 §Locked Values "AND semantics" selected a single rule:
   *empty / null / absent fields are OMITTED entirely*. Em-dash is not
   used in Data Mode. The CardDataDisplay.vue module header records this
   as "Designer choice (per EC-066 §Locked Values 'AND semantics')".
3. **Label alternatives** ("Recruiting Effect / Recruitment",
   "Attack Effect / Combat", "Ability / Card Text") — EC-066 locked the
   **left-hand label** in each pair: "Recruiting Effect", "Attack Effect",
   "Ability". Alternatives are not aliases and are not accepted by the
   component.

No pre-execution edit to this WP was needed because EC-066 wins over the
WP where they conflict (per `.claude/CLAUDE.md` §Execution Checklists:
"If the EC and WP conflict, the WP wins" — but EC-066's disambiguations
here *refine* rather than *conflict with* the WP's non-exclusive
language, so EC-066 is the operative source).

### A2 — Factual correction: the suggested `Allowed Display Fields` list

A post-execution rewrite proposal (2026-04-22) suggested replacing the
WP's "Locked card attributes" block with an explicit "Allowed Display
Fields" list containing the names:

- Required: `id`, `name`, `type`
- Optional: `cost`, `attack`, `recruit`, `victoryPoints`, `team`,
  `heroClass`, `subtypes`, `rarity`, `edition`, `abilityText`,
  `attackerText`, `recruiterText`

**Most of those field names are not on `FlatCard` today.** The actual
interface (`apps/registry-viewer/src/registry/types/types-index.ts:34`)
exposes: `key`, `cardType`, `setAbbr`, `setName`, `name`, `slug`,
`imageUrl`, `heroName`, `team`, `hc`, `rarity`, `rarityLabel`, `slot`,
`cost`, `attack`, `recruit`, `abilities: string[]`.

Name-for-name mapping (suggested -> actual):

| Suggested name    | Actual FlatCard field                   | Notes |
|---|---|---|
| `id`              | `key`                                   | canonical key is `key`, not `id` |
| `type`            | `cardType`                              | label "Type" is correct; property name differs |
| `victoryPoints`   | — (absent)                              | rendered as contract-aware placeholder in CardDataDisplay.vue; omits per AND-semantics |
| `heroClass`       | `hc`                                    | label "Class" maps to `hc` |
| `subtypes`        | — (absent)                              | not present on FlatCard today; would require WP-086 |
| `edition`         | `setName`                               | label "Edition" maps to `setName` |
| `abilityText`     | `abilities: string[]`                   | array, not string; joined for display |
| `attackerText`    | — (absent)                              | contract-aware placeholder; omits today |
| `recruiterText`   | — (absent)                              | contract-aware placeholder; omits today |
| `rarity`          | `rarityLabel` (preferred) -> `rarity`   | component prefers `rarityLabel` when present |

The authoritative source for these mappings is the module-header JSDoc
of [`CardDataDisplay.vue`](../../apps/registry-viewer/src/components/CardDataDisplay.vue),
which was written against the real FlatCard shape and includes
"contract-aware placeholders that will auto-light-up if/when
`flattenSet()` begins surfacing those fields (a future registry WP)".

The suggested rewrite was **not applied** — the WP it targeted is
already complete, and adopting a field list that contradicts the
runtime `FlatCard` interface would have been a latent drift trap for
any future reader who opened the WP without cross-checking the code.
The tightening *ideas* (single empty-field rule, locked labels,
composable-only state ownership, explicit print-mode rules, explicit
non-goals) are already reflected in EC-066 and the shipped code.

### A3 — Forward pointer to WP-086

If and when WP-086 (registry viewer card-types upgrade) adds the
speculative fields (`victoryPoints`, `subtypes`, `abilityText`,
`attackerText`, `recruiterText`) to FlatCard via `flattenSet()`, the
existing contract-aware placeholder rows in CardDataDisplay.vue will
auto-light-up without a component edit. WP-086 is the correct home for
any expansion of the allowed-field list; WP-066 is locked.

### A4 — What this appendix does NOT do

- Does not redefine locked values (EC-066 is authoritative).
- Does not add, remove, or reorder deliverables.
- Does not change the Definition of Done checklist above.
- Does not grant retroactive authorization for any behavior that did
  not ship at commit `8c5f28f`.
- Does not establish a precedent for freely amending closed WPs; the
  work-packets rule ("Claude must never modify historical Work Packets
  marked complete") remains in force. D-6601 authorizes this specific
  appendix only.
