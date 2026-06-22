# WP-278 — Registry Viewer Search Header Redesign (Unified FilterDropdown)

**Status:** Reviewed — ready to execute (drafted 2026-06-22)
**Primary Layer:** Registry Viewer (`apps/registry-viewer`)
**Dependencies:** WP-270/276/277 (mechanic dropdown — the pattern this generalizes), WP-086 (card-types taxonomy), WP-125 (ability-effect filter), WP-183/184 (twist + mechanical pattern filters). All landed.

---

## Session Context

The registry viewer's filter surface grew organically across WP-086/125/183/184/270/276 into a grab-bag of three UI idioms: two native `<select>`s (Set, Class), several pill ribbons (card-type toggles, ability effects, scheme-twist, four mechanical-pattern ribbons), a redundant set-pills strip, and one dropdown (mechanics, WP-276). The operator asked to redesign the whole header into a consistent, compact row of dropdowns.

The mechanics dropdown (WP-276/277) proved the pattern — a toggle button + a `position: fixed` popover (escaping the filter drawer's `overflow: hidden` clip) with a search box, a scrollable list, and outside-click/Escape/resize close (the scroll-origin guard from WP-277). This WP **factors that into a shared `FilterDropdown` component** and rebuilds every filter on it.

---

## Goal

A single shared `FilterDropdown.vue` powers a tidy, consistent row of filters in the drawer — **Set · Class · Type · Mechanics · Effects** — plus a contextual **Patterns** dropdown. The redundant set-pills strip is removed, and the four mechanical-pattern ribbons + the scheme-twist ribbon collapse into one contextual Patterns dropdown. Filtering behavior is unchanged (same `applyQuery` + OR-within / AND-across composition); only the controls change. `pnpm --filter registry-viewer typecheck`, `test`, and `build` all exit 0.

---

## Locked Design Decisions (operator, 2026-06-22)

1. **Card types → a multi-select "Type" dropdown** (not pills) — for a fully uniform row.
2. **Set & Class → single-select** (restyled to the dropdown look; no multi-select, so `applyQuery`'s `setAbbr`/`heroClass` single-value semantics are unchanged).
3. **The scheme-twist + four pattern ribbons → one contextual "Patterns" dropdown** that appears only when exactly one matching card type is active and lists that type's patterns (or Scheme → twists). Same single-type gating as today.

---

## The Shared Component — `FilterDropdown.vue` (new)

Generalizes `MechanicFilter.vue` (WP-276/277):

- **Props:** `label: string`; `items: readonly FilterDropdownItem[]` where `FilterDropdownItem = { value: string; label: string; count?: number; emoji?: string; title?: string }`; `mode?: 'single' | 'multi'` (default `'multi'`); `searchable?: boolean` (default `true`); `emptyLabel?: string` (the "Any …" toggle text when nothing selected).
- **Model:** `selected` v-model `Set<string>` (a single-value set in `'single'` mode).
- **Behavior:** toggle button shows `emptyLabel` when empty, the selected item's label in single mode, or "N selected" in multi mode. A `position: fixed` popover (anchored to the button via `getBoundingClientRect` at open, escaping the drawer's `overflow: hidden`) holds an optional search box (filters items by label/value, case-insensitive) and a scrollable checkbox list (sorted by label; or by a caller-provided pre-sorted order — see below). `'multi'`: toggling adds/removes, popover stays open. `'single'`: selecting replaces the set with that one value and closes; re-selecting clears it. A "✕ clear" affordance when ≥1 selected. Closes on outside-click, Escape, and viewport scroll/resize — **carrying the WP-277 scroll-origin guard** (ignore scrolls whose `event.target` is inside the popover root, so the list scrolls without closing). Never throws.
- **Ordering:** items render in the order supplied by the caller when a stable order matters (effects/twists/patterns carry an `order` field; the caller pre-sorts), else by label. Implement as: the component preserves `items` order as given (the caller sorts); search filters that order. (Mechanics/Type are sorted by label by the caller.)
- **Empty/degraded:** the component renders nothing when `items.length === 0` (so a missing taxonomy or an empty contextual list hides the control), mirroring today's `v-if` guards.

---

## App.vue Rewiring

- **Set** → `FilterDropdown` `mode="single"` `searchable` over `allSets` (`{ value: abbr, label: name }`); the single selected value drives `filterSet` (`applyQuery` `setAbbr`). ~40 sets, so searchable.
- **Class** → `FilterDropdown` `mode="single"` `searchable={false}` over the 5 `HC_OPTIONS`; drives `filterHC`.
- **Type** → `FilterDropdown` `mode="multi"` over `displayedTypeGroups` (one item per group: `value = group.label`, `emoji`, `count` = cards whose `cardType ∈ group.types`). A new `selectedTypeGroupKeys: Set<string>` is the dropdown model; **`selectedTypes` becomes a computed** that unions each selected group's `types[]` (preserving the existing group→leaf-type expansion, e.g. SHIELD → agent/officer/trooper). Every site that mutated `selectedTypes` (`clearTypes`, `clearAllFilters`, `navigateToCard`, the type-clear on pattern change) now mutates `selectedTypeGroupKeys`; `applyQuery`'s `q.cardTypes` still reads the computed `selectedTypes`.
- **Mechanics** → `FilterDropdown` `mode="multi"` `searchable` over `cardMechanicsIndex.mechanics` (`{ value: slug, label, count: cardCount }`, all mechanics, sorted by label — preserving WP-276/D-24052). `applyFilters` still calls `cardMatchesMechanics` (unchanged).
- **Effects** → `FilterDropdown` `mode="multi"` over `abilitiesTaxonomy` pre-sorted by `order` (`{ value: slug, label, emoji, count }`, count from the existing `abilityTagIndex`). `applyFilters`'s existing effect-tag filter (OR-within over `abilityTagIndex`) is unchanged.
- **Patterns (contextual)** → ONE `FilterDropdown` `mode="multi"`, rendered only when exactly one leaf card type ∈ {hero, villain, henchman, mastermind, scheme} is active (the existing `isSingleCardTypeActive` logic). Its `items` = that type's pattern taxonomy (`heroPatterns`/`villainPatterns`/`henchmanPatterns`/`mastermindPatterns`, pre-sorted by `order`) or `twistPatterns` when the active type is `scheme`. **`selectedTwistSlugs` + `selectedMechanicalPatternSlugs` unify into one `selectedPatternSlugs: Set<string>`**; `applyFilters` filters the post-query set by: active type matches AND the card's `twistPattern` (scheme) or `mechanicalPattern` (else) ∈ `selectedPatternSlugs`. The slugs clear on Type change (as today). The single-type-active logic stays the authority (UI gate + the logic guard).
- **Remove** the set-pills strip (`.set-pills`) entirely — redundant with the Set dropdown.
- The top `.filter-bar` (text search, count, `CardSizeSlider`, Filters toggle) and the collapsible drawer wrapper are kept; the dropdowns sit in a single wrapping row inside the drawer.
- `activeFilterCount` updates to count the unified `selectedPatternSlugs` (replacing the two old sets) + the existing sets.

## Components Deleted (folded into FilterDropdown + App.vue)

- `AbilityEffectFilter.vue`, `SchemeTwistFilter.vue`, `PatternFilter.vue`, `MechanicFilter.vue` — all replaced by `FilterDropdown` instances wired in `App.vue`. (No component has its own test; `cardMechanicsClient.test.ts`'s `cardMatchesMechanics` coverage is unaffected and stays.)

---

## Out of Scope

- Any change to filtering LOGIC or `applyQuery` semantics (OR-within / AND-across preserved; Set/Class stay single-select).
- Any producer-side / engine / registry / server change; any `data/cards` or feed change.
- Multi-select Set/Class (operator chose single-select).
- The `cardMatchesMechanics` predicate / `cardMechanicsClient.ts` / the feed (untouched).

---

## Files Expected to Change

- `apps/registry-viewer/src/components/FilterDropdown.vue` — **new** (shared dropdown)
- `apps/registry-viewer/src/App.vue` — **modified** (rewire all filters + remove set-pills)
- `apps/registry-viewer/src/components/AbilityEffectFilter.vue` — **deleted**
- `apps/registry-viewer/src/components/SchemeTwistFilter.vue` — **deleted**
- `apps/registry-viewer/src/components/PatternFilter.vue` — **deleted**
- `apps/registry-viewer/src/components/MechanicFilter.vue` — **deleted**
- `docs/ai/DECISIONS.md` — **modified** (D-24053)
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/ai/STATUS.md` — **modified** (governance close)

**~10 files (1 new + 1 modified + 4 deleted viewer; 4 governance).**

---

## Decision — D-24053

Establishes the shared `FilterDropdown` as the registry-viewer's standard filter control, superseding the per-filter pill-ribbon components of WP-125/183/184 and folding in WP-270/276's mechanic dropdown; and collapses the five conditional twist/pattern ribbons into one contextual Patterns dropdown. Pure UI consolidation — no filtering-logic or card-data change. (No DECISIONS change to D-24046/D-24052; D-24052's "all mechanics" policy is preserved.)

---

## Non-Negotiable Constraints

- ESM only; Vue 3 `<script setup>`; human-style code per `00.6`; `// why:` on the fixed-positioning, the scroll-origin guard (carried from WP-277), and the Type group→leaf expansion.
- No forbidden import: `FilterDropdown.vue` + `App.vue` MUST NOT import `@legendary-arena/game-engine`, `apps/server`, `apps/dashboard`, or any repo-root `scripts/` (grep gate).
- Mechanic/effect/pattern filtering keeps using the per-card mappings (`cards[extId].mechanics`, `abilityTagIndex`, `mechanicalPattern`/`twistPattern`) — never `parseAbilityText`.
- Missing/empty taxonomies stay non-fatal: each control hides when its `items` is empty; the card grid always renders.
- The popover must escape the drawer's `overflow: hidden` (`position: fixed`) and must scroll without closing (WP-277 guard).
- Set/Class stay single-select; `applyQuery` semantics unchanged.

---

## Acceptance Criteria

1. A single `FilterDropdown.vue` renders all filter controls; `AbilityEffectFilter`/`SchemeTwistFilter`/`PatternFilter`/`MechanicFilter` are deleted and no longer imported (**AC-1**).
2. The drawer shows one row of dropdowns: Set, Class, Type, Mechanics, Effects (**AC-2**).
3. Effects is a multi-select dropdown listing the effect taxonomy with counts; selecting effects filters the grid identically to the old ribbon (OR-within, AND-across) (**AC-3**).
4. Type is a multi-select dropdown; selecting type group(s) filters the grid exactly as the old type pills did (group→leaf expansion preserved, incl. SHIELD's sub-types) (**AC-4**).
5. Set and Class are single-select dropdowns driving `filterSet`/`filterHC` (single value) unchanged (**AC-5**).
6. The contextual Patterns dropdown appears only when exactly one matching card type is active, lists that type's patterns (or Scheme twists), and filters identically to the old ribbons (**AC-6**).
7. The set-pills strip is removed (**AC-7**).
8. Each dropdown's popover scrolls (wheel/scrollbar/keyboard) without closing, and closes on outside-click / Escape / genuine outside scroll / resize (WP-277 behavior, now in the shared component) (**AC-8**).
9. No `game-engine` / `apps/dashboard` / `apps/server` / `scripts/` import; no `parseAbilityText` in the filter surface (grep) (**AC-9**).
10. `pnpm --filter registry-viewer typecheck` 0; `test` 0 (prior count preserved — no component had a test); `build` 0 (no `__vite-browser-external`) (**AC-10**).

---

## Verification Steps

```bash
# 1. Old components deleted + not imported
for f in AbilityEffectFilter SchemeTwistFilter PatternFilter MechanicFilter; do
  test -f apps/registry-viewer/src/components/$f.vue && echo "FAIL: $f.vue still exists" || echo "OK: $f.vue gone"
  grep -RIn "$f" apps/registry-viewer/src/App.vue && echo "FAIL: $f still imported" || echo "OK: $f not referenced"
done
# 2. FilterDropdown exists + used
test -f apps/registry-viewer/src/components/FilterDropdown.vue && echo OK
grep -cF "FilterDropdown" apps/registry-viewer/src/App.vue   # >= 6 (Set/Class/Type/Mechanics/Effects/Patterns)
# 3. set-pills removed
grep -RIn "set-pills" apps/registry-viewer/src/App.vue && echo "FAIL: set-pills remains" || echo "OK: set-pills gone"
# 4. no forbidden import / no ability-text parse
grep -RInE "(@legendary-arena/game-engine|apps/server|apps/dashboard|(^|/|\.\./)scripts/)" apps/registry-viewer/src/components/FilterDropdown.vue apps/registry-viewer/src/App.vue || echo OK
grep -RIn "parseAbilityText" apps/registry-viewer/src/components/FilterDropdown.vue apps/registry-viewer/src/App.vue && echo FAIL || echo OK
# 5. scroll-origin guard carried into the shared component
grep -F "rootEl" apps/registry-viewer/src/components/FilterDropdown.vue   # the contains() guard
# 6. typecheck / test / build
pnpm --filter registry-viewer typecheck && pnpm --filter registry-viewer test && pnpm --filter registry-viewer build
```

Live (preview against the live R2 feed) — verify EVERY filter: Set, Class, Type (incl. a multi-child group), Mechanics, Effects each narrow the grid; the contextual Patterns dropdown appears for a single Hero/Villain/Henchman/Mastermind/Scheme selection and filters; popovers scroll without closing; outside-click/Escape close; combinations compose (AND-across).

---

## Definition of Done (Binary Gate)

- [ ] `FilterDropdown.vue` created; the 4 old filter components deleted and de-referenced
- [ ] Set/Class/Type/Mechanics/Effects on one dropdown row; contextual Patterns dropdown; set-pills removed
- [ ] Every filter live-verified (narrows the grid; composes; popover scrolls + closes correctly)
- [ ] No forbidden import; no `parseAbilityText`; missing taxonomies hide the control non-fatally
- [ ] `typecheck` + `test` + `build` exit 0
- [ ] D-24053 lands; WORK_INDEX + EC_INDEX + STATUS updated
- [ ] Commit prefix `EC-309:` for code, `SPEC:` for governance
- [ ] D-24026 live-verify post-deploy on cards.legendary-arena.com

---

## Lint / Pre-Flight / Copilot

**Lint (00.3): PASS** — §6 naming (`FilterDropdown`, full words); §8 boundary grep-gated; §16 `for...of`, `// why:` on the load-bearing bits; §17 N/A per §17.3 (internal Registry Viewer §10a filter affordance — no card-data semantics / identity / monetization change); §20 / §21 N/A (no funding surface, no API/`apps/server` change). **Pre-flight: READY** — single layer; no new contract (the v-model shape is a generalization of the existing one; `applyQuery` unchanged); no determinism/sentinel impact; hard-deps landed. Scope is larger than the lightweight lane (10 files, 4 deletions, App.vue rewire), so this runs as a full WP with exhaustive per-filter live verification (the independence substitute). **Copilot: PASS** — the consolidation is justified (5 filter usages ⇒ a shared component, well past the "3rd copy" abstraction trigger); the two risk areas are the **Type group→leaf expansion** (preserved via `selectedTypes` becoming a computed over `selectedTypeGroupKeys`) and the **Patterns unification** (`selectedTwistSlugs`+`selectedMechanicalPatternSlugs` → one `selectedPatternSlugs`, routed by active type) — both spelled out above and gated by live verification of each filter.

## Vision / Funding / API

**N/A** on all three — internal Registry Viewer filter UI; no card-data semantics, identity, monetization, funding surface, or HTTP/`apps/server` endpoint touched.
