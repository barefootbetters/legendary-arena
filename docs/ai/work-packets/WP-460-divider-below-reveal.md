# WP-460 — Move the Row Divider Below the "Show Details" Reveal Panel (Legends Board)

**User-Visible Surface:** `legends.legendary-arena.com` (the WP-456 "Show details"
reveal on the gauntlet index). The horizontal divider that sat **above** the
expanded reveal (a `border-top` on `.gauntlet-details`, separating the row's
controls from the panel) is removed, so the only horizontal divider is the row's
own `border-bottom`, which sits **below** the expanded panel. **D-24026
live-verification applies** (operator-pending on deploy).

## Goal

Remove the divider line above the "Show details" panel so the horizontal divider
reads as being **below** the dropped panel (operator request, 2026-07-30, on the
just-shipped WP-459 layout). One-line CSS change: drop `border-top` (+ its
`padding-top`) from `.gauntlet-details`; the row's `border-bottom` already sits
below the expanded reveal (the reveal wraps onto the row's own line, WP-459), so
it becomes the sole, correctly-placed divider.

## Assumes

- **On `origin/main` @ `7757a8db`** (WP-459 merge). `apps/legends-board`
  builds/tests/typechecks green.
- **WP-459 landed:** the reveal wraps onto its own full-width line inside the
  `.gauntlet-row` (`flex-wrap: wrap`), and `.gauntlet-row` carries the
  `border-bottom` row separator — which is therefore below the expanded reveal.
  `.gauntlet-details` carries a `border-top` (the above-panel line this WP
  removes). (Source: `GauntletIndexPanel.vue` on `main`.)
- `apps/legends-board` is `vue`-only / zero-API; this touches only scoped CSS.

## Scope (In)

- **`apps/legends-board/src/panels/GauntletIndexPanel.vue`** (modified,
  scoped-CSS-only): remove `border-top: 1px solid var(--la-color-border-subtle)`
  and its `padding-top` from `.gauntlet-details` (keep `margin-top` for spacing),
  with a `// why:` noting the row `border-bottom` is the divider and sits below the
  panel.

## Out of Scope

- No change to the reveal grid/content, the row's `border-bottom`, or any other
  panel; no data/helper/registry change; no `fetch`. Presentation-only.

## Files Expected to Change

- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** — remove
  the `.gauntlet-details` `border-top` / `padding-top`.

## Contract

> Full file contents (no diffs); ESM/Node v22+; scoped CSS; `vue`-only/zero-API;
> rendered content unchanged (layout/border only).

**Locked values:** remove `.gauntlet-details` `border-top` + `padding-top`; keep
`margin-top`; the row `border-bottom` remains the divider (below the panel).

## Acceptance Criteria

- [ ] `.gauntlet-details` has no `border-top` (computed `border-top-width: 0`).
- [ ] The row's `border-bottom` (the horizontal divider) sits **below** the
      expanded reveal body.
- [ ] No new registry import / `fetch`; runtime deps stay `{ vue }`.
- [ ] `pnpm --filter @legendary-arena/legends-board test`, `typecheck`, `build`
      exit 0; `pnpm -r build` exits 0.
- [ ] No file outside `GauntletIndexPanel.vue` (+ governance) is modified.

## Verification Steps

```bash
pnpm --filter @legendary-arena/legends-board test    # unchanged (data untouched)
pnpm --filter @legendary-arena/legends-board typecheck
pnpm --filter @legendary-arena/legends-board build
pnpm -r build
# Live smoke (D-24026): expand a mastermind's "Show details" — the horizontal
# divider is BELOW the panel, no line above it.
```

## Vision Alignment

**Clauses:** §10 (Legends board presentation). No scoring/identity/RNG/determinism/
persistence. **Conflict:** *No conflict* — a border-position-only restyle of a
read-only reveal. **NG:** none.

## Definition of Done

- [ ] All Acceptance Criteria pass; legends-board test/typecheck/build + `pnpm -r
      build` green.
- [ ] **D-24026 live-verify (operator-pending):** deployed reveal shows the divider
      below the panel.
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` row checked off; `ROADMAP-MINDMAP.md`
      `📝`→`✅` + `pnpm roadmap:counts:write` (`:check` 0); `EC_INDEX.md` EC-495 → Done.
- [ ] No files outside the list modified. (No D-entry — UI polish.)

---

## Gate Verdicts (drafting session)

Lightweight, operator-directed one-line CSS refinement of the just-merged WP-459.
Per the lightweight-lane condensed-gate allowance (`01.0a`), a targeted
self-review substitutes for the full subagent battery:

- **Pre-Flight — READY.** Single file (`GauntletIndexPanel.vue`); the
  `.gauntlet-details` `border-top` and the `.gauntlet-row` `border-bottom` exist
  as described; `vue`-only/zero-API; not validation-tightening.
- **Copilot self-review — PASS.** Presentation-only; no data/logic/registry/network
  touch; the row `border-bottom` (below the panel) is preserved as the divider;
  no scope creep. **Browser-verified live:** `.gauntlet-details` computed
  `border-top-width: 0px`, row `border-bottom: 1px` below the expanded reveal, no
  overflow, no console errors.
- **Lint self-review — SATISFIED.** §5 = one file + governance; §8 vue-only/zero-API;
  §15.1 D-24026 deployed live-verify present; §17 §10 No-conflict; §18/§20/§21 N/A.
