/**
 * Deterministic deck shuffling for Legendary Arena.
 *
 * All shuffling in the engine routes through this function to ensure
 * replay reproducibility. Never use Math.random() anywhere in the engine.
 */

/**
 * Minimal interface for any context that provides deterministic shuffling.
 *
 * Narrower than SetupContext — accepts any object with a random.Shuffle
 * method. This allows shuffleDeck to be called from setup (SetupContext)
 * and from move contexts in future Work Packets (e.g., villain deck
 * reshuffle in revealVillainCard) without fabricating unused fields.
 */
export interface ShuffleProvider {
  random: { Shuffle: <T>(deck: T[]) => T[] };
}

/**
 * Returns a new shuffled copy of the given card array using the
 * deterministic RNG provided by boardgame.io.
 *
 * @param cards - Array of CardExtId strings to shuffle. Not mutated.
 * @param context - Any context that provides random.Shuffle.
 * @returns A new array with the same elements in shuffled order.
 */
export function shuffleDeck(cards: string[], context: ShuffleProvider): string[] {
  // why: context.random.Shuffle provides deterministic shuffling seeded by
  // boardgame.io's PRNG. This ensures identical seeds produce identical
  // deck orders, enabling full replay reproducibility. A copy of the input
  // is passed to guarantee the original array is never mutated.
  return context.random.Shuffle([...cards]);
}
