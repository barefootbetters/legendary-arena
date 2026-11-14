<script lang="ts">
/**
 * The offline page (WP-894 / D-24851), at `/offline/`.
 *
 * Plays the featured solo table on a boardgame.io `Local()` master on the
 * player's device (WP-890's local client, D-24844), with a fresh device seed
 * per match. The UI submits intents and reads only the `playerView` projection;
 * the unchanged engine owns truth on the device. The page never runs a bot or
 * the engine's AI.
 *
 * It registers the `/offline/` service worker and caches the setup's card
 * images, then says "Ready offline" once both are in place. Nothing is saved:
 * the match lives in memory, and a refresh starts a new match (on-device save
 * is a later slice).
 */
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';

import PlayViewport from './PlayViewport.vue';
import featuredSetupBundleJson from '../fixtures/localSpike/featuredSetupBundle.json';
import { parseLocalSpikeSetupBundle, type LocalSpikeSetupBundle } from '../client/setupBundleReader';
import { createLocalSpikeClient, type LocalSpikeClientHandle } from '../client/localSpikeClient';
import type { SubmitMove, UiMoveName } from '../components/play/uiMoveName.types';
import { registerOfflineServiceWorker } from '../offline/registerOfflineServiceWorker';
import { warmOfflineCardImages } from '../offline/offlineImageCache';
import { summarizeOfflineLineup } from '../offline/offlineLineup';
import type { LoadoutSummary } from '../lib/loadoutSummary';
import {
  describeOfflineStatus,
  type OfflineRegistrationStatus,
  type OfflineWarmCounts,
} from '../offline/offlineStatus';

/** The `matchSeed.mjs` seed length: 16 bytes, 32 hex characters. */
const NEW_SEED_BYTE_LENGTH = 16;

/**
 * Makes a fresh 32-character lowercase hex seed on the device.
 *
 * @returns The seed.
 */
function makeRandomSeed(): string {
  const bytes = new Uint8Array(NEW_SEED_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  let seed = '';
  for (const byte of bytes) {
    seed += byte.toString(16).padStart(2, '0');
  }
  return seed;
}

/**
 * Reads an unknown thrown value as a message for the status line.
 *
 * @param error - The thrown value.
 * @returns Its message.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    return 'The offline match could not start: ' + error.message;
  }
  return 'The offline match could not start: ' + String(error);
}

/**
 * Reads the browser's service-worker container, if it has one.
 *
 * @returns The container, or undefined (no navigator, or an insecure origin).
 */
function readServiceWorkerContainer(): ServiceWorkerContainer | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  return navigator.serviceWorker ?? undefined;
}

export default defineComponent({
  name: 'OfflinePlayPage',
  components: { PlayViewport },
  setup() {
    const errorMessage = ref<string | null>(null);
    const registrationOutcome = ref<OfflineRegistrationStatus>('pending');
    const isWorkerActive = ref(false);
    const hasInstallFailed = ref(false);
    const warm = ref<OfflineWarmCounts | null>(null);
    // why: bumped on every match start so PlayViewport remounts; otherwise the
    // board's own component state outlives the match New game replaced.
    const matchKey = ref(0);
    // why: the Battle Brief's lineup, built from the bundle because there is no
    // server to read the match LAGN from. Every match uses the same bundle.
    const lineup = ref<LoadoutSummary | null>(null);
    let bundle: LocalSpikeSetupBundle | null = null;
    let handle: LocalSpikeClientHandle | null = null;

    /**
     * Caches the current match's card images and records the counts. A later
     * match's warm replaces an earlier one's result.
     *
     * @param warmKey - The match key the warm belongs to.
     */
    async function warmCardImages(warmKey: number): Promise<void> {
      if (typeof caches === 'undefined' || handle === null) {
        return;
      }
      const imageUrls = new Set(handle.getState()?.matchCardImageUrls ?? []);
      const result = await warmOfflineCardImages(imageUrls, caches);
      if (warmKey === matchKey.value) {
        warm.value = result;
      }
    }

    /** Stops any running match and starts a new one on a fresh device seed. */
    function startMatch(): void {
      handle?.stop();
      handle = null;
      try {
        bundle ??= parseLocalSpikeSetupBundle(featuredSetupBundleJson);
        lineup.value ??= summarizeOfflineLineup(bundle);
        const nextHandle = createLocalSpikeClient({
          bundle,
          matchConfiguration: bundle.matchConfiguration,
          seed: makeRandomSeed(),
          writesStores: true,
        });
        nextHandle.start();
        handle = nextHandle;
        matchKey.value += 1;
        errorMessage.value = null;
        void warmCardImages(matchKey.value);
      } catch (error) {
        errorMessage.value = describeError(error);
      }
    }

    /**
     * Watches an installing worker: if it becomes redundant while no worker is
     * active, the first install failed. A failed update is not reported,
     * because the previous build's offline copy still works.
     *
     * @param registration - The worker registration.
     * @param worker - The installing worker, if any.
     */
    function watchInstallingWorker(
      registration: ServiceWorkerRegistration,
      worker: ServiceWorker | null,
    ): void {
      if (worker === null) {
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'redundant' && registration.active === null) {
          hasInstallFailed.value = true;
        }
      });
    }

    /** Registers the offline service worker and tracks its state. */
    async function registerWorker(): Promise<void> {
      const container = readServiceWorkerContainer();
      const result = await registerOfflineServiceWorker({
        isProductionBuild: typeof import.meta.env === 'object' && import.meta.env.PROD === true,
        buildId: __GIT_SHA__,
        serviceWorkerContainer: container,
      });
      registrationOutcome.value = result.outcome;
      const registration = result.registration;
      if (result.outcome !== 'registered' || registration === null || container === undefined) {
        return;
      }
      watchInstallingWorker(registration, registration.installing);
      registration.addEventListener('updatefound', () => {
        watchInstallingWorker(registration, registration.installing);
      });
      try {
        await container.ready;
        isWorkerActive.value = true;
      } catch {
        // why: `ready` does not reject in practice; if it ever did, the status
        // simply stays on "Preparing", and the page still plays online.
      }
    }

    // why: PlayViewport submits `(name, args)`; the local master applies the
    // intent and the stores update from its `playerView` frame.
    const submitMove: SubmitMove = (name: UiMoveName, args: unknown): void => {
      handle?.submitMove(name, args);
    };

    /** Starts a fresh match on a new seed. */
    function onNewGame(): void {
      startMatch();
    }

    // why: an error from the client or bundle replaces the offline status, so
    // the player sees why there is no board.
    const statusLine = computed((): string => {
      if (errorMessage.value !== null) {
        return errorMessage.value;
      }
      return describeOfflineStatus({
        registrationOutcome: registrationOutcome.value,
        isWorkerActive: isWorkerActive.value,
        hasInstallFailed: hasInstallFailed.value,
        warm: warm.value,
      });
    });

    onMounted(() => {
      void registerWorker();
      startMatch();
    });
    onBeforeUnmount(() => {
      handle?.stop();
      handle = null;
    });

    return {
      errorMessage,
      matchKey,
      lineup,
      submitMove,
      onNewGame,
      statusLine,
    };
  },
});
</script>

<template>
  <div class="offline-play-page" data-testid="offline-play-page">
    <section class="offline-play-bar">
      <strong>Offline table</strong>
      <span
        :class="{ 'offline-play-error': errorMessage !== null }"
        role="status"
        aria-live="polite"
        data-testid="offline-status"
      >{{ statusLine }}</span>
      <button type="button" data-testid="offline-new-game" @click="onNewGame">New game</button>
    </section>
    <!--
      // why: Back to Lobby starts a fresh offline match (its lobby phase, with the
      // Battle Brief) instead of navigating to `/`, which is outside the worker's
      // scope and has no offline copy.
    -->
    <PlayViewport
      v-if="errorMessage === null"
      :key="matchKey"
      :submit-move="submitMove"
      :provided-lineup="lineup"
      :on-return-to-lobby="onNewGame"
    />
  </div>
</template>

<style scoped>
.offline-play-page {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.offline-play-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
}

.offline-play-error {
  color: #ff6b6b;
  font-weight: 600;
}
</style>
