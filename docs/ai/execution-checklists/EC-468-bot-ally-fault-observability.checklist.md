# EC-468 — Bot-Ally Turn-Fault Observability (Execution Checklist)

> **Status:** PROPOSED (WP-433 / EC-468 / D-24255).
> **Source WP:** [WP-433](../work-packets/WP-433-bot-ally-fault-observability.md).
> **Lane:** Lightweight (1 source + 1 test file, server log-only).

**Layer:** Server (`apps/server/src/bot-ally/`)

## Scope (read first)
IN scope: log the reason + turn/stage + set block-all pending-choice flags at every
bot-turn fault return, so a freeze is diagnosable from the server log. OUT of scope: any
fix to the underlying fault; the fault decision/teardown/persisted status; the status
route.

## Before Starting
- [ ] `git rev-parse origin/main` recorded (baseline `080399a9`)
- [ ] Reviewed the four fault returns in `attemptBotTurn` (`botAllyDriver.mjs`): decision-threw, policy-no-move, move-did-not-advance, step-cap — confirm 3 of 4 log nothing today
- [ ] Confirmed the nine pending flag names in `packages/game-engine/src/types.ts`
- [ ] `pnpm -r build` (game-engine dist must exist or the server tests fail at import)

## Locked Values (do not re-derive)
- Nine pending flags: pendingHeroChoice, pendingKoHeroChoices, pendingOptionalKoRewards, pendingVictoryPileCardPick, pendingDrawOrEmpowered, pendingReturnZeroCostDiscard, pendingDiscardToPlay, pendingOptionalPutBottomHQ, pendingPutAnyNumberBottomHQ
- A flag is "set" iff truthy AND (not an array OR non-empty)
- Summary fields: `turn stage stateId attack recruit hand pending=[…]` (available economy = gross − spent)
- The step-cap fault is OUTSIDE the loop → it must use a retained `lastStateSnapshot`, not `state`
- The move-did-not-advance fault names the offered `move.name`

## Guardrails
- **Behavior-neutral** — only `console.error` lines added; the fault kind/message, teardown, and every persisted value are byte-unchanged
- `summarizeBotTurnState` is fully defensive (try/catch; null state → `state=unavailable`) — a fault log must never crash the tick
- No determinism/persistence/response-shape/auth change; server-layer only
- Do NOT attempt to FIX the underlying fault here (that follows the first real log)

## Required `// why:` Comments
- `PENDING_CHOICE_FLAGS` / `summarizeBotTurnState` — why the pending set is the getLegalMoves-gap-vs-store-wedge discriminator
- `lastStateSnapshot` — why the step-cap fault needs a retained state
- each new fault log — what the reason distinguishes

## Files to Produce
- `apps/server/src/bot-ally/botAllyDriver.mjs` — **modified** — flags + summarizer (exported) + 4 fault logs + retained snapshot
- `apps/server/src/bot-ally/botAllyDriver.test.ts` — **modified** — +2 tests (fault-log capture + summarizer unit)
- `docs/ai/DECISIONS.md` — **modified** — **D-24255** lands Active
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-433 row
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-468 row
- `docs/ai/NUMBER-LEDGER.md` — **modified** — reserve WP-433 / EC-468 / D-24255
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-433 node; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm --filter @legendary-arena/server build` exits 0
- [ ] Bot-ally driver suite green (**25/0**, +2) — `node --import tsx --test apps/server/src/bot-ally/botAllyDriver.test.ts`
- [ ] `pnpm -r build` 0
- [ ] `git diff` shows only `console.error` additions in the driver (no changed fault kind/message/persist)
- [ ] D-24255 Active; WORK_INDEX / EC_INDEX / NUMBER-LEDGER / mindmap / STATUS updated
- [ ] `node scripts/check-number-ledger.mjs --check` green; `pnpm roadmap:counts:check` green
- [ ] Commit prefix `EC-468:`

## Common Failure Smells
- The step-cap fault logs `state=unavailable` → you used `state` (out of scope post-loop) instead of `lastStateSnapshot`
- A test import crash `Cannot find … game-engine/dist` → run `pnpm -r build` first (server tests import built dist)
- The fault log throws on a malformed state → the summarizer's try/catch is missing
- A behavior test now fails → you changed a fault kind/message/persist, not just added a log
