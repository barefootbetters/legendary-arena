# EC-367 — Retire the `moveCount`-as-Rounds Proxy: Turns-Native Scoring (WP-4) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-337-rounds-turns-native.md
**Layer:** Game Engine (`packages/game-engine/**`) + Server (`apps/server/**`, mechanical)

## Before Starting
- [ ] D-24123 + D-24124 Active; WP-336 Done; `pnpm -r build` 0; capture engine + server baselines
- [ ] Confirm `ReplayResult.moveCount` is produced only at `replay.execute.ts:234` and consumed only at `parScoring.logic.ts:58` (the unrelated `sweep.*` `moveCount` stays)
- [ ] Target file set == the WP `Files Expected to Change` allowlist

## The Operator Decision (Option A — do not re-open)
- **Retire the `moveCount` proxy; KEEP the full-`G` `computeStateHash`.** No field-set change, no golden re-pin. D-24124 already made live == replay hashes agree, so excluding `messages`/`logMeta` is unnecessary; the full-`G` hash is the intended tamper-evident competitive PK.

## Locked Values (do not re-derive)
- `ReplayResult = { finalState, stateHash, turnCount: number }` (rename `moveCount` → `turnCount`)
- `turnCount` = completed play turns, floored at 1 (consistent with `reduceMatchToFinalState` + `par.aggregator` `turnsElapsed === 0 ? 1 : turnsElapsed`)
- Offline `replayGame`: `turnCount = max(1, count of 'endTurn' moves in input.moves)`
- `deriveScoringInputs`: `const rounds = replayResult.turnCount;`
- `computeStateHash` (`replay.hash.ts`) — **byte-unchanged**
- Reserves D-24125

## Guardrails
- Rename `ReplayResult.moveCount` → `turnCount` (do NOT add a parallel field — the slot is used only as the rounds proxy)
- Do NOT touch `computeStateHash` / `replay.hash.ts`; do NOT re-pin `PRE_WP080_HASH` or replay-producer snapshot goldens (they must stay green as-is — that is the proof the hash is unchanged)
- Do NOT touch `sweep.analyze.ts` / `sweep.runner.ts` `moveCount` (separate sweep-manifest field)
- `game.ts` edit is COMMENT-ONLY (the stale `logMeta` hash claim) — no logic change to `onBegin`
- Server (`competition.logic.ts`) edit is mechanical: `scoringView` → `{ finalState, stateHash, turnCount: reduced.turnCount }`; remove the "moveCount slot carries turns" wart comment
- No new npm dep; no new move; no boardgame.io import in a pure helper

## Required `// why:` Comments
- `replay.execute.ts` `turnCount`: why it counts `'endTurn'` moves floored at 1 (completed play turns; the scoring `rounds` input; matches `reduceMatchToFinalState`) and that this offline harness feeds no live scorer (determinism self-check only)
- `parScoring.logic.ts` `rounds = replayResult.turnCount`: why turns (PAR calibrated on turns, D-24123; resolves the D-4801 move-count proxy)
- `game.ts` `logMeta`: corrected — `computeStateHash` intentionally hashes the full `G` incl. `logMeta` (the fixture-golden `hashGameState` is the one that excludes `messages`/`logMeta`, D-24081/24114)

## Files to Produce
- `packages/game-engine/src/replay/replay.types.ts` — **modified** — `moveCount` → `turnCount`
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** — compute `turnCount`
- `packages/game-engine/src/replay/replay.verify.test.ts` — **modified** — assert `turnCount`
- `packages/game-engine/src/scoring/parScoring.logic.ts` — **modified** — read `turnCount`
- `packages/game-engine/src/scoring/parScoring.types.ts` — **modified** — comment
- `packages/game-engine/src/game.ts` — **modified** — stale comment only
- `apps/server/src/competition/competition.logic.ts` — **modified** — mechanical rename
- `apps/server/src/competition/competition.logic.test.ts` — **modified** — fixture rename
- `docs/ai/DECISIONS.md` — **modified** — D-24125
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**

## After Completing
- [ ] `pnpm -r build` 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` green — **`PRE_WP080_HASH` determinism goldens unchanged and passing** (proves `computeStateHash` untouched)
- [ ] `pnpm --filter @legendary-arena/server test` green (no-DB); competition rawScore recompute uses `turnCount`
- [ ] `git diff --name-only packages/game-engine/src/replay/replay.hash.ts` empty
- [ ] Grep: `moveCount` ABSENT from `parScoring.logic.ts` + `replay.types.ts`; `turnCount` present
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (+ payoff)
- [ ] `docs/ai/DECISIONS.md` D-24125 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- Determinism goldens go red → you touched `computeStateHash` / `replay.hash.ts` (you must not; Option A keeps it byte-unchanged)
- `sweep` tests go red → you renamed the wrong `moveCount` (the sweep-manifest field is a real move count; leave it)
- Competition rawScore test drifts → `TEST_REPLAY_RESULT` / `scoringView` field name mismatch (both must be `turnCount`)
- A lingering `ReplayResult.moveCount` reference → the rename missed a consumer (there is exactly one: `parScoring.logic.ts`)
