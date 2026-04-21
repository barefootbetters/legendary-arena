/**
 * Random AI policy for the Legendary Arena balance simulation framework.
 *
 * createRandomPolicy builds an AIPolicy whose decideTurn selects a uniformly
 * random entry from the supplied LegalMove array using a seeded mulberry32
 * PRNG. Same seed + same (playerView, legalMoves) sequence produces
 * identical decisions across calls.
 *
 * No boardgame.io imports. No registry imports. No Math.random(). No
 * .reduce(). No IO.
 */

import type { AIPolicy, LegalMove } from './ai.types.js';
import type { UIState } from '../ui/uiState.types.js';
import type { ClientTurnIntent } from '../network/intent.types.js';

// why: random policy establishes the MVP baseline for balance measurement.
// Sophisticated policies (heuristic, MCTS, neural) are future work and will
// plug into the same AIPolicy interface without refactor. Per D-2704
// PRNG capability gap, makeMockCtx reverses arrays — it is NOT a seeded
// PRNG, so simulation implements its own mulberry32 locally.

/**
 * Deterministic 32-bit seed for mulberry32 derived from a string via djb2.
 *
 * // why: djb2 is a tiny deterministic string hash with no crypto
 * dependency; produces a 32-bit integer suitable as a mulberry32 seed.
 * Same input string always produces the same output integer.
 *
 * @param seed - Arbitrary seed string.
 * @returns Non-negative 32-bit integer derived from the seed.
 */
function hashSeedString(seed: string): number {
  let hash = 5381;
  for (const character of seed) {
    hash = ((hash << 5) + hash + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

/**
 * Creates a deterministic mulberry32 PRNG bound to the given 32-bit seed.
 *
 * // why: mulberry32 chosen for deterministic reproducibility + brevity; not
 * a cryptographic PRNG and simulation-internal only. Same seed + same call
 * sequence = same output sequence. Addresses the D-2704 capability gap
 * (makeMockCtx reverses arrays, does not accept a seed).
 *
 * @param seed - 32-bit integer seed.
 * @returns A nullary function returning a float in [0, 1) on each call.
 */
function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let accumulator = state;
    accumulator = Math.imul(accumulator ^ (accumulator >>> 15), accumulator | 1);
    accumulator ^= accumulator + Math.imul(accumulator ^ (accumulator >>> 7), accumulator | 61);
    return ((accumulator ^ (accumulator >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a random AI policy backed by a seeded mulberry32 PRNG.
 *
 * The returned policy closes over its own mulberry32 instance created at
 * this call. Two policies built with the same seed produce identical first
 * decisions for identical (view, moves) inputs, because each starts with a
 * fresh PRNG at state hashSeedString(seed). Subsequent calls advance the
 * same closure's state, so a single policy's decision sequence depends on
 * call order.
 *
 * Policy seed is independent from the simulation run's shuffle seed — the
 * two domains are deliberately separate so a test can reseed one without
 * perturbing the other.
 *
 * // why: random policy establishes the MVP baseline for balance
 * measurement; more sophisticated policies (heuristic, MCTS, neural) are
 * future work and will plug into the same AIPolicy interface without
 * refactor. Per D-2704 capability gap, makeMockCtx is not a seeded PRNG —
 * the policy implements its own mulberry32 closure.
 *
 * @param seed - Non-empty seed string; hashed to 32 bits via djb2.
 * @returns An AIPolicy with a deterministic decideTurn.
 */
export function createRandomPolicy(seed: string): AIPolicy {
  const seedNumber = hashSeedString(seed);
  const nextRandom = createMulberry32(seedNumber);

  return {
    name: `random-${seed}`,
    decideTurn(playerView: UIState, legalMoves: LegalMove[]): ClientTurnIntent {
      if (legalMoves.length === 0) {
        // why: zero-legal-moves fallback per pre-flight RS-6. The random
        // policy returns an endTurn intent so the simulation runner can
        // either dispatch it (if stage === 'cleanup') or flag the game as
        // stuck when endTurn is illegal in the current stage.
        return {
          matchId: `simulation-${seed}`,
          playerId: playerView.game.activePlayerId,
          turnNumber: playerView.game.turn,
          move: { name: 'endTurn', args: {} },
        };
      }
      const index = Math.floor(nextRandom() * legalMoves.length);
      const chosen = legalMoves[index]!;
      return {
        matchId: `simulation-${seed}`,
        playerId: playerView.game.activePlayerId,
        turnNumber: playerView.game.turn,
        move: { name: chosen.name, args: chosen.args },
      };
    },
  };
}
