<script setup lang="ts">
/**
 * The single registry-viewer card-face image outside the lightbox (WP-892 /
 * D-24849). Renders a WP-888 size tier on the given density ladder; when a
 * tier fails to load it retries the original URL once, and only a failure of
 * the original (or of a URL with no tiers) reaches the parent as `error`.
 *
 * `class` and `loading` fall through to the `<img>`, so a site swaps its
 * `<img>` for this component and keeps them.
 */
import { computed, ref, watch } from "vue";
import {
  resolveCardFaceSources,
  type CardFaceSources,
  type CardImageLadder,
} from "../lib/cardImageTiers";

const props = defineProps<{
  imageUrl: string;
  ladder: CardImageLadder;
  alt: string;
}>();

// why: declaring `error` keeps a parent `@error` listener off the `<img>`, so
// the parent never sees the first (tier) failure, only the final one. The
// `Event` is passed on because the grid's handler reads its target.
const emit = defineEmits<{ error: [event: Event] }>();

// why: a set published before its size step has no tier copies yet; the
// fallback to the original still shows its art instead of a dimmed tile.
const hasTierFailed = ref(false);

const sources = computed<CardFaceSources>(() =>
  resolveCardFaceSources(props.imageUrl, props.ladder, hasTierFailed.value),
);

watch(
  () => props.imageUrl,
  () => {
    hasTierFailed.value = false;
  },
);

/**
 * Handles an image load error: a failed tier falls back to the original once;
 * a failed original (or untiered URL) is reported to the parent.
 *
 * @param event - The image element's error event.
 */
function onImageError(event: Event): void {
  if (sources.value.srcset !== null) {
    hasTierFailed.value = true;
    return;
  }
  emit("error", event);
}
</script>

<template>
  <img
    :src="sources.src"
    :srcset="sources.srcset ?? undefined"
    :alt="alt"
    @error="onImageError"
  >
</template>
