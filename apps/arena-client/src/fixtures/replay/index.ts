/**
 * Fixture loader for committed ReplaySnapshotSequence artifacts.
 *
 * Mirrors the WP-061 `loadUiStateFixture` pattern: a single committed
 * fixture name, a static JSON import bound to the engine type at compile
 * time, and a name-typed lookup function. Future fixtures append to the
 * `ReplayFixtureName` union here and to the typed-fixture binding below.
 *
 * No I/O at runtime — the JSON body is bundled at build time by Vite (and
 * by tsx under tests via `resolveJsonModule: true`).
 */

// why: ReplaySnapshotSequence is the canonical engine type defined by
// WP-063. Type-only import keeps the client out of the engine runtime
// (Layer Boundary, `client-app` category — type-only engine imports only).
// The static JSON import below is run through parseReplayJson so the same
// D-6303 runtime assertion (version === 1, snapshots present and non-
// empty) that gates browser file loads also gates fixture loads. Static
// `satisfies ReplaySnapshotSequence` does not work here because TS imports
// JSON with the `version` field widened to `number`, which would never
// satisfy the literal-1 contract at compile time. The runtime validation
// is the real contract — the engine produced the JSON, so this is a
// belt-and-braces re-check.
import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine';
import threeTurnSampleJson from './three-turn-sample.json';
import { parseReplayJson } from '../../replay/loadReplay';

/**
 * The single committed fixture name. Inhabited by `'three-turn-sample'`.
 * Future fixtures extend this union and the typed binding below.
 */
export type ReplayFixtureName = 'three-turn-sample';

const threeTurnSample = parseReplayJson(
  JSON.stringify(threeTurnSampleJson),
  'three-turn-sample.json',
);

/**
 * Resolve a fixture name to its committed ReplaySnapshotSequence.
 *
 * @param name - One of the committed fixture names.
 * @returns The typed sequence for that fixture.
 */
export function loadReplayFixture(
  name: ReplayFixtureName,
): ReplaySnapshotSequence {
  switch (name) {
    case 'three-turn-sample':
      return threeTurnSample;
  }
}
