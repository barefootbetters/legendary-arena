/**
 * Pure transform that derives the 7-cell visual city row from `UICityState`
 * + `UIDecksState` + `escapedPile`.
 *
 * Visual column order (left-to-right) per `DESIGN-BOARD-LAYOUT.md §7.1`:
 *   `Escaped Pile | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck`
 *
 * Engine-to-visual mapping (per `packages/game-engine/src/board/city.logic.ts`):
 *   - **Engine space 0** is the ENTRY POINT — new villains revealed from the
 *     deck land here. Visually this is the rightmost city slot (Sewers),
 *     adjacent to the Villain Deck cell on the right edge.
 *   - **Engine space 4** is the ESCAPE EDGE — when a villain is pushed past
 *     this slot, it escapes into the Escaped Pile. Visually this is the
 *     leftmost city slot (Bridge), adjacent to the Escaped Pile on the
 *     left edge.
 *   - Visual flow: villain enters at Sewers (right) → advances leftward
 *     through Bank → Rooftops → Streets → Bridge → escapes off the left
 *     edge into the Escaped Pile.
 *
 * The visual cells therefore render the engine's `city.spaces[]` in
 * REVERSE order: visual cell `n` (1..5 left-to-right) corresponds to
 * engine index `4 - (n - 1)` (so visual Sewers = engine 0, visual
 * Bridge = engine 4).
 *
 * @see WP-129 §Acceptance Criteria — City row 7 cells
 * @see EC-132 §2 City visual column order
 * @see DESIGN-BOARD-LAYOUT.md §7.1 City row
 * @see packages/game-engine/src/board/city.logic.ts pushVillainIntoCity
 */

import type {
  UICityCard,
  UICityState,
  UIDecksState,
  UIDisplayEntry,
} from '@legendary-arena/game-engine';

export type CityCell =
  | { kind: 'escaped'; entries: UIDisplayEntry[]; count: number }
  | { kind: 'slot'; cityIndex: number; slotName: string; card: UICityCard | null }
  // why: WP-831 / D-24764 — a space a scheme removed (the City is smaller than 5). It keeps its
  // column so the HQ stays under the same spaces; nothing can be in it.
  | { kind: 'gone'; cityIndex: number; slotName: string }
  | { kind: 'villainDeck'; count: number };

// why: the names belong to ENGINE indices (0 = Sewers, the entry … 4 = Bridge, the escape edge
// of the normal City). WP-831 / D-24764 — a scheme can resize the City: a smaller City loses its
// far spaces (their names no longer exist, rules v23 "Galactus"), a larger one adds unnamed spaces
// beyond the Bridge, so a name is looked up by engine index, never by visual position.
const SLOT_NAMES_BY_ENGINE_INDEX: readonly string[] = ['Sewers', 'Bank', 'Rooftops', 'Streets', 'Bridge'];

// why: the normal City's column count; a smaller City still renders this many columns.
const NORMAL_CITY_SIZE = 5;

/**
 * The City columns beyond the normal five (a scheme can enlarge the City, WP-831 / D-24764).
 *
 * The HQ adds this many blank leading cells to stay aligned, and the board stage widens by this
 * many space columns so the scale-to-fit board shrinks to fit instead of overflowing.
 *
 * @param citySize - The number of City spaces.
 * @returns 0 for a City of five or fewer spaces.
 */
export function extraCityColumns(citySize: number): number {
  return Math.max(0, citySize - NORMAL_CITY_SIZE);
}

/**
 * Build the 7-cell row in left-to-right reading order.
 *
 * Cell 0: escaped pile (left edge). Cells 1..5: city slots in visual
 * left-to-right order, with each cell's `cityIndex` resolved to the
 * corresponding engine index (Bridge = highest engine index, Sewers
 * = engine index 0). Cell 6: villain deck (right edge).
 *
 * The returned array has `max(city.spaces.length, 5) + 2` cells (7 for the normal City). A
 * smaller City (WP-831) renders its removed far spaces as `gone` cells in their usual columns; a
 * larger one adds unnamed spaces ("Space 6") to the left of the Bridge.
 */
export function useCityRow(
  city: UICityState,
  decks: UIDecksState,
): { cells: CityCell[] } {
  const cells: CityCell[] = [];
  cells.push({
    kind: 'escaped',
    entries: city.escapedPile,
    count: city.escapedPile.length,
  });
  // why: iterate visually left-to-right but resolve to engine indices in
  // reverse so visual Sewers (rightmost) maps to engine index 0 (entry)
  // and visual Bridge (leftmost) maps to engine index spaces.length - 1
  // (escape edge). The engine's `city.spaces[0]` is where new villains
  // enter per pushVillainIntoCity; visual cell 5 (Sewers) renders that.
  const columnCount = Math.max(city.spaces.length, NORMAL_CITY_SIZE);
  for (let visualIndex = 0; visualIndex < columnCount; visualIndex += 1) {
    const cityIndex = columnCount - 1 - visualIndex;
    const slotName = SLOT_NAMES_BY_ENGINE_INDEX[cityIndex] ?? `Space ${cityIndex + 1}`;
    if (cityIndex >= city.spaces.length) {
      cells.push({ kind: 'gone', cityIndex, slotName });
      continue;
    }
    const card = city.spaces[cityIndex] ?? null;
    cells.push({ kind: 'slot', cityIndex, slotName, card });
  }
  cells.push({ kind: 'villainDeck', count: decks.villainDeckCount });
  return { cells };
}
