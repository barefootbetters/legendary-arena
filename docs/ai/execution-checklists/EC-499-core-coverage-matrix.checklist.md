# EC-499 — Core Set Gauntlet-Coverage Matrix (Execution Checklist)

**Source:** docs/ai/work-packets/WP-464-core-coverage-matrix.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API, `vue`-only runtime

## Before Starting
- [ ] On `origin/main` @ `fa3c0007` (or later), worktree clean.
- [ ] Hard-deps on `main`: WP-461 ✅ + WP-462 ✅ (`sets` roster published + mirrored)
      + WP-395 ✅ (`approvedLoadouts` + `legs` published).
- [ ] `gauntletDisplay.ts` exposes `buildChallengeUrl`, `selectApprovedLoadout`,
      `findSetDetails`, `groupGauntletsBySet`; `GauntletIndexPanel.vue` has the
      `selectionFor`/`onPlayerCountChange` per-row selector pattern to mirror.
- [ ] legends-board test/typecheck/build + `pnpm -r build` green.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `gauntletDisplay.ts`
      (+`.test.ts`), `GauntletIndexPanel.vue` (+ governance).

## Locked Values (do not re-derive)
- **Transposed axes:** rows = mastermind × scheme (mastermind-major, scheme order
  as published in `legs`); columns = villains (roster order) then henchmen.
- **Cell:** ✓ + challenge link iff the column adversary's `${setAbbr}/${slug}` is in
  the mastermind's approved config at the selected count; else empty (no link).
- **Count selector:** default `2`, options `1..5`; own per-set state (NOT the row
  download selector's).
- **Link:** `buildChallengeUrl(setAbbr, schemeSlug, mastermindSlug, count,
  selectApprovedLoadout(entry, count))`.
- **Core-only render guard** (`setGroup.setAbbr === 'core'`); absent SetDetails /
  approvedLoadouts → no matrix, no throw.
- **Coverage source = `selectApprovedLoadout(entry, count)`**, NEVER
  `SetAdversaryGroup.usedByGauntlets` (that flag is per-*set* and would over-mark).
  A count whose `selectApprovedLoadout` is `undefined` (missing/empty count key) →
  every cell in that mastermind's rows uncovered, no throw.
- **Accessibility:** the count `<select>` carries an `aria-label`; each ✓ link
  carries an accessible name naming its destination ("Play {scheme} vs {adversary}
  at {n}-player") with the ✓ glyph `aria-hidden` — mirror the existing
  `coverageLabel` / `aria-label` conventions in this component.

## Guardrails
- Runtime deps stay `{ vue }`; no registry import (type or value at runtime); no new
  `fetch`; no publisher/snapshot/server change.
- `buildCoverageMatrix` is pure (no side effects); `for...of`, no `.reduce()`;
  reuse `buildChallengeUrl`/`selectApprovedLoadout` — do not re-derive URLs or the
  per-count config.
- Scoped CSS; `overflow-x: auto` on the table wrapper as a safety net; keep the
  native `<details>` keyboard-accessible; empty cells have an accessible empty
  state (not a bare blank that reads as missing data).
- Do NOT touch the WP-462 per-set reveal, WP-456 per-mastermind reveal, count
  chips, challenge CTAs, download control, or kiosk cycling.

## Required `// why:` Comments
- Why the matrix is Core-only (operator pilot; the builder is generic).
- Why the ✓ pattern repeats across a mastermind's scheme-rows (approved config is
  per mastermind × count, not per scheme; only the per-leg link differs).
- Why the count selector holds its own state, separate from the row download one.

## Files to Produce
- `apps/legends-board/src/panels/gauntletDisplay.ts` — `buildCoverageMatrix` + types.
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — columns/kinds, covered
  vs empty cell, count sensitivity (1p vs 5p), absent-data → empty no-throw, and a
  count with no approved config (undefined `selectApprovedLoadout`) → that
  mastermind's cells all uncovered, no throw.
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — collapsible matrix +
  count selector at the bottom of the Core group.

## After Completing
- [ ] legends-board test / typecheck / build + `pnpm -r build` exit 0.
- [ ] **D-24026 live-verify (operator-pending):** deployed Core matrix shows correct
      ✓s + working challenge links (2p default, widens at 5p).
- [ ] STATUS updated; WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-499 Done. (No D-entry — presentation-only.)
- [ ] No file outside the allowlist (+ governance) modified.

## Common Failure Smells
- Matrix renders for every set → the `setGroup.setAbbr === 'core'` guard is missing.
- A cell links but shows no ✓ (or vice versa) → the covered flag and the
  challenge-link presence disagree; both derive from the same coverage test.
- The count selector also moves the download selector (or vice versa) → shared
  state; give the matrix its own count ref.
- ✓ marks don't change with the count → the matrix reads a fixed count instead of
  the selector value.
