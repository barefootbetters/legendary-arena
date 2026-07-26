# WP-433 — Bot-Ally Turn-Fault Observability (Log the Reason + Pending-Choice State) (Server)

**Status:** Draft 2026-07-26 · **PROPOSED (WP-433; highest landed WP is 432)** · **Lightweight lane** (D-24028 — 1 source file + 1 test file, log-only). Pairs with **EC-468** (authored). Reserves **D-24255** (lands at execution).
**Primary Layer:** Server (`apps/server/src/bot-ally/`)
**User-Visible Surface:** none — internal operator tooling. The payoff is that the *next* live bot-ally freeze is diagnosable from a single server-log line. **D-24026 N/A.**
**Dependencies:** WP-375 ✅ (bot-ally driver), WP-419 ✅ (fault/status machinery), WP-427 ✅ (the getLegalMoves pending-resolution class this helps diagnose). No hard-dep WP in flight.
**Baseline:** `origin/main` @ `080399a9` (capture `git rev-parse origin/main` at execution).

---

## Goal

Close the **silent-fault observability gap** in the bot-ally driver. A recurring
freeze (`status: faulted`, `driving: false`, "could not finish its turn") could
not be root-caused from server logs across three rounds, because
`attemptBotTurn` (`botAllyDriver.mjs`) has **four** fault-return sites and **only
the `decision-threw` one logged** — the other three (policy returned no move; the
offered move never advanced the `_stateID`; the per-turn step cap) faulted
silently.

From the client diagnostic alone the two candidate causes are
indistinguishable and the deciding data is server-side:
- **A getLegalMoves resolution gap** — a block-all pending choice is set that has
  no bot-resolvable move (the WP-427 class). `awaitingPlayerInput` surfaces only 4
  of the 8 pending types, so the client can't see the culprit.
- **A store/`_stateID` wedge** — the offered move never advanced (transient DB /
  two-writer). No pending set.

The discriminator is the set of `G.pending*` flags at fault time plus the
dispatched move — none of which was logged.

---

## User-Visible Impact

None directly. Operationally: the next bot-ally fault logs its exact reason and
the pending-choice state, so a freeze that today costs multiple rounds of
log-trading becomes a one-shot diagnosis (and points at the right layer to fix —
engine `ai.legalMoves.ts` vs the driver's `_stateID` retry path).

---

## Assumes

- **All four fault returns pass through `attemptBotTurn`** and have access to the
  fetched state (`state`) — except the step-cap return, which is out of the loop
  scope and needs the retained last snapshot. (Verified.)
- **`G` carries nine block-all pending flags** (`pendingHeroChoice`,
  `pendingKoHeroChoices`, `pendingOptionalKoRewards`, `pendingVictoryPileCardPick`,
  `pendingDrawOrEmpowered`, `pendingReturnZeroCostDiscard`, `pendingDiscardToPlay`,
  `pendingOptionalPutBottomHQ`, `pendingPutAnyNumberBottomHQ`). (Verified against
  `types.ts`.)
- **A fault log must never itself throw** — the summarizer is fully defensive.

---

## Scope

**IN scope**
- A `summarizeBotTurnState(state, botSeat)` helper: one-line `turn / stage /
  stateId / available attack+recruit / hand size / set pending flags`, defensive.
- A `console.error('[bot-ally] … FAULTED (<reason>): <summary>')` at each of the
  four fault-return sites; the move-did-not-advance site names the offered move.
- Retain the last fetched state so the step-cap fault (post-loop) can summarize.
- Tests: a fault-log-capture test + a `summarizeBotTurnState` unit test.

**OUT of scope**
- Any fix to the underlying fault (the getLegalMoves gap or the `_stateID` wedge)
  — this WP makes the NEXT occurrence diagnosable; the fix follows the log.
- The fault decision, teardown, persisted status/message, revival, status route —
  all unchanged.

---

## Non-Negotiable Constraints

- **Behavior-neutral.** Only `console.error` diagnostic lines are added; the
  fault kind/message, teardown, and every persisted value are byte-unchanged.
- The summarizer never throws (a fault log must not crash the tick).
- No determinism/persistence/response-shape/auth change; server-layer only.

---

## Files

- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** — `PENDING_CHOICE_FLAGS`
  + `summarizeBotTurnState` (exported for test) + a fault log at each of the 4
  returns + a retained `lastStateSnapshot`.
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** — +2 tests.
- Governance: `docs/ai/DECISIONS.md` (D-24255), `docs/ai/NUMBER-LEDGER.md`,
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`.

---

## Definition of Done

- Each of the four fault returns logs a `[bot-ally] … FAULTED (<reason>)` line
  carrying the pending-choice summary; step-cap uses the retained snapshot.
- `pnpm --filter @legendary-arena/server build` 0; bot-ally driver suite **25/0**
  (+2); no behavior/persisted-value change in the diff.
- `pnpm -r build` 0.
- D-24255 Active; WORK_INDEX / EC_INDEX / NUMBER-LEDGER / mindmap / STATUS updated;
  ledger + roadmap-counts gates green.
- Commit prefix `EC-468:`.

---

## Vision Check (§17)

N/A — internal operator observability. No rule, economy, revenue, or player-facing
change.
