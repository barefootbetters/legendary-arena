/**
 * Determinism invariant checks for the Legendary Arena game engine.
 *
 * Pure check functions that read G and assert determinism invariants
 * via assertInvariant. None of these functions mutate G, perform I/O,
 * or import the game framework. The serialization roundtrip check uses a
 * local deep-equal helper instead of node:assert to keep
 * non-test engine code free of test-runtime dependencies.
 */

import type { LegendaryGameState } from '../types.js';
import { assertInvariant } from './assertInvariant.js';

/**
 * Minimal structural equality check for JSON-serialized values.
 *
 * Recursively compares two values for deep equality. Used only by
 * checkSerializationRoundtrip to detect lossy JSON serialization
 * (undefined values silently dropped, NaN serialized as null, etc.).
 */
// why: not a general-purpose deep-equal — assumes both inputs came
// from JSON.parse (or are JSON-compatible) and only contain plain
// objects, arrays, strings, numbers, booleans, and null. Defined
// locally to avoid importing node:assert into runtime engine code.
function isStructurallyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      if (!isStructurallyEqual(a[index], b[index])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>).sort();
    const keysB = Object.keys(b as Record<string, unknown>).sort();
    if (keysA.length !== keysB.length) return false;
    for (let index = 0; index < keysA.length; index += 1) {
      if (keysA[index] !== keysB[index]) return false;
    }
    for (const key of keysA) {
      const valueA = (a as Record<string, unknown>)[key];
      const valueB = (b as Record<string, unknown>)[key];
      if (!isStructurallyEqual(valueA, valueB)) return false;
    }
    return true;
  }
  return false;
}

/**
 * Asserts that no value in G is a function.
 *
 * Functions are not JSON-serializable and would silently disappear
 * during snapshot persistence and replay reconstruction. Handler
 * functions belong in the ImplementationMap (outside G), not in G
 * itself. This deep scan catches accidental closures, callbacks,
 * and method references stored in G under any key.
 */
// why: prevents determinism corruption per D-0002. A function in G
// would JSON.stringify to undefined, breaking snapshot/replay
// reconstruction silently. Functions belong in the
// ImplementationMap that lives outside G — see WP-009B and the
// rule pipeline's two-registry pattern.
export function checkNoFunctionsInG(G: LegendaryGameState): void {
  assertInvariant(
    !hasFunction(G as unknown),
    'determinism',
    'G must be JSON-serializable at all times (D-0002). A function value was detected somewhere in G — functions cannot be serialized or replayed. Inspect any code that assigns to G for accidentally storing a callback, closure, or method reference. Handlers belong in the ImplementationMap, not in G.',
  );
}

/**
 * Recursively scans an unknown value for function members.
 * Returns true at the first function found; otherwise false.
 */
function hasFunction(value: unknown): boolean {
  if (typeof value === 'function') return true;
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (hasFunction(entry)) return true;
    }
    return false;
  }
  // why: deterministic error reproducibility — fail-fast must identify
  // the same offending key on every run against the same broken G.
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const key of keys) {
    if (hasFunction((value as Record<string, unknown>)[key])) return true;
  }
  return false;
}

/**
 * Asserts that JSON.parse(JSON.stringify(G)) produces a structurally
 * equal object to G.
 *
 * Detects lossy serialization that JSON.stringify silently allows:
 * undefined values dropped from objects (but kept as null in arrays),
 * NaN/Infinity becoming null, etc. checkGIsSerializable (structural)
 * asserts the operation succeeds; this check (determinism) asserts
 * the operation is identity-preserving. Both are required (RS-7).
 */
// why: determinism — roundtrip is identity-preserving. Lossy
// serialization would break replay reproducibility silently: the
// in-memory G that produced a move would differ from the
// reconstructed G after snapshot reload, causing determinism
// violations downstream that point at the move system rather than
// at the lost field. Catching the loss at structural-check time
// localizes the bug.
export function checkSerializationRoundtrip(G: LegendaryGameState): void {
  let identityPreserved = false;
  try {
    const serialized = JSON.stringify(G);
    const parsed = JSON.parse(serialized) as unknown;
    identityPreserved = isStructurallyEqual(parsed, G as unknown);
  } catch {
    // why: catching is intentional — checkGIsSerializable handles the
    // throw case under the structural category. This check only
    // cares about identity preservation; if stringify itself failed,
    // we report identity not preserved and let checkGIsSerializable
    // own the structural diagnosis.
    identityPreserved = false;
  }
  assertInvariant(
    identityPreserved,
    'determinism',
    'G serialization roundtrip must preserve structural identity — JSON.parse(JSON.stringify(G)) produced an object that does not deep-equal G. Inspect G for undefined values, NaN, Infinity, or non-enumerable properties that JSON serialization silently dropped or mutated.',
  );
}
