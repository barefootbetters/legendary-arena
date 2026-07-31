# EC-503 — Coverage-Matrix Dropdown Readability + Collapsible Masterminds (Execution Checklist)

**Source:** docs/ai/work-packets/WP-468-matrix-dropdown-collapse.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API, scoped CSS + template

## Before Starting
- [ ] On `origin/main` @ `e7bc018b` (or later), worktree clean.
- [ ] WP-464/466/467 ✅ on `main` (the coverage matrix with `isMatrixMastermindStart`
      group-header rows + rotated headings + scheme-wrap); the `.download-select`
      control (WP-441) exists in `GauntletIndexPanel.vue`.
- [ ] legends-board test/typecheck/build + `pnpm -r build` green.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `GauntletIndexPanel.vue`
      (+ governance).

## Locked Values (do not re-derive)
- **Dropdown option:** `.download-select option { color: <dark, e.g. #111827>;
  background: <light, e.g. #fff> }` — the closed `.download-select` keeps its
  existing light-on-dark styling.
- **Collapse:** a reactive `expandedMasterminds` record + `isMastermindExpanded(slug)`
  / `toggleMastermind(slug)`; the mastermind group-header `<th>` wraps its label in a
  full-width `<button class="coverage-matrix-mm-toggle">` with `:aria-expanded` and a
  caret (▸ collapsed / ▾ expanded); the scheme `<tr>` is `v-if="isMastermindExpanded(
  row.mastermindSlug)"`. **Default collapsed** (empty record).

## Guardrails
- Presentation-only: DO NOT touch `buildCoverageMatrix`, the approved-loadout data,
  the ✓/link/count logic, the rotated headings, or the scheme-wrap.
- `vue`-only / zero-API; no registry import; no new `fetch`; scoped CSS only.
- The toggle is a real `<button>` (keyboard-operable) with `aria-expanded`; the caret
  glyph is `aria-hidden`.

## Required `// why:` Comments
- Why the option colour is set explicitly (native dropdown popup renders on a light
  OS background; the dark-theme light text was invisible until hover).
- Why the mastermind header toggles its scheme rows (open compact; avoid the 32-row
  scroll; keep headings lined up).

## Files to Produce
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — `.download-select option`
  CSS; the collapse state + `isMastermindExpanded`/`toggleMastermind`; the toggle
  `<button>` header + `v-if` scheme rows + toggle/caret CSS.

## After Completing
- [ ] legends-board test / typecheck / build + `pnpm -r build` exit 0.
- [ ] **D-24026 live-verify (operator-pending):** deployed dropdown values readable
      (dark, not white-until-hover); masterminds collapse/expand.
- [ ] STATUS updated; WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-503 Done. (No D-entry.)
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) modified.

## Common Failure Smells
- Options still white-until-hover → the colour was set on the `<select>` not the
  `<option>` (the popup uses the option colour).
- Closed select value went dark/invisible on the dark toolbar → an over-broad rule
  set the `.download-select` colour instead of only `.download-select option`.
- Clicking a mastermind does nothing → the scheme `<tr>` `v-if` isn't wired to
  `isMastermindExpanded`, or the header wasn't made a real `<button>`.
