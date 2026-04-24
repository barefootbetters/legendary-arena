# WP-089 — Engine PlayerView Wiring

**Status:** Ready
**Primary Layer:** Game Engine / Implementation
**Dependencies:** WP-028 (UIState + buildUIState), WP-029 (filterUIStateForAudience)

---

## Session Context

WP-028 locked `buildUIState(gameState, ctx)` as the sole engine→UI
projection and WP-029 added `filterUIStateForAudience(uiState, audience)`
for spectator-safe views; `LegendaryGame` in `packages/game-engine/src/game.ts`
does not currently set boardgame.io's `playerView` hook, so connected
clients receive raw `LegendaryGameState` instead of `UIState`. This
packet wires `playerView` so every state frame boardgame.io pushes to a
client is already an audience-filtered `UIState`.

---

## Goal

After this session, `LegendaryGame.playerView` is a pure function
`(G, ctx, playerID) => UIState` that:

- Calls `buildUIState(G, { phase: ctx.phase, turn: ctx.turn, currentPlayer: ctx.currentPlayer })`
- Calls `filterUIStateForAudience(uiState, audience)` where `audience` is
  derived from `playerID` (a seated player ID → `{ kind: 'player', playerId }`;
  `null` / `undefined` → `{ kind: 'spectator' }`)
- Returns the filtered `UIState` object
- Never mutates `G` or `ctx`
- Never throws
- Never imports from `apps/server/**` or `packages/registry/**`

The server's existing wiring (`Server({ games: [LegendaryGame] })` in
`apps/server/src/server.mjs`) is unchanged — the `playerView` change is
transparent to the server layer.

---

## Assumes

- WP-028 complete. Specifically:
  - `packages/game-engine/src/ui/uiState.build.ts` exports
    `buildUIState(gameState: LegendaryGameState, ctx: UIBuildContext): UIState`
    where `UIBuildContext = { phase: string | null; turn: number; currentPlayer: string }`
  - `packages/game-engine/src/ui/uiState.types.ts` exports `UIState`
  - `packages/game-engine/src/index.ts` re-exports `buildUIState` and `UIState`
- WP-029 complete. Specifically:
  - `packages/game-engine/src/ui/uiState.filter.ts` exports
    `filterUIStateForAudience(uiState: UIState, audience: UIAudience): UIState`
  - `UIAudience` is a discriminated union with at minimum
    `{ kind: 'player'; playerId: string }` and `{ kind: 'spectator' }` members
- `packages/game-engine/src/game.ts` exports `LegendaryGame` as
  `Game<LegendaryGameState, Record<string, unknown>, MatchConfiguration>`
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists
- `docs/ai/ARCHITECTURE.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the engine
  may export pure projection functions; the server's role is wiring only.
  `playerView` is a projection configured on the engine's `LegendaryGame`
  object, not a server-layer responsibility.
- `docs/ai/ARCHITECTURE.md §Section 4` — UIState is the sole projection
  contract from engine to UI.
- `packages/game-engine/src/game.ts` — read the entire `LegendaryGame`
  object definition before modifying it. Do not reorder existing fields;
  add `playerView` adjacent to `setup` / `moves` / `phases`.
- `packages/game-engine/src/ui/uiState.build.ts` — read the signature and
  the `UIBuildContext` interface. Do not widen `UIBuildContext`.
- `packages/game-engine/src/ui/uiState.filter.ts` — read the `UIAudience`
  discriminated union shape. Do not add new audience variants in this packet.
- `docs/ai/DECISIONS.md` — scan for any prior decision about playerView or
  per-client state projection.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: no DB queries in moves or pipelines; all projections are
  deterministic; no wall-clock or I/O.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix),
  Rule 11 (full-sentence error messages), Rule 13 (ESM only).
- `.claude/rules/game-engine.md §LegendaryGame` — exactly one `Game()`
  object; `playerView` is registered on that single object.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `playerView` must be a pure function — no wall-clock reads, no RNG, no I/O,
  no mutation of `G` or `ctx`
- `playerView` must never throw — a malformed `ctx` or unexpected `playerID`
  returns a best-effort `UIState` (spectator-filtered if `playerID` is
  unparseable), never an exception
- `playerView` must never import from `apps/server/**` or
  `packages/registry/**`
- The `LegendaryGame` object must remain the single `Game()` instance —
  no parallel `LegendaryGame`-plus-view wrapper is permitted
- No existing field on `LegendaryGame` may be reordered or renamed —
  `playerView` is added, not a refactor
- No change to `buildUIState` or `filterUIStateForAudience` signatures or
  bodies — both are locked contracts from WP-028 / WP-029
- No change to `apps/server/**` in this packet — server-side wiring already
  passes `LegendaryGame` into `Server()` and inherits the new field
  automatically

**Session protocol:**
- If `UIAudience` does not have exactly the `{ kind: 'player'; playerId: string }`
  and `{ kind: 'spectator' }` variants assumed above, stop and re-read
  `packages/game-engine/src/ui/uiState.filter.ts` before writing any code.
  Do not guess the audience shape.

> **Type Safety Note (Read Before Implementation):**
>
> boardgame.io `Game<G, Moves, Setup>` permits `playerView` to return a
> reshaped client-visible state. If TypeScript rejects the return type
> (`UIState` instead of `LegendaryGameState`), the **only acceptable fixes**
> in this packet are:
>
> - Adjusting the `Game<...>` generic type parameters on `LegendaryGame`, or
> - Applying a *local, narrowly-scoped* type assertion **at the `playerView`
>   assignment site only**
>
> Introducing wrapper `Game()` instances, parallel `LegendaryGame` objects,
> or server-layer projections is **out of scope** and must not be used.
> If neither acceptable fix resolves the type error, stop and ask the human
> before proceeding.

**Locked contract values:**

- **Phase names** (the `ctx.phase` values that reach `playerView`):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

- **UIAudience variants used in this packet:**
  `{ kind: 'player'; playerId: string }`, `{ kind: 'spectator' }`

- **UIBuildContext shape** (from WP-028, do not widen):
  `{ phase: string | null; turn: number; currentPlayer: string }`

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic
reproduction and state inspection.

- `playerView` is a pure function of `(G, ctx, playerID)` — given identical
  inputs, the output is byte-identical
- Failure modes are localizable by inspecting the inputs and comparing
  against the `buildUIState` / `filterUIStateForAudience` outputs directly
- No state mutation occurs — both `G` and `ctx` are read-only inputs
- No entries are appended to `G.messages` by `playerView` — projection is a
  read-only operation
- Tests must cover: seated player → own view, other seated player → filtered
  view, `playerID === null` → spectator view, `playerID === undefined` →
  spectator view

---

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness), §4 (Faithful
Multiplayer Experience).

**Conflict assertion:** No conflict. This packet preserves §3 and §4:

- §3 — `playerView` is pure and deterministic; the same `(G, ctx, playerID)`
  triple always produces the same projection. No hidden modifiers, no
  opaque filtering beyond what WP-029 already locked.
- §4 — This packet is a prerequisite for reliable multiplayer: without
  `playerView`, every client would receive raw `G`, which contains
  other players' hidden zones. Wiring `filterUIStateForAudience` at the
  boardgame.io projection boundary is the mechanism by which
  per-seat information hiding becomes authoritative.

**Non-Goal proximity check:** None of NG-1..7 are crossed. This packet
adds no monetization surface, no paid tier, no persuasive UI. It is a
server-side projection wiring only.

**Determinism preservation:** `playerView` performs no RNG, no wall-clock
read, and no I/O. `buildUIState` and `filterUIStateForAudience` are both
already pure (locked by WP-028 / WP-029). Replay faithfulness (Vision §22)
is unaffected — replays execute against the server's `G`, never the
client projection.

---

## Scope (In)

### A) playerView wiring in LegendaryGame

- **`packages/game-engine/src/game.ts`** — modified:
  - Import `buildUIState` from `./ui/uiState.build.js`
  - Import `filterUIStateForAudience` from `./ui/uiState.filter.js`
  - Import `UIState` from `./ui/uiState.types.js` (type-only)
  - Import `UIAudience` from `./ui/uiState.filter.js` (type-only) if it is
    exported there; otherwise construct the audience literal inline at the
    `playerView` call site
  - Add a new top-level function `buildPlayerView(G, ctx, playerID)` in
    the same file, below `advanceStage`:
    - Signature: `(gameState: LegendaryGameState, ctx: Ctx, playerID: PlayerID | null | undefined) => UIState`
    - Body:
      1. Build the `UIBuildContext` from `ctx.phase`, `ctx.turn`,
         `ctx.currentPlayer`
      2. Call `buildUIState(gameState, uiBuildContext)` → `fullUIState`
      3. Derive audience: if `typeof playerID === 'string'`, audience is
         `{ kind: 'player', playerId: playerID }`; otherwise
         `{ kind: 'spectator' }`
      4. Call `filterUIStateForAudience(fullUIState, audience)` and return it
    - JSDoc must document the pure-function contract, the `null`/`undefined`
      playerID handling, and the fact that `playerView` runs on every state
      push (so it must stay cheap)
    - `// why:` comment explaining why `null` and `undefined` both map to
      spectator (boardgame.io represents unauthenticated/unseated clients
      as either, depending on transport path)
  - Add `playerView: buildPlayerView` to the `LegendaryGame` object
    literal, immediately after `name` / `minPlayers` / `maxPlayers` and
    before `validateSetupData`
  - Add `// why:` comment on the `playerView` field explaining that this
    is the sole engine→client projection boundary and that clients never
    observe raw `LegendaryGameState`

### B) Tests

Add `node:test` tests in `packages/game-engine/src/game.playerView.test.ts`:

- Prefer testing via `LegendaryGame.playerView` directly.
  `buildPlayerView` **should remain un-exported** unless exporting it
  materially improves test clarity without violating the
  single-`LegendaryGame` invariant.
- Test that calling `LegendaryGame.playerView!(gameState, ctxLike, 'P1')`
  returns a `UIState` that is deep-equal to
  `filterUIStateForAudience(buildUIState(gameState, uiBuildContext), { kind: 'player', playerId: 'P1' })`
  (validate delegation correctness; zone-shape semantics are owned by
  WP-028 / WP-029 and must not be re-asserted here)
- Test that calling with `playerID === null` returns the spectator
  projection (all players filtered per spectator rules)
- Test that calling with `playerID === undefined` returns the spectator
  projection (identical to `null`)
- Test that calling `playerView` twice with the same inputs returns
  deep-equal results (determinism)
- Test that `playerView` does not mutate its `gameState` argument
  (compare `JSON.stringify(gameState)` before and after)
- Test that `playerView` does not mutate its `ctx` argument
- Does not import from `boardgame.io` or `boardgame.io/testing`
- Uses `makeMockCtx` from `packages/game-engine/src/test/mockCtx.ts` for
  constructing the `ctx`-like fixture
- Constructs `gameState` via the existing setup helpers used in other
  `game.*.test.ts` files — do not author a new fixture factory

---

## Out of Scope

- No client-side consumption of the new projection — that is WP-090
- No change to `apps/server/**` — the server wiring `Server({ games: [LegendaryGame] })`
  inherits the new `playerView` automatically
- No change to `buildUIState` or `filterUIStateForAudience` — both are
  locked contracts from WP-028 / WP-029
- No new audience variants — `{ kind: 'player' }` and `{ kind: 'spectator' }`
  are the only audiences wired. Owner/observer/coach variants are out of scope.
- No boardgame.io `PlayerView.STRIP_SECRETS` — we do not fall back to the
  library-provided filter, because `filterUIStateForAudience` already encodes
  the project's audience rules
- No refactor of the `LegendaryGame` object layout — add `playerView` and
  stop
- No database, network, or filesystem access in `buildPlayerView` or the
  test file
- No new code category under `packages/game-engine/src/` — `playerView`
  lives in the existing `game.ts` file, which is classified as engine code

---

## Files Expected to Change

- `packages/game-engine/src/game.ts` — **modified** — add `buildPlayerView`
  function and wire `playerView: buildPlayerView` into the `LegendaryGame`
  object
- `packages/game-engine/src/game.playerView.test.ts` — **new** — `node:test`
  coverage for the new projection wiring

No other files may be modified.

---

## Acceptance Criteria

### PlayerView wiring
- [ ] `packages/game-engine/src/game.ts` exports `LegendaryGame` with a
      `playerView` field of type `(G, ctx, playerID) => UIState`
- [ ] `buildPlayerView` is defined as a named function in `game.ts`
      (not an inline arrow) and carries a JSDoc block documenting the pure
      contract and `null`/`undefined` handling
- [ ] Calling `LegendaryGame.playerView!(gameState, ctxLike, 'P1')` returns
      an object deep-equal to
      `filterUIStateForAudience(buildUIState(gameState, uiBuildContext), { kind: 'player', playerId: 'P1' })`
- [ ] Calling with `playerID === null` returns the spectator-filtered `UIState`
- [ ] Calling with `playerID === undefined` returns the spectator-filtered `UIState`
- [ ] `JSON.stringify(gameState)` is identical before and after every
      `playerView` invocation (no input mutation)
- [ ] No `throw` statement in `buildPlayerView` (confirmed with `Select-String`)
- [ ] No import from `@legendary-arena/registry` in `game.ts`
      (confirmed with `Select-String`)
- [ ] No import from `apps/server/` in `game.ts` (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] `game.playerView.test.ts` contains at least 6 tests covering the
      scenarios listed in Scope (In) §B
- [ ] Test file does not import from `boardgame.io`
- [ ] Test file uses `node:test` and `node:assert` only
- [ ] Test file uses `makeMockCtx` from `src/test/mockCtx.ts`

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no throw in the new projection function
Select-String -Path "packages\game-engine\src\game.ts" -Pattern "throw " -SimpleMatch
# Expected: no matches inside buildPlayerView (setup() throws are pre-existing and expected)

# Step 4 — confirm no forbidden imports in game.ts
Select-String -Path "packages\game-engine\src\game.ts" -Pattern "@legendary-arena/registry"
# Expected: no output
Select-String -Path "packages\game-engine\src\game.ts" -Pattern "apps/server"
# Expected: no output

# Step 5 — confirm no Math.random in engine src
Select-String -Path "packages\game-engine\src" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 6 — confirm playerView is wired on LegendaryGame
Select-String -Path "packages\game-engine\src\game.ts" -Pattern "playerView: buildPlayerView"
# Expected: exactly one match

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only packages/game-engine/src/game.ts and
# packages/game-engine/src/game.playerView.test.ts (plus doc updates from DoD)
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] No `throw` in `buildPlayerView` (confirmed with `Select-String`)
- [ ] No `Math.random` in any new or modified file (confirmed with `Select-String`)
- [ ] No `@legendary-arena/registry` or `apps/server/` import in `game.ts`
      (confirmed with `Select-String`)
- [ ] WP-028 outputs (`uiState.build.ts`, `uiState.types.ts`) were not
      modified (confirmed with `git diff`)
- [ ] WP-029 outputs (`uiState.filter.ts`) were not modified
      (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — notes that clients now receive
      audience-filtered `UIState` via boardgame.io's `playerView`, not
      raw `LegendaryGameState`
- [ ] `docs/ai/DECISIONS.md` updated — at minimum a `D-89xx` entry stating
      that `playerView` reshapes the client-visible state to `UIState`
      (not a `LegendaryGameState` subset), and the rationale (audience
      filtering is the project's authority, not boardgame.io's built-in
      `STRIP_SECRETS`)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-089 checked off with
      today's date

**Canonical DECISIONS.md language (may be copy-pasted):**

> **D-08901 — Engine-Level `playerView` Projection**
>
> The engine registers a `playerView` function on `LegendaryGame` that
> reshapes the client-visible state from `LegendaryGameState` to `UIState`.
> Audience filtering is performed exclusively via
> `filterUIStateForAudience`; boardgame.io's built-in secret stripping
> (`PlayerView.STRIP_SECRETS`) is not used. This establishes `UIState` as
> the sole authoritative projection contract from engine to client.

**Canonical STATUS.md line (may be copy-pasted):**

> ⚙️ **WP-089 complete** — Clients now receive audience-filtered `UIState`
> projections via boardgame.io `playerView`; raw `LegendaryGameState` is
> never transmitted.
