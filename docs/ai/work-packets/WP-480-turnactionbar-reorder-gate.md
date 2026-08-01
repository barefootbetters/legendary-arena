# WP-480 — Wire the Reorder-Choice Gate into TurnActionBar's End-Turn / Pass-Priority

**User-Visible Surface:** `play.legendary-arena.com` — while a reveal-remainder reorder
choice is pending, the **End Turn** and **Pass Priority** buttons show as disabled with a
tooltip ("Choose the order to put the cards back on top before taking another action."),
matching every other pending-choice. **D-24026 live-verification applies**
(operator-pending).

## Goal

Complete WP-479's explicitly-deferred cosmetic follow-on. WP-479 shipped the
reveal-remainder reorder prompt + the engine block-all guard but deferred the client
End-Turn UX gate, so while a reorder choice is pending the End-Turn / Pass-Priority buttons
still render enabled (clicking them no-ops server-side via the engine block-all guard). This
WP adds the `hasPendingReorderChoice` param + gate to `useTurnActions`, threads it through
`TurnActionBar.vue` and the two play pages, so the buttons disable-with-tooltip, giving the
reorder choice the same UX every other pending choice already has.

## Assumes

- **On `origin/main`:** WP-479 / EC-514 shipped (PR #1137) — `UIState.pendingReorderChoice`
  is projected + chooser-only redacted, `PendingReorderChoicePrompt.vue` is mounted in both
  play pages, and the engine block-all guard (`hasPendingReorderChoice` in `advanceStage` /
  `endTurn` / every action move) is authoritative. This WP changes only the client button
  state, never gameplay outcome.
- Baseline `origin/main` at draft: the WP-479 merge (`fc4c136c`).
- Unlike WP-476→WP-477 (where the `useTurnActions` param already existed), WP-479 deferred
  the whole gate, so this WP ALSO adds the `hasPendingReorderChoice` param + `canEndTurn` /
  `canPassPriority` gate to `useTurnActions` (appended LAST, position 17, after
  `hasPendingDiscardChoice`) — mirroring the WP-476 discard gate exactly.

## Context

`useTurnActions` takes **positional** boolean params; `TurnActionBar.vue` is the sole caller
of its `canEndTurn` / `canPassPriority` / `canHealWounds` for the play surface. The new
`hasPendingReorderChoice` is appended as the **last** (17th) parameter so no existing
positional caller breaks; `TurnActionBar.vue`'s three calls that already reach position 16
(`passPriorityGate` / `endTurnGate` / `healGate`) extend to position 17, and the pages pass
the flag down. This is the exact shape of the WP-476 discard gate + WP-477 wiring, collapsed
into one lightweight-lane session (the reorder gate did not exist yet, so the composable and
the wiring land together).

## Scope (In)

- `apps/arena-client/src/composables/useTurnActions.ts`:
  - Add a `hasPendingReorderChoice: boolean = false` param (position 17, after
    `hasPendingDiscardChoice`), documented like the sibling param.
  - Add the block in `canPassPriority` and `canEndTurn` (after the discard block) returning
    the reason *"Choose the order to put the cards back on top before taking another
    action."* at ANY stage — mirroring `hasPendingDiscardChoice`.
- `apps/arena-client/src/composables/useTurnActions.test.ts`:
  - Add a `hasPendingReorderChoice` gating describe (canEndTurn + canPassPriority blocked at
    every stage with the locked reason), mirroring the WP-476 discard-gate test.
- `apps/arena-client/src/components/play/TurnActionBar.vue`:
  - Add a `hasPendingReorderChoice: boolean` prop (default `false`).
  - Extend the `useTurnActions(...)` calls in `passPriorityGate()`, `endTurnGate()`, and
    `canHealWounds`'s `healGate()` to pass `props.hasPendingReorderChoice` as the 17th arg
    (after `props.hasPendingDiscardChoice`).
- `apps/arena-client/src/pages/PlayDesktop.vue` + `pages/PlayMobile.vue`:
  - Add a `hasPendingReorderChoice` computed derived from
    `snapshot.value?.pendingReorderChoice !== undefined` (mirroring `hasPendingDiscardChoice`),
    return it from `setup`, and pass `:has-pending-reorder-choice="hasPendingReorderChoice"`
    to `<TurnActionBar>`.

## Out of Scope

- Any engine change — the block-all guard is authoritative and unchanged.
- The `PendingReorderChoicePrompt.vue` component and its mounting — already shipped by WP-479.
- `canHealWounds`'s pending-cluster logic — the discard gate isn't in that cluster either;
  the reorder flag is threaded positionally to reach slot 17 but not read by heal (parity
  with discard). The engine block-all still no-ops heal server-side.

## Files Expected to Change

- `apps/arena-client/src/composables/useTurnActions.ts` — param + gate
- `apps/arena-client/src/composables/useTurnActions.test.ts` — gate test
- `apps/arena-client/src/components/play/TurnActionBar.vue` — prop + thread into the calls
- `apps/arena-client/src/pages/PlayDesktop.vue` — computed + prop pass-through
- `apps/arena-client/src/pages/PlayMobile.vue` — computed + prop pass-through
- Governance: `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`

## Contract

> Vue SFC / composable edits; no engine, no contract file, no determinism/persistence
> surface. The gate reason string *"Choose the order to put the cards back on top before
> taking another action."* is the new locked value (mirrors the discard gate's copy shape).

**Locked:** `hasPendingReorderChoice` derives from `UIState.pendingReorderChoice !== undefined`
(mirrors `hasPendingDiscardChoice`); the `useTurnActions` param is position 17;
`TurnActionBar` passes it as the 17th positional arg. No engine change.

## Acceptance Criteria

1. `useTurnActions` gains a `hasPendingReorderChoice` param (position 17) and blocks
   `canEndTurn` / `canPassPriority` at any stage with the locked reason (unit test asserts
   both, every stage).
2. `TurnActionBar.vue` declares a `hasPendingReorderChoice` prop (default `false`) and passes
   it as the 17th positional arg to the `canEndTurn` / `canPassPriority` / `canHealWounds`
   `useTurnActions` calls.
3. `PlayDesktop.vue` + `PlayMobile.vue` compute the flag from
   `snapshot.pendingReorderChoice !== undefined` and pass it to `TurnActionBar`.
4. No engine change. `pnpm --filter @legendary-arena/arena-client test` + `typecheck` green;
   `pnpm -r build` green.

## Verification Steps

```bash
pnpm --filter @legendary-arena/arena-client test
pnpm --filter @legendary-arena/arena-client typecheck
pnpm -r build
# Post-deploy (D-24026): play The Amazing Spider-Man with a ≥2 non-drawn remainder — the
# End Turn / Pass Priority buttons are disabled with the reorder tooltip until you resolve.
```

## Vision Alignment

**Clauses:** §10 (client interaction — consistent, legible affordances). **Conflict:** *No
conflict* — completes the WP-479 UX so the reorder choice matches every other pending choice.
**NG:** none.

## Definition of Done

- [ ] All 4 AC pass; arena-client test + typecheck + `pnpm -r build` green.
- [ ] WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + `roadmap:counts:write`; EC_INDEX EC-515 → Done.
- [ ] **D-24026 live-verify (operator-pending):** the buttons disable while a reorder is pending.
- [ ] No file outside the allowlist (+ governance).

## Lint Gate Self-Review (`00.3`)

- §1/§15: header + User-Visible Surface; D-24026 present. PASS. §2: full-file/no-diffs/`00.6`.
  PASS. §4: read-list (WP-476 discard gate in `useTurnActions` + WP-477 `TurnActionBar`
  wiring + the two pages + WP-479 `pendingReorderChoice` projection). PASS. §5: closed
  allowlist, arena-client only, single layer. PASS. §8: client projects; no engine/layer
  leak. PASS. §17: §10, No conflict. PASS. §20 N/A — no funding surface. §21 N/A — no
  `apps/server` HTTP endpoint or catalogued Library-only fn. No contract change (a composable
  param + a Vue prop; no new type / move / `G` field). No new D-entry (UX parity, no
  invariant — the mechanic + its decision are D-24286). §Drift: N/A — no canonical array touched.

## Gate Verdicts (drafting session)

- **Pre-flight (`01.4`):** READY TO EXECUTE — dependency WP-479 shipped on `main` (#1137);
  scope locked to 5 arena-client files; cited authority (the WP-476 discard gate + WP-477
  wiring pattern + WP-479 `pendingReorderChoice` projection) is on `main`; no ambiguity.
- **Lint (`00.3`):** PASS — see §Lint Gate Self-Review (§20/§21 N/A).
- **Lightweight-lane eligibility:** single app, ≤4 code files + a test, strictly additive (a
  param + a gate + a prop + a computed + one arg per call), no contract file, no
  determinism/hash surface, narrow UX — eligible; runs as one session (draft → scaffold →
  implement → govern-close → one PR). Scaffold: arena-client `test` 1136/0 + `typecheck`
  clean, observed before govern-close.
