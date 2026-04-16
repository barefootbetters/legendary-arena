# Post-Mortem — WP-032 (Network Sync & Turn Validation)

---

### 0. Metadata

- **Work Packet:** WP-032
- **Title:** Network Sync & Turn Validation
- **Execution Date:** 2026-04-15
- **EC Used:** EC-032
- **Pre-Flight Date:** 2026-04-15
- **Test Baseline:** 358/94/0 -> 367/95/0

---

### 1. Binary Health Check (Absolute)

- [x] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0
  (367 tests, 95 suites, 0 fail)
- [x] Correct number of new tests added (9, matches WP spec exactly)
- [x] No existing test files modified
- [x] No scope expansion occurred during execution
- [x] EC acceptance criteria all pass (all 9 verification steps green)

All YES. Proceeding.

---

### 2. Scope & Allowlist Audit

**Modified files (from `git diff --name-only`):**

Code files:
- `packages/game-engine/src/types.ts` — allowlisted (additive re-exports)
- `packages/game-engine/src/index.ts` — allowlisted (additive exports)

Governance files (pre-flight/copilot fixes, not WP code):
- `docs/ai/DECISIONS.md` — D-3201, D-3202, D-3203 added
- `docs/ai/DECISIONS_INDEX.md` — index entries added
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — directory list updated
- `docs/ai/execution-checklists/EC-032-network-sync.checklist.md` — signature update
- `docs/ai/work-packets/WP-032-network-sync-turn-validation.md` — back-sync
- `docs/ai/STATUS.md` — WP-032 entry added
- `docs/ai/work-packets/WORK_INDEX.md` — WP-032 checked off

**New files (untracked):**
- `packages/game-engine/src/network/intent.types.ts` — allowlisted
- `packages/game-engine/src/network/intent.validate.ts` — allowlisted
- `packages/game-engine/src/network/desync.detect.ts` — allowlisted
- `packages/game-engine/src/network/intent.validate.test.ts` — allowlisted
- `docs/ai/invocations/preflight-wp032-network-sync.md` — governance artifact
- `docs/ai/invocations/copilot-wp032-network-sync.md` — governance artifact
- `docs/ai/invocations/session-wp032-network-sync.md` — governance artifact
- `docs/ai/invocations/postmortem-wp032-network-sync.md` — this file

- [x] Only allowlisted files modified
- [x] No contract files modified (types.ts and index.ts are additive only)
- [x] No "while I'm here" refactors
- [x] No formatting-only or cleanup-only edits
- [x] No new files outside WP scope (governance artifacts are expected)

---

### 3. Boundary Integrity Check

#### Framework Boundaries

- [x] No `boardgame.io` imports in any network file — verified via
  `grep -r "from.*boardgame" packages/game-engine/src/network/` (exit 1,
  no matches)
- [x] No framework context leaking — `IntentValidationContext` is a local
  structural interface with 2 readonly fields; no `Ctx` import
- [x] No lifecycle coupling — `validateIntent` and `detectDesync` are NOT
  wired into `game.ts`, moves, or phase hooks. Consumed only by tests.

#### Registry / IO Boundaries

- [x] No registry imports — verified: only imports are from `../types.js`,
  `./intent.types.js`, `./desync.detect.js`, and
  `../replay/replay.hash.js`
- [x] No filesystem, network, or persistence access

#### Code Category Compliance

- [x] All 4 new files in `src/network/` — classified as engine category
  per D-3201
- [x] No setup-time code in network directory (all pure validation)
- [x] No execution logic in `intent.types.ts` (types only)

---

### 4. Representation & Determinism Audit

- [x] `ClientTurnIntent` is data-only and JSON-serializable — fields are
  `string`, `number`, `unknown`, and optional `string`. No functions,
  closures, Maps, Sets, Dates, or classes.
- [x] `IntentValidationResult` is data-only — `{ valid: true }` or
  `{ valid: false; reason: string; code: IntentRejectionCode }`. All
  primitives.
- [x] `IntentValidationContext` is `readonly` — 2 primitive fields.
- [x] `validateIntent` is deterministic — same `(intent, gameState,
  context, validMoveNames)` always produces the same result. No hidden
  state, no caching, no memoization. Sequence is fixed (5 checks in
  order, short-circuit on first failure).
- [x] `detectDesync` is deterministic — delegates to `computeStateHash`
  which is deterministic (WP-027).
- [x] No module-level mutable state — no `let` or mutable `const` at
  module scope in any network file.
- [x] Unknown/future values: `MALFORMED_ARGS` rejects functions; all
  other `unknown` args pass through to move execution. No throw.

---

### 5. Mutation, Aliasing, & Reference Safety

- [x] No mutation occurs anywhere — `validateIntent` and `detectDesync`
  only read their inputs and return new object literals.
- [x] No helpers mutate `G` or `ctx` — Test 9 enforces non-mutation via
  `JSON.stringify` deep equality.
- [x] No mutation during validation.
- [x] Pure functions confirmed: all 3 implementation functions
  (`validateIntent`, `detectDesync`, `computeStateHash`) are pure.

**Aliasing trace (line-by-line):**

`validateIntent` returns:
- Lines 47-51: new object literal `{ valid: false, reason: ..., code: ... }` — no aliasing
- Lines 56-60: new object literal — no aliasing
- Lines 66-70: new object literal — no aliasing
- Lines 77-80: new object literal — no aliasing
- Lines 87-91: new object literal — no aliasing
- Line 94: `{ valid: true }` — new object literal — no aliasing

`detectDesync` returns:
- Line 31: `{ desynced: false, engineHash }` — `engineHash` is a string
  primitive (return value of `computeStateHash`), no aliasing possible
- Lines 34-37: `{ desynced: ..., engineHash }` — same, string primitives

**Verdict:** No aliasing risk. All returned objects are fresh literals
containing only primitive values. No G field references are returned.

---

### 6. Hidden-Coupling Detection

- [x] No engine internals exposed — `validateIntent` takes
  `LegendaryGameState` as a parameter (typed import) but only passes it to
  `detectDesync` which passes it to `computeStateHash`. No internal G
  fields are accessed directly.
- [x] `IntentRejectionCode` union is intentionally closed (5 members).
  No unintentional widening.
- [x] No implicit knowledge of upstream implementation — `validateIntent`
  does not know what moves exist (injected via `validMoveNames`), does
  not know the hash algorithm (delegates to `computeStateHash`).
- [x] Ordering assumption is explicit and documented (JSDoc lists the
  5-step sequence).
- [x] No dependency on non-exported functions — `computeStateHash` is
  exported from `replay.hash.ts` and re-exported from `index.ts`.

---

### 7. Test Adequacy Review

- [x] Tests fail if boundaries are violated:
  - Test 2 (WRONG_PLAYER): fails if player check removed
  - Test 3 (WRONG_TURN): fails if turn check removed
  - Test 4 (INVALID_MOVE): fails if move name check removed
  - Test 5 (MALFORMED_ARGS): fails if args check removed
  - Test 7 (DESYNC_DETECTED): fails if desync check removed
- [x] Determinism tested implicitly — Tests 1/6/8 prove valid intents
  always produce `{ valid: true }` with identical inputs.
- [x] Serialization: N/A — `IntentValidationResult` is a primitive-only
  object literal (no serialization risk). `ClientTurnIntent` is
  tested indirectly via the args function check (Test 5).
- [x] Non-mutation tested — Test 9 (`JSON.stringify` equality pre/post).
- [x] Tests do NOT depend on unrelated engine behavior — the only
  engine dependency is `buildInitialGameState` to produce a valid G
  fixture (same pattern as invariants.test.ts).
- [x] No tests weakened — all assertions are strict.

---

### 8. Documentation & Governance Updates

- [x] **DECISIONS.md** — D-3201 (network directory classification),
  D-3202 (engine-side validation), D-3203 (additive to boardgame.io)
  added with rationale.
- [x] **ARCHITECTURE.md** — No update needed. WP-032 does not change
  architectural boundaries — it adds a contract within the existing
  engine layer. The Layer Boundary section already covers the engine's
  role in validation.
- [x] **STATUS.md** — WP-032 entry added with full description of what
  changed.
- [x] **WORK_INDEX.md** — WP-032 checked off with 2026-04-15 date.

---

### 9. Forward-Safety Questions

- [x] **Survives future refactors?** YES. `validateIntent` has no
  knowledge of specific moves, no boardgame.io import, no G field
  access. Adding or removing moves requires only updating the
  `validMoveNames` array at the call site.
- [x] **Replay/debugging can reconstruct?** YES. Validation is a pure
  function of `(intent, G, context, validMoveNames)`. Given the same
  inputs, it produces the same result. The rejection reason includes
  enough detail to diagnose the failure.
- [x] **Removing upstream data fails safely?** YES. If `computeStateHash`
  were removed, TypeScript would catch the broken import at compile time.
  If `clientStateHash` is omitted, `detectDesync` returns
  `{ desynced: false }` (graceful degradation).
- [x] **Cannot influence gameplay unintentionally?** YES. Network
  functions are not wired into the boardgame.io lifecycle. They are
  consumed only by tests and future server-layer code.
- [x] **Contract stable for future WPs?** YES. `ClientTurnIntent`,
  `IntentValidationResult`, and `IntentRejectionCode` are data-only
  types with locked shapes. `validateIntent` has a stable 4-parameter
  signature. Future WPs extend by adding rejection codes to the union
  and steps to the validator.

All YES.

---

### 10. Final Post-Mortem Verdict

- [x] **WP COMPLETE** — execution is correct, safe, and durable

**Notes / Follow-ups:**

- None. No mid-execution amendments, no scope deviations, no blocking
  issues.

**Fixes applied during post-mortem:**

- None. No aliasing, coupling, or boundary issues discovered. All
  implementation files pass inspection without modification.
