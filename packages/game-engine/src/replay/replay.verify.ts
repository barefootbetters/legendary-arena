/**
 * Determinism verification for the Legendary Arena game engine.
 *
 * verifyDeterminism runs the same ReplayInput twice and compares state
 * hashes. If the engine is truly deterministic, identical inputs must
 * produce identical final states.
 *
 * Implements D-0201 (Replay as a First-Class Feature) and validates
 * D-0002 (Determinism Is Non-Negotiable).
 *
 * This module inherits the determinism-only scope established for the
 * replay harness in D-0205: it verifies reducer determinism under the
 * fixed mock RNG that `replayGame` supplies, not live-match
 * reproducibility.
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
 * Verifies reducer determinism by running the same ReplayInput twice
 * through the determinism-only replay harness and comparing state hashes.
 *
 * If the two runs produce identical hashes, the engine reducer is
 * deterministic under the fixed mock RNG that `replayGame` supplies;
 * divergent hashes mean nondeterminism is present in the reducer and
 * must be investigated. This is the narrowed claim of the harness: it
 * does not demonstrate that the engine reconstructs a production
 * boardgame.io match, since production matches use boardgame.io's
 * seeded `ctx.random.*` and this harness ignores `ReplayInput.seed`.
 * See `docs/ai/DECISIONS.md §D-0205` for the decision that scopes the
 * harness this way.
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
