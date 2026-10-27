/**
 * Pinia store holding the build provenance for the live match: client build,
 * running server build, and match creation time (see
 * `diagnostics/buildProvenance.ts`).
 *
 * The play viewport loads it once per match id, and refreshes it after every
 * transport reconnect: a server deploy drops the socket, so the server build
 * read at load time is stale once the client reconnects. The diagnostics and game-log
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
  /** Bumped by every collection, so only the newest one may write the record. */
  collectionSequence: number;
}

export const useBuildProvenanceStore = defineStore('buildProvenance', {
  state: (): BuildProvenanceStoreState => ({
    provenance: null,
    requestedMatchId: null,
    collectionSequence: 0,
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
      await this.collectAndStore(serverBaseUrl, matchId, clientBuild, fetchImpl);
    },
    /**
     * Collects the provenance again for the match already loaded, replacing the
     * record. Called after a transport reconnect. A call for any other match id is
     * a no-op. Never throws.
     *
     * @param serverBaseUrl The game server origin.
     * @param matchId The live match id.
     * @param clientBuild The client build baked into the tab.
     * @param fetchImpl The fetch implementation.
     */
    async refresh(
      serverBaseUrl: string,
      matchId: string,
      clientBuild: ClientBuild,
      fetchImpl: FetchLike,
    ): Promise<void> {
      if (matchId === '' || matchId !== this.requestedMatchId) {
        return;
      }
      await this.collectAndStore(serverBaseUrl, matchId, clientBuild, fetchImpl);
    },
    /**
     * Collects the provenance and writes it, unless a newer collection started
     * meanwhile. A failed version probe writes a record whose server build is
     * unknown: after a reconnect the old server build is no longer known to be
     * running, so the header says unknown rather than naming it.
     *
     * @param serverBaseUrl The game server origin.
     * @param matchId The match id to collect for.
     * @param clientBuild The client build baked into the tab.
     * @param fetchImpl The fetch implementation.
     */
    async collectAndStore(
      serverBaseUrl: string,
      matchId: string,
      clientBuild: ClientBuild,
      fetchImpl: FetchLike,
    ): Promise<void> {
      this.collectionSequence += 1;
      const sequence = this.collectionSequence;
      const collected = await collectBuildProvenance(serverBaseUrl, matchId, clientBuild, fetchImpl);
      // why: a later load (another match) or refresh (a second reconnect) may have
      // started while this one was in flight; only the newest may write the record.
      if (sequence === this.collectionSequence && this.requestedMatchId === matchId) {
        this.provenance = collected;
      }
    },
  },
});
