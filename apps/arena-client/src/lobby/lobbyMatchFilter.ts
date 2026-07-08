/**
 * Pure filter for the lobby "Join existing match" list (WP-326 / EC-356).
 *
 * Extracted as a standalone function (no Vue reactivity, no side effects) so the
 * joinable-match predicate is unit-testable without mounting `LobbyView.vue` —
 * the same testability pattern WP-321 (`isPinnedToBottom`) and WP-322
 * (`buildGameLogText`) established for arena-client display logic.
 *
 * This is the client half of the stale-lobby cleanup WP-309 (D-24095) exposed:
 * once the boardgame.io match store became durable in Postgres, nothing wiped
 * abandoned matches and the raw lobby list never filtered un-joinable rows. This
 * filter hides what a player cannot join; the server half (WP-327) actually
 * removes the rows from `bgio.matches`.
 */

import type { LobbyMatchSummary } from './lobbyApi';

/**
 * Reports whether a single seat is open (available to join). A seat is open when
 * it carries no `name` — the same signal `LobbyView.isOpenSeat` uses to render a
 * per-seat Join button.
 *
 * @param seat One `players[]` entry from a {@link LobbyMatchSummary}.
 * @returns `true` when the seat has no occupant name.
 */
export function isSeatOpen(seat: { id: string; name?: string }): boolean {
  return seat.name === undefined;
}

/**
 * Returns only the matches a player can actually join: not finished, and with at
 * least one open seat. Input order is preserved for the kept subset.
 *
 * A match is joinable when BOTH hold:
 *   1. it is not over — `gameover === null` (an ongoing match); and
 *   2. it has at least one open seat — some `players[]` entry has no `name`.
 *
 * These are the two dead-row classes WP-309 durability exposed: finished
 * (gameover) matches, and matches with every seat filled — most visibly the
 * single-seat "Watch Bot Play" / solo creates whose only seat is already taken.
 *
 * @param matches The raw, normalized lobby list from `listMatches()`.
 * @returns A new array containing only the joinable matches, in input order.
 */
export function filterJoinableMatches(
  matches: readonly LobbyMatchSummary[],
): LobbyMatchSummary[] {
  const joinable: LobbyMatchSummary[] = [];
  for (const match of matches) {
    // why: a finished match (gameover set) is never joinable, even if a seat
    // was never filled; skip it before the open-seat check.
    if (match.gameover !== null) {
      continue;
    }
    let hasOpenSeat = false;
    for (const seat of match.players) {
      if (isSeatOpen(seat)) {
        hasOpenSeat = true;
        break;
      }
    }
    if (hasOpenSeat) {
      joinable.push(match);
    }
  }
  return joinable;
}
