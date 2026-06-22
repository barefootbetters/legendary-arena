# EC-308 — Registry Viewer Mechanic Dropdown: Fix List Scroll (Execution Checklist)

**Source:** docs/ai/work-packets/WP-277-mechanic-dropdown-scroll-fix.md
**Layer:** Registry Viewer (`apps/registry-viewer`)
**Lane:** Lightweight (single session — bugfix; regression in WP-276)

## Before Starting (Hard Gate)
- [ ] WP-276 landed: `grep -F "mechanic-popover" apps/registry-viewer/src/components/MechanicFilter.vue` → match
- [ ] Baseline green: `pnpm --filter registry-viewer typecheck` 0; `test` 0
- [ ] Bug reproduced: open dropdown, scroll the list → popover closes (the capture-phase window scroll listener catches the list's own scroll)

## Root Cause (do not re-derive)
`onViewportChange` is registered as `window.addEventListener("scroll", …, true)` (capture). A capture-phase window scroll listener receives scroll events from descendant scroll containers, so the popover's own `.mechanic-list` scroll fires it → `closeDropdown()`. The list is correctly overflowing (`overflow-y: auto`, scrollHeight ≫ clientHeight); the only defect is the close-on-scroll.

## The Fix
- `onViewportChange(event: Event)` — ignore scrolls whose `event.target` is inside the popover root: `if (target instanceof Node && rootEl.value?.contains(target)) return;` then `closeDropdown()`. Resize's target is the non-`Node` `window`, so resize still closes; an outside page/drawer scroll's target is outside `rootEl`, so it still closes.

## Guardrails
- Do NOT remove the close-on-scroll/resize behavior — it prevents the `position: fixed` popover drifting from its anchor on a real page scroll/resize. Only scope it to outside-origin events.
- Do NOT touch the v-model contract, `App.vue`, `cardMechanicsClient.ts`, the predicate, the feed, the schema, or producer-side files.
- No forbidden import (`game-engine` / `apps/server` / `apps/dashboard` / `scripts/`).
- `// why:` comment explaining the capture-phase descendant-scroll guard.

## Files to Produce
- `apps/registry-viewer/src/components/MechanicFilter.vue` — **modified** (`onViewportChange` guard)
- `docs/ai/work-packets/WORK_INDEX.md` / `EC_INDEX.md` / `STATUS.md` — **modified** — governance close

Exactly 4 files. No DECISIONS change.

## After Completing
- [ ] Guard present: `grep -F "rootEl.value?.contains(target)" apps/registry-viewer/src/components/MechanicFilter.vue` ≥1
- [ ] No forbidden import in `MechanicFilter.vue`
- [ ] `typecheck` 0; `test` 0 (prior count preserved); `build` 0
- [ ] Live: inner list scroll holds + popover stays open; outside scroll / resize / Escape close; filter narrows the grid
- [ ] WORK_INDEX + EC_INDEX + STATUS flipped; DECISIONS **not** touched
- [ ] Commit prefix: `EC-308:` (code) + `SPEC:` (governance)

## Common Failure Smells
- Removing the scroll/resize listener entirely → the popover drifts from its anchor on a real page scroll; scope the guard instead
- Checking `event.target === list` only → misses scrolls targeting nested children; use `rootEl.contains(target)`
- Resize stops closing → don't guard on `resize` (its target is `window`, not a Node inside rootEl, so the `instanceof Node` check already lets it through)
