# WP-466 — Compact the Core Coverage Matrix (Remove Horizontal Scroll)

**User-Visible Surface:** `legends.legendary-arena.com` (the WP-464 Core-Set
coverage matrix on the gauntlet index). **D-24026 live-verification applies**
(operator-pending on the Cloudflare Pages deploy).

## User-Visible Impact

The Core coverage matrix fits its width without a horizontal scrollbar: each
mastermind is named once above its schemes, the villain/henchman column headings
run vertically so the columns are narrow, and long scheme names wrap to two lines.

## Goal

Three operator-directed presentation refinements (2026-07-30) to the just-shipped
WP-464 Core coverage matrix, all aimed at **removing the horizontal scroll**:
1. **Name each mastermind once** — render the mastermind as a single full-width
   group-header row above its 8 scheme rows, instead of repeating the mastermind
   name on every row; the row-label column then holds only the scheme name.
2. **Rotate the column headings 90°** — the 11 villain/henchman headings render
   vertically (`writing-mode: vertical-rl`) so each column shrinks to ~one
   line-height wide (the header row grows taller instead).
3. **Wrap long scheme names to two lines** — the scheme row-label wraps and is
   width-capped instead of forcing a wide single line.

Single-file, presentation-only `apps/legends-board` change — scoped CSS plus a
template regroup; **no data/helper change** (`buildCoverageMatrix` is untouched;
the mastermind grouping uses the existing `isMatrixMastermindStart`). `vue`-only /
zero-API.

## Assumes

- **On `origin/main` @ `c7ad0407`.** `apps/legends-board` builds/tests/typechecks
  green. **WP-464 ✅** landed the matrix (`GauntletIndexPanel.vue` `coreCoverageMatrix`
  computed, `isMatrixMastermindStart`, the `.coverage-matrix-*` table + scoped CSS).
- Presentation-only: the rendered coverage data (✓ cells, challenge links, count
  selector) is unchanged; only the layout of mastermind labels, column headings,
  and scheme labels changes.

## Context (Read First)

**Read before executing:** the WP-464 matrix in `GauntletIndexPanel.vue` (the
`coreCoverageMatrix` render + `.coverage-matrix-*` CSS) and
`docs/ai/ARCHITECTURE.md §Layer Boundary` (legends board is `vue`-only / zero-API).
Operator request 2026-07-30 with a copy-paste of the current wide matrix; the goal
is stated plainly: remove the horizontal scroll.

## Scope (In)

- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** (scoped CSS + template
  regroup only):
  - `<tbody>` becomes a `<template v-for>` that renders a **mastermind group-header
    row** (`<th colspan>`) when `isMatrixMastermindStart(rowIndex)`, then a scheme
    row whose `<th>` holds only the scheme name.
  - Each column heading wraps its text in a span rotated via
    `writing-mode: vertical-rl; transform: rotate(180deg)`.
  - The scheme row-label wraps (`white-space: normal` + `max-width` +
    `overflow-wrap`).
  - The corner header reads "Scheme"; the `.coverage-matrix-mm-start` row-border is
    replaced by the group-header row's top border.

## Out of Scope

- No change to `buildCoverageMatrix`, its tests, the ✓/link/count-selector
  behaviour, the accessible names, or any other panel/set/reveal.
- No server/publisher/snapshot/registry change; no new `fetch`.
- Not generalized to other sets (the matrix stays Core-only, WP-464's guard).

## Files Expected to Change

- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** (template
  regroup + scoped CSS)

## Contract

> Full file contents (no diffs); ESM/Node v22+; human-style code per
> `00.6-code-style.md`; `vue`-only / zero-API; scoped CSS + markup only; the
> rendered coverage data (✓ cells, links, accessible names, count selector) is
> unchanged.

**Locked:** mastermind named once (group-header row per `isMatrixMastermindStart`);
column headings rotated via `writing-mode: vertical-rl`; scheme label wraps
(non-`nowrap`, width-capped); `overflow-x: auto` safety net retained.

## Acceptance Criteria

- [ ] Each mastermind (Magneto / Dr. Doom / Loki / Red Skull) appears once, as a
      group header above its 8 scheme rows; the row-label column holds only the
      scheme name.
- [ ] The 11 adversary column headings render vertically (computed
      `writing-mode` is a vertical mode), narrowing the columns.
- [ ] A long scheme name (e.g. "Replace Earth's Leaders with Killbots") wraps to
      more than one line rather than forcing a wide column.
- [ ] The Core matrix fits without horizontal page overflow at desktop width
      (`document.documentElement.scrollWidth ≤ clientWidth`); the `overflow-x:auto`
      wrapper remains as the small-screen safety net.
- [ ] The ✓ cells, challenge links, accessible names, and count selector are
      unchanged; `buildCoverageMatrix` + its tests are untouched.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/legends-board test
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board build
pnpm -r build
# Live smoke (D-24026): expand the Core matrix — 4 mastermind headers, vertical
# column headings, wrapped long scheme names, and no horizontal page overflow.
```

## Vision Alignment

**Clauses:** §10 (Legends board presentation). No scoring / identity / RNG /
determinism / persistence. **Conflict:** *No conflict* — a layout-only restyle of a
read-only table. **NG:** none.

## Definition of Done

- [ ] All Acceptance Criteria pass; legends-board test/typecheck/build + `pnpm -r
      build` green.
- [ ] **D-24026 live-verify (operator-pending):** deployed matrix has no horizontal
      scroll, mastermind once, vertical headings, wrapped scheme names.
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` row checked off;
      `ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write` (`:check` 0);
      `EC_INDEX.md` EC-501 → Done.
- [ ] No files outside the list modified. (No D-entry — presentation-only.)

## Lint Gate Self-Review

- **§1/§15:** `**User-Visible Surface:**` header + `## User-Visible Impact`;
  D-24026 in DoD. PASS. **§2:** Contract full-file / no-diffs / `00.6`. PASS.
  **§4:** Context (Read First) with read-list. PASS. **§5:** one file + governance.
  PASS. **§8:** `vue`-only/zero-API, no server/registry import. PASS. **§17:** §10,
  No conflict. PASS. **§20:** N/A — no funding surface. **§21:** N/A — no endpoint.
  No new contract file; no D-entry (presentation-only).

## Gate Verdicts (drafting session)

Lightweight, operator-directed presentation refinement of the just-merged WP-464
(single file, scoped CSS + markup, no data change). Per the lightweight-lane
condensed-gate allowance (`01.0a`), a targeted self-review substitutes for the full
subagent battery:

- **Pre-Flight — READY.** Single file (`GauntletIndexPanel.vue`); `coreCoverageMatrix`
  + `isMatrixMastermindStart` + the `.coverage-matrix-*` surface exist as described
  (WP-464); `vue`-only/zero-API; not validation-tightening.
- **Copilot self-review — PASS.** Presentation-only; no data/logic/registry/network
  touch; `buildCoverageMatrix` + tests untouched; the ✓/link/count/accessible-name
  behaviour is preserved; the mastermind grouping reuses the existing helper; no
  scope creep. **Browser-verified live** (see STATUS).
- **Lint self-review — SATISFIED.** §5 one file + governance; §8 vue-only/zero-API;
  §15 D-24026 live-verify present; §17 §10 No-conflict; §20/§21 N/A; no D-entry.
