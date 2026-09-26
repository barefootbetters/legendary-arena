/**
 * Day/Night badge copy (WP-766 / D-24598).
 *
 * Pure functions turning WP-765's projected `UIHQState.dayNight` value into the
 * words the badge renders. No Vue import, so every string is testable without
 * mounting a component (the `menaceDisplay.ts` split).
 *
 * // why: every player-facing string lives here and nowhere in `packages/`: the
 * engine reports WHICH state is in effect, the client decides what to call it
 * (the D-24367 §2 boundary). Nothing here computes day/night — the engine owns
 * that truth (D-24598).
 */

import type { UIHQState } from '@legendary-arena/game-engine';

/** The three projected day/night states. */
export type DayNightState = NonNullable<UIHQState['dayNight']>;

const DAY_NIGHT_LABELS: Record<DayNightState, string> = {
  sunlight: 'Sunlight',
  moonlight: 'Moonlight',
  neither: 'Neither',
};

const DAY_NIGHT_TOOLTIPS: Record<DayNightState, string> = {
  sunlight: 'Sunlight: most HQ Heroes have even printed costs.',
  moonlight: 'Moonlight: most HQ Heroes have odd printed costs.',
  neither: 'Sunlight and Moonlight are both off: the HQ has as many odd-cost as even-cost Heroes.',
};

/**
 * The word the badge shows for a state.
 *
 * @param state - The projected day/night state.
 * @returns `Sunlight`, `Moonlight` or `Neither`.
 */
export function dayNightLabel(state: DayNightState): string {
  return DAY_NIGHT_LABELS[state];
}

/**
 * The rule tooltip (the `title` attribute) for a state.
 *
 * @param state - The projected day/night state.
 * @returns The one-sentence rule that puts this state in effect.
 */
export function dayNightTooltip(state: DayNightState): string {
  return DAY_NIGHT_TOOLTIPS[state];
}

/**
 * The screen-reader text (the `aria-label`) for a state.
 *
 * // why: the Sunlight / Moonlight tooltips already open with the state's name,
 * so they are read as-is; prefixing the label would read "Sunlight Sunlight: …".
 * The Neither tooltip does not name the state, so it gets the word first.
 *
 * @param state - The projected day/night state.
 * @returns The accessible description of the badge.
 */
export function dayNightAriaText(state: DayNightState): string {
  if (state === 'neither') {
    return `Neither. ${DAY_NIGHT_TOOLTIPS.neither}`;
  }
  return DAY_NIGHT_TOOLTIPS[state];
}
