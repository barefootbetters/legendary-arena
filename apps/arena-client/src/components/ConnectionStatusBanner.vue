<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import { useConnectionStore } from '../stores/connection.js';

/**
 * Non-blocking banner shown when the live match's transport connection has
 * dropped (WP-311). Visible only once the client has connected at least once
 * and is currently disconnected, so a fresh page that has not yet connected
 * shows nothing. Offers a "Reconnect now" action that calls the live client's
 * `resync()` to re-anchor to the server's authoritative state.
 *
 * why: read-only status surface — it never mutates match state and never gates
 * a move the engine would otherwise accept. Connection status comes from the
 * `connection` Pinia store (framework/transport state), never from `G`.
 */
export default defineComponent({
  name: 'ConnectionStatusBanner',
  props: {
    /**
     * The live client's re-sync callback (`LiveClientHandle.resync`). Invoked
     * by the "Reconnect now" button. Prop-drilled so the banner stays pure and
     * the bgioClient remains the sole runtime engine-import site (WP-090).
     */
    resync: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const connection = useConnectionStore();

    // why: show the banner only when the client HAS connected before and is
    // now disconnected — distinguishing a real drop from the pre-first-connect
    // state (where isConnected is also false but there is nothing to recover).
    const isVisible = computed(
      () => connection.hasEverConnected === true && connection.isConnected === false,
    );

    /** Invokes the injected resync callback from the "Reconnect now" button. */
    function onReconnectClick(): void {
      props.resync();
    }

    return { isVisible, onReconnectClick };
  },
});
</script>

<template>
  <div
    v-if="isVisible"
    class="connection-banner"
    role="status"
    aria-live="polite"
    data-testid="connection-status-banner"
  >
    <span class="connection-banner__message">Connection lost — reconnecting…</span>
    <button
      type="button"
      class="connection-banner__action"
      data-testid="connection-reconnect-button"
      @click="onReconnectClick"
    >
      Reconnect now
    </button>
  </div>
</template>

<style scoped>
.connection-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: #7a1f1f;
  color: #fff;
  font-size: 0.9rem;
  text-align: center;
}

.connection-banner__action {
  padding: 0.25rem 0.75rem;
  border: 1px solid #fff;
  border-radius: 0.25rem;
  background: transparent;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
}

.connection-banner__action:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
