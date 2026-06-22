# WP-277 — Registry Viewer Mechanic Dropdown: Fix List Scroll (Regression in WP-276)

**Status:** Done 2026-06-22 (lightweight lane — single session; bugfix, no new decision)
**Primary Layer:** Registry Viewer (`apps/registry-viewer`)
**Dependencies:** WP-276 (fixes a regression introduced by its dropdown rework)

---

## Session Context

WP-276 reworked the hero-mechanic filter into a searchable dropdown whose list (`.mechanic-list`, `max-height: 300px; overflow-y: auto`) holds all 134 mechanics. The operator reported the list **cannot be scrolled** — not by mouse wheel, not by dragging the scrollbar, not via keyboard. Reproduced in the preview: the list is correctly overflowing (`scrollHeight 3957 > clientHeight 300`, `overflow-y: auto`), but **any scroll instantly closes the popover**.

**Root cause:** WP-276 registers a capture-phase `window` `scroll` listener (`onViewportChange`, `capture: true`) to close the popover when the page/drawer scrolls (so the `position: fixed` popover doesn't drift from its anchor). But a capture-phase window scroll listener **also receives scroll events from descendant scroll containers** — so scrolling the popover's own list fires it and closes the dropdown, making the list look unscrollable.

---

## Goal

Scrolling the mechanic list (wheel / scrollbar / keyboard auto-scroll) scrolls the list and keeps the dropdown open; only a genuine outside page/drawer scroll, a resize, Escape, or an outside-click closes it. `typecheck` / `test` / `build` exit 0.

---

## Scope (In)

- `apps/registry-viewer/src/components/MechanicFilter.vue` — change `onViewportChange` to take the `Event` and **ignore scroll events whose `target` is inside the popover root** (`rootEl.contains(target)`); only close on a scroll/resize originating outside the popover. (Resize's target is the non-`Node` `window`, so resize still closes.)

## Out of Scope

- Any other component behavior, the v-model contract, `App.vue`, `cardMechanicsClient.ts`, the predicate, the feed, the schema, or producer-side files.
- The optional "open upward near the viewport bottom" polish (separate, deferred).

---

## Files Expected to Change

- `apps/registry-viewer/src/components/MechanicFilter.vue` — **modified** (`onViewportChange` scroll-origin guard)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status row)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status row)
- `docs/ai/STATUS.md` — **modified** (Done entry)

**4 files (1 viewer + 3 governance).** No new file; no DECISIONS change (a bugfix that restores WP-276's intended behavior introduces no new decision).

---

## Non-Negotiable Constraints

- ESM only; Vue 3 `<script setup>`; `// why:` on the scroll-origin guard.
- The fix must NOT break the anchor-drift protection: a genuine outside page/drawer scroll, a resize, Escape, and an outside-click must all still close the popover.
- No forbidden import (`game-engine` / `apps/server` / `apps/dashboard` / `scripts/`).

---

## Acceptance Criteria

1. Scrolling the list (wheel, scrollbar drag, keyboard auto-scroll) scrolls it and the popover stays open (**AC-1**).
2. A genuine outside page/drawer scroll still closes the popover (anchor-drift protection preserved) (**AC-2**).
3. Resize, Escape, and outside-click still close the popover (**AC-3**).
4. Filtering still works (selecting a mechanic narrows the grid) (**AC-4**).
5. `typecheck` 0, `test` 0 (prior count preserved), `build` 0 (**AC-5**).

---

## Verification Steps

```bash
# 1. No forbidden import
grep -RInE "(@legendary-arena/game-engine|apps/server|apps/dashboard|(^|/|\.\./)scripts/)" apps/registry-viewer/src/components/MechanicFilter.vue || echo OK
# 2. The guard is present
grep -F "rootEl.value?.contains(target)" apps/registry-viewer/src/components/MechanicFilter.vue   # >=1 (in onViewportChange)
# 3. typecheck / test / build
pnpm --filter registry-viewer typecheck   # 0
pnpm --filter registry-viewer test        # 0
pnpm --filter registry-viewer build       # 0
```

Live (preview against the live R2 feed): inner list scroll holds (`scrollTop` sticks) and the popover stays open; outside scroll / resize / Escape close it; Berserk select → 49 cards.

---

## Definition of Done (Binary Gate)

- [ ] `onViewportChange` ignores scrolls originating inside the popover; list scrolls and stays open
- [ ] Outside scroll / resize / Escape / outside-click still close the popover
- [ ] `typecheck` + `test` + `build` exit 0
- [ ] No DECISIONS change; WORK_INDEX + EC_INDEX + STATUS updated
- [ ] Commit prefix `EC-308:` for code, `SPEC:` for governance
- [ ] D-24026 live-verify post-deploy on cards.legendary-arena.com

## Lint / Pre-Flight / Copilot (lightweight lane)

**Lint: PASS** (§8 boundary grep-gated; §17 N/A per §17.3 — internal filter affordance; §20/§21 N/A). **Pre-flight: READY** — single layer, 1 code file, no new contract, narrow UX bugfix, no determinism impact, hard-dep WP-276 landed; scaffold = reproduced the bug in the preview, then verified the fix live (inner scroll holds + stays open; outside scroll/resize/Escape close; filter intact). **Copilot: PASS** — the guard is the minimal correct fix; the anchor-drift protection it was added for is preserved (outside scroll + resize still close).
