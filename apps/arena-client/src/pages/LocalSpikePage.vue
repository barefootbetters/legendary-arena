<script lang="ts">
/**
 * WP-890 local match spike page (D-24842), at `?route=local-spike`.
 *
 * Development-only: App.vue loads this page through a dynamic import that a
 * build drops unless `VITE_LOCAL_SPIKE` is set, so neither the page nor the
 * setup bundle it imports reaches a default build. It plays the featured
 * table on an in-browser `Local()` master with no game server. The player
 * plays by hand; the page never runs a bot or the engine's AI, and it
 * persists nothing (the record lives in memory and downloads on request).
 */
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue';

import PlayViewport from './PlayViewport.vue';
import featuredSetupBundleJson from '../fixtures/localSpike/featuredSetupBundle.json';
import { parseLocalSpikeSetupBundle, type LocalSpikeSetupBundle } from '../client/setupBundleReader';
import {
  createLocalSpikeClient,
  LOCAL_SPIKE_DEFAULT_SEED,
  replayLocalSpikeRecord,
  type LocalSpikeClientHandle,
} from '../client/localSpikeClient';
import type { SubmitMove, UiMoveName } from '../components/play/uiMoveName.types';

/** The `matchSeed.mjs` seed length: 16 bytes, 32 hex characters. */
const NEW_SEED_BYTE_LENGTH = 16;

/**
 * Makes a fresh 32-character lowercase hex seed.
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
 * Reads an unknown thrown value as a message for the panel.
 *
 * @param error - The thrown value.
 * @returns Its message.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Compares the replayed UIState strings with the ones captured during play.
 *
 * @param replayed - The replay's strings.
 * @param live - The strings captured live.
 * @returns The panel's result line.
 */
function describeReplay(replayed: readonly string[], live: readonly string[]): string {
  const moveCount = Math.max(replayed.length, live.length);
  for (let i = 0; i < moveCount; i++) {
    if (replayed[i] !== live[i]) {
      return `Replay differs at move ${i}`;
    }
  }
  return `Replay matches: ${moveCount} of ${moveCount} moves`;
}

export default defineComponent({
  name: 'LocalSpikePage',
  components: { PlayViewport },
  setup() {
    const errorMessage = ref<string | null>(null);
    const seed = ref(LOCAL_SPIKE_DEFAULT_SEED);
    const moveCount = ref(0);
    const replayResult = ref<string | null>(null);
    const imageUrlCount = ref<number | null>(null);
    const bundleByteCount = ref<number | null>(null);
    // why: bumped on every match start so PlayViewport remounts; otherwise the
    // board's own component state (the Battle Brief's "Beginning…") outlives
    // the match a New seed replaced.
    const matchKey = ref(0);
    let bundle: LocalSpikeSetupBundle | null = null;
    let handle: LocalSpikeClientHandle | null = null;
    let liveStates: string[] = [];

    /** Reads the latest frame's unique card-image count into the panel. */
    function refreshImageCount(): void {
      const urls = handle?.getState()?.matchCardImageUrls;
      imageUrlCount.value = urls === undefined ? null : new Set(urls).size;
    }

    /**
     * Stops any running match and starts a new one on the given seed.
     *
     * @param nextSeed - The seed to play.
     */
    function startMatch(nextSeed: string): void {
      handle?.stop();
      handle = null;
      liveStates = [];
      moveCount.value = 0;
      replayResult.value = null;
      try {
        bundle ??= parseLocalSpikeSetupBundle(featuredSetupBundleJson);
        bundleByteCount.value = new Blob([JSON.stringify(bundle)]).size;
        const nextHandle = createLocalSpikeClient({
          bundle,
          matchConfiguration: bundle.matchConfiguration,
          seed: nextSeed,
          writesStores: true,
        });
        nextHandle.start();
        handle = nextHandle;
        seed.value = nextSeed;
        matchKey.value += 1;
        errorMessage.value = null;
        refreshImageCount();
      } catch (error) {
        errorMessage.value = describeError(error);
      }
    }

    // why: PlayViewport submits `(name, args)`; the handle records the call and
    // the page captures the UIState after it, for Replay record to compare.
    const submitMove: SubmitMove = (name: UiMoveName, args: unknown): void => {
      if (handle === null) {
        return;
      }
      handle.submitMove(name, args);
      liveStates.push(JSON.stringify(handle.getState()));
      moveCount.value = liveStates.length;
      refreshImageCount();
    };

    /** Restarts the match on a fresh random seed. */
    function onNewSeed(): void {
      try {
        startMatch(makeRandomSeed());
      } catch (error) {
        errorMessage.value = describeError(error);
      }
    }

    /** Replays the record on a fresh local master and compares the result. */
    function onReplayRecord(): void {
      if (handle === null || bundle === null) {
        return;
      }
      try {
        const replayed = replayLocalSpikeRecord(handle.getRecord(), bundle);
        replayResult.value = describeReplay(replayed, liveStates);
      } catch (error) {
        errorMessage.value = describeError(error);
      }
    }

    /** Saves the record as `local-spike-record-<seed>.json`. */
    function onDownloadRecord(): void {
      if (handle === null) {
        return;
      }
      const blob = new Blob([JSON.stringify(handle.getRecord(), null, 2)], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `local-spike-record-${seed.value}.json`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    }

    onMounted(() => startMatch(LOCAL_SPIKE_DEFAULT_SEED));
    onBeforeUnmount(() => {
      handle?.stop();
      handle = null;
    });

    return {
      errorMessage,
      seed,
      moveCount,
      replayResult,
      imageUrlCount,
      bundleByteCount,
      matchKey,
      submitMove,
      onNewSeed,
      onReplayRecord,
      onDownloadRecord,
    };
  },
});
</script>

<template>
  <div class="local-spike-page" data-testid="local-spike-page">
    <section class="local-spike-panel" data-testid="local-spike-panel">
      <strong>Local match spike (WP-890)</strong>
      <span>seed: <code data-testid="local-spike-seed">{{ seed }}</code></span>
      <span>moves: <span data-testid="local-spike-move-count">{{ moveCount }}</span></span>
      <span>bundle bytes: {{ bundleByteCount ?? '—' }}</span>
      <span>matchCardImageUrls: {{ imageUrlCount ?? '—' }} unique</span>
      <button type="button" data-testid="local-spike-new-seed" @click="onNewSeed">New seed</button>
      <button type="button" data-testid="local-spike-download" @click="onDownloadRecord">Download record</button>
      <button type="button" data-testid="local-spike-replay" @click="onReplayRecord">Replay record</button>
      <span v-if="replayResult !== null" data-testid="local-spike-replay-result">{{ replayResult }}</span>
      <span v-if="errorMessage !== null" class="local-spike-error" data-testid="local-spike-error">{{ errorMessage }}</span>
    </section>
    <PlayViewport v-if="errorMessage === null" :key="matchKey" :submit-move="submitMove" />
  </div>
</template>

<style scoped>
.local-spike-page {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.local-spike-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
}

.local-spike-error {
  color: #ff6b6b;
  font-weight: 600;
}
</style>
