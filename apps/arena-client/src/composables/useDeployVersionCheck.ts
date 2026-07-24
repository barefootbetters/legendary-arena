/**
 * useDeployVersionCheck — Arena Client (WP-418 / EC-453 / D-24238).
 *
 * Detects when a NEWER client build has been deployed while this tab is open, so
 * the play surface can offer a reload before a stale hashed chunk 404s and
 * freezes the board. This is the layer the reconnect / resync stack in
 * `client/bgioClient.ts` cannot cover: resync re-anchors MATCH STATE, but a stale
 * JS BUNDLE is only fixable by a page reload (see D-24238 and this WP's
 * reconnect-gap audit).
 *
 * Two signals drive `updateAvailable`:
 *
 *  A. **Proactive poll** — fetch the build-stamped `version.json` and compare its
 *     sha against the baked `__GIT_SHA__`. Fires on mount, on tab-focus, on
 *     socket reconnect (a `connection` store `isConnected` false→true edge — the
 *     exact moments a deploy likely happened), and on a low ~60s backstop.
 *  B. **Reactive catch** — a Vite `vite:preloadError` (a hashed chunk 404 after a
 *     deploy) flips the flag immediately AND prevents the default white-screen.
 *
 * Fail-soft: a failed / missing `version.json` fetch is a no-op (never a false
 * positive). The composable never mutates match state and never gates a move —
 * it only raises a reactive flag the `UpdateAvailableBanner` reads.
 *
 * Authority: WP-418 §Scope (In) §B/§C; EC-453; D-24238; reuses the WP-311
 * `connection` store's reconnect signal (no new socket listener) and mirrors
 * `useBotAllyStatus`'s poll/leak discipline (WP-415).
 */

import { onMounted, onUnmounted, ref, watch, type Ref } from 'vue';

import { useConnectionStore } from '../stores/connection.js';
import { fetchDeployedSha, isNewerBuildAvailable } from '../lib/deployVersion.js';

// why: a 60s backstop poll is a rare, cheap safety net beneath the event-driven
// triggers (focus + reconnect), which catch the common "deploy while I was away"
// case immediately. It is deliberately slow — this is a fallback, not the primary
// signal — so an idle tab still learns of a deploy within a minute.
export const DEPLOY_VERSION_POLL_MS = 60_000;

/** The reactive deploy-freshness state the play surface consumes. */
export interface DeployVersionCheckState {
  /**
   * True once a strictly-newer client build is known to be deployed. One-way
   * latch — once set it stays set (the tab's bundle does not get fresher without
   * a reload), so the banner does not flicker.
   */
  readonly updateAvailable: Ref<boolean>;
  /** Runs one fetch-and-compare immediately (also invoked by the triggers). */
  readonly checkNow: () => Promise<void>;
}

/**
 * Watch for a newer deployed client build.
 *
 * @param bakedSha The build sha compiled into this tab. Defaults to the Vite
 *   `__GIT_SHA__` constant; injectable so the comparison is unit-testable
 *   (mirrors `useComboCue`'s injectable engine).
 * @returns Reactive `{ updateAvailable, checkNow }`.
 */
export function useDeployVersionCheck(
  bakedSha: string = __GIT_SHA__,
): DeployVersionCheckState {
  const updateAvailable = ref<boolean>(false);
  const connection = useConnectionStore();

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * One fetch-and-compare. Latches `updateAvailable` on a positive result and is
   * otherwise a no-op — including every fail-soft path (a null fetch result never
   * flips the flag).
   */
  async function checkNow(): Promise<void> {
    // why: once latched there is nothing more to learn — the bundle cannot get
    // fresher without a reload — so skip the fetch and let the banner stand.
    if (updateAvailable.value === true) {
      return;
    }
    const fetchedSha = await fetchDeployedSha();
    if (isNewerBuildAvailable(bakedSha, fetchedSha)) {
      updateAvailable.value = true;
    }
  }

  /** Tab-focus trigger: re-check when the tab becomes visible again. */
  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void checkNow();
    }
  }

  /**
   * Vite chunk-load failure after a deploy: the old hashed chunks are gone, so a
   * newer build is definitively live. Surface the banner immediately and prevent
   * the default (a white-screen / thrown preload error).
   */
  function onPreloadError(event: Event): void {
    // why: preventDefault stops Vite from surfacing the unhandled preload error
    // to the window (which would white-screen); the banner + a user reload is the
    // graceful recovery. This is Fork B — the belt-and-suspenders that catches
    // the ACTUAL failure mode even if the poll has not yet fired.
    event.preventDefault();
    updateAvailable.value = true;
  }

  onMounted(() => {
    void checkNow();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('vite:preloadError', onPreloadError);

    pollTimer = setInterval(() => {
      void checkNow();
    }, DEPLOY_VERSION_POLL_MS);
    // why: unref the backstop timer so it never holds a Node process open on its
    // own — a component mounted in node:test that is not explicitly unmounted must
    // not keep the runner alive on this background poll (the WP-415 gotcha). In the
    // browser `setInterval` returns a number with no `unref`, so the guard skips it
    // and behavior there is unchanged.
    const scheduledTimer = pollTimer as unknown as { unref?: () => void };
    if (typeof scheduledTimer.unref === 'function') {
      scheduledTimer.unref();
    }
  });

  // why: a socket reconnect (isConnected false→true) is a prime moment a deploy
  // happened while the transport was down — re-check then. Reuses the WP-311
  // `connection` store rather than adding a second socket listener (the WP forbids
  // duplicating the reconnect/resync stack). The `false` guard skips the initial
  // undefined→false settle so only a genuine re-connect edge triggers a check.
  const stopConnectionWatch = watch(
    () => connection.isConnected,
    (isConnected, wasConnected) => {
      if (isConnected === true && wasConnected === false) {
        void checkNow();
      }
    },
  );

  onUnmounted(() => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('vite:preloadError', onPreloadError);
    stopConnectionWatch();
  });

  return { updateAvailable, checkNow };
}
