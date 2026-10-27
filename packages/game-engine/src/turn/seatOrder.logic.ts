/**
 * Pure seat-order helper for "each player" effects (WP-846 / D-24780).
 *
 * Rules v23 L2247: "If an effect causes 'each player' to gain a Wound (or do anything
 * else), start with the current player then go clockwise." This module turns the seat
 * ids and the current player into that order.
 *
 * No boardgame.io imports. No .reduce(). No randomness. No side effects.
 */

/**
 * Returns the seat ids in turn order starting with the current player: the ids sorted,
 * then rotated so `currentPlayer` comes first and the rest follow clockwise.
 *
 * // why: clockwise is ascending seat id, wrapping — turn order is
 * `(playOrderPos + 1) % playOrder.length` and nothing customises `ctx.playOrder`, so G's
 * seat ids plus the current player are enough (no `playOrder` read).
 * // why: the sort is the default lexical one, D-18902's choice and the one every
 * simultaneous apply uses; for the reachable ids '0'..'4' it equals ascending seat order.
 * // why: a null / undefined / unknown current player (stub contexts in unit tests) returns
 * the sorted copy unchanged, so callers without a current player keep today's order.
 * // why: forward rule (D-24780) — a new each-player loop whose order changes a Wound-stack,
 * Flying Shield Block or discard-reaction outcome iterates this helper; one that does not
 * stays on `.sort()` with a `// why:` saying why.
 * // why: an "each other player" loop rotates first, then filters out the current player.
 * The helper does not "start after" an absent player, so passing a list that already left
 * the current player out falls back to sorted order.
 *
 * @param seatIds - The seat ids, in any order (typically `Object.keys(G.playerZones)`).
 * @param currentPlayer - The player whose turn it is, or null / undefined when unknown.
 * @returns A new array: the sorted seat ids rotated to start at the current player.
 */
export function seatsInTurnOrderFrom(
  seatIds: readonly string[],
  currentPlayer: string | null | undefined,
): string[] {
  const sortedSeatIds = [...seatIds].sort();
  if (currentPlayer === null || currentPlayer === undefined) {
    return sortedSeatIds;
  }
  const startIndex = sortedSeatIds.indexOf(currentPlayer);
  if (startIndex < 0) {
    return sortedSeatIds;
  }
  return [...sortedSeatIds.slice(startIndex), ...sortedSeatIds.slice(0, startIndex)];
}
