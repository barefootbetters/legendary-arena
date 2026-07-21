/**
 * Card-image working-set prefetch — Arena Client (WP-410 / D-24222)
 *
 * Watches the live UIState snapshot and, when a match's card-image manifest first
 * becomes available, warms every image into the browser image cache during the
 * setup / pre-match screen — so a card paints from cache the moment it is revealed
 * instead of blocking the turn on a mid-turn round-trip to the R2 image host.
 *
 * The manifest (`UIState.matchCardImageUrls`) is the engine's deduped set of every
 * card-face image URL the match can show. The client cannot derive it (it may not
 * import the registry at runtime, and the per-zone projection carries only
 * currently-visible cards), so the engine projects it (WP-410) and this composable
 * consumes it — no image URL is constructed here.
 *
 * Mounted at `PlayViewport` (which reads the shared uiState store and covers both
 * the desktop and mobile play surfaces). The warm is fire-and-forget: it never
 * throws, never blocks rendering, is idempotent across the per-frame re-sends of
 * the manifest, and a failed image is simply skipped (the card falls back to its
 * lazy `<img>` in CardTile.vue at reveal).
 *
 * Layer-boundary: imports no engine/server runtime — it reads the projected
 * manifest from the uiState store and uses the browser Image API only.
 */

import { watch } from 'vue';

import { useUiStateStore } from '../stores/uiState';

// why: at most this many warms are in flight at once. Bounded so the prefetch
// rides HTTP/2 multiplexing without saturating the connection or creating a
// head-of-line stall that would delay the first-needed cards.
const PREFETCH_CONCURRENCY = 6;

/**
 * Warms a single image URL into the browser image cache. Resolves on both load
 * and error and never rejects — a prefetch must never throw or block gameplay.
 *
 * why: `new Image()` warms the SAME image cache that the `<img>` in CardTile.vue
 * reads, so the card paints from cache on reveal with no network request. A
 * failed warm resolves quietly; the card falls back to its lazy `<img>`.
 *
 * @param imageUrl - The card-face image URL to warm.
 * @returns A promise that resolves once the image has loaded or failed.
 */
function warmOneImage(imageUrl: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = imageUrl;
  });
}

/**
 * Warms a list of image URLs with a bounded number of concurrent requests.
 *
 * why: a fixed pool of workers pulls from the shared list so no more than
 * PREFETCH_CONCURRENCY warms are ever in flight. Each worker awaits its image
 * (which never rejects), so one slow or failed image does not abort the rest.
 *
 * @param imageUrls - The distinct image URLs to warm (already deduped upstream).
 * @returns A promise that resolves once every URL has been warmed or has failed.
 */
async function warmImageUrls(imageUrls: readonly string[]): Promise<void> {
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < imageUrls.length) {
      const imageUrl = imageUrls[nextIndex]!;
      nextIndex += 1;
      await warmOneImage(imageUrl);
    }
  }

  const workerCount = Math.min(PREFETCH_CONCURRENCY, imageUrls.length);
  const workers: Promise<void>[] = [];
  for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
}

/**
 * Warm the match's card images into the browser cache at match start.
 *
 * Reads the projected `matchCardImageUrls` from the shared uiState store and warms
 * each URL exactly once. A snapshot with no manifest (or an empty one) is a no-op,
 * so a non-live mount (null snapshot) warms nothing.
 */
export function useCardImagePrefetch(): void {
  const uiStateStore = useUiStateStore();
  // why: the manifest is re-sent on every server frame (the transport ships the
  // full filtered playerView per update). This set records which URLs are already
  // warmed so repeated frames — and a reconnect — never refetch (idempotency).
  const warmedImageUrls = new Set<string>();

  watch(
    () => uiStateStore.snapshot?.matchCardImageUrls,
    (imageUrls) => {
      if (imageUrls === undefined || imageUrls.length === 0) {
        // why: no manifest yet (or an empty match) — nothing to warm. Keeps a
        // null-snapshot mount a pure no-op (never touches the Image API).
        return;
      }
      const freshImageUrls = imageUrls.filter(
        (imageUrl) => !warmedImageUrls.has(imageUrl),
      );
      if (freshImageUrls.length === 0) {
        return;
      }
      for (const imageUrl of freshImageUrls) {
        warmedImageUrls.add(imageUrl);
      }
      void warmImageUrls(freshImageUrls);
    },
    { immediate: true },
  );
}
