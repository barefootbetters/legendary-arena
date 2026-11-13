/**
 * useCardImagePrefetch tests (WP-410 / EC-445).
 *
 * Drives the composable against a stubbed `globalThis.Image` and a real Pinia
 * uiState store: the match manifest is warmed exactly once per distinct URL with
 * a bounded number in flight; a failed warm does not throw or abort the rest; a
 * re-sent manifest does not refetch already-warmed URLs (idempotency); and an
 * absent/empty manifest warms nothing (the no-op guarantee that keeps a
 * null-snapshot mount inert).
 *
 * Pure `node:test` — a `.ts` composable, no DOM mount and no vue-sfc-loader.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

import { useCardImagePrefetch } from './useCardImagePrefetch';
import { useUiStateStore } from '../stores/uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';
import type { UIState } from '@legendary-arena/game-engine';

interface PendingWarm {
  readonly src: string;
  readonly srcset: string;
  readonly succeed: () => void;
  readonly fail: () => void;
}

interface ImageStub {
  readonly srcs: string[];
  readonly srcsets: string[];
  readonly pending: PendingWarm[];
  restore: () => void;
}

/**
 * Replaces `globalThis.Image` with a fake that records each `src` (and the
 * `srcset` in place when it was set) and defers its load/error so the test
 * controls completion and can inspect how many warms are in flight.
 */
function installImageStub(): ImageStub {
  const originalImage = globalThis.Image;
  const srcs: string[] = [];
  const srcsets: string[] = [];
  const pending: PendingWarm[] = [];
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    srcset = '';
    #src = '';
    get src(): string {
      return this.#src;
    }
    set src(value: string) {
      this.#src = value;
      srcs.push(value);
      srcsets.push(this.srcset);
      pending.push({
        src: value,
        srcset: this.srcset,
        succeed: () => this.onload?.(),
        fail: () => this.onerror?.(),
      });
    }
  }
  globalThis.Image = FakeImage as unknown as typeof globalThis.Image;
  return {
    srcs,
    srcsets,
    pending,
    restore: () => {
      globalThis.Image = originalImage;
    },
  };
}

/** Flush Vue's watcher scheduler + pending microtasks. */
async function flush(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** A UIState fixture carrying a known card-image manifest. */
function snapshotWithManifest(imageUrls: string[]): UIState {
  return { ...loadUiStateFixture('mid-turn'), matchCardImageUrls: imageUrls };
}

/** Resolve every deferred warm (success), letting workers pull the next URL. */
async function drainAll(stub: ImageStub): Promise<void> {
  while (stub.pending.length > 0) {
    const next = stub.pending.shift()!;
    next.succeed();
    await flush();
  }
}

const MANIFEST_10 = Array.from(
  { length: 10 },
  (_unused, index) => `https://images.legendary-arena.com/set/card-${index}.webp`,
);

// why: WP-891 / D-24848 — the warm requests the thumb tier with the same
// `thumb 1x, phone 2x` srcset the board's card image renders.
const MANIFEST_10_THUMBS = Array.from(
  { length: 10 },
  (_unused, index) => `https://images.legendary-arena.com/set/thumb/card-${index}.webp`,
);
const MANIFEST_10_SRCSETS = Array.from(
  { length: 10 },
  (_unused, index) =>
    `https://images.legendary-arena.com/set/thumb/card-${index}.webp 1x, `
    + `https://images.legendary-arena.com/set/phone/card-${index}.webp 2x`,
);

test('warms each distinct URL once, at most PREFETCH_CONCURRENCY in flight', async () => {
  setActivePinia(createPinia());
  const stub = installImageStub();
  try {
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(snapshotWithManifest(MANIFEST_10));

    useCardImagePrefetch();
    await flush();

    // why: 10 URLs, concurrency 6 — only 6 warms start before any completes.
    assert.equal(stub.pending.length, 6, 'at most 6 warms in flight at once');
    assert.equal(stub.srcs.length, 6);

    await drainAll(stub);

    assert.deepStrictEqual([...stub.srcs].sort(), [...MANIFEST_10_THUMBS].sort());
    assert.deepStrictEqual([...stub.srcsets].sort(), [...MANIFEST_10_SRCSETS].sort());
    assert.equal(new Set(stub.srcs).size, 10, 'each URL warmed exactly once');
  } finally {
    stub.restore();
  }
});

test('a failed tier warm warms the original once on a fresh image and does not abort the rest', async () => {
  setActivePinia(createPinia());
  const stub = installImageStub();
  try {
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(snapshotWithManifest(MANIFEST_10));

    useCardImagePrefetch();
    await flush();

    // Fail the first in-flight (tier) warm; succeed everything else, including
    // the fallback warm of its original.
    let failedWarm: PendingWarm | null = null;
    while (stub.pending.length > 0) {
      const next = stub.pending.shift()!;
      if (failedWarm === null) {
        failedWarm = next;
        next.fail();
      } else {
        next.succeed();
      }
      await flush();
    }

    assert.ok(failedWarm !== null, 'one warm was failed');
    const failedOriginal = failedWarm.src.replace('/set/thumb/', '/set/');
    assert.equal(
      stub.srcs.filter((src) => src === failedOriginal).length,
      1,
      'the failed tier\'s original is warmed exactly once',
    );
    const fallbackIndex = stub.srcs.indexOf(failedOriginal);
    assert.equal(stub.srcsets[fallbackIndex], '', 'the original warm is a fresh image with no srcset');
    assert.equal(new Set(stub.srcs).size, 11, 'all 10 tier URLs plus one original fallback');
    for (const thumbUrl of MANIFEST_10_THUMBS) {
      assert.ok(stub.srcs.includes(thumbUrl), `tier ${thumbUrl} still warmed despite a failure`);
    }
  } finally {
    stub.restore();
  }
});

test('a failed warm of a URL with no tiers resolves with no second warm', async () => {
  setActivePinia(createPinia());
  const stub = installImageStub();
  try {
    // why: seven untiered URLs at concurrency 6 — the seventh starts only once
    // a warm resolves, so it proves the failed warm resolved.
    const untieredManifest = Array.from(
      { length: 7 },
      (_unused, index) => `https://images.example/card-${index}.webp`,
    );
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(snapshotWithManifest(untieredManifest));

    useCardImagePrefetch();
    await flush();
    assert.equal(stub.pending.length, 6);

    const firstWarm = stub.pending.shift()!;
    firstWarm.fail();
    await flush();
    await drainAll(stub);

    assert.deepStrictEqual([...stub.srcs].sort(), [...untieredManifest].sort());
    assert.equal(
      stub.srcs.filter((src) => src === firstWarm.src).length,
      1,
      'the failed untiered URL is not warmed a second time',
    );
    assert.ok(stub.srcsets.every((srcset) => srcset === ''), 'an untiered warm sets no srcset');
  } finally {
    stub.restore();
  }
});

test('a re-sent identical manifest does not refetch warmed URLs (idempotent)', async () => {
  setActivePinia(createPinia());
  const stub = installImageStub();
  try {
    const uiStateStore = useUiStateStore();
    uiStateStore.setSnapshot(snapshotWithManifest(MANIFEST_10));

    useCardImagePrefetch();
    await flush();
    await drainAll(stub);
    const warmCountAfterFirst = stub.srcs.length;

    // A fresh snapshot object with the SAME URLs (a later server frame).
    uiStateStore.setSnapshot(snapshotWithManifest([...MANIFEST_10]));
    await flush();

    assert.equal(stub.srcs.length, warmCountAfterFirst, 'no re-warm of already-warmed URLs');
  } finally {
    stub.restore();
  }
});

test('an absent or empty manifest warms nothing (no-op mount)', async () => {
  setActivePinia(createPinia());
  const stub = installImageStub();
  try {
    const uiStateStore = useUiStateStore();

    // Null snapshot (a non-live mount).
    useCardImagePrefetch();
    await flush();
    assert.equal(stub.srcs.length, 0, 'null snapshot warms nothing');

    // Empty manifest (a cardless / not-yet-populated match).
    uiStateStore.setSnapshot(snapshotWithManifest([]));
    await flush();
    assert.equal(stub.srcs.length, 0, 'empty manifest warms nothing');
  } finally {
    stub.restore();
  }
});
