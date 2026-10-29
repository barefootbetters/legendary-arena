<script lang="ts">
import { defineComponent } from 'vue';
import VersionBadge from './VersionBadge.vue';

export default defineComponent({
  name: 'BrandFooter',
  components: { VersionBadge },
});
</script>

<template>
  <footer class="brand-footer" data-testid="brand-footer">
    <span class="brand-footer-copyright">
      &copy; 2026
      <a class="brand-footer-link" href="https://www.legendary-arena.com">
        Legendary Arena
      </a>
    </span>
    <!--
      // why: the build stamp sits on its own line under the copyright. On the play
      // page the footer band is shared with the fixed utility dock (left) and audio
      // controls (right), so the centre column is the only free space; stacking
      // keeps that column narrow enough to clear both at 1280px and up.
    -->
    <VersionBadge />
  </footer>
</template>

<style scoped>
.brand-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--la-space-2) var(--la-space-5);
  background: var(--la-color-bg-primary);
  color: var(--la-color-text-secondary);
  border-top: 1px solid var(--la-color-border-subtle);
  font-family: var(--la-font-body);
  font-size: var(--la-font-size-small);
  /* why: two lines (copyright + build stamp) must fit the ~55px band the one-line
     footer used, or the desktop play page (sized to the gap between header and
     footer, D-24502) gains a page scroll. */
  line-height: 1.2;
}

.brand-footer-link {
  color: var(--la-color-text-secondary);
  text-decoration: underline;
}

.brand-footer-link:hover,
.brand-footer-link:focus-visible {
  color: var(--la-color-cta);
}
</style>
