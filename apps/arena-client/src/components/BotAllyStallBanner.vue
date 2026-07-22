<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue';

/**
 * Non-blocking co-op notice shown when a bot ally has genuinely stopped driving
 * its seat (WP-415 / EC-450 / D-24231). Fed by {@link ../composables/useBotAllyStatus},
 * which polls WP-414's status surface. It offers a client-only "Return to lobby"
 * escape so the human is never stranded on a frozen board.
 *
 * why: read-only status surface — it never mutates match state, never gates a
 * move, and calls NO server endpoint (the escape is a pure client navigation).
 * The bot is an ally, so every string is co-op framing (§23(b)), never PvP.
 */

/**
 * The fixed co-op fallback sentence, shown when the server surfaced no explicit
 * `message` (a terminal-abnormal status with a null message).
 *
 * // why: the banner renders the server's public-safe `message` verbatim when
 * present and NEVER fabricates a fault reason; this fallback is the only
 * client-authored copy, and it uses co-op framing (the bot is a teammate,
 * §23(b) — never adversarial wording).
 */
export const BOT_ALLY_STALL_FALLBACK_MESSAGE =
  "The bot ally has stopped, so the match can't continue. " +
  'You can return to the lobby and start a new match with a bot ally.';

export default defineComponent({
  name: 'BotAllyStallBanner',
  props: {
    /** True only when the bot ally stopped abnormally (from `useBotAllyStatus`). */
    hasStopped: {
      type: Boolean,
      required: true,
    },
    /** The server's public-safe co-op message, or null (then the fallback shows). */
    message: {
      type: String as PropType<string | null>,
      default: null,
    },
    /**
     * The client-only "Return to lobby" navigation. Prop-drilled (like
     * `ConnectionStatusBanner`'s `resync`) so the banner stays pure and the
     * navigation site is owned by the play-root host.
     */
    returnToLobby: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    // why: the message is the server's verbatim public-safe sentence when
    // present; only when it is null does the client supply the fixed co-op
    // fallback — the client never fabricates a fault reason.
    const displayMessage = computed<string>(
      () => props.message ?? BOT_ALLY_STALL_FALLBACK_MESSAGE,
    );

    /** Invokes the injected Return-to-lobby navigation. */
    function onReturnToLobbyClick(): void {
      props.returnToLobby();
    }

    return { displayMessage, onReturnToLobbyClick };
  },
});
</script>

<template>
  <!--
    // why: renders ONLY when the bot ally stopped abnormally (`hasStopped`). A
    // healthy `active` match and a normally-`completed` match (a real win/loss)
    // show nothing — the end-of-match UI owns the completed case.
  -->
  <div
    v-if="hasStopped"
    class="bot-ally-stall-banner"
    role="status"
    aria-live="polite"
    data-testid="bot-ally-stall-banner"
  >
    <span class="bot-ally-stall-banner__message">{{ displayMessage }}</span>
    <button
      type="button"
      class="bot-ally-stall-banner__action"
      data-testid="bot-ally-stall-return-button"
      @click="onReturnToLobbyClick"
    >
      Return to lobby
    </button>
  </div>
</template>

<style scoped>
.bot-ally-stall-banner {
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
  background: #5a3410;
  color: #fff;
  font-size: 0.9rem;
  text-align: center;
}

.bot-ally-stall-banner__action {
  padding: 0.25rem 0.75rem;
  border: 1px solid #fff;
  border-radius: 0.25rem;
  background: transparent;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
}

.bot-ally-stall-banner__action:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
