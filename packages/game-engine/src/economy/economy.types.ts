/**
 * Economy types for the Legendary Arena game engine.
 *
 * TurnEconomy tracks per-turn attack/recruit point accumulation and spending.
 * CardStatEntry holds parsed card stat values resolved at setup time.
 *
 * All fields are integers >= 0. The parser enforces this at setup time.
 */

import type { CardExtId } from '../state/zones.types.js';

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
  /**
   * WP-731 / D-24552 — whether the current player is BARRED from drawing more
   * cards this turn ("But you can't draw any more cards until the end of this
   * turn", Venompool's Shenanigans). Checked by `heroEffectDraw` (the hero
   * `draw`-keyword path), which draws 0 and logs `blocked` while it is set; the
   * end-of-turn hand refill / setup deal / other-seat draws use
   * `drawCardsIntoHand` directly and are unaffected, so the lock lifts at turn
   * end as printed.
   *
   * LAZILY MATERIALIZED, exactly like `recruitSpendableAsAttack`: absent until a
   * `no-more-draws` hero effect sets it (via `enableDrawLock`), dropped again by
   * `resetTurnEconomy` at turn start, and carried across every rebuild by the
   * conditional spread in `carryConversionFlag`. An absent field is omitted by
   * `JSON.stringify`, so a turn that never locks draws serializes byte-identically
   * and neither state-hash oracle moves.
   */
  drawsLocked?: boolean;
  /**
   * WP-736 / D-24556 — the ordered ledger of "Excessive Violence" cards the current
   * player has played this turn (Venomverse's Excessive Violence, keywords-full id 30).
   * Playing an allowlisted EV card appends its CardExtId here (via
   * `enrollExcessiveViolenceCard`) instead of firing its ability; a fight the player
   * takes "using Excessive Violence" (one extra [attack], once per turn) then fires
   * every enrolled card's ability in this order (`fireExcessiveViolencePlays`).
   *
   * Append order = fire order; DUPLICATES are allowed (the glossary's "two cards with
   * the same name" case — two copies each fire). Strings only (CardExtId), never card
   * objects — the ledger stays JSON-serializable and G-runtime-only.
   *
   * LAZILY MATERIALIZED, exactly like `recruitSpendableAsAttack` / `drawsLocked`: absent
   * until the first EV card is played, dropped again by `resetTurnEconomy` at turn start,
   * and carried across every same-turn rebuild by the conditional spread in
   * `carryConversionFlag`. An absent field is omitted by `JSON.stringify`, so a turn that
   * never plays an EV card serializes byte-identically and neither state-hash oracle moves.
   */
  excessiveViolencePlayedCards?: CardExtId[];
  /**
   * WP-736 / D-24556 — whether the current player has already fought "using Excessive
   * Violence" this turn. Set true the first time a fight resolves with the +1-attack
   * overspend (via `markExcessiveViolenceUsed`); a second EV fight the same turn is
   * barred ("Since you can only fight using Excessive Violence once per turn…", id 30).
   *
   * LAZILY MATERIALIZED, exactly like `drawsLocked`: absent until set, dropped by
   * `resetTurnEconomy` at turn start, and carried across every rebuild by
   * `carryConversionFlag`. Absent ≡ not yet used this turn; omitted by `JSON.stringify`,
   * so a turn that never overspends serializes byte-identically.
   */
  excessiveViolenceUsedThisTurn?: boolean;
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
  /**
   * Whether the card counts toward S.H.I.E.L.D. Level (WP-677 / D-24493).
   *
   * why: per universal-rules-v23 §S.H.I.E.L.D. Level, your Level is the number of
   * S.H.I.E.L.D. and/or HYDRA cards in your Victory Pile — "any card with the
   * S.H.I.E.L.D. or HYDRA team icon, as well as any card with 'S.H.I.E.L.D.' or 'HYDRA'
   * in its card name, Villain Group name, or Mastermind name." Derived once at setup
   * from the RAW registry entry (team ∈ {shield,hydra} OR the name/group/mastermind
   * substring), because it needs `team`/`name`, which the runtime does not read from
   * the registry. The `shield-levels` count source (heroCountSource.resolve.ts) reads
   * this over `zones.victory`. NOT inferred from card type at score time.
   */
  isShieldOrHydra: boolean;
}
