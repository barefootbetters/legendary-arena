# EC-446 — Set `ctx.gameover` at end of game (top-level `endIf`) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-411-top-level-endif-gameover.md
**Layer:** Game Engine (`game.ts`) + an engine-runner integration test

## Before Starting
- [ ] **Scope lock — the files in `Files to Produce` and no others.** The
      determinism-fixture files are in scope ONLY if the §Empirical Scaffold shows a
      hash/fixture shift; otherwise touching them is a STOP.
- [ ] **Re-verify WP-411 / EC-446 / D-24223 are still free** against `origin/main`
      AND open PR branches (`gh pr list`). D-24222 is the last reserved (WP-410, PR
      #895); the next free D starts at D-24223. WP-409/EC-444/D-24221 and WP-410/
      EC-445/D-24222 are taken — do not collide.
- [ ] Confirm the bug on `main` before fixing: `LegendaryGame` has **no** top-level
      `endIf`; the endgame check is the `play`-phase `endIf`. Verify, don't assume.
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/game-engine test`,
      `pnpm --filter @legendary-arena/engine-runner test` exit 0 — record counts.
- [ ] Read `docs/ai/REFERENCE/00.6-code-style.md` and
      `.claude/skills/legendary-game-engine/SKILL.md` before the first edit.

## Locked Values (do not re-derive)
- The fix, verbatim: `endIf: ({ G }) => evaluateEndgame(G) ?? undefined`, added to
  the **`LegendaryGame` object at the top level** (sibling of `moves` / `phases`),
  **NOT** inside any phase.
- `ctx.gameover` value is the `evaluateEndgame` result (`{ outcome, reason }`),
  set by the framework — application code never writes `ctx.gameover`.
- **Remove** the `play`-phase `endIf` (and its incorrect "boardgame.io stores any
  truthy endIf return as ctx.gameover" comment). **Keep** `play.next: 'end'` and the
  `end` phase — the four-phase structure (lobby/setup/play/end) is pinned by
  `game.test.ts`; do NOT restructure phases.
- Win/loss conditions are unchanged (same `evaluateEndgame`). No new gameplay.

## Guardrails
- **Top-level, not phase-level.** A phase `endIf` ends the phase; only the top-level
  Game `endIf` sets `ctx.gameover`. Putting it back in a phase re-introduces the bug.
- **No server edit.** `apps/server/**` already reads `metadata.gameover` correctly
  (`isMatchFinished`, the result-LAGN producer). This packet is engine-only.
- **No phase count change.** Keep exactly four phases; `game.test.ts` pins it.
- **Determinism, never silent.** Setting `ctx.gameover` does not mutate `G`, but a
  game now terminates at the win/loss point. RUN the sentinel/golden
  `finalStateHash` + `PRE_WP080_HASH` suites; if any moved, re-record via the
  **canonical recorder** (never hand-edit) and record the deliberate re-pin + reason.
- **Test the wiring, not just the pure function.** The bug hid because tests
  asserted `evaluateEndgame(G)` but never that boardgame.io sets `ctx.gameover`. The
  new tests MUST exercise `LegendaryGame.endIf` (unit) and a real match termination
  (engine-runner integration).
- No `boardgame.io/testing` import; no `Math.random()`; ESM; `// why:` on the `endIf`.

## Required `// why:` Comments
- The top-level `endIf`: why top-level and not a phase `endIf` — only a top-level
  `endIf` sets `ctx.gameover`; the phase-level check never terminated the match (the
  bug D-24223 fixes).
- The removal of the `play`-phase `endIf`: why it was wrong / is now superseded.
- Any fixture re-record: why the game now terminates earlier (recorded past gameover
  under the old flow) — a deliberate, reasoned re-pin.

## Files to Produce
- `packages/game-engine/src/game.ts` — **modified** — top-level `endIf` added; `play`-phase `endIf` removed
- `packages/game-engine/src/game.test.ts` — **modified** — `endIf` wiring assertion; keep 4-phase + move-set pins
- `apps/engine-runner/src/runMatch.test.ts` — **modified/new** — match terminates with `ctx.gameover`
- `packages/game-engine/src/test/fixtures/*` + `replay/replay.execute.test.ts` — **modified ONLY IF the scaffold shows a shift** (canonical re-record + reason)
- `docs/ai/DECISIONS.md` — **modified** — D-24223 Active
- `docs/ai/STATUS.md` — **modified** — engine-pipeline fix + D-24026 live-verify gate
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] AC-1..AC-6 demonstrated; **AC-6 live-verified** on the deployed bundle
      (a real completed match sets `metadata.gameover`; `result-lagn` returns a doc)
- [ ] Empirical scaffold RUN; hash/fixture verdict recorded (unchanged, or re-recorded + reasoned)
- [ ] `pnpm -r build` 0; engine + engine-runner suites pass; `pnpm -r --no-bail test` no new failures
- [ ] `game.test.ts` four-phase + move-set pins green; `endIf` unit + engine-runner termination tests present
- [ ] D-24223 landed Active; STATUS updated; `git diff --name-only` matches Files to Produce
- [ ] WORK_INDEX `[x]`; EC_INDEX `Complete`; mindmap `✅`; `roadmap:counts:check` 0

## Common Failure Smells
- `endIf` added inside a phase (or left there) → re-introduces the bug; it must be top-level
- The `end` phase removed / phase count changed → `game.test.ts` red; keep four phases
- Tests assert only `evaluateEndgame(G)` again → the wiring is still untested; exercise `LegendaryGame.endIf` + real termination
- A `finalStateHash`/`PRE_WP080_HASH` shift hand-edited or ignored → re-record via the canonical recorder with the reason
- A server file touched → out of scope; the server already reads `metadata.gameover`
- Historically-stuck matches backfilled → out of scope (a separate operational call)

## Execution Amendment (2026-07-21) — AC-3 wiring test relocated engine-runner → game.test.ts

**Discovery.** The WP/EC framed the AC-3 "assert `ctx.gameover` is set" test as an
**engine-runner integration test** (`apps/engine-runner/src/runMatch.test.ts`,
driving `runSimulation`). During execution the engine-runner path was found to be
**structurally incapable** of observing `ctx.gameover`: `runSimulation`
(`packages/game-engine/src/simulation/simulation.runner.ts`) is a **pure
re-implementation** of the turn loop that calls `evaluateEndgame(G)` directly and
**never instantiates boardgame.io** — it has no real `ctx`, so `ctx.gameover` does
not exist on that path. A test there would be exactly the "asserts only
`evaluateEndgame(G)` again" anti-pattern this EC's Guardrails forbid; it also could
never have caught the original bug (the bug is in the boardgame.io wiring the
simulation harness bypasses).

**Resolution (faithful to WP intent, honors "no server edit").** The load-bearing
AC-3 wiring test — proving the framework's **top-level** `endIf` sets `ctx.gameover`
— was realized in **`packages/game-engine/src/game.test.ts`** using
`InitializeGame` + `CreateGameReducer` (boardgame.io's own reducer; the same
precedent as `apps/server/src/replay/matchReplay.logic.test.ts` and
`competition.logic.test.ts`). This is the ONLY vehicle that exercises the wiring,
and it stays **engine-only** (the engine package owns `LegendaryGame` and depends on
boardgame.io), so the "No server edit" guardrail is preserved. The test drives a
real match to `play`, confirms `ctx.gameover` is unset mid-game, injects a terminal
counter (a natural mastermind defeat is hundreds of card-data-dependent moves), and
asserts the framework sets `ctx.gameover` to the `evaluateEndgame` result after one
more move. Confirmed against the pre-fix code (`ctx.gameover` stayed `undefined`).

**Engine-runner test kept, honestly scoped.** `runMatch.test.ts` still gains an
end-to-end **termination smoke** — a headless run reaches a terminal endgame
condition within the safety cap (`averageTurns < 200`), guarding against the harness
regressing to never-terminating — with a comment pointing to `game.test.ts` for the
actual `ctx.gameover` wiring coverage.

**Net effect on Files to Produce.** `game.test.ts` carries AC-1 (endIf unit) **and**
AC-3 (reducer wiring); `runMatch.test.ts` carries the end-to-end termination smoke.
No new layer touched; no server production or test-behavior change.
