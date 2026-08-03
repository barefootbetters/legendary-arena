/**
 * Named City spaces for the Legendary Arena game engine (WP-489 / D-24295).
 *
 * The City is a fixed 5-tuple (board/city.types.ts): index 0 is the entry
 * space, index 4 is the escape edge. Those indices carry no name in the engine.
 * This module gives each index its canonical Marvel Legendary space name so a
 * villain ability that reads "if you fight this Villain on the <space>…" can be
 * gated on where the villain sits.
 *
 * Static and derivable from the index, so the mapping lives here as a PURE
 * CONSTANT — never a `G` field (no per-match state; the board layout never
 * changes mid-match). No boardgame.io import, no registry import, no I/O.
 */

// why: WP-489 / D-24295 — the canonical index→name binding, CONFIRMED & LOCKED
// (operator, 2026-08-02) against the authoritative docs/ai/DESIGN-BOARD-LAYOUT.md
// §City row: entry edge = Sewers, escape edge = Bridge, advancement
// Sewers → Bank → Rooftops → Streets → Bridge. Composed with board/city.types.ts
// (index 0 = entry, index 4 = escape edge) → Sewers(0) … Bridge(4). This array is
// the single source of truth; the CitySpaceName union below is derived from it, so
// the two can never drift. keywords-full.json was corroborating-only (~20%
// unreliable) and is superseded by DESIGN-BOARD-LAYOUT.md.
/** The five City space names, index 0 (entry) … index 4 (escape edge). */
export const CITY_SPACE_NAMES = [
  'sewers',
  'bank',
  'rooftops',
  'streets',
  'bridge',
] as const;

/** One of the five canonical City space names. Derived from CITY_SPACE_NAMES. */
export type CitySpaceName = (typeof CITY_SPACE_NAMES)[number];

/**
 * Returns the canonical City space name for a 0-based City index, or undefined
 * when the index is out of range (or absent).
 *
 * Fails soft (undefined, never a throw) for an out-of-range or undefined index:
 * the location gate that consumes this treats undefined as "not on a listed
 * space" and fails closed, so a non-fight fire site (which has no fought index)
 * never fires a location-gated effect.
 *
 * @param index - The 0-based City space index (0-4), or undefined at a fire
 *   site with no fought space.
 * @returns The space name, or undefined for an out-of-range/absent index.
 */
export function citySpaceNameForIndex(
  index: number | undefined,
): CitySpaceName | undefined {
  // why: a non-integer, negative, or >4 index has no named space; undefined at a
  // non-fight fire site (Ambush/Escape) is the common case. Both return undefined
  // so the gate fails closed rather than reading a wrong or phantom space name.
  if (
    typeof index !== 'number' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= CITY_SPACE_NAMES.length
  ) {
    return undefined;
  }
  return CITY_SPACE_NAMES[index];
}
