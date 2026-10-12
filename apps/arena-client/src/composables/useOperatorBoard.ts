/**
 * useOperatorBoard — Arena Client (WP-804 / EC-841 / D-24689 §4–§6).
 *
 * Polls the whole board of an operator match from the `admin-session-required`
 * route `GET /api/admin/operator-match/:matchId/board` while the operator panel
 * is open. Mounted only by the lazy `OperatorBoardPanel`, so normal play never
 * loads it.
 *
 * Lifecycle: a self-scheduling `setTimeout` chain (the `useBotAllyStatus`
 * precedent) every {@link OPERATOR_BOARD_POLL_MS} while expanded and signed in;
 * stopped on collapse and on unmount, and — unlike `useBotAllyStatus` —
 * restarted on expand. A generation counter, bumped on every start, stop and
 * `refreshNow`, drops a stale response without scheduling anything, so there is
 * never more than one chain and an older board never overwrites a newer one.
 * A failed poll keeps the last good board and reports the error.
 *
 * The client only renders the server's projection; it runs no rule and edits
 * no state.
 */

import { onUnmounted, ref, shallowRef, watch, type Ref } from 'vue';

import { useAuthStore } from '../stores/auth';
import {
  fetchOperatorBoard,
  type OperatorBoardResponse,
} from '../lib/api/operatorMatchApi';

// why: a 3s poll keeps the panel close to the live board for a human reading it
// without loading the admin route; it runs only while the panel is open. The
// cadence is WP-804 OD-1 — tune this one constant if it feels slow.
export const OPERATOR_BOARD_POLL_MS = 3000;

/** The reactive board state the operator panel renders. */
export interface OperatorBoardState {
  /** The last board the server returned, or `null` before the first success. */
  readonly board: Ref<OperatorBoardResponse | null>;
  /** The last poll's error, or `null` after a success. */
  readonly errorMessage: Ref<string | null>;
  /** Fetch now, replacing the pending timer with exactly one new chain. */
  readonly refreshNow: () => Promise<void>;
}

/**
 * Build the download file name for an operator snapshot or a UIState fixture.
 *
 * @param kind `'operator'` for the board snapshot, `'fixture'` for the UIState.
 * @param matchId The match id; path separators are replaced with `-`.
 * @param capturedAtMs The capture time in epoch milliseconds.
 * @returns `legendary-arena-<kind>-<safeMatch>-<capturedAtMs>.json`.
 */
export function buildOperatorFileName(
  kind: 'operator' | 'fixture',
  matchId: string,
  capturedAtMs: number,
): string {
  let safeMatch = matchId.replace(/[/\\]/g, '-');
  if (safeMatch === '') {
    safeMatch = 'no-match';
  }
  return `legendary-arena-${kind}-${safeMatch}-${capturedAtMs}.json`;
}

/**
 * Poll an operator match's board while `isExpanded` is true.
 *
 * @param matchId The operator match to read.
 * @param isExpanded Whether the panel is open.
 * @returns `{ board, errorMessage, refreshNow }`.
 */
export function useOperatorBoard(matchId: string, isExpanded: Ref<boolean>): OperatorBoardState {
  const authStore = useAuthStore();
  const board = shallowRef<OperatorBoardResponse | null>(null);
  const errorMessage = ref<string | null>(null);
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isUnmounted = false;

  /** Cancel the pending poll, if any. */
  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /**
   * Schedule the next poll for a generation.
   *
   * @param pollGeneration The generation the scheduled poll belongs to.
   */
  function scheduleNext(pollGeneration: number): void {
    timer = setTimeout(() => {
      timer = null;
      void pollOnce(pollGeneration);
    }, OPERATOR_BOARD_POLL_MS);
    // why: unref so a panel mounted in node:test never holds the runner open;
    // a browser timer id has no unref, so the guard skips it there.
    const scheduledTimer = timer as unknown as { unref?: () => void };
    if (typeof scheduledTimer.unref === 'function') {
      scheduledTimer.unref();
    }
  }

  /**
   * One poll: fetch the board, apply it if this generation is still current,
   * and keep the chain going while the panel is open.
   *
   * @param pollGeneration The generation this poll belongs to.
   */
  async function pollOnce(pollGeneration: number): Promise<void> {
    const token = authStore.token;
    if (token === null || pollGeneration !== generation) {
      return;
    }
    const result = await fetchOperatorBoard(matchId, token);
    if (pollGeneration !== generation) {
      return;
    }
    if (result.ok) {
      board.value = result.value;
      errorMessage.value = null;
    } else {
      errorMessage.value = result.error;
    }
    if (isExpanded.value && !isUnmounted) {
      scheduleNext(pollGeneration);
    }
  }

  /** Start a fresh chain (a new generation) with an immediate poll. */
  function startPolling(): void {
    generation += 1;
    clearTimer();
    void pollOnce(generation);
  }

  /** Stop the chain; any in-flight response becomes stale. */
  function stopPolling(): void {
    generation += 1;
    clearTimer();
  }

  /** Fetch now; the pending timer is replaced, so one chain remains. */
  async function refreshNow(): Promise<void> {
    if (isUnmounted) {
      return;
    }
    generation += 1;
    clearTimer();
    await pollOnce(generation);
  }

  // why: the reveal-all view travels only over the admin route (D-24689 §4),
  // not the player's socket, so the panel polls it while open and never while
  // collapsed or signed out.
  watch(
    [() => isExpanded.value, () => authStore.token],
    ([expanded, token]) => {
      if (expanded === true && token !== null && !isUnmounted) {
        startPolling();
      } else {
        stopPolling();
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    isUnmounted = true;
    stopPolling();
  });

  return { board, errorMessage, refreshNow };
}
