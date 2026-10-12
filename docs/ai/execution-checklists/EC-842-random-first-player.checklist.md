# EC-842 — A random player goes first (Execution Checklist)

**Source:** docs/ai/work-packets/WP-805-random-first-player.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline `origin/main` includes the reserve (#2730) and the WP-805 draft. `pnpm install` and `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail.
- [ ] Re-read the anchors (all `~`):
  - boardgame.io `turn-order-4ab12333.js`: `InitTurnOrderState` `:~901-919` (passes `random` to `order.first`), `TurnOrder.DEFAULT` `:~992-995`
  - `game.ts`: `lobby` `:~701`, `play` `:~746`, its `turn` block `:~756-790` (no `order` today), `firstPlayTurn` `:~915`
  - `setup/buildInitialGameState.ts` `finalBlow` / `isDebugMatch` spreads `:~637-649`; `types.ts` `:~1759-1777`
  - `game.test.ts` reducer precedent `:~775-801` and the `isDebugMatch` setup test `:~157`
- [ ] Confirm by grep that no non-test code outside the sim / PAR / fixture / replay-snapshot harnesses assumes the opener (WP Assumes 7). A new hit → STOP and amend the WP + D-24700.

## Locked Values (do not re-derive)
- **Field:** `readonly isFirstPlayerRandom?: boolean` on `LegendaryGameState`. `buildInitialGameState` spreads `...(context.ctx.numPlayers > 1 ? { isFirstPlayerRandom: true } : {})` beside `isDebugMatch`. Never `false`, never written after setup.
- **Order** in `play.turn` (beside `activePlayers`):
  - `first: ({ G, ctx, random }) =>` `(ctx.playOrderPos + 1) % ctx.playOrder.length` when `G.isFirstPlayerRandom !== true`, else `random.Die(ctx.playOrder.length) - 1`.
  - `next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.playOrder.length`.
- **Re-pins** (no other pin moves):
  - `sentinel-core-doom-2p` `finalStateHash`: `pnpm --filter @legendary-arena/game-engine build`, then `node scripts/record-game-fixture.mjs --name sentinel-core-doom-2p --input packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`. The JSON diff is exactly one line. Never hand-edit.
  - `PRE_WP080_HASH` (`replay/replay.execute.test.ts:~181`): in place, extending the provenance chain with a dated D-24700 comment.
- **Doc:** `DESIGN-BOARD-LAYOUT.md` §5.1: the first player is drawn with the match's seeded `random` when the play phase begins (WP-805 / D-24700), replacing the "`Game.setup()` per WP-005A" sentence.

## Guardrails
- One seeded draw per multi-seat match, at play start, through boardgame.io's `random` only. No `Math.random`, clock or I/O.
- A flagless `G` (older logs, solo) takes the legacy branch byte-for-byte. Solo makes no draw.
- Nothing else in the `play` block changes: `activePlayers`, stages, `onBegin`, `onEnd`. No `ctx.events.*` call, no new move, no `UIState` field.
- The sim, PAR, fixture and replay-snapshot harnesses are not edited; they keep seat 0.
- No server or client edit. A server test failure = STOP and diagnose (the scaffold showed 0).
- Only the two Locked oracles move, and only by the flag key. PAR, `sim:runtime-observed`, `sim:coverage` and solo oracles unchanged; any other movement = STOP.
- Tests are runtime assertions, seeded with `{ ...LegendaryGame, seed }`, including the negatives: legacy state opens seat 1, solo has no key and opens seat 0, and **both leave `plugins.random.data` deep-equal across `startMatchIfReady`** (no draw). A flagged run's random state must change. Over seeds `seed-0` … `seed-39` the 3-seat opener set is exactly `{'0','1','2'}`, and the next-seat test covers the `'2'` → `'0'` wrap.

## Required `// why:` Comments
- `random.Die` in `order.first`: rules v23 L524 ("Choose a random player to go first"), D-24700, the draw sits after all setup shuffles.
- The legacy branch: a flagless `G` (created before WP-805, or solo) keeps boardgame.io's former default so stored logs replay unchanged (D-24119).
- `next`: clockwise rotation, unchanged.
- The setup spread: omit-when-off keeps solo byte-identical (the `finalBlow` / `isDebugMatch` precedent).
- The `PRE_WP080_HASH` provenance line.

## Files to Produce
- `packages/game-engine/src/types.ts`, `setup/buildInitialGameState.ts`, `game.ts` — **modified**
- `packages/game-engine/src/game.test.ts` — **modified** (five reducer tests + the setup flag-key test)
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **re-pinned** (recorder, one line)
- `packages/game-engine/src/replay/replay.execute.test.ts` — **re-pinned** (`PRE_WP080_HASH`)
- `docs/ai/DESIGN-BOARD-LAYOUT.md` — **modified** (§5.1, one sentence)
- `docs/ai/DECISIONS.md` (D-24700), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0; engine suite → 0 fail after the re-pins; server suite → 0 fail with no edit.
- [ ] `pnpm -r --no-bail test` → 0 fail; `pnpm par:seed:test` → 0; `pnpm sim:runtime-observed:check` and `pnpm sim:coverage --check` → 0.
- [ ] Allowlist-only diff; revert `lagn-v1.json` CRLF churn.
- [ ] D-24700 Active (every WP DoD clause). STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-842:` then `SPEC:`) with a `Tests-changed:` trailer for the two re-pins. Live-verify (D-24026) after deploy.

## Common Failure Smells
- **Every multi-seat match still opens seat 1:** the flag isn't written (the spread reads the wrong `numPlayers`), or `order` landed outside `play.turn`.
- **"invalid value returned by turn.order.first":** `first` returned `undefined` or a string.
- **Solo pins moved:** the flag was written for one seat, or the solo path drew.
- **A server replay, capture or coach test fails:** the legacy branch is not byte-identical to `DEFAULT.first`, or it drew from `random`.
- **An opener test is flaky:** a reducer test was not seeded (`InitializeGame` then seeds from the clock).
- **More than one line changed in the fixture JSON:** a trajectory changed. Stop; the harness should be untouched.
- **`random` undefined in `first`:** destructured from the wrong argument; boardgame.io passes one context object.
