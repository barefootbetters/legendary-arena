/**
 * Seedable pseudo-random number generator + Fisher-Yates shuffle helpers
 * for the speculative pre-planning sandbox.
 *
 * Non-authoritative by construction. Speculative randomness in this layer
 * is locally determinable per DESIGN-PREPLANNING §3: a waiting player can
 * plan against a shuffled deck copy without consulting the authoritative
 * engine-side randomness primitives. These helpers never influence the
 * real deck order — the engine remains the sole authority on real shuffle
 * outcomes.
 *
 * All three helpers are pure and free of framework imports.
 */

/**
 * Create a deterministic pseudo-random number generator from a numeric seed.
 *
 * Uses the Numerical Recipes linear-congruential generator. Given the same
 * seed, the returned function produces the same sequence of values on every
 * call — this is the property speculative shuffles rely on to reproduce
 * sandbox deck orders across rewinds.
 *
 * @param seed - A 32-bit unsigned integer seed. Any numeric input is
 *   coerced to 32-bit unsigned via `>>> 0`.
 * @returns A zero-argument function that returns a fresh value in the
 *   half-open interval [0, 1) on each call.
 */
export function createSpeculativePrng(seed: number): () => number {
  // why: algorithm changes require updating snapshot tests (changing the
  // algorithm changes shuffle output for existing seeds)
  const multiplier = 1664525;
  const increment = 1013904223;
  let state = seed >>> 0;
  return () => {
    state = (state * multiplier + increment) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Produce a shuffled copy of the input array using Fisher-Yates with a
 * caller-supplied pseudo-random source.
 *
 * The input array is never mutated. The returned array has the same length
 * and contains exactly the same elements, reordered according to the
 * supplied random function.
 *
 * @param items - The array to shuffle. Read-only; never mutated.
 * @param random - A zero-argument function returning values in [0, 1).
 *   Typically obtained from `createSpeculativePrng`.
 * @returns A fresh array with the same elements in shuffled order.
 */
export function speculativeShuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const atI = shuffled[i] as T;
    const atJ = shuffled[j] as T;
    shuffled[i] = atJ;
    shuffled[j] = atI;
  }
  return shuffled;
}

/**
 * Generate a reasonably-unique seed for a fresh speculative pre-plan.
 *
 * Callers that want reproducibility across sessions should supply their
 * own seed rather than calling this helper. This helper exists solely for
 * the default "I want a speculative shuffle right now" flow and produces
 * a different seed on each call during normal execution.
 *
 * @returns A numeric seed suitable for `createSpeculativePrng`.
 */
export function generateSpeculativeSeed(): number {
  // why: non-authoritative layer; speculative randomness per
  // DESIGN-PREPLANNING §3 — the engine's authoritative randomness
  // primitives remain the sole authority for real deck order
  return Date.now();
}
