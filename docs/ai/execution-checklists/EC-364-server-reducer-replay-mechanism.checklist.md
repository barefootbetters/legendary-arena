# EC-364 — Server-Layer Faithful Reducer-Replay Mechanism (Execution Checklist)

**Source:** docs/ai/work-packets/WP-334-server-reducer-replay-mechanism.md
**Layer:** Server (`apps/server/**`)

## Before Starting
- [ ] D-24119 Active (arc; authorizes server reducer-replay + D-24095 read carve-out)
- [ ] WP-309/D-24095 Done — `bgio.matches` stores `initial_state` + `log` (LogEntry[]); migration 023
- [ ] Read the installed `boardgame.io@0.50.2/dist/cjs/internal.js` + `reducer-*.js` + `plugin-random-*.js` + `turn-order-*.js` — confirm the reducer API, action shape, seed location BEFORE coding
- [ ] `pnpm install` + `pnpm -r build` exit 0
- [ ] Target file set == the WP `Files Expected to Change` allowlist; anything outside is a FAIL

## Locked Values (do not re-derive)
- Module: `apps/server/src/replay/matchReplay.logic.ts`
- `readMatchForReplay(matchId, database)` → `{ initialState, log, metadata } | null` — `SELECT initial_state, log, metadata FROM bgio.matches WHERE match_id = $1`; `null` when row absent OR `initial_state` null
- `reduceMatchToFinalState({ initialState, log })` → `{ finalState: LegendaryGameState, stateHash }` — pure; `CreateGameReducer({ game: LegendaryGame, isClient: false })`; start from `initialState`; fold `log[i].action`; `stateHash = computeStateHash(finalState)`
- Reducer: `CreateGameReducer({ game: LegendaryGame, isClient: false })` — `isClient: false` MANDATORY
- Faithfulness invariant (test assertion): `reduceMatchToFinalState({ initialState, log }).stateHash === computeStateHash(liveFinalState.G)`
- Reserves D-24121

## Guardrails
- Start the replay from the persisted `initial_state` blob — NEVER from a fresh `InitializeGame` (no seed param → fresh Date seed → divergence). `InitializeGame` is TEST-ONLY (to manufacture a start state whose seed then travels in the blob)
- `isClient: false` (a client reducer skips GAME_EVENT + move triggers → phase/turn hooks + start-of-turn draw would not fire)
- Reconstruct from raw `state`/`initial_state`, NEVER the `playerView`/UIState projection
- Null `initial_state` / empty / malformed `log` → fail closed (typed not-replayable / full-sentence error), never a partial state
- Canonical hash = current `computeStateHash` over the reduced `G`; DO NOT change `computeStateHash`'s field set (messages/logMeta reconciliation is WP-4, shared with `desync.detect`)
- Does NOT repoint the WP-053 verifier (blocked on the WP-3 `replayHash → matchId` mapping); does NOT capture live matches; does NOT edit any engine file; does NOT touch the engine `replayGame` harness or any determinism fixture
- Server layer: MAY import `boardgame.io/internal` (D-24119/D-24095); engine `replay/` may not. No new npm dep. boardgame.io `^0.50.0` LOCKED — note the internal coupling

## Required `// why:` Comments
- `matchReplay.logic.ts` start-from-initialState: why the persisted blob (seed lives at `plugins.random.data`), NOT `InitializeGame` (which mints a fresh seed)
- `matchReplay.logic.ts` `isClient: false`: why (GAME_EVENT + triggers → phase/turn hooks fire only server-side)
- `matchReplay.logic.ts` 0.50.x coupling: why the reducer-internal import is version-pinned
- `matchReplay.logic.ts` null-initial_state fail-closed: why a setState-upsert row (migration 023 nullable) is not replayable

## Files to Produce
- `apps/server/src/replay/matchReplay.logic.ts` — **new** — `readMatchForReplay` + `reduceMatchToFinalState`
- `apps/server/src/replay/matchReplay.logic.test.ts` — **new** — faithfulness golden + fail-closed + DB-gated read
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — Library-only row(s) for the new function(s)
- `docs/ai/DECISIONS.md` — **modified** — D-24121

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 (faithfulness golden asserts reduced final G hash === live final G hash; fail-closed test green; baseline preserved)
- [ ] Grep: `boardgame.io/internal` + `isClient: false` present in `matchReplay.logic.ts`; `InitializeGame` absent from the mechanism (test-only)
- [ ] `git diff --name-only packages/` empty (engine untouched)
- [ ] `api-endpoints.md` Library-only row added (§21)
- [ ] `docs/ai/STATUS.md` states "No user-observable change — infrastructure only" (+ payoff)
- [ ] `docs/ai/DECISIONS.md` D-24121 Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `git diff --name-only` == allowlist

## Common Failure Smells (Optional)
- Reduced final G hash ≠ live final G hash → replay started from a fresh `InitializeGame` (new seed) instead of the persisted `initial_state`, or `isClient: true`
- Start-of-turn draw missing from the replayed state → `isClient: true` (GAME_EVENT/triggers skipped) or GAME_EVENT log entries filtered out
- A determinism fixture (`PRE_WP080_HASH` / replay-producer goldens) moved → the engine `replayGame`/`computeStateHash` was changed (out of scope; that is WP-4)
