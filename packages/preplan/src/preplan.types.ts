import type { CardExtId } from '@legendary-arena/game-engine';

/**
 * A first-class pre-plan object owned by a single player.
 *
 * Advisory only — never commits game actions, never writes to authoritative
 * game state. Scoped to exactly one upcoming turn.
 *
 * Lifecycle states:
 *   'active' → 'invalidated' → (discarded)
 *   'active' → 'consumed'    → (discarded)
 * No other transitions are permitted.
 *
 * Null semantics:
 *   - A missing PrePlan object means "no pre-plan exists" (the player never
 *     started planning, or the plan was discarded after rewind/consumption).
 *   - An existing PrePlan with zero planSteps means "the player began
 *     planning but has not yet specified any actions" — a valid active state.
 *
 * Single-turn scope (DESIGN-CONSTRAINT #10):
 *   appliesToTurn must equal ctx.turn + 1 at creation time. Creating a
 *   PrePlan for any other turn is invalid.
 *
 * Revision semantics:
 *   revision starts at 1 on creation and increments on every mutation of
 *   sandboxState / revealLedger / planSteps. A new PrePlan created after
 *   rewind starts at 1 again with a new prePlanId (it is a new instance).
 */
export type PrePlan = {
  /** Unique identifier for this pre-plan instance. */
  prePlanId: string;

  /**
   * Monotonic version number for this pre-plan instance.
   *
   * Starts at 1 on creation. Increments on any mutation of sandboxState,
   * revealLedger, or planSteps. A new PrePlan created after rewind starts
   * at 1 again (it is a new instance with a new prePlanId).
   *
   * Enables consumers to detect stale references, resolve race conditions,
   * and order async notification delivery.
   */
  revision: number;

  /** Player who owns this pre-plan (framework-string identifier, e.g., "0", "1"). */
  playerId: string;

  /**
   * The turn value for which this plan applies.
   *
   * Invariant: must equal ctx.turn + 1 at time of creation.
   * Creating a PrePlan for any other turn is invalid.
   */
  appliesToTurn: number;

  /**
   * Current lifecycle state of this pre-plan.
   *
   * Closed union by design. The canonical readonly array
   * (PREPLAN_STATUS_VALUES) and its drift-detection test are deferred to
   * WP-057 — the first runtime consumer of this union is the sandbox
   * execution pipeline, and the array/test belong alongside the runtime
   * code that reads it. WP-056 is types-only; adding a canonical array
   * here would pull WP-057 scope forward.
   */
  status: 'active' | 'invalidated' | 'consumed';

  /**
   * Fingerprint of the real game state at sandbox creation time.
   * Used to detect whether the real state has diverged.
   *
   * NON-GUARANTEE: The fingerprint is a divergence hint, not a correctness
   * guarantee. It must never be used as a sole authority for invalidation.
   * A matching fingerprint does not prove the plan is still valid; a
   * mismatched fingerprint strongly suggests it is not.
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
     * Enables testing, analytics, and future automation without parsing
     * human-readable text. Does not encode engine rules.
     *
     * Closed union by design. The canonical readonly array
     * (PREPLAN_EFFECT_TYPES) and its drift-detection test are deferred to
     * WP-058 — the first runtime consumer of this union is the disruption-
     * detection pipeline, and the array/test belong alongside the runtime
     * code that produces it. WP-056 is types-only; adding a canonical
     * array here would pull WP-058 scope forward.
     */
    effectType: 'discard' | 'ko' | 'gain' | 'other';

    /** Human-readable description of the disruptive effect. */
    effectDescription: string;

    /** Card involved in the disruption, if applicable. */
    affectedCardExtId?: CardExtId;
  };
};

/**
 * Speculative copy of player-visible zones and counters.
 *
 * Mirrors real player-visible state but is entirely disposable. Deck order
 * is sandbox-local and re-shuffled on rewind.
 *
 * The `victory` pile is intentionally omitted (DESIGN-CONSTRAINT #9
 * no-information-leakage — the victory pile is not player-visible during
 * normal play, so exposing it through the sandbox would leak hidden state).
 *
 * Counter constraint (DESIGN-CONSTRAINT #9 invariant): counters may only
 * hold player-visible quantities shown during a real turn. They must not
 * encode conditional state, latent triggers, or rule flags.
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
   * Mirrors the real counters convention (Record<string, number>).
   * Known keys at time of writing: 'attack', 'recruit'.
   * Additional keys may be added by future card mechanics WPs.
   *
   * INVARIANT: Sandbox counters may only represent quantities shown to
   * the player during a real turn. They must not encode conditional
   * state, latent triggers, or rule flags.
   */
  counters: Record<string, number>;
};

/**
 * Record of a single speculative reveal.
 *
 * INVARIANT (DESIGN-CONSTRAINT #3): The reveal ledger is the sole authority
 * for deterministic rewind. All rewinds must be derived exclusively from
 * the revealLedger. Any rewind logic that inspects sandboxState directly
 * is invalid.
 *
 * Every speculative reveal must be logged; order must be preserved.
 */
export type RevealRecord = {
  /**
   * Where the card came from.
   *
   * Open union by design — the `| string` fallback is intentional. Known
   * values are optimization hints for UI rendering and analytics, not
   * execution contracts; unknown values are accepted so future WPs
   * (WP-057 sandbox execution, WP-058 disruption detection, or future
   * card mechanics) can extend without a union refactor and without
   * breaking the reveal-ledger rewind authority. Consumers must handle
   * unknown string values gracefully (fall-through rendering, "other
   * source" analytics bucket).
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

/**
 * A single advisory intent within a pre-plan.
 *
 * Informational only — helps the player organize their thinking and
 * enables the system to explain what broke on rewind.
 */
export type PrePlanStep = {
  /**
   * What the player intends to do.
   *
   * Open union by design — the `| string` fallback is intentional and this
   * union is deliberately NOT the same as the engine's CoreMoveName.
   * Pre-planning intents are advisory and descriptive, not executable —
   * a PrePlanStep never dispatches a move. Known values are optimization
   * hints for UI rendering ("play this card first", "recruit this hero
   * next") and for explaining what broke on rewind; unknown values are
   * accepted so future content (WP-057 sandbox execution, WP-058
   * disruption detection, or future card mechanics) can extend the
   * intent vocabulary without a union refactor. Consumers must handle
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
