/**
 * Determinism verification for the Legendary Arena game engine.
 *
 * verifyDeterminism runs the same ReplayInput twice and compares state
 * hashes. If the engine is truly deterministic, identical inputs must
 * produce identical final states.
 *
 * Implements D-0201 (Replay as a First-Class Feature) and validates
 * D-0002 (Determinism Is Non-Negotiable).
 */

import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { ReplayInput } from './replay.types.js';
import { replayGame } from './replay.execute.js';

/**
 * Result of a determinism verification check.
 */
export interface DeterminismResult {
  readonly identical: boolean;
  readonly hash1: string;
  readonly hash2: string;
}

/**
 * Verifies determinism by running the same ReplayInput twice and comparing
 * state hashes.
 *
 * If the hashes match, the engine produced identical output from identical
 * input — determinism holds. If the hashes differ, nondeterminism is present
 * in the engine and must be investigated.
 *
 * Pure function — no I/O, no side effects.
 *
 * @param input - The canonical replay input to verify.
 * @param registry - Card registry reader for setup-time resolution.
 * @returns Whether the two runs produced identical hashes.
 */
export function verifyDeterminism(
  input: ReplayInput,
  registry: CardRegistryReader,
): DeterminismResult {
  // why: two-run comparison proves determinism — if the engine is truly
  // deterministic, identical inputs must produce identical final states.
  // If hashes differ, nondeterminism is present in the engine.
  const result1 = replayGame(input, registry);
  const result2 = replayGame(input, registry);

  return {
    identical: result1.stateHash === result2.stateHash,
    hash1: result1.stateHash,
    hash2: result2.stateHash,
  };
}
