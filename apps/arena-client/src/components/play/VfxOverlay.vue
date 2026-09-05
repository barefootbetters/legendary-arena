<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { comboVfxManifest } from '../../vfx/comboVfxManifest';
import { STRIKE_BLOCKED_VFX, BLOCKED_WORD } from '../../vfx/strikeBlockedVfxManifest';
import { useEffectIntensity } from '../../vfx/effectIntensity';
import { useComboVfxSignal, type ComboVfxEvent } from '../../composables/useComboVfx';
import {
  useStrikeBlockedVfxSignal,
  type StrikeBlockedVfxEvent,
} from '../../composables/useStrikeBlockedVfx';
import { useWoundVfxSignal } from '../../composables/useWoundVfx';

/**
 * VfxOverlay — the single full-bleed VFX layer (WP-556). It hosts ONE shared
 * particle canvas and the synergy call-out word, and renders the combo flash on
 * each `useComboVfx` signal change (the visual twin of the shipped audio combo
 * sting). Mounted once at the shared PlayViewport root, beside AudioControls,
 * so it covers both the desktop and mobile play surfaces.
 *
 * Pure presentation: it reads only the projected combo signal, never `G`/`ctx`,
 * and is absent from the determinism hash. Every effect is gated by the
 * `effectIntensity` accessibility contract — with intensity `off`, or under OS
 * `prefers-reduced-motion`, the heavy effects (particles / impact) are
 * suppressed while the call-out WORD still shows (as a plain fade), keeping the
 * reward legible.
 *
 * Per the EC-132 §2 SFC authoring whitelist (D-6512): this component MUST use
 * `defineComponent({ setup() { return {...} } })` rather than `<script setup>`
 * — the vue-sfc-loader's `inlineTemplate: false` pipeline does not expose
 * script-setup top-level bindings on the template's `_ctx`.
 *
 * WP-647 adds a SECOND signal consumer to the same overlay: the shield-block
 * beat (a `strikeBlocked` notable-event → a Cap-shield glyph + a threat-coloured
 * deflection burst + the "BLOCKED!" word), recoloured per `threatKind`, gated by
 * the same accessibility contract. The shield glyph shows whenever the word does
 * (static under low / reduced-motion; spinning only at full intensity).
 *
 * WP-650 adds a THIRD consumer — the "wound gained" damage vignette (the inverse
 * of the shield block: you TOOK the hit). A `useWoundVfx` signal (the local seat's
 * `woundCount` increasing) flashes a full-bleed dull-red edge vignette, gated on
 * `shouldRender('shake')` like the impact pulse (full intensity only, off under
 * reduced-motion / low / off). Its audio thud rides `useWoundCue`.
 *
 * @see WP-556 §D "VFX overlay" / WP-647 §C "the render" / WP-650 §C "the vignette"
 * @see apps/arena-client/src/components/play/NotableEventOverlay.vue (the overlay precedent)
 * @see DECISIONS.md D-24365 (the VFX determinism exemption) + D-24459 (the shield-block burst)
 */

// why: how long the call-out word stays on screen before it fades out.
const WORD_DISPLAY_MS = 1300;
// why: the impact pulse duration — within the 500ms screen-shake performance
// budget (WP-556); it is a transform/opacity-only animation, never a layout property.
const IMPACT_MS = 450;
// why: how long the shield-block glyph holds before it fades — a touch shorter
// than the word (WORD_DISPLAY_MS) so the shield clears first and the "BLOCKED!"
// word lands the beat. The scale+spin entrance is within the ~600ms budget.
const SHIELD_DISPLAY_MS = 1100;
// why: WP-647 — the shield-block deflection burst's particle count; a solid
// throw-back well under the WP-556 200-particle ceiling.
const SHIELD_BURST_PARTICLES = 120;
// why: WP-650 — the "wound gained" damage-vignette duration. A brief full-bleed
// red edge-flash (opacity/transform only), matched to the impact pulse and well
// within the 500ms screen-shake performance budget.
const WOUND_VIGNETTE_MS = 460;

/**
 * Builds the `canvas-confetti` options for one burst. Exported and pure so the
 * combo-unchanged / shield-colours assertions can check the `colors` key
 * directly — `confettiFire` is closure-local and, under jsdom, `getContext`
 * returns null so `fireBurst` short-circuits before any options object exists;
 * a confetti spy is therefore impossible without an out-of-allowlist test-harness
 * edit (WP-647 / copilot Finding 1).
 *
 * @param particleCount - how many particles the burst throws.
 * @param colors - the burst palette. When **undefined the `colors` key is
 *   OMITTED**, so canvas-confetti keeps its default (multicolor) palette — this
 *   is the combo path (it is NOT gold; gold is only the word + impact flash).
 *   The shield path passes the threat colours.
 * @returns the confetti options object.
 */
export function buildBurstOptions(
  particleCount: number,
  colors?: readonly string[],
): Record<string, unknown> {
  const options: Record<string, unknown> = {
    particleCount,
    spread: 78,
    startVelocity: 42,
    gravity: 0.9,
    ticks: 120,
    origin: { x: 0.5, y: 0.62 },
    disableForReducedMotion: true,
  };
  // why: omit the key entirely (not `colors: undefined`) when no palette is
  // given, so the combo burst keeps canvas-confetti's default multicolor palette
  // exactly as before WP-647 — never a gold or any fixed default.
  if (colors !== undefined) {
    options.colors = [...colors];
  }
  return options;
}

export default defineComponent({
  name: 'VfxOverlay',
  setup() {
    const { shouldRender } = useEffectIntensity();
    const signal = useComboVfxSignal();
    const strikeBlockedSignal = useStrikeBlockedVfxSignal();
    const woundSignal = useWoundVfxSignal();

    const canvasEl = ref<HTMLCanvasElement | null>(null);
    const currentWord = ref<string | null>(null);
    // why: a monotonic key so Vue re-mounts the word span on an equal-string
    // repeat, re-triggering its entrance transition (a second Team-Up! still animates).
    const wordKey = ref(0);
    const isImpacting = ref(false);

    // why: WP-647 shield-block glyph state. isShielding shows the shield;
    // shieldSpins toggles the motion (spin) on top of the always-present static
    // entrance; shieldKey re-mounts the glyph on a repeat block so the entrance
    // re-runs (the wordKey pattern).
    const isShielding = ref(false);
    const shieldSpins = ref(false);
    const shieldKey = ref(0);

    // why: WP-650 — the "wound gained" damage-vignette state. isWounded shows the
    // red edge-flash; woundKey re-mounts it so a repeat wound re-runs the flash.
    const isWounded = ref(false);
    const woundKey = ref(0);

    let wordTimer: ReturnType<typeof setTimeout> | null = null;
    let impactTimer: ReturnType<typeof setTimeout> | null = null;
    let shieldTimer: ReturnType<typeof setTimeout> | null = null;
    let woundTimer: ReturnType<typeof setTimeout> | null = null;

    // why: lazy-loaded canvas-confetti launcher, bound to OUR single canvas.
    // Loaded off the first-paint path (dynamic import on first burst), so the
    // library never weighs down initial load. D-24365: the VFX presentation
    // layer is exempt from the client-app Math.random()/timing ban because it
    // is non-replay-bearing presentation off the gameplay render path — so it
    // may depend on canvas-confetti (which uses Math.random + requestAnimationFrame).
    let confettiFire: ((options: Record<string, unknown>) => void) | null = null;
    let confettiLoading = false;

    async function ensureConfetti(): Promise<void> {
      const canvas = canvasEl.value;
      if (canvas === null || confettiLoading || confettiFire !== null) return;
      // why: fail-soft — with no 2D context (jsdom / headless throws a
      // not-implemented error; a locked-down browser may return null), the
      // particle burst is silently skipped and the word/impact still render.
      // The getContext probe is wrapped because jsdom THROWS rather than
      // returning null; the VFX layer must never throw into the gameplay surface.
      let hasContext = false;
      try {
        hasContext =
          typeof canvas.getContext === 'function' && canvas.getContext('2d') !== null;
      } catch {
        hasContext = false;
      }
      if (!hasContext) return;
      confettiLoading = true;
      try {
        const module = await import('canvas-confetti');
        // why: bind a confetti instance to OUR single overlay canvas (the one
        // canvas of the performance budget), rather than letting the library
        // append its own global canvas.
        confettiFire = module.default.create(canvas, { resize: true, useWorker: false });
      } catch {
        // why: a failed dynamic import (offline chunk, CSP) degrades to no
        // particles — the word + impact still render. Pure presentation never
        // blocks or throws into gameplay.
      } finally {
        confettiLoading = false;
      }
    }

    // why: the optional `colors` threads through to buildBurstOptions, which
    // OMITS the colors key when undefined — the combo path (no colors) keeps
    // canvas-confetti's default multicolor palette; the shield path passes the
    // threat colours. NOT gold.
    function fireBurst(particleCount: number, colors?: readonly string[]): void {
      void ensureConfetti().then(() => {
        if (confettiFire === null) return;
        confettiFire(buildBurstOptions(particleCount, colors));
      });
    }

    function showWord(word: string): void {
      currentWord.value = word;
      wordKey.value += 1;
      if (wordTimer !== null) clearTimeout(wordTimer);
      wordTimer = setTimeout(() => {
        currentWord.value = null;
        wordTimer = null;
      }, WORD_DISPLAY_MS);
    }

    function pulseImpact(): void {
      isImpacting.value = true;
      if (impactTimer !== null) clearTimeout(impactTimer);
      impactTimer = setTimeout(() => {
        isImpacting.value = false;
        impactTimer = null;
      }, IMPACT_MS);
    }

    function renderEvent(event: ComboVfxEvent): void {
      const spec = comboVfxManifest[event.tier];
      // why: each effect class is independently gated by the accessibility
      // contract. Particles + impact are suppressed under reduced-motion / low
      // / off; the WORD survives (renders as a plain fade) unless intensity is off.
      if (shouldRender('particles')) {
        fireBurst(spec.particleCount);
      }
      if (spec.shake && shouldRender('shake')) {
        pulseImpact();
      }
      if (spec.word !== null && shouldRender('word')) {
        showWord(spec.word);
      }
    }

    watch(signal, (event) => {
      if (event === null) return;
      renderEvent(event);
    });

    // why: WP-647 — show the shield glyph. `spin` requests the motion entrance
    // (rotate-in); when false the glyph still shows but renders static (the
    // reduced-motion / low path — the identity survives without motion). The
    // monotonic key re-mounts the glyph so a repeat block re-runs the entrance.
    function showShield(spin: boolean): void {
      isShielding.value = true;
      shieldSpins.value = spin;
      shieldKey.value += 1;
      if (shieldTimer !== null) clearTimeout(shieldTimer);
      shieldTimer = setTimeout(() => {
        isShielding.value = false;
        shieldTimer = null;
      }, SHIELD_DISPLAY_MS);
    }

    function renderShieldBlock(event: StrikeBlockedVfxEvent): void {
      // why: the shield GLYPH shows whenever the word shows — i.e. unless
      // intensity is `off` (shouldRender('word')) — so the shield identity + the
      // "BLOCKED!" reward survive `low` / reduced-motion. Only the SPIN (motion)
      // is gated on shouldRender('shake') (full intensity, not reduced-motion),
      // and only the burst on shouldRender('particles') (WP-647 RS-1).
      if (shouldRender('word')) {
        showShield(shouldRender('shake'));
        showWord(BLOCKED_WORD);
      }
      if (shouldRender('particles')) {
        // why: threatKind drives ONLY the burst colours — the sole client use of
        // the field. The manifest Record is exhaustive over the three values.
        fireBurst(SHIELD_BURST_PARTICLES, STRIKE_BLOCKED_VFX[event.threatKind].colors);
      }
    }

    watch(strikeBlockedSignal, (event) => {
      if (event === null) return;
      renderShieldBlock(event);
    });

    // why: WP-650 — flash the full-bleed red damage vignette. The monotonic key
    // re-mounts the element so a repeat wound re-runs the CSS flash from the start.
    function pulseWound(): void {
      isWounded.value = true;
      woundKey.value += 1;
      if (woundTimer !== null) clearTimeout(woundTimer);
      woundTimer = setTimeout(() => {
        isWounded.value = false;
        woundTimer = null;
      }, WOUND_VIGNETTE_MS);
    }

    // why: WP-650 — the whole cue is a full-screen colour flash with motion, so it
    // is gated on shouldRender('shake') (full intensity only, suppressed under
    // reduced-motion / low / off) exactly like the impact pulse — a full-bleed red
    // flash is the class of effect a photosensitive / reduced-motion user opts out
    // of. The audio thud (useWoundCue) is separate and still plays at `low` (it is
    // silenced only by the master mute the `off` setting flips).
    watch(woundSignal, (event) => {
      if (event === null) return;
      if (shouldRender('shake')) pulseWound();
    });

    onUnmounted(() => {
      if (wordTimer !== null) clearTimeout(wordTimer);
      if (impactTimer !== null) clearTimeout(impactTimer);
      if (shieldTimer !== null) clearTimeout(shieldTimer);
      if (woundTimer !== null) clearTimeout(woundTimer);
    });

    onMounted(() => {
      // why: warm the confetti chunk shortly after mount (idle), off the
      // first-paint path, so the first real combo bursts without a load stall.
      // Guarded + fail-soft, so a headless/jsdom mount is a no-op.
      void ensureConfetti();
    });

    return {
      canvasEl,
      currentWord,
      wordKey,
      isImpacting,
      isShielding,
      shieldSpins,
      shieldKey,
      isWounded,
      woundKey,
    };
  },
});
</script>

<template>
  <div class="vfx-overlay" data-testid="play-vfx-overlay" aria-hidden="true">
    <canvas ref="canvasEl" class="vfx-overlay__canvas" data-testid="play-vfx-canvas"></canvas>
    <div
      v-if="isImpacting"
      class="vfx-overlay__impact"
      data-testid="play-vfx-impact"
    ></div>
    <div
      v-if="isWounded"
      :key="woundKey"
      class="vfx-overlay__wound"
      data-testid="play-vfx-wound"
    ></div>
    <Transition name="vfx-shield">
      <div
        v-if="isShielding"
        :key="shieldKey"
        class="vfx-overlay__shield"
        data-testid="play-vfx-shield"
      >
        <div
          class="vfx-overlay__shield-spin"
          :class="{ 'vfx-overlay__shield-spin--active': shieldSpins }"
        >
          <!-- why: the Cap-shield glyph copied from block-shield.svg's
               <g class="shield"> subtree (WP-647 / block-shield.svg, PR #1797),
               with the animated wrapper dropped — the overlay drives the
               entrance/spin. Centred viewBox so r=84 fits. -->
          <svg
            class="vfx-overlay__shield-svg"
            viewBox="-90 -90 180 180"
            width="180"
            height="180"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="vfxShieldSheen" cx="34%" cy="28%" r="72%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5" />
                <stop offset="45%" stop-color="#ffffff" stop-opacity="0.08" />
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
              </radialGradient>
            </defs>
            <circle r="84.0" fill="#c0182f" />
            <circle r="68.9" fill="#eeeae0" />
            <circle r="52.9" fill="#c0182f" />
            <circle r="37.0" fill="#123f8f" />
            <polygon
              points="0.0,-27.7 6.8,-9.4 26.4,-8.6 11.1,3.6 16.3,22.4 0.0,11.6 -16.3,22.4 -11.1,3.6 -26.4,-8.6 -6.8,-9.4"
              fill="#f4f4f4"
            />
            <circle r="84.0" fill="url(#vfxShieldSheen)" />
            <circle r="84.0" fill="none" stroke="#7a0f1e" stroke-width="2" />
          </svg>
        </div>
      </div>
    </Transition>
    <Transition name="vfx-word">
      <span
        v-if="currentWord !== null"
        :key="wordKey"
        class="vfx-overlay__word"
        data-testid="play-vfx-callout"
      >{{ currentWord }}</span>
    </Transition>
  </div>
</template>

<style scoped>
/* why: a single full-bleed, click-through layer over the mat (the AudioControls
   fixed-overlay precedent). pointer-events: none so it never intercepts play
   input; it renders nothing but the transient burst / impact / word. */
.vfx-overlay {
  position: fixed;
  inset: 0;
  z-index: 180;
  pointer-events: none;
  overflow: hidden;
}

/* why: the ONE shared particle canvas (the performance budget's single canvas),
   filling the layer. canvas-confetti draws here via the bound instance. */
.vfx-overlay__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* why: the peak "impact" pulse — a brief full-bleed radial flash for big /
   legendary tiers. Animates opacity + transform ONLY (GPU-composited), never a
   layout property, and lasts under the 500ms shake budget. */
.vfx-overlay__impact {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 60%,
    rgba(255, 224, 130, 0.42),
    rgba(255, 224, 130, 0) 62%
  );
  animation: vfx-impact 450ms ease-out;
  will-change: opacity, transform;
}

@keyframes vfx-impact {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  30% {
    opacity: 1;
    transform: scale(1.04);
  }
  100% {
    opacity: 0;
    transform: scale(1.08);
  }
}

/* why: WP-650 — the "wound gained" damage vignette: a dull-red flash pulling in
   from the screen EDGES (a transparent centre so the mat stays readable), the
   defensive-mirror opposite of the shield-block beat — you took the hit. Animates
   opacity/transform only (GPU-composited), never a layout property, and clears
   under WOUND_VIGNETTE_MS (within the 500ms budget). */
.vfx-overlay__wound {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 50% 52%,
    rgba(150, 12, 12, 0) 48%,
    rgba(150, 12, 12, 0.5) 100%
  );
  animation: vfx-wound 460ms ease-out;
  will-change: opacity, transform;
}

@keyframes vfx-wound {
  0% {
    opacity: 0;
    transform: scale(1.06);
  }
  22% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1);
  }
}

/* why: the synergy call-out word, centred over the mat. Bold and legible; the
   entrance scale-punch is transform/opacity only. */
.vfx-overlay__word {
  position: absolute;
  top: 34%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: clamp(2rem, 7vw, 4.5rem);
  font-weight: 900;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #ffe082;
  text-shadow: 0 2px 18px rgba(0, 0, 0, 0.55), 0 0 6px rgba(255, 224, 130, 0.6);
  white-space: nowrap;
}

.vfx-word-enter-active {
  transition: opacity 160ms ease-out, transform 220ms cubic-bezier(0.2, 1.4, 0.4, 1);
}

.vfx-word-leave-active {
  transition: opacity 320ms ease-in, transform 320ms ease-in;
}

.vfx-word-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
}

.vfx-word-leave-to {
  opacity: 0;
  transform: translate(-50%, -58%) scale(1.05);
}

/* why: WP-647 — the Captain-America shield-block glyph, centred over the mat
   just above the "BLOCKED!" word. The outer element positions + hosts the
   entrance scale-punch (transform/opacity only); the inner element hosts the
   optional spin, so the two transforms never conflict. */
.vfx-overlay__shield {
  position: absolute;
  top: 44%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 180px;
  height: 180px;
  filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.55));
}

.vfx-overlay__shield-svg {
  display: block;
  width: 100%;
  height: 100%;
}

/* why: the spin is a transform-only rotate, applied ONLY when
   shieldSpins is true (full intensity, not reduced-motion). Static otherwise —
   the identity survives low / reduced-motion without motion (RS-1). ≤ ~600ms
   per the performance budget. */
.vfx-overlay__shield-spin {
  width: 100%;
  height: 100%;
  will-change: transform;
}

.vfx-overlay__shield-spin--active {
  animation: vfx-shield-spin 560ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes vfx-shield-spin {
  from {
    transform: rotate(-200deg);
  }
  to {
    transform: rotate(0deg);
  }
}

.vfx-shield-enter-active {
  transition: opacity 160ms ease-out, transform 240ms cubic-bezier(0.2, 1.4, 0.4, 1);
}

.vfx-shield-leave-active {
  transition: opacity 300ms ease-in, transform 300ms ease-in;
}

.vfx-shield-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.4);
}

.vfx-shield-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(1.1);
}

/* why: reduced-motion accessibility — the WORD still shows (shouldRender('word')
   stays true), but its scale-punch entrance degrades to a plain opacity fade,
   and the impact pulse is suppressed here as a belt-and-braces backstop to the
   JS shouldRender('shake') gate. The reward stays legible without motion. */
@media (prefers-reduced-motion: reduce) {
  .vfx-word-enter-active,
  .vfx-word-leave-active {
    transition: opacity 200ms ease;
  }

  .vfx-word-enter-from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }

  .vfx-word-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }

  .vfx-overlay__impact {
    animation: none;
    opacity: 0;
  }

  /* why: WP-650 — under reduced-motion the full-bleed red damage flash is
     suppressed (a photosensitivity-sensitive class of effect), belt-and-braces to
     the JS shouldRender('shake') gate that already withholds it. The wound thud
     (audio) still plays — feedback survives without the flash. */
  .vfx-overlay__wound {
    animation: none;
    opacity: 0;
  }

  /* why: WP-647 — under reduced-motion the shield GLYPH still shows (static, a
     plain fade), but its scale-punch + spin are suppressed. The spin is already
     gated off by shouldRender('shake') here; this is the belt-and-braces CSS
     backstop, mirroring the word's reduced-motion handling. */
  .vfx-shield-enter-active,
  .vfx-shield-leave-active {
    transition: opacity 200ms ease;
  }

  .vfx-shield-enter-from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }

  .vfx-shield-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1);
  }

  .vfx-overlay__shield-spin--active {
    animation: none;
  }
}
</style>
