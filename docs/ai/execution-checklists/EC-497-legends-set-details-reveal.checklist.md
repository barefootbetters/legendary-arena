# EC-497 — Legends Board Per-Set "Show Set Details" Reveal (Execution Checklist)

**Source:** docs/ai/work-packets/WP-462-legends-set-details-reveal.md
**Layer:** App (`apps/legends-board`) — client-only, zero-API, `vue`-only runtime

## Before Starting
- [ ] WP-461 merged to `main` (the `sets` snapshot field exists + deploying).
- [ ] On `origin/main` (post-WP-461), worktree clean.
- [ ] `snapshotClient.ts` mirrors server snapshot types (does NOT import them);
      `GauntletIndexPanel.vue` renders the WP-456 per-mastermind reveal +
      `groupGauntletsBySet` groups by set.
- [ ] legends-board test/typecheck/build + `pnpm -r build` green.
- [ ] **Exact target file set (any file outside = FAIL, STOP):** `snapshotClient.ts`,
      `gauntletDisplay.ts` (+`.test.ts`), `GauntletIndexPanel.vue` (+ governance).

## Locked Values (do not re-derive)
- Mirror WP-461's types **field-for-field** (drift lock — copied here verbatim):
  ```ts
  interface SetNamedGroup { readonly slug: string; readonly name: string; }
  interface SetAdversaryGroup { readonly slug: string; readonly name: string; readonly usedByGauntlets: boolean; }
  interface SetDetails {
    readonly setAbbr: string; readonly setName: string;
    readonly masterminds: readonly SetNamedGroup[]; readonly schemes: readonly SetNamedGroup[];
    readonly villains: readonly SetAdversaryGroup[]; readonly henchmen: readonly SetAdversaryGroup[];
  }
  // GauntletIndexSnapshot mirror gains:  readonly sets?: readonly SetDetails[];
  ```
  Mirror only — never import the server module (layer boundary).
- Render `SetDetails` verbatim; DO NOT recompute `usedByGauntlets` on the client.
- The ✓/✗ coverage meaning is PER-SET-SCOPED: an `aria-label`/visually-hidden span
  reads "used by this set's gauntlets" / "not used by this set's gauntlets" — never
  the unscoped "any gauntlet", never colour alone, never `title` alone (`title`
  isn't reliably exposed to AT/keyboard).
- Absent `sets` (old snapshot) → render no reveal, no throw, no console error.

## Guardrails
- Runtime deps stay `{ vue }`; no registry import (type or value at runtime); no
  new `fetch` (only the existing R2 reads).
- Scoped CSS only; reuse WP-459's grid tokens; keep the native `<details>`
  keyboard-accessible.
- `findSetDetails` is pure (no side effects); use `for...of`, no `.reduce()`.
- Do NOT touch the WP-456 per-mastermind reveal, standings panels, challenge
  links, download control, or kiosk cycling.

## Required `// why:` Comments
- Why the types are mirrored, not imported (zero-API layer boundary).
- Why the client renders the flag verbatim (coverage truth is WP-461's, computed
  once server-side).
- Why an absent `sets` degrades to no-reveal (pre-WP-461 snapshot on the CDN).

## Files to Produce
- `apps/legends-board/src/snapshots/snapshotClient.ts` — mirror types + `sets?`.
- `apps/legends-board/src/panels/gauntletDisplay.ts` — `findSetDetails`.
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — hit/miss/undefined.
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — per-set reveal.

## After Completing
- [ ] legends-board test / typecheck / build + `pnpm -r build` exit 0.
- [ ] **D-24026 live-verify (operator-pending):** deployed board shows the per-set
      reveal with correct ✓/✗ (after WP-461's snapshot propagates).
- [ ] STATUS updated; WORK_INDEX row checked; MINDMAP `📝`→`✅` + counts:write;
      EC_INDEX EC-497 Done. (No D-entry.)
- [ ] No file outside the allowlist (+ governance) modified.

## Common Failure Smells
- Reveal never appears though `sets` is published → the panel looked up
  `SetDetails` by the wrong key (use the group's `setAbbr`).
- ✓/✗ conveyed by colour only → fails the accessibility lock; add title/aria-label.
- vue-tsc breaks on `sets` → the local mirror type wasn't extended (add the
  optional field to the `GauntletIndexSnapshot` mirror, not the server type).
