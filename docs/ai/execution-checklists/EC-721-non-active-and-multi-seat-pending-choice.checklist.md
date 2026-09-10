# EC-721 — Non-active-player & multi-seat pending-choice capability (Execution Checklist)

**Source:** docs/ai/work-packets/WP-684-non-active-and-multi-seat-pending-choice.md
**Layer:** Game Engine + Arena Client (foundational)
**Status:** Pending

## Before Starting
- [ ] Read the active-player pending-choice / block-all model (`game.ts`, `moves/*Choice.resolve.ts`, `ai.legalMoves.ts`) + the invariant [[reference_interactive_choice_active_player_only]]
- [ ] Confirm how boardgame.io admits a move by a NON-current player (stages / `everyone`) — the generalization rides this framework mechanism; do NOT fork the turn model (baseline assertion)
- [ ] Read ARCHITECTURE.md §Disconnect & Reconnect Semantics — the timeout posture must be consistent, not invented
- [ ] Confirm `ctx.playOrder` / `ctx.numPlayers` are the seat set; `computeStateHash` hashes pending-choice `G` fields (determines re-pin)
- [ ] `pnpm -r build` 0; engine + arena-client suites green

## Locked Values (do not re-derive)
- [ ] The generalization is a STRICT SUPERSET: existing active-only pending choices are byte-identical (regression pin required)
- [ ] A pending choice carries a TARGET SEAT (or all-seats); `getLegalMoves` returns that seat's `resolve*` while open; the active player CANNOT resolve another seat's choice
- [ ] A simultaneous multi-seat choice = block turn progress until EVERY addressed seat submits (or hits the timeout default), THEN apply ALL selections ATOMICALLY, deterministically
- [ ] Per-seat UIState redaction: each seat sees ONLY its own prompt (audience-filter contract)
- [ ] Disconnect/timeout of an unsubmitted seat = a DETERMINISTIC default resolution (no `Math.random`, no wall-clock) consistent with the disconnect/reconnect posture

## Guardrails
- [ ] No behavior change for any existing active-player pending choice (byte-identical; pin it)
- [ ] Multi-seat resolution deterministic + replay-identical given the selections; atomic apply (all-or-nothing)
- [ ] New board-visible `UIState` fields follow the FIVE-step filter pass-through; per-seat redaction verified
- [ ] Any new `resolve*` move enrolls in `SIMULATION_MOVE_NAMES` + BOTH sim `MOVE_MAP`s or the sim hangs
- [ ] Server authoritative (§5); engine decides, client renders; moves never throw
- [ ] Determinism: re-pin ONLY if a hashed pending-choice field is added (assert the delta)

## Required `// why:` Comments
- [ ] The target-seat generalization of the pending-choice descriptor (why it stays a strict superset)
- [ ] The `getLegalMoves` / block-all admission of a non-active seat
- [ ] The multi-seat await-all + atomic apply (why atomic, why deterministic ordering)
- [ ] The disconnect/timeout default resolution (why this default is fair + deterministic)
- [ ] The per-seat UIState redaction

## Files to Produce
- [ ] Pending-choice types + a target-seat field (the pending-choice descriptor module)
- [ ] `game.ts` — block-all admits the addressed seat(s); `ai.legalMoves.ts` — non-active-seat `resolve*` legality
- [ ] A multi-seat "await-all, apply atomically" resolution helper (+ its determinism)
- [ ] `ui/uiState.{types,build,filter}.ts` — per-seat pending-prompt redaction (five-step contract)
- [ ] The disconnect/timeout default-resolution path
- [ ] Sim dispatch enrollment for any new `resolve*` move (`SIMULATION_MOVE_NAMES` + both `MOVE_MAP`s)
- [ ] `apps/arena-client/**` — scaffolding for a non-active/multi-seat prompt (concrete renderers ship with WP-682/WP-683)
- [ ] Tests: non-active resolve while active player blocked; multi-seat await-all + atomic + replay determinism; per-seat redaction; timeout default; active-only regression pin
- [ ] DECISIONS.md D-24501 at execution

## After Completing
- [ ] engine + arena-client suites green; `pnpm -r build` 0
- [ ] active-only pending-choice regression pin green (byte-identical)
- [ ] hash re-pin only if a hashed field was added (delta verified); else none
- [ ] D-24501 Active; WORK_INDEX `[x]` + EC_INDEX + roadmap mindmap [d]→[x]; WP-682 + WP-683 unblocked
- [ ] PR squash-merged when green

## Common Failure Smells
- An existing active-only choice changes behavior → the generalization wasn't a strict superset.
- A non-active seat can't resolve → block-all / getLegalMoves still active-only.
- The active player can resolve another seat's choice → target-seat gating missing.
- Multi-seat apply is order-dependent or non-atomic → replays diverge.
- A seat's prompt leaks another seat's hand → per-seat redaction missing in the filter.
- Match stalls on a disconnected seat → the deterministic timeout default is missing.
