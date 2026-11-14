<script lang="ts">
import { defineComponent } from 'vue';

import { formatBuildStamp } from '../../lib/buildStamp';

/**
 * The footer build stamp: the version and when this client build went out, in
 * the viewer's local time. Uses `defineComponent({ setup() { return {...} } })`
 * so the template binding reaches `_ctx` under the vue-sfc-loader separate-compile
 * pipeline (D-6512).
 */
export default defineComponent({
  name: 'VersionBadge',
  setup() {
    // why: no time zone argument, so the build time reads in the viewer's local zone.
    const stamp = formatBuildStamp(__APP_VERSION__, __BUILD_TIMESTAMP__, __GIT_SHA__);
    return { stamp };
  },
});
</script>

<template>
  <!--
    // why: the short git sha means nothing to a player, so it moved to the
    // tooltip; the visible text is the version and when this build went out.
  -->
  <span class="version-badge" :title="stamp.tooltip" data-testid="version-badge">
    <span class="version-badge__version">{{ stamp.versionLabel }}</span>
    <template v-if="stamp.updatedLabel !== ''">
      <span class="version-badge__separator" aria-hidden="true">&middot;</span>
      <span class="version-badge__updated">
        Updated <time :datetime="stamp.updatedIso">{{ stamp.updatedLabel }}</time>
      </span>
    </template>
  </span>
</template>

<style scoped>
/* why: the badge used to be position:fixed in the bottom-right corner at 50%
   opacity, where the play page's fixed audio controls sat on top of it. It is now
   ordinary footer text, beside the copyright, at the footer's own readable colour:
   nothing fixed is anchored to the footer's centre, so nothing covers it. */
.version-badge {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0 0.35em;
  color: var(--la-color-text-secondary);
  font-size: 0.75rem;
  white-space: nowrap;
}

.version-badge__version {
  font-weight: 600;
}
</style>
