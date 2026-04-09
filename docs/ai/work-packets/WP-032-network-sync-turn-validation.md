# WP-032 — Network Sync & Turn Validation

**Status:** Ready  
**Primary Layer:** Multiplayer Safety / Network Boundary / Authority  
**Dependencies:** WP-031

---

## Session Context

WP-031 introduced engine invariant checks with fail-fast behavior. WP-027
proved deterministic replay. WP-028/029 established the UI state contract
and audience-filtered views. This packet defines how clients communicate with
the engine in a multiplayer context — the authoritative turn model. Clients
submit intentions (`ClientTurnIntent`); the engine validates and executes.
Invalid or out-of-order actions are rejected deterministically. This
implements D-0401 (Clients Submit Intents, Not Outcomes) and D-0402
(Engine-Authoritative Resync). boardgame.io already provides the transport
layer — this packet defines the contract and validation on top of it.

---

## Goal

Define a network-safe, authoritative turn model for multiplayer play. After
this session:

- `ClientTurnIntent` is the canonical format for all client move submissions
  — matchId, playerId, turnNumber, and the move name + args
- Engine-side validation rejects invalid intents before move execution:
  wrong player, wrong turn, invalid move name, malformed args
- Intent validation is deterministic and produces structured rejection reasons
- Desync detection compares client-reported state hash against engine state
  hash — on mismatch, the engine state is authoritative (D-0402)
- The contract is transport-agnostic — it works with boardgame.io's existing
  networking or any future transport
- All validation is engine-side; clients never execute game logic

---

## Assumes

- WP-031 complete. Specifically:
  - `packages/game-engine/src/invariants/assertInvariant.ts` exists (WP-031)
  - `packages/game-engine/src/replay/replay.hash.ts` exports
    `computeStateHash` (WP-027)
  - `packages/game-engine/src/ui/uiState.types.ts` exports `UIState` (WP-028)
  - `packages/game-engine/src/moves/coreMoves.gating.ts` exports
    `MOVE_ALLOWED_STAGES`, `isMoveAllowedInStage` (WP-008A)
  - `packages/game-engine/src/state/zones.types.ts` exports `CardExtId` (WP-006A)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- boardgame.io handles transport (WebSocket/polling) — this packet defines
  the intent contract on top of it
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0401, D-0402

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Moves &
  Determinism". All moves validate -> gate -> mutate -> return void. Intent
  validation is a pre-filter before the move function is called.
- `docs/ai/ARCHITECTURE.md §Section 4` — read "How Moves Work". boardgame.io
  validates player turn order. This packet adds intent-level validation
  (turn number, move name, args shape) on top of boardgame.io's built-in
  checks.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — intent
  validation is game-engine layer logic. The server layer wires the transport;
  the engine validates the intent. The server never interprets or validates
  game logic.
- `docs/ai/DECISIONS.md` — read D-0401 (Clients Submit Intents, Not Outcomes)
  and D-0402 (Engine-Authoritative Resync). These govern this packet.
- `docs/ai/DECISIONS.md` — read D-0101 (Engine Is the Sole Authority). The
  engine validates all intents; clients cannot bypass validation.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `intentValidation` not `iv`), Rule 6 (`// why:` on engine authority and
  resync), Rule 8 (no `.reduce()`), Rule 11 (full-sentence rejection messages),
  Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — validation involves no randomness
- Never throw in validation — return structured rejection results
- `G` must not be mutated by validation — intents are validated before moves
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access in validation logic
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- `ClientTurnIntent` is **data-only** — JSON-serializable, no functions
- Intent validation is **engine-side only** — clients never validate their
  own intents
- Validation produces **structured rejection results** (not thrown errors) —
  the caller decides how to handle rejections
- Desync detection uses `computeStateHash` from WP-027 — if client-reported
  hash differs from engine hash, the engine state wins (D-0402)
- The contract is **transport-agnostic** — it does not depend on WebSocket,
  HTTP, or any specific boardgame.io transport
- No `.reduce()` in validation logic — use `for...of`
- No modifications to boardgame.io's internal transport or Server() — this
  packet adds a validation layer on top
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **ClientTurnIntent shape:**
  ```ts
  interface ClientTurnIntent {
    matchId: string
    playerId: string
    turnNumber: number
    move: {
      name: string
      args: unknown
    }
    clientStateHash?: string  // optional — for desync detection
  }
  ```

- **IntentValidationResult shape:**
  ```ts
  type IntentValidationResult =
    | { valid: true }
    | { valid: false; reason: string; code: string }
  ```

---

## Scope (In)

### A) `src/network/intent.types.ts` — new

- `interface ClientTurnIntent` — canonical move submission format as specified
  in locked contract values
- `type IntentValidationResult` — structured validation outcome
- `type IntentRejectionCode = 'WRONG_PLAYER' | 'WRONG_TURN' | 'INVALID_MOVE' | 'MALFORMED_ARGS' | 'DESYNC_DETECTED'`
- `// why:` comment: clients submit intents, engine validates (D-0401);
  transport-agnostic by design

### B) `src/network/intent.validate.ts` — new

- `validateIntent(intent: ClientTurnIntent, G: LegendaryGameState, ctx: Ctx): IntentValidationResult`
  — pure function:
  1. Check `intent.playerId === ctx.currentPlayer` — reject with `WRONG_PLAYER`
  2. Check `intent.turnNumber === ctx.turn` — reject with `WRONG_TURN`
  3. Check `intent.move.name` is a registered move — reject with `INVALID_MOVE`
  4. Check `intent.move.args` is structurally valid for the named move —
     reject with `MALFORMED_ARGS`
  5. If `intent.clientStateHash` is present: compare with
     `computeStateHash(G)` — reject with `DESYNC_DETECTED` if mismatch
  6. Return `{ valid: true }` if all checks pass
  - Never mutates `G` or `ctx`
  - Never throws — always returns structured result
  - Full-sentence `reason` messages (Rule 11)
  - `// why:` comment on each rejection code

### C) `src/network/desync.detect.ts` — new

- `detectDesync(clientHash: string | undefined, G: LegendaryGameState): { desynced: boolean; engineHash: string }`
  — compares client-reported hash with engine state hash
  - Uses `computeStateHash(G)` from WP-027
  - If `clientHash` is undefined: `desynced: false` (hash not provided)
  - If hashes match: `desynced: false`
  - If hashes differ: `desynced: true` — engine state is authoritative
  - `// why:` comment referencing D-0402

- Pure function, no I/O, no mutations

### D) `src/types.ts` — modified

- Re-export intent and desync types

### E) `src/index.ts` — modified

- Export `ClientTurnIntent`, `IntentValidationResult`, `IntentRejectionCode`,
  `validateIntent`, `detectDesync`

### F) Tests — `src/network/intent.validate.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Nine tests:
  1. Valid intent passes validation
  2. Wrong player: rejected with `WRONG_PLAYER`
  3. Wrong turn number: rejected with `WRONG_TURN`
  4. Unregistered move name: rejected with `INVALID_MOVE`
  5. Malformed args: rejected with `MALFORMED_ARGS`
  6. Matching client state hash: passes
  7. Mismatched client state hash: rejected with `DESYNC_DETECTED`
  8. No client hash provided: passes (hash is optional)
  9. Validation does not mutate G (deep equality check)

---

## Out of Scope

- **No transport implementation** — boardgame.io handles WebSocket/polling;
  this packet defines the intent contract only
- **No server modifications** — the server wires transport, it does not
  validate game logic
- **No client-side validation** — validation is engine-side only
- **No reconnection protocol** — future packet
- **No rate limiting or abuse prevention** — server/ops concern
- **No UI changes**
- **No persistence / database access**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/network/intent.types.ts` — **new** —
  ClientTurnIntent, IntentValidationResult, IntentRejectionCode
- `packages/game-engine/src/network/intent.validate.ts` — **new** —
  validateIntent
- `packages/game-engine/src/network/desync.detect.ts` — **new** —
  detectDesync
- `packages/game-engine/src/types.ts` — **modified** — re-export network types
- `packages/game-engine/src/index.ts` — **modified** — export network API
- `packages/game-engine/src/network/intent.validate.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Intent Contract
- [ ] `ClientTurnIntent` is data-only, JSON-serializable
- [ ] Contains: matchId, playerId, turnNumber, move (name + args),
      optional clientStateHash

### Intent Validation
- [ ] Wrong player rejected with `WRONG_PLAYER`
- [ ] Wrong turn rejected with `WRONG_TURN`
- [ ] Invalid move name rejected with `INVALID_MOVE`
- [ ] Malformed args rejected with `MALFORMED_ARGS`
- [ ] All rejections include full-sentence reason
- [ ] Validation never mutates G (deep equality test)
- [ ] Validation never throws — always returns structured result

### Desync Detection
- [ ] Matching hashes: `desynced: false`
- [ ] Mismatching hashes: `desynced: true`
- [ ] No client hash: `desynced: false` (optional)
- [ ] Uses `computeStateHash` from WP-027

### Engine Authority
- [ ] All validation is engine-side — no client-side logic
- [ ] On desync, engine state is authoritative (D-0402)

### Pure Functions
- [ ] All network files have no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in validation logic
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests cover all 5 rejection codes + valid intent + desync
- [ ] All test files use `.test.ts` and `makeMockCtx`
- [ ] No boardgame.io import in test files (confirmed with `Select-String`)

### Scope Enforcement
- [ ] No server files modified
      (confirmed with `git diff --name-only`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding network validation
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in network files
Select-String -Path "packages\game-engine\src\network" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no .reduce() in validation
Select-String -Path "packages\game-engine\src\network" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 5 — confirm no throw in validation
Select-String -Path "packages\game-engine\src\network\intent.validate.ts" -Pattern "throw "
# Expected: no output

# Step 6 — confirm desync uses computeStateHash
Select-String -Path "packages\game-engine\src\network\desync.detect.ts" -Pattern "computeStateHash"
# Expected: at least one match

# Step 7 — confirm no server files modified
git diff --name-only apps/server/
# Expected: no output

# Step 8 — confirm no require()
Select-String -Path "packages\game-engine\src\network" -Pattern "require(" -Recurse
# Expected: no output

# Step 9 — confirm no files outside scope
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
- [ ] No boardgame.io import in network files
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in validation (confirmed with `Select-String`)
- [ ] No throw in validation (confirmed with `Select-String`)
- [ ] Desync uses `computeStateHash` (confirmed with `Select-String`)
- [ ] No server files modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — intent validation exists; desync detection
      implemented; D-0401 and D-0402 implemented; multiplayer-ready
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why intent validation is
      engine-side not server-side; why desync favors engine state (D-0402);
      relationship between intent validation and boardgame.io's built-in
      turn order checks
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-032 checked off with today's date
