/**
 * Consumer-side parser + validator for ReplaySnapshotSequence JSON artifacts.
 *
 * Pure helper used by the file-input loader and by tests. Reads a raw JSON
 * string, asserts the WP-063 / D-6303 version-1 contract, and returns a
 * typed ReplaySnapshotSequence on success. Throws full-sentence Error on
 * the three documented failure cases (invalid version, missing snapshots,
 * empty snapshots).
 *
 * No I/O, no wall-clock reads, no non-engine RNG. The browser File API
 * (the I/O site) is owned by ReplayFileLoader.vue; this module is the
 * pure-string entry point so tests can exercise it without jsdom.
 */

// why: ReplaySnapshotSequence is defined once by WP-063 in the engine
// barrel (packages/game-engine/src/replay/replaySnapshot.types.ts, exported
// at packages/game-engine/src/index.ts). Type-only import keeps the client
// out of the engine runtime per the Layer Boundary — `apps/arena-client/`
// is the `client-app` category and may import engine types but never
// engine runtime code. Redefining the shape locally would create a second
// canonical source that could silently drift from the engine.
import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine';

const IN_MEMORY_SOURCE_LABEL = 'in-memory';

/**
 * Parses a raw JSON string into a typed ReplaySnapshotSequence.
 *
 * Asserts the consumer-side D-6303 contract: `version === 1`, `snapshots`
 * present, `snapshots` non-empty. The three error templates below are
 * locked verbatim by EC-074 and mirror the WP-063 CLI wording at
 * `apps/replay-producer/src/cli.ts` so producer (stderr) and consumer
 * (in-browser alert region) agree on diagnostic phrasing.
 *
 * @param raw - The replay file body as a UTF-8 string.
 * @param source - Optional origin label (filename, URL, etc.) for error
 *                 messages. Defaults to "in-memory" when omitted.
 * @returns The parsed and validated ReplaySnapshotSequence.
 * @throws Error with one of the three locked templates when validation
 *               fails, or with a JSON-parse error when `raw` is not valid
 *               JSON.
 */
export function parseReplayJson(
  raw: string,
  source?: string,
): ReplaySnapshotSequence {
  const sourceLabel = source ?? IN_MEMORY_SOURCE_LABEL;
  const parsed: unknown = JSON.parse(raw);

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `Replay file ${sourceLabel} must be a JSON object at the top level; received ${describeNonObject(parsed)}.`,
    );
  }

  const candidate = parsed as Record<string, unknown>;

  // why: literal `1` is the WP-063 / D-6303 version seam. Engine produces
  // exactly this value; any other value indicates a schema bump (v2+) that
  // requires a matching consumer update before the inspector can render
  // the file safely. Throwing loudly here is preferable to silently
  // rendering a partially-incompatible newer format.
  if (candidate.version !== 1) {
    throw new Error(
      `Replay file ${sourceLabel} field "version" must be the literal 1; received ${JSON.stringify(candidate.version)}.`,
    );
  }

  if (!('snapshots' in candidate)) {
    throw new Error(
      `Replay file ${sourceLabel} is missing required field "snapshots".`,
    );
  }

  const snapshots = candidate.snapshots;
  if (!Array.isArray(snapshots)) {
    throw new Error(
      `Replay file ${sourceLabel} field "snapshots" must be an array of UIState projections.`,
    );
  }

  if (snapshots.length === 0) {
    throw new Error(
      `Replay file ${sourceLabel} field "snapshots" must contain at least one UIState; received an empty array.`,
    );
  }

  return candidate as unknown as ReplaySnapshotSequence;
}

/**
 * Produces a human-readable label for a non-object top-level JSON value.
 * Used only by the top-level shape error template.
 */
function describeNonObject(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}
