/**
 * Pinia store for the live match's transport connection status (WP-311).
 *
 * Holds boardgame.io's `state.isConnected` (surfaced from `transport.isConnected`
 * on every subscribe frame) plus the last-seen `_stateID` and a one-way
 * `hasEverConnected` latch. The reconnect banner
 * (`components/ConnectionStatusBanner.vue`) reads this store to decide when to
 * show "Connection lost — reconnecting…".
 *
 * why: connection status is FRAMEWORK / TRANSPORT state, never game state — it
 * carries no `G` / card / zone data and is never persisted. Per the WP-116
 * disconnect/reconnect policy, disconnect tracking lives in framework/client
 * state, never in `G`. This store is that client-side surface.
 */

import { defineStore } from 'pinia';

interface ConnectionStoreState {
  /** boardgame.io `transport.isConnected` from the most recent frame. */
  isConnected: boolean;
  /** The last `_stateID` the client observed, or null before the first frame. */
  lastStateId: number | null;
  /**
   * True once the client has connected at least once. Latches on and never
   * clears — so the banner distinguishes "never connected yet" (show nothing)
   * from "was connected, then dropped" (show the reconnecting banner).
   */
  hasEverConnected: boolean;
  /**
   * Client wall-clock (ms) of the most recent subscribe frame, or null before
   * the first frame. Feeds the diagnostic report's transport-staleness signal
   * (`timeSinceLastFrameMs`) — the WP-428 transport block reads it.
   */
  lastFrameAtMs: number | null;
}

// why: Options API (state + one action) mirrors the sibling `uiState` store —
// small, greppable, no derived logic accreting here. The banner derives its
// own visibility from these three fields; this store only records them.
export const useConnectionStore = defineStore('connection', {
  state: (): ConnectionStoreState => ({
    isConnected: false,
    lastStateId: null,
    hasEverConnected: false,
    lastFrameAtMs: null,
  }),
  actions: {
    /**
     * Records the transport connection status from a subscribe frame. Latches
     * `hasEverConnected` the first time `isConnected` is true; never clears it.
     *
     * @param isConnected boardgame.io `state.isConnected` for this frame.
     * @param stateId The frame's `_stateID`, or null when absent.
     * @param atMs Client wall-clock (ms) of this frame; defaults to now.
     */
    setConnected(
      isConnected: boolean,
      stateId: number | null,
      // why: Date.now() here is a client-layer diagnostic timestamp marking the
      // frame's arrival, outside the engine determinism boundary (which governs
      // packages/game-engine only); a defaulted parameter keeps the existing
      // two-argument call site in bgioClient.ts source-compatible.
      atMs: number = Date.now(),
    ): void {
      this.isConnected = isConnected;
      this.lastStateId = stateId;
      this.lastFrameAtMs = atMs;
      if (isConnected === true) {
        this.hasEverConnected = true;
      }
    },
  },
});
