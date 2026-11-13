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
 * lazy `CardImage.vue` element at reveal). Each warm requests the WP-888 size
 * tier the board renders (WP-891 / D-24848), not the full original.
 *
 * Layer-boundary: imports no engine/server runtime — it reads the projected
 * manifest from the uiState store and uses the browser Image API only.
 */

import { watch } from 'vue';

import { cardImageSources } from '../lib/cardImageTiers';
import { useUiStateStore } from '../stores/uiState';

// why: at most this many warms are in flight at once. Bounded so the prefetch
// rides HTTP/2 multiplexing without saturating the connection or creating a
// head-of-line stall that would delay the first-needed cards.
const PREFETCH_CONCURRENCY = 6;

/**
 * Warms the original card-face image on a fresh element after its size tier
 * failed. Resolves on both load and error and never rejects.
 *
 * @param imageUrl - The original card-face image URL.
 * @returns A promise that resolves once the original has loaded or failed.
 */
function warmOriginalImage(imageUrl: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const fallbackImage = new Image();
    fallbackImage.onload = () => resolve();
    fallbackImage.onerror = () => resolve();
    fallbackImage.src = imageUrl;
  });
}

/**
 * Warms a single card-face image into the browser image cache. Resolves on both
 * load and error and never rejects — a prefetch must never throw or block
 * gameplay.
 *
 * why: `new Image()` warms the SAME image cache that the card-face image
 * (`CardImage.vue`, WP-891 / D-24848) reads, and the warm uses the same `src` /
 * `srcset` pair, so the browser picks the same candidate the board will request
 * and the card paints from cache on reveal with no network request. When a tier
 * fails, the original is warmed once on a fresh image, matching the board's
 * fallback; an untiered URL that fails resolves quietly with no second warm.
 *
 * @param imageUrl - The original card-face image URL to warm.
 * @returns A promise that resolves once the image has loaded or failed.
 */
function warmOneImage(imageUrl: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const sources = cardImageSources(imageUrl);
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => {
      if (sources.srcset === null) {
        resolve();
        return;
      }
      void warmOriginalImage(imageUrl).then(resolve);
    };
    if (sources.srcset !== null) {
      image.srcset = sources.srcset;
    }
    image.src = sources.src;
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
  // It stays keyed by the ORIGINAL manifest URL (WP-891 / D-24848), not the tier
  // URL, so a re-sent manifest is a no-op whichever candidate the browser chose.
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
