/**
 * Replay snapshot sequence contract types for the Legendary Arena game engine.
 *
 * ReplaySnapshotSequence is the portable artifact shape emitted by
 * buildSnapshotSequence and consumed by downstream replay tooling (WP-064's
 * ReplayInspector and future replay-consuming packets). It carries one
 * UIState per engine step — snapshots[0] is post-setup, snapshots[i>0] is
 * the state after the i-th move is applied.
 *
 * ReplayInputsFile is the on-disk shape parsed by apps/replay-producer.
 *
 * No boardgame.io imports. No runtime state. Pure type definitions only.
 */

import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { ReplayMove } from './replay.types.js';
import type { UIState } from '../ui/uiState.types.js';

/**
 * The portable replay snapshot sequence contract.
 *
 * Emitted by buildSnapshotSequence and serialized to JSON by the CLI
 * producer app. Consumers receive one UIState per engine step: index 0
 * is post-setup, index i>0 is the state after the i-th move is applied.
 * snapshots.length === moves.length + 1 at every well-formed sequence.
 *
 * Optional fields are OMITTED from serialized output when absent per
 * D-6303 — never serialized as "metadata": null or "metadata": undefined.
 */
export interface ReplaySnapshotSequence {
  // why: literal 1 (not number) is the compile-time seam for version
  // detection. Future format revs must be detectable at type-check time,
  // not guessed from JSON shape at runtime. Bump policy locked by D-6303:
  // additive changes (new optional fields) stay at version 1; any change
  // to snapshots element shape, removal/rename of a documented field, or
  // change to sort semantics requires version: 2. Consumers MUST assert
  // version === 1 and refuse unknown versions with a full-sentence error.
  readonly version: 1;

  /** Ordered UIState projections: index 0 post-setup, index i>0 after move i. */
  readonly snapshots: readonly UIState[];

  /** Optional metadata block; omitted from output when absent. */
  readonly metadata?: {
    /** Caller-supplied match identifier, opaque to the engine. */
    readonly matchId?: string;
    /** Seed string copied from the ReplayInputsFile for traceability. */
    readonly seed?: string;
    /** ISO-8601 timestamp; overridden by CLI --produced-at for determinism tests. */
    readonly producedAt?: string;
  };
}

/**
 * The on-disk replay inputs file shape.
 *
 * Parsed by apps/replay-producer and handed to buildSnapshotSequence.
 * Field names align with WP-027's canonical ReplayInput surface
 * (seed, setupConfig, playerOrder, moves) plus the WP-063 version and
 * optional metadata wrapper per D-6305.
 */
export interface ReplayInputsFile {
  // why: literal 1 mirrors ReplaySnapshotSequence.version and inherits the
  // same additive-at-v1 / breaking-to-v2 bump policy per D-6303. The CLI
  // must assert version === 1 and exit 2 with a full-sentence error for
  // any other value.
  readonly version: 1;

  /** Canonical 9-field match setup payload. */
  readonly setupConfig: MatchSetupConfig;

  /** Seed string; retained for traceability. Determinism-only harness ignores it per D-0205. */
  readonly seed: string;

  /** Ordered player ID list; length determines numPlayers for setup and dispatch. */
  readonly playerOrder: readonly string[];

  /** Ordered move records, applied one-at-a-time via applyReplayStep. */
  readonly moves: readonly ReplayMove[];

  /** Optional metadata block; omitted from parsed output when absent. */
  readonly metadata?: {
    /** Caller-supplied match identifier, opaque to the engine. */
    readonly matchId?: string;
    /** Free-form authoring note, surfaced only in the file. */
    readonly note?: string;
  };
}
