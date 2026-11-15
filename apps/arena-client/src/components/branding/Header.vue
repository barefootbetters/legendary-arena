<script lang="ts">
import { defineComponent } from 'vue';

import { useAuthNav } from '../../composables/useAuthNav';
import { useNetworkOnline } from '../../composables/useNetworkOnline';
import ThemeToggle from './ThemeToggle.vue';

// why: defineComponent (NOT <script setup>) matches the established
// arena-client convention under the @legendary-arena/vue-sfc-loader
// separate-compile pipeline (D-6512 / P6-30).
export default defineComponent({
  name: 'BrandHeader',
  components: { ThemeToggle },
  setup() {
    const { isSignedIn, isBootstrapping, displayLabel, signOut } =
      useAuthNav();
    // why: D-24851 follow-up — on the offline page (`/offline/`) with no
    // network, the wordmark, Play (`/`, outside the worker's scope), Home and
    // Cards all land on the browser's error page, and the account links reload
    // the page and drop the match. They are hidden while the browser reports
    // no network, and an "Offline" label says why.
    const isOnline = useNetworkOnline();

    return {
      isSignedIn,
      isBootstrapping,
      displayLabel,
      signOut,
      isOnline,
    };
  },
});
</script>

<template>
  <header class="brand-header" data-testid="brand-header">
    <a
      v-if="isOnline"
      class="brand-wordmark"
      href="https://www.legendary-arena.com"
      data-testid="brand-wordmark"
    >
      Legendary Arena
    </a>
    <span v-else class="brand-wordmark" data-testid="brand-wordmark">Legendary Arena</span>
    <nav class="brand-nav" aria-label="Site navigation">
      <!-- why: "/" is this app's own root. App.vue's selectRoute() has no
           explicit route param at the root, so it falls back to the lobby —
           the play entry point. This is the primary in-app destination (Home
           and Cards leave to other sites), so it leads the nav. -->
      <template v-if="isOnline">
        <a class="brand-nav-link" href="/" data-testid="brand-nav-play">Play</a>
        <a class="brand-nav-link" href="https://www.legendary-arena.com" data-testid="brand-nav-home">Home</a>
        <a class="brand-nav-link" href="https://cards.legendary-arena.com" data-testid="brand-nav-cards">
          Cards
        </a>
      </template>
      <span
        v-else
        class="brand-nav-offline"
        role="status"
        data-testid="brand-nav-offline"
      >Offline</span>

      <!-- why: day/night toggle — always present regardless of auth state, so it
           sits before the conditional sign-in / profile block. -->
      <ThemeToggle />

      <!-- why: with no network, sign-in cannot reach the server, and on
           `/offline/` the `?route=` links only reload the offline page, which
           drops the match in progress; the account block waits for the network. -->
      <template v-if="!isOnline"></template>
      <template v-else-if="isBootstrapping">
        <span
          class="auth-nav-bootstrapping"
          data-testid="auth-nav-bootstrapping"
        >...</span>
      </template>
      <template v-else-if="!isSignedIn">
        <a
          class="brand-nav-link"
          href="?route=login"
          data-testid="auth-nav-sign-in"
        >Sign in</a>
      </template>
      <template v-else>
        <!-- why: WP-346 — the username IS the link to the player's profile.
             A separate "My profile" link beside the name was redundant (both
             targeted ?route=me), so the two are merged: the name itself links
             to the profile, de-cluttering the header to Home · Cards · <name>
             · Sign out. `title` gives the name-link an accessible purpose. -->
        <a
          class="brand-nav-link auth-nav-display"
          href="?route=me"
          data-testid="auth-nav-display"
          title="Your profile"
        >{{ displayLabel }}</a>
        <button
          type="button"
          class="auth-nav-sign-out"
          data-testid="auth-nav-sign-out"
          @click="signOut"
        >Sign out</button>
      </template>
    </nav>
  </header>
</template>

<style scoped>
.brand-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--la-space-5);
  padding: var(--la-space-4) var(--la-space-5);
  background: var(--la-color-bg-primary);
  color: var(--la-color-text-primary);
  border-bottom: 1px solid var(--la-color-border-subtle);
}

.brand-wordmark {
  font-family: var(--la-font-display);
  font-size: var(--la-font-size-h4);
  letter-spacing: var(--la-letter-spacing-display);
  text-transform: uppercase;
  color: var(--la-color-text-primary);
  text-decoration: none;
}

.brand-wordmark:hover,
.brand-wordmark:focus-visible {
  color: var(--la-color-cta);
}

.brand-nav {
  display: flex;
  align-items: center;
  gap: var(--la-space-5);
  /* why: on a phone the wordmark + Play · Home · Cards · theme · Sign in row is
     wider than the screen, which made every page scroll sideways. Wrapping the
     links (and the header, below) keeps the header inside the viewport; on a
     wide screen nothing wraps, so desktop is unchanged. */
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}

@media (max-width: 480px) {
  .brand-header {
    flex-wrap: wrap;
  }

  .brand-nav {
    gap: var(--la-space-3);
  }
}

.brand-nav-link {
  font-family: var(--la-font-body);
  font-size: var(--la-font-size-body);
  color: var(--la-color-text-secondary);
  text-decoration: none;
}

.brand-nav-link:hover,
.brand-nav-link:focus-visible {
  color: var(--la-color-cta);
}

.brand-nav-offline {
  font-family: var(--la-font-body);
  font-size: var(--la-font-size-body);
  color: var(--la-color-text-secondary);
  font-weight: 600;
}

.auth-nav-bootstrapping {
  font-family: var(--la-font-body);
  font-size: var(--la-font-size-body);
  color: var(--la-color-text-secondary);
  opacity: 0.6;
}

.auth-nav-display {
  font-family: var(--la-font-body);
  font-size: var(--la-font-size-body);
  color: var(--la-color-text-primary);
  font-weight: 500;
}

.auth-nav-sign-out {
  font-family: var(--la-font-body);
  font-size: var(--la-font-size-body);
  color: var(--la-color-text-secondary);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.auth-nav-sign-out:hover,
.auth-nav-sign-out:focus-visible {
  color: var(--la-color-cta);
}
</style>
