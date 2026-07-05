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
}

// why: Options API (state + one action) mirrors the sibling `uiState` store —
// small, greppable, no derived logic accreting here. The banner derives its
// own visibility from these three fields; this store only records them.
export const useConnectionStore = defineStore('connection', {
  state: (): ConnectionStoreState => ({
    isConnected: false,
    lastStateId: null,
    hasEverConnected: false,
  }),
  actions: {
    /**
     * Records the transport connection status from a subscribe frame. Latches
     * `hasEverConnected` the first time `isConnected` is true; never clears it.
     *
     * @param isConnected boardgame.io `state.isConnected` for this frame.
     * @param stateId The frame's `_stateID`, or null when absent.
     */
    setConnected(isConnected: boolean, stateId: number | null): void {
      this.isConnected = isConnected;
      this.lastStateId = stateId;
      if (isConnected === true) {
        this.hasEverConnected = true;
      }
    },
  },
});
