# WP-057 — Pre-Plan Sandbox Execution (Speculative Planning Logic)

**Status:** Complete (amended 2026-04-20 per pre-flight PS-2 / PS-3)
**Primary Layer:** Pre-Planning (Non-Authoritative, Per-Client)
**Last Updated:** 2026-04-20
**Dependencies:**

- `docs/ai/DESIGN-PREPLANNING.md` (approved architecture)
- `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` (design constraints)
- **WP-056** — Pre-Planning State Model & Lifecycle (complete at commit `eade2d0`, 2026-04-20)
- WP-006A — Player zones & hand/deck/discard model
- WP-008B — Core moves implementation (move names, counter patterns)

---

## Amendments

**2026-04-20 (pre-flight, Commit A0 `SPEC:`):** Two scope-neutral corrections
identified by `docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md`
and locked by `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md`:

- **PS-2** — Added `packages/preplan/src/preplanStatus.ts` (canonical readonly
  array `PREPLAN_STATUS_VALUES` + derived `PrePlanStatusValue` type) and
  `packages/preplan/src/preplanStatus.test.ts` (drift-detection test) to
  §F, §Updated Package Exports, §Tests, and §Files Expected to Change.
  This closes the WP-056 deferral captured in EC-056 Locked Value line 32
  ("Canonical readonly arrays + drift-detection tests for `status` /
  `effectType` closed unions are deferred to WP-057 (first runtime
  consumer)"). `PREPLAN_EFFECT_TYPES` remains WP-058 scope.
- **PS-3** — Added `packages/preplan/package.json` (modify: `test` script +
  `tsx` devDep) and `pnpm-lock.yaml` (modify: scoped devDep delta) to
  §Files Expected to Change. Without the `test` script the 21 new tests
  added by this WP would silently skip under `pnpm test` at the repo root.

Uniform null-on-inactive return convention across all five speculative
operations (`speculativeDraw`, `speculativePlay`, `updateSpeculativeCounter`,
`addPlanStep`, `speculativeSharedDraw`) is locked in EC-057; §C below is
read together with the EC's "null-on-inactive convention" locked value.

---

## Session Context

WP-056 established the **explicit PrePlan state model** — types, lifecycle
invariants, and architectural boundaries. However, WP-056 is types-only
and contains no runtime code.

This packet introduces the **runtime behavior that makes pre-planning
usable**: creating sandboxes, performing speculative draws and plays,
tracking reveals, managing counters, and computing state fingerprints.

After WP-057, a player can actually plan a turn speculatively. Disruption
handling (detection, invalidation, rewind, notification) is deferred to
WP-058.

---

## Why This Packet Matters

Without sandbox execution logic:

- PrePlan types exist but nothing can create or populate them
- Speculative draws have no PRNG management
- The reveal ledger has no mechanism to be populated
- Pre-planning is a data model with no behavior

WP-057 makes pre-planning **functional**: players can create a sandbox,
draw speculatively, play cards, track resources, and build a plan.

---

## Goal

Implement **sandbox creation and speculative planning operations** such that:

- A sandbox can be created from a read-only snapshot of real player state
- Speculative draws use a client-local PRNG (never `ctx.random.*`)
- Every speculative reveal is recorded in the reveal ledger
- Speculative plays move cards between sandbox zones correctly
- Counter updates (attack, recruit) are tracked speculatively
- State fingerprints enable divergence detection
- All operations are pure functions operating on PrePlan state

---

## Non-Goals (Explicit)

This packet does **NOT**:

- Detect disruptions or invalidate pre-plans
- Perform rewind or source restoration
- Deliver notifications
- Wire into the UI layer
- Modify engine state, moves, or hooks
- Simulate card effects or rule hooks (only basic draw/play/counter)
- Introduce any `boardgame.io` imports

---

## Non-Negotiable Constraints (Enforced)

| # | Constraint | Enforced By |
|---|---|---|
| 1 | Explicit representation | Sandbox created as structured PrePlan object |
| 2 | Advisory, non-binding | All operations mutate sandbox only, never `G` |
| 5 | Locally determinable | Sandbox uses only player's own state + public state |
| 8 | Zero/partial/full planning | All operations are optional and composable |
| 9 | No information leakage | PRNG is client-local; sandbox state is never exported |
| 10 | Single-turn scope | `appliesToTurn` set to `ctx.turn + 1` at creation |

---

## Architectural Placement

All code lives in `packages/preplan/`. No engine runtime imports.

```
Real Player State (read-only snapshot)
    |
    v
createPrePlan()          ← WP-057
    |
    v
speculativeDraw()        ← WP-057
speculativePlay()        ← WP-057
updateCounter()          ← WP-057
addPlanStep()            ← WP-057
    |
    v
PrePlan (populated, active)
    |
    v
Disruption Pipeline      ← WP-058 (future)
```

---

## Scope (In)

### A) Client-Local PRNG

**File:** `packages/preplan/src/speculativePrng.ts`

A minimal, seedable pseudo-random number generator for speculative deck
shuffling. This PRNG is:

- Deterministic given a seed (for testability)
- Never authoritative (engine's `ctx.random.*` determines real deck order)
- Disposable (new seed on every sandbox creation and rewind)

```typescript
/**
 * Minimal seedable PRNG for speculative deck shuffling.
 *
 * Not cryptographically secure. Not authoritative.
 * Exists only to provide plausible deck order during planning.
 *
 * Uses a simple linear congruential generator for reproducibility
 * in tests.
 *
 * PRNG contract:
 * - Deterministic per seed (same seed → same sequence, always)
 * - Uniform enough for Fisher-Yates
 * - Algorithm changes require updating snapshot tests (changing
 *   the algorithm changes shuffle output for existing seeds)
 */
export function createSpeculativePrng(seed: number): () => number {
  // Implementation: LCG or similar
  // Returns a function that produces numbers in [0, 1)
}

/**
 * Fisher-Yates shuffle using a speculative PRNG.
 *
 * Returns a new array; does not mutate the input.
 */
export function speculativeShuffle<T>(
  items: readonly T[],
  random: () => number,
): T[] {
  // Standard Fisher-Yates using the provided random function
}

/**
 * Generate a seed from the current environment.
 *
 * Uses Date.now() or similar entropy source. This is acceptable
 * because speculative randomness is never authoritative — the
 * engine's ctx.random.* determines real deck order.
 */
export function generateSpeculativeSeed(): number {
  // Implementation detail
}
```

**Rules:**

- Must be deterministic given the same seed (testable)
- Must never use `ctx.random.*` or `Math.random()` directly in
  production code paths (use `generateSpeculativeSeed()` → `createSpeculativePrng()`)
- `Math.random()` prohibition in the engine does not apply here because
  this code is non-authoritative and lives outside the engine layer
  (see `DESIGN-PREPLANNING.md` Section 3, Randomness in the Sandbox)

---

### B) Sandbox Creation

**File:** `packages/preplan/src/preplanSandbox.ts`

```typescript
import type { CardExtId } from '@legendary-arena/game-engine';
import type { PrePlan, PrePlanSandboxState } from './preplan.types.js';

/**
 * Snapshot of real player state used to initialize a sandbox.
 *
 * Produced by the caller (UI layer or controller) from the engine's
 * state projection. This WP does not define how the snapshot is obtained.
 */
export type PlayerStateSnapshot = {
  playerId: string;
  hand: CardExtId[];
  deck: CardExtId[];
  discard: CardExtId[];
  counters: Record<string, number>;
  /** Current ctx.turn value from the engine. */
  currentTurn: number;
};

/**
 * Create a new PrePlan from a snapshot of real player state.
 *
 * The deck is shuffled using a client-local PRNG seed. The shuffle
 * is disposable and never authoritative.
 *
 * Invariant: appliesToTurn = snapshot.currentTurn + 1.
 */
export function createPrePlan(
  snapshot: PlayerStateSnapshot,
  prePlanId: string,
  prngSeed: number,
): PrePlan {
  // 1. Shuffle deck copy using speculativeShuffle
  // 2. Compute baseStateFingerprint from snapshot
  // 3. Return PrePlan with status 'active', empty ledger, empty steps
}

/**
 * Compute a fingerprint from a player state snapshot.
 *
 * Used to detect whether the real state has diverged since sandbox
 * creation. The fingerprint covers: hand contents, deck size,
 * discard contents, and counter values.
 *
 * Deck contents (card identities) are included but deck ORDER is not,
 * because the sandbox uses its own shuffled order.
 */
export function computeStateFingerprint(
  snapshot: PlayerStateSnapshot,
): string {
  // Deterministic hash/digest of player-visible state
  // Specific algorithm is an implementation detail
}
```

**Rules:**

- `createPrePlan` is a pure function (no side effects, no I/O)
- `appliesToTurn` is always `snapshot.currentTurn + 1` (enforces
  WP-056 invariant)
- The returned PrePlan has `status: 'active'`, `revision: 1`, empty
  `revealLedger`, empty `planSteps`, and `invalidationReason: undefined`
- Deck is shuffled at creation (not deferred)

---

### C) Speculative Operations

**File:** `packages/preplan/src/speculativeOperations.ts`

```typescript
import type { CardExtId } from '@legendary-arena/game-engine';
import type {
  PrePlan,
  PrePlanSandboxState,
  RevealRecord,
  PrePlanStep,
} from './preplan.types.js';

/**
 * Draw a card speculatively from the sandbox deck.
 *
 * Moves the top card from deck to hand and records the reveal
 * in the ledger. Returns null if the deck is empty.
 *
 * INVARIANT: Every speculative draw must be recorded in the
 * revealLedger. Draws that bypass the ledger are invalid.
 */
export function speculativeDraw(
  prePlan: PrePlan,
): { updatedPlan: PrePlan; drawnCard: CardExtId } | null {
  // 1. Guard: status must be 'active'
  // 2. Guard: deck must be non-empty
  // 3. Remove top card from sandbox deck
  // 4. Add card to sandbox hand
  // 5. Append RevealRecord to revealLedger
  // 6. Return updated plan + drawn card
}

/**
 * Play a card speculatively from hand to inPlay.
 *
 * Returns null if the card is not in the sandbox hand.
 */
export function speculativePlay(
  prePlan: PrePlan,
  cardExtId: CardExtId,
): PrePlan | null {
  // 1. Guard: status must be 'active'
  // 2. Guard: card must be in sandbox hand
  // 3. Remove card from sandbox hand
  // 4. Add card to sandbox inPlay
  // 5. Return updated plan
}

/**
 * Update a speculative counter value.
 *
 * Adds the delta to the named counter. Creates the counter
 * if it does not exist (initialized to 0 + delta).
 */
export function updateSpeculativeCounter(
  prePlan: PrePlan,
  counterName: string,
  delta: number,
): PrePlan {
  // 1. Guard: status must be 'active'
  // 2. Update sandbox counter
  // 3. Return updated plan
}

/**
 * Add an advisory plan step.
 *
 * Plan steps are informational only. They help the player organize
 * their thinking and enable the system to explain what broke on
 * rewind.
 *
 * NOTE: In WP-057, `isValid` is initialized to `true` and never
 * mutated. Any validation or invalidation of individual plan steps
 * belongs to later WPs.
 */
export function addPlanStep(
  prePlan: PrePlan,
  step: Omit<PrePlanStep, 'isValid'>,
): PrePlan {
  // 1. Guard: status must be 'active'
  // 2. Append step with isValid: true
  // 3. Return updated plan
}

/**
 * Draw a card speculatively from a shared source (officers, sidekicks, HQ).
 *
 * Unlike deck draws, shared source draws do not remove from a local
 * deck copy — they record the reveal and add the card to the sandbox hand.
 * The real shared stack is not modified.
 *
 * CALLER RESPONSIBILITY: The caller must ensure the card was visible
 * to the player in the real game state at the time of planning. This
 * function does not verify card availability against real shared stacks.
 */
export function speculativeSharedDraw(
  prePlan: PrePlan,
  source: RevealRecord['source'],
  cardExtId: CardExtId,
): PrePlan {
  // 1. Guard: status must be 'active'
  // 2. Add card to sandbox hand
  // 3. Append RevealRecord to revealLedger with source
  // 4. Return updated plan
}
```

**Rules:**

- All functions are pure: they return a new PrePlan, never mutate in place
- All functions guard on `status === 'active'` — return `null` on
  invalid status (never throw for expected failure paths)
- All mutation functions increment `revision` on the returned PrePlan
- Every draw (deck or shared) appends to `revealLedger`
- No function touches real game state (`G`)
- No function imports `boardgame.io`
- **Failure signaling convention:** All speculative operations signal
  failure via `null` return, never by throwing. Throws are reserved
  for programming errors (e.g., internal invariant violations), not
  for expected conditions like empty deck or missing card.
- **Zero-op plans are valid:** Creating a PrePlan and performing zero
  speculative operations is a supported state. Players may use
  pre-plans for rough ordering or reminders without simulating draws.

---

### D) Updated Package Exports

**File:** `packages/preplan/src/index.ts` (modify — type-only surface from WP-056 becomes mixed runtime + type surface here; authorized by EC-057 RS-2)

```typescript
// Types (WP-056)
export type {
  PrePlan,
  PrePlanSandboxState,
  RevealRecord,
  PrePlanStep,
} from './preplan.types.js';

// Canonical status array + derived type (WP-057, PS-2 — deferred from WP-056 per EC-056 Locked Value line 32)
export { PREPLAN_STATUS_VALUES } from './preplanStatus.js';
export type { PrePlanStatusValue } from './preplanStatus.js';

// Sandbox creation (WP-057)
export type { PlayerStateSnapshot } from './preplanSandbox.js';
export { createPrePlan, computeStateFingerprint } from './preplanSandbox.js';

// Speculative operations (WP-057)
export {
  speculativeDraw,
  speculativePlay,
  updateSpeculativeCounter,
  addPlanStep,
  speculativeSharedDraw,
} from './speculativeOperations.js';

// PRNG (WP-057)
export {
  createSpeculativePrng,
  speculativeShuffle,
  generateSpeculativeSeed,
} from './speculativePrng.js';
```

---

### F) Canonical Status Array & Drift-Detection Test (PS-2)

**File:** `packages/preplan/src/preplanStatus.ts`

WP-056 declared the `PrePlan.status` closed union (`'active' | 'invalidated' | 'consumed'`) and intentionally deferred the paired canonical readonly array + drift-detection test to WP-057, which is the first runtime consumer (the speculative operations in §C guard on `status === 'active'`). See `packages/preplan/src/preplan.types.ts:60-65` JSDoc and EC-056 Locked Value line 32.

```typescript
import type { PrePlan } from './preplan.types.js';

/**
 * Canonical readonly array of all valid PrePlan lifecycle status values.
 *
 * Drift-detection contract:
 *   PREPLAN_STATUS_VALUES must match the PrePlan['status'] union exactly.
 *   Adding a status value requires updating BOTH the union in
 *   preplan.types.ts AND this array. The paired test in
 *   preplanStatus.test.ts enforces parity at build time.
 */
// why: canonical readonly array paired with PrePlan.status closed union;
// drift-detection test enforces parity at build time (deferred from WP-056
// per EC-056 Locked Value line 32; first runtime consumer is WP-057 §C
// speculative operation status guards).
export const PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as const;

/** Derived type — structurally identical to PrePlan['status']. */
export type PrePlanStatusValue = typeof PREPLAN_STATUS_VALUES[number];

// Compile-time exhaustive-check: fails to compile if PREPLAN_STATUS_VALUES
// drifts from PrePlan['status'] in either direction.
type _StatusDriftCheck = PrePlanStatusValue extends PrePlan['status']
  ? PrePlan['status'] extends PrePlanStatusValue
    ? true
    : never
  : never;
const _statusDriftProof: _StatusDriftCheck = true;
void _statusDriftProof;
```

**Rules:**

- Array values appear in the spec order: `'active'`, `'invalidated'`, `'consumed'` — matches the union declaration order in `preplan.types.ts:66`
- `as const` is mandatory (narrows to literal-type tuple)
- `PREPLAN_EFFECT_TYPES` for `invalidationReason.effectType` is **NOT** added by this WP — it remains deferred to WP-058, which is the first runtime consumer of `effectType`
- The compile-time exhaustive-check pattern is the project convention (matches the drift-detection tests for `MATCH_PHASES` / `TURN_STAGES` / `CORE_MOVE_NAMES` / `RULE_TRIGGER_NAMES` / `RULE_EFFECT_TYPES` / `REVEALED_CARD_TYPES`)

---

### E) Tests

**File:** `packages/preplan/src/speculativePrng.test.ts` (3 tests, 1 `describe` block)
**File:** `packages/preplan/src/preplanSandbox.test.ts` (6 tests, 1 `describe` block)
**File:** `packages/preplan/src/speculativeOperations.test.ts` (13 tests, 1 `describe` block)
**File:** `packages/preplan/src/preplanStatus.test.ts` (1 test, 1 `describe` block) — **PS-2**

Test runner: `node:test`. File extension: `.test.ts`. Each file wraps
its tests in exactly one top-level `describe('preplan <area> (WP-057)')`
block; bare top-level `test()` calls are forbidden (they do not register
as suites under `node:test` — WP-031 precedent).

**Test-count baseline lock:** preplan `0 / 0 / 0 → 23 / 4 / 0`;
engine `436 / 109 / 0` UNCHANGED; repo-wide `536 / 0 → 559 / 0`.

Required test coverage:

**PRNG tests (3 tests in `describe('preplan PRNG (WP-057)')`):**
- Same seed produces same shuffle order
- Different seeds produce different shuffle orders
- Shuffle does not mutate input array

**Sandbox creation tests (6 tests in `describe('preplan sandbox (WP-057)')`):**
- `createPrePlan` returns `status: 'active'` with `revision: 1`, empty ledger and steps
- `appliesToTurn` equals `snapshot.currentTurn + 1`
- Deck is shuffled (not identical to input order — use ≥8-card deck +
  seed proven to produce a non-identity permutation; `// why:` comment
  at the seed literal justifies the choice)
- Fingerprint is deterministic (same snapshot → same fingerprint)
- Fingerprint changes when hand contents differ
- Zero-op plan is valid: `createPrePlan` followed by no operations
  produces a usable PrePlan with empty ledger and steps

**Speculative operation tests (13 tests in `describe('preplan speculative operations (WP-057)')`):**
- `speculativeDraw` moves top card from deck to hand
- `speculativeDraw` appends to revealLedger with source `'player-deck'`
  and monotonically-increasing `revealIndex`
- `speculativeDraw` returns null when deck is empty
- `speculativeDraw` returns null when status is not `'active'`
- `speculativePlay` moves card from hand to inPlay
- `speculativePlay` returns null when card is not in hand
- `updateSpeculativeCounter` adds delta to named counter
- `updateSpeculativeCounter` creates counter if missing
- `addPlanStep` appends step with `isValid: true`
- `speculativeSharedDraw` adds card to hand and records source in ledger
- No operation mutates the input PrePlan across 3 sequential operations
  (deep-equality check of input PrePlan before + after; WP-028 aliasing
  precedent — aliasing of `sandboxState.hand` / `deck` / `discard` /
  `inPlay` / `counters` arrays/objects through returned references is
  forbidden and must be proven absent by this test)
- **Uniform null-on-inactive across all five operations** — iterate
  (`speculativeDraw`, `speculativePlay`, `updateSpeculativeCounter`,
  `addPlanStep`, `speculativeSharedDraw`) × (`status: 'invalidated'`,
  `status: 'consumed'`); assert every call returns `null`. Ten
  `assert.strictEqual(result, null)` assertions in one `test`. Proves
  EC-057 RS-8 uniform convention (a forgotten guard on any of the four
  non-draw operations would trip this test)
- **Revision-increment discipline across all five operations** —
  iterate the same five operations × (one success path, one null-return
  path); assert `result.revision === input.revision + 1` on success and
  the returned value is strictly `null` on the null-return branch (the
  input PrePlan's `revision` must remain unchanged after the null
  return, since the function is pure — tested via reference equality on
  the input). Ten assertions in one `test`. Proves EC-057 locked value
  "revision increments by exactly 1 on successful mutation; no increment
  on null-return paths" — a forgotten `revision + 1` in any operation
  would trip this test

**Status drift test (1 test in `describe('preplan status drift (WP-057)')`, PS-2):**
- `PREPLAN_STATUS_VALUES` matches `PrePlan['status']` union exactly — a
  runtime set-equality assertion against a fixture `Set<PrePlan['status']>`
  proves the array is neither a superset nor a subset. The compile-time
  exhaustive-check in `preplanStatus.ts` provides the type-level proof;
  the test provides the runtime proof (both layers match the
  WP-007A / 009A / 014A / 021 drift-detection precedent)

---

## Scope (Out)

- Disruption detection and invalidation
- Rewind execution and source restoration
- Notification delivery
- UI rendering
- Network replication
- Card effect simulation (only basic draw/play/counter in this WP)
- Rule hook execution within the sandbox

---

## Files Expected to Change

| File | Action | Notes |
|---|---|---|
| `packages/preplan/src/speculativePrng.ts` | **new** | PRNG + Fisher-Yates shuffle + seed generator |
| `packages/preplan/src/preplanSandbox.ts` | **new** | `PlayerStateSnapshot` type + `createPrePlan` + `computeStateFingerprint` |
| `packages/preplan/src/speculativeOperations.ts` | **new** | Five speculative operations; uniform `null` on non-active status |
| `packages/preplan/src/preplanStatus.ts` | **new** (PS-2) | `PREPLAN_STATUS_VALUES` + `PrePlanStatusValue` + compile-time drift check |
| `packages/preplan/src/index.ts` | **modify** | Add runtime exports; authorized type-only → mixed transition per EC-057 RS-2 |
| `packages/preplan/src/speculativePrng.test.ts` | **new** | 3 tests |
| `packages/preplan/src/preplanSandbox.test.ts` | **new** | 6 tests (includes zero-op and aliasing baseline) |
| `packages/preplan/src/speculativeOperations.test.ts` | **new** | 13 tests (includes 3-op aliasing proof + uniform null-on-inactive across all five ops + revision-increment discipline across all five ops) |
| `packages/preplan/src/preplanStatus.test.ts` | **new** (PS-2) | 1 test (runtime set-equality drift check) |
| `packages/preplan/package.json` | **modify** (PS-3) | Add `"test": "node --import tsx --test src/**/*.test.ts"` and `"tsx": "^4.15.7"` devDep (match `packages/registry/package.json` version exactly) |
| `pnpm-lock.yaml` | **modify** (PS-3) | Regenerated by `pnpm install`; delta confined to `importers['packages/preplan']` devDep block; any cross-importer churn is a scope violation (P6-44) |

**No other files may be modified.** The 10 files under `packages/preplan/`
plus `pnpm-lock.yaml` are the complete allowlist. `packages/preplan/src/preplan.types.ts`
is **immutable in this WP** (WP-056 output; no field additions, no signature
changes, no JSDoc edits).

Governance artifacts produced alongside execution (outside the
implementation allowlist but part of the three-commit topology per EC-057):

- `docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md` — **new**, Commit A (01.6 MANDATORY per three triggers)
- `docs/ai/DECISIONS.md` — **modify** if new D-entries are authored (candidates: `D-5701` seedable LCG + `Date.now()` permission; pure-function return-new invariant; reveal-ledger-at-operation-level)
- `docs/ai/DECISIONS_INDEX.md` — **modify** to match any D-entries
- `docs/ai/STATUS.md` — **modify**, Commit B
- `docs/ai/work-packets/WORK_INDEX.md` — **modify**, Commit B (check off WP-057 with date + commit hash)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modify**, Commit A0 (add EC-057 row) + Commit B (flip Draft → Done)

---

## Acceptance Criteria (Binary)

### Sandbox Creation

- [ ] `createPrePlan` returns a valid PrePlan with `status: 'active'`
- [ ] `appliesToTurn` equals `snapshot.currentTurn + 1`
- [ ] Deck is shuffled using client-local PRNG
- [ ] `baseStateFingerprint` is computed deterministically

### Speculative Operations

- [ ] `speculativeDraw` moves top card from deck to hand
- [ ] `speculativeDraw` appends RevealRecord to ledger
- [ ] `speculativePlay` moves card from hand to inPlay
- [ ] `updateSpeculativeCounter` tracks counter deltas
- [ ] `speculativeSharedDraw` records source correctly in ledger
- [ ] **All five operations return `null` when `status !== 'active'`** (uniform convention locked by EC-057 RS-8)
- [ ] No operation mutates input (returns new PrePlan); `sandboxState` arrays/objects are spread-copied, never aliased (WP-028 precedent)
- [ ] `revision` increments by exactly 1 on each successful mutation; does NOT increment on any null-return path

### Reveal Ledger Integrity

- [ ] Every speculative draw (deck or shared) produces a RevealRecord
- [ ] Reveal indices are monotonically increasing
- [ ] No draw bypasses the ledger

### Architectural Boundary

- [ ] All implementation files live in `packages/preplan/` (plus `pnpm-lock.yaml` for the PS-3 devDep delta; plus governance files outside the implementation allowlist)
- [ ] No `boardgame.io` imports anywhere under `packages/preplan/`
- [ ] No game engine runtime imports (`import type { CardExtId } from '@legendary-arena/game-engine'` is the only permitted engine reference)
- [ ] No `@legendary-arena/registry`, no `pg`, no `apps/**` imports
- [ ] No `Math.random()`, no `ctx.random.*`, no `.reduce()` anywhere in `packages/preplan/`
- [ ] All functions are pure (no I/O, no side effects); `Date.now()` appears only inside `generateSpeculativeSeed` with a `// why:` comment
- [ ] `packages/preplan/src/preplan.types.ts` unchanged (`git diff` empty)

### Tests

- [ ] All tests use `node:test` runner and `.test.ts` extension
- [ ] Each test file wraps its tests in exactly one top-level `describe()` block (suite count increment of +4 is locked; bare `test()` calls are forbidden)
- [ ] PRNG determinism verified (3 tests)
- [ ] Sandbox creation verified, including zero-op plan and aliasing baseline (6 tests)
- [ ] All five speculative operations verified, including uniform null-on-inactive across all five ops × two non-active statuses, revision-increment discipline across all five ops, and 3-operation aliasing proof (13 tests)
- [ ] `PREPLAN_STATUS_VALUES` drift-detection test passes (1 test, PS-2)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r --if-present test` passes; preplan delta `0 / 0 / 0 → 23 / 4 / 0`; engine UNCHANGED at `436 / 109 / 0`; repo-wide `536 → 559`

### Behavioral

- [ ] A complete speculative turn can be planned (create → draw → play →
      update counters → add steps) without touching real game state
- [ ] A zero-op plan (create with no operations) is valid and usable
- [ ] All failure paths return `null`, not throw

---

## Governance (Required)

Add to `DECISIONS.md` (candidates grouped under a new `D-5701` entry, or
split across `D-5701` / `D-5702` / `D-5703` at executor discretion — the
EC fixes one shape before Commit A):

- Speculative PRNG uses a seedable LCG (or equivalent); never
  `ctx.random.*`; acceptable to use `Date.now()` for seed entropy
  because speculative randomness is non-authoritative (DESIGN-PREPLANNING §3)
- All speculative operations are pure functions returning new PrePlan
  objects (no mutation of input; spread/slice/object-literal discipline
  prevents aliasing per WP-028 precedent)
- The reveal ledger is populated by speculative operations, not by
  callers (ledger integrity is enforced at the operation level;
  `revealIndex` is strictly monotonic across all draw kinds)
- Uniform null-on-inactive return convention across all five speculative
  operations (extends WP-057 §C Rules to `updateSpeculativeCounter` /
  `addPlanStep` / `speculativeSharedDraw`)

Update `DECISIONS_INDEX.md` with a row for every new D-entry.

Update `WORK_INDEX.md` to mark WP-057 `[x]` with date + commit hash (Commit B).

Update `STATUS.md` to reflect WP-057 close (Commit B).

Update `EC_INDEX.md`: add EC-057 row at Commit A0, flip Draft → Done at Commit B.

---

## Verification Steps

Boundary greps use escaped regex patterns (WP-031 P6-22 precedent — a bare
`boardgame.io` pattern matches comment prose because `.` is regex-special
and matches "any character"):

```bash
pnpm install                       # regenerate pnpm-lock.yaml devDep delta
pnpm -r build                      # exits 0
pnpm -r --if-present test          # preplan 0/0/0 → 23/4/0; engine 436/109/0 UNCHANGED; repo 536 → 559

# Architectural boundary enforcement (escaped-dot patterns per WP-031 P6-22)
git grep -nE "from ['\"]boardgame\.io" packages/preplan/            # expect: zero hits
git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/ \
  | grep -v "import type"                                           # expect: zero hits
git grep -nE "from ['\"]@legendary-arena/registry" packages/preplan/ # expect: zero hits
git grep -nE "from ['\"]pg" packages/preplan/                       # expect: zero hits
git grep -nE "from ['\"]apps/" packages/preplan/                    # expect: zero hits
git grep -nE "Math\.random"  packages/preplan/                      # expect: zero hits
git grep -nE "ctx\.random"   packages/preplan/                      # expect: zero hits
git grep -nE "Date\.now"     packages/preplan/src/                  # expect: exactly one hit (speculativePrng.ts generateSpeculativeSeed only — per DESIGN-PREPLANNING §3 non-authoritative carve-out)
git grep -nE "require\("     packages/preplan/                      # expect: zero hits (ESM only)
git grep -nE "\.reduce\("    packages/preplan/                      # expect: zero hits

# P6-50 paraphrase discipline (new preplan code must not name engine runtime concepts)
git grep -nE "\b(LegendaryGameState|LegendaryGame|boardgame\.io)\b" packages/preplan/src/ # expect: zero hits
git grep -nE "\bG\b"   packages/preplan/src/                        # expect: zero hits
git grep -nE "\bctx\b" packages/preplan/src/                        # expect: only `ctx.turn + 1` invariant references (inherited WP-056 carve-out)

# Immutability check
git diff packages/preplan/src/preplan.types.ts                      # expect: empty (WP-056 file immutable in this WP)

# Allowlist check
git diff --name-only                                                # expect: exactly the 10 implementation files + pnpm-lock.yaml + governance files; no other paths
```

Expected:

- `pnpm install` regenerates `pnpm-lock.yaml` with delta confined to `importers['packages/preplan']`
- Build exits 0; all 557 tests pass; engine baseline unchanged
- All boundary + paraphrase greps pass
- `preplan.types.ts` unchanged
- Only allowlisted files modified

---

## Definition of Done

This WP is complete when:

- Sandbox creation, speculative operations, PRNG, and `PREPLAN_STATUS_VALUES`
  canonical array (PS-2) are implemented and exported via `index.ts`
- `packages/preplan/package.json` has a `test` script + `tsx` devDep (PS-3);
  `pnpm-lock.yaml` delta is scoped to `importers['packages/preplan']`
- Reveal ledger is populated correctly by all draw operations
  (`revealIndex` strictly monotonic from zero across all draw kinds)
- All five speculative operations (`Draw` / `Play` / `UpdateCounter` /
  `AddPlanStep` / `SharedDraw`) uniformly return `null` when
  `status !== 'active'` (EC-057 RS-8)
- All functions are pure; `sandboxState` arrays/objects are spread-copied
  on every mutation path (no aliasing through returned references)
- `revision` increments by exactly 1 on each successful mutation and does
  NOT increment on any null-return path
- Tests cover creation, all operations, PRNG determinism, ledger integrity,
  uniform null-on-inactive across all five speculative operations,
  revision-increment discipline across all five operations, and
  `PREPLAN_STATUS_VALUES` drift detection (23 tests across 4 `describe`
  blocks; preplan `0 / 0 / 0 → 23 / 4 / 0`; engine UNCHANGED; repo `536 → 559`)
- Architectural boundary + P6-50 paraphrase greps all pass with zero hits
- `packages/preplan/src/preplan.types.ts` unchanged (`git diff` empty)
- Governance updated: 01.6 post-mortem authored (MANDATORY per three triggers);
  any new D-entries present with `DECISIONS_INDEX.md` rows; `STATUS.md` /
  `WORK_INDEX.md` / `EC_INDEX.md` updated at Commit B; Commit A prefix is
  `EC-057:` (not `WP-057:` — P6-36)

---

## Next Natural Packet

**WP-058 — Pre-Plan Disruption Pipeline** (detection → invalidation →
rewind → notification)
