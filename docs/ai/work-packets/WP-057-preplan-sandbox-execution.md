# WP-057 — Pre-Plan Sandbox Execution (Speculative Planning Logic)

**Status:** Ready for Implementation
**Primary Layer:** Pre-Planning (Non-Authoritative, Per-Client)
**Last Updated:** 2026-04-12
**Dependencies:**

- `docs/ai/DESIGN-PREPLANNING.md` (approved architecture)
- `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` (design constraints)
- **WP-056** — Pre-Planning State Model & Lifecycle
- WP-006A — Player zones & hand/deck/discard model
- WP-008B — Core moves implementation (move names, counter patterns)

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

**File:** `packages/preplan/src/index.ts` (modify)

```typescript
// Types (WP-056)
export type {
  PrePlan,
  PrePlanSandboxState,
  RevealRecord,
  PrePlanStep,
} from './preplan.types.js';

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

### E) Tests

**File:** `packages/preplan/src/preplanSandbox.test.ts`
**File:** `packages/preplan/src/speculativeOperations.test.ts`
**File:** `packages/preplan/src/speculativePrng.test.ts`

Test runner: `node:test`. File extension: `.test.ts`.

Required test coverage:

**PRNG tests:**
- Same seed produces same shuffle order
- Different seeds produce different shuffle orders
- Shuffle does not mutate input array

**Sandbox creation tests:**
- `createPrePlan` returns `status: 'active'` with `revision: 1`, empty ledger and steps
- `appliesToTurn` equals `snapshot.currentTurn + 1`
- Deck is shuffled (not identical to input order — use seeded PRNG
  for deterministic assertion)
- Fingerprint is deterministic (same snapshot → same fingerprint)
- Fingerprint changes when hand contents differ

**Speculative operation tests:**
- `speculativeDraw` moves top card from deck to hand
- `speculativeDraw` appends to revealLedger with source `'player-deck'`
- `speculativeDraw` returns null when deck is empty
- `speculativeDraw` returns null when status is not `'active'`
- `speculativePlay` moves card from hand to inPlay
- `speculativePlay` returns null when card is not in hand
- `updateSpeculativeCounter` adds delta to named counter
- `updateSpeculativeCounter` creates counter if missing
- `addPlanStep` appends step with `isValid: true`
- `speculativeSharedDraw` adds card to hand and records source in ledger
- No operation mutates the input PrePlan (returns new object)
- Zero-op plan is valid: `createPrePlan` followed by no operations
  produces a usable PrePlan with empty ledger and steps

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

| File | Action |
|---|---|
| `packages/preplan/src/speculativePrng.ts` | **new** |
| `packages/preplan/src/preplanSandbox.ts` | **new** |
| `packages/preplan/src/speculativeOperations.ts` | **new** |
| `packages/preplan/src/index.ts` | **modify** (add exports) |
| `packages/preplan/src/speculativePrng.test.ts` | **new** |
| `packages/preplan/src/preplanSandbox.test.ts` | **new** |
| `packages/preplan/src/speculativeOperations.test.ts` | **new** |

No other files may be modified.

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
- [ ] All operations guard on `status === 'active'`
- [ ] No operation mutates input (returns new PrePlan)

### Reveal Ledger Integrity

- [ ] Every speculative draw (deck or shared) produces a RevealRecord
- [ ] Reveal indices are monotonically increasing
- [ ] No draw bypasses the ledger

### Architectural Boundary

- [ ] All files live in `packages/preplan/`
- [ ] No `boardgame.io` imports
- [ ] No game engine runtime imports (type-only permitted)
- [ ] All functions are pure (no I/O, no side effects)

### Tests

- [ ] All tests use `node:test` runner and `.test.ts` extension
- [ ] PRNG determinism verified
- [ ] Sandbox creation verified
- [ ] All speculative operations verified
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` passes

### Behavioral

- [ ] A complete speculative turn can be planned (create → draw → play →
      update counters → add steps) without touching real game state
- [ ] A zero-op plan (create with no operations) is valid and usable
- [ ] All failure paths return `null`, not throw

---

## Governance (Required)

Add to `DECISIONS.md`:

- Speculative PRNG uses a seedable LCG (or equivalent); never
  `ctx.random.*`; acceptable to use `Date.now()` for seed entropy
  because speculative randomness is non-authoritative
- All speculative operations are pure functions returning new PrePlan
  objects (no mutation)
- The reveal ledger is populated by speculative operations, not by
  callers (ledger integrity is enforced at the operation level)

Update `WORK_INDEX.md` to add WP-057.

---

## Verification Steps

```bash
pnpm -r build
pnpm test

# Architectural boundary enforcement
grep -r "boardgame.io" packages/preplan/ && echo "FAIL: boardgame.io import found" || echo "PASS"
grep -r "from '@legendary-arena/game-engine'" packages/preplan/src/ --include="*.ts" | grep -v "import type" && echo "FAIL: runtime engine import found" || echo "PASS"

git diff --name-only
```

Expected:

- Build exits 0
- All tests pass
- Both boundary checks pass
- Only listed files modified

---

## Definition of Done

This WP is complete when:

- Sandbox creation, speculative operations, and PRNG are implemented
  and exported
- Reveal ledger is populated correctly by all draw operations
- All functions are pure and guard on `status === 'active'`
- Tests cover creation, all operations, PRNG determinism, and ledger
  integrity
- Architectural boundary checks pass
- Governance updated (DECISIONS.md, WORK_INDEX.md)

---

## Next Natural Packet

**WP-058 — Pre-Plan Disruption Pipeline** (detection → invalidation →
rewind → notification)
