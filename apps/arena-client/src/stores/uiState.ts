/**
 * Pinia store for the current UIState snapshot.
 *
 * The store holds exactly one state field and exposes exactly one action.
 * Derived view state (selectors, memoization, per-audience filters) is
 * deliberately left for future UI packets so that the bootstrap contract
 * is frozen here for WP-062 (Arena HUD), WP-064 (Log/Replay Inspector),
 * and every subsequent UI packet to consume.
 */

import { defineStore } from 'pinia';
import type { UIState } from '@legendary-arena/game-engine';

interface UiStateStoreState {
  snapshot: UIState | null;
}

// why: the Pinia Options API shape (state + actions) is used instead of the
// Setup API because this store has exactly one state field and one action —
// the Options form is more readable at this size, and the two-key contract
// is easier for future packets to grep for.
// why: the store holds the current projection only. Derived view state
// (selectors, memoization, per-audience filtering) is deliberately left
// for future UI packets and must not accrete here; that boundary keeps
// WP-061's contract small enough to be a stable foundation for WP-062+.
export const useUiStateStore = defineStore('uiState', {
  state: (): UiStateStoreState => ({
    snapshot: null,
  }),
  actions: {
    /**
     * Replace the current UIState snapshot (or clear it with null).
     * @param next The new UIState projection, or null to clear.
     */
    setSnapshot(next: UIState | null): void {
      this.snapshot = next;
    },
  },
});
