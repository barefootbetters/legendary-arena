<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue';

import {
  fetchSharedLoadout,
  type PublicLoadoutView,
} from '../lib/api/loadoutLibraryApi';
import { summarizeLoadout, type LoadoutSummary } from '../lib/loadoutSummary';

// why: defineComponent({ setup() { return {...} } }) is required (NOT
// <script setup>) because the template references non-prop bindings —
// the `state`, `view`, and `summary` values — that under the
// @legendary-arena/vue-sfc-loader separate-compile pipeline only reach
// `_ctx` when explicitly returned from setup() (D-6512 / P6-30;
// precedent matches App.vue, MyProfilePage, and PlayerProfilePage).

type LoadState = 'loading' | 'ready' | 'not_found' | 'error';

export default defineComponent({
  name: 'SharedLoadoutPage',
  props: {
    shareSlug: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const state = ref<LoadState>('loading');
    const view = ref<PublicLoadoutView | null>(null);

    // why: derive the composition summary from the opaque `lagn` document
    // at render time via the defensive summarizer — the client never
    // imports @legendary-arena/lagn (the server is the validation
    // authority) and a misshaped document must still render a summary
    // rather than white-screen the public page.
    const summary = computed<LoadoutSummary | null>(() =>
      view.value === null ? null : summarizeLoadout(view.value.lagn),
    );

    async function load(shareSlug: string): Promise<void> {
      state.value = 'loading';
      view.value = null;
      const result = await fetchSharedLoadout(shareSlug);
      if (result.ok === true) {
        view.value = result.value;
        state.value = 'ready';
        return;
      }
      if (result.status === 404) {
        state.value = 'not_found';
        return;
      }
      state.value = 'error';
    }

    onMounted(() => {
      void load(props.shareSlug);
    });

    watch(
      () => props.shareSlug,
      (next) => {
        void load(next);
      },
    );

    return {
      state,
      view,
      summary,
    };
  },
});
</script>

<template>
  <article class="shared-loadout" data-testid="shared-loadout-root">
    <template v-if="state === 'loading'">
      <p class="shared-loadout-status" data-testid="shared-loadout-loading">
        Loading…
      </p>
    </template>
    <template v-else-if="state === 'not_found'">
      <p class="shared-loadout-status" data-testid="shared-loadout-not-found">
        This loadout was not found, or it is private.
      </p>
    </template>
    <template v-else-if="state === 'error'">
      <p class="shared-loadout-status" data-testid="shared-loadout-error">
        Could not load this loadout. Please try again later.
      </p>
    </template>
    <template v-else-if="state === 'ready' && view !== null && summary !== null">
      <header class="shared-loadout-header" data-testid="shared-loadout-header">
        <h1 class="shared-loadout-name">{{ view.name }}</h1>
        <!-- why: only the loadout name + the owner's public display handle
             are shown — never an account identifier (accountId / ext_id).
             The guest endpoint returns a public-only allowlist projection
             (WP-301 PublicLoadoutView), so there is no account id to leak. -->
        <p class="shared-loadout-owner" data-testid="shared-loadout-owner">
          Shared by {{ view.displayHandle }}
        </p>
      </header>

      <section
        class="shared-loadout-summary"
        data-testid="shared-loadout-summary"
      >
        <h2>Composition</h2>
        <dl class="shared-loadout-facts">
          <div class="shared-loadout-fact">
            <dt>Mastermind</dt>
            <dd data-testid="shared-loadout-mastermind">{{ summary.mastermind }}</dd>
          </div>
          <div class="shared-loadout-fact">
            <dt>Scheme</dt>
            <dd data-testid="shared-loadout-scheme">{{ summary.scheme }}</dd>
          </div>
          <div class="shared-loadout-fact">
            <dt>Heroes</dt>
            <dd data-testid="shared-loadout-heroes">
              <template v-if="summary.heroes.length === 0">—</template>
              <template v-else>{{ summary.heroes.join(', ') }}</template>
            </dd>
          </div>
          <div class="shared-loadout-fact">
            <dt>Villain groups</dt>
            <dd data-testid="shared-loadout-villains">
              <template v-if="summary.villainGroups.length === 0">—</template>
              <template v-else>{{ summary.villainGroups.join(', ') }}</template>
            </dd>
          </div>
          <div class="shared-loadout-fact">
            <dt>Henchman groups</dt>
            <dd data-testid="shared-loadout-henchmen">
              <template v-if="summary.henchmanGroups.length === 0">—</template>
              <template v-else>{{ summary.henchmanGroups.join(', ') }}</template>
            </dd>
          </div>
          <div v-if="summary.playerCount !== null" class="shared-loadout-fact">
            <dt>Players</dt>
            <dd data-testid="shared-loadout-players">{{ summary.playerCount }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </article>
</template>

<style scoped>
.shared-loadout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 42rem;
  margin: 0 auto;
}

.shared-loadout-status {
  font-size: 1rem;
  text-align: center;
  opacity: 0.75;
}

.shared-loadout-name {
  font-size: 1.5rem;
  margin: 0 0 0.25rem 0;
}

.shared-loadout-owner {
  font-size: 0.9rem;
  opacity: 0.75;
  margin: 0;
}

.shared-loadout-summary {
  padding: 1.25rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.5);
}

.shared-loadout-summary h2 {
  font-size: 1.125rem;
  margin: 0 0 0.75rem 0;
}

.shared-loadout-facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.shared-loadout-fact {
  display: grid;
  grid-template-columns: 10rem 1fr;
  gap: 0.75rem;
  align-items: baseline;
}

.shared-loadout-fact dt {
  font-weight: 500;
  font-size: 0.875rem;
}

.shared-loadout-fact dd {
  margin: 0;
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.7);
}

@media (max-width: 40rem) {
  .shared-loadout-fact {
    grid-template-columns: 1fr;
    gap: 0.15rem;
  }
}
</style>
