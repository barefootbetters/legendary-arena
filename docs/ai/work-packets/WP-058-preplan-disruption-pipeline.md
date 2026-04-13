# WP-058 — Pre-Plan Disruption Pipeline (Detect → Invalidate → Rewind → Notify)

**Status:** Ready for Implementation
**Primary Layer:** Pre-Planning (Non-Authoritative, Per-Client)
**Last Updated:** 2026-04-12
**Dependencies:**

- `docs/ai/DESIGN-PREPLANNING.md` (approved architecture)
- `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` (design constraints)
- **WP-056** — Pre-Planning State Model & Lifecycle
- **WP-057** — Pre-Plan Sandbox Execution
- WP-008B — Core moves implementation (player-affecting effects)

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

```typescript
import type { RevealRecord } from './preplan.types.js';
import type { CardExtId } from '@legendary-arena/game-engine';

/**
 * Description of sources that must be restored after a rewind.
 *
 * The caller (integration layer) is responsible for applying these
 * restorations to whatever state tracking exists outside the sandbox.
 * This WP produces the restoration instructions; it does not execute
 * them against engine state.
 */
/**
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

/**
 * Compute source restoration instructions from a reveal ledger.
 *
 * Consumes the ledger to determine exactly which cards were
 * speculatively revealed and from which sources. The caller
 * must re-shuffle the player's deck after applying returns.
 *
 * INVARIANT: All rewinds are derived exclusively from the
 * revealLedger (WP-056 ledger authority invariant).
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

```typescript
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
   * Data-level contract: the caller MUST deliver the notification
   * before allowing any further pre-planning interaction.
   *
   * This field exists to encode Constraint #7 in the type system
   * rather than relying on prose alone. Callers should check this
   * field to confirm they are handling the notification requirement.
   */
  requiresImmediateNotification: true;
};

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
 * further planning interaction (Constraint #7).
 */
export function executeDisruptionPipeline(
  prePlan: PrePlan,
  mutation: PlayerAffectingMutation,
): DisruptionPipelineResult | null {
  const invalidatedPlan = invalidatePrePlan(prePlan, mutation);
  if (!invalidatedPlan) return null;

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

### H) Updated Package Exports

**File:** `packages/preplan/src/index.ts` (modify)

Add to existing exports:

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
```

---

### I) Tests

**File:** `packages/preplan/src/disruptionDetection.test.ts`
**File:** `packages/preplan/src/disruptionPipeline.test.ts`

Test runner: `node:test`. File extension: `.test.ts`.

Required test coverage:

**Detection tests:**
- Mutation affecting plan owner returns true
- Mutation affecting a different player returns false
- Null plan returns false
- Already-invalidated plan returns false
- Already-consumed plan returns false

**Invalidation tests:**
- Active plan transitions to `'invalidated'`
- `invalidationReason` is populated with correct source and description
- Non-active plan returns null
- Input plan is not mutated (returns new object)

**Source restoration tests:**
- Empty ledger produces empty restoration
- Player-deck reveals produce `playerDeckReturns`
- Shared-source reveals produce grouped `sharedSourceReturns`
- Mixed sources are correctly separated
- Reveal order is preserved within each source group

**Notification tests:**
- Notification includes correct `prePlanId` and player IDs
- Message includes effect description
- Message includes card when `affectedCardExtId` is present
- Message omits card when `affectedCardExtId` is absent
- Throws on non-invalidated plan

**Full pipeline tests:**
- Active plan + matching mutation → full result with all four fields
- Active plan + non-matching mutation → null (detection rejects)
- Non-active plan → null
- Multiple mutations for same player: first produces result, second
  returns null (plan already invalidated by status guard)
- Result's `invalidatedPlan` has `status: 'invalidated'`
- Result's `sourceRestoration` matches the plan's `revealLedger`
- Result's `notification` includes causal message

**Acceptance scenario (integration test):**
- Create a PrePlan (WP-057's `createPrePlan`)
- Perform speculative draws and plays (WP-057's operations)
- Execute disruption pipeline with a mutation
- Verify: plan is invalidated, restoration lists correct cards,
  notification explains the cause
- Verify: creating a fresh PrePlan from updated state succeeds

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

| File | Action |
|---|---|
| `packages/preplan/src/disruption.types.ts` | **new** |
| `packages/preplan/src/disruptionDetection.ts` | **new** |
| `packages/preplan/src/disruptionPipeline.ts` | **new** |
| `packages/preplan/src/index.ts` | **modify** (add exports) |
| `packages/preplan/src/disruptionDetection.test.ts` | **new** |
| `packages/preplan/src/disruptionPipeline.test.ts` | **new** |

No other files may be modified.

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

### Tests

- [ ] All tests use `node:test` runner and `.test.ts` extension
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` passes

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
