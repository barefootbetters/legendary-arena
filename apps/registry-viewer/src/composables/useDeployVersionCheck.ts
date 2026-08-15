/**
 * useDeployVersionCheck — registry-viewer (WP-552 / EC-587 / D-24361).
 *
 * Detects when a NEWER viewer build has been deployed while this tab is open, so
 * the page can offer a reload instead of silently showing stale UI. On
 * 2026-08-15 a correctly-deployed WP-549 change was invisible to an operator on
 * a cached bundle, and the viewer had no way to say so.
 *
 * Two triggers drive `updateAvailable`:
 *
 *  A. **Tab-focus re-check** — the common "a deploy landed while I was away" case.
 *  B. **A slow backstop poll** — so an idle tab still learns within a minute.
 *
 * why: this is a DELIBERATELY NARROWER port than arena-client's. That version
 * adds two more triggers this app cannot use:
 *   - a socket-reconnect watch on the `connection` store — `registry-viewer` has
 *     no `src/stores/`, no socket, and no boardgame.io connection; and
 *   - a `vite:preloadError` catch for a hashed lazy chunk 404 — the viewer emits
 *     a SINGLE JS chunk (no code-splitting), so that event cannot fire here.
 * Both are dropped rather than faked, per EC-587's locked keeps/drops list.
 *
 * Fail-soft: a failed or missing `version.json` fetch is a no-op, never a false
 * positive. The composable raises a reactive flag and nothing else.
 *
 * Authority: WP-552 §4/§7; EC-587; D-24361; ports WP-418 / EC-453 / D-24238.
 */

import { onMounted, onUnmounted, ref, type Ref } from "vue";

import { fetchDeployedSha, isNewerBuildAvailable } from "../lib/deployVersion.js";

// why: a 60s backstop is a rare, cheap safety net beneath the focus trigger,
// which catches the common case immediately. Copied verbatim from
// arena-client's DEPLOY_VERSION_POLL_MS rather than re-derived, so the two apps
// poll the same origin at the same cadence.
export const DEPLOY_VERSION_POLL_MS = 60_000;

/** The reactive deploy-freshness state the app shell consumes. */
export interface DeployVersionCheckState {
  /**
   * True once a different build is known to be deployed. One-way latch — the
   * tab's bundle cannot get fresher without a reload, so the banner never
   * flickers.
   */
  readonly updateAvailable: Ref<boolean>;
  /** Runs one fetch-and-compare immediately (also invoked by the triggers). */
  readonly checkNow: () => Promise<void>;
}

/**
 * Watch for a newer deployed viewer build.
 *
 * @param bakedSha - The build sha compiled into this tab. Defaults to the Vite
 *   `__GIT_SHA__` constant; injectable so a caller can supply one explicitly.
 * @returns Reactive `{ updateAvailable, checkNow }`.
 */
export function useDeployVersionCheck(bakedSha: string = __GIT_SHA__): DeployVersionCheckState {
  const updateAvailable = ref<boolean>(false);

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * One fetch-and-compare. Latches `updateAvailable` on a positive result and is
   * otherwise a no-op — including every fail-soft path (a null fetch result
   * never flips the flag).
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
    if (document.visibilityState === "visible") {
      void checkNow();
    }
  }

  onMounted(() => {
    void checkNow();
    document.addEventListener("visibilitychange", onVisibilityChange);

    pollTimer = setInterval(() => {
      void checkNow();
    }, DEPLOY_VERSION_POLL_MS);
    // why: unref the backstop timer so it can never hold a Node process open on
    // its own. In the browser `setInterval` returns a number with no `unref`, so
    // the guard skips it and behaviour there is unchanged.
    const scheduledTimer = pollTimer as unknown as { unref?: () => void };
    if (typeof scheduledTimer.unref === "function") {
      scheduledTimer.unref();
    }
  });

  onUnmounted(() => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  return { updateAvailable, checkNow };
}
