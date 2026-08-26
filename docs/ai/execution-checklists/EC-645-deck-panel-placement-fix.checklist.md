# EC-645 — Deck Probability Panel Placement Fix (Execution Checklist)

**Source:** docs/ai/work-packets/WP-610-deck-panel-placement-fix.md
**Layer:** `apps/arena-client` (one scoped-CSS property)

## Before Starting
- [ ] WP-607 on `origin/main`: `DeckProbabilityPanel.vue` `.deck-probability-panel`
      is `position: fixed; bottom: 8px; left: 8px; z-index: 9997`.
- [ ] `DiagnosticExportButton.vue` `bottom: 8px` z-9999; `ViewLoadoutButton.vue`
      `bottom: 40px` z-9999 — the bottom-left stack the panel collides with.
- [ ] Fresh worktree off `origin/main` (`3195cf73`); baseline clean; capture the SHA.
- [ ] Scope lock — EXACTLY 1 code file: `DeckProbabilityPanel.vue`. Any edit
      outside → STOP. (STATUS/DECISIONS/WORK_INDEX/mindmap are the separate SPEC
      govern-close commit, not a scope breach.)
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` 0; `test` green.

## Locked Values (do not re-derive)
- `.deck-probability-panel { bottom: 8px }` → `bottom: 72px` (the corner's next
  free 32px slot after 8px + 40px). Nothing else changes — not z-index, not left.

## Guardrails
- **One property, scoped CSS only.** No logic, template, z-index, left, or
  other-file edit.
- **No new/changed test.** jsdom does not lay out `position: fixed`; a layout
  assertion is not meaningful. The existing panel tests must pass unchanged.
- **`// why:` comment required** on the offset — name the two colliding buttons
  (DiagnosticExportButton 8px, ViewLoadoutButton 40px) and the 32px stride.

## Files to Produce
- `apps/arena-client/src/components/play/DeckProbabilityPanel.vue` — **modified** — `bottom: 8px` → `72px` (+ why comment)

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter arena-client typecheck` (vue-tsc) 0;
      arena-client suite green (panel tests unchanged).
- [ ] **Live layout check (not a committed test):** dev server + injected
      snapshot; measure the toggle vs the diagnostics button — no overlap
      collapsed AND expanded.
- [ ] **Live-on-surface (D-24026):** on deployed `play.legendary-arena.com`, in a
      real match, the "Deck odds" toggle is visible bottom-left, clear of the
      diagnostics / loadout buttons, and expands.
- [ ] `git diff --name-only` — the `EC-645:` implementation commit is only
      `DeckProbabilityPanel.vue`.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md` — land D-24421 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-610 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node `📝` → `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` 0.

## Common Failure Smells (Optional)
- Toggle still hidden → you left `bottom: 8px` (or moved z-index instead of the offset).
- Panel overlaps the loadout button → offset < 72px (ViewLoadout reaches ~68px).
- A second file in the diff → scope breach; the CSS change is one property in one file.
