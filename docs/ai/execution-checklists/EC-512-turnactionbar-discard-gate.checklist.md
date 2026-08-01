# EC-512 — Wire the Discard-Choice Gate into TurnActionBar (Execution Checklist)

**Source:** docs/ai/work-packets/WP-477-turnactionbar-discard-gate.md
**Layer:** arena-client (client UX only) — **lightweight lane** (one session, one PR)

## Before Starting
- [ ] On `origin/main` (WP-476 / EC-511 shipped via #1130 — `useTurnActions` already carries
      the `hasPendingDiscardChoice` param at position 16 + the `canEndTurn`/`canPassPriority`
      gate; `UIState.pendingDiscardChoice` projected + chooser-only filtered;
      `PendingDiscardChoicePrompt.vue` mounted). Baseline `967cd323`. arena-client green.
- [ ] **Exact target file set (any outside = FAIL, STOP):** `components/play/TurnActionBar.vue`,
      `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` (+ governance: WORK_INDEX, EC_INDEX,
      MINDMAP, NUMBER-LEDGER). Do **not** touch `useTurnActions.ts`, the engine, or the prompt.

## Locked Values (do not re-derive)
- `hasPendingDiscardChoice` = `UIState.pendingDiscardChoice !== undefined` (mirror
  `hasPendingScryKoChoice`).
- The `useTurnActions` `hasPendingDiscardChoice` param stays at **position 16** (last). Do NOT
  reposition it (that churns the composable + its test for no behavior gain).
- Tooltip reason is the WP-476 locked string *"Choose which cards to discard before taking
  another action."* — it already lives in `useTurnActions`; add NO new copy here.

## Guardrails
- arena-client only; no engine change; no new contract; no determinism/persistence surface.
- `TurnActionBar` passes the FULL positional arg list through position 16 in the
  `passPriorityGate` / `endTurnGate` calls (append `props.hasWoundInHand`,
  `props.hasActedThisTurn`, `props.hasHealedThisTurn`, `props.hasPendingDiscardChoice` after
  the existing `props.hasPendingScryKoChoice`); add the 16th arg to the `canHealWounds` call.
- New prop `hasPendingDiscardChoice: { type: Boolean, default: false }` — documented like the
  sibling `hasPendingScryKoChoice` prop.
- Pages: add the computed, RETURN it from `setup`, and bind `:has-pending-discard-choice`.

## Required `// why:` Comments
- The `TurnActionBar` prop: cite WP-477 / WP-476 — completes the deferred discard-gate wiring.
- The page computed: mirror the `hasPendingScryKoChoice` computed's `// why:` (derived from
  `UIState.pendingDiscardChoice !== undefined`; board frozen at every stage while pending).

## Files to Produce
- (per WP-477 §Files Expected to Change — TurnActionBar prop + thread; two pages computed +
  prop; governance close.)

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `typecheck`; `pnpm -r build` exit 0.
- [ ] Add/confirm a test asserting End-Turn / Pass-Priority disable + reason when
      `hasPendingDiscardChoice` is true (TurnActionBar test, or prop-threading coverage).
- [ ] WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + `roadmap:counts:write` (`:check` exits 0);
      EC_INDEX EC-512 → Done; STATUS (or update the WP-476 boundary note).
- [ ] No file outside the allowlist (+ governance).

## Common Failure Smells
- Buttons still enabled while a discard is pending → the page computed isn't passed, or
  `TurnActionBar` didn't thread the flag to position 16.
- A silent positional-arg bug → the `canEndTurn`/`canPassPriority` call skipped positions
  13–15 (heal params) when reaching position 16; pass them explicitly.
- Reason string drift → new tooltip copy was invented instead of reusing the WP-476 gate value.
