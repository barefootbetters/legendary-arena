# WP-027 — Determinism & Replay Verification Harness

**Status:** Ready  
**Primary Layer:** Engine Infrastructure / Verification  
**Dependencies:** WP-026

---

## Session Context

WP-005B established deterministic setup with seeded shuffling. WP-009A/B
built deterministic rule execution. WP-014 through WP-026 completed the MVP
gameplay loop — all using `ctx.random.*` exclusively for randomness and pure
helpers for state mutations. This packet introduces a formal verification
harness that **proves** determinism by replaying games from canonical inputs
and asserting identical outputs. It does not change gameplay — it validates it.
This is the first packet in Phase 6 (Verification, UI & Production).

---

## Goal

Introduce a formal determinism and replay verification harness. After this
session:

- `ReplayInput` is a canonical contract defining everything needed to
  reproduce a game: seed, setup config, player order, and ordered moves
- `replayGame(input: ReplayInput)` is a pure function that executes a game
  from a `ReplayInput` and returns the final `G`
- `verifyDeterminism(input: ReplayInput)` runs the same input twice and
  asserts the final states are identical
- A canonical state hash function exists for `G` equality comparison
- Tests prove that identical inputs produce identical outputs across
  multiple runs
- Nondeterministic behavior is detectable and reportable

---

## Assumes

- WP-026 complete. Specifically:
  - All MVP gameplay mechanics are in place (setup, turns, moves, economy,
    fight, recruit, villain reveal, mastermind tactics, hero keywords,
    conditional effects, scheme/mastermind execution, board keywords, scheme
    setup)
  - All randomness flows through `ctx.random.*` exclusively (WP-005B onward)
  - All moves follow the three-step validation contract (WP-008A)
  - `G` is JSON-serializable at all times
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/matchSetup.types.ts` exports `MatchSetupConfig`
    (WP-005A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants" section
  including "Moves & Determinism"
- `docs/ai/DECISIONS.md` exists with D-0002 (Determinism Is Non-Negotiable)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Moves &
  Determinism". All moves return void, never throw, perform no I/O, and all
  randomness flows through `ctx.random.*`. This packet verifies these
  guarantees hold end-to-end.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "Why G Must Never Be Persisted".
  A match can always be reconstructed from setup config and ordered moves.
  The replay harness implements this reconstruction.
- `docs/ai/ARCHITECTURE.md §Section 3` — read "The Three Data Classes".
  `ReplayInput` is Class 2 (Configuration) — it is a deterministic input,
  safe to persist. The replayed `G` is Class 1 (Runtime) — never persisted.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the replay
  harness is game-engine layer only. No server, registry (beyond setup), or UI.
- `docs/ai/DECISIONS.md` — read D-0002 (Determinism Is Non-Negotiable) and
  D-0201 (Replay as a First-Class Feature). This packet implements D-0201.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `replayResult` not `rr`), Rule 6 (`// why:` on canonical hashing approach
  and on replay vs live execution), Rule 8 (no `.reduce()`), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — replay harness uses seeded `ctx.random.*`
- Never throw inside replay execution — capture failures as structured results
- `G` must be JSON-serializable at all times
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in any new file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `ReplayInput` is a **data-only contract** — JSON-serializable, no functions
- `replayGame` is a **pure function** — given identical `ReplayInput`, produces
  identical final `G`. No I/O, no side effects.
- State hashing must be **canonical** — `JSON.stringify` with sorted keys, or
  equivalent deterministic serialization. Document approach in DECISIONS.md.
- `verifyDeterminism` runs the replay **twice** and compares hashes — if they
  differ, the test fails
- The harness does NOT use `boardgame.io/testing` — it constructs a mock
  execution environment using `makeMockCtx` or equivalent
- The harness does NOT modify any gameplay logic — it is observation and
  verification only
- No `.reduce()` in harness logic — use `for...of`
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **ReplayInput shape:**
  ```ts
  interface ReplayInput {
    seed: string
    setupConfig: MatchSetupConfig
    playerOrder: string[]
    moves: ReplayMove[]
  }

  interface ReplayMove {
    playerId: string
    moveName: string
    args: unknown
  }
  ```

---

## Scope (In)

### A) `src/replay/replay.types.ts` — new

- `interface ReplayInput` — canonical replay contract as specified above
- `interface ReplayMove` — individual move record
- `interface ReplayResult { finalState: LegendaryGameState; stateHash: string; moveCount: number }`
- `// why:` comment: `ReplayInput` is everything needed to reconstruct a game
  deterministically; it is Class 2 (Configuration) data, safe to persist

### B) `src/replay/replay.execute.ts` — new

- `replayGame(input: ReplayInput, registry: CardRegistry): ReplayResult`
  — pure function:
  1. Construct initial `G` via `Game.setup()` using `input.setupConfig` and
     `input.seed` (seeded `ctx.random`)
  2. Iterate `input.moves` with `for...of`:
     - For each move, call the corresponding move function with constructed
       `(G, ctx, args)`
  3. Compute `stateHash` of final `G`
  4. Return `{ finalState, stateHash, moveCount }`
  - Registry is provided as a parameter (setup-time only pattern)
  - No I/O, no side effects
  - `// why:` comment on the reconstruction-from-inputs approach

### C) `src/replay/replay.hash.ts` — new

- `computeStateHash(G: LegendaryGameState): string`
  — deterministic hash of the game state:
  - Canonical JSON serialization (sorted keys)
  - Hash via a deterministic algorithm (e.g., simple string hash or
    `JSON.stringify` with key sorting)
  - Same `G` always produces same hash
  - `// why:` comment on canonical serialization approach

### D) `src/replay/replay.verify.ts` — new

- `verifyDeterminism(input: ReplayInput, registry: CardRegistry): { identical: boolean; hash1: string; hash2: string }`
  — runs `replayGame` twice with identical input, compares hashes
  - If hashes match: `identical: true`
  - If hashes differ: `identical: false` — nondeterminism detected
  - Pure function, no I/O

### E) `src/types.ts` — modified

- Re-export `ReplayInput`, `ReplayMove`, `ReplayResult`

### F) `src/index.ts` — modified

- Export `replayGame`, `verifyDeterminism`, `computeStateHash`, `ReplayInput`,
  `ReplayMove`, `ReplayResult`

### G) Tests — `src/replay/replay.verify.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Eight tests:
  1. `replayGame` with valid input produces a `ReplayResult`
  2. `replayGame` with same input twice produces identical `stateHash`
  3. `replayGame` with different seed produces different `stateHash`
  4. `verifyDeterminism` returns `identical: true` for deterministic input
  5. `computeStateHash` is deterministic (same G → same hash)
  6. `computeStateHash` differs for different G states
  7. `ReplayInput` is JSON-serializable (roundtrip test)
  8. `JSON.stringify(replayResult.finalState)` succeeds

---

## Out of Scope

- **No replay UI or viewer** — future packets
- **No replay persistence or storage** — the harness computes replays in
  memory; storage is a future concern
- **No replay streaming or partial replay** — full replay from start to end
- **No performance optimization** — correctness over speed
- **No modification of gameplay logic** — the harness is read-only verification
- **No `boardgame.io/testing` usage** — harness uses `makeMockCtx`
- **No server or UI changes**
- **No persistence / database access**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/replay/replay.types.ts` — **new** — ReplayInput,
  ReplayMove, ReplayResult
- `packages/game-engine/src/replay/replay.execute.ts` — **new** — replayGame
- `packages/game-engine/src/replay/replay.hash.ts` — **new** —
  computeStateHash
- `packages/game-engine/src/replay/replay.verify.ts` — **new** —
  verifyDeterminism
- `packages/game-engine/src/types.ts` — **modified** — re-export replay types
- `packages/game-engine/src/index.ts` — **modified** — export replay API
- `packages/game-engine/src/replay/replay.verify.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Replay Contract
- [ ] `ReplayInput` is data-only, JSON-serializable
- [ ] `ReplayInput` contains: seed, setupConfig, playerOrder, moves
- [ ] `ReplayMove` contains: playerId, moveName, args
- [ ] `ReplayResult` contains: finalState, stateHash, moveCount

### Replay Execution
- [ ] `replayGame` is a pure function — no I/O, no side effects
- [ ] Same `ReplayInput` produces identical `stateHash` on repeated runs
- [ ] Different seed produces different `stateHash`

### State Hashing
- [ ] `computeStateHash` is deterministic (same G → same hash)
- [ ] Canonical serialization used (sorted keys or equivalent)
- [ ] `// why:` comment on hashing approach

### Determinism Verification
- [ ] `verifyDeterminism` returns `identical: true` for deterministic input
- [ ] If nondeterminism were present, `identical: false` would be returned

### Pure Helpers
- [ ] All replay files have no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in replay logic
      (confirmed with `Select-String`)
- [ ] No registry import in verification files (registry passed as parameter
      to replay only)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Determinism test proves identical inputs → identical hashes
- [ ] Different-seed test proves different inputs → different hashes
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] No gameplay logic modified
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding replay harness
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in replay files
Select-String -Path "packages\game-engine\src\replay" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no .reduce() in replay logic
Select-String -Path "packages\game-engine\src\replay" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 5 — confirm no Math.random in replay files
Select-String -Path "packages\game-engine\src\replay" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 6 — confirm ReplayInput is JSON-serializable (test exists)
Select-String -Path "packages\game-engine\src\replay\replay.verify.test.ts" -Pattern "JSON.stringify"
# Expected: at least one match

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\replay" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope
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
- [ ] No boardgame.io import in replay files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in replay logic (confirmed with `Select-String`)
- [ ] No `Math.random` in replay files (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No gameplay logic modified (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — replay verification harness exists;
      determinism is formally provable; D-0201 is implemented
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: canonical state hashing
      approach; why the harness uses `makeMockCtx` not `boardgame.io/testing`;
      relationship between `ReplayInput` and persistence Class 2
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-027 checked off with today's date
