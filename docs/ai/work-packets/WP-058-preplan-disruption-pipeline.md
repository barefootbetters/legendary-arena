# WP-058 — Pre-Plan Disruption Pipeline (Detect → Invalidate → Rewind → Notify)

**Status:** Ready for Implementation (amended 2026-04-20 per pre-flight PS-2/PS-3 + copilot-check HOLD fixes)
**Primary Layer:** Pre-Planning (Non-Authoritative, Per-Client)
**Last Updated:** 2026-04-20
**Dependencies:**

- `docs/ai/DESIGN-PREPLANNING.md` (approved architecture)
- `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` (design constraints)
- **WP-056** — Pre-Planning State Model & Lifecycle
- **WP-057** — Pre-Plan Sandbox Execution
- WP-008B — Core moves implementation (player-affecting effects)

---

## Amendments (2026-04-20)

Applied as part of the pre-flight Commit A0 `SPEC:` bundle. Each amendment is scope-neutral — no new file outside the enlarged allowlist, no new runtime behavior beyond what the pre-flight locked.

- **A-058-01 (PS-2)** — Add `PREPLAN_EFFECT_TYPES` canonical readonly array + drift-detection test. Deferred from WP-056 per `preplan.types.ts:101-106` JSDoc; WP-058 is the first runtime consumer of the `invalidationReason.effectType` closed union. New files: `packages/preplan/src/preplanEffectTypes.ts` + `packages/preplan/src/preplanEffectTypes.test.ts`. Updates: §Scope In section J; §Files Expected to Change; §H exports; §I tests; §Acceptance Criteria.
- **A-058-02 (PS-3)** — Consolidate all four public types in `packages/preplan/src/disruption.types.ts`. Original §E declared `SourceRestoration` in `disruptionPipeline.ts` and §G declared `DisruptionPipelineResult` in `disruptionPipeline.ts`, but §H exported both from `./disruption.types.js` — inconsistent. Resolution: `disruption.types.ts` is the single source of truth for `PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult`; `disruptionPipeline.ts` imports them via `import type`. Updates: §E, §G code skeletons relocated + imports added.
- **A-058-03 (Copilot Issue 2)** — Add `Date.now` grep gate to §Verification Steps (expect exactly one hit at `speculativePrng.ts:79`, the WP-057 carve-out). Prevents accidental propagation of wall-clock reads into WP-058 new files.
- **A-058-04 (Copilot Issue 11)** — Add ledger-sole restoration test: `computeSourceRestoration` reads only from `revealLedger`, never from `sandboxState`. Test constructs a `PrePlan` whose `sandboxState` disagrees with the ledger and asserts restoration follows the ledger. Raises restoration tests 5 → 6 in `disruptionPipeline.test.ts`.
- **A-058-05 (Copilot Issue 15)** — Upgrade JSDoc on `DisruptionPipelineResult.requiresImmediateNotification: true` to explicitly state type-level enforcement rationale (removing the field would delete a type-level Constraint #7 encoding mechanism).

---

## Session Context

WP-056 established the PrePlan state model. WP-057 made pre-planning
functional — players can create sandboxes, draw speculatively, play cards,
and track resources.

However, nothing yet handles what happens when **another player's action
mutates a waiting player's real state**, invalidating their pre-plan.

This packet implements the **full disruption pipeline**: detection,
invalidation, rewind, and notification — as a single cohesive workflow.
These four steps are not separable because:

- Detection without rewind leaves the player on stale state
- Rewind without notification violates Constraint #7
- Notification without rewind violates Constraint #3
- The correctness proof requires the full pipeline

---

## Why This Packet Matters

Without the disruption pipeline:

- Pre-plans silently diverge from real game state
- Players plan on stale hands, leading to confusion at turn start
- Speculative reveals leak information (no reshuffle on disruption)
- The system provides no explanation for why a plan broke

WP-058 closes the loop: disruptions are detected, plans are invalidated
with causal explanations, sandboxes are destroyed, speculative reveals
are restored, and the player can resume planning from a clean state.

---

## Goal

Implement the **complete disruption pipeline** such that:

- Any real game mutation affecting a waiting player is detected
- The affected player's PrePlan transitions from `active` → `invalidated`
- The cause is captured structurally (who, what, which card)
- The sandbox is destroyed and all speculative sources are restored
- A fresh sandbox can be created from the updated real state
- The player receives a causal explanation before resuming planning
- The active player is completely unaffected

---

## Non-Goals (Explicit)

This packet does **NOT**:

- Wire into the UI layer (notification rendering is a UI concern)
- Add hooks into engine move execution (adapters are integration-layer)
- Implement partial plan survival or delta-based patching
- Simulate card effects or rule hooks
- Handle network replication of disruption events

---

## Non-Negotiable Constraints (Enforced)

| # | Constraint | Enforced By |
|---|---|---|
| 3 | Full rewind to clean hand | Sandbox destroyed; ledger consumed for source restore |
| 4 | Per-player detection | Binary detection keyed on `affectedPlayerId` |
| 6 | Active player unburdened | Passive observation; no active-player interaction |
| 7 | Immediate notification | Notification emitted before interaction resumes |
| 9 | No information leakage | Speculative deck re-shuffled; shared sources restored |
| 11 | Understandable failures | Causal metadata captured at every stage |

---

## Architectural Placement

All code lives in `packages/preplan/`. The pipeline observes engine state
changes but never modifies engine state.

```
Engine Move Resolves
    |
    | (state change observable by client)
    v
detectDisruption()         ← identifies affected players
    |
    v
invalidatePrePlan()        ← status: 'active' → 'invalidated' + reason
    |
    v
rewindPrePlan()            ← destroy sandbox, restore sources, reshuffle
    |
    v
DisruptionNotification     ← structured event for UI consumption
    |
    v
createPrePlan()            ← fresh sandbox from updated real state (WP-057)
```

The pipeline is triggered by the integration layer (UI controller or
client middleware) — not by the engine. This WP defines the pipeline
functions; wiring them into the client event loop is a UI concern.

**Multiple mutations per move:** If a single engine move produces
multiple `PlayerAffectingMutation` events for the same waiting player,
the disruption pipeline must be executed **once**, using the first
mutation as the causal explanation. Subsequent mutations for the same
player are ignored because the plan is already invalidated (`status`
is no longer `'active'`, so `isPrePlanDisrupted` returns false).
This is enforced mechanically by the status guard, not by caller logic.

---

## Scope (In)

### A) Player-Affecting Mutation Type

**File:** `packages/preplan/src/disruption.types.ts`

```typescript
import type { CardExtId } from '@legendary-arena/game-engine';

/**
 * Normalized description of a resolved effect that mutated a
 * waiting player's state.
 *
 * Produced by integration-layer adapters over engine state changes.
 * This WP does not define how mutations are captured from the engine;
 * it defines what the pipeline expects to receive.
 */
export type PlayerAffectingMutation = {
  /** Player who caused the effect (the active player). */
  sourcePlayerId: string;

  /** Player whose state was mutated (a waiting player). */
  affectedPlayerId: string;

  /**
   * Machine-stable category of the effect.
   * Enables testing, analytics, and automation without parsing text.
   */
  effectType: 'discard' | 'ko' | 'gain' | 'other';

  /**
   * Human-readable summary of the effect.
   * e.g., "Mastermind tactic forced discard of a non-grey hero"
   */
  effectDescription: string;

  /** Card involved in the effect, if applicable. */
  affectedCardExtId?: CardExtId;
};
```

---

### B) Disruption Notification Type

**File:** `packages/preplan/src/disruption.types.ts` (same file)

```typescript
/**
 * Structured notification emitted when a PrePlan is disrupted.
 *
 * Contains all information needed for the UI to explain what
 * happened to the player. The UI decides how to render this
 * (modal, toast, inline message, etc.).
 */
export type DisruptionNotification = {
  /** The pre-plan that was invalidated. */
  prePlanId: string;

  /** The player who was disrupted. */
  affectedPlayerId: string;

  /** The player whose action caused the disruption. */
  sourcePlayerId: string;

  /**
   * Human-readable explanation suitable for display.
   * e.g., "Player A's Mastermind tactic forced you to discard
   * Iron Man from your hand."
   *
   * Derived from PlayerAffectingMutation.effectDescription.
   * effectDescription is the canonical source of truth;
   * message is a formatted rendering that may change style.
   */
  message: string;

  /** Card involved, if applicable (for UI highlighting). */
  affectedCardExtId?: CardExtId;
};
```

---

### B.1) Source Restoration Type (PS-3 consolidation)

**File:** `packages/preplan/src/disruption.types.ts` (same file)

Imported by `disruptionPipeline.ts` via `import type { SourceRestoration } from './disruption.types.js';`

```typescript
/**
 * Description of sources that must be restored after a rewind.
 *
 * The caller (integration layer) is responsible for applying these
 * restorations to whatever state tracking exists outside the sandbox.
 * This WP produces the restoration instructions; it does not execute
 * them against engine state.
 *
 * Restoration semantics:
 *
 * - playerDeckReturns MUST be re-shuffled before any further sandbox
 *   use (new PRNG seed). Returning cards without reshuffling leaks
 *   information about deck order.
 * - sharedSourceReturns restore membership only; ordering is defined
 *   by the shared source's own rules:
 *     - Stacks (officers, sidekicks): ordering is irrelevant (top card
 *       is the only visible position, and it's determined by the real
 *       game state, not by the sandbox)
 *     - HQ-style sources: positioning is integration-layer policy
 *
 * This pipeline does not assume ordering semantics for shared sources.
 */
export type SourceRestoration = {
  /** Cards to return to the player's deck (must be re-shuffled). */
  playerDeckReturns: CardExtId[];

  /**
   * Cards to return to shared sources, grouped by source name.
   * e.g., { 'officer-stack': ['card-1'], 'sidekick-stack': ['card-2'] }
   */
  sharedSourceReturns: Record<string, CardExtId[]>;
};
```

---

### B.2) Disruption Pipeline Result Type (PS-3 consolidation)

**File:** `packages/preplan/src/disruption.types.ts` (same file)

Imported by `disruptionPipeline.ts` via `import type { DisruptionPipelineResult } from './disruption.types.js';`

```typescript
import type { PrePlan } from './preplan.types.js';

/**
 * Result of running the full disruption pipeline.
 *
 * Contains the invalidated plan, source restoration instructions,
 * and a notification for the UI. The caller is responsible for:
 * 1. Applying source restorations
 * 2. Delivering the notification (before allowing further planning)
 * 3. Optionally creating a fresh sandbox via createPrePlan (WP-057)
 */
export type DisruptionPipelineResult = {
  /** The PrePlan after invalidation (status: 'invalidated'). */
  invalidatedPlan: PrePlan;

  /** Instructions for restoring speculatively revealed sources. */
  sourceRestoration: SourceRestoration;

  /** Structured notification for the player. */
  notification: DisruptionNotification;

  /**
   * Type-level encoding of Constraint #7 (immediate notification).
   *
   * The literal-true type (not `boolean`) is intentional: the caller
   * MUST deliver the notification before allowing any further
   * pre-planning interaction. Callers check this field to confirm
   * they are handling the notification requirement.
   *
   * Removing this field would delete a type-level enforcement
   * mechanism for Constraint #7 — the notification requirement
   * would then live only in prose. Do not "clean up" this field
   * as redundant data. (WP-058 amendment A-058-05 per copilot
   * Issue 15 lock.)
   */
  requiresImmediateNotification: true;
};
```

---

### C) Disruption Detection

**File:** `packages/preplan/src/disruptionDetection.ts`

```typescript
import type { PrePlan } from './preplan.types.js';
import type { PlayerAffectingMutation } from './disruption.types.js';

/**
 * Determine whether a mutation disrupts a given pre-plan.
 *
 * Detection is binary per-player: if the mutation's affectedPlayerId
 * matches the plan's playerId, the plan is disrupted. No plan-step
 * inspection or sandbox inspection is performed.
 *
 * Pure function: no I/O, no side effects.
 *
 * @returns true if the mutation disrupts the pre-plan, false otherwise
 */
export function isPrePlanDisrupted(
  prePlan: PrePlan | null,
  mutation: PlayerAffectingMutation,
): boolean {
  if (!prePlan) return false;
  if (prePlan.status !== 'active') return false;
  return prePlan.playerId === mutation.affectedPlayerId;
}
```

**Rules:**

- Binary per-player detection only (Constraint #4)
- No plan-step inspection, no sandbox inspection
- Returns a boolean; does not mutate anything
- Deterministic: same inputs → same result

---

### D) Pre-Plan Invalidation

**File:** `packages/preplan/src/disruptionPipeline.ts`

```typescript
import type { PrePlan } from './preplan.types.js';
import type {
  PlayerAffectingMutation,
  DisruptionNotification,
} from './disruption.types.js';

/**
 * Invalidate a pre-plan due to an external disruption.
 *
 * Transitions the PrePlan from 'active' → 'invalidated' and
 * attaches the causal reason. Returns null if the plan is not
 * active (already invalidated or consumed).
 *
 * Pure function: returns a new PrePlan, does not mutate the input.
 */
export function invalidatePrePlan(
  prePlan: PrePlan,
  mutation: PlayerAffectingMutation,
): PrePlan | null {
  if (prePlan.status !== 'active') return null;

  return {
    ...prePlan,
    status: 'invalidated',
    invalidationReason: {
      sourcePlayerId: mutation.sourcePlayerId,
      effectType: mutation.effectType,
      effectDescription: mutation.effectDescription,
      affectedCardExtId: mutation.affectedCardExtId,
    },
  };
}
```

---

### E) Source Restoration (Rewind)

**File:** `packages/preplan/src/disruptionPipeline.ts` (same file)

`SourceRestoration` is declared in `disruption.types.ts` (see §B.1) per PS-3 consolidation and imported here via `import type`. `disruptionPipeline.ts` contains only the `computeSourceRestoration` implementation — no type declarations.

```typescript
import type { RevealRecord } from './preplan.types.js';
import type { SourceRestoration } from './disruption.types.js';
import type { CardExtId } from '@legendary-arena/game-engine';

/**
 * Compute source restoration instructions from a reveal ledger.
 *
 * Consumes the ledger to determine exactly which cards were
 * speculatively revealed and from which sources. The caller
 * must re-shuffle the player's deck after applying returns.
 *
 * INVARIANT (DESIGN-CONSTRAINT #3, preplan.types.ts:162-168): All
 * rewinds are derived exclusively from the revealLedger. This function
 * must not inspect any other PrePlan field — no sandboxState read path
 * exists here, by construction. A future refactor that reads
 * sandboxState for restoration would violate the ledger-sole
 * rewind-authority invariant.
 *
 * Pure function: no I/O, no side effects.
 */
export function computeSourceRestoration(
  revealLedger: readonly RevealRecord[],
): SourceRestoration {
  const playerDeckReturns: CardExtId[] = [];
  const sharedSourceReturns: Record<string, CardExtId[]> = {};

  for (const record of revealLedger) {
    if (record.source === 'player-deck') {
      playerDeckReturns.push(record.cardExtId);
    } else {
      if (!sharedSourceReturns[record.source]) {
        sharedSourceReturns[record.source] = [];
      }
      sharedSourceReturns[record.source].push(record.cardExtId);
    }
  }

  return { playerDeckReturns, sharedSourceReturns };
}
```

**Rules:**

- Restoration instructions are computed, not executed — the pipeline
  does not write to engine state
- Ledger is the sole input (enforces WP-056 invariant)
- Player deck returns must be re-shuffled by the caller (new PRNG seed)
- Shared source returns restore membership only; ordering semantics
  are defined per source type (see `SourceRestoration` JSDoc)
- **Terminal state invariant:** Once a PrePlan transitions to
  `'invalidated'`, it must never be passed to speculative operations
  (WP-057) again. Any attempt to do so is a programmer error.
  The invalidated plan exists only to carry causal metadata for
  notification construction.

---

### F) Notification Construction

**File:** `packages/preplan/src/disruptionPipeline.ts` (same file)

```typescript
/**
 * Construct a disruption notification from an invalidated PrePlan
 * and the mutation that caused it.
 *
 * Returns a structured notification suitable for UI consumption.
 * The UI decides rendering (modal, toast, inline, etc.).
 */
export function buildDisruptionNotification(
  invalidatedPlan: PrePlan,
  mutation: PlayerAffectingMutation,
): DisruptionNotification {
  if (invalidatedPlan.status !== 'invalidated') {
    throw new Error(
      `Cannot build notification for PrePlan ${invalidatedPlan.prePlanId}: ` +
      `status is '${invalidatedPlan.status}', expected 'invalidated'.`
    );
  }

  return {
    prePlanId: invalidatedPlan.prePlanId,
    affectedPlayerId: invalidatedPlan.playerId,
    sourcePlayerId: mutation.sourcePlayerId,
    message: buildNotificationMessage(mutation),
    affectedCardExtId: mutation.affectedCardExtId,
  };
}

/**
 * Build a human-readable notification message from a mutation.
 *
 * Format: "Player {source}'s {effect}."
 * If a card is involved: "Player {source}'s {effect} ({card})."
 */
function buildNotificationMessage(
  mutation: PlayerAffectingMutation,
): string {
  const base = `Player ${mutation.sourcePlayerId}'s ${mutation.effectDescription}`;
  if (mutation.affectedCardExtId) {
    return `${base} (${mutation.affectedCardExtId}).`;
  }
  return `${base}.`;
}
```

---

### G) Full Pipeline Orchestration

**File:** `packages/preplan/src/disruptionPipeline.ts` (same file)

`DisruptionPipelineResult` is declared in `disruption.types.ts` (see §B.2) per PS-3 consolidation and imported here via `import type`. `disruptionPipeline.ts` contains only the `executeDisruptionPipeline` implementation — no result-type declaration.

```typescript
import type { DisruptionPipelineResult } from './disruption.types.js';

/**
 * Execute the full disruption pipeline for a single pre-plan.
 *
 * Steps:
 * 1. Invalidate the PrePlan (active → invalidated)
 * 2. Compute source restoration from the reveal ledger
 * 3. Build a causal notification
 *
 * Returns null if the plan is not active (no disruption needed).
 *
 * Pure function: returns a result object, does not apply any
 * changes. The caller is responsible for acting on the result.
 *
 * The caller MUST deliver the notification BEFORE allowing
 * further planning interaction (Constraint #7). This requirement
 * is also encoded at the type level via
 * `DisruptionPipelineResult.requiresImmediateNotification: true`.
 */
export function executeDisruptionPipeline(
  prePlan: PrePlan,
  mutation: PlayerAffectingMutation,
): DisruptionPipelineResult | null {
  const invalidatedPlan = invalidatePrePlan(prePlan, mutation);
  if (!invalidatedPlan) return null;

  // why: invalidation does not mutate the ledger; reading from the
  // pre-invalidation plan is equivalent to reading from invalidatedPlan
  // and avoids depending on invalidatePrePlan's spread-copy semantics
  // (pre-flight RS-8).
  const sourceRestoration = computeSourceRestoration(prePlan.revealLedger);
  const notification = buildDisruptionNotification(invalidatedPlan, mutation);

  return {
    invalidatedPlan,
    sourceRestoration,
    notification,
    requiresImmediateNotification: true,
  };
}
```

---

### H) Canonical Effect-Type Array + Drift Check (PS-2)

**File:** `packages/preplan/src/preplanEffectTypes.ts` (new)

Canonical readonly array paired with the `invalidationReason.effectType` closed union declared at `packages/preplan/src/preplan.types.ts:108`. Deferred from WP-056 per the JSDoc at `preplan.types.ts:101-106`; WP-058 is the first runtime consumer of the `effectType` union and owns this file.

```typescript
import type { PrePlan } from './preplan.types.js';

/**
 * Canonical readonly array of every value in
 * `PrePlan.invalidationReason.effectType`.
 *
 * Paired with the closed-union type on `invalidationReason.effectType`
 * and validated by both a compile-time exhaustive check in this file
 * and a runtime drift test in `preplanEffectTypes.test.ts`. Any edit
 * to the union must be accompanied by a matching edit to this array,
 * and vice versa.
 */
// why: canonical readonly array paired with
// PrePlan.invalidationReason.effectType closed union; drift-detection
// test enforces parity at build time (deferred from WP-056 per
// preplan.types.ts:101-106 JSDoc — WP-058 is the first runtime
// consumer of the effectType union).
export const PREPLAN_EFFECT_TYPES = ['discard', 'ko', 'gain', 'other'] as const;

/** Derived union type matching `invalidationReason.effectType` exactly. */
export type PrePlanEffectType = typeof PREPLAN_EFFECT_TYPES[number];

/**
 * Compile-time proof that `PREPLAN_EFFECT_TYPES` and
 * `invalidationReason.effectType` describe the same set. `NonNullable<>`
 * is required because `invalidationReason` itself is optional on
 * `PrePlan`. If either side gains or drops a value without the other,
 * this assignment will fail to typecheck.
 */
type _EffectTypeDriftCheck = PrePlanEffectType extends
  NonNullable<PrePlan['invalidationReason']>['effectType']
  ? NonNullable<PrePlan['invalidationReason']>['effectType'] extends PrePlanEffectType
    ? true
    : never
  : never;
const _effectTypeDriftProof: _EffectTypeDriftCheck = true;
void _effectTypeDriftProof;
```

---

### I) Updated Package Exports

**File:** `packages/preplan/src/index.ts` (modify)

Add to existing exports (preserves WP-056 and WP-057 blocks unchanged):

```typescript
// Disruption types (WP-058)
export type {
  PlayerAffectingMutation,
  DisruptionNotification,
  SourceRestoration,
  DisruptionPipelineResult,
} from './disruption.types.js';

// Disruption detection (WP-058)
export { isPrePlanDisrupted } from './disruptionDetection.js';

// Disruption pipeline (WP-058)
export {
  invalidatePrePlan,
  computeSourceRestoration,
  buildDisruptionNotification,
  executeDisruptionPipeline,
} from './disruptionPipeline.js';

// Canonical effect-type array + derived type (WP-058, PS-2)
export { PREPLAN_EFFECT_TYPES } from './preplanEffectTypes.js';
export type { PrePlanEffectType } from './preplanEffectTypes.js';
```

---

### J) Tests

**File:** `packages/preplan/src/disruptionDetection.test.ts`
**File:** `packages/preplan/src/disruptionPipeline.test.ts`
**File:** `packages/preplan/src/preplanEffectTypes.test.ts` (PS-2)

Test runner: `node:test`. File extension: `.test.ts`. Each file wraps its tests in exactly one top-level `describe()` block (WP-031 / WP-057 suite-wrapping convention).

Required test coverage:

**Detection tests** (in `describe('preplan disruption detection (WP-058)')`):
- Mutation affecting plan owner returns true
- Mutation affecting a different player returns false
- Null plan returns false
- Already-invalidated plan returns false
- Already-consumed plan returns false

**Invalidation tests** (in `describe('preplan disruption pipeline (WP-058)')`):
- Active plan transitions to `'invalidated'`
- `invalidationReason` is populated with correct source and description
- Non-active plan returns null
- Input plan is not mutated (returns new object) — assert `revision`
  stays unchanged (status + `invalidationReason` are not
  revision-bumping fields per `preplan.types.ts:36-38`)

**Source restoration tests** (in the same pipeline describe):
- Empty ledger produces empty restoration
- Player-deck reveals produce `playerDeckReturns`
- Shared-source reveals produce grouped `sharedSourceReturns`
- Mixed sources are correctly separated
- Reveal order is preserved within each source group
- **Ledger-sole rewind (amendment A-058-04 per copilot Issue 11):**
  construct a `PrePlan` whose `sandboxState.hand` / `deck` / `discard`
  / `inPlay` contain cards that are NOT in the `revealLedger`, and
  whose `revealLedger` contains cards NOT in the sandbox. Assert
  `computeSourceRestoration` returns exactly the ledger-derived cards
  and ignores the sandbox entirely. Enforces DESIGN-CONSTRAINT #3 at
  the test level — a future refactor that reads `sandboxState` for
  restoration would fail this test.

**Notification tests** (in the same pipeline describe):
- Notification includes correct `prePlanId` and player IDs
- Message includes effect description
- Message includes card when `affectedCardExtId` is present
- Message omits card when `affectedCardExtId` is absent
- Throws on non-invalidated plan

**Full pipeline tests** (in the same pipeline describe):
- Active plan + matching mutation → full result with all four fields,
  including `requiresImmediateNotification: true`
- Active plan + non-matching mutation → null (detection rejects)
- Non-active plan → null
- Multiple mutations for same player: first produces result, second
  returns null (plan already invalidated by status guard)
- Result's `invalidatedPlan` has `status: 'invalidated'`
- Result's `sourceRestoration` matches the plan's `revealLedger`
- Result's `notification` includes causal message

**Acceptance scenario** (integration test, in the same pipeline describe):
- Create a PrePlan (WP-057's `createPrePlan`)
- Perform speculative draws and plays (WP-057's operations)
- Execute disruption pipeline with a mutation
- Verify: plan is invalidated, restoration lists correct cards,
  notification explains the cause, `requiresImmediateNotification` is `true`
- Verify: creating a fresh PrePlan from updated state succeeds

**Effect-type drift test** (in `describe('preplan effect-type drift (WP-058)')`):
- Runtime set-equality between `new Set(PREPLAN_EFFECT_TYPES)` and a
  literal reference set `new Set<PrePlanEffectType>(['discard', 'ko',
  'gain', 'other'])`. Paired with the compile-time exhaustive check
  in `preplanEffectTypes.ts` (amendment A-058-01 per PS-2).

**Test count lock:** 5 detection + 4 invalidation + 6 restoration + 5 notification + 7 full pipeline + 1 acceptance + 1 drift = **29 tests** across **3 new suites** (`disruptionDetection.test.ts` / `disruptionPipeline.test.ts` / `preplanEffectTypes.test.ts`). Preplan baseline shifts `23 / 4 / 0 → 52 / 7 / 0`; repo-wide `559 → 588`. Executor may parameterize within a single `test()` call (per WP-057 Test 12/13 precedent) but may not reduce the suite count below 3.

---

## Scope (Out)

- Engine move adapters (producing `PlayerAffectingMutation` from real
  engine events is an integration-layer concern)
- UI notification rendering
- Network replication of disruption events
- Partial plan survival or delta-based patching
- Automatic sandbox recreation (caller invokes `createPrePlan` from WP-057)
- Applying source restorations to real state (caller responsibility)

---

## Files Expected to Change

| File | Action | Notes |
|---|---|---|
| `packages/preplan/src/disruption.types.ts` | **new** | Four public types consolidated here per PS-3: `PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult` |
| `packages/preplan/src/disruptionDetection.ts` | **new** | `isPrePlanDisrupted` only |
| `packages/preplan/src/disruptionPipeline.ts` | **new** | `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, internal `buildNotificationMessage`, `executeDisruptionPipeline`. Types imported from `disruption.types.ts` |
| `packages/preplan/src/preplanEffectTypes.ts` | **new** (PS-2) | `PREPLAN_EFFECT_TYPES` readonly array + `PrePlanEffectType` + compile-time drift check using `NonNullable<>` |
| `packages/preplan/src/index.ts` | **modify** | Add WP-058 additive export block (§I); WP-056 + WP-057 blocks unchanged |
| `packages/preplan/src/disruptionDetection.test.ts` | **new** | 5 detection tests in one `describe` block |
| `packages/preplan/src/disruptionPipeline.test.ts` | **new** | 23 tests in one `describe` block (invalidation 4 + restoration 6 + notification 5 + full pipeline 7 + acceptance 1) |
| `packages/preplan/src/preplanEffectTypes.test.ts` | **new** (PS-2) | 1 test in one `describe` block (runtime set-equality) |

No other files may be modified. `packages/preplan/package.json` and `pnpm-lock.yaml` are **not** in the allowlist — `tsx` devDep and the `test` script are inherited from WP-057.

---

## Acceptance Criteria (Binary)

### Detection

- [ ] Mutation affecting plan owner is detected
- [ ] Mutation affecting other players is not detected
- [ ] Non-active plans are never disrupted
- [ ] Detection is binary per-player (no plan-step inspection)

### Invalidation

- [ ] Active plan transitions to `'invalidated'` with reason populated
- [ ] `invalidationReason.sourcePlayerId` is the player who caused the effect
- [ ] `invalidationReason.effectType` is a machine-stable discriminator
- [ ] `invalidationReason.effectDescription` describes what happened
- [ ] `invalidationReason.affectedCardExtId` is set when a card is involved
- [ ] Input plan is not mutated (pure function)

### Source Restoration

- [ ] `computeSourceRestoration` derives returns from ledger only
- [ ] Player-deck reveals and shared-source reveals are correctly separated
- [ ] Empty ledger produces empty restoration
- [ ] **Ledger-sole rewind (amendment A-058-04):** `computeSourceRestoration`
      ignores `sandboxState` entirely — verified by a test where the sandbox
      contains cards not in the ledger and vice versa

### Notification

- [ ] `DisruptionNotification.message` includes cause and effect
- [ ] Card identity included when applicable
- [ ] Notification built only from invalidated plans (throws otherwise)

### Full Pipeline

- [ ] `executeDisruptionPipeline` returns all four outputs on match (including `requiresImmediateNotification: true`)
- [ ] Returns null when plan is not active or player is not affected
- [ ] Multiple mutations for same player: only first produces a result, subsequent return null (status guard)
- [ ] Acceptance scenario passes (create → plan → disrupt → verify)

### Architectural Boundary

- [ ] All files live in `packages/preplan/`
- [ ] No `boardgame.io` imports
- [ ] No game engine runtime imports (type-only permitted)
- [ ] All functions are pure (no I/O, no side effects, no real state mutation)

### Canonical Effect-Type Array (PS-2)

- [ ] `PREPLAN_EFFECT_TYPES` exported as a readonly tuple matching
      `invalidationReason.effectType` exactly
- [ ] `PrePlanEffectType` derived type exported
- [ ] Compile-time drift check present in `preplanEffectTypes.ts` using
      `NonNullable<PrePlan['invalidationReason']>['effectType']`
- [ ] Runtime drift test present in `preplanEffectTypes.test.ts`

### Tests

- [ ] All tests use `node:test` runner and `.test.ts` extension
- [ ] Each test file wraps its tests in exactly one top-level `describe()`
      block (WP-031 / WP-057 suite convention)
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` passes with preplan delta `23 / 4 / 0 → 52 / 7 / 0`
      and repo-wide `559 → 588`; engine baseline `436 / 109 / 0`
      unchanged

---

## Governance (Required)

Add to `DECISIONS.md`:

- Disruption detection is binary per-player; no plan-step or sandbox
  inspection (Constraint #4)
- The disruption pipeline is a single cohesive workflow: detect →
  invalidate → compute restoration → build notification. These steps
  are not separable into independent WPs because correctness requires
  the full chain.
- Source restoration is computed from the reveal ledger exclusively
  (WP-056 ledger authority invariant)
- The pipeline produces instructions and events; it does not apply
  restorations or deliver notifications. The caller (integration/UI
  layer) is responsible for acting on the results.
- `PlayerAffectingMutation` is produced by integration-layer adapters,
  not by the engine. Engine moves are not modified by this WP.

Update `WORK_INDEX.md` to add WP-058.

---

## Verification Steps

```bash
pnpm -r build
pnpm -r --if-present test

# Architectural boundary enforcement (escaped patterns per WP-031 P6-22)
git grep -nE "from ['\"]boardgame\.io" packages/preplan/
git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/ | grep -v "import type"
git grep -nE "from ['\"]@legendary-arena/registry" packages/preplan/
git grep -nE "from ['\"]pg" packages/preplan/
git grep -nE "from ['\"]apps/" packages/preplan/

# Determinism enforcement
git grep -nE "Math\.random" packages/preplan/
git grep -nE "ctx\.random" packages/preplan/
git grep -nE "\.reduce\(" packages/preplan/
git grep -nE "require\(" packages/preplan/

# Date.now carve-out (amendment A-058-03 per copilot Issue 2): exactly
# one hit at speculativePrng.ts:79 (WP-057 generateSpeculativeSeed). Any
# additional hit is an unauthorized wall-clock read introduced by WP-058.
git grep -nE "Date\.now" packages/preplan/src/

# P6-50 paraphrase discipline (JSDoc + code): engine runtime tokens
# forbidden in new WP-058 files. ctx.turn + 1 at preplan.types.ts:21,:51
# is the inherited WP-056 carve-out.
git grep -nE "\\b(LegendaryGameState|LegendaryGame)\\b" packages/preplan/src/
git grep -nE "\\bG\\b" packages/preplan/src/
git grep -nE "\\bctx\\b" packages/preplan/src/

git diff --name-only
```

Expected:

- Build exits 0
- All tests pass; preplan delta `23 / 4 / 0 → 52 / 7 / 0`; engine
  unchanged at `436 / 109 / 0`; repo-wide `559 → 588`
- `boardgame.io`, registry, `pg`, `apps/` import greps return zero hits
- Runtime engine import grep returns zero hits (only `import type` lines
  in WP-058 new files)
- `Math.random`, `ctx.random`, `.reduce(`, `require(` greps return zero
  hits in `packages/preplan/`
- `Date.now` grep returns exactly one hit at
  `packages/preplan/src/speculativePrng.ts:79` — any additional hit is
  a scope violation
- `LegendaryGameState` / `LegendaryGame` / `G` / `ctx` greps return zero
  hits in new WP-058 files (the `ctx.turn + 1` carve-out at
  `preplan.types.ts:21,:51` is pre-existing and not in the WP-058 new-file
  set)
- `git diff --name-only` matches the 8-file allowlist +
  `docs/ai/DECISIONS.md` / `DECISIONS_INDEX.md` (if D-entries authored) +
  01.6 post-mortem; no `package.json` or `pnpm-lock.yaml` delta

---

## Definition of Done

This WP is complete when:

- Detection, invalidation, source restoration, and notification
  construction are implemented and exported
- Full pipeline orchestration function exists and is tested
- Acceptance scenario test passes (create → plan → disrupt → verify)
- All functions are pure and return new objects (no mutation)
- Architectural boundary checks pass
- Governance updated (DECISIONS.md, WORK_INDEX.md)

---

## Next Natural Packet

**WP-059 — Pre-Plan UI Integration** — wiring the pre-planning system
into the client layer (sandbox rendering, disruption notification
delivery, turn-start consumption).
