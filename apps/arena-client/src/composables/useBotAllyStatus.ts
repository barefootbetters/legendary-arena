/**
 * useBotAllyStatus — Arena Client (WP-415 / EC-450 / D-24231).
 *
 * Reactive bot-ally status for a live match, polled from WP-414's
 * `GET /api/match/:matchId/bot-ally-status`. The play surface uses it to know
 * when a bot ally has genuinely stopped driving its seat — so the human on a
 * co-op match is told (via {@link ../components/BotAllyStallBanner.vue}) instead
 * of being left on a frozen board.
 *
 * Lifecycle: probe once on mount. A match with NO bot ally reports `absent`, and
 * the composable stops entirely — it never polls a non-bot-ally match again. A
 * real bot-ally match is polled at {@link BOT_ALLY_STATUS_POLL_MS} until its
 * status is terminal (anything other than `active`), and the timer is cleared on
 * that terminal status AND on unmount (no leaked interval across matches / route
 * changes). A fetch error is fail-soft: it is swallowed (dev-logged) and retried
 * on the next tick, never setting `hasStopped` — a network blip is not a stopped
 * bot.
 *
 * The client reaches the server ONLY over HTTP (no runtime `@legendary-arena/
 * registry` or `server` import — layer boundary).
 *
 * Authority: WP-415 §Scope (In) §B; EC-450; D-24231; WP-414 (status surface);
 * mirrors the `useMatchSeatStatus` poll/cleanup pattern (WP-369).
 */

import { onMounted, onUnmounted, ref, type Ref } from 'vue';

import { fetchBotAllyStatus, type BotAllyStatusLabel } from '../lib/api/botAllyApi';

// why: a 4s poll surfaces a stopped bot within a few seconds without loading the
// endpoint (a live match polls it steadily; the poll stops the moment the status
// is terminal). Longer than the seat-fill poll because a stall is less
// time-sensitive than seeing a friend arrive in the waiting room.
export const BOT_ALLY_STATUS_POLL_MS = 4000;

/** Reactive bot-ally status for the play surface. */
export interface BotAllyStatusState {
  /**
   * True when the bot ally stopped abnormally — `driving === false` AND the
   * status is neither a normal end (`completed`) nor a non-bot match (`absent`).
   * The banner renders iff this is true.
   */
  readonly hasStopped: Ref<boolean>;
  /** The server's public-safe co-op message when faulted, else `null`. */
  readonly message: Ref<string | null>;
  /** The latest reported status label, or `null` before the first poll. */
  readonly status: Ref<BotAllyStatusLabel | null>;
}

/**
 * Poll a match's bot-ally status until it stops driving (or the caller unmounts).
 *
 * @param matchId The live match to watch (empty string disables polling — a
 *   non-live viewport mount probes nothing).
 * @returns Reactive `{ hasStopped, message, status }`.
 */
export function useBotAllyStatus(matchId: string): BotAllyStatusState {
  const hasStopped = ref<boolean>(false);
  const message = ref<string | null>(null);
  const status = ref<BotAllyStatusLabel | null>(null);

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  /**
   * Stop polling for good (idempotent). Called on a terminal status and on
   * unmount so no timer leaks past the watch.
   *
   * // why: leak discipline — the interval is cleared on BOTH a terminal status
   * AND unmount, so a viewport / route change never leaves a poll running.
   */
  function stopPolling(): void {
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /** Schedule the next poll unless polling has already stopped. */
  function scheduleNext(): void {
    if (stopped) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void pollOnce();
    }, BOT_ALLY_STATUS_POLL_MS);
    // why: unref the poll timer so it never holds a Node process open on its
    // own — a component mounted in node:test (e.g. the live-branch App tests)
    // that is not explicitly unmounted must not keep the test runner alive on
    // this background poll. In the browser `setTimeout` returns a number with no
    // `unref`, so the guard skips it and behavior there is unchanged; the poll
    // still fires normally in both environments and is cleared on terminal +
    // unmount.
    const scheduledTimer = timer as unknown as { unref?: () => void };
    if (typeof scheduledTimer.unref === 'function') {
      scheduledTimer.unref();
    }
  }

  /**
   * One poll: read the status surface and update the refs. `absent` (not a
   * bot-ally match) and every terminal status stop the poll; only `active`
   * keeps it going.
   */
  async function pollOnce(): Promise<void> {
    if (stopped) {
      return;
    }
    let result;
    try {
      result = await fetchBotAllyStatus(matchId);
    } catch (pollError) {
      // why: fail-soft — a fetch rejection is a transient network blip, NOT a
      // stopped bot. It must never set `hasStopped` (that would flash a false
      // stall banner); log in dev and retry on the next tick.
      if (import.meta.env?.DEV === true) {
        const detail = pollError instanceof Error ? pollError.message : String(pollError);
        console.warn(`[bot-ally-status] transient poll error for match ${matchId}: ${detail}`);
      }
      scheduleNext();
      return;
    }

    status.value = result.status;
    message.value = result.message;
    hasStopped.value =
      result.driving === false && result.status !== 'completed' && result.status !== 'absent';

    // why: `absent` means this is not a bot-ally match — stop entirely so a
    // normal (human-only / solo) match is never polled again. Every other
    // non-`active` status is terminal (the bot ally will not resume), so it also
    // stops the poll; only a live `active` match keeps polling.
    if (result.status === 'active') {
      scheduleNext();
    } else {
      stopPolling();
    }
  }

  onMounted(() => {
    if (matchId === '') {
      return;
    }
    void pollOnce();
  });

  onUnmounted(() => {
    stopPolling();
  });

  return { hasStopped, message, status };
}
