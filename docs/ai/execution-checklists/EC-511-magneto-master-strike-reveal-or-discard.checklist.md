# EC-511 — Magneto Master Strike Reveal-or-Discard + Interactive Discard-to-4 (Execution Checklist)

**Source:** docs/ai/work-packets/WP-476-magneto-master-strike-reveal-or-discard.md
**Layer:** Game Engine (`rules` + `moves` + `ui` + `simulation`) + arena-client (client prompt)

## Before Starting
- [ ] On `origin/main` (WP-476/EC-511/D-24284 reserved via #1126; D-24281 hand+inPlay
      amendment #1125 landed); worktree clean; game-engine + arena-client green.
- [ ] Re-read the **KO-a-Hero** pending-choice template (`moves/koHeroChoice.resolve.ts`,
      `types.ts` PendingKoHeroChoice, `ui/uiState.build.ts`/`.filter.ts`,
      `simulation/ai.legalMoves.ts`, `PendingKoHeroChoicePrompt.vue`) + the strike handler
      `rules/mastermindHandlers.ts` (`resolveMagnetoStrike` :192).
- [ ] **Exact target file set (any outside = FAIL, STOP):** the WP-476 §Files list
      (engine: mastermindHandlers, types, discardChoice.resolve [new], game.ts, the 8 guard
      sites, uiState.build/types/filter, the 2 sim MOVE_MAP files [+ replay/fixture only-if-dispatched], villainEffects.execute
      [export], game.test.ts; client: PendingDiscardChoicePrompt.vue [new], PlayDesktop/PlayMobile,
      uiMoveName.types, useTurnActions; + DECISIONS.md). Do **not** touch other strikes.

## Locked Values (do not re-derive)
- Reveal-check reads `G.cardTraits` `team === 'x-men'` in **HAND ONLY** (strike fires at
  start-of-turn, inPlay empty — do NOT copy D-24281's hand+inPlay). A player with an
  X-Men Hero discards nothing.
- Pending: `PendingDiscardChoice { choiceType: 'discard-to-limit'; playerID; limit }` on
  `G.pendingDiscardChoices` (FIFO). `MAGNETO_HAND_SIZE_LIMIT = 4` unchanged.
- **CURRENT player** discards interactively (park → `resolveDiscardChoice`); **non-current**
  players auto-pick cheapest-first (single-current-player architecture — interactive
  non-current is OUT, WP-476 §Scope Out). 1p = current player only.
- `resolveDiscardChoice({G,playerID},{cardIds})` validates front entry (playerID +
  choiceType + cardIds ⊆ hand + discards EXACTLY to `limit`), hand→discard, front-pops;
  every invalid state a silent no-op (moves never throw), queue byte-identical on no-op.
- `hasPendingDiscardChoice` blocks every action move + start→main/End-Turn advance.
- **No D-entry** wording drift: land **D-24284** (Drafted → Active).

## Guardrails
- Moves never throw; no `ctx.random` / I/O / `.reduce()`; deterministic.
- Thread `hasPendingDiscardChoice` into EVERY guard site listed (grep-parity with
  `hasPendingKoHeroChoice`), incl. the start-stage `villainDeck.reveal` + `advanceStage`.
- `resolveDiscardChoice` MUST join `SIMULATION_MOVE_NAMES` + both sim MOVE_MAPs + the drift
  test **unconditionally** — omitting these hangs the per-turn sim loop (the WP-470-class
  failure mode). The `replay.execute.ts` + `runFixture.ts` MOVE_MAPs are core-moves-only:
  add `resolveDiscardChoice` there **only if** a committed replay log / fixture dispatches it.
- UIState projects/redacts the FRONT entry to the choosing player only (D-24011).
- Client mirror-not-import; degrade if the snapshot lacks `pendingDiscardChoice`.

## Required `// why:` Comments
- Why the reveal is HAND-ONLY (strike = start-of-turn, inPlay empty; NOT the D-24281 scope).
- Why non-current players auto-pick (single-current-player pending-choice architecture; D-24284).
- Why `resolveDiscardChoice` silent-no-ops on invalid state (moves never throw).
- The new `G.pendingDiscardChoices` field + move: cite D-24284.

## Files to Produce
- (per WP-476 §Files Expected to Change — engine reveal-check + pending machinery + guards
  + UIState + sim dispatch + client prompt/wiring + D-24284.)

## After Completing
- [ ] game-engine build + test; arena-client test/typecheck; `node scripts/runtime-observed-hollows.mjs --check`
      (no sim hang); `pnpm -r build` exit 0.
- [ ] Fixture re-pin LIKELY (new hashed `pendingDiscardChoices` on a Magneto strike) —
      regenerate + re-pin any shifted `finalStateHash` with a note. Confirm empirically.
- [ ] `D-24284` Active. STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-511 Done.
- [ ] No file outside the allowlist (+ governance). Revert lagn-v1.json EOL churn if any.

## Common Failure Smells
- A player with an X-Men Hero still discards → reveal-check missing / read the wrong zone.
- Sim hangs on a Magneto strike → `resolveDiscardChoice` not in the sim MOVE_MAP / bot default.
- The board stays playable with a discard pending → a guard site missed `hasPendingDiscardChoice`.
- A non-current player is prompted (or the game waits on a bot) → non-current didn't auto-pick.
- `resolveDiscardChoice` discards to ≠4 or accepts a non-hand card → validation gap.
