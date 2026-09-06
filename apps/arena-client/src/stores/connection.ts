/**
 * Pinia store for the live match's transport connection status (WP-311).
 *
 * Holds boardgame.io's `state.isConnected` (surfaced from `transport.isConnected`
 * on every subscribe frame) plus the last-seen `_stateID` and a one-way
 * `hasEverConnected` latch. The reconnect banner
 * (`components/ConnectionStatusBanner.vue`) reads this store to decide when to
 * show "Connection lost — reconnecting…".
 *
 * It also carries four recovery counters (WP-429 / D-24250) — one per silent
 * auto-recovery path in `client/bgioClient.ts` (a transport-reconnect resync, a
 * move-ack-timeout resync, a spectator-staleness resync, and a tab-focus resync).
 * Each path bumps its counter the moment it commits to a resync (past its
 * cooldown gate), so the WP-428 `transport` diagnostics block can report how many
 * times the client silently auto-recovered before an operator downloaded a freeze
 * report. The counters only count; they change no recovery behavior.
 *
 * why: connection status is FRAMEWORK / TRANSPORT state, never game state — it
 * carries no `G` / card / zone data and is never persisted. Per the WP-116
 * disconnect/reconnect policy, disconnect tracking lives in framework/client
 * state, never in `G`. This store is that client-side surface — and the recovery
 * counters are the same framework/transport state, never `G`, never persisted.
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
  /**
   * How many times the transport-reconnect resync (`bgioClient.ts`
   * `onTransportReconnect`, the D-24232 recovery) has fired. WP-429 / D-24250.
   */
  reconnectResyncCount: number;
  /**
   * How many times the move-acknowledgment-timeout resync (`bgioClient.ts`
   * `onWatchdogFire`, the WP-312 / D-24097 watchdog) has fired. WP-429 / D-24250.
   */
  moveAckResyncCount: number;
  /**
   * How many times the spectator-staleness resync (`bgioClient.ts`
   * `onSpectatorWatchdogFire`) has fired. WP-429 / D-24250.
   */
  spectatorStaleResyncCount: number;
  /**
   * How many times the tab-focus resync (`bgioClient.ts` `onVisibilityChange`
   * via `forceCooldownGatedResync`) has fired. WP-429 / D-24250.
   */
  tabFocusResyncCount: number;
}

// why: Options API (state + actions) mirrors the sibling `uiState` store —
// small, greppable, no derived logic accreting here. The banner derives its
// own visibility from the first three fields; this store only records them. The
// four recovery counters (WP-429) start at 0 and are bumped by dedicated
// `record*` actions the transport wrapper calls when a resync path fires.
export const useConnectionStore = defineStore('connection', {
  state: (): ConnectionStoreState => ({
    isConnected: false,
    lastStateId: null,
    hasEverConnected: false,
    lastFrameAtMs: null,
    reconnectResyncCount: 0,
    moveAckResyncCount: 0,
    spectatorStaleResyncCount: 0,
    tabFocusResyncCount: 0,
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
    /**
     * Records that the transport-reconnect resync fired once (WP-429 / D-24250).
     * Called by `bgioClient.ts` `onTransportReconnect` past its cooldown gate.
     */
    recordReconnectResync(): void {
      this.reconnectResyncCount += 1;
    },
    /**
     * Records that the move-ack-timeout resync fired once (WP-429 / D-24250).
     * Called by `bgioClient.ts` `onWatchdogFire`.
     */
    recordMoveAckResync(): void {
      this.moveAckResyncCount += 1;
    },
    /**
     * Records that the spectator-staleness resync fired once (WP-429 / D-24250).
     * Called by `bgioClient.ts` `onSpectatorWatchdogFire` past its cooldown gate.
     */
    recordSpectatorStaleResync(): void {
      this.spectatorStaleResyncCount += 1;
    },
    /**
     * Records that the tab-focus resync fired once (WP-429 / D-24250). Called by
     * `bgioClient.ts` `forceCooldownGatedResync` (the tab-focus path) past its
     * cooldown gate.
     */
    recordTabFocusResync(): void {
      this.tabFocusResyncCount += 1;
    },
  },
});
