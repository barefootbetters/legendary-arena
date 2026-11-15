<script lang="ts">
import { computed, defineComponent, ref, watch } from 'vue';
import { cardImageSources, type CardImageSources } from '../../lib/cardImageTiers';

/**
 * The single play-surface card-face image (WP-891 / D-24848). Renders the
 * WP-888 thumb tier with a `thumb 1x, phone 2x` density `srcset`; when a tier
 * fails to load it retries the original URL once, and only a failure of the
 * original (or of a URL with no tiers) reaches the parent as `error`.
 *
 * `class`, `alt`, `loading`, `data-testid` and `title` fall through to the
 * `<img>`, so a site swaps its `<img>` for this component and keeps them.
 */
export default defineComponent({
  name: 'CardImage',
  props: {
    imageUrl: {
      type: String,
      required: true,
    },
  },
  // why: declaring `error` keeps a parent `@error` listener off the `<img>`,
  // so the parent never sees the first (tier) failure, only the final one.
  emits: ['error'],
  setup(props, { emit }) {
    // why: a set published before its size step has no tier copies yet; the
    // fallback to the original still shows its art instead of the parent's
    // name tile or a broken image.
    const hasTierFailed = ref(false);

    const sources = computed<CardImageSources>(() => {
      if (hasTierFailed.value) {
        return { src: props.imageUrl, srcset: null };
      }
      return cardImageSources(props.imageUrl);
    });

    watch(
      () => props.imageUrl,
      () => {
        hasTierFailed.value = false;
      },
    );

    /**
     * Handles an image load error: a failed tier falls back to the original
     * once; a failed original (or untiered URL) is reported to the parent.
     */
    function onImageError(): void {
      if (sources.value.srcset !== null) {
        hasTierFailed.value = true;
        return;
      }
      emit('error');
    }

    return { sources, onImageError };
  },
});
</script>

<template>
  <img
    :src="sources.src"
    :srcset="sources.srcset ?? undefined"
    @error="onImageError"
  />
</template>
