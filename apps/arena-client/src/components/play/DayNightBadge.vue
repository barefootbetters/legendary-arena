<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue';
import {
  dayNightAriaText,
  dayNightLabel,
  dayNightTooltip,
  type DayNightState,
} from '../../vfx/dayNightDisplay';

/**
 * DayNightBadge — which of Sunlight / Moonlight is in effect (WP-766 / D-24598).
 *
 * Hosted inside `<TopHudBar>` beside the DangerMeter, which both `<PlayDesktop>`
 * and `<PlayMobile>` render. Shows an icon (none for Neither) and the state's
 * word, so the state is never conveyed by colour alone.
 *
 * // why: the badge RENDERS the engine-projected `UIHQState.dayNight`; it never
 * counts HQ costs itself. The engine owns the day/night truth (D-24598), and a
 * client re-derivation could disagree with the value the conditions evaluate.
 *
 * Per the EC-132 §2 SFC authoring whitelist (D-6512): this component has computed
 * state and a sibling test, so it MUST use `defineComponent({ setup() { return
 * {...} } })` rather than `<script setup>`.
 *
 * @see WP-766 §Locked Values
 * @see DECISIONS.md D-24598
 */
export default defineComponent({
  name: 'DayNightBadge',
  props: {
    state: {
      type: String as PropType<DayNightState>,
      required: true,
    },
  },
  setup(props) {
    const label = computed(() => dayNightLabel(props.state));
    const tooltip = computed(() => dayNightTooltip(props.state));
    const ariaText = computed(() => dayNightAriaText(props.state));
    return { label, tooltip, ariaText };
  },
});
</script>

<template>
  <!-- why: role="status" makes the badge a polite live region, so a screen reader
       announces a day/night flip when the HQ changes mid-turn — that is intended,
       it is the moment a player's Sunlight/Moonlight lines change. -->
  <span
    class="day-night-badge"
    :class="`day-night-badge--${state}`"
    data-testid="play-day-night-badge"
    :data-state="state"
    role="status"
    :aria-label="ariaText"
    :title="tooltip"
  >
    <!-- why: inline SVG, not a Unicode glyph — the play-surface font lacks dingbat
         codepoints and a missing glyph renders as nothing (the CrossedSwordsIcon
         precedent). Geometry is the Lucide "sun" / "moon" glyphs (MIT). -->
    <svg
      v-if="state === 'sunlight'"
      class="day-night-badge__icon"
      data-testid="play-day-night-icon-sun"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
    <svg
      v-else-if="state === 'moonlight'"
      class="day-night-badge__icon"
      data-testid="play-day-night-icon-moon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
    <span class="day-night-badge__label" data-testid="play-day-night-label">{{ label }}</span>
  </span>
</template>

<style scoped>
/* why: compact and non-wrapping so TopHudBar row 2 keeps one line at the 1280
   authoring width (a wrapped row makes the HUD taller and shrinks the board). */
.day-night-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
  font-weight: 600;
}

.day-night-badge__icon {
  width: 1.1em;
  height: 1.1em;
  flex: 0 0 auto;
}

.day-night-badge--sunlight .day-night-badge__icon {
  color: var(--color-day-night-sun, #d19a2f);
}

.day-night-badge--moonlight .day-night-badge__icon {
  color: var(--color-day-night-moon, #6c8ebf);
}

.day-night-badge--neither {
  opacity: 0.75;
  font-weight: 400;
}
</style>
