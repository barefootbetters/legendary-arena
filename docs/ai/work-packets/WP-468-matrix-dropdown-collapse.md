# WP-468 — Coverage-Matrix Dropdown Readability + Collapsible Masterminds (Legends Board)

**User-Visible Surface:** `legends.legendary-arena.com` (the gauntlet index —
the `.download-select` dropdowns and the WP-464/466 Core coverage matrix).
**D-24026 live-verification applies** (operator-pending on the Cloudflare Pages
deploy).

## User-Visible Impact

The player-count / division dropdown values are readable (dark text) in the open
list instead of invisible white-on-white until hovered; and each mastermind in the
coverage matrix collapses under a clickable header, so the matrix opens compact and
the operator expands one mastermind at a time.

## Goal

Two operator-directed presentation changes (2026-07-30) to the legends gauntlet
index:
1. **Dropdown option readability** — the `.download-select` `<option>` text was the
   dark-theme light colour, invisible against the native (light) dropdown popup
   until the blue hover highlight; give the options explicit dark-on-light so the
   values read when not highlighted. Affects all `.download-select` menus (the
   per-row download count/division selects and the coverage-matrix count select).
2. **Collapsible masterminds** — in the coverage matrix, each mastermind's 8 scheme
   rows collapse under a clickable header (default collapsed); the operator expands
   one at a time. This avoids the 32-row vertical scroll and keeps the rotated
   column headings lined up with the visible data.

Single-file, presentation-only `apps/legends-board` change; no data/helper change
(`buildCoverageMatrix` untouched); `vue`-only / zero-API.

## Assumes

- **On `origin/main` @ `e7bc018b`.** `apps/legends-board` builds/tests/typechecks
  green. **WP-464/466/467 ✅** shipped the coverage matrix (mastermind group-header
  rows via `isMatrixMastermindStart`, rotated headings, wrapped scheme names) and
  the `.download-select` control (WP-441) exists in `GauntletIndexPanel.vue`.
- The board pins `data-theme="dark"`; native `<select>` popups render on a light OS
  background, so a light option colour is invisible until hovered.

## Context (Read First)

**Read before executing:** the matrix + `.download-select` CSS in
`GauntletIndexPanel.vue` (the `.coverage-matrix-mm-header` group-header row + the
`isMatrixMastermindStart` render) and `docs/ai/ARCHITECTURE.md §Layer Boundary`
(legends board is `vue`-only / zero-API). Operator requests 2026-07-30: the count
dropdown values are white/invisible until hover, and the 32-row matrix should
collapse per mastermind.

## Scope (In)

- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** (scoped CSS + template
  + a small reactive state):
  - `.download-select option { color: <dark>; background: <light> }` — readable
    option list.
  - A reactive `expandedMasterminds` record + `isMastermindExpanded(slug)` /
    `toggleMastermind(slug)`; the mastermind group-header `<th>` becomes a full-width
    toggle `<button>` (caret + `aria-expanded`); the scheme `<tr>` renders
    (`v-if`) only when its mastermind is expanded. Default collapsed.

## Out of Scope

- No change to `buildCoverageMatrix`, the approved-loadout DATA, the ✓/link/count
  behaviour, the rotated headings, the scheme-wrap, or any other panel/reveal.
- No server/publisher/snapshot/registry change; no new `fetch`.
- **The gauntlet-variety data change (per-scheme approved adversaries) is a
  SEPARATE, larger arc — not this WP.**

## Files Expected to Change

- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** (CSS +
  toggle template + collapse state)

## Contract

> Full file contents (no diffs); ESM/Node v22+; human-style code per
> `00.6-code-style.md`; `vue`-only / zero-API; scoped CSS + template + a small
> reactive record; rendered coverage data unchanged.

**Locked:** `.download-select option` gets an explicit dark-on-light colour pair;
the mastermind header is a keyboard-operable toggle `<button>` (`aria-expanded`);
scheme rows `v-if` on `isMastermindExpanded` (default collapsed); the closed select
keeps its dark-theme toolbar styling.

## Acceptance Criteria

- [ ] The `.download-select` option list renders dark text on a light background
      (computed option `color` is a dark value), readable when not highlighted; the
      closed select keeps its light-on-dark value.
- [ ] The matrix opens with all masterminds collapsed (4 mastermind toggle headers,
      no scheme rows); clicking a mastermind reveals its 8 scheme rows and flips
      `aria-expanded` to `true`; clicking again collapses it.
- [ ] The ✓ cells, challenge links, count selector, rotated headings, and
      scheme-wrap are unchanged; `buildCoverageMatrix` + tests are untouched.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/legends-board test
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board build
pnpm -r build
# Live smoke (D-24026): open a count dropdown — values are dark/readable, not
# white-until-hover. Open the matrix — 4 collapsed mastermind headers; click one to
# expand its schemes; click again to collapse.
```

## Vision Alignment

**Clauses:** §10 (Legends board presentation), §17 (a11y — the toggle is a
keyboard-operable button with `aria-expanded`). No scoring / identity / RNG /
determinism / persistence. **Conflict:** *No conflict* — readability + a
collapse-control on a read-only table. **NG:** none.

## Definition of Done

- [ ] All Acceptance Criteria pass; legends-board test/typecheck/build + `pnpm -r
      build` green.
- [ ] **D-24026 live-verify (operator-pending):** deployed dropdowns readable;
      masterminds collapse/expand.
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` row checked off;
      `ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write` (`:check` 0);
      `EC_INDEX.md` EC-503 → Done.
- [ ] No files outside the list modified. (No D-entry — presentation-only.)

## Lint Gate Self-Review

- **§1/§15:** `**User-Visible Surface:**` header + `## User-Visible Impact`;
  D-24026 in DoD. PASS. **§2:** Contract full-file / no-diffs / `00.6`. PASS.
  **§4:** Context (Read First) with read-list. PASS. **§5:** one file + governance.
  PASS. **§8:** `vue`-only/zero-API, no server/registry import. PASS. **§17:** §10
  + §17 a11y, No conflict. PASS. **§20/§21:** N/A. No new contract file; no D-entry.

## Gate Verdicts (drafting session)

Lightweight, operator-directed presentation refinements (single file, scoped CSS +
template + a small reactive record, no data change). Per the lightweight-lane
condensed-gate allowance (`01.0a`), a targeted self-review substitutes for the full
subagent battery:

- **Pre-Flight — READY.** Single file; the `.download-select` control + the
  `.coverage-matrix-mm-header` / `isMatrixMastermindStart` matrix render exist as
  described (WP-441/464/466); `vue`-only/zero-API; not validation-tightening.
- **Copilot self-review — PASS.** Presentation-only; no data/logic/registry touch;
  the option-colour fix is the standard native-dropdown-on-light-OS remedy; the
  collapse is a keyboard-accessible `<button>` toggle with `aria-expanded` +
  `v-if`; `buildCoverageMatrix`/✓/links/count unchanged; no scope creep.
  **Browser-verified live** (see STATUS).
- **Lint self-review — SATISFIED.** §5 one file + governance; §8 vue-only/zero-API;
  §15 D-24026 present; §17 §10 + a11y No-conflict; §20/§21 N/A; no D-entry.
