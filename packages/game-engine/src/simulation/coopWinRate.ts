/**
 * Co-op win-rate + loss-cause aggregating harness (WP-452).
 *
 * runCoopWinRate plays one co-op game per seed through the existing simulation
 * runner (via the additive simulateOneCoopGame projection), classifies each
 * game with classifyCoopOutcome, and reports the co-op win rate plus a
 * loss-cause breakdown (scheme-completed vs. villains-escaped vs. tie vs.
 * turn-cap-inconclusive). It is the bot-ally-strength yardstick the later
 * WPs of the Bot Ally Strengthening epic report against — a measured number,
 * not a subjective read.
 *
 * The harness introduces NO randomness of its own: every reported number is a
 * pure function of (matchConfiguration, policyName, seeds) driven through the
 * seed-deterministic runner. Identical inputs yield a byte-identical report.
 *
 * Registry seam: this module imports ONLY the CardRegistryReader TYPE (from
 * matchSetup.validate.ts) — never @legendary-arena/registry or any
 * packages/registry path. The real reader is loaded by scripts/coop-winrate.mjs
 * and passed in as an explicit second param, mirroring runSimulation.
 *
 * No boardgame.io imports. No registry-package imports. No Math.random(). No
 * .reduce() with branching. No IO.
 */

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { EndgameOutcome } from '../endgame/endgame.types.js';
import type { AIPolicy } from './ai.types.js';
import { createRandomPolicy } from './ai.random.js';
import { createCompetentHeuristicPolicy } from './ai.competent.js';
import { simulateOneCoopGame } from './simulation.runner.js';
import { COOP_OUTCOME_CATEGORIES, classifyCoopOutcome } from './coopOutcome.js';
import type { CoopOutcomeCategory } from './coopOutcome.js';

// why: 2 players models the solo + one-bot-ally shape the Bot Ally
// Strengthening epic exists to strengthen; the default keeps the common call
// site (a co-op table of one human seat + one bot ally) explicit-free.
const DEFAULT_COOP_PLAYER_COUNT = 2;

/**
 * The narrow per-game projection the runner surfaces for classification.
 *
 * These are exactly the fields classifyCoopOutcome reads — a strict subset of
 * the runner's internal GameOutcome. simulateOneCoopGame returns this shape so
 * the internal aggregate seam never widens.
 */
export interface CoopGameRecord {
  readonly isHeroesWin: boolean;
  readonly endgameReached: boolean;
  readonly endgameWinner: EndgameOutcome | null;
  readonly escapedVillains: number;
  readonly turns: number;
}

/**
 * The aggregate report runCoopWinRate returns.
 *
 * `byCategory` always carries all five CoopOutcomeCategory keys (even at zero),
 * and the five counts always sum to `games`. `winRate` is `wins / games`, or 0
 * for an empty run (never NaN).
 */
export interface CoopWinRateReport {
  readonly games: number;
  readonly wins: number;
  readonly winRate: number;
  readonly byCategory: Record<CoopOutcomeCategory, number>;
}

/**
 * The input to runCoopWinRate.
 *
 * `registry` is deliberately NOT a field here — it is an explicit second param
 * of runCoopWinRate (mirroring runSimulation) so the engine never loads it.
 * `numPlayers` defaults to DEFAULT_COOP_PLAYER_COUNT (2). Every seat is driven
 * by the same policy name, modelling a fully-cooperative table.
 */
export interface CoopHarnessConfig {
  readonly matchConfiguration: MatchSetupConfig;
  readonly policyName: 'random' | 'competent';
  readonly seeds: readonly string[];
  readonly numPlayers?: number;
}

/**
 * Builds a byCategory tally with all five categories at zero.
 *
 * // why: built by iterating COOP_OUTCOME_CATEGORIES (the canonical closed set)
 * rather than a hand-written object literal, so a future sixth category can
 * never silently be missing a zero seed — mirrors the emptyByReason() precedent
 * in scripts/runtime-observed-hollows.mjs.
 *
 * @returns a fresh Record with every CoopOutcomeCategory key at 0.
 */
function buildZeroedByCategory(): Record<CoopOutcomeCategory, number> {
  const byCategory = {} as Record<CoopOutcomeCategory, number>;
  for (const category of COOP_OUTCOME_CATEGORIES) {
    byCategory[category] = 0;
  }
  return byCategory;
}

/**
 * Constructs a fresh AI policy of the requested name for one seed.
 *
 * @param policyName - which existing policy to build.
 * @param seed - the seed the policy's decision PRNG derives from.
 * @returns a new AIPolicy instance seeded from `seed`.
 */
function createPolicyForSeed(
  policyName: 'random' | 'competent',
  seed: string,
): AIPolicy {
  if (policyName === 'random') {
    return createRandomPolicy(seed);
  }
  return createCompetentHeuristicPolicy(seed);
}

/**
 * Plays one co-op game per seed, classifies each, and aggregates the report.
 *
 * Deterministic and side-effect-free: identical (config, registry) inputs yield
 * a byte-identical CoopWinRateReport. The underlying sim is seed-deterministic,
 * so a game's outcome depends only on its own seed — never its position in the
 * seed list (see the fresh-policy-per-seed note below).
 *
 * @param config - the match configuration, policy name, and seed list.
 * @param registry - card registry reader (explicit second param; the engine
 *   never loads it — the script layer supplies the real reader).
 * @returns the aggregate co-op win-rate + loss-cause report.
 */
export function runCoopWinRate(
  config: CoopHarnessConfig,
  registry: CardRegistryReader,
): CoopWinRateReport {
  const byCategory = buildZeroedByCategory();

  // why: empty seeds → a zeroed report, never a NaN from wins/0 — mirrors
  // runSimulation's zeroedResult guard (config.games < 1). Returning here also
  // keeps the byCategory keys present (all zero) for a stable report shape.
  if (config.seeds.length === 0) {
    return { games: 0, wins: 0, winRate: 0, byCategory };
  }

  const numPlayers = config.numPlayers ?? DEFAULT_COOP_PLAYER_COUNT;

  let wins = 0;
  for (const seed of config.seeds) {
    // why: a FRESH policy instance per seed. The policy holds a stateful
    // decision-domain PRNG (D-2704); reusing one instance across seeds would
    // carry PRNG state between games and make each per-game record depend on
    // its position in the list rather than on its own seed alone.
    const policy = createPolicyForSeed(config.policyName, seed);
    const record = simulateOneCoopGame(
      config.matchConfiguration,
      registry,
      policy,
      seed,
      numPlayers,
    );
    const category = classifyCoopOutcome(record);
    byCategory[category] += 1;
    if (record.isHeroesWin) {
      wins += 1;
    }
  }

  const games = config.seeds.length;
  return { games, wins, winRate: wins / games, byCategory };
}
