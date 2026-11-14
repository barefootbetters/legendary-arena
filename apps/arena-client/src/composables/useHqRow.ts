/**
 * Pure transform that derives the 6-cell visual HQ row from `UIHQState`
 * + `UIDecksState`.
 *
 * Visual column order (left-to-right) per `DESIGN-BOARD-LAYOUT.md §7.1`:
 *   `Hero1 | Hero2 | Hero3 | Hero4 | Hero5 | Hero Deck`
 *
 * Per D-12903 the MVP HQ slot count is 5; if a future scenario projects
 * 6 hero slots, the returned array length grows to 7 (6 heroes + Hero
 * Deck). The renderer should render whatever count the engine projects.
 *
 * Per WP-128 / pre-flight 2026-04-29 PS-6, `UIHQState.slots` carries
 * `(string | null)[]` (bare CardExtIds) and the optional `slotDisplay?`
 * carries the parallel display payload. WP-129 binds to both: the bare
 * `slots` for stable identity, the `slotDisplay` for cost-gating.
 *
 * @see WP-129 §Acceptance Criteria — HQ row 6 cells
 * @see EC-132 §2 HQ visual column order
 * @see DESIGN-BOARD-LAYOUT.md §7.1 HQ row
 */

import type {
  UICardDisplay,
  UIDecksState,
  UIHQCard,
  UIHQHaunter,
  UIHQState,
} from '@legendary-arena/game-engine';

export type HqCell =
  | {
      kind: 'hero';
      hqIndex: number;
      cardId: string | null;
      display: UICardDisplay | null;
      haunter: UIHQHaunter | null;
    }
  | { kind: 'heroDeck'; count: number };

/**
 * Build the (N+1)-cell row in left-to-right reading order.
 *
 * Cells `0..N-1`: hero slots from `hq.slots[0..N-1]`. Cell N: hero deck.
 * For each hero slot, the parallel `hq.slotDisplay?[i]` payload populates
 * the cell's `display` field; when the parallel array is missing or the
 * slot is empty, `display` is `null`. The parallel `hq.haunters?[i]` entry
 * populates `haunter` (WP-759); it is `null` when the slot is not haunted.
 */
export function useHqRow(
  hq: UIHQState,
  decks: UIDecksState,
): { cells: HqCell[] } {
  const cells: HqCell[] = [];
  for (let hqIndex = 0; hqIndex < hq.slots.length; hqIndex += 1) {
    const cardId = hq.slots[hqIndex] ?? null;
    let display: UICardDisplay | null = null;
    if (hq.slotDisplay !== undefined) {
      const slot: UIHQCard | null = hq.slotDisplay[hqIndex] ?? null;
      if (slot !== null) {
        display = slot.display;
      }
    }
    // why: D-24587 — `hq.haunters` is an optional array index-aligned with `slots`,
    // omitted entirely until the first haunt of the match, so a missing array and a
    // null entry both mean "not haunted". A haunter can sit on an empty slot (the
    // Hero Deck ran dry), so this reads the index even when `cardId` is null.
    const haunter: UIHQHaunter | null = hq.haunters?.[hqIndex] ?? null;
    cells.push({ kind: 'hero', hqIndex, cardId, display, haunter });
  }
  cells.push({ kind: 'heroDeck', count: decks.heroDeckCount });
  return { cells };
}
