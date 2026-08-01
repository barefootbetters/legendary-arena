# WP-477 — Wire the Discard-Choice Gate into TurnActionBar's End-Turn / Pass-Priority

**User-Visible Surface:** `play.legendary-arena.com` — while a Magneto discard-to-limit
choice is pending, the **End Turn** and **Pass Priority** buttons show as disabled with a
tooltip ("Choose which cards to discard before taking another action."), matching every
other pending-choice. **D-24026 live-verification applies** (operator-pending).

## Goal

Complete WP-476's explicitly-deferred cosmetic follow-on. WP-476 added a
`hasPendingDiscardChoice` gate to `useTurnActions` (`canEndTurn` / `canPassPriority`) but
could not wire it into `TurnActionBar.vue`, which was **outside the WP-476 allowlist**. As a
result the gate is inert today: while a Magneto discard choice is pending, the End-Turn /
Pass-Priority buttons still render enabled (clicking them no-ops server-side via the engine
block-all guard). This WP threads the flag through `TurnActionBar.vue` and the two play
pages so the buttons disable-with-tooltip, giving the discard choice the same UX every other
pending choice already has.

## Assumes

- **On `origin/main`:** WP-476 / EC-511 shipped (PR #1130) — `useTurnActions` already
  carries the `hasPendingDiscardChoice` parameter (appended last, position 16) plus the
  `canEndTurn` / `canPassPriority` gate returning the reason *"Choose which cards to discard
  before taking another action."*, and `UIState.pendingDiscardChoice` is projected +
  chooser-only redacted. `PendingDiscardChoicePrompt.vue` is mounted in both play pages.
- Baseline `origin/main` at draft: the WP-476 merge (`967cd323`).
- The engine block-all guard (`hasPendingDiscardChoice` in `advanceStage` / `endTurn` / every
  action move) is already authoritative — this WP changes only the client button state, never
  gameplay outcome.

## Context

WP-476 §STATUS and its PR both flagged this exact boundary: `TurnActionBar.vue` is not in the
WP-476 file allowlist, so the discard gate stops at `useTurnActions`. `useTurnActions` takes
**positional** boolean params, and `TurnActionBar.vue` is the sole caller of its
`canEndTurn` / `canPassPriority` / `canHealWounds` for the play surface. WP-476 appended
`hasPendingDiscardChoice` as the **last** (16th) parameter specifically so no existing
positional caller broke; this WP simply extends `TurnActionBar.vue`'s calls to reach that
16th slot and passes the flag down from the pages. No `useTurnActions.ts` signature change is
needed (the param + gate already exist), which keeps the change minimal and its unit test
(`useTurnActions.test.ts`) untouched.

## Scope (In)

- `apps/arena-client/src/components/play/TurnActionBar.vue`:
  - Add a `hasPendingDiscardChoice: boolean` prop (default `false`), documented like the
    sibling `hasPendingScryKoChoice` prop.
  - Extend the `useTurnActions(...)` calls in `passPriorityGate()` and `endTurnGate()` to pass
    the full positional list through position 16 — i.e. append
    `props.hasWoundInHand, props.hasActedThisTurn, props.hasHealedThisTurn,
    props.hasPendingDiscardChoice` after the existing `props.hasPendingScryKoChoice` (position
    12). Add `props.hasPendingDiscardChoice` as the 16th arg to the existing `canHealWounds`
    call for parity (already passes positions 13–15).
- `apps/arena-client/src/pages/PlayDesktop.vue` + `pages/PlayMobile.vue`:
  - Add a `hasPendingDiscardChoice` computed derived from
    `snapshot.value?.pendingDiscardChoice !== undefined` (mirroring `hasPendingScryKoChoice`),
    return it from `setup`, and pass `:has-pending-discard-choice="hasPendingDiscardChoice"`
    to `<TurnActionBar>`.

## Out of Scope

- Any engine change — the block-all guard is authoritative and unchanged.
- `useTurnActions.ts` signature / gate logic — already shipped by WP-476; not touched.
- The `PendingDiscardChoicePrompt.vue` component and its mounting — already shipped by WP-476.
- Repositioning the `hasPendingDiscardChoice` param within `useTurnActions` (a churn-for-churn
  refactor that would touch the composable + its test for no behavior gain; the last-slot
  position is load-bearing for positional-caller safety).

## Files Expected to Change

- `apps/arena-client/src/components/play/TurnActionBar.vue` — prop + thread into `useTurnActions` calls
- `apps/arena-client/src/pages/PlayDesktop.vue` — computed + prop pass-through
- `apps/arena-client/src/pages/PlayMobile.vue` — computed + prop pass-through
- Governance: `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`

## Contract

> Vue SFC edits; no engine, no contract file, no determinism/persistence surface. The gate
> reason string is the WP-476 locked value *"Choose which cards to discard before taking
> another action."* — reuse verbatim (it already lives in `useTurnActions`; this WP adds no
> new copy).

**Locked:** `hasPendingDiscardChoice` derives from `UIState.pendingDiscardChoice !== undefined`
(mirrors `hasPendingScryKoChoice`); the `useTurnActions` param stays at position 16;
`TurnActionBar` passes it as the 16th positional arg. No new tooltip copy; no engine change.

## Acceptance Criteria

1. `TurnActionBar.vue` declares a `hasPendingDiscardChoice` prop (default `false`) and passes
   it as the 16th positional arg to the `canEndTurn` / `canPassPriority` (and `canHealWounds`)
   `useTurnActions` calls.
2. With `hasPendingDiscardChoice = true`, the End-Turn and Pass-Priority buttons are disabled
   and their tooltip reads *"Choose which cards to discard before taking another action."*
   (a `TurnActionBar` test asserts the disabled state + reason, or the existing gate coverage
   in `useTurnActions.test.ts` already proves the reason and the new test proves the prop
   threading).
3. `PlayDesktop.vue` + `PlayMobile.vue` compute the flag from
   `snapshot.pendingDiscardChoice !== undefined` and pass it to `TurnActionBar`.
4. No engine change. `pnpm --filter @legendary-arena/arena-client test` + `typecheck` green;
   `pnpm -r build` green.

## Verification Steps

```bash
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck
pnpm -r build
# Post-deploy (D-24026): trigger Magneto's Master Strike with a hand that must discard —
# the End Turn / Pass Priority buttons are disabled with the discard tooltip until you resolve.
```

## Vision Alignment

**Clauses:** §10 (client interaction — consistent, legible affordances). **Conflict:** *No
conflict* — completes the WP-476 UX so the discard choice matches every other pending choice.
**NG:** none.

## Definition of Done

- [ ] All 4 AC pass; arena-client test + typecheck + `pnpm -r build` green.
- [ ] STATUS (or the WP-476 boundary note updated); WORK_INDEX `[x]`; MINDMAP `📝`→`✅` +
      `roadmap:counts:write`; EC_INDEX EC-512 → Done.
- [ ] **D-24026 live-verify (operator-pending):** the buttons disable while a discard is pending.
- [ ] No file outside the allowlist (+ governance).

## Lint Gate Self-Review (`00.3`)

- §1/§15: header + User-Visible Surface; D-24026 present. PASS. §2: full-file/no-diffs/`00.6`.
  PASS. §4: read-list (WP-476 `useTurnActions` + `TurnActionBar` + the two pages). PASS. §5:
  closed allowlist, arena-client only, single layer. PASS. §8: client projects; no engine/layer
  leak. PASS. §17: §10, No conflict. PASS. §20 N/A — no funding surface. §21 N/A — no
  `apps/server` HTTP endpoint or catalogued Library-only fn. No contract change (reuses the
  WP-476 `useTurnActions` param + gate; no new type / move / `G` field). No new D-entry (UX
  parity, no invariant). §Drift: N/A — no canonical array touched.

## Gate Verdicts (drafting session)

- **Pre-flight (`01.4`):** READY TO EXECUTE — dependency WP-476 shipped on `main` (#1130);
  scope locked to 3 arena-client files; cited authority (`useTurnActions` param + gate) is on
  `main`; no ambiguity.
- **Lint (`00.3`):** PASS — see §Lint Gate Self-Review (§20/§21 N/A).
- **Lightweight-lane eligibility:** single app, 3 code files, strictly additive (a prop + a
  computed + one arg per call), no contract file, no determinism/hash surface, narrow UX —
  eligible; runs as one session (draft → implement → govern-close → one PR).
