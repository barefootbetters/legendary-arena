<script lang="ts">
import { defineComponent } from 'vue';

/**
 * PlaymatBackground — the fixed, full-bleed board-background layer for the
 * active playmat skin (WP-666 / D-24477).
 *
 * It paints, back-to-front: the skin's flat palette ground
 * (`--skin-board-background`), the mat image over it (`--skin-board-image`,
 * set on the `<PlayViewport>` root by `useSkinApplier` from the manifest —
 * `none` for a palette-only skin), and a mandatory legibility scrim
 * (`--skin-board-scrim`) so busy mat art never eats card / zone readability.
 * All three variables inherit from the `skin-<name>` class the applier toggles
 * on the shared viewport root; CSS custom properties inherit down the DOM tree,
 * so this fixed descendant still receives them.
 *
 * Per the EC-132 §2 SFC authoring whitelist (extended to all arena-client SFCs
 * under WP-065 / D-6512), this component uses `defineComponent({ setup })`
 * rather than `<script setup>` sugar.
 *
 * @see WP-666 / EC-703; DECISIONS.md D-24477 (activate the D-13002 background)
 */
export default defineComponent({
  name: 'PlaymatBackground',
});
</script>

<template>
  <!-- why: the layer is purely decorative and must never affect input or
       layout — `position: fixed` full-bleed BEHIND the board (negative
       z-index), `pointer-events: none` so it never intercepts a click, and
       `aria-hidden` so assistive tech skips it. It is a fixed layer, not a
       flow element, so it does not disturb the `display: contents`
       `<PlayViewport>` root or any board layout. -->
  <div class="playmat-background" aria-hidden="true" data-testid="playmat-background">
    <div class="playmat-background__scrim" data-testid="playmat-background-scrim"></div>
  </div>
</template>

<style scoped>
.playmat-background {
  /* why (D-24482): ABSOLUTE within the positioned `.play-viewport` box, NOT
     `position: fixed; z-index: -1`. A negative-z-index fixed layer is painted
     OVER by the opaque non-positioned `.app-shell` background (CSS paint order:
     a non-positioned element's background paints after negative-z children),
     so the mat was invisible. Scoping it to the `.play-viewport` stacking
     context (position:relative; z-index:0) as an absolute z-index:0 layer puts
     it above the app-shell ground and below the board content, and confines it
     to the play area so it never covers the app header. */
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  /* Palette ground first; the mat image (or `none`) over it. Both come from
     the skin class / applier on the <PlayViewport> root and inherit here. */
  background-color: var(--skin-board-background, #0b1020);
  background-image: var(--skin-board-image, none);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.playmat-background__scrim {
  position: absolute;
  inset: 0;
  /* Mandatory legibility overlay above the image, below the board content.
     The fallback keeps cards readable even before a skin theme loads. */
  background: var(--skin-board-scrim, rgba(8, 10, 18, 0.62));
}
</style>
