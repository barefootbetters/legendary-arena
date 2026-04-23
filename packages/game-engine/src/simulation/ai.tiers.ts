/**
 * AI policy tier taxonomy for the Legendary Arena balance simulation
 * framework (WP-049).
 *
 * Defines the five-tier policy spectrum used for PAR calibration and tier
 * ordering validation. Only T2 (Competent Heuristic) may define PAR values —
 * the other tiers exist for smoke testing (T0), regression baselining (T1),
 * upper-bound validation (T3), and research (T4).
 *
 * Pure data types and readonly arrays only. No runtime values beyond the
 * canonical tier lists, no boardgame.io imports, no registry imports.
 */

// why: only T2 may define PAR. T0 (RandomPolicy) ships in WP-036; T2
// (Competent Heuristic) ships in this packet; T1, T3, T4 are future work.
// The taxonomy is published here as a stable contract so downstream WPs
// (WP-050 artifact writer, WP-051 leaderboard gate) can pin to the union
// members without re-deriving them.

/**
 * Canonical AI policy tier identifier.
 *
 * The five-tier spectrum spans from trivially-random (T0) to near-optimal
 * (T4). Tier identifiers are opaque two-character strings — never render
 * them to players or surface them outside calibration tooling.
 */
export type AIPolicyTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4';

/**
 * Canonical readonly array of every AIPolicyTier member.
 *
 * Kept in one-to-one correspondence with the AIPolicyTier union via a
 * drift-detection test (par.aggregator.test.ts test #11). Adding or
 * removing a tier requires updating both the union and this array in the
 * same commit.
 */
export const AI_POLICY_TIERS: readonly AIPolicyTier[] = [
  'T0',
  'T1',
  'T2',
  'T3',
  'T4',
] as const;

/**
 * Reference-taxonomy record for a single AIPolicyTier.
 *
 * Every tier carries a human-readable name, its intended calibration
 * purpose, and a flag indicating whether it participates in PAR
 * computation. Exactly one entry (T2) has `usedForPar === true`.
 */
export interface AIPolicyTierDefinition {
  /** Tier identifier (T0 through T4). */
  readonly tier: AIPolicyTier;
  /** Human-readable tier label (e.g., 'Competent Heuristic'). */
  readonly name: string;
  /** Short prose purpose description, one sentence fragment. */
  readonly purpose: string;
  /** True only for T2 (the sole PAR authority); all other entries are false. */
  readonly usedForPar: boolean;
}

/**
 * Canonical reference taxonomy for the five AI policy tiers.
 *
 * The `usedForPar` flag is true for exactly one entry — T2 — because only
 * the Competent Heuristic policy models experienced human play closely
 * enough to establish a trustworthy scenario-difficulty baseline. T0/T1
 * play too weakly; T3/T4 play too strongly. Drift-pinned by
 * par.aggregator.test.ts test #12.
 */
export const AI_POLICY_TIER_DEFINITIONS: readonly AIPolicyTierDefinition[] = [
  {
    tier: 'T0',
    name: 'Random Legal',
    purpose: 'Sanity / smoke tests',
    usedForPar: false,
  },
  {
    tier: 'T1',
    name: 'Naive',
    purpose: 'Regression baseline',
    usedForPar: false,
  },
  {
    tier: 'T2',
    name: 'Competent Heuristic',
    purpose: 'Primary PAR calibration',
    usedForPar: true,
  },
  {
    tier: 'T3',
    name: 'Strong Heuristic',
    purpose: 'Upper-bound validation',
    usedForPar: false,
  },
  {
    tier: 'T4',
    name: 'Near-Optimal',
    purpose: 'Research only',
    usedForPar: false,
  },
] as const;
