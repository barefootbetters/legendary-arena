# EC-011 — Match Creation & Lobby Flow (Execution Checklist)

**Source:** docs/ai/work-packets/WP-011-match-creation-lobby-flow.md
**Layer:** Server + Game Engine / Match Lifecycle

**Execution Authority:**
This EC is the authoritative execution checklist for WP-011.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-011.

---

## Before Starting

- [ ] WP-010 complete: `LegendaryGame` has `lobby` phase stub, `evaluateEndgame` wired
- [ ] `MatchSetupConfig` and `validateMatchSetup` exist in `matchSetup.types.ts` (WP-005A)
- [ ] `MoveResult` and `MoveError` exist in `coreMoves.types.ts` (WP-008A)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-011.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `LobbyState` fields (exactly 3):
  `requiredPlayers: number` (init: `ctx.numPlayers`) |
  `ready: Record<string, boolean>` (init: `{}`) |
  `started: boolean` (init: `false`)
- `requiredPlayers` comes from `ctx.numPlayers` -- NOT from `MatchSetupConfig`
- Observability ordering (non-negotiable exact order inside `startMatchIfReady`):
  1. `validateCanStartMatch(G.lobby)` -- if `ok: false`, return
  2. `G.lobby.started = true` -- set flag IN `G` first
  3. `ctx.events.setPhase('setup')` -- then transition the phase
- Phase names: `'lobby'` | `'setup'` | `'play'` | `'end'`
- `MoveError` shape (reused from WP-008A): `{ code: string; message: string; path: string }`

---

## Guardrails

- `G.lobby.started = true` BEFORE `ctx.events.setPhase('setup')` -- order is non-negotiable
- Lobby moves wired inside `lobby` phase `moves` block -- not top-level `moves`
- Reuse `MoveResult`/`MoveError` from `coreMoves.types.ts` -- no new error types
- Validators return `MoveResult`, never throw
- `create-match.mjs` uses Node v22 built-in `fetch` -- no axios, no node-fetch
- `G.lobby` must be JSON-serializable at all times
- Every `ctx.events.setPhase()` call must have a `// why:` comment

---

## Required `// why:` Comments

- `ctx.events.setPhase('setup')` in `startMatchIfReady`: lobby transitions to setup; `G.lobby.started` set first for UI observability
- `G.lobby.started` boolean: stored in `G` so UI can observe lobby completion regardless of read timing
- `ctx.currentPlayer` as ready-map key: ensures each player only sets their own readiness

---

## Files to Produce

- `src/lobby/lobby.types.ts` -- **new** -- `LobbyState`, `SetPlayerReadyArgs`
- `src/lobby/lobby.validate.ts` -- **new** -- two validators
- `src/lobby/lobby.moves.ts` -- **new** -- `setPlayerReady`, `startMatchIfReady`
- `src/game.ts` -- **modified** -- wire lobby moves + initialize `G.lobby`
- `src/types.ts` -- **modified** -- add `lobby: LobbyState`
- `src/index.ts` -- **modified** -- export new public API
- `apps/server/scripts/create-match.mjs` -- **new** -- CLI match creation script
- `src/lobby/lobby.moves.test.ts` -- **new** -- 6 tests (`node:test`)

---

## Common Failure Smells (Optional)

- Lobby moves registered at top-level instead of inside `lobby` phase block
  -> boardgame.io phase isolation violated
- `G.lobby.started` set after `setPhase` call
  -> UI observability pattern broken
- New `LobbyMoveError` type created instead of reusing `MoveError`
  -> parallel error type drift

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `throw` in `lobby.validate.ts`
- [ ] Lobby moves inside `lobby` phase block -- not top-level
- [ ] `G.lobby.started = true` before `ctx.events.setPhase('setup')`
- [ ] `docs/ai/STATUS.md` updated (match creation and lobby flow operational)
- [ ] `docs/ai/DECISIONS.md` updated (`G.lobby.started` flag rationale; `startMatchIfReady` -> setup not play; `ctx.currentPlayer` as ready-map key)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-011 checked off with date
