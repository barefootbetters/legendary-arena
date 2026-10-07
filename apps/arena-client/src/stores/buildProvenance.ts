/**
 * Pinia store holding the build provenance for the live match: client build,
 * running server build, and match creation time (see
 * `diagnostics/buildProvenance.ts`).
 *
 * The play viewport loads it once per match id. The diagnostics and game-log
 * exports read it synchronously at click time, so the copy and download
 * handlers stay synchronous (a clipboard write after a network await can lose
 * the click's user activation). Until the load finishes `provenance` is null and
 * the exports fall back to their plain output.
 *
 * why: build provenance is deployment metadata, never game state — no `G`, no
 * card or zone data, never persisted.
 */

import { defineStore } from 'pinia';
import {
  collectBuildProvenance,
  type BuildProvenance,
  type ClientBuild,
  type FetchLike,
} from '../diagnostics/buildProvenance';

interface BuildProvenanceStoreState {
  /** The collected provenance, or null before the first load completes. */
  provenance: BuildProvenance | null;
  /** The match id the in-flight or finished load is for, so a re-mount does not refetch. */
  requestedMatchId: string | null;
}

export const useBuildProvenanceStore = defineStore('buildProvenance', {
  state: (): BuildProvenanceStoreState => ({
    provenance: null,
    requestedMatchId: null,
  }),
  actions: {
    /**
     * Loads the provenance for a match once. A repeat call for the same match id
     * is a no-op; a different match id replaces the record. Never throws.
     *
     * @param serverBaseUrl The game server origin.
     * @param matchId The live match id (`''` outside a match is ignored).
     * @param clientBuild The client build baked into the tab.
     * @param fetchImpl The fetch implementation.
     */
    async load(
      serverBaseUrl: string,
      matchId: string,
      clientBuild: ClientBuild,
      fetchImpl: FetchLike,
    ): Promise<void> {
      if (matchId === '' || matchId === this.requestedMatchId) {
        return;
      }
      this.requestedMatchId = matchId;
      const collected = await collectBuildProvenance(serverBaseUrl, matchId, clientBuild, fetchImpl);
      // why: a later load for another match may have started while this one was
      // in flight; only the latest requested match may write the record.
      if (this.requestedMatchId === matchId) {
        this.provenance = collected;
      }
    },
  },
});
