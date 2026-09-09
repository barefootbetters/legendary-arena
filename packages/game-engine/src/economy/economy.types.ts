/**
 * Economy types for the Legendary Arena game engine.
 *
 * TurnEconomy tracks per-turn attack/recruit point accumulation and spending.
 * CardStatEntry holds parsed card stat values resolved at setup time.
 *
 * All fields are integers >= 0. The parser enforces this at setup time.
 */

/**
 * Per-turn economy tracking for attack and recruit points.
 *
 * Reset to all zeros at the start of each player turn. Accumulated by
 * playCard, spent by fightVillain and recruitHero.
 */
export interface TurnEconomy {
  /** Total attack points accumulated this turn from played hero cards. */
  attack: number;
  /** Total recruit points accumulated this turn from played hero cards. */
  recruit: number;
  /** Attack points spent this turn on fighting villains/henchmen. */
  spentAttack: number;
  /** Recruit points spent this turn on recruiting heroes. */
  spentRecruit: number;
  /** Piercing damage accumulated this turn. No MVP producer — always 0 until a future hero ability WP. */
  piercing: number;
  /** Number of wound cards drawn by the current player this turn. */
  woundsDrawn: number;
  /**
   * WP-665 / D-24476 — total cards the current player drew from EFFECTS this
   * turn (the `draw:N` handler path). Used by the `cardsDrawnThisTurnAtLeast`
   * condition ("if you drew two cards this turn", Gamma-Draining Nanites). The
   * start-of-turn hand refill is NOT counted (it uses `drawCardsIntoHand`, not
   * the effect-draw path), so the count reflects only effect-driven draws.
   * Reset to 0 by `resetTurnEconomy`; carried by every rebuild helper.
   */
  cardsDrawn: number;
  /**
   * WP-580 / D-24389 — whether unspent recruit may be spent as attack this turn
   * ("You can use Recruit as Attack this turn", God of Thunder).
   *
   * LAZILY MATERIALIZED: absent (undefined) until a `recruit-as-attack` hero
   * effect sets it, and dropped again by `resetTurnEconomy` at turn start. An
   * absent field is omitted by `JSON.stringify`, so a turn that never triggers
   * the conversion serializes byte-identically to the pre-WP-580 shape and
   * neither state-hash oracle moves. Carried forward by every `TurnEconomy`
   * rebuild (`addResources` / `spendAttack` / `spendRecruit`) via a conditional
   * spread, so a later same-turn spend cannot silently drop it.
   */
  recruitSpendableAsAttack?: boolean;
}

// why: stats resolved at setup time from registry so moves never query
// registry at runtime — same pattern as G.villainDeckCardTypes (WP-014).
// Read-only after setup; only economy helpers may produce new values.
/**
 * Parsed card stat values for a single card.
 *
 * Built at setup time from registry data. Keyed by CardExtId in
 * G.cardStats. Moves read these values without registry access.
 */
export interface CardStatEntry {
  /** Hero printed base attack value (playCard adds to economy). */
  attack: number;
  /** Hero printed base recruit value (playCard adds to economy). */
  recruit: number;
  /** Hero recruit cost (recruitHero validates spend against this). */
  cost: number;
  /**
   * Villain/henchman fight requirement parsed from vAttack.
   * fightVillain validates available attack against this value.
   * For hero cards this is always 0 (heroes are never fought).
   * For dynamic villains (vAttack "*" or "N+"), this is the base value
   * at setup time — resolveFightCost computes the runtime cost.
   */
  fightCost: number;
  /**
   * Whether fight cost is static (read fightCost directly) or dynamic
   * (sum fightCostBase + captured hero costs via resolveFightCost).
   * All existing cards default to 'static'. WP-214.
   */
  fightCostMode: 'static' | 'dynamic';
  /**
   * Base fight cost for dynamic villains (vAttack "N+" pattern).
   * Zero for "*" villains; N for "N+" villains. Always 0 for static.
   */
  fightCostBase: number;
  /**
   * Whether the card's printed power shows an attack icon (WP-675 / D-24490).
   *
   * why: this is the FAITHFUL "has an attack icon" signal — the RAW registry
   * value being non-null. `parseCardStatValue` collapses BOTH `null` (no icon)
   * and `"0+"`/`"0"` (icon present, base 0) to the integer `0`, so `attack > 0`
   * is a lossy test. The `attack-icon-played-this-turn` count source
   * (heroCountSource.resolve.ts) reads this, not `attack`. Synthesized token
   * entries (no raw "0+" ambiguity) set it from their real value.
   */
  hasAttackIcon: boolean;
  /**
   * Whether the card's printed power shows a recruit icon (WP-675 / D-24490).
   * The recruit analog of `hasAttackIcon`; read by the
   * `recruit-icon-played-this-turn` count source.
   */
  hasRecruitIcon: boolean;
}
