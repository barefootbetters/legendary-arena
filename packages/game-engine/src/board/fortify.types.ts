/**
 * Fortify keyword contract for the Legendary Arena game engine (WP-873 / D-24818).
 *
 * Rules v23 L1454-1466: a Villain that fortifies a place is put on or near it; while
 * it is there the place carries the listed effect, and any player can fight that
 * Villain as normal to end the effect and put it into their Victory Pile. If a card
 * would fortify a place that another Villain already fortifies, nothing happens.
 *
 * Types and constants only. No functions, no boardgame.io import. A follow-up packet
 * that fortifies a new place appends to the place / lock unions and their arrays and
 * wires the new lock's gate; every `switch` over these unions ends in a `never`
 * default, so an unwired addition fails `tsc`.
 */

import type { CardExtId } from '../state/zones.types.js';

/** A place a Villain can fortify (WP-873 / D-24818). */
export type FortifyPlace = 'sidekick-stack' | 'mastermind';

/**
 * The closed set of places a Villain can fortify in v1 (WP-873 / D-24818), in
 * canonical order. A follow-up packet appends.
 */
export const FORTIFY_PLACES: readonly FortifyPlace[] = ['sidekick-stack', 'mastermind'] as const;

/** What a fortified place locks (WP-873 / D-24818). */
export type FortifyLock = 'no-recruit-or-gain' | 'no-fight';

/** The closed set of Fortify locks in v1, in canonical order (WP-873 / D-24818). */
export const FORTIFY_LOCKS: readonly FortifyLock[] = ['no-recruit-or-gain', 'no-fight'] as const;

// why: a place may carry more than one lock in a follow-up (the Wound Stack will), so the
// grammar checks the lock against this per-place table, not against the whole lock list.
/** The locks each place accepts in a `fortify:<place>:<lock>` marker. */
export const FORTIFY_ALLOWED_LOCKS: Readonly<Record<FortifyPlace, readonly FortifyLock[]>> = {
  'sidekick-stack': ['no-recruit-or-gain'],
  mastermind: ['no-fight'],
};

/** The player-facing name of each place, used in log lines and projected reasons. */
export const FORTIFY_PLACE_LABELS: Readonly<Record<FortifyPlace, string>> = {
  'sidekick-stack': 'the Sidekick Stack',
  mastermind: 'the Mastermind',
};

/** The player-facing text of each lock, used in log lines and the projection. */
export const FORTIFY_LOCK_TEXT: Readonly<Record<FortifyLock, string>> = {
  'no-recruit-or-gain': "Sidekicks can't be recruited or gained",
  'no-fight': "the Mastermind can't be fought",
};

/** One fortified place: the Villain fortifying it and the lock it applies. */
export interface Fortification {
  villainCardId: CardExtId;
  lock: FortifyLock;
}
