<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue';
import type { UIProgressCounters } from '@legendary-arena/game-engine';
import { useEffectIntensity } from '../../vfx/effectIntensity';
import {
  hasMenaceSignal,
  menaceAriaText,
  menaceBarPercent,
  menaceRatioLabel,
  menaceTierClass,
} from '../../vfx/menaceDisplay';

/**
 * DangerMeter — how close the villains are to winning (WP-558 / D-24367).
 *
 * Renders WP-557's projected `menace` scalar as a filling bar with a tier
 * treatment, so the pressure the engine already tracks is legible at a glance
 * instead of inferred from a twist count. Hosted inside `<TopHudBar>`, which
 * both `<PlayDesktop>` and `<PlayMobile>` render, so one host covers both
 * surfaces.
 *
 * Pure presentation: it reads only `UIState.progress`, never `G`/`ctx`, and is
 * absent from the determinism hash. It re-derives NOTHING — the tier comes
 * from `menaceTier` and the denominator from `schemeLossThreshold`, both
 * resolved engine-side by the D-24366 order.
 *
 * Per the EC-132 §2 SFC authoring whitelist (D-6512): this component MUST use
 * `defineComponent({ setup() { return {...} } })` rather than `<script setup>`
 * — the vue-sfc-loader's `inlineTemplate: false` pipeline does not expose
 * script-setup top-level bindings on the template's `_ctx`.
 *
 * @see WP-558 §Contract
 * @see DECISIONS.md D-24367 (information-not-decoration; no client re-derivation)
 * @see DECISIONS.md D-24366 (the projected signal and its tier bands)
 */
export default defineComponent({
  name: 'DangerMeter',
  props: {
    progress: {
      type: Object as PropType<UIProgressCounters>,
      required: true,
    },
  },
  setup(props) {
    // why: D-24367 §1 — the meter is INFORMATION, not decoration, so its
    // presence and its numbers are NEVER gated. Only its animation is. That is
    // also why `shouldRender` is deliberately NOT used here: its `VfxKind`
    // union ('shake' | 'particles' | 'word') describes decorative effects, and
    // routing a live loss-progress readout through it would hide game state
    // from any player who sets Effect-Intensity to `off` — most often someone
    // doing so for motion sensitivity. The confetti may go; the scoreboard
    // may not.
    const { intensity, prefersReducedMotion } = useEffectIntensity();

    const isPresent = computed(() => hasMenaceSignal(props.progress));

    const barPercent = computed(() =>
      menaceBarPercent(props.progress.menace ?? 0),
    );

    const tierClass = computed(() =>
      props.progress.menaceTier === undefined
        ? ''
        : menaceTierClass(props.progress.menaceTier),
    );

    const ratioLabel = computed(() =>
      menaceRatioLabel(
        props.progress.schemeLossProgress ?? 0,
        props.progress.schemeLossThreshold,
      ),
    );

    const ariaText = computed(() =>
      props.progress.menaceTier === undefined
        ? ''
        : menaceAriaText(
            props.progress.menaceTier,
            props.progress.schemeLossProgress ?? 0,
            props.progress.schemeLossThreshold,
          ),
    );

    // why: the critical-tier pulse is decoration on top of the reading, so it
    // IS gated — suppressed at reduced `off`/`low` intensity and under OS
    // reduced-motion. The bar still fills and still turns critical-red; only
    // the throb stops.
    const isPulsing = computed(
      () =>
        props.progress.menaceTier === 'critical' &&
        intensity.value === 'full' &&
        !prefersReducedMotion.value,
    );

    // why: the width/colour CSS transition is likewise decoration. Under
    // reduced-motion the bar jumps to its new value instead of sliding.
    const isAnimated = computed(() => !prefersReducedMotion.value);

    return {
      isPresent,
      barPercent,
      tierClass,
      ratioLabel,
      ariaText,
      isPulsing,
      isAnimated,
    };
  },
});
</script>

<template>
  <div
    v-if="isPresent"
    class="danger-meter"
    :class="[tierClass, { 'danger-meter--pulsing': isPulsing, 'danger-meter--animated': isAnimated }]"
    data-testid="play-hud-danger-meter"
    :data-tier="progress.menaceTier"
    role="meter"
    :aria-valuenow="Math.round(barPercent)"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="ariaText"
  >
    <span class="danger-meter__label">Scheme</span>
    <span class="danger-meter__track">
      <span class="danger-meter__fill" :style="{ width: barPercent + '%' }"></span>
    </span>
    <span class="danger-meter__ratio" data-testid="play-hud-danger-ratio">
      {{ ratioLabel }}
    </span>
  </div>
</template>

<style scoped>
.danger-meter {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-variant-numeric: tabular-nums;
}

.danger-meter__label {
  font-size: 0.8rem;
  opacity: 0.8;
}

.danger-meter__track {
  display: inline-block;
  width: 6rem;
  height: 0.5rem;
  border-radius: 0.25rem;
  background: var(--color-meter-track, rgba(128, 128, 128, 0.35));
  overflow: hidden;
}

.danger-meter__fill {
  display: block;
  height: 100%;
  background: var(--color-meter-fill, #6c8ebf);
}

/* why: only the --animated variant transitions. Under prefers-reduced-motion
   the modifier is absent and the bar jumps, per D-24367 §1. */
.danger-meter--animated .danger-meter__fill {
  transition: width 300ms ease-out, background-color 300ms ease-out;
}

.danger-meter--calm .danger-meter__fill {
  background: var(--color-meter-calm, #4f9d69);
}

.danger-meter--rising .danger-meter__fill {
  background: var(--color-meter-rising, #d19a2f);
}

.danger-meter--critical .danger-meter__fill {
  background: var(--color-meter-critical, #c0392b);
}

.danger-meter__ratio {
  font-size: 0.8rem;
}

/* why: the pulse is applied ONLY when the --pulsing modifier is present, which
   the component withholds at reduced intensity / reduced-motion. The meter
   itself keeps rendering either way. */
.danger-meter--pulsing .danger-meter__fill {
  animation: danger-meter-pulse 1.1s ease-in-out infinite;
}

@keyframes danger-meter-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
