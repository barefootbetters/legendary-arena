# Session Execution Prompt — WP-032 (Implementation)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute. Do not execute in the session that generated
> this prompt.

---

## Session Identity

**Work Packet:** WP-032 — Network Sync & Turn Validation
**Mode:** Implementation (WP-032 not yet implemented)
**Pre-Flight:** Complete (2026-04-15) — build green (358 tests, 94 suites,
0 fail), all dependencies met. PS-1 resolved: D-3201 created classifying
`src/network/` as engine code category. PS-2 resolved: WP-032 back-synced
with pre-flight-locked `validateIntent` signature.
**Copilot Check:** CONFIRM (2026-04-15) — 28/30 clean PASS, 2 scope-neutral
fixes applied (EC-032 signature update, 02-CODE-CATEGORIES.md directory
list).
**EC:** `docs/ai/execution-checklists/EC-032-network-sync.checklist.md`
**Pre-flight:** `docs/ai/invocations/preflight-wp032-network-sync.md`
**Copilot check:** `docs/ai/invocations/copilot-wp032-network-sync.md`

**Success Condition (Binary):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- Test count: 358 -> **367** (9 new intent validation tests, 0 existing
  test changes)
- Suite count: 94 -> **95** (1 new `describe` block)
- All WP-032 acceptance criteria satisfied
- Any deviation: **STOP and report failure**

---

## Runtime Wiring Allowance — NOT INVOKED

**`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` is NOT invoked by
this session prompt.**

Pre-flight verified WP-032 is **purely additive**:

- No new fields on `LegendaryGameState` — ABSENT
- No changes to `buildInitialGameState` return shape — ABSENT
- No new moves in `LegendaryGame.moves` — ABSENT
- No new phases or phase hooks — ABSENT

Per 01.5 section "When to Include": *"If a WP is purely additive (new files
only, no type or shape changes), this clause does not apply."*

**Consequence:** the 01.5 allowance **may not be cited** during execution
or pre-commit review to justify edits outside the Scope Lock below. If
execution discovers an unanticipated structural break in an existing
test, **STOP and escalate** — do not force-fit the change. Per 01.5
section on Escalation: *"It may not be cited retroactively in execution
summaries or pre-commit reviews to justify undeclared changes."*

---

## Mandatory Read Order (Do Not Skip)

Read these **in order, fully**, before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` — specifically:
   - "Layer Boundary (Authoritative)" — intent validation is game-engine
     layer logic. The server wires transport; the engine validates intents.
   - "Architectural Principles" — #1 Determinism, #2 Engine Owns Truth
   - §Section 4 "How Moves Work" — boardgame.io validates player turn
     order. This packet adds intent-level validation on top.
3. `docs/ai/execution-checklists/EC-032-network-sync.checklist.md`
4. `docs/ai/work-packets/WP-032-network-sync-turn-validation.md`
5. `docs/ai/invocations/preflight-wp032-network-sync.md` — read the
   §Risk & Ambiguity Review (RS-1 through RS-6 are locked for execution)
6. `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
   6 (`// why:` comments), 8 (no `.reduce()`), 11 (full-sentence error
   messages), 13 (ESM only)
7. `docs/ai/DECISIONS.md` — read D-0401 (Clients Submit Intents, Not
   Outcomes), D-0402 (Engine-Authoritative Resync), D-3201 (Network
   Directory Classified as Engine Code Category). Note: DECISIONS.md uses
   em-dashes in headings (e.g., `D‑0401`); grep by title keyword if the
   ID search misses.

**Implementation anchors (read before coding):**

8. `packages/game-engine/src/replay/replay.hash.ts` — read
   `computeStateHash(gameState: LegendaryGameState): string` signature.
   This is the only dependency function called by WP-032.
9. `packages/game-engine/src/moves/coreMoves.types.ts` — read
   `CoreMoveName` and `CORE_MOVE_NAMES`. Note: `CORE_MOVE_NAMES` has only
   3 of 10 registered moves — WP-032 does NOT use this for validation.
   See §Pre-Flight Locked Decisions #2.
10. `packages/game-engine/src/types.ts` — read the re-export section.
    Network types will be re-exported after the existing re-export blocks.
11. `packages/game-engine/src/index.ts` — read current exports. Network
    exports will be added at the end of the file.
12. `packages/game-engine/src/test/mockCtx.ts` — read `makeMockCtx`
    signature and return shape. Tests need `currentPlayer` and `turn`
    from the returned context.

---

## Pre-Flight Locked Decisions (Do Not Revisit)

These decisions were resolved during pre-flight and are locked for
execution. Do **not** revisit them or propose alternatives.

### 1. Local structural interface for ctx (RS-1)

`validateIntent` must NOT import `boardgame.io`. Define a local structural
interface in `intent.types.ts`:

```ts
/**
 * Local structural interface for the boardgame.io ctx fields needed by
 * intent validation. Avoids importing boardgame.io into engine-category
 * network files.
 *
 * // why: network files are engine category (D-3201) and must not import
 * boardgame.io (WP-028 precedent, D-2801). Only the fields actually read
 * by validateIntent are included — readonly to prevent accidental mutation.
 */
export interface IntentValidationContext {
  readonly currentPlayer: string;
  readonly turn: number;
}
```

Tests supply a plain object literal matching this interface — NOT
`makeMockCtx` for the context parameter.

**Correction:** Tests use `makeMockCtx` to build a valid `G` with
`SetupContext`. The `IntentValidationContext` parameter is a separate
plain object. Both are needed:
- `makeMockCtx()` produces `{ G, ctx }` for the `gameState` parameter
- `{ currentPlayer: '0', turn: 1 }` is the `context` parameter

### 2. Caller-injected valid move names (RS-2)

`validateIntent` accepts `validMoveNames: readonly string[]`. The caller
provides the list of valid move names for the current context. This is
transport-agnostic — the validator does not import `game.ts` or
boardgame.io to discover which moves are registered.

For tests, provide the array explicitly:

```ts
const testValidMoves = [
  'drawCards', 'playCard', 'endTurn', 'advanceStage',
  'revealVillainCard', 'fightVillain', 'recruitHero', 'fightMastermind',
] as const;
```

Step 3 of `validateIntent` checks `validMoveNames.includes(intent.move.name)`.
If the move name is not in the list, reject with `INVALID_MOVE`.

### 3. MVP-scoped MALFORMED_ARGS (RS-3)

Step 4 of `validateIntent` performs **structural validation only**:

- Reject if `intent.move.args` is a function (`typeof args === 'function'`)
- Reject if `intent.move.args` fails JSON serialization round-trip
  (optional — may use a simpler check like `typeof` guard)

Per-move schema validation (checking that `drawCards` args has a numeric
`count`, etc.) is **deferred** to move execution. The existing validators
in `coreMoves.validate.ts` handle per-move args checking when the move
actually runs.

The `reason` message must be a full sentence per Rule 11: e.g.,
`"The move args contain a non-serializable value (function)."`

### 4. Signature precision (RS-4)

The pre-flight-locked `validateIntent` signature is:

```ts
export function validateIntent(
  intent: ClientTurnIntent,
  gameState: LegendaryGameState,
  context: IntentValidationContext,
  validMoveNames: readonly string[],
): IntentValidationResult
```

Use parameter names `gameState` (not `G`), `context` (not `ctx`).
`G` and `ctx` are boardgame.io-specific names per `.claude/rules/code-style.md`
naming rules — use them only inside boardgame.io move functions.

### 5. Verification grep patterns (RS-5)

EC-032 verification steps use PowerShell `Select-String`. Use bash
equivalents during execution:

```bash
# No boardgame.io imports (import-line-specific, not bare string)
grep -r "from.*boardgame" packages/game-engine/src/network/
# Expected: no output

# No .reduce()
grep -r "\.reduce(" packages/game-engine/src/network/
# Expected: no output

# No throw in validation
grep "throw " packages/game-engine/src/network/intent.validate.ts
# Expected: no output

# Desync uses computeStateHash
grep "computeStateHash" packages/game-engine/src/network/desync.detect.ts
# Expected: at least one match

# No require()
grep -r "require(" packages/game-engine/src/network/
# Expected: no output
```

### 6. Separate desync file (RS-6)

`detectDesync` lives in its own file `desync.detect.ts` as specified by
the WP and EC. Do not inline it into `intent.validate.ts`.

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any network file or network
  test file
- Any `import ... from '@legendary-arena/registry'` in any network file
- Any `.reduce()` in network logic or tests
- Any `Math.random()` in any new file
- Any `require()` in any file
- Any `throw` in `intent.validate.ts` or `desync.detect.ts`
- Any IO, network, filesystem, or environment access
- Any mutation of `gameState` in `validateIntent` or `detectDesync`
- Any modification to `game.ts`, any file under `src/moves/`, any file
  under `src/rules/`, any file under `src/setup/`, or any file under
  `apps/server/`
- Any new field added to `LegendaryGameState`
- Any new phase, stage, move, trigger name, effect type, or G counter
- Any modification to `makeMockCtx` or other shared test helpers
- Any files modified outside the allowlist (see Scope Lock)
- Any wiring of network functions into `game.ts`, moves, or phase hooks
- Expanding scope beyond WP-032 (no "while I'm here" improvements)

---

## AI Agent Warning (Strict)

Network validation code is **pure, transport-agnostic intent validation**.
It does NOT participate in the boardgame.io lifecycle. The server does not
call these functions at MVP — they define the **contract** for future
server-side wiring.

**Lifecycle prohibition:** `validateIntent` and `detectDesync` are NOT
part of the boardgame.io lifecycle. They MUST NOT be called from:
- `game.ts`
- any move function
- any phase hook (`onBegin`, `onEnd`, `endIf`)
- any setup-time builder under `src/setup/`

They are consumed exclusively by:
- the 9 tests in this WP
- future server-layer code (not in this WP)

**Do NOT:**
- Import `boardgame.io` in any network file
- Import `@legendary-arena/registry` in any network file
- Mutate any input object — always return new result objects
- Add `ClientTurnIntent` or any network type to `LegendaryGameState`
- Wire network validation into the boardgame.io lifecycle
- Invent new rejection codes beyond the 5 locked in EC-032
- Add per-move args schema validation (deferred to move execution)

**Instead:**
- Accept input objects, return new result objects
- Use `for...of` for any iteration
- Use `// why:` comments on the required points (see §Required `// why:`
  Comments below)
- Return structured `IntentValidationResult` — never throw

---

## Scope Lock (Authoritative)

### Allowed Files

| File | Action | Contents |
|---|---|---|
| `packages/game-engine/src/network/intent.types.ts` | CREATE | `ClientTurnIntent`, `IntentValidationResult`, `IntentRejectionCode`, `IntentValidationContext` |
| `packages/game-engine/src/network/intent.validate.ts` | CREATE | `validateIntent` |
| `packages/game-engine/src/network/desync.detect.ts` | CREATE | `detectDesync` |
| `packages/game-engine/src/network/intent.validate.test.ts` | CREATE | 9 tests in 1 `describe` block |
| `packages/game-engine/src/types.ts` | MODIFY | Additive re-exports of network types |
| `packages/game-engine/src/index.ts` | MODIFY | Additive exports of network API |

### Forbidden

- Any file not in the table above
- Any file under `apps/server/`
- Any existing test file

**Rule:** Anything not explicitly allowed is out of scope.

---

## Required `// why:` Comments

The following `// why:` comments are required by EC-032 and must appear in
the implementation:

1. **`intent.types.ts` — `ClientTurnIntent`:** clients submit intents,
   engine validates (D-0401); transport-agnostic
2. **`intent.types.ts` — `IntentValidationContext`:** network files are
   engine category (D-3201) and must not import boardgame.io (D-2801)
3. **`intent.validate.ts` — each rejection code:** what condition it catches
   (5 comments total, one per code)
4. **`intent.validate.ts` — relationship to boardgame.io:** this packet
   adds intent-level validation on top of boardgame.io's built-in turn
   order checks
5. **`desync.detect.ts` — `detectDesync`:** engine-authoritative resync
   (D-0402)

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/network/intent.types.ts` (new)

**No boardgame.io imports. No registry imports. No runtime imports.**

**Type definitions (data-only, JSON-serializable):**

```ts
/**
 * Network intent contracts for the Legendary Arena multiplayer layer.
 *
 * These types define the canonical format for client move submissions
 * and the structured validation results returned by the engine.
 * Transport-agnostic — works with boardgame.io's existing networking
 * or any future transport.
 *
 * // why: clients submit intents, engine validates (D-0401).
 * Transport-agnostic by design — no WebSocket, HTTP, or framework
 * dependency in this file.
 */

// why: network files are engine category (D-3201) and must not import
// boardgame.io (D-2801). Only the fields actually read by
// validateIntent are included — readonly to prevent accidental mutation.
/**
 * Local structural interface for the boardgame.io ctx fields needed by
 * intent validation. Avoids importing boardgame.io into engine-category
 * network files.
 */
export interface IntentValidationContext {
  readonly currentPlayer: string;
  readonly turn: number;
}

/**
 * Canonical format for all client move submissions. Data-only,
 * JSON-serializable — no functions, no class instances.
 */
export interface ClientTurnIntent {
  matchId: string;
  playerId: string;
  turnNumber: number;
  move: {
    name: string;
    args: unknown;
  };
  clientStateHash?: string; // optional — for desync detection
}

/**
 * The 5 canonical rejection codes for intent validation.
 */
export type IntentRejectionCode =
  | 'WRONG_PLAYER'
  | 'WRONG_TURN'
  | 'INVALID_MOVE'
  | 'MALFORMED_ARGS'
  | 'DESYNC_DETECTED';

/**
 * Structured validation outcome. Validation never throws — it always
 * returns one of these two shapes.
 */
export type IntentValidationResult =
  | { valid: true }
  | { valid: false; reason: string; code: IntentRejectionCode };
```

**Notes:**
- `IntentValidationResult` uses `code: IntentRejectionCode` (not
  `code: string`). The EC locked shape says `code: string` which is a
  supertype — using the named union is stricter and correct per the
  WP-030 named-union precedent.
- `clientStateHash` is optional per the locked contract.
- No `INTENT_REJECTION_CODES` canonical array is required at this time.
  The union type is sufficient for 5 members. If the set grows, a
  canonical array + drift test can be added by a future WP.

---

### B) Create `packages/game-engine/src/network/intent.validate.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`.
Imports from engine types via relative path only.**

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import type {
  ClientTurnIntent,
  IntentValidationContext,
  IntentValidationResult,
} from './intent.types.js';
import { detectDesync } from './desync.detect.js';
```

**Function:**

```ts
/**
 * Validates a client turn intent against the current engine state.
 * Pure function — never mutates gameState or context, never throws.
 *
 * Validation order:
 *   1. Wrong player -> WRONG_PLAYER
 *   2. Wrong turn   -> WRONG_TURN
 *   3. Invalid move -> INVALID_MOVE
 *   4. Malformed args -> MALFORMED_ARGS
 *   5. Desync detected -> DESYNC_DETECTED
 *   6. All checks pass -> { valid: true }
 *
 * // why: this adds intent-level validation on top of boardgame.io's
 * built-in turn order checks. boardgame.io validates player turn order
 * at the framework level; this function validates the intent structure,
 * move name, and desync status before the move reaches the framework.
 *
 * @param intent - The client's submitted turn intent.
 * @param gameState - The current authoritative game state. Not mutated.
 * @param context - Ctx subset (currentPlayer, turn). Not mutated.
 * @param validMoveNames - Caller-injected list of valid move names.
 * @returns Structured validation result — never throws.
 */
export function validateIntent(
  intent: ClientTurnIntent,
  gameState: LegendaryGameState,
  context: IntentValidationContext,
  validMoveNames: readonly string[],
): IntentValidationResult
```

**Implementation steps (sequential, short-circuit on first failure):**

1. **WRONG_PLAYER:** `intent.playerId !== context.currentPlayer`
   ```ts
   // why: only the current player may submit intents (D-0401)
   ```
   Reason: `"Intent submitted by player '${intent.playerId}' but the current player is '${context.currentPlayer}'."`

2. **WRONG_TURN:** `intent.turnNumber !== context.turn`
   ```ts
   // why: turn number mismatch indicates a stale or replayed intent
   ```
   Reason: `"Intent specifies turn ${intent.turnNumber} but the engine is on turn ${context.turn}."`

3. **INVALID_MOVE:** `!validMoveNames.includes(intent.move.name)`
   ```ts
   // why: validates against the caller-injected move list, not
   // CORE_MOVE_NAMES (which contains only 3 of 10 registered moves)
   ```
   Reason: `"Move '${intent.move.name}' is not a registered move name."`

4. **MALFORMED_ARGS:** structural validation only
   ```ts
   // why: MVP structural check — per-move schema validation is deferred
   // to move execution (coreMoves.validate.ts handles per-move args)
   ```
   Check: `typeof intent.move.args === 'function'` -> reject.
   Reason: `"The move args contain a non-serializable value (function)."`

5. **DESYNC_DETECTED:** call `detectDesync(intent.clientStateHash, gameState)`
   ```ts
   // why: if client and engine state diverge, the engine is
   // authoritative and the client must resync (D-0402)
   ```
   If `desyncResult.desynced` is true, reject.
   Reason: `"Client state hash does not match engine state hash — engine state is authoritative (D-0402)."`

6. Return `{ valid: true }`.

---

### C) Create `packages/game-engine/src/network/desync.detect.ts` (new)

**No boardgame.io imports. No registry imports.**

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import { computeStateHash } from '../replay/replay.hash.js';
```

**Function:**

```ts
/**
 * Compares a client-reported state hash against the engine's
 * authoritative state hash.
 *
 * // why: engine-authoritative resync (D-0402). If the client's view
 * of game state has diverged from the engine's truth, the engine wins.
 * The client must discard its local state and resync from the engine.
 *
 * @param clientHash - The hash reported by the client, or undefined if
 *   the client did not provide one.
 * @param gameState - The authoritative engine game state.
 * @returns { desynced, engineHash } — desynced is false when clientHash
 *   is undefined (client opted out of hash reporting).
 */
export function detectDesync(
  clientHash: string | undefined,
  gameState: LegendaryGameState,
): { desynced: boolean; engineHash: string }
```

**Implementation:**

```ts
const engineHash = computeStateHash(gameState);

if (clientHash === undefined) {
  return { desynced: false, engineHash };
}

return {
  desynced: clientHash !== engineHash,
  engineHash,
};
```

Pure function, no I/O, no mutations, no branching complexity.

---

### D) Modify `packages/game-engine/src/types.ts` — additive re-exports

Add a re-export block after the existing re-export sections:

```ts
// why: network intent contracts are engine-category types (D-3201)
// consumed by the server layer for transport wiring.
export type {
  ClientTurnIntent,
  IntentValidationResult,
  IntentRejectionCode,
  IntentValidationContext,
} from './network/intent.types.js';
```

**Do not** modify any existing lines. Additive only.

---

### E) Modify `packages/game-engine/src/index.ts` — additive exports

Add an export block after the existing export sections:

```ts
// Network intent validation (WP-032)
export type {
  ClientTurnIntent,
  IntentValidationResult,
  IntentRejectionCode,
  IntentValidationContext,
} from './network/intent.types.js';
export { validateIntent } from './network/intent.validate.js';
export { detectDesync } from './network/desync.detect.js';
```

**Do not** modify any existing lines. Additive only.

---

### F) Create `packages/game-engine/src/network/intent.validate.test.ts` (new)

**Uses `node:test` and `node:assert` only. Uses `makeMockCtx` for building
valid game state. No boardgame.io imports.**

**Imports:**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeMockCtx } from '../test/mockCtx.js';
import { validateIntent } from './intent.validate.js';
import type {
  ClientTurnIntent,
  IntentValidationContext,
  IntentValidationResult,
} from './intent.types.js';
```

**Test structure:** All 9 tests inside one `describe('intent validation (WP-032)')` block (adds +1 suite for 94 -> 95).

**Test fixtures (shared across tests):**

```ts
const testValidMoves = [
  'drawCards', 'playCard', 'endTurn', 'advanceStage',
  'revealVillainCard', 'fightVillain', 'recruitHero', 'fightMastermind',
];

// Use makeMockCtx to get a valid G for gameState parameter
// Use a plain object for the IntentValidationContext parameter
```

Build a valid `ClientTurnIntent` fixture that passes all checks, then
derive invalid variants for each rejection test.

**Nine tests:**

1. **Valid intent passes validation**
   - Construct a valid intent with correct player, correct turn, valid
     move name, non-function args, matching (or absent) state hash
   - Assert `result.valid === true`

2. **Wrong player: rejected with WRONG_PLAYER**
   - Set `intent.playerId` to a different value than
     `context.currentPlayer`
   - Assert `result.valid === false` and `result.code === 'WRONG_PLAYER'`
   - Assert `result.reason` is a non-empty string (full sentence)

3. **Wrong turn number: rejected with WRONG_TURN**
   - Set `intent.turnNumber` to a different value than `context.turn`
   - Assert `result.valid === false` and `result.code === 'WRONG_TURN'`

4. **Unregistered move name: rejected with INVALID_MOVE**
   - Set `intent.move.name` to `'nonexistentMove'`
   - Assert `result.valid === false` and `result.code === 'INVALID_MOVE'`

5. **Malformed args: rejected with MALFORMED_ARGS**
   - Set `intent.move.args` to a function (`() => {}`)
   - Assert `result.valid === false` and
     `result.code === 'MALFORMED_ARGS'`

6. **Matching client state hash: passes**
   - Compute the actual hash from the test G using `computeStateHash`
   - Set `intent.clientStateHash` to the computed hash
   - Assert `result.valid === true`

7. **Mismatched client state hash: rejected with DESYNC_DETECTED**
   - Set `intent.clientStateHash` to `'wrong-hash-value'`
   - Assert `result.valid === false` and
     `result.code === 'DESYNC_DETECTED'`

8. **No client hash provided: passes**
   - Omit `clientStateHash` from the intent (undefined)
   - Assert `result.valid === true`

9. **Validation does not mutate G**
   - Deep-copy `G` before calling `validateIntent`
   - Call `validateIntent` with a valid intent
   - Assert `JSON.stringify(G) === JSON.stringify(originalG)` (deep
     equality via serialization)

**Test 6 additional import:**

```ts
import { computeStateHash } from '../replay/replay.hash.js';
```

---

## Verification Steps (Execute After Implementation)

Run **all** of these after implementation is complete. Do not skip any.

```bash
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: 367 tests, 95 suites, 0 fail

# Step 3 — confirm no boardgame.io import in network files
grep -r "from.*boardgame" packages/game-engine/src/network/
# Expected: no output

# Step 4 — confirm no .reduce() in network files
grep -r "\.reduce(" packages/game-engine/src/network/
# Expected: no output

# Step 5 — confirm no throw in validation
grep "throw " packages/game-engine/src/network/intent.validate.ts
# Expected: no output

# Step 6 — confirm desync uses computeStateHash
grep "computeStateHash" packages/game-engine/src/network/desync.detect.ts
# Expected: at least one match

# Step 7 — confirm no server files modified
git diff --name-only apps/server/
# Expected: no output

# Step 8 — confirm no require()
grep -r "require(" packages/game-engine/src/network/
# Expected: no output

# Step 9 — confirm only allowlisted files changed
git diff --name-only
# Expected: only files listed in Scope Lock table
```

---

## Post-Implementation Documentation

After all verification steps pass, update the following governance docs:

### `docs/ai/DECISIONS.md`

Add entries for:
1. Intent validation is engine-side, not server-side — rationale: engine
   owns truth (D-0101), validation must be transport-agnostic, server is a
   wiring layer only
2. Desync detection favors engine state (D-0402) — already exists, confirm
   it is referenced
3. Relationship between intent validation and boardgame.io's built-in turn
   order checks — this is additive validation, not a replacement

### `docs/ai/STATUS.md`

Update to reflect:
- Intent validation exists (`validateIntent`)
- Desync detection implemented (`detectDesync`)
- D-0401 and D-0402 implemented at contract level
- Multiplayer intent contract ready for server-layer wiring

### `docs/ai/work-packets/WORK_INDEX.md`

Check off WP-032 with today's date.

---

## Test Intent Statement

The 9 tests in `intent.validate.test.ts` are **contract enforcement tests**.
They are not illustrative — they enforce the intent validation contract.
If a test fails, the implementation is incorrect. Do NOT weaken assertions
to make tests pass. Each test verifies one specific rejection code or
validation behavior. Together they prove:

- All 5 rejection codes are correctly triggered by their conditions
- Valid intents pass through all checks
- Desync detection with matching, mismatching, and absent hashes works
- Validation is non-mutating (purity invariant)

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All 9 verification steps above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
  (367 tests, 95 suites, 0 fail)
- [ ] All WP-032 acceptance criteria satisfied
- [ ] All EC-032 checklist items satisfied
- [ ] No boardgame.io import in network files
- [ ] No `.reduce()` in validation
- [ ] No `throw` in validation
- [ ] Desync uses `computeStateHash`
- [ ] No server files modified
- [ ] No `require()` in any generated file
- [ ] No files outside Scope Lock modified
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated
- [ ] `docs/ai/work-packets/WORK_INDEX.md` updated
