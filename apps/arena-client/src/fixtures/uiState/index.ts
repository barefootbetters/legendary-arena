/**
 * Fixture loader for committed `UIState` snapshots.
 *
 * Exposes `loadUiStateFixture(name)` and the `FixtureName` union consumed
 * by the dev `?fixture=` harness in `main.ts` and by component / store tests.
 */

import type { UIState } from '@legendary-arena/game-engine';
import { midTurn, endgameWin, endgameLoss, finalTurn } from './typed';

/**
 * The committed fixture names. Inhabited by `'mid-turn'`, `'endgame-win'`,
 * `'endgame-loss'`, and `'final-turn'` (WP-654 — an in-progress snapshot
 * carrying the WP-367 `finalTurn` projection for the final-turn banner).
 */
export type FixtureName = 'mid-turn' | 'endgame-win' | 'endgame-loss' | 'final-turn';

const KNOWN_FIXTURE_NAMES: readonly FixtureName[] = [
  'mid-turn',
  'endgame-win',
  'endgame-loss',
  'final-turn',
];

/**
 * Type guard for untrusted fixture-name input (URL query strings).
 *
 * // why: the dev `?fixture=` harness in `main.ts` calls this on a raw
 * `URLSearchParams.get('fixture')` value, which is `string | null` with
 * no contract. A silent no-op on unknown names is required by EC-067 —
 * invalid query strings must never crash the dev bootstrap.
 */
export function isFixtureName(candidate: string): candidate is FixtureName {
  for (const known of KNOWN_FIXTURE_NAMES) {
    if (known === candidate) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve a fixture name to its committed UIState snapshot.
 *
 * // why: single code path — no Vite-vs-Node branching. The typed-fixture
 * module does the JSON import + `satisfies UIState` gate exactly once, and
 * this switch just dispatches by name. EC-067 forbids environment-dependent
 * fixture resolution because it would split the compile-time validation path.
 *
 * @param name One of the committed fixture names.
 * @returns The typed `UIState` snapshot for that fixture.
 */
export function loadUiStateFixture(name: FixtureName): UIState {
  switch (name) {
    case 'mid-turn':
      return midTurn;
    case 'endgame-win':
      return endgameWin;
    case 'endgame-loss':
      return endgameLoss;
    case 'final-turn':
      return finalTurn;
  }
}
