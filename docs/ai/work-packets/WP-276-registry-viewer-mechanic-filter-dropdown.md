# WP-276 — Registry Viewer Mechanic Filter: Searchable Multi-Select Dropdown

**Status:** Done 2026-06-21 (lightweight lane — single session; drafted + executed together per `01.0a §Lightweight Lane` / D-24028)
**Primary Layer:** Registry Viewer (`apps/registry-viewer`)
**Dependencies:** WP-270 (the mechanic filter surface this reworks — `MechanicFilter.vue`, `cardMechanicsClient.ts`, the `card-mechanics.json` feed). No new producer/data dependency.

---

## Session Context

WP-270 shipped the hero-mechanic filter as a chip ribbon (`MechanicFilter.vue`) rendering only the 12 curated-visible (`hidden !== true`) mechanics. In live use the operator found the ribbon doesn't scale — the feed carries **134 mechanics**, and even the 12 visible ones (several with long labels) overflow the filter drawer as wrapping pills. The operator asked to replace the pills with a **searchable multi-select dropdown** that surfaces **all** mechanics.

This is a viewer-only UX rework of one component. The feed (`card-mechanics.json`), the schema, the `cardMechanicsClient.ts` singleton + `cardMatchesMechanics` predicate, and `App.vue`'s `applyFilters()` wiring are all unchanged — the v-model contract (`mechanics` prop in, `selectedMechanicSlugs` Set out) is preserved, so `App.vue` already passes the full mechanics list and needs no behavioral change.

---

## Goal

`MechanicFilter.vue` becomes a dropdown: a toggle button (showing "Any mechanic" or "N selected") opens a `position: fixed` popover containing a search box and a scrollable checkbox list of **every** mechanic (sorted by label, with each mechanic's `cardCount`). Selecting one or more mechanics filters the card grid exactly as before (OR within selected mechanics, AND with the text query + other filters). The popover closes on outside-click, Escape, or viewport scroll/resize, and is omitted entirely when the feed carries no mechanics. `pnpm --filter registry-viewer typecheck`, `test`, and `build` all exit 0.

---

## Decision — supersede WP-270 AC-7 (D-24052)

WP-270 AC-7 and its Out-of-Scope locked the ribbon to `hidden !== true` mechanics (the producer's hidden-by-default diagnostics policy reaching the UI). This WP **deliberately supersedes that UI gate**: the dropdown lists all mechanics regardless of `hidden`, because a scrollable, searchable panel handles 134 entries that pills cannot, and the operator wants every mechanic filterable. The feed still carries `hidden` for the producer's diagnostics (D-24046 is unchanged — this is a consumer presentation choice, not a feed-contract change). Recorded as **D-24052**.

---

## Scope (In)

- Rewrite `apps/registry-viewer/src/components/MechanicFilter.vue` from a chip ribbon to a searchable multi-select dropdown:
  - A toggle button + a `position: fixed` popover (anchored to the button via `getBoundingClientRect` at open time, so it escapes the filter drawer's `overflow: hidden` clip).
  - An in-panel search `<input>` filtering the list by label/slug (case-insensitive).
  - A scrollable (`max-height`) checkbox list of **all** mechanics, sorted by label, each row showing the label + `cardCount`.
  - Multi-select via a new `Set` on each toggle (preserves the existing reactivity contract); a "✕ clear" affordance when ≥1 selected.
  - Closes on outside-click (document `mousedown` + `contains`), Escape, and viewport scroll/resize.
  - Omitted via `v-if="mechanics.length > 0"` when the feed carries no mechanics (preserves the missing/invalid-feed degraded path).
- Update the now-stale `App.vue` template comment that described the old "`hidden !== true` ribbon" (the only `App.vue` change — a comment correction; no behavior change).

## Out of Scope

- Any change to `cardMechanicsClient.ts`, the `cardMatchesMechanics` predicate, the feed, the schema, or `App.vue`'s `applyFilters()` filtering logic (the v-model contract is preserved).
- Any producer-side change (`scripts/`, `packages/registry`, `data/metadata/`, CI).
- Changing the filter composition semantics (still OR-within-mechanics, AND-across).
- Reintroducing the `hidden`-based suppression (intentionally dropped per D-24052).

---

## Files Expected to Change

- `apps/registry-viewer/src/components/MechanicFilter.vue` — **modified** (ribbon → searchable multi-select dropdown)
- `apps/registry-viewer/src/App.vue` — **modified** (one stale template comment corrected; no behavior change)
- `docs/ai/DECISIONS.md` — **modified** (D-24052)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status row)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status row)
- `docs/ai/STATUS.md` — **modified** (Done entry)

**6 files (2 viewer + 4 governance).** No new component, no new test file (the existing `cardMechanicsClient.test.ts` covers the unchanged predicate; the viewer has no SFC test harness, per `registry/shared.test.ts`). No new client/helper.

---

## Non-Negotiable Constraints

- ESM only; Vue 3 `<script setup>`; human-style code per `00.6` (full-word names, `// why:` on the fixed-positioning rationale, the all-mechanics rationale, and the close-on-viewport-change rationale).
- The v-model contract is unchanged: `mechanics: readonly CardMechanicEntry[]` in, `selectedMechanicSlugs: Set<string>` out — so `App.vue` needs no wiring change.
- The viewer MUST NOT import `@legendary-arena/game-engine`, `apps/server`, `apps/dashboard`, or any repo-root `scripts/` file (grep-gated).
- Mechanic filtering still uses the feed's `cards[extId].mechanics` mapping (in `App.vue`, unchanged) — never `parseAbilityText`.
- Missing/invalid feed stays non-fatal: empty mechanics ⇒ the whole control is omitted, the grid renders unchanged.
- The popover must not be clipped by the filter drawer's `overflow: hidden` — hence `position: fixed`.

---

## Acceptance Criteria

1. `MechanicFilter.vue` renders a dropdown toggle + popover, not inline chips (**AC-1**).
2. The popover lists **all** `mechanics` (no `hidden`-based suppression), sorted by label, each with its `cardCount` (**AC-2**).
3. The in-panel search filters the listed mechanics by label/slug, case-insensitive (**AC-3**).
4. Multiple mechanics can be selected (checkboxes); the emitted `selectedMechanicSlugs` Set drives the existing `App.vue` filter (OR-within, AND-across) unchanged (**AC-4**).
5. The popover closes on outside-click, Escape, and viewport scroll/resize, and is not clipped by the filter drawer (`position: fixed`) (**AC-5**).
6. An empty/invalid feed (`mechanics.length === 0`) omits the whole control; the grid renders unchanged (**AC-6**).
7. No `game-engine` / `apps/dashboard` / `apps/server` / `scripts/` import in the viewer (grep) (**AC-7**).
8. `pnpm --filter registry-viewer typecheck` exits 0; `test` exits 0 (prior count preserved — the predicate tests are unchanged); `build` exits 0 (no `__vite-browser-external`) (**AC-8**).
9. No producer-side file modified (**AC-9**).

---

## Verification Steps

```bash
# 1. No forbidden imports in the changed viewer files
if grep -RInE "from\s+['\"][^'\"]*(@legendary-arena/game-engine|apps/server|apps/dashboard|(^|/|\.\./)scripts/)" \
  apps/registry-viewer/src/components/MechanicFilter.vue apps/registry-viewer/src/App.vue; then
  echo "FAIL: forbidden viewer import"; exit 1
else echo "OK"; fi

# 2. The dropdown is wired (toggle + popover + search), not chips
grep -F "mechanic-popover" apps/registry-viewer/src/components/MechanicFilter.vue   # >=1
grep -F "mechanic-dropdown-toggle" apps/registry-viewer/src/components/MechanicFilter.vue  # >=1
grep -F "type=\"checkbox\"" apps/registry-viewer/src/components/MechanicFilter.vue  # >=1

# 3. No ability-text parsing in the mechanic surface
if grep -RIn "parseAbilityText" apps/registry-viewer/src/components/MechanicFilter.vue apps/registry-viewer/src/App.vue; then
  echo "FAIL"; exit 1; else echo "OK"; fi

# 4. typecheck / test / build
pnpm --filter registry-viewer typecheck   # exit 0
pnpm --filter registry-viewer test        # exit 0 (prior count preserved)
pnpm --filter registry-viewer build       # exit 0

# 5. No producer-side file touched
if git diff --name-only | grep -E '^(scripts/|packages/registry/|data/metadata/|\.github/)'; then
  echo "FAIL"; exit 1; else echo "OK"; fi
```

---

## Definition of Done (Binary Gate)

- [ ] `MechanicFilter.vue` is a searchable multi-select dropdown listing all mechanics; chips removed
- [ ] Search + multi-select work; v-model contract unchanged (no `App.vue` wiring change beyond the stale comment)
- [ ] Popover uses `position: fixed` (not clipped by the drawer); closes on outside-click / Escape / viewport change
- [ ] Empty feed omits the control; grid renders unchanged
- [ ] No `game-engine` / `apps/dashboard` / `apps/server` / `scripts/` import
- [ ] `typecheck` + `test` + `build` exit 0
- [ ] D-24052 lands (supersedes WP-270 AC-7's hidden-by-default UI gate); WORK_INDEX + EC_INDEX + STATUS updated
- [ ] Commit prefix `EC-307:` for code, `SPEC:` for governance
- [ ] D-24026 live-verify post-deploy on cards.legendary-arena.com

---

## Lint Gate Self-Review (00.3)

Run 2026-06-21 (lightweight lane). **PASS** (all sections PASS or justified N/A). §8 Architectural Boundaries — PASS (viewer layer; grep gate forbids game-engine/dashboard/server/scripts). §12 Test Quality — N/A (presentational SFC change; the viewer unit-tests pure `.ts` helpers, not SFCs, and the predicate it tests is unchanged). §17 Vision — N/A per §17.3 (internal Registry Viewer §10a filter affordance; no card-data semantics / identity / monetization change). §20 Funding Surface — N/A. §21 API Catalog — N/A (no endpoint / `apps/server/src/**` change).

## Pre-Flight + Copilot (lightweight lane)

**Pre-flight: READY.** Single layer (registry-viewer), 2 code files, no new contract, narrow UX surface, no determinism/sentinel impact, hard-dep WP-270 landed. Mandatory scaffold run (the lightweight lane's independence substitute): the reworked component builds into the bundle (`mechanic-popover` / `mechanic-dropdown-toggle` / "Any mechanic" / "Search mechanics" present; old `mechanic-chip` gone), typecheck 0, test 86/0, build 0. **Copilot: PASS** — v-model contract preserved (App.vue untouched behaviorally); the only cross-surface risk (the drawer's `overflow: hidden` clipping the popover) is addressed by `position: fixed`; the AC-7 supersession is explicit and recorded as D-24052.

## Vision / Funding / API

**N/A** on all three. Internal Registry Viewer filter affordance (Vision §10a); no card-data semantics, identity, monetization, funding surface, or API endpoint touched.
