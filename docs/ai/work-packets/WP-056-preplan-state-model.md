# WP-056 — Pre-Planning State Model & Lifecycle (Read-Only Core)

**Status:** Ready for Implementation
**Primary Layer:** Pre-Planning (Non-Authoritative, Per-Client) — new `preplan` code category (D-5601)
**Last Updated:** 2026-04-20 (pre-flight amendments: PS-3 workspace correction + Finding #4/#10 documentation FIXes)
**Dependencies:**

- `docs/ai/DESIGN-PREPLANNING.md` (approved architecture)
- `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` (design constraints)
- WP-006A — Player zones & hand/deck/discard model
- WP-008B — Core moves implementation (move names, stage gating)

---

## Session Context

`DESIGN-PREPLANNING.md` introduced a sandboxed, speculative planning
architecture to eliminate mental backtracking for waiting players in
multiplayer games.

This packet extracts and formalizes the **state model and lifecycle rules**
for pre-planning. It does **not** implement sandbox execution or disruption
detection. Those are deferred to subsequent packets.

This WP creates a **first-class PrePlan state object**, establishes
invariants, and defines exactly when PrePlans are created, invalidated,
rewound, or discarded.

---

## Why This Packet Matters

Without a rigorously defined state model:

- Pre-plans degrade into ad-hoc UI overlays
- Rewinds become lossy or inconsistent
- Information-leak risks increase
- Future systems cannot reliably compose

WP-056 ensures pre-planning is:

- Explicit (machine-visible)
- Auditable
- Rewind-safe
- Lifecycle-bounded

This packet is the **foundation** for all later pre-planning behavior.

---

## Goal

Define a **first-class PrePlan state object** such that:

- Pre-plans are explicit, inspectable, and discardable
- Speculative reveals are fully tracked
- Full rewind to clean hand is always possible
- Pre-plans are scoped to exactly one future turn
- No gameplay state is ever mutated

---

## Non-Goals (Explicit)

This packet does **NOT**:

- Execute plan steps
- Detect disruptions (per-player detection is a later WP)
- Decide *when* to rewind (only *how*)
- Project plans into real turn actions
- Provide UI or network behavior
- Introduce any runtime-executable code (types and documentation only)

---

## Non-Negotiable Constraints (Derived)

This packet enforces the following design constraints from
`DESIGN-CONSTRAINTS-PREPLANNING.md`:

| # | Constraint | Enforced By |
|---|---|---|
| 1 | Explicit representation | `PrePlan` as first-class type |
| 2 | Advisory, non-binding | Sandbox state is isolated; no write path to `G` |
| 3 | Full rewind capability | Reveal ledger enables deterministic restore |
| 9 | No information leakage | Sandbox state is private; no export mechanism |
| 10 | Single-turn scope | `appliesToTurn` field; lifecycle boundary |

Constraints #4, #6, #7, #8, #11, #12 are addressed by later WPs that
build on this state model.

---

## Architectural Placement

Per `DESIGN-PREPLANNING.md` Section 3, the pre-planning system does **not**
live inside the game engine. The engine owns authoritative state;
speculative planning is non-authoritative.

```
Game Engine (authoritative, packages/game-engine/)
    |
    |  read-only projection
    v
Pre-Planning Layer (new, packages/preplan/)
    |
    |  renders plan state
    v
UI Layer (presentation)
```

All files created by this WP live in `packages/preplan/`.

The preplan package:

- **May** import type definitions from `@legendary-arena/game-engine`
  (e.g., `CardExtId`)
- **Must NOT** import game engine runtime code, moves, or helpers
- **Must NOT** import `boardgame.io`
- **Must NOT** import server, registry, or UI packages

---

## Scope (In)

### A) New Package: `packages/preplan/`

**File:** `packages/preplan/package.json`

Standard pnpm workspace package:
- Name: `@legendary-arena/preplan`
- ESM-only
- TypeScript
- No runtime dependencies beyond `@legendary-arena/game-engine` (types only)

### B) PrePlan Type

**File:** `packages/preplan/src/preplan.types.ts`

```typescript
import type { CardExtId } from '@legendary-arena/game-engine';

/**
 * A first-class pre-plan object owned by a single player.
 *
 * Advisory only — never commits game actions, never writes to G.
 * Scoped to exactly one upcoming turn.
 *
 * Lifecycle states: 'active' → 'invalidated' → (discarded)
 *                   'active' → 'consumed' → (discarded)
 *
 * A missing PrePlan object means "no pre-plan exists."
 * An existing PrePlan with zero planSteps means "player began planning
 * but has not yet specified any actions."
 */
export type PrePlan = {
  /** Unique identifier for this pre-plan instance. */
  prePlanId: string;

  /**
   * Monotonic version number for this pre-plan instance.
   *
   * Starts at 1 on creation. Increments on any mutation.
   * A new PrePlan created after rewind starts at 1 again
   * (it is a new instance with a new prePlanId).
   *
   * Enables consumers to detect stale references, resolve
   * race conditions, and order async notification delivery.
   */
  revision: number;

  /** Player who owns this pre-plan (boardgame.io string, e.g., "0", "1"). */
  playerId: string;

  /**
   * The ctx.turn value for which this plan applies.
   *
   * Invariant: must equal ctx.turn + 1 at time of creation.
   * Creating a PrePlan for any other turn is invalid.
   */
  appliesToTurn: number;

  /**
   * Current lifecycle state of this pre-plan.
   *
   * Closed union by design. Canonical readonly array
   * (`PREPLAN_STATUS_VALUES`) + drift-detection test are **deferred to
   * WP-057** — the first runtime consumer of this union is the sandbox
   * execution pipeline, and the array/test belong alongside the runtime
   * code that reads it. WP-056 is types-only; adding a canonical array
   * here would pull WP-057 scope forward.
   */
  status: 'active' | 'invalidated' | 'consumed';

  /**
   * Fingerprint of the real game state at sandbox creation time.
   * Used to detect whether the real state has diverged.
   *
   * NON-GUARANTEE: The fingerprint is a divergence hint, not a
   * correctness guarantee. It must never be used as a sole
   * authority for invalidation. A matching fingerprint does not
   * prove the plan is still valid; a mismatched fingerprint
   * strongly suggests it is not.
   */
  baseStateFingerprint: string;

  /** Speculative copy of player-visible state. */
  sandboxState: PrePlanSandboxState;

  /** Ordered log of all speculative reveals. */
  revealLedger: RevealRecord[];

  /** Advisory steps representing intended play order or choices. */
  planSteps: PrePlanStep[];

  /**
   * Present only when status is 'invalidated'.
   * Records what caused the invalidation for downstream notification.
   */
  invalidationReason?: {
    /** The player whose action caused the disruption. */
    sourcePlayerId: string;
    /**
     * Machine-stable category of the disruptive effect.
     * Enables testing, analytics, and future automation without
     * parsing human-readable text. Does not encode engine rules.
     *
     * Closed union by design. Canonical readonly array
     * (`PREPLAN_EFFECT_TYPES`) + drift-detection test are **deferred
     * to WP-058** — the first runtime consumer of this union is the
     * disruption-detection pipeline, and the array/test belong
     * alongside the runtime code that produces it. WP-056 is
     * types-only; adding a canonical array here would pull WP-058
     * scope forward.
     */
    effectType: 'discard' | 'ko' | 'gain' | 'other';
    /** Human-readable description of the disruptive effect. */
    effectDescription: string;
    /** Card involved in the disruption, if applicable. */
    affectedCardExtId?: CardExtId;
  };
};
```

### C) PrePlanSandboxState Type

**File:** `packages/preplan/src/preplan.types.ts` (same file)

```typescript
/**
 * Speculative copy of player-visible zones and counters.
 *
 * Mirrors real player state but is entirely disposable.
 * Deck order is sandbox-local and re-shuffled on rewind.
 */
export type PrePlanSandboxState = {
  /** Cards currently in hand (speculatively, after any draws/plays). */
  hand: CardExtId[];

  /** Local deck copy — shuffled at creation, re-shuffled on rewind. */
  deck: CardExtId[];

  /** Speculative discard pile. */
  discard: CardExtId[];

  /** Cards speculatively in play. */
  inPlay: CardExtId[];

  /**
   * Speculative counter values.
   *
   * Mirrors engine G.counters convention (Record<string, number>).
   * Known keys at time of writing: 'attack', 'recruit'.
   * Additional keys may be added by future card mechanics WPs.
   *
   * INVARIANT: Sandbox counters may only represent quantities shown
   * to the player during a real turn. They must not encode
   * conditional state, latent triggers, or rule flags.
   */
  counters: Record<string, number>;
};
```

**Rules:**

- Must mirror real player-visible zones only
- No hidden opponent information
- Deck order is sandbox-local and discardable
- Zone contents are `CardExtId` strings only (engine convention)

### D) Reveal Ledger Type

**File:** `packages/preplan/src/preplan.types.ts` (same file)

```typescript
/**
 * Record of a single speculative reveal.
 *
 * INVARIANT: The reveal ledger is the sole authority for deterministic
 * rewind. All rewinds must be derived exclusively from the revealLedger.
 * Any rewind logic that inspects sandboxState directly is invalid.
 *
 * Every speculative reveal must be logged; order must be preserved.
 */
export type RevealRecord = {
  /**
   * Where the card came from.
   *
   * Open union by design — the `| string` fallback is intentional.
   * Known values are **optimization hints for UI rendering and
   * analytics**, not execution contracts; unknown values are
   * accepted so future content (new reveal sources introduced by
   * WP-057 sandbox execution, WP-058 disruption detection, or
   * future card mechanics) can extend without a union refactor
   * and without breaking the reveal-ledger rewind authority.
   * Consumers must handle unknown string values gracefully
   * (fall-through rendering, "other source" analytics bucket).
   */
  source:
    | 'player-deck'
    | 'officer-stack'
    | 'sidekick-stack'
    | 'hq'
    | string;

  /** The card that was speculatively revealed. */
  cardExtId: CardExtId;

  /** Monotonic index for ordering. */
  revealIndex: number;
};
```

### E) PrePlanStep Type

**File:** `packages/preplan/src/preplan.types.ts` (same file)

```typescript
/**
 * A single advisory intent within a pre-plan.
 *
 * Informational only — helps the player organize their thinking
 * and enables the system to explain what broke on rewind.
 */
export type PrePlanStep = {
  /**
   * What the player intends to do.
   *
   * Open union by design — the `| string` fallback is intentional
   * and this union is **deliberately NOT the same as** the engine's
   * `CoreMoveName`. Pre-planning intents are **advisory and
   * descriptive**, not executable — a `PrePlanStep` never dispatches
   * a move. Known values are optimization hints for UI rendering
   * ("play this card first", "recruit this hero next") and for
   * explaining what broke on rewind; unknown values are accepted so
   * future content (WP-057 sandbox execution, WP-058 disruption
   * detection, or future card mechanics) can extend the intent
   * vocabulary without a union refactor. Consumers must handle
   * unknown string values gracefully — rendering an intent is never
   * gated on the string being in the known set.
   */
  intent: 'playCard' | 'recruitHero' | 'fightVillain' | 'useEffect' | string;

  /** Which card or target is involved. */
  targetCardExtId?: CardExtId;

  /** Human-readable description for notification purposes. */
  description: string;

  /** Whether this step is still valid given current sandbox state. */
  isValid: boolean;
};
```

### F) Lifecycle Invariants

Documented as JSDoc on the `PrePlan` type and as code comments in
`preplan.types.ts`. No separate `.md` file inside `src/`.

**Lifecycle rules (enforced by consumers, defined here as contract):**

1. **Creation** (`status: 'active'`)
   - PrePlan is created during another player's active turn
   - `appliesToTurn` must equal `ctx.turn + 1` at creation time
   - `prePlanId` must be unique (never reuse a previous plan's ID)
   - `revision` starts at `1`
   - `sandboxState` initialized from a read-only snapshot of real player zones
   - `revealLedger` initially empty
   - `planSteps` initially empty
   - `invalidationReason` must be `undefined`

2. **Mutation (Speculative)** (only while `status === 'active'`)
   - Only `sandboxState`, `revealLedger`, and `planSteps` may be mutated
   - `revision` increments on every mutation
   - Real game state (`G`) remains untouched
   - Every speculative reveal must append to `revealLedger`
   - No mutation is permitted when `status` is `'invalidated'` or `'consumed'`

3. **Invalidation** (`status: 'active'` → `'invalidated'`)
   - PrePlan is marked `'invalidated'` when an external disruption affects
     the player
   - `invalidationReason` must be set with cause details
   - No further mutation is allowed once invalidated
   - Invalidation is triggered by a later WP (disruption detection)

4. **Rewind** (follows invalidation)
   - `sandboxState` is discarded entirely
   - `revealLedger` is consumed to identify all sources that must be restored
   - Deck is re-shuffled with a new client-local PRNG seed
   - A fresh sandbox may be constructed from the updated real state
   - The invalidated PrePlan is discarded; a new PrePlan (new `prePlanId`)
     is created if the player resumes planning

5. **Turn Boundary** (`status: 'active'` → `'consumed'`, then discarded)
   - When the player's turn begins, the PrePlan transitions to `'consumed'`
     (advisory context available) or is discarded entirely
   - No PrePlan persists past this boundary
   - `appliesToTurn` enforces single-turn scope

**Null semantics:**

- A missing `PrePlan` object means "no pre-plan exists" (player never
  started planning, or plan was discarded after rewind/consumption)
- An existing `PrePlan` with zero `planSteps` means "player began planning
  but has not yet specified any actions" — this is a valid active state

### G) Package Exports

**File:** `packages/preplan/src/index.ts`

```typescript
export type {
  PrePlan,
  PrePlanSandboxState,
  RevealRecord,
  PrePlanStep,
} from './preplan.types.js';
```

Type-only exports. No runtime code in this WP.

---

## Scope (Out)

- Disruption detection logic
- Player mutation observers
- Speculative execution of effects (sandbox move simulation)
- Rewind implementation (mechanical restore logic)
- UI rendering of plans
- Network replication
- Fingerprint computation logic

---

## Files Expected to Change

| File | Action |
|---|---|
| `packages/preplan/package.json` | **new** |
| `packages/preplan/tsconfig.json` | **new** |
| `packages/preplan/src/preplan.types.ts` | **new** |
| `packages/preplan/src/index.ts` | **new** |
| `pnpm-lock.yaml` | **modified** (regenerated by `pnpm install`; delta scoped to a new `importers['packages/preplan']` block) |

**`pnpm-workspace.yaml` is NOT modified.** The existing `packages/*` glob
already covers `packages/preplan/` (verified 2026-04-20 pre-flight PS-3).
No workspace edit is required; any appearance of `pnpm-workspace.yaml`
in `git diff --name-only` is a scope violation.

**Lockfile expectation.** Adding a new `packages/preplan/package.json`
triggers lockfile regeneration on `pnpm install`. The delta must be
limited to a new `importers['packages/preplan']` block. Any
cross-importer churn is a scope violation and must be investigated
before commit (P6-44 lockfile discipline).

No other files may be modified.

---

## Acceptance Criteria (Binary)

### State Correctness

- [ ] `PrePlan` exists as a first-class exported type with `prePlanId`, `revision`, `status`, `invalidationReason` (including `effectType` and `affectedCardExtId`)
- [ ] `PrePlanSandboxState` contains only player-visible zones (`hand`, `deck`, `discard`, `inPlay`, `counters`)
- [ ] `RevealRecord` captures source, card, and order
- [ ] `PrePlanStep` captures intent, target, description, and validity
- [ ] All zone contents typed as `CardExtId[]`

### Architectural Boundary

- [ ] All files live in `packages/preplan/`, not in `packages/game-engine/`
- [ ] No `boardgame.io` imports
- [ ] No game engine runtime imports (type-only imports permitted)
- [ ] No runtime-executable code exists in the package (types and re-exports only)
- [ ] No path exists to mutate real game state from preplan types

### Lifecycle

- [ ] `status` field encodes lifecycle states (`'active'`, `'invalidated'`, `'consumed'`)
- [ ] `appliesToTurn` enforces single-turn scope (documented invariant: `ctx.turn + 1`)
- [ ] Lifecycle invariants documented as JSDoc
- [ ] PrePlan can be discarded without side effects (no cleanup hooks, no subscriptions)
- [ ] Full rewind is mechanically possible using `revealLedger` only (invariant documented)
- [ ] Null semantics documented: missing PrePlan vs empty planSteps

### Behavioral

- [ ] PrePlan state can be created, invalidated, and discarded without producing any visible side effects in the live game

### Build

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm test` passes (no regressions)

---

## Governance (Required)

### Pre-session (Commit A0 `SPEC:`)

- [x] **EC-056** authored at
  `docs/ai/execution-checklists/EC-056-preplan-state-model.checklist.md`
  and registered in `EC_INDEX.md` (Status: Draft).
- [x] **D-5601** authored in `DECISIONS.md` classifying `packages/preplan/`
  as a new top-level `preplan` code category (follows the D-6301 /
  D-6511 top-level-category pattern, not the D-2706/D-2801/D-3001/D-3101
  engine-subdirectory pattern). Registered in `DECISIONS_INDEX.md`.
- [x] **`02-CODE-CATEGORIES.md`** extended with a `preplan` category
  row in the Summary table and a full category-definition section
  matching `DESIGN-PREPLANNING.md` + `.claude/rules/architecture.md`
  §Pre-Planning Layer.
- [x] **WP-056 amendments applied** (2026-04-20 pre-flight):
  `pnpm-workspace.yaml` removed from §Files Expected to Change (PS-3);
  `pnpm-lock.yaml` delta explicitly scoped; closed-union canonical-array
  deferrals documented (Finding #4 — `PREPLAN_STATUS_VALUES` to WP-057,
  `PREPLAN_EFFECT_TYPES` to WP-058); `| string` open-union rationale
  documented (Finding #10).

### Settled conventions to record (not new D-entries; already captured by the above)

- Pre-planning state lives in `packages/preplan/`, not in the game engine
  (non-authoritative, per-client concern) — D-5601 + D-PP architecture
  pre-blessings.
- Pre-planning state is sandboxed, advisory, and non-authoritative
  (DESIGN-CONSTRAINTS #1/#2).
- Full rewind is the baseline correctness mechanism (DESIGN-CONSTRAINT #3);
  reveal ledger is the sole rewind authority.
- Pre-plans are scoped to a single upcoming turn (DESIGN-CONSTRAINT #10);
  `appliesToTurn = ctx.turn + 1` is the hard invariant.
- Speculative reveals are tracked explicitly and fully discardable
  (DESIGN-CONSTRAINT #3 ledger authority; DESIGN-CONSTRAINT #9 no
  information leakage).

### Governance close (Commit B `SPEC:`)

- [ ] `WORK_INDEX.md` — WP-056 checked off with date + commit hash.
- [ ] `STATUS.md` — updated to reflect WP-056 close.
- [ ] `EC_INDEX.md` — EC-056 status moved Draft → Done with commit hash.
- [ ] `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md` — produced
  during Commit A (mandatory per three triggers: new long-lived
  abstraction, contract consumed by WP-057/058, new code-category
  directory).

---

## Verification Steps

```bash
pnpm install                 # expect pnpm-lock.yaml delta limited to importers['packages/preplan']
pnpm -r build                # expect exit 0
pnpm test                    # expect 536 passing / 0 failing unchanged (zero tests added)

# Architectural boundary enforcement — all grep patterns escape regex
# specials per P6-22 / WP-033 P6-22 so JSDoc prose mentioning the
# forbidden names does not false-positive the "no output" gate.
git grep -nE "from ['\"]boardgame\.io" packages/preplan/ && echo "FAIL: boardgame.io import found" || echo "PASS"
git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/ | grep -v "import type" && echo "FAIL: runtime engine import found" || echo "PASS"
git grep -nE "from ['\"]@legendary-arena/registry" packages/preplan/ && echo "FAIL" || echo "PASS"
git grep -nE "Math\.random" packages/preplan/ && echo "FAIL" || echo "PASS"
git grep -nE "require\(" packages/preplan/ && echo "FAIL" || echo "PASS"
git grep -nE "\.reduce\(" packages/preplan/ && echo "FAIL" || echo "PASS"

git diff --name-only         # expect exactly the files listed above (no pnpm-workspace.yaml, no engine/registry/server/app files)
```

Expected:

- Build exits 0
- Tests unchanged (this WP adds types only, no runtime behavior)
- All boundary checks pass (no runtime imports, no randomness, no CJS, no `.reduce()`)
- Only files listed in §Files Expected to Change + governance artifacts modified
- `pnpm-workspace.yaml` NOT in the diff (PS-3 correction)
- `pnpm-lock.yaml` delta limited to a new `importers['packages/preplan']` block

---

## Definition of Done

This WP is complete when:

- PrePlan state types exist, compile, and are exported (including `prePlanId`, `revision`, `status`, `invalidationReason` with `effectType` and `affectedCardExtId`)
- Lifecycle invariants are documented as JSDoc (status transitions, null semantics, turn guard, ledger authority, counter constraints, fingerprint non-guarantee)
- Package lives in `packages/preplan/` with correct workspace registration
- No runtime-executable code introduced (types and re-exports only)
- Architectural boundary checks pass (no `boardgame.io`, no runtime engine imports)
- Governance updated (DECISIONS.md, WORK_INDEX.md)

---

## Next Natural Packets

Once WP-056 lands, the correct order is:

1. **WP-057 — Pre-Plan Sandbox Execution** — speculative move simulation
   within the sandbox (draws, plays, resource tracking)
2. **WP-058 — Pre-Plan Disruption Detection** — per-player mutation
   observers that trigger invalidation
3. **WP-059 — Pre-Plan Rewind & Notification** — mechanical rewind
   implementation and causal notification delivery

These numbers are provisional. Actual numbering and scope will be confirmed
when each WP is drafted and added to `WORK_INDEX.md`.
