<script lang="ts">
import { computed, defineComponent, inject, ref, type Ref } from 'vue';

import { useAuthStore } from '../stores/auth';
import { launchMatchFromComposition } from './useCreateMatchFromComposition';
import { buildGuestPlayUrl, createGuestSoloMatch } from './lobbyApi';
import {
  FEATURED_PLAYER_COUNT,
  FEATURED_TABLE,
  FEATURED_TABLE_LABELS,
} from './featuredTable';

// why: the auth store carries no handle, so the featured table seats the
// player under the same fixed name Play Again uses.
const FEATURED_PLAYER_NAME = 'Player';

/**
 * Maps a failed guest start to player copy. Every branch offers sign-in.
 *
 * @param status The HTTP status attached to the thrown error, or undefined.
 * @returns The sentence shown in the entrance's error line.
 */
function guestErrorMessage(status: number | undefined): string {
  // why: player copy instead of the server's generic sentence (the join-as-guest
  // precedent); the thrown message also carries the endpoint URL.
  if (status === 429) {
    return 'Too many guest games were started from this connection. Sign in to play now, or try again in a minute.';
  } else if (status === 503) {
    return 'Guest play is full right now. Sign in to play now, or try again in a few minutes.';
  } else {
    return 'The guest game could not be started. Sign in to play, or try again.';
  }
}

/**
 * The Arena entrance (WP-785 / D-24633): the bare landing URL's first screen.
 * It shows the featured encounter and one Enter Arena button. Signed in, it
 * creates and joins the featured solo table through the existing launcher;
 * signed out, it starts a guest solo match on the same table (WP-788 / D-24636).
 * While the session is still hydrating it takes neither path (D-24640). It
 * makes no request on mount; today's lobby stays reachable as the Workshop.
 */
export default defineComponent({
  name: 'ArenaEntrance',
  setup() {
    const authStore = useAuthStore();
    const isEntering = ref(false);
    const errorMessage = ref('');
    // why: D-24640 — App.vue hydrates the session in the background here, so
    // `token === null` means "signed out" only once hydration settles; a click
    // before then would start a guest match for a signed-in player. The false
    // default keeps a mount without App (tests, isolated renders) on the
    // WP-788 behavior instead of locking the button forever.
    const isSessionHydrating = inject<Ref<boolean>>('isSessionHydrating', ref(false));

    const isSignedOut = computed<boolean>(
      () => !isSessionHydrating.value && authStore.token === null,
    );
    const enterLabel = computed<string>(() => {
      if (isEntering.value) {
        return 'Entering…';
      }
      return 'Enter Arena';
    });

    /**
     * Starts a guest solo match for a signed-out visitor and navigates to it.
     * The latch stays set on success because the page is navigating away.
     */
    async function enterAsGuest(): Promise<void> {
      if (isEntering.value) {
        return;
      }
      isEntering.value = true;
      errorMessage.value = '';
      try {
        const { matchId, seat, credentials } = await createGuestSoloMatch();
        // why: buildGuestPlayUrl returns a FULL absolute URL, so navigate via
        // location.href (not .search, which expects a relative query).
        window.location.href = buildGuestPlayUrl(matchId, seat, credentials);
      } catch (guestError) {
        isEntering.value = false;
        const status = (guestError as { status?: unknown }).status;
        errorMessage.value = guestErrorMessage(typeof status === 'number' ? status : undefined);
      }
    }

    /**
     * Creates and joins the featured table, or starts a guest match for a
     * signed-out visitor. Does nothing while the session is hydrating. The
     * latch blocks a second click; it stays set on success because the page
     * is already navigating to the play route.
     */
    async function enterArena(): Promise<void> {
      if (isEntering.value || isSessionHydrating.value) {
        return;
      }
      const authToken = authStore.token;
      if (authToken === null) {
        await enterAsGuest();
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
      isSessionHydrating,
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
          :disabled="isEntering || isSessionHydrating"
          @click="enterArena"
        >
          {{ enterLabel }}
        </button>
        <p
          v-if="isSessionHydrating"
          class="arena-entrance__helper"
          data-testid="arena-checking-sign-in"
          role="status"
        >
          Checking your sign-in…
        </p>
        <p v-if="isSignedOut" class="arena-entrance__helper">
          You’ll play as a guest.
          <a href="?route=login" data-testid="arena-sign-in-link">Sign in</a>
          to save your results.
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

.arena-entrance__helper a {
  font-weight: 600;
  color: var(--arena-stage-accent);
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
