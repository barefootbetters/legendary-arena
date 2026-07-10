<script lang="ts">
import { defineComponent } from 'vue';

import { useAuthNav } from '../../composables/useAuthNav';

// why: defineComponent (NOT <script setup>) matches the established
// arena-client convention under the @legendary-arena/vue-sfc-loader
// separate-compile pipeline (D-6512 / P6-30).
export default defineComponent({
  name: 'BrandHeader',
  setup() {
    const { isSignedIn, isBootstrapping, displayLabel, signOut } =
      useAuthNav();

    return {
      isSignedIn,
      isBootstrapping,
      displayLabel,
      signOut,
    };
  },
});
</script>

<template>
  <header class="brand-header" data-testid="brand-header">
    <a class="brand-wordmark" href="https://www.legendary-arena.com">
      Legendary Arena
    </a>
    <nav class="brand-nav" aria-label="Site navigation">
      <a class="brand-nav-link" href="https://www.legendary-arena.com">Home</a>
      <a class="brand-nav-link" href="https://cards.barefootbetters.com">
        Cards
      </a>

      <template v-if="isBootstrapping">
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
