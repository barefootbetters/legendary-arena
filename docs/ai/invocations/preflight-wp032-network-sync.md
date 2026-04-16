# Pre-Flight Invocation — WP-032

**Target Work Packet:** `WP-032`
**Title:** Network Sync & Turn Validation
**Previous WP Status:** WP-031 Complete (2026-04-15, commit eeb9d6c)
**Pre-Flight Date:** 2026-04-15
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only (types/contracts/tests only)

Rationale: WP-032 introduces data-only types (`ClientTurnIntent`,
`IntentValidationResult`, `IntentRejectionCode`), pure validation functions
(`validateIntent`, `detectDesync`), and tests. No `G` mutation, no phase
hooks, no moves added, no `game.ts` modification, no boardgame.io imports.
This is a pure engine-category contract + validator packet.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-032.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and
stop.

---

## Authority Chain (Read)

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline
2. `docs/ai/ARCHITECTURE.md` — Layer boundaries, engine vs framework rules
3. `docs/ai/execution-checklists/EC-032-network-sync.checklist.md`
4. `docs/ai/work-packets/WP-032-network-sync-turn-validation.md`
5. Prior WP artifacts: WP-027 (computeStateHash), WP-031 (invariants)

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-031 | PASS | Complete (2026-04-15, commit eeb9d6c). 358 tests, 94 suites, 0 fail |
| WP-027 | PASS | `computeStateHash` exists and is exported from `replay.hash.ts` |
| WP-028 | PASS | `UIState` exists in `uiState.types.ts` |
| WP-008A | PASS | `isMoveAllowedInStage`, `MOVE_ALLOWED_STAGES` exported from `coreMoves.gating.ts` |

All prerequisites complete.

---

## Dependency Contract Verification

- [x] **`computeStateHash` signature verified:**
  `computeStateHash(gameState: LegendaryGameState): string` at
  `packages/game-engine/src/replay/replay.hash.ts:67`. Takes full `G`,
  returns hex string. WP-032's `detectDesync` calls this with `G` and
  compares against `intent.clientStateHash` (also a string). Compatible.

- [x] **`CoreMoveName` / `CORE_MOVE_NAMES` verified:**
  `CoreMoveName = 'drawCards' | 'playCard' | 'endTurn'` — only 3 of 10
  registered moves. `CORE_MOVE_NAMES` is NOT the complete move registry.
  **See RS-2 below for resolution.**

- [x] **`LegendaryGameState` shape verified:**
  Exported from `types.ts`. `computeStateHash` accepts it. `validateIntent`
  reads `G` only via `computeStateHash` — no direct field access required
  beyond what `computeStateHash` encapsulates.

- [x] **`makeMockCtx` verified:**
  Exported from `test/mockCtx.ts`. Returns `SetupContext` shape. WP-032
  tests need `ctx.currentPlayer` and `ctx.turn` — `makeMockCtx` provides
  both (via the overrides parameter). Compatible.

- [x] **D-0401 verified:** Exists in DECISIONS.md as `D‑0401 — Clients
  Submit Intents, Not Outcomes` (em-dash heading, line 136). Status:
  Immutable.

- [x] **D-0402 verified:** Exists in DECISIONS.md as `D‑0402 —
  Engine‑Authoritative Resync` (em-dash heading, line 144). Status:
  Immutable.

- [x] **Functions called are exported:** `computeStateHash` is exported.
  No other dependency functions are called.

- [x] **No boardgame.io imports required:** `validateIntent` takes
  `ctx: unknown` with a local structural interface (see RS-4). No direct
  boardgame.io import needed.

- [x] **New types in dedicated contract files:** `intent.types.ts` is
  a dedicated types file. Correct per D-1216.

- [x] **WP file paths verified:** `src/network/` does not exist yet —
  WP-032 creates it. All other referenced files exist:
  `src/types.ts`, `src/index.ts`, `src/replay/replay.hash.ts`.

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in
  `docs/03.1-DATA-SOURCES.md` — YES. WP-032 consumes only `G`
  (runtime state) and `ctx` (framework context). No external data.
- [x] Storage location known — YES. `G` is runtime-only, `ctx` is
  framework-provided.
- [x] Data source inspectable — YES. `G` is the game state,
  `computeStateHash` is in `replay.hash.ts`.
- [x] No implicit data — YES. The 5 rejection codes are explicit
  constants, not derived from external datasets.
- [x] No setup-time derived fields — YES. WP-032 adds no new `G` fields.

All YES. No traceability concerns.

---

## Structural Readiness Check

- [x] All prior WPs compile and tests pass: 358 tests, 94 suites, 0 fail.
  `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [x] No known EC violations remain open.
- [x] Required types/contracts exist and are exported: `computeStateHash`,
  `LegendaryGameState`, `CoreMoveName`, `CORE_MOVE_NAMES`,
  `makeMockCtx` — all verified.
- [x] No naming or ownership conflicts.
- [x] No architectural boundary conflicts at the contract level —
  all WP-032 files are engine-category, no boardgame.io imports.
- [x] WP does not touch database schemas or R2 data.
- [x] WP does not read data from G fields beyond `computeStateHash`
  encapsulation.

All YES.

---

## Code Category Boundary Check

- [ ] **PS-1 (BLOCKING): `src/network/` is a new directory not listed in
  `02-CODE-CATEGORIES.md`.** Must be classified before execution.

  **Resolution:** Create decision D-3201 classifying `src/network/` as
  `engine` category per the D-2706 / D-2801 / D-3001 / D-3101 template.
  Rationale: pure validation functions, no I/O, no boardgame.io imports,
  no registry imports, follows all engine-category rules. Status: Immutable.
  This must be created before the session prompt is generated.

- [x] All new files (`intent.types.ts`, `intent.validate.ts`,
  `desync.detect.ts`, `intent.validate.test.ts`) are engine-category code:
  pure, no I/O, no boardgame.io, no `.reduce()`.
- [x] Modified files (`types.ts`, `index.ts`) are existing engine
  re-export files — additive changes only.
- [x] No category boundary blurring.

---

## Established Patterns to Follow

- Local structural interface for `ctx` subset: `validateIntent` must NOT
  import `boardgame.io`. Define a local interface with `readonly
  currentPlayer: string`, `readonly turn: number` (WP-028 precedent, D-2801).
- New types in dedicated `*.types.ts` files (WP-005B/006A precedent, D-1216).
- Data-only contracts in types file, handler functions separate (WP-009A/B
  precedent, D-1232).
- No `.reduce()` in validation logic (code-style invariant).
- Named union for rejection codes (`IntentRejectionCode`) — prevents drift
  across producer and consumer (WP-030 precedent).
- Explicit "01.5 NOT INVOKED" in session prompt (WP-030 precedent): WP-032
  does not trigger any 01.5 condition (no new `G` field, no
  `buildInitialGameState` change, no new move, no new phase hook).
- Audit grep patterns must use `from ['"]boardgame\.io` for import-line
  verification, not bare `boardgame.io` (WP-031 precedent).
- Test file uses one `describe()` block for suite count increment (WP-031
  precedent).

---

## Maintainability & Upgrade Readiness

- [x] **Extension seam exists:** `IntentRejectionCode` is a named union.
  Future rejection codes add to the union and `validateIntent` switch/if
  chain. No refactoring needed.
- [x] **Patch locality:** A bug in validation logic touches only
  `intent.validate.ts`. Desync logic is isolated in `desync.detect.ts`.
  1-2 files for any fix.
- [x] **Fail-safe behavior:** Validation returns structured results, never
  throws. Invalid intents are rejected without mutation. No state corruption
  possible.
- [x] **Deterministic reconstructability:** Validation is a pure function
  of `(intent, G, ctx)`. Fully reproducible.
- [x] **Backward-compatible test surface:** No existing tests affected.
  No new `G` fields. Older test mocks remain valid.
- [x] **Semantic naming stability:** `ClientTurnIntent`, `validateIntent`,
  `detectDesync` are stable names without MVP-scoped prefixes.

All YES.

---

## Scope Lock (Critical)

### WP-032 Is Allowed To

- Create: `packages/game-engine/src/network/intent.types.ts` — data-only
  types (ClientTurnIntent, IntentValidationResult, IntentRejectionCode)
- Create: `packages/game-engine/src/network/intent.validate.ts` — pure
  validation function (`validateIntent`)
- Create: `packages/game-engine/src/network/desync.detect.ts` — pure
  desync detection function (`detectDesync`)
- Create: `packages/game-engine/src/network/intent.validate.test.ts` —
  9 tests using `node:test`, `makeMockCtx`
- Modify: `packages/game-engine/src/types.ts` — additive re-exports only
- Modify: `packages/game-engine/src/index.ts` — additive exports only
- Update governance docs: DECISIONS.md, STATUS.md, WORK_INDEX.md

### WP-032 Is Explicitly Not Allowed To

- No modification of `game.ts` or any move implementation
- No modification of any file under `apps/server/`
- No new `G` fields
- No boardgame.io imports in any `src/network/` file
- No `.reduce()` in validation logic
- No `throw` in validation logic — structured results only
- No `Math.random()` or nondeterminism
- No `require()` — ESM only
- No modification of `makeMockCtx` or shared test helpers
- No runtime registry access
- No modification of prior contract files
- No files outside the allowlist above
- No 01.5 runtime wiring allowance invocation

---

## Test Expectations (Locked)

- **9 new tests** in `src/network/intent.validate.test.ts`:
  1. Valid intent passes validation
  2. Wrong player: rejected with `WRONG_PLAYER`
  3. Wrong turn number: rejected with `WRONG_TURN`
  4. Unregistered move name: rejected with `INVALID_MOVE`
  5. Malformed args: rejected with `MALFORMED_ARGS`
  6. Matching client state hash: passes
  7. Mismatched client state hash: rejected with `DESYNC_DETECTED`
  8. No client hash provided: passes (hash is optional)
  9. Validation does not mutate G (deep equality check)
- **Existing baseline:** 358 tests, 94 suites, 0 fail — must continue
  to pass unchanged
- **Expected after WP-032:** 367 tests, 95 suites, 0 fail
  (358 + 9 = 367; 94 + 1 describe block = 95)
- **Test structure:** All 9 tests wrapped in one `describe('intent
  validation (WP-032)')` block (adds +1 suite per WP-031 precedent)
- No boardgame.io imports in test files
- No modifications to `makeMockCtx`

---

## Risk & Ambiguity Review

### RS-1 — `validateIntent` ctx parameter requires local interface

**Risk:** WP-032 specifies `validateIntent(intent, G, ctx: Ctx)` but
`src/network/` files must NOT import boardgame.io.
**Impact:** MEDIUM — wrong import breaks architecture.
**Mitigation:** Define a local structural interface in `intent.validate.ts`:
```ts
interface IntentValidationContext {
  readonly currentPlayer: string;
  readonly turn: number;
}
```
Use `ctx: IntentValidationContext` instead of `ctx: Ctx`. This follows the
WP-028 precedent (`UIBuildContext`) and WP-022 precedent (`ctx: unknown`
with narrowing).
**Decision:** LOCKED. Use local structural interface, no boardgame.io import.

### RS-2 — Move name validation against incomplete CORE_MOVE_NAMES

**Risk:** `CORE_MOVE_NAMES` contains only 3 of 10 registered moves
(`drawCards`, `playCard`, `endTurn`). The other 7 moves (`advanceStage`,
`revealVillainCard`, `fightVillain`, `recruitHero`, `fightMastermind`,
`setPlayerReady`, `startMatchIfReady`) are domain moves not in any
canonical array.
**Impact:** HIGH — validating against `CORE_MOVE_NAMES` would reject 7
valid moves as `INVALID_MOVE`.
**Mitigation:** `validateIntent` accepts an additional parameter
`validMoveNames: readonly string[]` — the caller provides the list of
valid move names for the current context. This is transport-agnostic (the
caller knows which moves are registered), avoids importing boardgame.io or
`game.ts`, and follows the established pattern of injecting dependencies
rather than importing them (WP-025/026 precedent with `registry: unknown`).

Alternative considered: Create a new `ALL_MOVE_NAMES` constant in
`coreMoves.types.ts` or a separate file. Rejected because (a) this would
require modifying `coreMoves.types.ts` which is outside WP-032's scope,
(b) lobby moves and gameplay moves have different availability, and (c)
the validation layer should be context-independent.

**Decision:** LOCKED. Add `validMoveNames: readonly string[]` parameter.
Tests provide the array explicitly. The WP's `validateIntent` signature
becomes:
```ts
function validateIntent(
  intent: ClientTurnIntent,
  gameState: LegendaryGameState,
  context: IntentValidationContext,
  validMoveNames: readonly string[]
): IntentValidationResult
```

### RS-3 — MALFORMED_ARGS validation depth

**Risk:** WP-032 §B step 4 says "Check `intent.move.args` is structurally
valid for the named move." Full per-move args schema validation would
require importing all args type validators, which is scope creep for a
transport-agnostic contract.
**Impact:** MEDIUM — over-specification bloats the validator; under-
specification leaves a gap.
**Mitigation:** MVP validation checks only that `intent.move.args` is a
plain object (not null, not a function, not an array for moves that expect
object args). The actual per-move args validation happens when the move
executes — boardgame.io moves already validate their args via the existing
`coreMoves.validate.ts` validators. `MALFORMED_ARGS` at the intent level
catches obvious structural problems (e.g., args is a string instead of an
object, or `null` where an object is expected).

**Decision:** LOCKED. `MALFORMED_ARGS` checks `typeof intent.move.args`
is not a function and is JSON-serializable. Per-move schema validation
is deferred to move execution.

### RS-4 — `validateIntent` signature drift from WP text

**Risk:** WP-032 §B specifies `validateIntent(intent, G, ctx)` but
RS-1 and RS-2 add `IntentValidationContext` and `validMoveNames`
parameters.
**Impact:** LOW — WP text outdated but pre-flight locks the actual
signature.
**Mitigation:** The pre-flight-locked signature (RS-2) is authoritative.
WP text must be back-synced (WP-030 precedent: pre-flight refinement
back-sync). This is a non-blocking nit for pre-commit review.
**Decision:** LOCKED. Session prompt uses the pre-flight-locked signature.

### RS-5 — EC-032 Verification Steps use `Select-String` (PowerShell)

**Risk:** EC-032 verification steps use PowerShell `Select-String`
syntax. Claude Code runs bash, not PowerShell.
**Impact:** LOW — verification intent is clear; bash equivalents exist.
**Mitigation:** Use bash `grep` equivalents during execution. The
verification intent (no boardgame.io imports, no `.reduce()`, no `throw`,
etc.) is what matters, not the specific command syntax.
**Decision:** LOCKED. Use bash grep with import-line-specific patterns
per WP-031 precedent (e.g., `grep -r "from.*boardgame" src/network/`).

### RS-6 — `detectDesync` as separate file vs inline in `intent.validate.ts`

**Risk:** WP-032 specifies `desync.detect.ts` as a separate file. The
function is 8 lines. A separate file may be over-modularization.
**Impact:** LOW — WP/EC spec is explicit about file structure.
**Mitigation:** Follow the WP/EC specification exactly. The separate file
maintains single-responsibility and enables independent testing if needed
in a future WP.
**Decision:** LOCKED. Create `desync.detect.ts` as specified.

---

## Pre-Flight Verdict

### **READY TO EXECUTE**

WP-032 is properly sequenced: all dependencies complete, repo is green
(358/94/0), all prerequisite exports verified by reading actual source
files. Contract fidelity is confirmed: `computeStateHash` signature
matches the desync detection use case, `LegendaryGameState` is the correct
input type, D-0401 and D-0402 exist in DECISIONS.md with Immutable status.
The scope lock is clear: 4 new files + 2 additive modifications, no `G`
mutation, no boardgame.io imports, no server changes. Three significant
risks were identified and resolved: RS-1 (local structural interface for
ctx), RS-2 (validMoveNames parameter injection instead of incomplete
CORE_MOVE_NAMES), RS-3 (MVP-scoped MALFORMED_ARGS checking). The
architectural boundary is clean: all new code is pure engine-category with
no framework dependency. Extension seams exist via the `IntentRejectionCode`
union.

**Blocking pre-session action:** PS-1 must be resolved (D-3201 for
`src/network/` code-category classification) before the session prompt is
generated.

---

## Invocation Prompt Conformance Check (Pre-Generation)

- [ ] EC locked values copied verbatim — PENDING (prompt not yet generated)
- [ ] No new scope in prompt — PENDING
- [ ] File paths match WP/EC — PENDING
- [ ] No forbidden imports — PENDING
- [ ] Contract names match verified code — PENDING (use pre-flight-locked
  signature from RS-2/RS-4, not WP text)
- [ ] Helper call patterns match actual signatures — PENDING

These will be verified when the session prompt is generated.

---

## Authorized Next Step

**Pre-session actions — ALL RESOLVED (2026-04-15):**

1. **PS-1 (RESOLVED):** Created D-3201 in DECISIONS.md classifying
   `packages/game-engine/src/network/` as `engine` code category. Follows
   D-2706 / D-2801 / D-3001 / D-3101 template. Also added to
   DECISIONS_INDEX.md. Status: Immutable.

2. **PS-2 (RESOLVED):** Back-synced WP-032 §A and §B to use the pre-flight-
   locked `validateIntent` signature with `IntentValidationContext` and
   `validMoveNames` parameters. Three changes: (a) §A adds
   `IntentValidationContext` to types file scope, (b) §B signature uses
   `context: IntentValidationContext` + `validMoveNames: readonly string[]`,
   (c) §B steps 3/4 clarify move-name validation against injected list and
   MVP-scoped MALFORMED_ARGS structural check.

Once PS-1 is resolved, generate session execution prompt for WP-032 at:
`docs/ai/invocations/session-wp032-network-sync.md`

**01.5 IS NOT INVOKED:** WP-032 does not trigger any of the four 01.5
conditions:
1. No new `LegendaryGameState` field — ABSENT
2. No `buildInitialGameState` shape change — ABSENT
3. No new `LegendaryGame.moves` entry — ABSENT
4. No new phase hook — ABSENT

Per 01.5 §Escalation: "It may not be cited retroactively in execution
summaries or pre-commit reviews to justify undeclared changes."
