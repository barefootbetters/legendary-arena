# EC-072 — Replay Harness Step-Level API (Execution Checklist)

**Source:** docs/ai/work-packets/WP-080-replay-harness-step-level-api.md
**Layer:** Game Engine (`packages/game-engine/src/replay/`)

> **Slot note:** EC-062–EC-064 unused; EC-065–EC-071 historically
> bound (EC-065 vue-sfc-loader, EC-066 retargeted to EC-068, EC-067
> WP-061, EC-068 WP-067, EC-069 WP-062, EC-070 WP-068, EC-071 WP-063).
> Following the EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069,
> and EC-063 → EC-071 retargeting precedent, WP-080 uses EC-072 — the
> next truly free slot. Commit prefix for execution is `EC-072:`
> (NEVER `WP-080:` — P6-36). See WP-080 §Preflight §EC Slot Lock for
> the full retargeting history.

## Before Starting
- [ ] WP-027 complete (`replayGame`, `computeStateHash`,
      `verifyDeterminism` exported from the engine; `MOVE_MAP` +
      `buildMoveContext` file-local in `replay.execute.ts`)
- [ ] WP-079 complete (D-0205 JSDoc narrowing landed on
      `replay.execute.ts` and `replay.verify.ts`; forbidden phrases
      absent; required phrases present). If WP-079 has no EC at
      WP-080 execution time, STOP — drafting a WP-079 EC is a
      transitive prerequisite.
- [ ] Repo baseline green: `pnpm -r test` exits 0; count strictly
      greater than pre-WP-080 baseline required after execution
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `stash@{0}` retained — MUST NOT pop
- [ ] `stash@{1}` retained — MUST NOT pop
- [ ] EC-069 `<pending — gatekeeper session>` placeholder in
      `EC_INDEX.md` MUST NOT be backfilled in the `EC-072:` commit
- [ ] Design Q1–Q5 resolutions in WP-080 §Design Decisions read and
      not re-litigated at execution time

## Locked Values (do not re-derive)
- Commit prefix: `EC-072:` on every code-changing commit; `SPEC:` on
  governance-only commits; `WP-080:` **forbidden** (P6-36)
- Export name: `applyReplayStep` (no other spelling)
- Export signature (verbatim from WP-080 §Locked contract values):
  ```ts
  export function applyReplayStep(
    gameState: LegendaryGameState,
    move: ReplayMove,
    numPlayers: number,
  ): LegendaryGameState
  ```
- State-ownership contract: mutate-and-return-same-reference
  (Q2 = A). `applyReplayStep` never clones `gameState`.
- `MOVE_MAP` remains file-local (no `export` keyword); declared
  exactly once in `replay.execute.ts`
- `buildMoveContext` remains file-local; declared exactly once
- `ReplayMoveContext` remains a file-local structural interface
  (Q4 — not exported; `replay.types.ts` is not modified)
- `replayGame` refactor: internal loop delegates to
  `applyReplayStep`; the loop body is a single call (plus the
  `for...of` header); behavior byte-identical under
  `computeStateHash` regression on the existing
  `verifyDeterminism` fixture
- Barrel: exactly one new line under the existing WP-027 block in
  `packages/game-engine/src/index.ts` (approx lines 206–211):
  `export { applyReplayStep } from './replay/replay.execute.js';`
  No reformatting of surrounding lines
- Unknown-move message text (verbatim, preserved from today):
  `` `Replay warning: unknown move name "${move.moveName}" —
  skipped.` ``
- Test file path: `packages/game-engine/src/replay/replay.execute.test.ts`
  (new). Test extension `.test.ts` (never `.test.mjs`). Test runner
  `node:test`
- `ReplayInputsFile` is OUT OF SCOPE (Q5 — WP-063's concern)
- RNG semantics unchanged; D-0205 remains in force

## Guardrails
- No change to `replayGame` public signature or return type
  (regression guard)
- No change to `verifyDeterminism`, `computeStateHash`,
  `ReplayInput`, `ReplayMove`, `ReplayResult` — all WP-027 contract
  surfaces frozen
- No modification to `replay.types.ts`, `replay.hash.ts`,
  `replay.verify.ts` (beyond WP-079's already-landed edits)
- No `.reduce()` in the refactored loop; use `for...of`
- No `boardgame.io` import added to any file under
  `packages/game-engine/src/replay/` (invariant inherited from
  WP-027)
- No `Math.random` / `Date.now` / `performance.now` / `console.*` /
  `node:fs*` inside `applyReplayStep`
- No modification to `packages/game-engine/src/index.ts` outside
  the one new line under the WP-027 block
- No new exports beyond `applyReplayStep`
- Scope lock is binary (P6-27)

## Required `// why:` Comments
- `applyReplayStep` JSDoc: cite D-6304; motivate (unblock WP-063
  snapshot producer + single source of truth for dispatch);
  explain mutate-and-return-same-reference contract
- `replayGame` refactored loop (above the `for...of` header):
  one-line `// why:` noting the loop delegates to
  `applyReplayStep`; determinism regression covered by existing
  `verifyDeterminism` fixture (`computeStateHash` byte-identical)
- Preserve: existing `// why:` on reverse-shuffle (lines 118–124
  today) — do NOT remove or reword; it cites D-0205 after WP-079
- Preserve: existing `// why:` on events no-op (lines 110–113
  today) — do NOT remove or reword

## Files to Produce
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** —
  add `applyReplayStep` named export; refactor `replayGame`'s
  internal loop to delegate
- `packages/game-engine/src/index.ts` — **modified** — add one
  export line under the WP-027 block
- `packages/game-engine/src/replay/replay.execute.test.ts` — **new** —
  three `node:test` cases per WP-080 §Scope (In) §C
- `docs/ai/STATUS.md` — **modified** — WP-080 completion entry
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-080 row
  checked off with today's date
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip
  EC-072 from Draft to Done with `Executed YYYY-MM-DD at commit
  <hash>` (P6-41 stash pattern if dirty at commit time)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm -r test` exits 0; repo-wide count strictly greater than
      pre-WP-080 baseline; 0 failures
- [ ] Regression guard: `computeStateHash` on the existing
      `verifyDeterminism` fixture is byte-identical pre- and
      post-refactor
- [ ] `git diff --name-only` shows only files listed in Files to
      Produce
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-080 checked off
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-072 flipped
      to Done with commit hash
- [ ] **01.6 post-mortem complete** (MANDATORY per P6-35 — new
      long-lived abstraction trigger: `applyReplayStep` is the
      canonical step-level dispatch surface for future replay
      consumers); formal 10-section output, in-session, before
      commit
- [ ] Commit uses `EC-072:` prefix
- [ ] `stash@{0}` and `stash@{1}` retained (not popped)
- [ ] EC-069 `<pending>` placeholder in `EC_INDEX.md` not
      backfilled

## Common Failure Smells
- `verifyDeterminism` starts failing with a different hash →
  refactor changed observable behavior; revert and re-check the
  mutation / context-construction contract
- `pnpm -r test` count decreases → a test was accidentally removed
  or moved; restore it
- Two `MOVE_MAP` constants in `replay.execute.ts` → the refactor
  left the old copy in place; collapse to one
- `replay.execute.ts` starts importing `boardgame.io` → purity
  violation; the file does not import it today and must not start
- `git diff packages/game-engine/src/index.ts` shows reformatting
  of lines outside the WP-027 block → editor auto-formatted on
  save; undo all changes outside the new export line
- `applyReplayStep` clones `gameState` or uses `structuredClone` →
  Q2 = A violation; revert to mutate-and-return-same-reference
- A new type is exported from `replay.types.ts` or
  `packages/game-engine/src/types.ts` → Q4 violation;
  `ReplayMoveContext` must remain file-local
- Commit message starts with `WP-080:` → P6-36 hook rejects; fix
  the message and re-commit (do NOT `--no-verify`)
