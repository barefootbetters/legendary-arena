# EC-501 — Compact the Core Coverage Matrix (Execution Checklist)

**Source:** docs/ai/work-packets/WP-466-core-coverage-matrix-compact.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API, scoped CSS + markup

## Before Starting
- [ ] On `origin/main` @ `c7ad0407` (or later), worktree clean.
- [ ] WP-464 ✅ on `main` (the `.coverage-matrix-*` table + `coreCoverageMatrix` +
      `isMatrixMastermindStart` exist in `GauntletIndexPanel.vue`).
- [ ] legends-board test/typecheck/build + `pnpm -r build` green.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `GauntletIndexPanel.vue`
      (+ governance).

## Locked Values (do not re-derive)
- **Mastermind once:** a `<template v-for>` renders a mastermind group-header `<tr>`
  (`<th colspan="columns.length + 1">`) when `isMatrixMastermindStart(rowIndex)`,
  then a scheme row whose `<th>` holds ONLY the scheme name.
- **Rotated headings:** each column heading text is wrapped in a span with
  `writing-mode: vertical-rl; transform: rotate(180deg)`.
- **Scheme wrap:** the scheme row-label is `white-space: normal` + `max-width` +
  `overflow-wrap: anywhere` (override the general `nowrap`).
- Corner header = "Scheme"; keep `overflow-x: auto` on the scroll wrapper.

## Guardrails
- Presentation-only: DO NOT touch `buildCoverageMatrix`, its tests, the ✓/link/
  count-selector logic, or the accessible ✓-link names.
- `vue`-only / zero-API; no registry import; no new `fetch`; no server/snapshot
  change; scoped CSS only.
- Keep the native `<details>` keyboard-accessible; keep the count `<select>`
  `aria-label`.

## Required `// why:` Comments
- Why the column heading is rotated (shrink columns → remove horizontal scroll).
- Why the mastermind is a group-header row (named once; grouping via the existing
  `isMatrixMastermindStart`).

## Files to Produce
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — template regroup (mastermind
  header rows + scheme-only row labels + rotated heading spans) + scoped CSS.

## After Completing
- [ ] legends-board test / typecheck / build + `pnpm -r build` exit 0.
- [ ] **D-24026 live-verify (operator-pending):** deployed Core matrix — mastermind
      once, vertical headings, wrapped scheme names, no horizontal scroll.
- [ ] STATUS updated; WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-501 Done. (No D-entry.)
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) modified.

## Common Failure Smells
- Mastermind still repeats on every row → the group-header `<tr>` guard
  (`isMatrixMastermindStart`) wasn't wired, or the scheme row still renders the
  mastermind span.
- Headings still horizontal → `writing-mode` applied to the `<th>` not the inner
  text span, or overridden by the general cell rule.
- Still scrolls horizontally → the scheme row-label kept `nowrap`/no width cap, or
  a column heading isn't rotated.
