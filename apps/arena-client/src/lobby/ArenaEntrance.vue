<script lang="ts">
import { computed, defineComponent, ref } from 'vue';

import { useAuthStore } from '../stores/auth';
import { launchMatchFromComposition } from './useCreateMatchFromComposition';
import {
  FEATURED_PLAYER_COUNT,
  FEATURED_TABLE,
  FEATURED_TABLE_LABELS,
} from './featuredTable';

// why: the auth store carries no handle, so the featured table seats the
// player under the same fixed name Play Again uses.
const FEATURED_PLAYER_NAME = 'Player';

/**
 * The Arena entrance (WP-785 / D-24633): the bare landing URL's first screen.
 * It shows the featured encounter and one Enter Arena button that creates and
 * joins the featured solo table through the existing launcher. It makes no
 * request on mount; today's lobby stays reachable as the Arena Workshop.
 */
export default defineComponent({
  name: 'ArenaEntrance',
  setup() {
    const authStore = useAuthStore();
    const isEntering = ref(false);
    const errorMessage = ref('');

    const isSignedOut = computed<boolean>(() => authStore.token === null);
    const enterLabel = computed<string>(() => {
      if (isEntering.value) {
        return 'Entering…';
      }
      return 'Enter Arena';
    });

    /**
     * Creates and joins the featured table, or sends a signed-out visitor to
     * sign in. The latch blocks a second click; it stays set on success because
     * the launcher is already navigating to the play route.
     */
    async function enterArena(): Promise<void> {
      if (isEntering.value) {
        return;
      }
      const authToken = authStore.token;
      if (authToken === null) {
        window.location.search = '?route=login';
        return;
      }
      isEntering.value = true;
      errorMessage.value = '';
      const result = await launchMatchFromComposition({
        config: FEATURED_TABLE,
        playerCount: FEATURED_PLAYER_COUNT,
        playerName: FEATURED_PLAYER_NAME,
        authToken,
      });
      if (!result.ok) {
        isEntering.value = false;
        errorMessage.value = result.message;
      }
    }

    return {
      labels: FEATURED_TABLE_LABELS,
      isEntering,
      isSignedOut,
      enterLabel,
      errorMessage,
      enterArena,
    };
  },
});
</script>

<template>
  <section class="arena-entrance" data-testid="arena-entrance">
    <div class="arena-entrance__copy">
      <p class="arena-entrance__eyebrow">Featured table</p>
      <h1 class="arena-entrance__title">
        The Arena <span class="arena-entrance__title-accent">Awaits</span>
      </h1>
      <p class="arena-entrance__encounter">
        Magneto and the Brotherhood are robbing Midtown Bank.
      </p>
      <p class="arena-entrance__roster">
        Spider-Man, Hulk, and Wolverine answer the call.
      </p>
      <div class="arena-entrance__actions">
        <button
          type="button"
          class="arena-entrance__enter"
          data-testid="arena-enter"
          :disabled="isEntering"
          @click="enterArena"
        >
          {{ enterLabel }}
        </button>
        <p v-if="isSignedOut" class="arena-entrance__helper">
          Sign in to take your seat. Your account is free.
        </p>
        <p
          v-if="errorMessage !== ''"
          class="arena-entrance__error"
          data-testid="arena-enter-error"
          role="alert"
        >
          {{ errorMessage }}
        </p>
      </div>
      <div class="arena-entrance__workshop">
        <a href="?route=workshop" data-testid="arena-workshop-link">Arena Workshop</a>
        <p>Loadouts, bot allies, watching bots, and joining by match ID.</p>
      </div>
    </div>
    <div class="arena-entrance__art-wrap">
      <img
        class="arena-entrance__art"
        data-testid="arena-featured-art"
        :src="labels.artUrl"
        :alt="labels.mastermind"
      >
    </div>
  </section>
</template>

<style scoped>
/* why: the entrance is an art stage and stays dark in both themes, so it uses
   the brand's dark values directly instead of the theme-following
   --la-color-bg-primary / --la-color-text-primary / --la-color-gold tokens. */
.arena-entrance {
  --arena-stage-bg: #0b0f19;
  --arena-stage-text: #f5f7fb;
  --arena-stage-accent: #d4af37;

  position: relative;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: center;
  gap: 4vw;
  /* why: fill the space between the brand header and footer so no theme-colored
     band shows under the dark stage (the header + footer are ~140px together). */
  min-height: calc(100vh - 140px);
  padding: 48px 7vw;
  overflow: hidden;
  color: var(--arena-stage-text);
  background:
    radial-gradient(900px 600px at 78% 45%, rgba(55, 83, 184, 0.3), transparent 60%),
    radial-gradient(700px 500px at 20% 90%, rgba(168, 48, 52, 0.22), transparent 60%),
    var(--arena-stage-bg);
}

.arena-entrance__eyebrow {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--arena-stage-accent);
}

.arena-entrance__title {
  margin: 0;
  font-family: var(--la-font-display, 'Bebas Neue', Impact, sans-serif);
  font-weight: 400;
  font-size: clamp(56px, 8vw, 124px);
  line-height: 0.92;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.arena-entrance__title-accent {
  color: var(--arena-stage-accent);
}

.arena-entrance__encounter {
  max-width: 30ch;
  margin: 22px 0 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.35;
}

.arena-entrance__roster {
  margin: 10px 0 0;
  font-size: 17px;
  opacity: 0.85;
}

.arena-entrance__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-top: 32px;
}

.arena-entrance__enter {
  padding: 16px 54px 13px;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-family: var(--la-font-display, 'Bebas Neue', Impact, sans-serif);
  font-size: 30px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #ffffff;
  background: var(--la-color-cta);
  box-shadow: 0 10px 30px rgba(168, 48, 52, 0.45);
}

.arena-entrance__enter:hover:not(:disabled) {
  background: var(--la-color-cta-bright, var(--la-color-cta));
}

.arena-entrance__enter:disabled {
  cursor: wait;
  opacity: 0.7;
}

.arena-entrance__helper {
  margin: 0;
  font-size: 14px;
  opacity: 0.75;
}

.arena-entrance__error {
  max-width: 44ch;
  margin: 0;
  font-size: 14px;
  color: #ffb4b4;
}

.arena-entrance__workshop {
  max-width: 440px;
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.arena-entrance__workshop a {
  font-weight: 600;
  font-size: 15px;
  text-decoration: none;
  color: var(--arena-stage-accent);
}

.arena-entrance__workshop p {
  margin: 4px 0 0;
  font-size: 13px;
  opacity: 0.7;
}

.arena-entrance__art-wrap {
  justify-self: center;
}

.arena-entrance__art {
  display: block;
  width: min(30vw, 420px);
  border-radius: 14px;
  transform: rotate(2deg);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.7);
}

@media (max-width: 767px) {
  .arena-entrance {
    grid-template-columns: 1fr;
    gap: 18px;
    padding: 22px 16px 28px;
  }

  .arena-entrance__art-wrap {
    order: -1;
  }

  .arena-entrance__art {
    width: 64vw;
  }

  .arena-entrance__actions {
    align-items: stretch;
  }
}
</style>
