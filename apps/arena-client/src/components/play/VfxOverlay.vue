<script lang="ts">
import { defineComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { comboVfxManifest } from '../../vfx/comboVfxManifest';
import { useEffectIntensity } from '../../vfx/effectIntensity';
import { useComboVfxSignal, type ComboVfxEvent } from '../../composables/useComboVfx';

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
 * @see WP-556 §D "VFX overlay"
 * @see apps/arena-client/src/components/play/NotableEventOverlay.vue (the overlay precedent)
 * @see DECISIONS.md D-24365 (the VFX determinism exemption)
 */

// why: how long the call-out word stays on screen before it fades out.
const WORD_DISPLAY_MS = 1300;
// why: the impact pulse duration — within the 500ms screen-shake performance
// budget (WP-556); it is a transform/opacity-only animation, never a layout property.
const IMPACT_MS = 450;

export default defineComponent({
  name: 'VfxOverlay',
  setup() {
    const { shouldRender } = useEffectIntensity();
    const signal = useComboVfxSignal();

    const canvasEl = ref<HTMLCanvasElement | null>(null);
    const currentWord = ref<string | null>(null);
    // why: a monotonic key so Vue re-mounts the word span on an equal-string
    // repeat, re-triggering its entrance transition (a second Team-Up! still animates).
    const wordKey = ref(0);
    const isImpacting = ref(false);

    let wordTimer: ReturnType<typeof setTimeout> | null = null;
    let impactTimer: ReturnType<typeof setTimeout> | null = null;

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

    function fireBurst(particleCount: number): void {
      void ensureConfetti().then(() => {
        if (confettiFire === null) return;
        confettiFire({
          particleCount,
          spread: 78,
          startVelocity: 42,
          gravity: 0.9,
          ticks: 120,
          origin: { x: 0.5, y: 0.62 },
          disableForReducedMotion: true,
        });
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

    onUnmounted(() => {
      if (wordTimer !== null) clearTimeout(wordTimer);
      if (impactTimer !== null) clearTimeout(impactTimer);
    });

    onMounted(() => {
      // why: warm the confetti chunk shortly after mount (idle), off the
      // first-paint path, so the first real combo bursts without a load stall.
      // Guarded + fail-soft, so a headless/jsdom mount is a no-op.
      void ensureConfetti();
    });

    return { canvasEl, currentWord, wordKey, isImpacting };
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
}
</style>
