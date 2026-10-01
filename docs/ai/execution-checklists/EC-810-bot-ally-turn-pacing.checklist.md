# EC-810 — Bot-ally turn pacing (Execution Checklist)

**Source:** docs/ai/work-packets/WP-773-bot-ally-turn-pacing.md
**Layer:** Server (`apps/server/src/bot-ally/`)

## Before Starting
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (record the baseline count and `botAllyDriver.test.ts` duration)
- [ ] Confirm on `main`: a successful submit in `attemptBotTurn` goes to the loop-top stop check, then the next `fetchState`;
      the only `delay()` calls are the submit back-offs; the lease renewal runs once, in `runTick`; `driveBotTurn` retries once.
- [ ] Confirm `BOT_ALLY_LEASE_TTL_MS = 15000` and D-24256's rejection of in-turn renewal.
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `export const BOT_MOVE_PACING_MS = 800;`
- `export const BOT_PLAY_CARD_PACING_MS = 400;`
- `export const BOT_PACING_BUDGET_MS_PER_TICK = 7200;`
- `export const BOT_UNPACED_MOVE_NAMES = Object.freeze(['advanceStage', 'endTurn']);`
- `pacingMsForMove(moveName, movePacingMs, playCardPacingMs)` (exported): `0` for an unpaced name, `playCardPacingMs` for
  `'playCard'`, else `movePacingMs`.
- Optional deps resolved in `createBotAllyDriver` beside the existing overrides: `movePacingMs`, `playCardPacingMs`,
  `pacingBudgetMsPerTick`, `pause(ms)` (default the module's `delay`).
- `driveBotTurn` creates ONE budget `{ spentMs: 0 }` and passes it to BOTH `attemptBotTurn` calls (first attempt + D-24230 retry).
- After the submit loop, if `moveAdvanced === true`: `pauseMs = pacingMsForMove(move.name, …)`; if `pauseMs > 0` AND
  `budget.spentMs + pauseMs <= pacingBudgetMsPerTick` → `await pause(pauseMs)`, then `budget.spentMs += pauseMs`.
- No pause on a non-advancing submit, `runFaultFallback`, or the seat-choice path. No look-ahead at the post-move state.

## Guardrails
- Lease mechanism unchanged: exactly one `renewOrAcquireLease(` call in the driver (in `runTick`), none inside a turn.
- `botAllyOwnership.mjs` changes are comment-only (the TTL rationale); `BOT_ALLY_LEASE_TTL_MS` stays 15000.
- The bot's move choices and their order are unchanged.
- Poll interval, submit attempts, retry back-off, step cap and turn cap keep their values.
- Retry back-offs stay on the module `delay` — never the injected `pause`.
- Clock-free: an awaited timer and a sum of constants; no `Date.now` / `performance.now`.
- No test awaits real pacing time: `makeDeps` and `makeRealDeps` inject a recording / no-op `pause`.
- Comments and JSDoc say "the ownership lease renewal" — never the `renewOrAcquireLease(` call form; the
  `botAllyOwnership.mjs` comment never restates the TTL constant's declaration.

## Required `// why:` Comments
- `BOT_MOVE_PACING_MS`: matches Watch Bot Play's default delay between moves (autoplay.mjs, LobbyView.vue).
- `BOT_PLAY_CARD_PACING_MS`: a card play is a lighter beat (a count, a log line, the combo flash).
- `BOT_PACING_BUDGET_MS_PER_TICK`: under half the ownership lease TTL, since the lease is renewed once per tick.
- The shared budget in `driveBotTurn`: the D-24230 retry runs inside the same lease renewal.
- The pause site: pause after the move so its beat plays before the next move's.
- `BOT_UNPACED_MOVE_NAMES`: a stage step changes only a label, and `endTurn` is the handoff, not a board beat.

## Files to Produce
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** — constants, `pacingMsForMove`, overrides, shared budget, pause site, deps JSDoc (the four new deps plus the missing ownership-lease-renewal dep line, never in call form)
- `apps/server/src/bot-ally/botAllyOwnership.mjs` — **modified** — comment-only TTL rationale (D-24610 amends the D-24256 premise)
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** — recording `pause` in `makeDeps`; `pacingMsForMove` (+ a runtime pin that the six move-name literals are keys of
  `LegendaryGame.moves`, imported in the test only), paced set
  `[800,400,400,800,800]`, override + identical `submitCalls`, budget (one test: 9×800; 18×400; skip-not-stop `[400, 800×8, 400]`), shared-across-retry (6 fights + fault, retry 6 fights → exactly 9 pauses / 7 200 ms), non-advancing
  `playCard` (one 400 pause), fallback via `decide` → null, stop-during-pause, no look-ahead (a fight that parks a seat choice records `[800]`, then yields)
- `apps/server/src/bot-ally/botAllySeatChoice.test.ts` — **modified** — no-op `pause` in `makeRealDeps` only
- `wiki/bot-ally.md` — **modified** — paced behavior; drop the no-pause / no-think-time claims; `last-reviewed`
- `wiki/visual-effects.md`, `wiki/visual-effects-design-ancestry.md` — **modified** — bot pacing marked shipped; the ancestry
  "AI plays at a readable pace" row's adoption cell rewritten to the shipped pacing (0.8 s / 0.4 s / none after a stage step or End Turn, 7.2 s per-tick budget), Status "Shipped (WP-773)"; cross-walk "(shipped)"; References split
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 failures; server +9 tests in `botAllyDriver.test.ts`, 0 elsewhere
- [ ] Step 2b: `node --import tsx --test src/bot-ally/botAllyDriver.test.ts` duration_ms delta ≤ ~600 ms; record both
- [ ] Step 3 count = 1; Step 4 = 5 matches; Step 5 = 1 match; Step 5b: the ownership-file diff is inside the TTL JSDoc
      block only and cites D-24610; Step 5c: no "no artificial" / "No think-time" / "flash by" left in `wiki/bot-ally.md`,
      and `Select-String -Path wiki\visual-effects.md,wiki\visual-effects-design-ancestry.md -Pattern "back to back|has no pause between moves|bot pacing \(drafted\)|WP-773 drafted|drafted as WP-773|WP-773 \(bot-ally turn pacing\), WP-774"` → no output
- [ ] `git status --porcelain` ⊆ Files to Produce (revert line-ending-only `pnpm -r build` churn such as `lagn-v1.json`)
- [ ] Live-on-surface (D-24026): solo + one bot ally; plays ~0.4 s apart, reveal / recruit / fight ~0.8 s apart; matchId in STATUS.md
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24610 → Active
- [ ] `WORK_INDEX.md` WP-773 checked off with date; `EC_INDEX.md` EC-810 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-773 `📝`→`✅`; `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- Existing bot-ally tests suddenly take seconds → a harness is missing the injected `pause`.
- A retried turn pauses more than 7 200 ms in total → the budget was created per `attemptBotTurn`, not per `driveBotTurn`.
- A pause recorded for a swallowed submit → the pause is inside the submit loop instead of after it.
- Back-off delays show up in the recorded pauses → the back-off was routed through `pause`.
- Commit message: `EC-810:` for the code commit, `SPEC:` for the governance close — never `WP-773:`.
