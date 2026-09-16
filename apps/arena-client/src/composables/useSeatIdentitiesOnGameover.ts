/**
 * Seat-identities-on-gameover composable — Arena Client (INFRA: endgame seat names)
 *
 * Watches the live UIState snapshot and, on the gameover transition, fetches the
 * finished match's per-seat identity roster (`{ playerId, isBot, handle }` per
 * seat) exactly once. The endgame co-op VP recap uses it to label seats
 * "Player N (@handle)" / "(Bot)" instead of a bare "Player N".
 *
 * This is the co-op / unscored-match counterpart to
 * `useCompetitiveSubmitOnGameover`, whose submit response already carries the same
 * roster for a SCORED match. It runs for everyone — including a guest — because the
 * endpoint is a public finished-match read (no bearer). A failed / unavailable
 * fetch leaves the roster `null` and the recap falls back to "Player N".
 *
 * Mounted at `PlayViewport` (which holds the `matchId` prop and reads the shared
 * uiState store), so a single instance covers both the desktop and mobile play
 * surfaces.
 *
 * Layer-boundary: imports no engine/server runtime — it talks to the server via
 * the `matchSeatIdentitiesApi` HTTP wrapper only.
 *
 * Authority: WP-593 / D-24402 (the `seatIdentities` projection); WP-339 /
 * useCompetitiveSubmitOnGameover.ts (gameover-watch precedent).
 */

import { ref, watch, type Ref } from 'vue';

import { useUiStateStore } from '../stores/uiState';
import { fetchMatchSeatIdentities } from '../lib/api/matchSeatIdentitiesApi';
import type { CompetitiveSeatIdentity } from '../lib/api/competitionApi';

/**
 * Watch for gameover and fetch the match's per-seat identity roster once.
 *
 * @param matchId A ref to the current live match id (`''` when no live match).
 * @returns `{ seatIdentities }` — a reactive roster the endgame recap labels seats
 *   from. `null` until a successful fetch, and for every failure / unavailable
 *   path (the recap then shows plain "Player N").
 */
export function useSeatIdentitiesOnGameover(matchId: Ref<string>): {
  seatIdentities: Ref<readonly CompetitiveSeatIdentity[] | null>;
} {
  const uiStateStore = useUiStateStore();

  const seatIdentities: Ref<readonly CompetitiveSeatIdentity[] | null> = ref(null);
  // why: the gameover snapshot recurs on every server frame, so a guard fetches
  // the roster at most once per match. `fetchedForMatch` records which match it
  // fired for, so the matchId watch below can re-arm for a new match.
  let hasFetched = false;
  let fetchedForMatch: string | null = null;

  /**
   * Fetch the current match's seat identities once. A missing match id or a
   * failed/unavailable read is a no-op that leaves the roster null (the recap then
   * shows plain "Player N").
   */
  async function fetchOnce(): Promise<void> {
    if (hasFetched) {
      return;
    }
    const currentMatchId = matchId.value;
    if (currentMatchId === '') {
      // why: no live match id (a non-live mount) — nothing to fetch.
      return;
    }
    hasFetched = true;
    fetchedForMatch = currentMatchId;

    const roster = await fetchMatchSeatIdentities(currentMatchId);
    // why: only adopt a real roster; on any failure the wrapper returns null and
    // the recap keeps its "Player N" fallback rather than blanking a seat.
    if (roster !== null) {
      seatIdentities.value = roster;
    }
  }

  // why: gameover is engine truth, read PASSIVELY from the live snapshot — the
  // presence of `snapshot.gameOver` marks the match as over. `immediate` covers a
  // mount that is already at gameover (e.g. a reconnect after the match ended).
  watch(
    () => uiStateStore.snapshot?.gameOver !== undefined,
    (isGameOver) => {
      if (isGameOver) {
        void fetchOnce();
      }
    },
    { immediate: true },
  );

  // why: re-arm when the mounted match changes so a subsequent live match on the
  // same viewport instance fetches its own roster.
  watch(matchId, (nextMatchId) => {
    if (nextMatchId !== fetchedForMatch) {
      hasFetched = false;
      fetchedForMatch = null;
      seatIdentities.value = null;
    }
  });

  return { seatIdentities };
}
