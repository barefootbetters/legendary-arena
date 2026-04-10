/**
 * Shared test helper for Legendary Arena game engine tests.
 *
 * makeMockCtx returns a minimal SetupContext-compatible object that
 * satisfies boardgame.io's setup context shape without importing from
 * boardgame.io. All game engine tests should use this helper.
 */

import type { SetupContext } from '../types.js';

/**
 * Optional overrides for makeMockCtx.
 */
export interface MockCtxOverrides {
  /** Number of players. Defaults to 2. */
  numPlayers?: number;
}

/**
 * Creates a minimal setup context for testing.
 *
 * The returned object satisfies the SetupContext interface and can be
 * passed to shuffleDeck, buildInitialGameState, and other setup functions.
 *
 * @param overrides - Optional overrides for default values.
 * @returns A SetupContext-compatible test context.
 */
export function makeMockCtx(overrides?: MockCtxOverrides): SetupContext {
  const numPlayers = overrides?.numPlayers ?? 2;

  return {
    ctx: {
      numPlayers,
    },
    random: {
      // why: Shuffle reverses the array instead of returning it unchanged.
      // An identity shuffle would not prove that shuffleDeck actually called
      // context.random.Shuffle — a test could pass even if the shuffle step
      // was accidentally skipped. Reversing produces a predictable,
      // deterministic reordering that confirms the shuffle path executed.
      Shuffle: <T>(deck: T[]): T[] => [...deck].reverse(),
    },
  };
}
