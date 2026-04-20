/**
 * Builds a portable ReplaySnapshotSequence by wrapping the WP-027 replay
 * harness (buildInitialGameState + applyReplayStep) and the WP-028 UIState
 * projection (buildUIState) into a single deterministic call.
 *
 * This helper is the engine-side seam for WP-064's ReplayInspector and any
 * future replay-consuming tool. It composes existing engine surface only —
 * it defines no new moves, phases, or reducers. The returned sequence is
 * frozen (outer object + snapshots array) before return; no input is
 * mutated.
 *
 * Pure function per the cli-producer-app / game-engine boundary (D-6301):
 * no I/O, no logging, no wall-clock reads, no non-engine RNG, and no
 * boardgame.io import. The CLI producer app owns all I/O and wall-clock
 * concerns; this helper is data-in / data-out. Verification Step 3 greps
 * for the forbidden API names and must return no match.
 *
 * Determinism-only semantics (D-0205): applyReplayStep inherits the
 * reverse-shuffle mock RNG from buildMoveContext, so seed-faithful replay
 * is out of scope. The helper accepts the seed field for spec fidelity
 * and downstream traceability but does not feed it into any RNG.
 */

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { ReplayMove } from './replay.types.js';
import type { ReplaySnapshotSequence } from './replaySnapshot.types.js';
import type { UIState } from '../ui/uiState.types.js';
import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { buildUIState } from '../ui/uiState.build.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { applyReplayStep } from './replay.execute.js';

/**
 * Parameters for buildSnapshotSequence.
 *
 * Mirrors the WP-027 ReplayInput surface (seed, setupConfig, playerOrder,
 * moves) plus an engine-side registry reader and optional output metadata.
 * The registry reader is required because buildInitialGameState resolves
 * card data at setup time; D-6305 records the rationale for surfacing it
 * here rather than inferring from a global.
 */
export interface BuildSnapshotSequenceParams {
  /** Canonical 9-field match setup payload. */
  readonly setupConfig: MatchSetupConfig;

  /** Seed string; retained for traceability. Determinism-only harness ignores it per D-0205. */
  readonly seed: string;

  /** Ordered player ID list; length determines numPlayers. */
  readonly playerOrder: readonly string[];

  /** Ordered move records applied one-at-a-time via applyReplayStep. */
  readonly moves: readonly ReplayMove[];

  /** Card registry reader forwarded to buildInitialGameState. */
  readonly registry: CardRegistryReader;

  /** Optional output metadata; omitted from the returned sequence when absent per D-6303. */
  readonly metadata?: {
    readonly matchId?: string;
    readonly seed?: string;
    readonly producedAt?: string;
  };
}

/**
 * Drives the engine through Game.setup() and each ordered move, capturing
 * a UIState projection after each step.
 *
 * snapshots[0] is post-setup; snapshots[i>0] is the state after the i-th
 * move is applied. snapshots.length === moves.length + 1 at every
 * well-formed call. buildUIState is invoked exactly moves.length + 1 times
 * per call.
 *
 * Returns a frozen ReplaySnapshotSequence whose outer object and snapshots
 * array are Object.freeze-d before return. The seed parameter is retained
 * for traceability; it does not influence game progression (D-0205).
 *
 * @param params - Setup payload, move list, registry reader, and optional metadata.
 * @returns A frozen ReplaySnapshotSequence with exactly moves.length + 1 snapshots.
 */
export function buildSnapshotSequence(
  params: BuildSnapshotSequenceParams,
): ReplaySnapshotSequence {
  const numPlayers = params.playerOrder.length;
  const setupContext = makeMockCtx({ numPlayers });
  const gameState = buildInitialGameState(
    params.setupConfig,
    params.registry,
    setupContext,
  );

  const firstPlayerId = params.playerOrder[0] ?? '0';

  // why: snapshots include index 0 (post-setup) so consumers can render the
  // opening state without re-running the engine client-side. The loop below
  // then appends one snapshot per applied move, yielding final length
  // moves.length + 1. buildUIState is called exactly once per snapshot.
  const collected: UIState[] = [];
  collected.push(
    buildUIState(gameState, {
      phase: 'play',
      turn: 1,
      currentPlayer: firstPlayerId,
    }),
  );
  for (const move of params.moves) {
    applyReplayStep(gameState, move, numPlayers);
    collected.push(
      buildUIState(gameState, {
        phase: 'play',
        turn: 1,
        currentPlayer: move.playerId,
      }),
    );
  }

  // Build the metadata object from only defined sub-fields (D-6303 omission
  // rule). If the caller passed metadata: undefined, or passed an object
  // with all sub-fields undefined, the returned sequence omits the metadata
  // key entirely rather than carrying an empty object.
  const resolvedMetadata: {
    matchId?: string;
    seed?: string;
    producedAt?: string;
  } = {};
  if (params.metadata?.matchId !== undefined) {
    resolvedMetadata.matchId = params.metadata.matchId;
  }
  if (params.metadata?.seed !== undefined) {
    resolvedMetadata.seed = params.metadata.seed;
  }
  if (params.metadata?.producedAt !== undefined) {
    resolvedMetadata.producedAt = params.metadata.producedAt;
  }
  const hasMetadata = Object.keys(resolvedMetadata).length > 0;

  // why: Object.freeze on both the outer object and the snapshots array is
  // an aliasing defense — consumers must not be able to mutate the returned
  // sequence through any path. The spread-then-freeze pattern copies the
  // local mutable collected array before freezing so internal construction
  // intermediates are not exposed.
  const frozenSnapshots = Object.freeze([...collected]) as readonly UIState[];

  if (hasMetadata) {
    return Object.freeze({
      version: 1 as const,
      snapshots: frozenSnapshots,
      metadata: Object.freeze(resolvedMetadata),
    });
  }
  return Object.freeze({
    version: 1 as const,
    snapshots: frozenSnapshots,
  });
}
