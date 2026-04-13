# Turn Pre-Planning Architecture for Multiplayer Legendary Arena

> **Constraints document:**
> [`docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md`](DESIGN-CONSTRAINTS-PREPLANNING.md)
> — all 12 design constraints referenced below are defined and justified there.

---

## 1. Executive Summary

This document proposes a first-class pre-planning system for Legendary Arena
that allows non-active players to safely plan their upcoming turn while
waiting, even in the presence of disruptive inter-player effects.

The solution introduces a sandboxed, speculative planning context that mirrors
the player's turn locally, tracks all speculative reveals, and can be fully
rewound automatically when the real game state mutates a waiting player's
state.

The design:

- Removes mental backtracking from players
- Prevents information leakage
- Preserves fairness and agency
- Imposes zero burden on the active player
- Improves perceived pacing as game complexity increases

---

## 2. Core Idea

A player's pre-plan is not a sequence of queued actions.
It is a speculative simulation of their next turn, running in a private
sandbox.

The sandbox:

- Reads from the real game state (read-only snapshot)
- Never writes to the real game state
- Records everything it speculatively reveals
- Can be destroyed and rebuilt deterministically

When the real game state changes in a way that affects a waiting player, the
sandbox is discarded and automatically rebuilt to a clean starting state. The
player is informed of what happened and why.

---

## 3. Architectural Placement

### Layer Boundaries

The pre-planning system does not live inside the game engine. The engine owns
authoritative state and deterministic gameplay; speculative planning is not
authoritative.

```
Game Engine (authoritative)
    |
    |  read-only projection
    v
Pre-Planning Layer (new, per-client)
    |
    |  renders plan state
    v
UI Layer (presentation)
```

The pre-planning layer:

- **May** read the player's current zones, public game state, and counter
  values from the engine's state projection
- **May** maintain its own speculative state, reveal ledger, and plan steps
- **Must NOT** write to `G`, `ctx`, or any authoritative game state
- **Must NOT** import game engine internals beyond public type definitions
- **Must NOT** execute real moves or emit real events

Each waiting player's sandbox is independent. Multiple sandboxes may exist
concurrently (one per waiting player) with no interaction between them.

### Randomness in the Sandbox

The engine requires all randomness via `ctx.random.*`. The sandbox does not
have a real `ctx` and must not use one.

Speculative randomness (e.g., drawing from the player's deck) operates on a
local copy of the deck that is shuffled at sandbox creation time using a
client-local PRNG. This shuffle is disposable — it exists only to provide a
plausible deck order for planning purposes. On rewind, the local copy is
discarded and a fresh shuffle is produced.

The speculative shuffle is never authoritative. When the player's real turn
begins, the engine's `ctx.random.*` determines actual deck order.

---

## 4. Data Model

### 4.1 PrePlan

A PrePlan is a first-class object owned by a player.

```typescript
interface PrePlan {
  /** Player ID (boardgame.io string, e.g., "0", "1") */
  playerId: string;

  /**
   * Fingerprint of the real game state at sandbox creation time.
   * Used to detect whether the real state has diverged.
   */
  baseStateFingerprint: string;

  /** Private speculative copy of the player's state */
  sandboxState: SpeculativePlanningState;

  /** Every speculative reveal, in order */
  revealLedger: RevealRecord[];

  /** Advisory intent steps (partial or complete) */
  planSteps: PlanStep[];

  /** The ctx.turn value when this plan was created */
  createdAtTurn: number;
}
```

- `sandboxState` is a private, mutable copy of the player's zones and
  counters
- `revealLedger` records every speculative reveal for deterministic rewind
- `planSteps` are advisory intents only — never binding, never executed
  automatically

Satisfies constraints: #1, #2, #5, #8, #9, #10

### 4.2 Speculative Planning State

The sandbox contains only information the player is allowed to see.

```typescript
interface SpeculativePlanningState {
  /** Cards currently in hand (speculatively, after any draws/plays) */
  hand: CardExtId[];

  /** Local deck copy — shuffled at creation, re-shuffled on rewind */
  deck: CardExtId[];

  /** Speculative discard pile */
  discard: CardExtId[];

  /** Cards speculatively in play */
  inPlay: CardExtId[];

  /** Speculative counter values (attack, recruit, etc.) */
  counters: Record<string, number>;
}
```

- Deck order is local and disposable (see Section 3, Randomness)
- No other player ever sees or receives this state
- Zone contents use `CardExtId` strings only, consistent with engine
  conventions

Satisfies constraints: #2, #5, #9, #12

### 4.3 Reveal Ledger

Every speculative reveal is tracked explicitly.

```typescript
interface RevealRecord {
  /** Where the card came from */
  source: 'player-deck' | 'officer-stack' | 'sidekick-stack' | 'hq' | string;

  /** The card that was revealed */
  cardExtId: CardExtId;

  /** Monotonic index for ordering */
  revealIndex: number;
}
```

The reveal ledger is the mechanism by which the system deterministically
identifies what must be reshuffled on rewind.

Satisfies constraints: #1, #3, #9, #11

### 4.4 Plan Steps

```typescript
interface PlanStep {
  /** What the player intends to do */
  intent: 'playCard' | 'recruitHero' | 'fightVillain' | 'useEffect' | string;

  /** Which card or target is involved */
  targetCardExtId?: CardExtId;

  /** Human-readable description for notification purposes */
  description: string;

  /** Whether this step is still valid given current sandbox state */
  isValid: boolean;
}
```

Plan steps are informational. They help the player organize their thinking
and enable the system to explain what broke on rewind.

Satisfies constraints: #1, #8, #11

---

## 5. Pre-Planning Lifecycle

### 5.1 Creation

When a waiting player begins planning:

1. A read-only snapshot of their real zones and counters is taken
2. A `baseStateFingerprint` is computed from the snapshot
3. The speculative deck copy is shuffled using a client-local PRNG
4. A new `PrePlan` object is instantiated with empty ledger and steps

No real game state is changed. The engine is unaware that planning has begun.

### 5.2 Planning

Within the sandbox, the player may:

- Play cards (speculatively moving them from hand to inPlay)
- Draw speculatively (recording reveals in the ledger)
- Evaluate recruits and fights against public game state
- Plan effect chains and resource allocation

All speculative draws are:

- Private (never transmitted to other clients)
- Recorded in the reveal ledger
- Isolated from engine randomness (`ctx.random.*` is not involved)

### 5.3 Disruption Detection

Real game mutations that affect waiting players must be detectable. The
detection mechanism observes state changes and determines, per player,
whether their state was mutated.

```typescript
interface PlayerMutation {
  /** Which waiting player was affected */
  affectedPlayerId: string;

  /** Human-readable cause (for notification) */
  description: string;

  /** e.g., "Player A's Mastermind tactic discarded Iron Man from your hand" */
  cause: string;
}
```

When a mutation targets a waiting player who has an active `PrePlan`:

1. The `PrePlan` is marked invalid
2. No further sandbox interaction is permitted until rewind completes

The active player is never involved in this detection. Their turn proceeds
without interruption.

Satisfies constraints: #4, #6

### 5.4 Automatic Rewind

On disruption:

1. **Notify** — The player receives a causal notification immediately, before
   any further planning interaction is allowed
2. **Destroy** — The sandbox is discarded entirely
3. **Restore sources** — All speculatively revealed cards are returned to
   their sources:
   - Player deck is re-shuffled (new client-local PRNG seed)
   - Shared stacks (officers, sidekicks) are restored to pre-planning state
4. **Rebuild** — A fresh sandbox is created from the updated real game state
   (which now reflects the disruption, e.g., the discarded card is gone)

The player performs no manual reconstruction. The system owns the entire
rewind.

Satisfies constraints: #3, #7, #9, #11

### 5.5 Turn Start Consumption

When the player's real turn begins:

1. If a valid `PrePlan` exists, the `planSteps` are available as a reference
   for the player (rendered by the UI layer)
2. No action is auto-executed — the player takes real actions through the
   normal move system
3. The `PrePlan` is discarded once the player's turn begins

The pre-plan never crosses the boundary from advisory to authoritative. The
engine's move system remains the sole mechanism for game state mutation.

Satisfies constraints: #2, #10, #12

---

## 6. Notifications

Disruptions generate explicit, causal messages:

> "Your plan was reset because Player A's Mastermind tactic forced you to
> discard Iron Man from your hand."

Rules:

- Notification precedes any resumed planning interaction
- Message states both cause and effect
- No vague "something changed" messaging
- Notification format and delivery mechanism are UI-layer decisions

Satisfies constraints: #7, #11

---

## 7. Privacy and Fairness Guarantees

- Pre-plan contents are never broadcast to other clients
- Other players cannot see:
  - Cards speculatively drawn
  - Plan steps
  - Whether a plan exists at all
- After rewind, the speculative deck order is unknown to the player (fresh
  shuffle from new PRNG seed)
- The speculative PRNG is not seeded from `ctx.random.*` and has no
  relationship to the authoritative deck order the engine will produce

Satisfies constraints: #9, #12

---

## 8. Why Full Rewind Is the Correct Baseline

Full rewind:

- Eliminates partial-state corruption risk
- Avoids information leaks from selectively preserved plan fragments
- Minimizes mental bookkeeping (the system handles everything)
- Simplifies correctness proofs (one invariant: "rewind restores to clean
  hand")
- Aligns with Constraint #3: "Full rewind is the baseline; partial plan
  survival is a future optimization, not a requirement"

Partial survival is explicitly deferred. It can only be explored after the
baseline is stable, trusted, and proven correct in multiplayer conditions.

---

## 9. Constraint Satisfaction Matrix

| # | Constraint | How Satisfied |
|---|---|---|
| 1 | Explicit representation | `PrePlan` object with structured state, ledger, and steps |
| 2 | Advisory and non-binding | Sandbox never writes to real state; plan discarded at turn start |
| 3 | Full rewind to clean hand | Destroy sandbox, reshuffle sources, rebuild from real state |
| 4 | Per-player detection | Player-scoped mutation observers; binary affected/not |
| 5 | Locally determinable | Sandbox uses only player's own state + public game state |
| 6 | Active player unburdened | Detection and rewind are invisible to active player |
| 7 | Immediate notification | Push notification before interaction resumes |
| 8 | Zero/partial/full planning | Plan steps are optional and composable |
| 9 | No information leakage | Private sandbox; fresh PRNG on rewind; no broadcast |
| 10 | Single-turn scope | Plan created per turn, consumed or discarded at turn start |
| 11 | Understandable failures | Causal notification with effect name and card identity |
| 12 | No cognitive load increase | System owns rewind; planning feels like playing early |

---

## 10. Open Questions

The following questions are not blockers for this design but must be resolved
before implementation Work Packets are written:

1. **Fingerprint mechanism** — What is hashed to produce
   `baseStateFingerprint`? Player zones only, or zones + global piles +
   counters? Performance implications for frequent comparison.

2. **Shared stack restoration** — When a speculative reveal draws from a
   shared stack (officers, sidekicks), the real stack may have changed
   between sandbox creation and rewind. How is the delta reconciled?

3. **Multiple disruptions in sequence** — If a player is disrupted, begins
   re-planning, and is disrupted again before completing a new plan, is the
   UX a simple re-notification or does it require special handling?

4. **HQ interaction** — The HQ (Hero Quarters) is shared and changes as
   players recruit. Speculative recruits from HQ are inherently unstable.
   Should HQ interactions in plans be treated as always-conditional?

5. **Plan step granularity** — How detailed should `PlanStep` be? Enough to
   explain failures (current design) or enough to auto-populate the UI on
   turn start?

---

## 11. Implementation Work Packets

This design is implemented through the following Work Packets:

| WP | Name | Scope | Status |
|---|---|---|---|
| [WP-056](work-packets/WP-056-preplan-state-model.md) | Pre-Planning State Model & Lifecycle | Types, lifecycle invariants, `packages/preplan/` | Ready |
| [WP-057](work-packets/WP-057-preplan-sandbox-execution.md) | Pre-Plan Sandbox Execution | PRNG, sandbox creation, speculative operations | Ready |
| [WP-058](work-packets/WP-058-preplan-disruption-pipeline.md) | Pre-Plan Disruption Pipeline | Detection, invalidation, rewind, notification | Ready |
| WP-059 (deferred) | Pre-Plan UI Integration | Client wiring, notification rendering, turn-start consumption | Blocked on WP-028 + UI framework decision |

### Why WP-059 Is Deferred

WP-056/057/058 form a **self-contained, testable, correct system** below
the UI layer. WP-059 (UI integration) cannot be meaningfully designed
until:

1. **WP-028 (UI State Contract)** is executed — it defines the
   authoritative view model and how engine state is projected to clients
2. **A UI framework decision is made** — React, Svelte, or other; this
   determines component patterns, state management, and event handling
3. **WP-056/057/058 are implemented and tested** — the pre-planning
   layer's actual API surface must be proven before designing consumers

Drafting WP-059 before these prerequisites risks either over-constraining
future UI decisions or producing a WP too vague to guide implementation.

### Guidance for the Future WP-059 Author

When the prerequisites are met, the WP-059 author should address these
known integration concerns:

**Notification delivery timing.** WP-058's `DisruptionPipelineResult`
includes `requiresImmediateNotification: true` as a data-level contract.
The UI must enforce this: no planning interaction is permitted after a
disruption until the notification has been acknowledged or displayed.
The mechanism (modal, toast, inline blocking message) is a UI decision,
but the ordering constraint is architectural.

**Preventing interaction with invalidated plans.** WP-057's speculative
operations guard on `status === 'active'` and return `null` for
non-active plans. The UI must not allow planning gestures (draw, play,
recruit) to reach these functions when the plan is invalidated. This
is a UI-layer gate, not a preplan-layer concern.

**Plan regeneration after disruption.** After the disruption pipeline
runs and the notification is delivered, the player may want to resume
planning. The UI must call `createPrePlan` (WP-057) with a fresh
snapshot of the updated real state. The old `prePlanId` must never be
reused — each regeneration produces a new identity with `revision: 1`.

**Turn-start consumption.** When the player's turn begins, the UI
transitions the PrePlan to `'consumed'` and may render `planSteps` as
a visual reference. No auto-execution of plan steps is permitted. The
plan is discarded once the player takes their first real action.

**Multiple rapid disruptions.** If a player is disrupted, begins
re-planning, and is disrupted again before completing a new plan, the
UI must handle the second disruption gracefully. WP-058's status guard
ensures only one pipeline result is produced per active plan, but the
UI must manage the UX of repeated resets without frustrating the player.

**Plan existence privacy.** Whether a player is pre-planning must not
be visible to other players. No UI element (loading spinner, "planning"
badge, etc.) should be broadcast. The sandbox is entirely client-local.

---

## 13. Deferred Work (Intentional)

Out of scope for this document:

- Partial plan survival (selective invalidation instead of full rewind)
- Delta-based patching
- AI guidance or play suggestions
- Multi-turn planning
- Plan sharing or spectatorship
- Plan replay or export

These can only be explored after the baseline is stable and trusted.

---

## 14. Conclusion

This architecture satisfies all 12 derived design constraints while
remaining:

- Mechanically simple (one invariant: rewind to clean hand)
- Auditably fair (private sandbox, no broadcast, fresh shuffle on rewind)
- Resistant to edge-case leakage (reveal ledger tracks every speculative
  card)
- Invisible to players who choose not to use it (zero burden on non-planners
  and active players)

It converts pre-planning from a fragile mental hack into a first-class system
feature, restoring multiplayer Legendary's pacing without compromising rules
integrity.
