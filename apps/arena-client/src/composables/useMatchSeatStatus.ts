/**
 * useMatchSeatStatus — Arena Client (WP-369)
 *
 * Reactive seat-occupancy for a live match, polled from the public lobby list.
 * The waiting-room panel (`WaitingForPlayersPanel.vue`) uses it to show how many
 * seats are still open and to auto-hide once the match fills.
 *
 * Seat-fill is polled from `lobbyApi.listMatches()` rather than read from the
 * boardgame.io client: the WP-090/311 transport wrapper (`bgioClient.ts`) surfaces
 * only `G` / `isConnected` / `_stateID` to the UI — player-join status
 * (`matchData`) is deliberately not plumbed, and extending that governed layer is
 * out of scope (D-24163). An open seat is one with no display name yet (the same
 * rule `joinMatchFromInvite` uses). NO auth, NO `boardgame.io`/engine import.
 *
 * Authority: WP-369 §Scope A; D-24163; mirrors the `lobbyApi.listMatches` shape.
 */

import { onMounted, onUnmounted, ref, type Ref } from 'vue';

import { listMatches, type LobbyMatchSummary } from '../lobby/lobbyApi';

// why: a 5s poll is frequent enough that a host sees a friend arrive within a
// couple of seconds, but light on the lobby endpoint (the wait is short-lived,
// and the poll stops the moment the match fills).
export const SEAT_POLL_INTERVAL_MS = 5000;

export interface MatchSeatStatus {
  /** Total seats in the match (0 until the first successful poll finds it). */
  readonly totalSeats: Ref<number>;
  /** Seats with no player name yet. */
  readonly openSeats: Ref<number>;
  /** True once the match is present with zero open seats. */
  readonly isFull: Ref<boolean>;
  /** True once the match has been seen in the lobby list at least once. */
  readonly isPresent: Ref<boolean>;
}

/**
 * Count the open seats (no `name`) in a match summary.
 *
 * @param match The lobby summary for the match.
 * @returns The number of seats with no player name.
 */
function countOpenSeats(match: LobbyMatchSummary): number {
  let open = 0;
  for (const seat of match.players) {
    if (typeof seat.name !== 'string') {
      open += 1;
    }
  }
  return open;
}

/**
 * Poll the lobby list for `matchId`'s seat occupancy until it fills (or the
 * caller unmounts). A failed poll preserves the last snapshot so the panel never
 * blanks mid-wait.
 *
 * @param matchId The live match to watch (empty string disables polling).
 * @returns Reactive seat-status refs.
 */
export function useMatchSeatStatus(matchId: string): MatchSeatStatus {
  const totalSeats = ref<number>(0);
  const openSeats = ref<number>(0);
  const isFull = ref<boolean>(false);
  const isPresent = ref<boolean>(false);

  let timer: ReturnType<typeof setInterval> | null = null;

  /**
   * Stop the poll timer (idempotent). Called on full, absent-after-present, and
   * unmount so no interval leaks past the wait.
   */
  function stopPolling(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  /**
   * One poll: fetch the lobby list, find this match, and update the refs. A
   * thrown fetch (transport failure) leaves the last snapshot untouched.
   */
  async function pollOnce(): Promise<void> {
    let matches: LobbyMatchSummary[];
    try {
      matches = await listMatches();
    } catch {
      // why: a failed poll is a transport blip, not "the match filled" — keep the
      // last-known counts so the panel stays stable rather than flashing away.
      return;
    }
    const found = matches.find((candidate) => candidate.matchID === matchId);
    if (found === undefined) {
      // why: once we have seen the match, its disappearance means it ended or was
      // reaped — stop watching. Before the first sighting, keep polling (the row
      // may not be listed yet on the very first tick).
      if (isPresent.value) {
        stopPolling();
      }
      return;
    }
    isPresent.value = true;
    totalSeats.value = found.players.length;
    openSeats.value = countOpenSeats(found);
    if (openSeats.value === 0) {
      isFull.value = true;
      stopPolling();
    }
  }

  onMounted(() => {
    if (matchId === '') {
      return;
    }
    void pollOnce();
    timer = setInterval(() => {
      void pollOnce();
    }, SEAT_POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    stopPolling();
  });

  return { totalSeats, openSeats, isFull, isPresent };
}
