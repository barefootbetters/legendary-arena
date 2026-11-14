<script lang="ts">
import { computed, defineComponent, ref, type PropType } from 'vue';

import { formatReadableTimestamp } from '../lib/buildStamp';

/**
 * Notice shown in a match that was created before the running game server
 * started. Hero ability hooks are built once at `Game.setup()` and stored with the
 * match, so such a match keeps the card rules of the build it started on; a player
 * who reloads to "get the update" is still playing the old rules (match
 * 7DOiwZpnmxY, 2026-10-29: created 13:51, server booted 13:57, the WP-853 rule
 * change never applied). The signal is the build-provenance store's
 * `isMatchOlderThanServer` — the same one the game-log header and the diagnostics
 * export already carry — so this adds no second check.
 *
 * why: read-only status surface. It never mutates match state and never gates a
 * move; "Start a new match" is a client-only navigation owned by the play-root
 * host and prop-drilled in (the `BotAllyStallBanner` `returnToLobby` pattern).
 */
export default defineComponent({
  name: 'OutdatedMatchNotice',
  props: {
    /** True when the match was created before the running server booted. */
    isMatchOlderThanServer: {
      type: Boolean,
      required: true,
    },
    /** When the match was created (ISO), or null when unknown. */
    matchCreatedAtIso: {
      type: String as PropType<string | null>,
      default: null,
    },
    /** When the running server booted (ISO), or null when unknown. */
    serverBootedAtIso: {
      type: String as PropType<string | null>,
      default: null,
    },
    /** Leaves the match for the lobby, where a new match can be started. */
    startNewMatch: {
      type: Function as PropType<() => void>,
      required: true,
    },
    /**
     * IANA zone for the times; undefined formats in the viewer's local zone.
     * A prop only so tests can pin the output.
     */
    timeZone: {
      type: String as PropType<string | undefined>,
      default: undefined,
    },
  },
  setup(props) {
    // why: dismissal is local presentation state; a player who chooses to finish
    // this match on its original rules should not be re-nagged for this tab.
    const isDismissed = ref<boolean>(false);

    const isVisible = computed<boolean>(
      () => props.isMatchOlderThanServer === true && isDismissed.value === false,
    );

    const timingDetail = computed<string>(() => {
      if (props.matchCreatedAtIso === null || props.serverBootedAtIso === null) {
        return '';
      }
      const matchCreated = formatReadableTimestamp(props.matchCreatedAtIso, props.timeZone);
      const serverBooted = formatReadableTimestamp(props.serverBootedAtIso, props.timeZone);
      if (matchCreated === '' || serverBooted === '') {
        return '';
      }
      return `Match started ${matchCreated}; game updated ${serverBooted}.`;
    });

    /** Leaves for the lobby via the injected action (the "Start a new match" button). */
    function onStartNewMatchClick(): void {
      props.startNewMatch();
    }

    /** Hides the notice for this tab without leaving the match. */
    function onDismissClick(): void {
      isDismissed.value = true;
    }

    return { isVisible, timingDetail, onStartNewMatchClick, onDismissClick };
  },
});
</script>

<template>
  <!--
    // why: a11y — role="status" + aria-live announces the notice without stealing
    // focus; the glyph pairs with text so the signal is never colour-only.
  -->
  <div
    v-if="isVisible"
    class="outdated-match-notice"
    role="status"
    aria-live="polite"
    data-testid="outdated-match-notice"
  >
    <span class="outdated-match-notice__glyph" aria-hidden="true">⚠</span>
    <span class="outdated-match-notice__text">
      <strong>This match started before the latest game update</strong> and still
      uses the card rules it began with. Start a new match to get the latest rules.
      <span
        v-if="timingDetail !== ''"
        class="outdated-match-notice__detail"
        data-testid="outdated-match-notice-detail"
      >
        {{ timingDetail }}
      </span>
    </span>
    <button
      type="button"
      class="outdated-match-notice__action"
      data-testid="outdated-match-new-match-button"
      @click="onStartNewMatchClick"
    >
      Start a new match
    </button>
    <button
      type="button"
      class="outdated-match-notice__dismiss"
      aria-label="Dismiss the older-rules notice"
      data-testid="outdated-match-dismiss-button"
      @click="onDismissClick"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
/* why: phones (< 768px) - in flow as the first row of the scrolling PlayMobile
   column, so it covers nothing. position:relative + z-index lift it above the
   playmat layer, which is itself positioned (z-index 0) and would otherwise paint
   over an in-flow static block. */
.outdated-match-notice {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem 0.6rem;
  margin: 0.4rem 0.5rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid #b7791f;
  border-radius: 0.4rem;
  background: #fff8e6;
  color: #3d2c00;
  font-size: 0.85rem;
  line-height: 1.3;
}

/* why: desktop - a fixed bar over the brand header (the UpdateAvailableBanner
   placement), not an in-flow row: the desktop board is scaled to the play area
   and reserves its scaled height (D-24502 / D-24505), so an in-flow row pushes the
   page into a scroll instead of shrinking the board. Over the header it covers
   only the nav links, never the board, and it is dismissible. z-index 49 keeps
   the update banner (50) on top; when that banner is up, this one drops below it. */
@media (min-width: 768px) {
  .outdated-match-notice {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 49;
    margin: 0;
    border-width: 0 0 1px;
    border-radius: 0;
  }

  .outdated-match-notice--below-update-banner {
    top: 2.6rem;
  }
}

.outdated-match-notice__glyph {
  font-size: 1rem;
  line-height: 1;
}

/* why: the text takes the row and pushes the buttons onto their own row on a
   phone, instead of squeezing the copy into a narrow column beside them. */
.outdated-match-notice__text {
  flex: 1 1 16rem;
  max-width: 60rem;
}

.outdated-match-notice__detail {
  display: block;
  margin-top: 0.1rem;
  font-size: 0.78rem;
  color: #5c4a1a;
}

.outdated-match-notice__action {
  flex: 0 0 auto;
  padding: 0.25rem 0.75rem;
  border: 1px solid #7a4f0b;
  border-radius: 0.25rem;
  background: #7a4f0b;
  color: #fff;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}

.outdated-match-notice__action:hover {
  background: #5e3c06;
}

.outdated-match-notice__dismiss {
  flex: 0 0 auto;
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: #3d2c00;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.outdated-match-notice__dismiss:hover {
  color: #7a4f0b;
}
</style>
