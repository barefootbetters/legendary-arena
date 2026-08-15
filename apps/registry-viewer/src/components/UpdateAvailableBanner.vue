<script lang="ts">
import { computed, defineComponent, ref, type PropType } from "vue";

/**
 * Non-blocking notice shown when a NEWER viewer build has been deployed while
 * this tab is open (WP-552 / EC-587 / D-24361). Fed by
 * {@link ../composables/useDeployVersionCheck}. Offers a "Refresh now" action
 * that reloads the page — the only fix for a stale bundle — plus a dismiss
 * control so an operator mid-task is not nagged.
 *
 * why: read-only status surface. It never mutates the loadout draft, never
 * gates any control, and the reload is USER-INITIATED, never automatic: a forced
 * reload would discard an in-progress draft and read as hostile.
 *
 * Ported from `apps/arena-client/src/components/UpdateAvailableBanner.vue`
 * (WP-418). Duplicated rather than shared — second consumer, duplicate-first
 * per `.claude/rules/code-style.md` §Abstraction.
 */
export default defineComponent({
  name: "UpdateAvailableBanner",
  props: {
    /** True once a newer build is deployed (from `useDeployVersionCheck`). */
    updateAvailable: {
      type: Boolean,
      required: true,
    },
    /**
     * The page-reload action. Prop-drilled so this component stays pure and the
     * `window.location.reload()` site is owned by the host.
     */
    refresh: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    // why: dismissal is IN-TAB presentation state only — no localStorage, no
    // sessionStorage, no `src/prefs/` wiring. `02-CODE-CATEGORIES.md` permits a
    // docs-app localStorage "for view preferences only", which makes persisting
    // this a defensible misreading; it is deliberately not persisted, because a
    // dismissal that outlives the tab would suppress the notice on a genuinely
    // newer build in a later session.
    const isDismissed = ref<boolean>(false);

    const isVisible = computed<boolean>(
      () => props.updateAvailable === true && isDismissed.value === false,
    );

    /** Reloads the page via the injected action (the "Refresh now" button). */
    function onRefreshClick(): void {
      props.refresh();
    }

    /** Hides the banner for this tab without reloading (the dismiss control). */
    function onDismissClick(): void {
      isDismissed.value = true;
    }

    return { isVisible, onRefreshClick, onDismissClick };
  },
});
</script>

<template>
  <!--
    why: a11y — role="status" + aria-live announces the update without stealing
    focus; the glyph pairs with text so the signal is never colour-only; both
    controls are real, keyboard-reachable buttons.
  -->
  <div
    v-if="isVisible"
    class="update-banner"
    role="status"
    aria-live="polite"
    data-testid="update-available-banner"
  >
    <span class="update-banner__glyph" aria-hidden="true">↻</span>
    <span class="update-banner__message">A new version is available.</span>
    <button
      type="button"
      class="update-banner__action"
      data-testid="update-refresh-button"
      @click="onRefreshClick"
    >
      Refresh now
    </button>
    <button
      type="button"
      class="update-banner__dismiss"
      aria-label="Dismiss the update notice"
      data-testid="update-dismiss-button"
      @click="onDismissClick"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: #1f3a5a;
  color: #fff;
  font-size: 0.9rem;
  text-align: center;
}

.update-banner__glyph {
  font-size: 1rem;
  line-height: 1;
}

.update-banner__action {
  padding: 0.25rem 0.75rem;
  border: 1px solid #fff;
  border-radius: 0.25rem;
  background: transparent;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
}

.update-banner__action:hover {
  background: rgba(255, 255, 255, 0.15);
}

.update-banner__dismiss {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.update-banner__dismiss:hover {
  color: rgba(255, 255, 255, 0.75);
}
</style>
