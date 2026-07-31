# EC-502 — Fix the Coverage-Matrix Scheme-Name Wrap (Execution Checklist)

**Source:** docs/ai/work-packets/WP-467-matrix-scheme-wrap-fix.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API, scoped CSS + markup

## Before Starting
- [ ] On `origin/main` @ `4d528bcc` (or later), worktree clean.
- [ ] WP-466 ✅ on `main` (the compact matrix: `.coverage-matrix-*` CSS, the general
      `.coverage-matrix-table th, td { white-space: nowrap }` rule, auto table-layout).
- [ ] legends-board test/typecheck/build + `pnpm -r build` green.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `GauntletIndexPanel.vue`
      (+ governance).

## Locked Values (do not re-derive)
- The scheme name goes in an inner `<span class="coverage-matrix-scheme-text">`.
- The wrap + width bound live on THAT SPAN:
  `display: inline-block; max-width: 8.5rem; white-space: normal; overflow-wrap: anywhere`.
  NOT on the `<th>` — the cell ignores `max-width` under auto table-layout and the
  general `th` rule out-specifies a class on the `<th>`.
- `.coverage-matrix-rowhead` keeps only `text-align: left` + colour (drop its
  ineffective `white-space`/`max-width`).

## Guardrails
- Presentation-only: DO NOT touch `buildCoverageMatrix`, the mastermind grouping,
  the rotated column headings, or the ✓/link/count-selector logic.
- `vue`-only / zero-API; no registry import; no new `fetch`; scoped CSS only.
- Do NOT switch the table to `table-layout: fixed` (would resize every column) —
  bound only the scheme span.

## Required `// why:` Comments
- Why the wrap + bound live on the inner span, not the `<th>` (max-width ignored in
  table cells + the general `th { white-space: nowrap }` specificity).

## Files to Produce
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — the scheme `<span>` +
  `.coverage-matrix-scheme-text` scoped CSS; trim `.coverage-matrix-rowhead`.

## After Completing
- [ ] legends-board test / typecheck / build + `pnpm -r build` exit 0.
- [ ] Verify at a REAL viewport (not the WP-466 0-viewport mistake): the long
      scheme label wraps to 2 lines and its cell does not overlap the first ✓ cell.
- [ ] **D-24026 live-verify (operator-pending):** deployed matrix — long scheme
      names wrap, no bleed into the ✓ columns.
- [ ] STATUS updated; WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-502 Done. (No D-entry.)
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) modified.

## Common Failure Smells
- Scheme name still on one line → the wrap/bound was left on the `<th>` (ignored),
  or the span lacks `display: inline-block` (so `max-width` doesn't bound it).
- Scheme label bleeds into ✓ cells → the span's `max-width` is missing or the
  `white-space: normal` didn't win (must be on the span, not the `<th>`).
- Every column got narrower/rearranged → someone switched to `table-layout: fixed`
  (out of scope).
