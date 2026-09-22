# WP-742 — Coach marks the bot-ally seat (Server)

**Status:** Draft 2026-09-22 (EC-779; D-24564 reserved)
**Primary Layer:** Server (`apps/server/src/coach/**`, `apps/server/src/replay/matchReplay.logic.ts`)
**Dependencies:** WP-594 / D-24403 (the endgame coach) ✅, WP-622 / D-24433 (per-seat contribution on `CoachPlayerLine`) ✅, WP-375 / D-24170 (`legendary.match_bot_ally` bot-seat record) ✅, WP-335 (`bgio.replay_artifacts` carries `match_id`) ✅
**User-Visible Surface:** play.legendary-arena.com
**Baseline:** `origin/main` @ `b5fc8d3a`

---

## Goal

As a player who finished a bot-ally match, I want the AI Coach to know which
seat was my bot ally, so that its coaching speaks to me about my play instead of
grading the bot as though it were a second human.

---

## User-Visible Impact

The end-of-match AI Coach panel in a bot-ally match changes.

Today the coach sees two seats, both labelled `Player N`, and nothing marks the
bot. Its system prompt nonetheless says "In a bot-ally game the bot's line shows
what the human was left to do". So it is told about a distinction it cannot see.

After this WP, each seat line carries `isBotAlly`. The coach can frame the bot as
the ally and coach the human seat. Human-only matches are unchanged: every seat is
`isBotAlly: false`.

---

## Assumes

All verified at baseline `b5fc8d3a`:

- **Seat labels.** `buildPerPlayerLines` (`coachSummary.logic.ts:132`) labels seats
  `Player N` at L145, keyed by `finalState.playerZones` ids. Those ids are
  `String(playerIndex)`, i.e. `"0"`, `"1"` (`game-engine/src/setup/buildInitialGameState.ts:314`).
- **Summary builder callers.** `buildCoachMatchSummary(finalState, breakdown,
  outcome, resolveCardName)` has one production caller (`coach.logic.ts:141`) and
  9 calls in `coachSummary.logic.test.ts` (L101, 145, 178, 196, 206, 213, 218, 226,
  and a multi-line call at L234).
- **Coach flow.** `generateOrGetCoachReport` (`coach.logic.ts:81`) runs its checks
  in this order: ownership (L99), cache read (L109–112), score and replay reads
  with their `not_found` returns (L117–124), then the outcome evaluation
  (L125–139), then the summary build (L141).
  Cache hits never rebuild the summary.
- **Test seam.** The `CoachLogic` seam (L47–58) is stubbed by `makeLogic`
  (`coach.logic.test.ts:112`). The shared `makeState` builds **one** seat (L81),
  and `makeModelClient` discards its argument (L86–98).
- **Best-effort precedent.** `computeSequenceTipsForReplay` (`coach.logic.ts:202`)
  logs a `[coach]` `console.warn` on failure and never blocks the report.
- **Replay artifact lookup.** `bgio.replay_artifacts.match_id` is an app-owned
  mapping column (migration 025; D-24122), separate from the replay blob. Only the
  reverse read exists: `readReplayHashByMatchId` (`matchReplay.logic.ts:506–521`),
  catalogued `Library-only` at `api-endpoints.md:309`.
- **Bot-seat read.** `readMatchBotSeats(matchId, database): Promise<string[]>`
  (`match/seatAccount.logic.ts:104–118`) returns `[]` when the match has no
  bot-ally row. Bot seats are written as `String(seatIndex)`
  (`bot-ally/botAllyRoutes.mjs:633–634`), the same form as `playerZones` keys.
- **Bot-ally matches reach the coach.** The human seat gets replay ownership at
  capture (`matchCapture.logic.ts:125–135`). Bot seats make the match Casual, but
  submission still writes a score row (`competition.logic.ts:487, 588–591`). The
  coach requires only ownership and a score row.
- **Prompt text.** `COACH_SYSTEM_PROMPT` carries the bot-ally sentence split
  across `coachClient.ts:61–62`. The summary reaches the model via
  `JSON.stringify`.
- **Fixtures.** The `tableCooperation.logic.test.ts:63–77` fixture builds a full
  `CoachPlayerLine` without the new field.
- **No typecheck.** `apps/server` has no typecheck, so the tests are the gate.
- **Baseline suite.** `pnpm -r build` exits 0 and the coach suite is 62/62. The
  executor records the full server-suite count at baseline.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md`:
  - D-24403 (coach)
  - D-24433 (per-seat lines)
  - D-24170 (bot-ally seats)
  - D-24122 (`match_id` is an app-owned mapping column)
  - D-24095 (the replay-store blob carve-outs; this WP reads the column, never the
    `initial_state`/`log` blob)
- `apps/server/src/coach/{coach.types,coachSummary.logic,coach.logic,coachClient}.ts`
  and their tests.
- `apps/server/src/replay/matchReplay.logic.ts` L495–521 (the reverse helper to
  mirror), and the DB-gated test block at `matchReplay.logic.test.ts:667+`.
- `apps/server/src/match/seatAccount.logic.ts:104–118`.
- `docs/ai/REFERENCE/api-endpoints.md:309` (the `Library-only` row to mirror).
- **WP-737** (drafted, not executed) is corrected in this draft (Scope H), so it
  holds whichever of the two executes first.

**Why an optional field.** Existing and future `CoachPlayerLine` fixtures (the
`tableCooperation` tests, WP-737's eval scenarios) keep working, and an absent
field means "human seat". `buildPerPlayerLines` always sets the field
explicitly, so the model always sees it.

**Why `isBotAlly` rather than D-24402's `isBot`.** The coach's contract is about
the **ally** relationship (§23(b)): the prompt tells the model to coach the humans
and treat the bot as their ally. The name carries that meaning.
`MatchSeatIdentity.isBot` is a seat-identity fact for display, and stays as is.

**Why fail-soft.** The marker is advisory. A failed lookup must not turn a paid
coach report into `coach_unavailable`. This is the same stance as the WP-710
sequence tips.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words,
  `is`/`has`/`can` booleans, JSDoc on every function, `// why:` on non-obvious
  choices, no branching `.reduce()`.
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and
ask.

**Env:** no new variables.

**Packet-specific:**
- **Label unchanged.** Seats stay `Player N`. The marker is a separate field.
  `isBotAlly` absent means a human seat.
- **Read the column, never the blob.** The new helper selects only `match_id`
  from `bgio.replay_artifacts`.
- **Placement.** The lookup runs immediately before `buildCoachMatchSummary`,
  after the cache miss and after the `not_found` checks. A cache hit or a
  `not_found` never costs a lookup.
- **Fail-soft.**
  - Any error in the lookup yields `[]` plus one `[coach]` `console.warn` full
    sentence, with a `// why:`. The coach still generates.
  - A missing artifact row, or a match with no bot-ally row, yields `[]`
    silently. That is the normal human-only case.
- **Cache untouched.** No change to `legendary.coach_reports` or the cache-hit
  path. Previously cached reports keep their wording.
- **No score, hash, gameplay, or persistence change.** `isBotAlly` is
  summary-only and never enters scoring (NG-1).
- **Prompt stays a per-request-free constant.** It is a prompt-cache target.
- **Zero paid calls in tests.** `modelClient` stays stubbed.

---

## Scope (In)

### A) `coach/coach.types.ts` (**modified**; a contract file, see D-24564)
- `CoachPlayerLine` gains `readonly isBotAlly?: boolean`, with a `// why:`
  (WP-742 / D-24564). An absent field means a human seat. `buildPerPlayerLines`
  always sets it.

### B) `replay/matchReplay.logic.ts` (**modified**)
- New `readMatchIdByReplayHash(replayHash: string, database: DatabaseClient):
  Promise<string | null>`, which runs
  `SELECT match_id FROM bgio.replay_artifacts WHERE replay_hash = $1 LIMIT 1`.
  - It returns `null` when there is no row.
  - Its JSDoc mirrors `readReplayHashByMatchId`, and the `LIMIT 1` carries the
    same `// why:`.
  - The JSDoc must **not** quote the SQL, so the one-match Verification grep
    stays exact.

### C) `coach/coachSummary.logic.ts` (**modified**)
- `buildCoachMatchSummary` gains a 5th parameter, `botSeatIds: readonly string[]`,
  which it threads into `buildPerPlayerLines`.
- Each line sets `isBotAlly: botSeatIds.includes(playerId)`.
- The label logic stays byte-identical.

### D) `coach/coach.logic.ts` (**modified**)
- `CoachLogic` gains `readonly readBotSeatIdsForReplay: (replayHash: string,
  database: DatabaseClient) => Promise<string[]>`.
- The production implementation is a module function named
  `readBotSeatIdsForReplay`. It calls `readMatchIdByReplayHash`; `null` → `[]`;
  otherwise `readMatchBotSeats(matchId, database)`.
- In `generateOrGetCoachReport`, immediately before `buildCoachMatchSummary`,
  call it inside `try/catch`.
  - On failure, log
    `console.warn('[coach] Bot-seat lookup failed for replay <hash>; coaching
    without bot markers. Underlying error: <message>')` and use `[]`.
  - Pass the result as the 5th argument.

### E) `coach/coachClient.ts` (**modified**; prompt constant only)
- Replace the sentence "In a bot-ally game the bot's line shows what the human
  was left to do." with:
  > Each player line carries `isBotAlly`; `true` marks a bot ally that played
  > alongside the humans. In a bot-ally game, coach the human player(s): treat the
  > bot as their ally, never grade the bot's choices, and use the bot's line to show
  > what the human was left to do.
- No other change.

### F) Tests (**modified**)
- **`coach/coachSummary.logic.test.ts`**
  - All 9 existing `buildCoachMatchSummary(...)` calls gain a 5th argument `[]`.
    This is value-only, including the multi-line call at L234.
  - New test: with `['1']`, `Player 2` is `isBotAlly: true`, `Player 1` is
    `false`, and both labels are unchanged.
  - New test: with `[]`, every seat is `false`.
- **`coach/coach.logic.test.ts`**
  - `makeLogic` gains a default `readBotSeatIdsForReplay: async () => []`. The
    shared helpers are otherwise unchanged.
  - Pass-through test: override `reduceReplayByHash` with a **2-seat** state, stub
    the lookup to return `['1']`, and use a **model spy** that captures the
    summary. Assert that seat `"1"` is the bot.
  - Throw test: a stub that throws still gives `ok: true` with every seat `false`.
    A `console.warn` spy sees exactly one `[coach]` warning.
  - Cache-hit test: the lookup is **not** called.
- **`replay/matchReplay.logic.test.ts`**
  - DB-gated (`TEST_DATABASE_URL`, the WP-338 skip pattern):
    `readMatchIdByReplayHash` returns the stored `match_id`, and `null` for an
    unknown hash.

### G) `docs/ai/REFERENCE/api-endpoints.md` (**modified**; D-11804, same commit as the code)
- One `Library-only` row beside L309:
  - `(replayHash, database)` per `matchReplay.logic.ts` → `string | null`
  - Authorizing WP: `WP-742`
  - Row text: "**Route-less by design.**
    `SELECT match_id FROM bgio.replay_artifacts WHERE replay_hash = $1 LIMIT 1`
    — reads the `match_id` column only (never `initial_state`/`log`); `null` when
    no artifact. Used by the coach's bot-seat lookup."

### H) Governance, in this draft commit (**docs**)
- WP-737 (drafted, not executed): its three bot-marker statements are corrected
  (label unchanged; optional `isBotAlly`; a bot-ally eval category is a follow-up
  after WP-742). The WP-737 PS-1 note is unchanged.

---

## Out of Scope

- **No change to seat numbering or labels.**
- **No `tableCooperation`, `sequenceTeacher`, or badge logic change.**
- **No WP-737 bot-ally eval category.** It is a follow-up after both WPs ship.
- **No client or UI change**, no backfill of cached reports, and no new route,
  migration, table, or env var.
- **No autoplay handling.** All-bot autoplay matches have no owning account, so
  the coach already refuses them at the ownership gate.
- Refactors not listed in Scope (In) are out of scope.

---

## Files Expected to Change

- `apps/server/src/coach/coach.types.ts` — **modified** — optional `isBotAlly`
- `apps/server/src/replay/matchReplay.logic.ts` — **modified** — `readMatchIdByReplayHash`
- `apps/server/src/replay/matchReplay.logic.test.ts` — **modified** — DB-gated helper test
- `apps/server/src/coach/coachSummary.logic.ts` — **modified** — `botSeatIds` param → `isBotAlly`
- `apps/server/src/coach/coachSummary.logic.test.ts` — **modified** — 9 calls gain `[]`, plus the marker tests
- `apps/server/src/coach/coach.logic.ts` — **modified** — seam member, production function, fail-soft call
- `apps/server/src/coach/coach.logic.test.ts` — **modified** — pass-through, fail-soft + warn spy, cache-hit
- `apps/server/src/coach/coachClient.ts` — **modified** — one prompt sentence
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — `Library-only` row for `readMatchIdByReplayHash`

No other files may be modified in the `EC-779:` commit (9 files). Other commits:
- This draft `SPEC:` commit edits WP-737 (Scope H), WORK_INDEX, EC_INDEX and the
  mindmap.
- The execution govern-close `SPEC:` commit edits STATUS, DECISIONS (D-24564
  Active), WORK_INDEX, EC_INDEX and the mindmap.

---

## Contract

- **`CoachPlayerLine.isBotAlly?: boolean`**
  - `true` exactly when the seat id is in the match's
    `legendary.match_bot_ally.bot_seats`.
  - Absent means human.
  - `buildPerPlayerLines` always sets it.
- **`readMatchIdByReplayHash(replayHash, database)`**
  - Returns the artifact's `match_id`, or `null`.
  - Reads the `match_id` column only.
- **`buildCoachMatchSummary`** now takes 5 parameters: `(finalState, breakdown,
  outcome, resolveCardName, botSeatIds)`.
- **Coach behavior.** A bot-seat lookup failure never changes the result's `ok` /
  `reason`. It only removes the markers.

---

## Vision Alignment

- **Vision clauses touched:**
  - §3 (trust: coaching reflects the match actually played)
  - §19 (AI analysis support)
  - §23(b) (players are never opponents inside a match; the bot is an ally)
  - NG-1
  - Financial Sustainability
- **Conflict assertion:** No conflict. This WP preserves all touched clauses.
- **Non-Goal proximity:** NG-1..8 are not crossed. The marker is advisory and
  summary-only. It never feeds the score, ranking, or `G`.
- **Determinism:** no gameplay, scoring, replay, or RNG change. The new read is a
  server-layer lookup of a mapping column.

## Funding Surface Gate

N/A — no funding affordance / channel / donate-support copy (coach prompt text
only).

## API Catalog

Triggered (§21.1). `readMatchIdByReplayHash` is a new `apps/server/src/replay/**`
function beside the catalogued `Library-only` `readReplayHashByMatchId`
(`api-endpoints.md:309`). The `EC-779:` commit adds one `Library-only` row
(Scope G). The coach route's request and response shapes are unchanged: the field
rides the internal summary.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] In a 2-seat bot-ally match (bot seat `"1"`), the summary sent to the model
  marks `Player 2` `isBotAlly: true` and `Player 1` `false`. Labels are unchanged.
- [ ] In a human-only match, every seat is `isBotAlly: false`.
- [ ] A throwing bot-seat lookup still yields an `ok: true` report with no
  markers, and logs exactly one `[coach]` warning.
- [ ] A cache hit does not call the bot-seat lookup.
- [ ] `readMatchIdByReplayHash` reads `match_id` only, and returns `null` for an
  unknown hash (DB-gated test).
- [ ] The prompt carries the new sentence, and the old "bot's line shows" phrase
  is gone.
- [ ] The `Library-only` row for `readMatchIdByReplayHash` exists.
- [ ] `pnpm -r build` exits 0, and the server suite is green at baseline plus the
  new cases, with counts recorded in the commit body. The `EC-779:` diff is
  exactly the 9 files.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/server test
# Expected: exit 0; the new coach + summary cases pass (the DB-gated case skips without TEST_DATABASE_URL)

$env:TEST_DATABASE_URL = "<local test db>"; pnpm --filter @legendary-arena/server test:db
# Expected: the readMatchIdByReplayHash case runs and passes

Select-String -Path "apps\server\src\replay\matchReplay.logic.ts" -Pattern "SELECT match_id FROM bgio.replay_artifacts"
# Expected: exactly one match (the query); no initial_state/log in it

Select-String -Path "apps\server\src\coach\coachClient.ts" -Pattern "isBotAlly"
# Expected: the new prompt sentence

Select-String -Path "apps\server\src\coach\coachClient.ts" -Pattern "bot's line shows"
# Expected: zero matches (old sentence removed)

Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "readMatchIdByReplayHash"
# Expected: the new Library-only row

git diff --name-only
# Expected (implementation commit): exactly the 9 files above
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **Live verification (D-24026), on play.legendary-arena.com:**
  1. Finish a bot-ally match (`POST /api/match/create-with-bot`).
  2. Open the AI Coach panel.
  3. Confirm the coaching treats the bot seat as the ally and coaches the human.

  Model narration is nondeterministic, so the marker unit tests are the gate.
- [ ] `docs/ai/STATUS.md` updated: coach marks bot-ally seats (D-24564), with the
  live observation.
- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are modified in the
  `EC-779:` commit.
- [ ] `docs/ai/DECISIONS.md`: D-24564 landed Active.
- [ ] `WORK_INDEX.md` WP-742 is `[x]`, and `EC_INDEX.md` EC-779 is Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then
  `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

---

## Reserved Decision (lands at execution)

- **D-24564 (reserved; Drafted 2026-09-22): the endgame coach marks bot-ally
  seats.**
  - `CoachPlayerLine` gains an optional `isBotAlly`, always set by the builder;
    absent means human.
  - It is sourced by lookup: replay hash → `bgio.replay_artifacts.match_id`
    (column only; D-24122) → `legendary.match_bot_ally.bot_seats`.
  - The lookup is best-effort: a failure yields no markers, never
    `coach_unavailable`.
  - The label stays `Player N`.
  - The prompt names the field and tells the model to coach the humans and treat
    the bot as their ally.
  - Named `isBotAlly`, not D-24402's `isBot`, because the coach contract is the
    ally relationship (§23(b)).

---

## Lint Gate Self-Review (00.3)

Both rounds were run by an independent reviewer.

**Round 1: FAIL on 4 items, all fixed in this revision.**

| Item | Problem | Fix |
|---|---|---|
| §21 | `readReplayHashByMatchId` is catalogued at `api-endpoints.md:309`, so the new helper needs a row | Scope G row added; files 8 → 9 |
| §17 | Vision clauses were mis-cited | Replaced with §3, §19, §23(b), NG-1 and Financial Sustainability |
| §15 | No STATUS DoD checkbox | Checkbox added |
| §15.1 | Surface value was wrong | Set to play.legendary-arena.com |

Round 1 also found a §18 gap: nothing checked that the old sentence is gone.
The fix is a zero-match grep for "bot's line shows", plus a rule that the helper
JSDoc must not quote the SQL.

**Round 2: all sections PASS or N/A.**

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-22)**, conditional on PS-1 and PS-2. Both are
applied.

- **PS-1:** 9 existing test calls need a 5th `[]` argument. Scaffold run on a
  scratch copy: 62/62 → 10 `TypeError`s with the parameter alone → 62/62 once
  every call passes `[]`.
- **PS-2:** add the catalog row.
- **RS-1..RS-4 applied:**
  - 2-seat override and capturing model spy
  - pinned placement
  - `console.warn` spy
  - D-24122 cited
- **Verified in code:**
  - bot seat ids and `playerZones` keys are both `String(index)`
  - bot-ally matches are scored (Casual) and reach the coach
  - `match_id` is an app-owned column (D-24122)
  - the imports are same-layer, with no cycle

## Copilot Check (01.7)

**Round 1: RISK / HOLD** on #4, #11, #12, #20 and #26. All were resolved by
PS-1/2, RS-1..4, and the "absent = human" guardrail.

**Round 2: PASS on all 30 modes.** It also fixed three non-blocking citation
issues:
- the EC failure-smell count (6 tests)
- the `not_found` line range (L117–124)
- the `makeModelClient` lines (L86–98)

---

## See Also

- WP-594 / D-24403 — the coach
- WP-622 / D-24433 — per-seat lines
- WP-375 / D-24170 — bot-ally seats
- WP-593 / D-24402 — `readSeatIdentities`, the display precedent
- WP-710 / D-24533 — the best-effort coach read precedent
- WP-737 — the coach eval pack; a bot-ally eval scenario is a follow-up
