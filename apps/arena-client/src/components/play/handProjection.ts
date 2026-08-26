// why: WP-609 / D-24420 — the math behind the Deck Probability Panel's "Next
// hand" section. It projects the viewing player's NEXT hand: the expected
// recruit/attack (an EXACT two-stage mean) plus a p10/p90 range (an
// injectable-RNG Monte Carlo). CLIENT-SIDE ADVISORY ONLY: engine TYPES plus the
// HAND_SIZE single-source-of-truth const, never a `boardgame.io`/engine-LOGIC
// runtime import, never `ctx.random`, never a game-state write. All math lives
// here and is pure; the component supplies the pool and a seeded `rng`.
//
// The engine draws a hand by taking cards off the TOP of the draw deck, and only
// when the deck runs out does it reshuffle the discard pile into a fresh deck and
// keep drawing (drawCards.logic.ts). So the projection is genuinely two-stage:
// the deck's cards are drawn first (certain, when the deck is short), and the
// remainder comes from a reshuffled discard. A single combined-pool draw would
// misprice a short deck — e.g. deck=[10,10], discard=5×[0] projects 20 (both
// tens are certain), not the ~17.1 a 7-card single pool would give.
//
// @see WP-609 / EC-644; D-24420; wiki/deck-probability-panel.md
import { HAND_SIZE } from '@legendary-arena/game-engine';
import type { UIDeckCardStat } from '@legendary-arena/game-engine';

/**
 * The two stat channels this section projects. `cost` is carried on
 * `UIDeckCardStat` but is not part of a hand's spendable output, so it is not
 * projected here.
 */
export type ProjectedStat = 'recruit' | 'attack';

/**
 * Default Monte Carlo sample count for the range. Large enough that the p10/p90
 * band is visually stable frame-to-frame (given a stable seed), small enough to
 * recompute cheaply on every snapshot.
 */
export const HAND_PROJECTION_SAMPLE_COUNT = 400;

/**
 * The viewer's draw pool as the panel sees it: the order-stripped draw deck
 * (`deckComposition`), the discard pile (`discardCards`), and the owner-only
 * per-card recruit/attack/cost map (`deckCardStats`), all off the WP-606 / WP-608
 * UIState projection.
 */
export interface HandProjectionPool {
  deck: readonly string[];
  discard: readonly string[];
  stats: Readonly<Record<string, UIDeckCardStat>>;
}

/**
 * A low/high band around an expected value.
 */
export interface ProjectionRange {
  low: number;
  high: number;
}

/**
 * The projected next hand: the exact expected recruit/attack plus a p10/p90
 * range for each.
 */
export interface HandProjection {
  expectedRecruit: number;
  expectedAttack: number;
  recruitRange: ProjectionRange;
  attackRange: ProjectionRange;
}

/**
 * How many cards come off the deck versus the reshuffled discard when the next
 * hand of `HAND_SIZE` is drawn: the deck is drawn first, the discard supplies
 * only the shortfall.
 */
export interface DrawSplit {
  fromDeck: number;
  fromDiscard: number;
}

/**
 * Computes the two-stage draw split for the next hand: `min(HAND_SIZE, |deck|)`
 * off the deck, then the remaining need (capped at the discard size) off the
 * reshuffled discard.
 */
export function nextHandDrawSplit(deckSize: number, discardSize: number): DrawSplit {
  const fromDeck = Math.min(HAND_SIZE, deckSize);
  const fromDiscard = Math.min(HAND_SIZE - fromDeck, discardSize);
  return { fromDeck, fromDiscard };
}

/**
 * Sums one stat channel across a list of CardExtIds, treating a missing
 * `deckCardStats` entry as 0 (a Phase-1 gap, not a crash).
 */
function sumStat(
  extIds: readonly string[],
  stats: Readonly<Record<string, UIDeckCardStat>>,
  channel: ProjectedStat,
): number {
  let total = 0;
  // why: explicit for...of (not a branching reduce) per 00.6 — one lookup and
  // add per card; an ext_id with no stats entry contributes 0.
  for (const extId of extIds) {
    const stat = stats[extId];
    if (stat !== undefined) {
      total += stat[channel];
    }
  }
  return total;
}

/**
 * The expected value of one stat channel drawn from a single zone: the number of
 * cards drawn times the zone's per-card mean. 0 when the zone is empty or no
 * cards are drawn from it.
 */
function zoneExpectedValue(
  zone: readonly string[],
  drawCount: number,
  stats: Readonly<Record<string, UIDeckCardStat>>,
  channel: ProjectedStat,
): number {
  // why: guard the empty zone / no-draw case so the mean is never 0/0 = NaN.
  if (zone.length === 0 || drawCount === 0) {
    return 0;
  }
  return drawCount * (sumStat(zone, stats, channel) / zone.length);
}

/**
 * The EXACT expected recruit/attack of the next hand — the closed-form two-stage
 * mean, no sampling. `E = fromDeck·meanDeck + fromDiscard·meanDiscard` per
 * channel. This is the number the panel shows as "expected"; the Monte Carlo
 * below is only for the range.
 */
export function expectedNextHand(pool: HandProjectionPool): {
  recruit: number;
  attack: number;
} {
  const split = nextHandDrawSplit(pool.deck.length, pool.discard.length);
  const recruit =
    zoneExpectedValue(pool.deck, split.fromDeck, pool.stats, 'recruit') +
    zoneExpectedValue(pool.discard, split.fromDiscard, pool.stats, 'recruit');
  const attack =
    zoneExpectedValue(pool.deck, split.fromDeck, pool.stats, 'attack') +
    zoneExpectedValue(pool.discard, split.fromDiscard, pool.stats, 'attack');
  return { recruit, attack };
}

/**
 * Draws `count` cards without replacement from a copy of `cards`, using the
 * supplied `rng`. A partial Fisher-Yates over the first `count` positions — the
 * input is never mutated.
 */
function drawWithoutReplacement(
  cards: readonly string[],
  count: number,
  rng: () => number,
): string[] {
  const pool = [...cards];
  const drawCount = Math.min(count, pool.length);
  const drawn: string[] = [];
  for (let position = 0; position < drawCount; position += 1) {
    // why: pick a uniform index in the not-yet-drawn tail and swap it forward —
    // sampling without replacement via the injected rng (seeded stably in the
    // component so the range does not jitter; seeded per-test for determinism).
    const pick = position + Math.floor(rng() * (pool.length - position));
    const chosen = pool[pick] as string;
    pool[pick] = pool[position] as string;
    pool[position] = chosen;
    drawn.push(chosen);
  }
  return drawn;
}

/**
 * Returns the value at `fraction` (0..1) of an ascending-sorted sample array by
 * nearest-rank. Empty input yields 0.
 */
function percentile(sortedAscending: readonly number[], fraction: number): number {
  if (sortedAscending.length === 0) {
    return 0;
  }
  const index = Math.floor(fraction * (sortedAscending.length - 1));
  return sortedAscending[index] as number;
}

/**
 * Runs the two-stage Monte Carlo `sampleCount` times and returns the p10/p90
 * range for each channel. Each sample draws `fromDeck` cards without replacement
 * off the deck, then `fromDiscard` off the discard (the reshuffle the engine
 * performs on deck exhaustion), and sums the drawn cards' stats.
 */
export function sampleNextHandRange(
  pool: HandProjectionPool,
  rng: () => number,
  sampleCount: number,
): { recruit: ProjectionRange; attack: ProjectionRange } {
  const split = nextHandDrawSplit(pool.deck.length, pool.discard.length);
  const recruitSamples: number[] = [];
  const attackSamples: number[] = [];
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const deckDraw = drawWithoutReplacement(pool.deck, split.fromDeck, rng);
    const discardDraw = drawWithoutReplacement(pool.discard, split.fromDiscard, rng);
    recruitSamples.push(
      sumStat(deckDraw, pool.stats, 'recruit') + sumStat(discardDraw, pool.stats, 'recruit'),
    );
    attackSamples.push(
      sumStat(deckDraw, pool.stats, 'attack') + sumStat(discardDraw, pool.stats, 'attack'),
    );
  }
  recruitSamples.sort((first, second) => first - second);
  attackSamples.sort((first, second) => first - second);
  return {
    recruit: { low: percentile(recruitSamples, 0.1), high: percentile(recruitSamples, 0.9) },
    attack: { low: percentile(attackSamples, 0.1), high: percentile(attackSamples, 0.9) },
  };
}

/**
 * The full projection: the exact expected recruit/attack plus a sampled p10/p90
 * range for each. `sampleCount` defaults to `HAND_PROJECTION_SAMPLE_COUNT`.
 */
export function projectNextHand(
  pool: HandProjectionPool,
  rng: () => number,
  sampleCount: number = HAND_PROJECTION_SAMPLE_COUNT,
): HandProjection {
  const expected = expectedNextHand(pool);
  const range = sampleNextHandRange(pool, rng, sampleCount);
  return {
    expectedRecruit: expected.recruit,
    expectedAttack: expected.attack,
    recruitRange: range.recruit,
    attackRange: range.attack,
  };
}

/**
 * Derives a STABLE numeric seed from the current pool — a deterministic function
 * of the deck and discard so the Monte Carlo range does not re-roll between
 * recomputes of the same state, yet shifts as the pool changes each draw. A cheap
 * rolling hash over the zone sizes and their CardExtIds; not security-sensitive.
 */
export function seedFromPool(
  deck: readonly string[],
  discard: readonly string[],
): number {
  let seed = ((deck.length * 131) + discard.length) >>> 0;
  // why: fold every ext_id's characters in so a like-sized-but-different pool
  // gets a different seed; `>>> 0` keeps the accumulator a 32-bit unsigned int
  // for createSpeculativePrng.
  for (const extId of deck) {
    for (let index = 0; index < extId.length; index += 1) {
      seed = ((seed * 31) + extId.charCodeAt(index)) >>> 0;
    }
  }
  for (const extId of discard) {
    for (let index = 0; index < extId.length; index += 1) {
      seed = ((seed * 31) + extId.charCodeAt(index)) >>> 0;
    }
  }
  return seed;
}
