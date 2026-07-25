# EC-462 — Bot Resolves the Put-Bottom-HQ Pending Choices (getLegalMoves Short-Circuit) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (WP-427 / EC-462).
> **Source WP:** [WP-427](../work-packets/WP-427-bot-resolve-putbottomhq.md).
> **Lane:** Lightweight (2 files + tests, additive).

**Layer:** Game Engine (`packages/game-engine/src/simulation/`) + Server (`apps/server/src/autoplay/`)

## Scope (read first)
IN scope: add `getLegalMoves` short-circuits for the two put-bottom-HQ block-all pending
choices so the bot can resolve them (it faulted before — no legal move existed to clear
them); sync `findPendingChoiceMove` to all 8 resolve names. OUT of scope: the resolve
moves themselves, the client prompts, icon-optimal mandatory selection, PAR/sim baselines.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it (baseline `dde79cd9`)
- [ ] WP-242 (KO-hero short-circuit precedent) + WP-375 (bot-ally driver) are on `main`
- [ ] Reviewed `ai.legalMoves.ts` — the 6 existing pending short-circuits + fall-through enumeration
- [ ] Reviewed `resolveOptionalPutBottomHQ.ts` (args, `front.mandatory`) + `resolvePutAnyNumberBottomHQ.ts` (args, empty valid)
- [ ] Confirmed `getLegalMoves` is a PURE AI helper (no `G` mutation, not in the replay/hash path)
- [ ] `pnpm --filter @legendary-arena/game-engine build` runs (build-before-test)

## Locked Values (do not re-derive)
- optional-put-bottom default: `{ decline: true }` UNLESS `front.mandatory === true`, then `{ cardId: selectFirstHqCard(gameState.hq) }` (first non-null slot, lowest index)
- put-any-number-bottom default: `{ cardIds: [] }` ("put none")
- Each short-circuit returns a list of length EXACTLY 1; fail-closed (empty list) on an engine-invariant violation (mandatory over empty HQ)
- Short-circuit precedence: added AFTER the KO-hero check, before normal enumeration (order is irrelevant — only one pending type is ever set, block-all)
- `PENDING_CHOICE_MOVE_NAMES` → all 8: koHero, optionalKoReward, victoryPileCardPick, drawOrEmpowered, returnZeroCostDiscard, discardToPlay, optionalPutBottomHQ, putAnyNumberBottomHQ

## Guardrails
- `getLegalMoves` stays PURE — no `G` mutation, no I/O, no `.reduce()`
- NO determinism re-pin — the full engine suite must stay green with no `finalStateHash` change (getLegalMoves is not the reducer)
- The resolve-move semantics are NOT edited (only getLegalMoves' enumeration + the driver's name list)
- Deterministic defaults only (lowest-index / decline / empty) — stable across replays
- No cross-layer runtime edge added (engine AI helper + server autoplay helper stay independent)

## Required `// why:` Comments
- each new short-circuit — why it exists (block-all guard with no legal-move resolution path → the bot faulted); the deterministic default
- `selectFirstHqCard` — why lowest-index (deterministic mandatory pick)
- `PENDING_CHOICE_MOVE_NAMES` — why the full 8 (the list had drifted; the put-bottom pair had no short-circuit at all)

## Files to Produce
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — 2 imports + `selectFirstHqCard` + 2 short-circuits + 2 `SIMULATION_MOVE_NAMES` entries
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — 2 imports + 2 MOVE_MAP dispatch entries (REQUIRED or the sim per-turn loop hangs — D-24073)
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — 2 imports + 2 MOVE_MAP dispatch entries (same)
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — **modified** — 4 tests
- `apps/server/src/autoplay/botLoopProgress.mjs` — **modified** — name list → 8
- `apps/server/src/autoplay/botLoopProgress.test.ts` — **modified** — all-8-names test
- `docs/ai/DECISIONS.md` — **modified** — **D-24248** lands Active
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-427
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-462 status
- `docs/ai/NUMBER-LEDGER.md` — **modified** — reserve WP-427 / EC-462 / D-24248
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-427 node; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] Engine suite green (2069/0, +4 new); NO `finalStateHash` re-pin in the diff
- [ ] `pnpm sim:coverage --check` AND `pnpm sim:runtime-observed:check` complete (do NOT hang) — the sim-dispatch completeness gate; both were the CI failure mode
- [ ] Move-dispatch drift guard passes (`SIMULATION_MOVE_NAMES` ↔ both MOVE_MAPs in sync with the 2 added)
- [ ] `pnpm --filter @legendary-arena/server test` — bot-loop 17/0 (+1)
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `rg "hasPendingOptionalPutBottomHQ|hasPendingPutAnyNumberBottomHQ|selectFirstHqCard" packages/game-engine/src/simulation/ai.legalMoves.ts` → present
- [ ] `git diff` shows NO change to any `*.hash.*` / golden fixture / sentinel hash
- [ ] Integration (D-24026, post-deploy): a bot ally on a put-bottom-HQ hero finishes its turn
- [ ] D-24248 Active; WORK_INDEX/EC_INDEX/NUMBER-LEDGER/mindmap/STATUS updated
- [ ] `node scripts/check-number-ledger.mjs --check` green; `pnpm roadmap:counts:check` green
- [ ] Commit prefix `EC-462:`

## Common Failure Smells
- The bot still faults on those heroes → a short-circuit missing, or the default args rejected by the resolve move
- Mandatory form loops forever → defaulted to decline (a no-op for mandatory); must move a card
- Engine suite golden/hash test fails → something touched the reducer/hash path (getLegalMoves must not)
- The name list drifts again → not synced to all 8, or no test pinning the full set
- Engine tests crash on import → stale dist (build first)
