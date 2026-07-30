# EC-495 — Move the Row Divider Below the "Show Details" Reveal Panel (Execution Checklist)

**Source:** docs/ai/work-packets/WP-460-divider-below-reveal.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API, scoped-CSS-only

## Before Starting
- [ ] On `origin/main` @ `7757a8db` (WP-459 merge), worktree clean.
- [ ] `GauntletIndexPanel.vue` `.gauntlet-details` has `border-top` + `padding-top`;
      `.gauntlet-row` has `flex-wrap: wrap` + `border-bottom` (WP-459).
- [ ] legends-board test/typecheck/build + `pnpm -r build` green.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `GauntletIndexPanel.vue`
      (+ governance).

## Locked Values (do not re-derive)
- Remove `.gauntlet-details` `border-top` + `padding-top`; KEEP `margin-top`.
- Do NOT touch the row `border-bottom` — it is the divider and already sits below
  the expanded reveal (WP-459's `flex-wrap: wrap`).
- Presentation-only; rendered text/content unchanged.

## Guardrails
- Scoped CSS only; `vue`-only/zero-API; no registry import, no `fetch`, no data change.
- Do NOT change the reveal grid, content, or any other panel.

## Required `// why:` Comments
- Why no border above the reveal (the row `border-bottom` is the divider, below
  the expanded panel).

## Files to Produce
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** — remove
  the `.gauntlet-details` `border-top` / `padding-top`.

## After Completing
- [ ] legends-board test/typecheck/build + `pnpm -r build` exit 0.
- [ ] **D-24026 live-verify (operator-pending):** deployed reveal shows the divider
      below the panel, none above.
- [ ] STATUS updated; WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-495 Done. (No D-entry.)
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) modified.

## Common Failure Smells
- A line still shows above the panel → the `border-top` wasn't removed.
- The rows no longer separate → the row `border-bottom` was removed by mistake (it
  must stay — it is the divider).
