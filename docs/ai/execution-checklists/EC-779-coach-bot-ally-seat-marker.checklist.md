# EC-779 — Coach marks the bot-ally seat (Execution Checklist)

**Source:** docs/ai/work-packets/WP-742-coach-bot-ally-seat-marker.md
**Layer:** Server (`apps/server/src/coach/**`, `apps/server/src/replay/matchReplay.logic.ts`) + API catalog row
**Status:** Pending

## Before Starting
- [ ] Fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build` (exit 0). Record the server suite baseline (the coach suite was 62/62 at draft).
- [ ] Read:
  - `coach.types.ts`
  - `coachSummary.logic.ts:132-175`
  - `coach.logic.ts:47-58` and `:81-180`
  - `coachClient.ts:43-71`
  - `matchReplay.logic.ts:495-521`
  - `seatAccount.logic.ts:104-118`
  - `matchReplay.logic.test.ts:667+`
  - `api-endpoints.md:309`
- [ ] Scope lock: exactly the 9 files in Files to Produce. Any other edit → STOP. `apps/server` has no typecheck, so the tests are the gate.

## Locked Values (do not re-derive)
- **Field:** `CoachPlayerLine.isBotAlly?: boolean`. An absent field means a human seat. `buildPerPlayerLines` always sets it to `botSeatIds.includes(playerId)`, where ids are strings (`"0"`, `"1"`).
- **Label logic:** byte-identical (`Player ${index + 1}` / `Player ${playerId}`).
- **Helper:** `readMatchIdByReplayHash(replayHash: string, database: DatabaseClient): Promise<string | null>` runs `SELECT match_id FROM bgio.replay_artifacts WHERE replay_hash = $1 LIMIT 1`. Its JSDoc does not quote the SQL.
- **Summary signature:** `buildCoachMatchSummary(finalState, breakdown, outcome, resolveCardName, botSeatIds: readonly string[])`.
- **Seam:** `CoachLogic.readBotSeatIdsForReplay: (replayHash, database) => Promise<string[]>`.
  - Its production implementation is a module function, also named `readBotSeatIdsForReplay`.
  - `readMatchIdByReplayHash` returning `null` → `[]`; otherwise `readMatchBotSeats(matchId, database)`.
- **Placement:** immediately before `buildCoachMatchSummary`, after the cache miss and the `not_found` checks.
- **Failure warning:** `[coach] Bot-seat lookup failed for replay <hash>; coaching without bot markers. Underlying error: <message>`.
- **Prompt sentence:** replaces "In a bot-ally game the bot's line shows what the human was left to do." with:
  > Each player line carries `isBotAlly`; `true` marks a bot ally that played alongside the humans. In a bot-ally game, coach the human player(s): treat the bot as their ally, never grade the bot's choices, and use the bot's line to show what the human was left to do.

## Guardrails
- **Read the `match_id` column only.** It is an app-owned mapping column (D-24122). Never read `initial_state` or `log`, which are D-24095 blob reads.
- **Fail soft.** A throw gives `[]` and one `console.warn`; the result's `ok`/`reason` is unchanged. A missing row or no bot-ally row gives `[]` silently.
- **Skip the lookup when there is no summary.** A cache hit or a `not_found` never calls it.
- **Summary only.** `isBotAlly` never enters scoring, hashing, `G`, or persistence (NG-1).
- **Keep the prompt constant.** No per-request text.
- **Zero paid calls in tests.** `modelClient` stays stubbed.
- **Leave the other surfaces alone.** No changes to `tableCooperation`, `sequenceTeacher`, badges, the client, or the cache table.
- **Test helpers:** leave `makeState`/`makeModelClient` unchanged. The pass-through test overrides `reduceReplayByHash` with a 2-seat state and uses a capturing model spy.

## Required `// why:` Comments
- `isBotAlly` on `CoachPlayerLine`: WP-742 / D-24564. It is optional so existing fixtures mean "human", and the builder always sets it.
- The `LIMIT 1` in `readMatchIdByReplayHash`: mirrors the reverse helper.
- The `try/catch` around the lookup: an advisory marker must never make a paid report `coach_unavailable` (the WP-710 best-effort precedent).

## Files to Produce
- `apps/server/src/coach/coach.types.ts` — **modified** — optional `isBotAlly`
- `apps/server/src/replay/matchReplay.logic.ts` — **modified** — `readMatchIdByReplayHash`
- `apps/server/src/replay/matchReplay.logic.test.ts` — **modified** — DB-gated: stored `match_id`; `null` for an unknown hash
- `apps/server/src/coach/coachSummary.logic.ts` — **modified** — `botSeatIds` param → `isBotAlly`
- `apps/server/src/coach/coachSummary.logic.test.ts` — **modified** — 9 existing calls gain `[]`; `['1']` marks `Player 2` only; `[]` marks none; labels unchanged
- `apps/server/src/coach/coach.logic.ts` — **modified** — seam member, production `readBotSeatIdsForReplay`, fail-soft call
- `apps/server/src/coach/coach.logic.test.ts` — **modified** — default `async () => []` stub; 2-seat spy pass-through; throw → no markers + one warn (spy); cache-hit → no call
- `apps/server/src/coach/coachClient.ts` — **modified** — the one prompt sentence
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `Library-only` row for `readMatchIdByReplayHash` (D-11804, same commit)

## After Completing
- [ ] `pnpm -r build` exits 0. The server suite is green; record baseline → new counts in the commit body.
- [ ] With `TEST_DATABASE_URL` set, `pnpm --filter @legendary-arena/server test:db` passes, including the new helper test.
- [ ] The Verification greps pass: `SELECT match_id` matches once, `isBotAlly` is in the prompt, `bot's line shows` has zero matches, and the catalog row is present.
- [ ] `git diff --name-only` for the `EC-779:` commit lists the 9 files.
- [ ] Live (D-24026): a bot-ally match's AI Coach treats the bot as the ally. Record it in STATUS; the unit tests are the gate.
- [ ] Governance:
  - STATUS updated
  - DECISIONS D-24564 Active
  - WORK_INDEX `[x]`; EC_INDEX Done
  - mindmap `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- **Every seat is `false` in a bot-ally match.** The ids were compared as numbers.
- **Six existing coachSummary tests fail with `Cannot read properties of undefined (reading 'includes')`.** A test call is missing the 5th `[]` argument.
- **The coach returns `coach_unavailable` when the bot-seat read fails.** The `try/catch` is missing or re-throws.
- **The cache-hit or `not_found` path calls the lookup.** The call was placed too early.
- **The `tableCooperation` tests break.** The field was made required.
