/**
 * Canonical count-source taxonomy for count-scaled hero ability effects.
 *
 * A HeroCountSource names the "for each X" quantity an `attack-per-count`
 * effect scales by (see the `attack-per-count` keyword in heroKeywords.ts).
 * The grant is `magnitude × resolveCountSource(G, playerID, source)`, where
 * the source is resolved to a non-negative integer by the pure resolver in
 * hero/heroCountSource.resolve.ts.
 *
 * Like HeroKeyword, this is a closed union paired with a canonical array for
 * drift-detection. Adding a new source requires a DECISIONS.md entry, updating
 * BOTH the union type and the HERO_COUNT_SOURCES array, AND adding a matching
 * branch to resolveCountSource (plus a parity drift test). This keeps the
 * "+N attack for each X" family parameterized — a new source is one enum entry
 * plus one resolver branch, never a new keyword per card.
 *
 * No boardgame.io imports. No registry imports. Contracts only.
 */

// ---------------------------------------------------------------------------
// HeroCountSource
// ---------------------------------------------------------------------------

// why: count sources are semantic labels only; adding a source requires a
// DECISIONS.md entry, updating both the union type and the canonical array,
// and adding a resolveCountSource branch. This prevents ad-hoc source
// proliferation and keeps the count-scaled-attack family parameterized.

/**
 * Closed canonical union of count-source labels for count-scaled hero effects.
 *
 * Each value names a quantity in `G` that an `attack-per-count` effect scales
 * by. The label carries no resolution logic on its own — resolveCountSource
 * dispatches on it.
 */
export type HeroCountSource =
  | 'victory-bystanders' // why: D-24016 — counts the player's victory-pile bystanders (both ext_id forms)
  | 'worthy-cards-played-this-turn' // why: WP-673 / D-24488 — counts the OTHER cards played this turn that make you Worthy (a Hero costing >= 5, per D-24464); Divine Lightning's "+1 attack for each other card you played this turn that makes you Worthy"
  | 'cost-four-plus-played-this-turn' // why: WP-674 / D-24489 — counts the OTHER cards played this turn that cost 4 or more; drives the "+N attack/recruit for each other card you played this turn that costs 4 or more" siblings (cvwr Being Big Is Best, noir Follow Big Leads + Weight of the World, vill Size Matters)
  | 'attack-icon-played-this-turn' // why: WP-675 / D-24490 — counts the OTHER cards played this turn that show an attack icon (hasAttackIcon); the attack branch of vnom Symbiotic Adaptation's count-scaled choose-one
  | 'recruit-icon-played-this-turn' // why: WP-675 / D-24490 — counts the OTHER cards played this turn that show a recruit icon (hasRecruitIcon); the recruit branch of vnom Symbiotic Adaptation's count-scaled choose-one
  | 'shield-levels'; // why: WP-677 / D-24493 — your S.H.I.E.L.D. Level = the count of S.H.I.E.L.D./HYDRA cards in your Victory Pile (isShieldOrHydra); the whole pile, NO self-exclusion (it checks, never consumes). Marker-safe slug (NOT the dotted ledger name s.h.i.e.l.d.-levels)

// why: canonical array for drift-detection. Must match HeroCountSource union
// exactly. Drift-detection test in hero/heroCountSource.resolve.test.ts asserts
// array/union parity.

/**
 * All count sources in canonical order. Single source of truth.
 */
export const HERO_COUNT_SOURCES: readonly HeroCountSource[] = [
  'victory-bystanders', // why: D-24016 — counts the player's victory-pile bystanders (both ext_id forms)
  'worthy-cards-played-this-turn', // why: WP-673 / D-24488 — counts OTHER cards played this turn that make you Worthy (a Hero costing >= 5, per D-24464)
  'cost-four-plus-played-this-turn', // why: WP-674 / D-24489 — counts OTHER cards played this turn that cost 4 or more
  'attack-icon-played-this-turn', // why: WP-675 / D-24490 — counts OTHER cards played this turn that show an attack icon (hasAttackIcon)
  'recruit-icon-played-this-turn', // why: WP-675 / D-24490 — counts OTHER cards played this turn that show a recruit icon (hasRecruitIcon)
  'shield-levels', // why: WP-677 / D-24493 — the count of S.H.I.E.L.D./HYDRA cards in the player's Victory Pile (isShieldOrHydra); no self-exclusion
] as const;

// ---------------------------------------------------------------------------
// CountScaledChoiceOption (WP-675 / D-24490)
// ---------------------------------------------------------------------------

/**
 * One option of a count-scaled choose-one hero ability (WP-675 / D-24490).
 *
 * vnom's Symbiotic Adaptation prints "Choose one: +1 recruit for each other card
 * with a recruit icon / Or +1 attack for each other card with an attack icon."
 * Each option grants `magnitude × resolveCountSource(G, playerID, countSource, cardId)`
 * of `resource`, reusing the shipped attack-per-count / recruit-per-count executors —
 * the choice only selects WHICH option's grant is applied. Carried on the effect
 * descriptor at parse time and copied onto the PendingCountScaledChoice at park time;
 * the counts are resolved at RESOLVE time from `G`, not stored (the draw-or-empowered
 * pattern of carrying the descriptor, not the outcome).
 */
export interface CountScaledChoiceOption {
  /** Which resource this option grants. */
  resource: 'attack' | 'recruit';
  /** The count source whose count scales the per-unit magnitude. */
  countSource: HeroCountSource;
  /** The per-unit rate (attack/recruit granted per counted card). */
  magnitude: number;
}
