/**
 * Deterministic state hashing for the Legendary Arena replay harness.
 *
 * Computes a canonical hash of LegendaryGameState using sorted-key JSON
 * serialization and the djb2 string hash algorithm. Used for equality
 * comparison between replay runs to prove determinism.
 */

import type { LegendaryGameState } from '../types.js';

// why: canonical serialization ensures the same G always produces the same
// hash regardless of JavaScript property insertion order. Object keys are
// sorted alphabetically at every nesting level. Arrays preserve order
// (element order is semantically meaningful in zones and piles).
/**
 * JSON.stringify replacer that sorts object keys alphabetically.
 *
 * Ensures deterministic serialization regardless of property insertion order.
 * Arrays are left in their original order since element ordering is meaningful
 * (e.g., deck order, zone contents).
 */
function sortedKeyReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const objectKey of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[objectKey] = (value as Record<string, unknown>)[objectKey];
    }
    return sorted;
  }
  return value;
}

// why: djb2 is a simple, well-known, deterministic string hash. It produces
// a numeric hash that we convert to a hex string. No crypto dependency is
// needed — this is for equality comparison between replay runs, not for
// security or tamper detection.
/**
 * Computes the djb2 hash of a string and returns it as a hex string.
 *
 * djb2 is a fast, deterministic hash function suitable for equality
 * comparison. Not cryptographically secure — used only for replay
 * determinism verification.
 */
function djb2Hash(input: string): string {
  let hash = 5381;
  for (let charIndex = 0; charIndex < input.length; charIndex++) {
    // why: the djb2 algorithm multiplies by 33 and adds the character code.
    // Using bitwise shift (hash << 5) + hash is equivalent to hash * 33.
    hash = ((hash << 5) + hash + input.charCodeAt(charIndex)) | 0;
  }
  // why: convert to unsigned 32-bit integer before hex conversion to avoid
  // negative hex strings from JavaScript's signed 32-bit integer arithmetic.
  return (hash >>> 0).toString(16);
}

/**
 * Computes a deterministic hash of the game state using canonical JSON
 * serialization with sorted keys and the djb2 hash algorithm.
 *
 * The same LegendaryGameState always produces the same hash, regardless of
 * JavaScript property insertion order. Different states produce different
 * hashes (with normal hash collision caveats).
 *
 * @param gameState - The game state to hash.
 * @returns A hex string hash of the canonical serialization.
 */
export function computeStateHash(gameState: LegendaryGameState): string {
  const canonicalJson = JSON.stringify(gameState, sortedKeyReplacer);
  return djb2Hash(canonicalJson);
}
