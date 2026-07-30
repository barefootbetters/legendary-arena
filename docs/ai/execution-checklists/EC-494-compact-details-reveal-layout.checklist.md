# EC-494 — Compact Multi-Column "Show Details" Reveal Layout (Execution Checklist)

**Source:** docs/ai/work-packets/WP-459-compact-details-reveal-layout.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API, presentation-only

## Before Starting
- [ ] On `origin/main` @ `4e0f3261`, worktree clean.
- [ ] The WP-456 reveal exists: `GauntletIndexPanel.vue` `<details class="gauntlet-details">`
      renders `gauntletDetails(gauntlet)` with `.gauntlet-details-body` (flex
      column) → `.gauntlet-details-count` blocks → `.gauntlet-details-configs` →
      `.gauntlet-details-config` (Villains span + Henchmen span); scoped styles in
      the same file.
- [ ] `apps/legends-board` runtime deps `{ vue }` only; board pins `data-theme="dark"`;
      panel uses `--la-color-*` tokens.
- [ ] `pnpm --filter @legendary-arena/legends-board test`/`typecheck`/`build` +
      `pnpm -r build` green (run `pnpm install` first if the registry devDep is stale).
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `GauntletIndexPanel.vue`
      (+ governance).

## Locked Values (do not re-derive)
- `.gauntlet-details-body` becomes a **responsive grid**
  (`repeat(auto-fit, minmax(~13rem, 1fr))`); the **Schemes** line spans full width
  above the count grid.
- Tighten gaps; Villains/Henchmen on tight adjacent lines (not widely-spaced stacks).
- **Content-preserving:** the rendered TEXT (schemes + `Villains:`/`Henchmen:`
  labels/values from WP-456) is unchanged — layout/spacing only.
- Reuse `--la-color-*` tokens; no theme change. Responsive: single column + no
  horizontal overflow on narrow viewports.

## Guardrails
- **Presentation only** — do NOT touch `buildGauntletDetails`, `gauntletDisplay.ts`,
  the data, or any other reveal content. No registry import, no `fetch`.
- **No change** to the challenge link, download control, chips, or claimed-board
  links — only the details reveal's layout.
- **Keep the native `<details>`** (keyboard-accessible); minor markup regrouping
  to support the grid is OK, but the text content stays identical.
- `vue`-only / zero-API preserved; runtime deps stay `{ vue }`.
- No horizontal overflow at mobile width (the grid must collapse to one column).
- **Long-name overflow guard:** apply `min-width: 0` (and/or
  `overflow-wrap: anywhere`) to the grid items so an unbreakable long adversary
  name cannot force a track wider than its column and reintroduce horizontal
  scroll (the residual overflow vector at grid width).

## Required `// why:` Comments
- Why `.gauntlet-details-body` is a grid with the Schemes line spanning full width
  (compactness — the stacked single column produced ~40 rows of whitespace/scroll).

## Files to Produce
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** — reveal
  `<style scoped>` grid + tightened spacing + minor supporting markup regrouping.

## After Completing
- [ ] `pnpm --filter @legendary-arena/legends-board test` exits 0 (data untouched — unchanged).
- [ ] `pnpm --filter @legendary-arena/legends-board typecheck` + `build` exit 0; `pnpm -r build` 0.
- [ ] `apps/legends-board/package.json` runtime deps STILL `{ vue }`.
- [ ] **D-24026 live-verify (operator-pending):** deployed reveal renders compact
      multi-column (no ~40-row single column / excess scroll on desktop); mobile
      single-column, no horizontal overflow; content matches WP-456.
- [ ] STATUS updated; WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-494 Done. (No D-entry.)
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) modified.

## Common Failure Smells
- Horizontal scrollbar on mobile → the grid didn't collapse; use
  `minmax(<rem>, 1fr)` with `auto-fit`, not fixed columns.
- The reveal text changed → out of scope; only layout/spacing may change.
- A `gauntletDisplay.ts` / data file appears in the diff → presentation-only was violated.
- Colors hardcoded / theme drift → reuse the existing `--la-color-*` tokens.
