# WP-011 — Match Creation & Lobby Flow (Minimal MVP)

**Status:** Complete
**Primary Layer:** Server + Game Engine (Match Lifecycle)
**Dependencies:** WP-010

---

## Session Context

WP-010 locked the victory and loss conditions via `evaluateEndgame` and
`ENDGAME_CONDITIONS` constants, completing the core gameplay loop. This packet
adds the first human interaction layer: players join a match, signal readiness
in the `lobby` phase, and trigger the transition into setup and play.
`G.lobby.started` establishes the UI observability pattern — a flag stored in
`G` before calling `ctx.events.setPhase()` so the UI can detect phase exit
without inspecting `ctx.phase`.

---

## Goal

Enable a minimal end-to-end multiplayer workflow where a match can be created
with a canonical `MatchSetupConfig`, joined by players, held in a `lobby` phase
until all required players are ready, and then transitioned deterministically
into gameplay.

After this session:
- `G.lobby` exists with a typed, JSON-serializable lobby state
- `setPlayerReady` and `startMatchIfReady` moves are wired into the `lobby` phase
- A CLI script creates a match against the running server using Node built-in
  `fetch`
- Tests validate lobby gating and deterministic phase transition
- The `lobby` phase transitions cleanly into `setup` → `play` when all players
  are ready

---

## Assumes

- WP-010 complete. Specifically:
  - `packages/game-engine/src/game.ts` exports `LegendaryGame` with a `lobby`
    phase already defined as a stub (WP-002)
  - `packages/game-engine/src/matchSetup.types.ts` exports `MatchSetupConfig`
    and `validateMatchSetup` (WP-005A)
  - `packages/game-engine/src/moves/coreMoves.types.ts` exports `MoveResult`
    and `MoveError` — reuse these rather than defining new error types (WP-008A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `packages/game-engine/src/turn/turnPhases.types.ts` exports `MatchPhase`
    (WP-007A)
  - `apps/server/src/server.mjs` is running with `LegendaryGame` registered and
    the health endpoint responding (WP-004)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists (created in WP-002)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 4` — read "Phase Sequence and Lifecycle
  Mapping" for the full `lobby → setup → play → end` transition table and why
  `startMatchIfReady` transitions to `setup` rather than directly to `play`.
  Also read "The `G.lobby.started` Observability Pattern" — the rule that a
  UI-significant flag must be set in `G` before calling `ctx.events.setPhase()`,
  not after. Also read "How Phase Transitions Work" — `ctx.events.setPhase()`
  is the only permitted mechanism; never set `ctx.phase` directly.
- `packages/game-engine/src/game.ts` — read it entirely. The `lobby` phase
  exists as a stub from WP-002. This packet adds moves and a phase transition
  to it. Understand the existing phase structure before modifying anything.
- `packages/game-engine/src/types.ts` — read `LegendaryGameState`. The `lobby`
  field (`G.lobby`) is new in this packet. Understand all existing fields before
  adding to avoid conflicts.
- `packages/game-engine/src/moves/coreMoves.types.ts` — `MoveResult` and
  `MoveError`. Lobby move validators must reuse these types. Do not define a
  separate `LobbyMoveError` — one error shape for the whole engine.
- `packages/game-engine/src/matchSetup.types.ts` — `MatchSetupConfig`. The
  `requiredPlayers` count in `G.lobby` comes from `ctx.numPlayers` at setup
  time, not from `MatchSetupConfig` — but read the setup payload to understand
  what is available at `Game.setup()`.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: no DB queries inside boardgame.io moves; no custom WebSocket
  logic outside `boardgame.io Server()`; all moves must be pure and
  deterministic; `ctx.events.setPhase()` is the boardgame.io mechanism for
  transitioning phases from within a move.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1 and §8.2` — setup payload
  shape and runtime state boundaries. `G.lobby` must be JSON-serializable.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `requiredPlayerCount` not `req`), Rule 6 (`// why:` on
  `ctx.events.setPhase` and on why `started` is a boolean flag rather than
  being implied by phase), Rule 9 (`node:` prefix), Rule 11 (full-sentence
  error messages), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets,
  or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside boardgame.io moves or hooks
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `G.lobby` contains only primitives, plain objects, and arrays —
  JSON-serializable at all times
- Lobby moves return structured results — never throw
- `startMatchIfReady` sets `G.lobby.started = true` BEFORE calling
  `ctx.events.setPhase('setup')` — the flag must be in `G` before the phase
  transition; order is non-negotiable
- Every call to `ctx.events.setPhase()` must have a `// why:` comment
- Lobby moves are wired inside the `lobby` phase `moves` block — not in the
  top-level `moves` object (boardgame.io enforces phase isolation)
- `create-match.mjs` uses Node v22 built-in `fetch` — no axios, no node-fetch
- `MoveResult` and `MoveError` are reused from `coreMoves.types.ts` — do not
  define a new `LobbyMoveError` or parallel error type

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **LobbyState fields** (this packet defines `LobbyState` with exactly these
  3 fields — initialized in `Game.setup()` as shown):
  `requiredPlayers: number` (init: `ctx.numPlayers`) |
  `ready: Record<string, boolean>` (init: `{}`) |
  `started: boolean` (init: `false`)
  Note: `requiredPlayers` comes from `ctx.numPlayers` — NOT from `MatchSetupConfig`

- **Observability ordering rule** (non-negotiable — must be in this exact order
  inside `startMatchIfReady`):
  1. `validateCanStartMatch(G.lobby)` — if `ok: false`, return
  2. `G.lobby.started = true` ← set the flag IN `G` first
  3. `ctx.events.setPhase('setup')` ← then transition the phase
  This order ensures the UI can observe `G.lobby.started` regardless of when
  it reads `G` relative to the phase transition.

- **Phase names** (this packet transitions from `lobby` to `setup` — the
  argument to `ctx.events.setPhase()` must be exactly `'setup'`):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

- **MoveError shape** (reused from WP-008A for all lobby validators — do not
  redefine):
  `{ code: string; message: string; path: string }`

---

## Scope (In)

### A) `src/lobby/lobby.types.ts` — new
- `interface LobbyState`:
  - `requiredPlayers: number` — set from `ctx.numPlayers` at setup time
  - `ready: Record<string, boolean>` — keyed by player ID; `false` by default
  - `started: boolean` — `false` until `startMatchIfReady` succeeds
- `interface SetPlayerReadyArgs { ready: boolean }`
- Re-export `MoveResult` and `MoveError` from `coreMoves.types.ts` for
  convenience — do not duplicate the type definitions

### B) `src/lobby/lobby.validate.ts` — new (all validators return `MoveResult`, never throw)
- `validateSetPlayerReadyArgs(args: unknown): MoveResult`
  — `ready` must be a boolean; returns `{ ok: false }` if not
- `validateCanStartMatch(lobby: LobbyState): MoveResult`
  — all player IDs in `lobby.ready` must map to `true`, and the count must
  equal `lobby.requiredPlayers`; returns `{ ok: false, errors }` with a
  full-sentence message if not all ready

### C) `src/lobby/lobby.moves.ts` — new

**`setPlayerReady(G, ctx, args)`:**
- Calls `validateSetPlayerReadyArgs(args)` — if `ok: false`, return
- Sets `G.lobby.ready[ctx.currentPlayer] = args.ready`
- `// why:` comment: keying by `ctx.currentPlayer` ensures each player only
  sets their own readiness; boardgame.io passes the authenticated player ID
  through `ctx.currentPlayer`

**`startMatchIfReady(G, ctx)`:**
- Calls `validateCanStartMatch(G.lobby)` — if `ok: false`, return
- Sets `G.lobby.started = true` ← must happen before `setPhase`
- Calls `ctx.events.setPhase('setup')`:
  ```ts
  // why: ctx.events.setPhase is the boardgame.io mechanism for transitioning
  // phases from within a move. The lobby transitions to setup, which then
  // transitions to play once setup completes. G.lobby.started is set before
  // this call so the UI can observe lobby completion regardless of read timing.
  ```

### D) `src/types.ts` — modified
- Add `lobby: LobbyState` to `LegendaryGameState`
- Initialize in `Game.setup()` as
  `{ requiredPlayers: ctx.numPlayers, ready: {}, started: false }`

### E) `src/game.ts` — modified
- Add `moves: { setPlayerReady, startMatchIfReady }` to the `lobby` phase block
  (not the top-level moves object — boardgame.io phase isolation)
- Initialize `G.lobby` in `Game.setup()` as specified in Scope D
- Keep the existing `setup`, `play`, and `end` phase stubs unchanged

### F) `src/index.ts` — modified
- Export `LobbyState`, `SetPlayerReadyArgs`, `validateSetPlayerReadyArgs`,
  `validateCanStartMatch` as named public exports

### G) `apps/server/scripts/create-match.mjs` — new CLI script
- Reads a `MatchSetupConfig` JSON file from a path provided as a CLI argument
- Validates the JSON using `validateMatchSetup` from
  `@legendary-arena/game-engine` before sending
- POSTs to `http://localhost:8000/games/legendary-arena/create` using Node v22
  built-in `fetch` — no axios, no node-fetch
- Prints `matchID` and player credentials returned by the server
- Exits 1 on network error or validation failure with a full-sentence message
- ESM module (`.mjs` extension)

### H) Tests — `src/lobby/lobby.moves.test.ts` — new
- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; does not import
  from `boardgame.io`
- Six tests:
  1. `setPlayerReady({ ready: true })` sets `G.lobby.ready[playerId]` to `true`
  2. `setPlayerReady({ ready: false })` sets `G.lobby.ready[playerId]` to `false`
  3. `setPlayerReady` with invalid args (non-boolean) does not mutate `G`
  4. `startMatchIfReady` with all players ready sets `started: true` and calls
     `ctx.events.setPhase`
  5. `startMatchIfReady` with one player not ready does not mutate `G`
  6. `JSON.stringify(G.lobby)` succeeds after all operations

---

## Out of Scope

- No custom REST API routes beyond boardgame.io defaults
- No matchmaking, ranking, or player search
- No reconnect flow — that is WP-012
- No persistence boundaries documentation — that is WP-013
- No UI changes
- No authentication — `ctx.currentPlayer` is the only player identity used here
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/lobby/lobby.types.ts` — **new** — `LobbyState`
  and move arg types
- `packages/game-engine/src/lobby/lobby.validate.ts` — **new** — two validators
- `packages/game-engine/src/lobby/lobby.moves.ts` — **new** — `setPlayerReady`
  and `startMatchIfReady`
- `packages/game-engine/src/game.ts` — **modified** — wire lobby moves +
  initialize `G.lobby`
- `packages/game-engine/src/types.ts` — **modified** — add `lobby: LobbyState`
  to `LegendaryGameState`
- `packages/game-engine/src/index.ts` — **modified** — export new public API
- `apps/server/scripts/create-match.mjs` — **new** — CLI match creation script
- `packages/game-engine/src/lobby/lobby.moves.test.ts` — **new** — `node:test`
  coverage

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Lobby State
- [ ] `LobbyState` in `lobby.types.ts` has exactly 3 fields:
      `requiredPlayers: number`, `ready: Record<string, boolean>`,
      `started: boolean`
- [ ] `LegendaryGameState` in `src/types.ts` has `lobby: LobbyState`
- [ ] `G.lobby` is initialized in `Game.setup()` with `requiredPlayers`
      set to `ctx.numPlayers`, `ready: {}`, `started: false`
- [ ] `JSON.stringify(G.lobby)` succeeds

### Lobby Moves
- [ ] `setPlayerReady` and `startMatchIfReady` are wired inside the `lobby`
      phase `moves` block in `src/game.ts` — not in the top-level `moves` object
      (confirmed with `Select-String` for the moves in the `lobby` phase config)
- [ ] `setPlayerReady({ ready: true })` with a valid `makeMockCtx` context
      sets `G.lobby.ready[ctx.currentPlayer]` to `true`
- [ ] `setPlayerReady` with `{ ready: 'yes' }` does not mutate `G`
- [ ] `startMatchIfReady` when not all players ready returns without mutating
      `G.lobby.started`
- [ ] `startMatchIfReady` when all players ready sets `G.lobby.started` to
      `true` and calls `ctx.events.setPhase`
- [ ] `G.lobby.started` is set to `true` before `ctx.events.setPhase` is called
      — not after (confirmed by reading the move implementation)
- [ ] `startMatchIfReady` has a `// why:` comment on `ctx.events.setPhase`
- [ ] No validator in `lobby.validate.ts` contains a `throw` statement
      (confirmed with `Select-String`)

### Create Match Script
- [ ] `apps/server/scripts/create-match.mjs` exists and is valid ESM
- [ ] Script uses `fetch` with no `import` of axios or node-fetch
      (confirmed with `Select-String` for `axios` and `node-fetch`)
- [ ] Script exits with code 1 on network error

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Lobby test includes all 6 test cases specified in Scope (In)
- [ ] Test does not import from `boardgame.io`
      (confirmed with `Select-String`)
- [ ] Test uses `makeMockCtx` from `src/test/mockCtx.ts`
- [ ] Test uses `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after lobby wiring
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm validators do not throw
Select-String -Path "packages\game-engine\src\lobby\lobby.validate.ts" -Pattern "throw "
# Expected: no output

# Step 4 — confirm lobby moves are in the lobby phase (not top-level)
Select-String -Path "packages\game-engine\src\game.ts" -Pattern "setPlayerReady"
# Expected: match found inside the lobby phase config block

# Step 5 — confirm G.lobby.started is set before setPhase call
Select-String -Path "packages\game-engine\src\lobby\lobby.moves.ts" -Pattern "started"
# Expected: at least one match showing the assignment before setPhase

# Step 6 — confirm create-match.mjs uses no external HTTP packages
Select-String -Path "apps\server\scripts\create-match.mjs" -Pattern "axios|node-fetch"
# Expected: no output

# Step 7 — confirm no require() in any generated file
Select-String -Path "packages\game-engine\src\lobby" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — smoke test the script against a running server (manual step)
node --env-file=.env apps/server/src/index.mjs
# In a second terminal:
node apps/server/scripts/create-match.mjs --players 2 --setup ./tmp/match-setup.json
# Expected: prints matchID and player credentials JSON

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No `throw` in `lobby.validate.ts` (confirmed with `Select-String`)
- [ ] Lobby moves are inside the `lobby` phase block — not top-level
      (confirmed with `Select-String`)
- [ ] `G.lobby.started = true` is set before `ctx.events.setPhase('setup')` —
      not after (confirmed by reading `lobby.moves.ts`)
- [ ] `create-match.mjs` has no axios or node-fetch import
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — a match can now be created and players
      can join and transition into gameplay
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why `G.lobby.started` is
      a boolean flag stored in `G` rather than relying on `ctx.phase` alone;
      why `startMatchIfReady` transitions to `setup` rather than directly to
      `play`; why `ctx.currentPlayer` is used as the ready-map key
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-011 checked off with today's date
