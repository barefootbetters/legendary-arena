<script lang="ts">
import { defineComponent, computed, onMounted, toRef, type Ref } from 'vue';

import { useAuthStore } from '../../stores/auth';
import { fetchEntitlements } from '../../lib/api/billingApi';
import { fetchCoachReport } from '../../lib/api/coachApi';
import { useEndgameCoach } from '../../composables/useEndgameCoach';

// why: defineComponent form (not <script setup>) so the template's computed
// bindings reach `_ctx` under vue-sfc-loader's separate-compile pipeline
// (D-6512 / P6-30), matching EndgameSummary.vue.
export default defineComponent({
  name: 'EndgameCoachPanel',
  props: {
    // why: WP-595 — the scored match's replay hash, the key the coach endpoint
    // takes. Null when the record carries none (an older row) — the panel then
    // renders nothing.
    replayHash: {
      type: String as () => string | null,
      default: null,
    },
  },
  setup(props) {
    const authStore = useAuthStore();
    // why: wire the production deps (auth token + real API wrappers) into the
    // store-free composable; tests inject fakes directly.
    const controller = useEndgameCoach(toRef(props, 'replayHash') as Ref<string | null>, {
      getToken: () => authStore.token,
      fetchEntitlements,
      fetchCoachReport,
    });

    // why: resolve Pass status once on mount so the panel shows the coaching
    // affordance vs the locked-teaser upsell without a click.
    onMounted(() => {
      void controller.initialize();
    });

    const showLockedTeaser = computed(
      () => controller.passStatus.value === 'none' || controller.passStatus.value === 'guest',
    );
    const hasPass = computed(() => controller.passStatus.value === 'has');

    return {
      passStatus: controller.passStatus,
      coachStatus: controller.coachStatus,
      report: controller.report,
      requestCoaching: controller.requestCoaching,
      showLockedTeaser,
      hasPass,
    };
  },
});
</script>

<template>
  <section
    v-if="hasPass || showLockedTeaser"
    class="coach-panel"
    data-testid="arena-hud-coach-panel"
    aria-label="AI coach"
  >
    <div class="worked-heading">AI Coach</div>

    <!-- Pass holders: the on-demand coaching affordance + report. -->
    <template v-if="hasPass">
      <button
        v-if="coachStatus === 'idle'"
        type="button"
        class="coach-cta"
        data-testid="arena-hud-coach-button"
        @click="requestCoaching"
      >
        Get AI coaching for this match
      </button>

      <p v-else-if="coachStatus === 'loading'" class="coach-status" aria-live="polite">
        Analyzing your match…
      </p>

      <div
        v-else-if="coachStatus === 'ready' && report"
        class="coach-report"
        data-testid="arena-hud-coach-report"
      >
        <p class="coach-report-headline" aria-label="coachHeadline">{{ report.report.headline }}</p>
        <div class="coach-report-block">
          <div class="coach-report-label">Hero fit</div>
          <p class="coach-report-text">{{ report.report.heroFit }}</p>
        </div>
        <div class="coach-report-block">
          <div class="coach-report-label">Purchases</div>
          <p class="coach-report-text">{{ report.report.purchases }}</p>
        </div>
        <div class="coach-report-block">
          <div class="coach-report-label">Next time</div>
          <ul class="coach-report-tips">
            <li v-for="tip in report.report.suggestions" :key="tip">{{ tip }}</li>
          </ul>
        </div>
      </div>

      <div v-else-if="coachStatus === 'unavailable'" class="coach-status coach-status--retry">
        <span>Coaching is temporarily unavailable.</span>
        <button type="button" class="coach-retry" @click="requestCoaching">Try again</button>
      </div>

      <div v-else-if="coachStatus === 'error'" class="coach-status coach-status--retry">
        <span>Couldn't load coaching.</span>
        <button type="button" class="coach-retry" @click="requestCoaching">Try again</button>
      </div>
    </template>

    <!-- Non-Pass holders (and guests): the locked-teaser upsell. -->
    <div
      v-else
      class="coach-locked"
      data-testid="arena-hud-coach-locked"
    >
      <p class="coach-locked-copy">
        Unlock personal AI coaching — hero fit, smarter buys, and what to do differently — with the
        <strong>Legendary Pass</strong>.
      </p>
      <a class="coach-cta" href="?route=me" data-testid="arena-hud-coach-upsell">
        Get the Legendary Pass
      </a>
    </div>
  </section>
</template>

<style scoped>
.coach-panel {
  margin: 0.5rem 0 0;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-foreground) 18%, transparent);
}

.worked-heading {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
  margin-bottom: 0.35rem;
}

.coach-cta {
  display: inline-block;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  border: 1px solid #b8860b;
  background: color-mix(in srgb, #b8860b 16%, transparent);
  color: var(--color-foreground);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: none;
}

.coach-cta:hover {
  background: color-mix(in srgb, #b8860b 26%, transparent);
}

.coach-status {
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
  opacity: 0.9;
}

.coach-status--retry {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.coach-retry {
  padding: 0.2rem 0.55rem;
  border-radius: 5px;
  border: 1px solid currentColor;
  background: transparent;
  color: inherit;
  font-weight: 600;
  font-size: 0.82rem;
  cursor: pointer;
}

.coach-report {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.coach-report-headline {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #b8860b;
}

.coach-report-block {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.coach-report-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
}

.coach-report-text {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
}

.coach-report-tips {
  margin: 0.1rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.88rem;
  line-height: 1.5;
}

.coach-locked {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  align-items: flex-start;
}

.coach-locked-copy {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  opacity: 0.9;
}
</style>
