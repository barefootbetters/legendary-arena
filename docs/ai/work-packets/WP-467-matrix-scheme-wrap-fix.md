# WP-467 — Fix the Coverage-Matrix Scheme-Name Wrap (Legends Board)

**User-Visible Surface:** `legends.legendary-arena.com` (the Core coverage matrix
on the gauntlet index). **D-24026 live-verification applies** (operator-pending on
the Cloudflare Pages deploy).

## User-Visible Impact

Long scheme names in the coverage matrix (e.g. "Replace Earth's Leaders with
Killbots") now wrap to two lines inside a bounded row-label column instead of
staying on one line and bleeding into the ✓ columns.

## Goal

Fix the WP-466 scheme-name wrap, which did not take effect on the deployed page:
the long scheme name stayed on one line and overflowed into the cell values.
**Root cause (two compounding reasons):** (1) the general
`.coverage-matrix-table th { white-space: nowrap }` rule **out-specifies** the
`.coverage-matrix-rowhead { white-space: normal }` class set on the same `<th>`, so
`nowrap` won; and (2) `max-width` on a `<th>` is **ignored under auto table-layout**,
so the cell expanded to fit the name on one line. Fix: move both the wrap and the
width bound onto an **inner inline-block `<span>`** (which a table cell sizes to and
which auto-layout cannot override). Single-file, presentation-only.

## Assumes

- **On `origin/main` @ `4d528bcc`** (WP-466 merge). `apps/legends-board`
  builds/tests/typechecks green. **WP-466 ✅** shipped the compact matrix
  (mastermind-once group headers, rotated column headings) in `GauntletIndexPanel.vue`.
- The matrix table uses `border-collapse: collapse` with auto table-layout (no
  `table-layout: fixed`), and the general cell rule sets `white-space: nowrap` —
  both confirmed in `GauntletIndexPanel.vue` scoped CSS.

## Context (Read First)

**Read before executing:** the WP-466 matrix CSS in `GauntletIndexPanel.vue`
(`.coverage-matrix-*` — the `.coverage-matrix-rowhead` cell + the general
`.coverage-matrix-table th, td { white-space: nowrap }` rule) and
`docs/ai/ARCHITECTURE.md §Layer Boundary` (legends board is `vue`-only / zero-API).
The wrap was claimed done in WP-466 but a flawed dev-pane measurement (0-width,
non-compositing viewport) masked that it never wrapped on a real viewport
(operator-reported 2026-07-30).

## Scope (In)

- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** (scoped CSS + one
  markup tweak): wrap the scheme name in a `<span class="coverage-matrix-scheme-text">`
  and move the wrap + width bound onto that span
  (`display: inline-block; max-width; white-space: normal; overflow-wrap: anywhere`);
  drop the ineffective `white-space`/`max-width` from `.coverage-matrix-rowhead`.

## Out of Scope

- No change to `buildCoverageMatrix`, the mastermind grouping, the rotated column
  headings, the ✓/link/count-selector behaviour, or any other panel/reveal.
- No server/publisher/snapshot/registry change; no new `fetch`.

## Files Expected to Change

- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** (scheme span
  + scoped CSS)

## Contract

> Full file contents (no diffs); ESM/Node v22+; human-style code per
> `00.6-code-style.md`; `vue`-only / zero-API; scoped CSS + one span only; rendered
> data (✓ cells, links, names, count selector, mastermind grouping, rotated
> headings) unchanged.

**Locked:** the scheme name wraps inside an inline-block span with a bounded
`max-width` (the bound + `white-space: normal` live on the span, not the `<th>`,
because the cell ignores `max-width` and the general `th` rule out-specifies a
class on the `<th>`).

## Acceptance Criteria

- [ ] A long scheme name ("Replace Earth's Leaders with Killbots") wraps to more
      than one line (rendered span height > one line-height at desktop width).
- [ ] The scheme label column is width-bounded (span width ≤ its `max-width`) and
      the scheme cell does not overlap the first ✓ column.
- [ ] A short scheme name ("The Legacy Virus") is unaffected.
- [ ] Mastermind grouping, rotated headings, ✓ cells/links, and the count selector
      are unchanged.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/legends-board test
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board build
pnpm -r build
# Verify at a REAL viewport (resize the pane to desktop; the WP-466 miss was a
# 0-viewport measurement): the long scheme label spans 2 lines and its cell right
# edge does not cross the first ✓ cell's left edge.
```

## Vision Alignment

**Clauses:** §10 (Legends board presentation). No scoring / identity / RNG /
determinism / persistence. **Conflict:** *No conflict* — a layout-only wrap fix.
**NG:** none.

## Definition of Done

- [ ] All Acceptance Criteria pass; legends-board test/typecheck/build + `pnpm -r
      build` green.
- [ ] **D-24026 live-verify (operator-pending):** deployed matrix — long scheme
      names wrap to 2 lines and do not bleed into the ✓ columns.
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` row checked off;
      `ROADMAP-MINDMAP.md` `📝`→`✅` + `pnpm roadmap:counts:write` (`:check` 0);
      `EC_INDEX.md` EC-502 → Done.
- [ ] No files outside the list modified. (No D-entry — presentation-only bug fix.)

## Lint Gate Self-Review

- **§1/§15:** `**User-Visible Surface:**` header + `## User-Visible Impact`; D-24026
  in DoD. PASS. **§2:** Contract full-file / no-diffs / `00.6`. PASS. **§4:** Context
  (Read First) with read-list + root-cause. PASS. **§5:** one file + governance.
  PASS. **§8:** `vue`-only/zero-API, no server/registry import. PASS. **§17:** §10,
  No conflict. PASS. **§20/§21:** N/A. No new contract file; no D-entry.

## Gate Verdicts (drafting session)

Lightweight, operator-reported bug fix completing the WP-466 scheme-wrap AC
(single file, scoped CSS + one span, no data change). Per the lightweight-lane
condensed-gate allowance (`01.0a`), a targeted self-review substitutes for the full
subagent battery:

- **Pre-Flight — READY.** Single file; the WP-466 `.coverage-matrix-rowhead` cell +
  the general `th { white-space: nowrap }` rule + auto table-layout exist as the
  root cause describes; `vue`-only/zero-API; not validation-tightening.
- **Copilot self-review — PASS.** Presentation-only; no data/logic/registry touch;
  the fix (inner inline-block span carrying the bound) is the standard remedy for
  `max-width`-ignored-in-table-cells and the specificity loss; grouping/headings/
  ✓/count unchanged. **Verified at a real viewport** (see STATUS) — not repeating the
  WP-466 0-viewport measurement error.
- **Lint self-review — SATISFIED.** §5 one file + governance; §8 vue-only/zero-API;
  §15 D-24026 live-verify present; §17 §10 No-conflict; §20/§21 N/A; no D-entry.
