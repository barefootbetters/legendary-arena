/**
 * The six Enigma Code colors as the client shows them (WP-830 / D-24763).
 *
 * The ids come from the engine (`ENIGMA_COLORS`): the five Hero Classes plus grey for a card with
 * no class (rules v23 "Class vs. Colors"). The client only labels them; the engine decides whether
 * a guess is right.
 */

import { ENIGMA_COLORS } from '@legendary-arena/game-engine';

/** The display label of each color id. */
const ENIGMA_COLOR_LABELS: Readonly<Record<string, string>> = {
  strength: 'Strength',
  instinct: 'Instinct',
  covert: 'Covert',
  tech: 'Tech',
  ranged: 'Ranged',
  grey: 'Grey',
};

/** Every guessable color, in the engine's order, with its label. */
export const ENIGMA_COLOR_OPTIONS: readonly { id: string; label: string }[] = ENIGMA_COLORS.map((id) => ({
  id,
  label: ENIGMA_COLOR_LABELS[id] ?? id,
}));

/**
 * The label for one color id.
 *
 * @param color - A color id from the projection.
 * @returns Its label, or the id itself for an unknown one.
 */
export function enigmaColorLabel(color: string): string {
  return ENIGMA_COLOR_LABELS[color] ?? color;
}
