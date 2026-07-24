<script lang="ts">
import { computed, defineComponent, ref, type PropType } from 'vue';

/**
 * Non-blocking notice shown when a NEWER client build has been deployed while
 * this tab is open (WP-418 / EC-453 / D-24238). Fed by
 * {@link ../composables/useDeployVersionCheck}. Offers a **"Refresh now"** action
 * that reloads the page (the only fix for a stale JS bundle — the reconnect /
 * resync stack re-anchors match state but cannot swap the bundle) and a dismiss
 * control so a player mid-decision is not nagged.
 *
 * why: read-only status surface — it never mutates match state and never gates a
 * move the engine would otherwise accept (the `ConnectionStatusBanner` contract).
 * The reload is USER-INITIATED, never automatic: a forced reload mid-turn would
 * discard an in-progress action and read as hostile (WP-418 §Out of scope).
 */
export default defineComponent({
  name: 'UpdateAvailableBanner',
  props: {
    /** True once a newer build is deployed (from `useDeployVersionCheck`). */
    updateAvailable: {
      type: Boolean,
      required: true,
    },
    /**
     * The page-reload action. Prop-drilled (like `ConnectionStatusBanner`'s
     * `resync` and `BotAllyStallBanner`'s `returnToLobby`) so the banner stays
     * pure and the `window.location.reload()` site is owned by the play-root host.
     */
    refresh: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    // why: dismissal is local presentation state — a player who chooses to keep
    // playing on the current bundle should not be re-nagged. It stays dismissed
    // for this tab; the stale bundle only truly resolves on a reload.
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
    // why: a11y — role="status" + aria-live announces the update without stealing
    // focus; the glyph ("↻") pairs with text so the signal is never colour-only;
    // both buttons are real, keyboard-reachable <button>s.
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
